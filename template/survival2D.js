(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 24, WORLD_H: 18, PLAYER_SPEED: 0.2, PLAYER_HEALTH: 100,
        FIRE_RATE: 200, BULLET_SPEED: 0.5, BULLET_DMG: 10,
        ENEMY_BASE_SPEED: 0.04, ENEMY_BASE_HEALTH: 20, ENEMY_DMG: 10,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.player = null; this.bullets = []; this.enemies = [];
        this.keys = {}; this.mouse = new THREE.Vector2();
        this.score = 0; this.wave = 0;
        this.gameState = 'playing'; // playing, wave_end, game_over

        this.hudMesh = null; this.overlayMesh = null; this.announcementMesh = null;
        this.announcementTimer = 0;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundMouseMove = null;
        this.boundMouseDown = null; this.boundResize = null;
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
        
        state.scene.add(new THREE.AmbientLight(0xffffff,0.8));
        buildWalls(state.scene);
        
        state.player = createCharacter(0x00ff00, { health: GAME_CONST.PLAYER_HEALTH, maxHealth: GAME_CONST.PLAYER_HEALTH, lastShot: 0 });
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
        state.gameState = 'wave_end'; state.score = 0; state.wave = 0;
        state.player.userData.health = GAME_CONST.PLAYER_HEALTH; state.player.position.set(0,0,0);
        
        state.bullets.forEach(b => state.scene.remove(b)); state.enemies.forEach(e => state.scene.remove(e));
        state.bullets = []; state.enemies = [];
        
        clearOverlay(state); clearAnnouncement(state);
        updateHUD(state);
        state.announcementTimer = 2.0; // Start countdown for first wave
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        const delta = state.clock.getDelta();

        switch(state.gameState) {
            case 'playing':
                updatePlayer(state);
                updateEntities(state);
                handleCollisions(state);
                updateHUD(state);
                break;
            case 'wave_end':
                state.announcementTimer -= delta;
                if (state.announcementTimer <= 0) {
                    startNextWave(state);
                    clearAnnouncement(state);
                }
                break;
            case 'game_over':
                if (state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
                break;
        }
        state.renderer.render(state.scene, state.camera);
    }
    
    function createCharacter(color, data) {
        const char = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshStandardMaterial({ color }));
        char.userData = data;
        return char;
    }

    function startNextWave(state) {
        state.wave++;
        showAnnouncement(state, `Wave ${state.wave}`, 2000);
        spawnEnemies(state, 3 + state.wave * 2);
        state.gameState = 'playing';
        updateHUD(state);
    }

    function spawnEnemies(state, count) {
        for (let i = 0; i < count; i++) {
            const health = GAME_CONST.ENEMY_BASE_HEALTH + state.wave * 5;
            const enemy = createCharacter(0xff0000, {
                health, maxHealth: health,
                speed: GAME_CONST.ENEMY_BASE_SPEED + state.wave * 0.005,
                points: 10 * state.wave
            });
            const side = Math.floor(Math.random() * 4);
            let x, y;
            if (side === 0) { x = -GAME_CONST.WORLD_W/2-1; y = (Math.random()-0.5)*GAME_CONST.WORLD_H; }
            else if (side === 1) { x = GAME_CONST.WORLD_W/2+1; y = (Math.random()-0.5)*GAME_CONST.WORLD_H; }
            else if (side === 2) { x = (Math.random()-0.5)*GAME_CONST.WORLD_W; y = -GAME_CONST.WORLD_H/2-1; }
            else { x = (Math.random()-0.5)*GAME_CONST.WORLD_W; y = GAME_CONST.WORLD_H/2+1; }
            enemy.position.set(x,y,0);
            state.enemies.push(enemy); state.scene.add(enemy);
        }
    }

    function updatePlayer(state) {
        if (state.keys['KeyW'] || state.keys['ArrowUp']) state.player.position.y += GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) state.player.position.y -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.player.position.x -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.player.position.x += GAME_CONST.PLAYER_SPEED;
        const halfW = GAME_CONST.WORLD_W/2-0.5, halfH = GAME_CONST.WORLD_H/2-0.5;
        state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -halfW, halfW);
        state.player.position.y = THREE.MathUtils.clamp(state.player.position.y, -halfH, halfH);
    }

    function updateEntities(state) {
        state.bullets.forEach(b => b.position.add(b.userData.velocity));
        state.enemies.forEach(e => e.position.add(state.player.position.clone().sub(e.position).normalize().multiplyScalar(e.userData.speed)));
    }

    function handleCollisions(state) {
        for (let i = state.bullets.length-1; i>=0; i--) for (let j = state.enemies.length-1; j>=0; j--) {
            if (state.bullets[i] && state.enemies[j] && state.bullets[i].position.distanceTo(state.enemies[j].position) < 0.8) {
                state.enemies[j].userData.health -= GAME_CONST.BULLET_DMG;
                if(state.enemies[j].userData.health <= 0) { state.score+=state.enemies[j].userData.points; state.scene.remove(state.enemies[j]); state.enemies.splice(j,1); }
                state.scene.remove(state.bullets[i]); state.bullets.splice(i,1); break;
            }
        }
        for (let i = state.enemies.length-1; i>=0; i--) {
            if (state.enemies[i] && state.player.position.distanceTo(state.enemies[i].position) < 1.0) {
                state.player.userData.health -= GAME_CONST.ENEMY_DMG; state.scene.remove(state.enemies[i]); state.enemies.splice(i,1);
                if (state.player.userData.health <= 0) { handleEndGame(state); return; }
            }
        }
        if (state.enemies.length === 0 && state.gameState === 'playing') { state.gameState = 'wave_end'; state.announcementTimer = 2.0; }
    }

    function shoot(state) {
        if (state.gameState !== 'playing' || state.clock.getElapsedTime() < state.player.userData.lastShot + (GAME_CONST.FIRE_RATE/1000)) return;
        state.player.userData.lastShot = state.clock.getElapsedTime();

        const plane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
        const raycaster = new THREE.Raycaster(), worldMouse = new THREE.Vector3();
        raycaster.setFromCamera(state.mouse, state.camera);
        raycaster.ray.intersectPlane(plane, worldMouse);
        const dir = worldMouse.clone().sub(state.player.position).normalize();

        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8), new THREE.MeshStandardMaterial({color:0xffff00,emissive:0xcccc00}));
        bullet.position.copy(state.player.position); bullet.userData.velocity = dir.multiplyScalar(GAME_CONST.BULLET_SPEED);
        state.bullets.push(bullet); state.scene.add(bullet);
    }
    
    function handleEndGame(state) {
        if(state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        showOverlay(state, `GAME OVER\nYou survived ${state.wave-1} waves with score ${state.score}!\n\n[ENTER] to restart`, true);
    }

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

    function onMouseMove(e, state) { state.mouse.x = (e.clientX/window.innerWidth)*2-1; state.mouse.y = -(e.clientY/window.innerHeight)*2+1; }
    function onResize(state) {
        const aspect = window.innerWidth/window.innerHeight, targetAspect = GAME_CONST.WORLD_W/GAME_CONST.WORLD_H;
        state.camera.left = -GAME_CONST.WORLD_W/2; state.camera.right = GAME_CONST.WORLD_W/2;
        state.camera.top = GAME_CONST.WORLD_H/2; state.camera.bottom = -GAME_CONST.WORLD_H/2;
        if(aspect > targetAspect) { state.camera.left*=aspect/targetAspect; state.camera.right*=aspect/targetAspect; }
        else { state.camera.top/=aspect/targetAspect; state.camera.bottom/=aspect/targetAspect; }
        state.camera.updateProjectionMatrix(); state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = `Health: ${Math.ceil(state.player.userData.health)}
Score: ${state.score}
Wave: ${state.wave}`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 300, height: 100, align: "left" });
        const cam = state.camera;
        state.hudMesh.position.set(cam.left + 2.5, cam.top - 2.5, 0);
        state.scene.add(state.hudMesh);
    }
    function showAnnouncement(state, text, duration) { clearAnnouncement(state); state.announcementMesh = createTextLabelMesh(text, { font: "48px Impact", width: 800, height: 100, bg: "rgba(0,0,0,0.7)" }); state.announcementMesh.position.z=5; state.scene.add(state.announcementMesh); if(duration) setTimeout(()=>clearAnnouncement(state), duration); }
    function clearAnnouncement(state) { if(state.announcementMesh) { state.scene.remove(state.announcementMesh); disposeMesh(state.announcementMesh); state.announcementMesh = null; } }
    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:"32px Courier New", align:"center", width:600,height:250,...(bg&&{bg:'rgba(0,0,0,0.8)'})}); state.overlayMesh.position.z=5; state.scene.add(state.overlayMesh); } 
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