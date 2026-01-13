(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        ARENA_SIZE: 30, PLAYER_SPEED: 8, PLAYER_HP: 100,
        FIRE_RATE: 200, BULLET_SPEED: 50, BULLET_DMG: 20,
        ENEMY_SPEED: 3, ENEMY_HP: 50, ENEMY_DMG: 10,
        CAM_OFFSET: new THREE.Vector3(0, 8, 12),
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.world = null; this.clock = new THREE.Clock();
        this.player = { mesh: null, body: null, health: 0, lastShot: 0 };
        this.enemies = []; this.bullets = [];
        this.keys = {}; this.mouse = new THREE.Vector2();
        this.gameState = 'between_waves'; // between_waves, wave_in_progress, game_over
        this.score = 0; this.wave = 0;

        this.hudMesh = null; this.overlayMesh = null; this.announcementMesh = null;
        this.announcementTimer = 0;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundMouseMove = null;
        this.boundCanvasClick = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        // Core Setup
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x1a1a2e);
        state.scene.fog = new THREE.Fog(0x1a1a2e, 10, 80);
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        state.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
        state.world.broadphase = new CANNON.NaiveBroadphase();
        
        // Lighting & World
        addLights(state.scene);
        buildArena(state);
        
        // Player
        state.player.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshStandardMaterial({color: 0x00ff00}));
        state.player.mesh.castShadow = true; state.scene.add(state.player.mesh);
        state.player.body = new CANNON.Body({ mass: 10, shape: new CANNON.Sphere(0.75), linearDamping: 0.9 });
        state.world.addBody(state.player.body);

        // Event Listeners
        const canvas = state.renderer.domElement;
        state.boundKeyDown = e => { state.keys[e.code] = true; };
        state.boundKeyUp = e => { state.keys[e.code] = false; };
        state.boundMouseMove = e => { state.mouse.x = (e.clientX/window.innerWidth)*2-1; state.mouse.y = -(e.clientY/window.innerHeight)*2+1; };
        state.boundCanvasClick = () => shoot(state);
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('keyup', state.boundKeyUp);
        window.addEventListener('mousemove', state.boundMouseMove);
        canvas.addEventListener('click', state.boundCanvasClick);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'between_waves'; state.score = 0; state.wave = 0;
        state.player.health = GAME_CONST.PLAYER_HP; state.player.lastShot = 0;
        state.player.body.position.set(0, 1, 0); state.player.body.velocity.set(0,0,0);
        
        state.enemies.forEach(e => { state.world.removeBody(e.body); state.scene.remove(e.mesh); }); state.enemies = [];
        state.bullets.forEach(b => { state.scene.remove(b.mesh); }); state.bullets = [];
        
        clearOverlay(state); clearAnnouncement(state);
        updateHUD(state);
        state.announcementTimer = 2.0; // Init timer for first wave
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        const deltaTime = Math.min(state.clock.getDelta(), 0.1);
        state.world.step(1/60, deltaTime);
        
        switch(state.gameState) {
            case 'wave_in_progress':
                updatePlayer(state);
                updateEnemies(state);
                updateBullets(state, deltaTime);
                handleCollisions(state);
                syncMeshesToBodies(state);
                updateCamera(state);
                updateHUD(state);
                if (state.enemies.length === 0) { state.gameState = 'between_waves'; state.announcementTimer = 2.0; }
                break;
            case 'between_waves':
                state.announcementTimer -= deltaTime;
                if (state.announcementTimer <= 0) startNextWave(state);
                syncMeshesToBodies(state);
                updateCamera(state);
                updateHUD(state);
                break;
            case 'game_over':
                if (state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
                syncMeshesToBodies(state); // Keep meshes synced for game over screen
                updateCamera(state);
                break;
        }
        state.renderer.render(state.scene, state.camera);
    }

    // --- SETUP FUNCTIONS ---
    function addLights(scene) { scene.add(new THREE.AmbientLight(0xffffff,0.5)); const l=new THREE.DirectionalLight(0xffffff,0.8); l.position.set(0,20,0); l.castShadow=true; scene.add(l); }
    function buildArena(state) {
        const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: new CANNON.Material() });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
        state.world.addBody(groundBody);
        const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(GAME_CONST.ARENA_SIZE*2, GAME_CONST.ARENA_SIZE*2), new THREE.MeshStandardMaterial({color: 0x333333}));
        groundMesh.rotation.x = -Math.PI/2; groundMesh.receiveShadow=true; state.scene.add(groundMesh);
        
        const wallShape = new CANNON.Box(new CANNON.Vec3(GAME_CONST.ARENA_SIZE/2, 2, 0.5));
        const wallMat = new THREE.MeshStandardMaterial({color: 0x555555});
        for(let i=0; i<4; i++){
            const angle = i * Math.PI / 2;
            const wallBody = new CANNON.Body({mass: 0, shape: wallShape});
            wallBody.position.set(Math.sin(angle) * GAME_CONST.ARENA_SIZE/2, 1, Math.cos(angle) * GAME_CONST.ARENA_SIZE/2);
            wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), angle);
            state.world.addBody(wallBody);
            const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.ARENA_SIZE, 4, 1), wallMat);
            wallMesh.position.copy(wallBody.position); wallMesh.quaternion.copy(wallBody.quaternion); state.scene.add(wallMesh);
        }
    }
    
    // --- GAME LOGIC ---
    function startNextWave(state) {
        state.wave++;
        showAnnouncement(state, `Wave ${state.wave}`, 2000);
        for (let i = 0; i < 5 + state.wave * 2; i++) spawnEnemy(state);
        state.gameState = 'wave_in_progress';
        updateHUD(state);
    }
    function spawnEnemy(state) {
        const angle = Math.random()*Math.PI*2, radius = GAME_CONST.ARENA_SIZE/2-2;
        const body = new CANNON.Body({ mass: 5, shape: new CANNON.Sphere(0.7), material: new CANNON.Material() });
        body.position.set(Math.cos(angle)*radius, 1, Math.sin(angle)*radius); state.world.addBody(body);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color:0xff0000}));
        mesh.castShadow = true; state.scene.add(mesh);
        const health = GAME_CONST.ENEMY_HP + state.wave*10;
        const enemy = { mesh, body, health, maxHealth: health };
        body.addEventListener('collide', e => {
            if(state.gameState === 'wave_in_progress' && e.body === state.player.body) {
                state.player.health -= GAME_CONST.ENEMY_DMG;
                if(state.player.health <= 0) handleEndGame(state);
            }
        });
        state.enemies.push(enemy);
    }
    function updatePlayer(state) {
        const pBody = state.player.body;
        const move = new THREE.Vector3();
        if (state.keys['KeyW']) move.z = -1; if (state.keys['KeyS']) move.z = 1;
        if (state.keys['KeyA']) move.x = -1; if (state.keys['KeyD']) move.x = 1;
        
        move.normalize().applyQuaternion(state.camera.quaternion);
        pBody.velocity.x = move.x * GAME_CONST.PLAYER_SPEED;
        pBody.velocity.z = move.z * GAME_CONST.PLAYER_SPEED;

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pBody.position.y);
        const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(state.mouse, state.camera);
        const worldMouse = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, worldMouse);
        if(worldMouse) pBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), Math.atan2(worldMouse.x - pBody.position.x, worldMouse.z - pBody.position.z));
    }

    function updateEnemies(state) {
        state.enemies.forEach(e => {
            const dir = state.player.body.position.clone().vsub(e.body.position);
            dir.y = 0; dir.normalize();
            e.body.velocity.x = dir.x * GAME_CONST.ENEMY_SPEED;
            e.body.velocity.z = dir.z * GAME_CONST.ENEMY_SPEED;
        });
    }

    function updateBullets(state, deltaTime) {
        for(let i=state.bullets.length-1; i>=0; i--) {
            const b = state.bullets[i];
            b.mesh.position.addScaledVector(b.velocity, deltaTime);
            if(b.mesh.position.length() > GAME_CONST.ARENA_SIZE*2) { state.scene.remove(b.mesh); bullets.splice(i,1); }
        }
    }
    
    function handleCollisions(state) {
        for (let i = state.bullets.length-1; i>=0; i--) for (let j = state.enemies.length-1; j>=0; j--) {
            if (state.bullets[i] && state.enemies[j] && state.bullets[i].mesh.position.distanceTo(state.enemies[j].mesh.position) < 1.0) {
                state.enemies[j].health -= GAME_CONST.BULLET_DMG;
                state.scene.remove(state.bullets[i].mesh); state.bullets.splice(i,1);
                if(state.enemies[j].health <= 0) {
                    state.score+=10; state.world.removeBody(state.enemies[j].body); state.scene.remove(state.enemies[j].mesh); state.enemies.splice(j,1);
                }
                break;
            }
        }
    }

    function shoot(state) {
        if(state.gameState !== 'wave_in_progress' || state.clock.getElapsedTime() < state.player.lastShot + (GAME_CONST.FIRE_RATE/1000)) return;
        state.player.lastShot = state.clock.getElapsedTime();
        
        const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -state.player.body.position.y);
        const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(state.mouse, state.camera);
        const worldMouse = new THREE.Vector3(); raycaster.ray.intersectPlane(plane, worldMouse);
        if(!worldMouse) return;

        const dir = worldMouse.clone().sub(state.player.body.position).normalize();
        const bullet = { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color:0xffff00})), velocity: dir.multiplyScalar(GAME_CONST.BULLET_SPEED) };
        bullet.mesh.position.copy(state.player.body.position).add(dir.multiplyScalar(1.5));
        state.bullets.push(bullet); state.scene.add(bullet.mesh);
    }
    
    function syncMeshesToBodies(state) {
        state.player.mesh.position.copy(state.player.body.position);
        state.player.mesh.quaternion.copy(state.player.body.quaternion);
        state.enemies.forEach(e => { e.mesh.position.copy(e.body.position); e.mesh.quaternion.copy(e.body.quaternion); });
    }

    function updateCamera(state) {
        const targetPos = state.player.body.position.clone().add(GAME_CONST.CAM_OFFSET);
        state.camera.position.lerp(targetPos, 0.1);
        state.camera.lookAt(state.player.body.position);
    }

    function handleEndGame(state) {
        if(state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        showOverlay(state, `GAME OVER\nYou survived ${state.wave} waves with score ${state.score}!\n\n[ENTER] to restart`, true);
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth/window.innerHeight; state.camera.updateProjectionMatrix(); state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // --- HUD / OVERLAY ---
    function updateHUD(state) {
        if(state.hudMesh) { state.camera.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = `Health: ${Math.ceil(state.player.health)}\nScore: ${state.score}\nWave: ${state.wave}`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 400, height: 100, align: "left" });
        state.hudMesh.position.set(-state.camera.aspect * 2.5, 2.3, -4);
        state.camera.add(state.hudMesh);
    }
    function showAnnouncement(state, text, duration) { clearAnnouncement(state); state.announcementMesh = createTextLabelMesh(text, { font: "48px Impact", width: 800, height: 100, bg: "rgba(0,0,0,0.7)" }); state.announcementMesh.position.set(0,0,-5); state.camera.add(state.announcementMesh); if(duration) setTimeout(()=>clearAnnouncement(state), duration); }
    function clearAnnouncement(state) { if(state.announcementMesh) { state.camera.remove(state.announcementMesh); disposeMesh(state.announcementMesh); state.announcementMesh = null; } }
    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:"32px Courier New", align:"center", width:600,height:250,...(bg&&{bg:'rgba(0,0,0,0.8)'})}); state.overlayMesh.position.set(0,0,-5); state.camera.add(state.overlayMesh); } 
    function clearOverlay(state) { if(state.overlayMesh) { state.camera.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
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
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/100,h/100), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
        mesh.renderOrder=10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        const canvas = state.renderer?.domElement;
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('mousemove', state.boundMouseMove);
        if(canvas) canvas.removeEventListener('click', state.boundCanvasClick);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) { if(state.hudMesh) state.camera.remove(state.hudMesh); if(state.overlayMesh) state.camera.remove(state.overlayMesh); if(state.announcementMesh) state.camera.remove(state.announcementMesh); }
        if (state.renderer) { if(canvas?.parentNode) canvas.parentNode.removeChild(canvas); state.renderer.dispose(); }
        if(state.world) while(state.world.bodies.length > 0) state.world.removeBody(state.world.bodies[0]);
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();