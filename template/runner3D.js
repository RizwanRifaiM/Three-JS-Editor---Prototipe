(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRAVITY: -0.04, JUMP_FORCE: 1.0, PLAYER_HORIZONTAL_SPEED: 0.18, TRACK_WIDTH: 8,
        INITIAL_GAME_SPEED: 0.15, SPEED_ACCEL: 0.0001, OBSTACLE_SPAWN_RATE: 0.015,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.player = null;
        this.obstacles = [];
        this.keys = {};
        this.score = 0; this.gameSpeed = 0;
        this.gameState = 'playing'; // playing, game_over

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x87CEEB);
        state.scene.fog = new THREE.Fog(0x87CEEB, 15, 50);

        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        state.camera.position.set(-5, 5, 10);
        state.camera.lookAt(5, 0, 0);
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);

        addLights(state.scene);
        
        state.player = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
        state.player.castShadow = true;
        state.player.userData = { velocity: new THREE.Vector3(), isOnGround: true };
        state.scene.add(state.player);
        
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, GAME_CONST.TRACK_WIDTH + 2), new THREE.MeshStandardMaterial({ color: 0x4a5d23 }));
        ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
        state.scene.add(ground);

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
        state.gameState = 'playing';
        state.score = 0;
        state.gameSpeed = GAME_CONST.INITIAL_GAME_SPEED;
        
        state.player.position.set(0, 0.9, 0);
        state.player.userData.velocity.set(0,0,0);
        state.player.userData.isOnGround = true;
        
        state.obstacles.forEach(obj => state.scene.remove(obj));
        state.obstacles = [];
        
        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        if (state.gameState === 'playing') {
            updatePlayer(state);
            spawnObstacle(state);
            updateWorld(state);
            handleCollisions(state);
            updateHUD(state);
        } else if (state.keys['KeyR'] || state.keys['Enter']) {
            resetGame(state);
        }
        
        state.renderer.render(state.scene, state.camera);
    }

    function addLights(scene) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 0);
        dirLight.castShadow = true;
        scene.add(dirLight);
    }

    function spawnObstacle(state) {
        if (Math.random() > GAME_CONST.OBSTACLE_SPAWN_RATE || state.obstacles.length > 10) return;
        const height = 1 + Math.random();
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(1, height, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        obstacle.position.set(20, height / 2, (Math.random() - 0.5) * GAME_CONST.TRACK_WIDTH);
        obstacle.castShadow = true;
        state.obstacles.push(obstacle);
        state.scene.add(obstacle);
    }

    function updatePlayer(state) {
        let targetZ = state.player.position.z;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) targetZ -= GAME_CONST.PLAYER_HORIZONTAL_SPEED;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) targetZ += GAME_CONST.PLAYER_HORIZONTAL_SPEED;
        state.player.position.z = THREE.MathUtils.clamp(targetZ, -GAME_CONST.TRACK_WIDTH / 2, GAME_CONST.TRACK_WIDTH / 2);
        
        state.player.userData.velocity.y += GAME_CONST.GRAVITY;
        state.player.position.y += state.player.userData.velocity.y;

        if (state.player.position.y <= 0.9) {
            state.player.position.y = 0.9;
            state.player.userData.velocity.y = 0;
            state.player.userData.isOnGround = true;
        }

        if ((state.keys['KeyW'] || state.keys['Space'] || state.keys['ArrowUp']) && state.player.userData.isOnGround) {
            state.player.userData.velocity.y = GAME_CONST.JUMP_FORCE * 0.18;
            state.player.userData.isOnGround = false;
        }
    }

    function updateWorld(state) {
        state.gameSpeed += GAME_CONST.SPEED_ACCEL;
        state.score += Math.round(state.gameSpeed * 5);
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
            const obstacle = state.obstacles[i];
            obstacle.position.x -= state.gameSpeed;
            if (obstacle.position.x < -20) {
                state.scene.remove(state.obstacles.splice(i, 1)[0]);
            }
        }
    }

    function handleCollisions(state) {
        const playerBox = new THREE.Box3().setFromObject(state.player);
        for (const obstacle of state.obstacles) {
            if (playerBox.intersectsBox(new THREE.Box3().setFromObject(obstacle))) {
                handleEndGame(state);
                return;
            }
        }
    }

    function handleEndGame(state) {
        if(state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        showOverlay(state, `GAME OVER\nScore: ${state.score}\n\n[ENTER] to restart`, true);
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) state.camera.remove(state.hudMesh);
        state.hudMesh = createTextLabelMesh(`Score: ${state.score}`, { font: "24px Courier New", width: 400, height: 50, align: "left" });
        state.hudMesh.position.set(-state.camera.aspect * 2.5, 2.3, -4);
        state.camera.add(state.hudMesh);
    }
    
    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, { font:"32px Courier New", align:"center", width:500, height:250, ...(bg&&{bg:'rgba(0,0,0,0.7)'})}); state.overlayMesh.position.set(2,2,-5); state.overlayMesh.quaternion.copy(state.camera.quaternion); state.camera.add(state.overlayMesh); } function clearOverlay(state) { if(state.overlayMesh) { state.camera.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } } function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); } function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial", w = opts.width || 512, h = opts.height || 128;
        canvas.width = w; canvas.height = h; ctx.font = font;
        if(opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0,0,w,h); }
        ctx.fillStyle = opts.color || "#fff"; ctx.textAlign = opts.align || "center"; ctx.textBaseline = "middle";
        const lines = text.split("\n"), lH = h/lines.length, x = opts.align === 'left'?20:w/2;
        for(let i=0; i<lines.length; i++) ctx.fillText(lines[i], x, lH * (i + 0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/100,h/100), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
        mesh.renderOrder=10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) { if(state.hudMesh) state.camera.remove(state.hudMesh); if(state.overlayMesh) state.camera.remove(state.overlayMesh); }
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();