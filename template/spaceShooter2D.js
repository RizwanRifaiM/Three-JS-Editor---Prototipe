(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 20, WORLD_H: 16, PLAYER_SPEED: 0.2, PLAYER_HEALTH_INIT: 100, PLAYER_DAMAGE: 20,
        BULLET_SPEED: 0.5, FIRE_RATE: 200, ENEMY_SPEED: 0.08, ENEMY_SPAWN_RATE: 0.02,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null;
        this.player = null; this.stars = [];
        this.bullets = []; this.enemies = [];
        this.keys = {};
        this.score = 0; this.health = 0;
        this.isGameOver = false;
        this.lastShotTime = 0;

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x000011);

        state.camera = new THREE.OrthographicCamera(-GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_H/2, -GAME_CONST.WORLD_H/2, 0.1, 100);
        state.camera.position.z = 10;
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        addLights(state.scene);
        createStars(state);
        
        state.player = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshPhongMaterial({ color: 0x00ff00 }));
        state.player.rotation.z = Math.PI; // Point upwards
        state.scene.add(state.player);

        state.boundKeyDown = e => { state.keys[e.code] = true; };
        state.boundKeyUp = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('keyup', state.boundKeyUp);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.isGameOver = false; state.score = 0; state.health = GAME_CONST.PLAYER_HEALTH_INIT;
        state.bullets.forEach(b => state.scene.remove(b)); state.enemies.forEach(e => state.scene.remove(e));
        state.bullets = []; state.enemies = [];
        state.player.position.set(0, -GAME_CONST.WORLD_H/2 + 1, 0);
        state.player.visible = true;

        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        if (state.isGameOver) {
            if (state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
        } else {
            updatePlayer(state);
            spawnEnemy(state);
            updateEntities(state);
            checkCollisions(state);
            updateHUD(state);
        }
        state.renderer.render(state.scene, state.camera);
    }

    function addLights(scene) { scene.add(new THREE.AmbientLight(0xffffff,0.7)); const l=new THREE.DirectionalLight(0xffffff,0.5); l.position.set(5,5,5); scene.add(l); }
    function createStars(state) {
        for (let i = 0; i < 200; i++) {
            const star = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            star.position.set((Math.random()-0.5)*GAME_CONST.WORLD_W*2, (Math.random()-0.5)*GAME_CONST.WORLD_H*2, -5);
            state.stars.push(star); state.scene.add(star);
        }
    }
    
    function updatePlayer(state) {
        const bounds = { x: state.camera.right, y: state.camera.top };
        if (state.keys['KeyW'] || state.keys['ArrowUp']) state.player.position.y = Math.min(bounds.y-0.5, state.player.position.y+GAME_CONST.PLAYER_SPEED);
        if (state.keys['KeyS'] || state.keys['ArrowDown']) state.player.position.y = Math.max(-bounds.y+0.5, state.player.position.y-GAME_CONST.PLAYER_SPEED);
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.player.position.x = Math.max(-bounds.x+0.5, state.player.position.x-GAME_CONST.PLAYER_SPEED);
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.player.position.x = Math.min(bounds.x-0.5, state.player.position.x+GAME_CONST.PLAYER_SPEED);
        if (state.keys['Space'] && Date.now() - state.lastShotTime > GAME_CONST.FIRE_RATE) { shoot(state); state.lastShotTime = Date.now(); }
    }

    function shoot(state) {
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.15,6,6), new THREE.MeshPhongMaterial({color:0xffff00,emissive:0xffff00}));
        bullet.position.copy(state.player.position).add(new THREE.Vector3(0,0.8,0));
        state.bullets.push(bullet); state.scene.add(bullet);
    }

    function spawnEnemy(state) {
        if (Math.random() < GAME_CONST.ENEMY_SPAWN_RATE) {
            const enemy = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshPhongMaterial({color:0xff0000}));
            enemy.position.set((Math.random()-0.5)*(state.camera.right*2-1), state.camera.top, 0);
            state.enemies.push(enemy); state.scene.add(enemy);
        }
    }

    function updateEntities(state) {
        for (let i = state.bullets.length-1; i>=0; i--) {
            const b = state.bullets[i]; b.position.y += GAME_CONST.BULLET_SPEED;
            if (b.position.y > state.camera.top) { state.scene.remove(b); state.bullets.splice(i,1); }
        }
        for (let i = state.enemies.length-1; i>=0; i--) {
            const e = state.enemies[i]; e.position.y -= GAME_CONST.ENEMY_SPEED;
            if (e.position.y < -state.camera.top) { state.scene.remove(e); state.enemies.splice(i,1); }
        }
        state.stars.forEach(s => { s.position.y -= 0.05; if (s.position.y < -GAME_CONST.WORLD_H) s.position.y = GAME_CONST.WORLD_H; });
    }

    function checkCollisions(state) {
        for (let i = state.bullets.length-1; i>=0; i--) for (let j = state.enemies.length-1; j>=0; j--) {
            if (state.bullets[i] && state.enemies[j] && state.bullets[i].position.distanceTo(state.enemies[j].position) < 0.7) {
                state.scene.remove(state.bullets[i]); state.scene.remove(state.enemies[j]);
                state.bullets.splice(i,1); state.enemies.splice(j,1); state.score+=10; break;
            }
        }
        for (let i = state.enemies.length-1; i>=0; i--) {
            if (state.enemies[i] && state.player.position.distanceTo(state.enemies[i].position) < 0.8) {
                state.scene.remove(state.enemies[i]); state.enemies.splice(i,1);
                state.health -= GAME_CONST.PLAYER_DAMAGE;
                if(state.health <= 0) handleEndGame(state);
            }
        }
    }
    
    function handleEndGame(state) {
        if(state.isGameOver) return;
        state.isGameOver = true; state.player.visible = false;
        showOverlay(state, `GAME OVER
Score: ${state.score}

[ENTER] to restart`, true);
    }
    
    function onResize(state) {
        const aspect = window.innerWidth / window.innerHeight;
        state.camera.left = -GAME_CONST.WORLD_W/2; state.camera.right = GAME_CONST.WORLD_W/2;
        state.camera.top = GAME_CONST.WORLD_H/2; state.camera.bottom = -GAME_CONST.WORLD_H/2;
        if(aspect > GAME_CONST.WORLD_W/GAME_CONST.WORLD_H) { state.camera.left*=aspect/(GAME_CONST.WORLD_W/GAME_CONST.WORLD_H); state.camera.right*=aspect/(GAME_CONST.WORLD_W/GAME_CONST.WORLD_H); }
        else { state.camera.top/=aspect/(GAME_CONST.WORLD_W/GAME_CONST.WORLD_H); state.camera.bottom/=aspect/(GAME_CONST.WORLD_W/GAME_CONST.WORLD_H); }
        state.camera.updateProjectionMatrix(); state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = `Health: ${state.health}\nScore: ${state.score}`;
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
        window.removeEventListener('resize', state.boundResize);
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();