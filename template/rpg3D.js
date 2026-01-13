(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRAVITY: -20, PLAYER_SPEED: 5, PLAYER_RADIUS: 0.5,
        ATTACK_COOLDOWN: 500, ATTACK_RANGE: 2.5, ATTACK_DAMAGE: 15, ENEMY_COUNT: 5,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.world = null; this.clock = new THREE.Clock();
        this.player = { body: null, mesh: null, stats: {}, lastAttack: 0 };
        this.enemies = []; this.items = []; this.keys = {};
        this.gameState = 'playing'; // playing | game_over
        this.hudMesh = null; this.crosshairMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
        this.boundPointerLockChange = null; this.boundMouseMove = null; this.boundCanvasClick = null;
    }

    function init() {
        state = new GameState();
        // Core Setup
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x5a8236);
        state.scene.fog = new THREE.Fog(0x5a8236, 15, 80);
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        state.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GAME_CONST.GRAVITY, 0) });
        
        // Lighting & World
        addLights(state.scene);
        buildWorld(state);
        
        // Player & Crosshair
        createPlayer(state);
        addCrosshair(state);

        // Event Listeners
        const canvas = state.renderer.domElement;
        state.boundCanvasClick = () => canvas.requestPointerLock();
        state.boundPointerLockChange = () => onPointerLockChange(state);
        state.boundMouseMove = e => onMouseMove(e, state);
        state.boundKeyDown = e => onKey(e, true);
        state.boundKeyUp = e => onKey(e, false);
        state.boundResize = () => onResize(state);
        canvas.addEventListener('click', state.boundCanvasClick);
        document.addEventListener('pointerlockchange', state.boundPointerLockChange);
        document.addEventListener('mousemove', state.boundMouseMove);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('keyup', state.boundKeyUp);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing';
        clearOverlay(state);
        
        state.enemies.forEach(e => { state.world.removeBody(e.body); state.scene.remove(e.mesh); });
        state.enemies = [];
        state.items.forEach(i => { if(i.body) state.world.removeBody(i.body); state.scene.remove(i.mesh); });
        state.items = [];
        
        state.player.body.position.set(0, 5, 0);
        state.player.body.velocity.set(0,0,0);
        state.player.stats = { hp: 100, maxHp: 100, level: 1, exp: 0, expToNext: 50, gold: 0 };
        
        for (let i = 0; i < GAME_CONST.ENEMY_COUNT; i++) spawnEnemy(state);
        for (let i = 0; i < 3; i++) spawnItem(state, 'gold');
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        const delta = Math.min(0.05, state.clock.getDelta());
        state.world.step(1/60, delta);
        
        if (state.gameState === 'playing') {
            updatePlayer(state, delta);
            updateEnemies(state);
            updateItems(state);
            updateHUD(state);
        } else if (state.keys['Enter'] || state.keys['KeyR']) {
            resetGame(state);
        }

        // Sync meshes with physics bodies
        state.enemies.forEach(e => {
            e.mesh.position.copy(e.body.position); e.mesh.quaternion.copy(e.body.quaternion);
            if(e.healthBar) e.healthBar.quaternion.copy(state.camera.quaternion);
        });
        state.player.mesh.position.copy(state.player.body.position);

        state.renderer.render(state.scene, state.camera);
    }

    // --- SETUP FUNCTIONS ---
    function addLights(scene) { scene.add(new THREE.AmbientLight(0xffffff,0.6)); const l=new THREE.DirectionalLight(0xffffff,0.8); l.position.set(20,30,15); l.castShadow=true; scene.add(l); }
    function buildWorld(state) {
        const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: new CANNON.Material() });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
        state.world.addBody(groundBody);
        const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({color: 0x4a5d23}));
        groundMesh.rotation.x = -Math.PI/2; groundMesh.receiveShadow=true;
        state.scene.add(groundMesh);
    }
    function createPlayer(state) {
        const body = new CANNON.Body({ mass: 10, shape: new CANNON.Sphere(GAME_CONST.PLAYER_RADIUS), linearDamping: 0.9, material: new CANNON.Material() });
        body.position.y = 5; state.world.addBody(body);
        state.player.body = body;
        state.player.mesh = new THREE.Group();
        state.player.mesh.add(state.camera);
        state.scene.add(state.player.mesh);
    }
    
    // --- ENTITY & ITEM SPAWNING ---
    function spawnEnemy(state) {
        const level = state.player.stats.level;
        const body = new CANNON.Body({ mass: 5, shape: new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5)), material: new CANNON.Material() });
        const angle = Math.random() * Math.PI * 2, dist = 10 + Math.random() * 20;
        body.position.set(Math.cos(angle)*dist, 5, Math.sin(angle)*dist);
        state.world.addBody(body);
        
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshStandardMaterial({color: 0xff0000}));
        mesh.castShadow = true; state.scene.add(mesh);
        
        const stats = { hp: 30 + level*10, maxHp: 30 + level*10, damage: 5 + level, exp: 10, gold: 5 };
        const enemy = { mesh, body, stats, lastDamage: 0, healthBar: createHealthBar() };
        enemy.mesh.add(enemy.healthBar);
        
        body.addEventListener('collide', e => {
            if(state.gameState === 'playing' && e.body === state.player.body && state.clock.getElapsedTime() > enemy.lastDamage + 1) {
                state.player.stats.hp -= stats.damage;
                enemy.lastDamage = state.clock.getElapsedTime();
                if(state.player.stats.hp <= 0) handleEndGame(state);
            }
        });
        state.enemies.push(enemy);
    }

    function spawnItem(state, type) {
        const geo = type==='gold' ? new THREE.TorusGeometry(0.3, 0.1, 8, 16) : new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: type === 'gold' ? 0xffd700 : 0xee82ee, emissive: type==='gold' ? 0x996600 : 0x880088 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random()-0.5)*40, 0.5, (Math.random()-0.5)*30);
        const item = { mesh, type, collected: false };
        state.items.push(item);
        state.scene.add(mesh);
    }
    
    // --- GAME LOGIC ---
    function updatePlayer(state, delta) {
        const pBody = state.player.body;
        const move = new THREE.Vector3();
        if (state.keys.KeyW) move.z = -1; if (state.keys.KeyS) move.z = 1;
        if (state.keys.KeyA) move.x = -1; if (state.keys.KeyD) move.x = 1;
        
        if(move.lengthSq() > 0) {
            move.normalize().applyQuaternion(state.camera.quaternion);
            pBody.velocity.x = move.x * PLAYER_SPEED;
            pBody.velocity.z = move.z * PLAYER_SPEED;
        }
        if (state.keys.Space && state.clock.getElapsedTime() > state.player.lastAttack + (GAME_CONST.ATTACK_COOLDOWN/1000)) {
            state.player.lastAttack = state.clock.getElapsedTime();
            state.enemies.forEach(enemy => {
                if (pBody.position.distanceTo(enemy.body.position) < GAME_CONST.ATTACK_RANGE) enemy.stats.hp -= GAME_CONST.ATTACK_DAMAGE;
            });
        }
    }

    function updateEnemies(state) {
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const enemy = state.enemies[i];
            const eBody = enemy.body, eStats = enemy.stats;
            
            if (eStats.hp <= 0) {
                state.world.removeBody(eBody); state.scene.remove(enemy.mesh);
                state.enemies.splice(i, 1);
                
                const pStats = state.player.stats;
                pStats.exp += eStats.exp; pStats.gold += eStats.gold;
                if(pStats.exp >= pStats.expToNext) {
                    pStats.level++; pStats.exp = 0; pStats.expToNext *= 1.5; pStats.hp = pStats.maxHp;
                }
                spawnEnemy(state);
                continue;
            }
            
            const dir = state.player.body.position.clone().vsub(eBody.position);
            if(dir.lengthSquared() < 144) {
                dir.normalize();
                eBody.velocity.x = dir.x * 3; eBody.velocity.z = dir.z * 3;
            }

            const hpRatio = eStats.hp / eStats.maxHp;
            enemy.healthBar.scale.x = hpRatio;
            enemy.healthBar.material.color.set(hpRatio < 0.3 ? 0xff0000 : 0x00ff00);
        }
    }

    function updateItems(state) {
        for (let i = state.items.length - 1; i >= 0; i--) {
            const item = state.items[i];
            if(item.collected) continue;
            item.mesh.rotation.y += 0.02;
            if(state.player.body.position.distanceTo(item.mesh.position) < 1.5) {
                item.collected = true;
                if (item.type === 'gold') state.player.stats.gold += 10;
                else if (item.type === 'potion') state.player.stats.hp = Math.min(state.player.stats.maxHp, state.player.stats.hp + 25);
                state.scene.remove(item.mesh);
                if(item.body) state.world.removeBody(item.body);
                state.items.splice(i, 1);
            }
        }
    }
    
    function handleEndGame(state) {
        if(state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        document.exitPointerLock();
        const pStats = state.player.stats;
        const msg = `YOU DIED
Level: ${pStats.level}
Gold: ${pStats.gold}

[ENTER] or [R] to restart`;
        showOverlay(state, msg, true);
    }
    
    // --- CONTROLS & UI ---
    function onKey(e, isDown) { 
        if(e.code) state.keys[e.code] = isDown;
        if(e.key) state.keys[e.key] = isDown;
    }
    function onPointerLockChange(state) { state.crosshairMesh.visible = (document.pointerLockElement === state.renderer.domElement); }
    function onMouseMove(e, state) {
        if (document.pointerLockElement !== state.renderer.domElement) return;
        state.player.mesh.rotation.y -= e.movementX * 0.002;
        state.camera.rotation.x = THREE.MathUtils.clamp(state.camera.rotation.x - e.movementY * 0.002, -Math.PI/2, Math.PI/2);
    }
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    function createHealthBar() {
        const bar = new THREE.Sprite(new THREE.SpriteMaterial({color:0x00ff00}));
        bar.scale.set(1.2, 0.15, 1);
        bar.position.y = 1.5;
        return bar;
    }
    function addCrosshair(state) {
        const map = new THREE.TextureLoader().load('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="rgba(255,255,255,0.8)" d="M15 0h2v15h-2z M0 15h15v2h-15z M17 15h15v2h-15z M15 17h2v15h-2z"/></svg>');
        state.crosshairMesh = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.8 }));
        state.crosshairMesh.scale.set(0.05, 0.05, 1);
        state.crosshairMesh.position.set(0, 0, -1);
        state.crosshairMesh.visible = false;
        state.camera.add(state.crosshairMesh);
    }
    function updateHUD(state) {
        if(state.hudMesh) state.camera.remove(state.hudMesh);
        const { hp, maxHp, level, exp, expToNext, gold } = state.player.stats;
        const text = `HP: ${Math.ceil(hp)}/${maxHp}\nLvl: ${level} | Gold: ${gold}\nEXP: ${exp}/${expToNext}`;
        state.hudMesh = createTextLabelMesh(text, { font: "22px Courier New", width: 400, height: 100, align: "left" });
        state.hudMesh.position.set(-state.camera.aspect * 2.8, 1.6, -4);
        state.camera.add(state.hudMesh);
    }
    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, { font:"32px Courier New", width:600, height:250, ...(bg && {bg:'rgba(0,0,0,0.8)'}) }); state.overlayMesh.position.set(0,0,-3); state.camera.add(state.overlayMesh); } 
    function clearOverlay(state) { if (state.overlayMesh) { state.camera.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial", w = opts.width || 512, h = opts.height || 128;
        canvas.width = w; canvas.height = h; ctx.font = font;
        if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
        ctx.fillStyle = opts.color || "#fff"; ctx.textAlign = opts.align || "center"; ctx.textBaseline = "middle";
        const lines = text.split("\n"), lH = h/lines.length, x = opts.align==='left' ? 20:w/2;
        for (let i=0; i<lines.length; i++) ctx.fillText(lines[i], x, lH * (i + 0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/200, h/200), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
        mesh.renderOrder = 10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        const canvas = state.renderer?.domElement;
        if(canvas) canvas.removeEventListener('click', state.boundCanvasClick);
        document.removeEventListener('pointerlockchange', state.boundPointerLockChange);
        document.removeEventListener('mousemove', state.boundMouseMove);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) { if(state.hudMesh) state.camera.remove(state.hudMesh); if(state.crosshairMesh) state.camera.remove(state.crosshairMesh); if(state.overlayMesh) state.camera.remove(state.overlayMesh); }
        if (state.renderer) { if(canvas?.parentNode) canvas.parentNode.removeChild(canvas); state.renderer.dispose(); }
        if(state.world) while(state.world.bodies.length > 0) state.world.removeBody(state.world.bodies[0]);
        if (state.scene) state.scene.traverse(obj => { if (obj.isMesh || obj.isSprite) disposeMesh(obj); });
        state = null;
    };

    init();
})();