(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 28, WORLD_H: 18, PLAYER_SPEED: 0.2, PLAYER_HEALTH: 100,
        ENEMY_SPEED: 0.03, ENEMY_COUNT: 8, BULLET_SPEED: 0.6, FIRE_RATE: 200,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null;
        this.player = null; this.bullets = []; this.enemies = [];
        this.keys = {}; this.mouse = new THREE.Vector2();
        this.score = 0; this.health = 0;
        this.isGameOver = false;
        this.lastShotTime = 0;
        
        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
        this.boundMouseMove = null; this.boundMouseDown = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x1a1a2e);

        state.camera = new THREE.OrthographicCamera(-GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_H/2, -GAME_CONST.WORLD_H/2, 0.1, 100);
        state.camera.position.z = 10;
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        addLights(state.scene);
        buildWalls(state.scene);
        
        state.player = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
        state.scene.add(state.player);

        state.boundKeyDown = e => { state.keys[e.code] = true; };
        state.boundKeyUp = e => { state.keys[e.code] = false; };
        state.boundMouseMove = e => onMouseMove(e, state);
        state.boundMouseDown = () => shoot(state);
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('keyup', state.boundKeyUp);
        window.addEventListener('mousemove', state.boundMouseMove);
        window.addEventListener('mousedown', state.boundMouseDown);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.isGameOver = false; state.score = 0; state.health = GAME_CONST.PLAYER_HEALTH;
        state.player.position.set(0, 0, 0);
        state.player.visible = true;

        state.bullets.forEach(b => state.scene.remove(b));
        state.enemies.forEach(e => state.scene.remove(e));
        state.bullets = []; state.enemies = [];

        for (let i=0; i<GAME_CONST.ENEMY_COUNT; i++) spawnEnemy(state);
        
        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        if (state.isGameOver) {
            if(state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
        } else {
            updatePlayer(state);
            updateEntities(state);
            handleCollisions(state);
            updateHUD(state);
        }
        state.renderer.render(state.scene, state.camera);
    }
    
    function addLights(scene) { scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const l=new THREE.DirectionalLight(0xffffff, 0.4); l.position.set(5,10,5); scene.add(l); }
    function buildWalls(scene) {
        const wallMat = new THREE.MeshStandardMaterial({color: 0x4a4a6e});
        const T = 0.5;
        const walls = [
            new THREE.BoxGeometry(GAME_CONST.WORLD_W+T, T, T), new THREE.BoxGeometry(GAME_CONST.WORLD_W+T, T, T),
            new THREE.BoxGeometry(T, GAME_CONST.WORLD_H+T, T), new THREE.BoxGeometry(T, GAME_CONST.WORLD_H+T)
        ];
        const pos = [
            [0, GAME_CONST.WORLD_H/2, 0], [0, -GAME_CONST.WORLD_H/2, 0],
            [-GAME_CONST.WORLD_W/2, 0, 0], [GAME_CONST.WORLD_W/2, 0, 0]
        ];
        for(let i=0; i<4; i++){ const w=new THREE.Mesh(walls[i], wallMat); w.position.set(...pos[i]); scene.add(w); }
    }
    
    function spawnEnemy(state) {
        const enemy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff3333 }));
        do {
            enemy.position.set((Math.random()-0.5)*(GAME_CONST.WORLD_W-2), (Math.random()-0.5)*(GAME_CONST.WORLD_H-2), 0);
        } while (enemy.position.distanceTo(state.player.position) < 5);
        state.enemies.push(enemy);
        state.scene.add(enemy);
    }

    function updatePlayer(state) {
        if (state.keys['KeyW'] || state.keys['ArrowUp']) state.player.position.y += GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) state.player.position.y -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.player.position.x -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.player.position.x += GAME_CONST.PLAYER_SPEED;

        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(state.mouse, state.camera);
        const worldMouse = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, worldMouse);
        
        const angle = Math.atan2(worldMouse.y - state.player.position.y, worldMouse.x - state.player.position.x);
        state.player.rotation.z = angle - Math.PI / 2;
    }

    function updateEntities(state) {
        for (let i = state.bullets.length-1; i >= 0; i--) {
            const b = state.bullets[i];
            b.position.add(b.userData.velocity);
            if (Math.abs(b.position.x)>GAME_CONST.WORLD_W/2 || Math.abs(b.position.y)>GAME_CONST.WORLD_H/2) {
                state.scene.remove(b); state.bullets.splice(i, 1);
            }
        }
        state.enemies.forEach(enemy => {
            enemy.position.add(state.player.position.clone().sub(enemy.position).normalize().multiplyScalar(GAME_CONST.ENEMY_SPEED));
        });
    }

    function handleCollisions(state) {
        const halfW = GAME_CONST.WORLD_W/2-0.5, halfH = GAME_CONST.WORLD_H/2-0.5;
        state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -halfW, halfW);
        state.player.position.y = THREE.MathUtils.clamp(state.player.position.y, -halfH, halfH);

        for (let i = state.bullets.length-1; i>=0; i--) for (let j = state.enemies.length - 1; j >= 0; j--) {
            if (state.bullets[i]?.position.distanceTo(state.enemies[j].position) < 0.8) {
                state.scene.remove(state.bullets[i]); state.scene.remove(state.enemies[j]);
                state.bullets.splice(i, 1); state.enemies.splice(j, 1);
                state.score += 10; spawnEnemy(state);
                break;
            }
        }
        for (const enemy of state.enemies) if (state.player.position.distanceTo(enemy.position) < 1.0) {
            state.health -= 0.5;
            if (state.health <= 0) { state.health=0; handleEndGame(state); }
        }
    }

    function shoot(state) {
        if (state.isGameOver || Date.now() - state.lastShotTime < GAME_CONST.FIRE_RATE) return;
        state.lastShotTime = Date.now();

        const plane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
        const raycaster = new THREE.Raycaster(), worldMouse = new THREE.Vector3();
        raycaster.setFromCamera(state.mouse, state.camera);
        raycaster.ray.intersectPlane(plane, worldMouse);
        
        const dir = worldMouse.clone().sub(state.player.position).normalize();
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8), new THREE.MeshStandardMaterial({color:0xffff00,emissive:0xcccc00}));
        bullet.position.copy(state.player.position);
        bullet.userData.velocity = dir.multiplyScalar(GAME_CONST.BULLET_SPEED);
        state.bullets.push(bullet);
        state.scene.add(bullet);
    }
    
    function handleEndGame(state) {
        if(state.isGameOver) return;
        state.isGameOver = true; state.player.visible = false;
        showOverlay(state, `GAME OVER\nFinal Score: ${state.score}\n\n[ENTER] to restart`, true);
    }
    
    function onMouseMove(e, state) { state.mouse.x = (e.clientX/window.innerWidth)*2-1; state.mouse.y = -(e.clientY/window.innerHeight)*2+1; }
    function onResize(state) {
        const aspect = window.innerWidth/window.innerHeight, targetAspect = GAME_CONST.WORLD_W/GAME_CONST.WORLD_H;
        state.camera.left = -GAME_CONST.WORLD_W/2; state.camera.right = GAME_CONST.WORLD_W/2;
        state.camera.top = GAME_CONST.WORLD_H/2; state.camera.bottom = -GAME_CONST.WORLD_H/2;
        if(aspect > targetAspect) { state.camera.left*=aspect/targetAspect; state.camera.right*=aspect/targetAspect; }
        else { state.camera.top/=aspect/targetAspect; state.camera.bottom/=aspect/targetAspect; }
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = `Health: ${Math.ceil(state.health)}
Score: ${state.score}`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 300, height: 70, align: "left" });
        const cam = state.camera;
        state.hudMesh.position.set(cam.left + 2.5, cam.top - 1.5, 0);
        state.scene.add(state.hudMesh);
    }

    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:"32px Courier New", align:"center", width:500,height:250,...(bg&&{bg:'rgba(0,0,0,0.8)'})}); state.overlayMesh.position.z=5; state.scene.add(state.overlayMesh); } 
    function clearOverlay(state) { if(state.overlayMesh) { state.scene.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font=opts.font||"24px Arial", w=opts.width||512, h=opts.height||128;
        canvas.width=w; canvas.height=h; ctx.font=font;
        if(opts.bg){ctx.fillStyle=opts.bg; ctx.fillRect(0,0,w,h);}
        ctx.fillStyle=opts.color||"#fff"; ctx.textAlign=opts.align||"center"; ctx.textBaseline="middle";
        const lines=text.split("\n"), lH=h/lines.length, x=opts.align==='left'?20:w/2;
        for(let i=0; i<lines.length; i++) ctx.fillText(lines[i], x, lH*(i+0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/25, h/25), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
        mesh.renderOrder=10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('mousemove', state.boundMouseMove);
        window.removeEventListener('mousedown', state.boundMouseDown);
        window.removeEventListener('resize', state.boundResize);
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();