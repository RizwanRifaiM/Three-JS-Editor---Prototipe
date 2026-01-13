(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        PLAYER_SPEED: 0.15, PLAYER_MAX_HP: 100, ATTACK_COOLDOWN: 400, ATTACK_RANGE: 1.8, ATTACK_DAMAGE: 10,
        ENEMY_SPEED: 0.03, ENEMY_MAX_COUNT: 8,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.player = null; this.attackIndicator = null;
        this.enemies = []; this.items = [];
        this.keys = {};
        this.isGameOver = false;

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x3a5a3a);

        const aspect = window.innerWidth/window.innerHeight;
        state.camera = new THREE.OrthographicCamera(-10*aspect, 10*aspect, 10, -10, 0.1, 100);
        state.camera.position.z = 10;
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.9), new THREE.DirectionalLight(0xffffff, 0.4));
        
        state.player = createCharacter(state, 0x00ff00, {
            level: 1, hp: GAME_CONST.PLAYER_MAX_HP, maxHp: GAME_CONST.PLAYER_MAX_HP,
            gold: 0, exp: 0, expToNextLevel: 50, lastAttack: 0, isPlayer: true
        });
        
        state.attackIndicator = new THREE.Mesh(new THREE.RingGeometry(GAME_CONST.ATTACK_RANGE-0.1, GAME_CONST.ATTACK_RANGE, 32), new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide, transparent:true}));
        state.attackIndicator.visible = false;
        state.scene.add(state.attackIndicator);

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
        state.isGameOver = false;
        const pData = state.player.userData;
        pData.hp = pData.maxHp; pData.level = 1; pData.gold = 0; pData.exp = 0; pData.expToNextLevel = 50;
        state.player.position.set(0, 0, 0);

        state.enemies.forEach(e => state.scene.remove(e));
        state.items.forEach(i => state.scene.remove(i));
        state.enemies = []; state.items = [];
        
        for (let i = 0; i < GAME_CONST.ENEMY_MAX_COUNT; i++) spawnEnemy(state);
        for (let i = 0; i < 3; i++) spawnItem(state, 'gold');

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
            updateEntities(state);
            updateCamera(state);
            updateHUD(state);
        }
        state.renderer.render(state.scene, state.camera);
    }

    function createCharacter(state, color, data) {
        const char = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshStandardMaterial({ color }));
        char.userData = data;
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.15), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        bar.position.y = 0.8;
        char.add(bar);
        char.userData.healthBar = bar;
        state.scene.add(char);
        return char;
    }

    function spawnEnemy(state) {
        const level = state.player.userData.level;
        const enemy = createCharacter(state, 0xff0000, {
            hp: 20 + level*5, maxHp: 20 + level*5, damage: 5 + level*2, exp: 10 + level*2, gold: 3 + level
        });
        enemy.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, 0);
        state.enemies.push(enemy);
    }

    function spawnItem(state, type) {
        const geo = type==='gold' ? new THREE.TorusGeometry(0.2, 0.1, 8, 16) : new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: type === 'gold' ? 0xffd700 : 0xee82ee });
        const item = new THREE.Mesh(geo, mat);
        item.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, 0);
        item.userData.type = type;
        state.items.push(item);
        state.scene.add(item);
    }

    function updatePlayer(state) {
        let moveX = 0, moveY = 0;
        if (state.keys['KeyW'] || state.keys['ArrowUp']) moveY = 1;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) moveY = -1;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) moveX = -1;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) moveX = 1;
        
        if (moveX !== 0 || moveY !== 0) {
            const moveVec = new THREE.Vector2(moveX, moveY).normalize().multiplyScalar(GAME_CONST.PLAYER_SPEED);
            state.player.position.x += moveVec.x;
            state.player.position.y += moveVec.y;
        }
        
        if (state.keys['Space'] && state.clock.getElapsedTime() > state.player.userData.lastAttack + (GAME_CONST.ATTACK_COOLDOWN/1000)) {
            state.player.userData.lastAttack = state.clock.getElapsedTime();
            state.attackIndicator.position.copy(state.player.position);
            state.attackIndicator.scale.set(0.1,0.1,0.1);
            state.attackIndicator.material.opacity = 1.0;
            state.attackIndicator.visible = true;
            
            state.enemies.forEach(enemy => {
                if (state.player.position.distanceTo(enemy.position) < GAME_CONST.ATTACK_RANGE) {
                    enemy.userData.hp -= GAME_CONST.ATTACK_DAMAGE;
                }
            });
        }
    }

    function updateEntities(state) {
        if(state.attackIndicator.visible) {
            state.attackIndicator.scale.lerp(new THREE.Vector3(1,1,1), 0.3);
            state.attackIndicator.material.opacity = 1 - state.attackIndicator.scale.x;
            if(state.attackIndicator.scale.x > 0.95) state.attackIndicator.visible = false;
        }
        
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const enemy = state.enemies[i];
            if (enemy.userData.hp <= 0) {
                const pData = state.player.userData;
                pData.exp += enemy.userData.exp; pData.gold += enemy.userData.gold;
                if (pData.exp >= pData.expToNextLevel) {
                    pData.level++; pData.exp = 0; pData.expToNextLevel *= 1.5; pData.hp = pData.maxHp;
                }
                if(Math.random() < 0.2) spawnItem(state, 'potion');
                state.scene.remove(enemy); state.enemies.splice(i, 1);
                spawnEnemy(state); continue;
            }
            
            const dir = state.player.position.clone().sub(enemy.position);
            if (dir.length() < 12) enemy.position.add(dir.normalize().multiplyScalar(GAME_CONST.ENEMY_SPEED));
            if (state.player.position.distanceTo(enemy.position) < 1.0) {
                state.player.userData.hp -= 0.2;
                if (state.player.userData.hp <= 0) handleEndGame(state);
            }
        }
        
        for (let i = state.items.length - 1; i >= 0; i--) {
            const item = state.items[i];
            item.rotation.z += 0.05;
            if (state.player.position.distanceTo(item.position) < 1.0) {
                if (item.userData.type === 'gold') state.player.userData.gold += 10;
                if (item.userData.type === 'potion') state.player.userData.hp = Math.min(state.player.userData.maxHp, state.player.userData.hp + 25);
                state.scene.remove(item); state.items.splice(i, 1);
            }
        }

        [state.player, ...state.enemies].forEach(char => {
            const hpRatio = char.userData.hp / char.userData.maxHp;
            char.userData.healthBar.scale.x = Math.max(0, hpRatio);
            char.userData.healthBar.material.color.set(hpRatio < 0.3 ? 0xff0000 : 0x00ff00);
        });
    }

    function handleEndGame(state) {
        if(state.isGameOver) return;
        state.isGameOver = true;
        const pData = state.player.userData;
        const msg = `YOU DIED
Level: ${pData.level}
Gold: ${pData.gold}

[ENTER] to restart`;
        showOverlay(state, msg, true);
    }
    
    function updateCamera(state) {
        state.camera.position.x += (state.player.position.x - state.camera.position.x) * 0.1;
        state.camera.position.y += (state.player.position.y - state.camera.position.y) * 0.1;
    }
    
    function onResize(state) {
        const aspect = window.innerWidth / window.innerHeight;
        state.camera.left = -10 * aspect; state.camera.right = 10 * aspect;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.camera.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const pData = state.player.userData;
        const text = `HP: ${Math.ceil(pData.hp)}/${pData.maxHp}\nLvl: ${pData.level}\nGold: ${pData.gold}`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 300, height: 100, align: "left" });
        const aspect = window.innerWidth / window.innerHeight;
        state.hudMesh.position.set(-10*aspect + 2.5, 9, -1);
        state.camera.add(state.hudMesh);
    }
    
    function showOverlay(state, text, hasBg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, { font: "32px Courier New", width: 600, height: 250, ...(hasBg && {bg: 'rgba(0,0,0,0.8)'}) }); state.overlayMesh.position.set(0,0,5); state.scene.add(state.overlayMesh); } function clearOverlay(state) { if (state.overlayMesh) { state.scene.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial", width = opts.width || 512, height = opts.height || 128;
        canvas.width = width; canvas.height = height; ctx.font = font;
        if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, width, height); }
        ctx.fillStyle = opts.color || "#fff"; ctx.textAlign = opts.align || "center"; ctx.textBaseline = "middle";
        const lines = text.split("\n"), lineH = height / lines.length;
        const x = opts.align === 'left' ? 20 : width/2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, lineH * (i + 0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width/30, height/30), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
        mesh.renderOrder = 10;
        return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera && state.hudMesh) state.camera.remove(state.hudMesh);
        if (state.renderer) {
            const canvas = state.renderer.domElement;
            if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
            state.renderer.dispose();
        }
        if (state.scene) state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        state = null;
    };

    init();
})();