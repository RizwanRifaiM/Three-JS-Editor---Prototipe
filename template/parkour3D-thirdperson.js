(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRAVITY: -25,
        PLAYER_SPEED: 5,
        JUMP_FORCE: 9,
        PLAYER_RADIUS: 0.5,
        FALL_LIMIT: -20,
        CAM_OFFSET: new THREE.Vector3(0, 4, 10),
    };

    const LEVEL_DATA = [
        { p: [0, -0.5, 0], s: [4, 1, 4] }, { p: [6, 1, 0], s: [2, 1, 2] },
        { p: [10, 2, -2], s: [2, 1, 2] }, { p: [13, 4, 3], s: [2, 1, 2] },
        { p: [10, 5.5, 8], s: [2, 1, 2] }, { p: [4, 6.5, 12], s: [3, 1, 2] },
        { p: [0, 8, 12], s: [2, 1, 2], isFinish: true },
    ];
    
    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.clock = new THREE.Clock();
        
        this.playerMesh = null;
        this.playerBody = null;
        this.platforms = [];
        this.keys = {};
        this.gameState = 'playing';

        this.hudMesh = null;
        this.overlayMesh = null;

        this.boundKeydown = null;
        this.boundKeyup = null;
        this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Three.js Setup
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x87CEEB);
        state.scene.fog = new THREE.Fog(0x87CEEB, 10, 60);
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        // Cannon.js Setup
        state.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GAME_CONST.GRAVITY, 0) });
        state.world.broadphase = new CANNON.NaiveBroadphase();
        const playerShape = new CANNON.Sphere(GAME_CONST.PLAYER_RADIUS);
        state.playerBody = new CANNON.Body({ mass: 5, shape: playerShape, linearDamping: 0.9 });
        state.world.addBody(state.playerBody);
        
        // Player Mesh
        state.playerMesh = new THREE.Mesh(
            new THREE.BoxGeometry(GAME_CONST.PLAYER_RADIUS * 1.5, 2, GAME_CONST.PLAYER_RADIUS * 1.5),
            new THREE.MeshStandardMaterial({color: 0x00ff00})
        );
        state.playerMesh.castShadow = true;
        state.scene.add(state.playerMesh);

        // Lights & Level
        addLights(state.scene);
        buildLevel(state);

        // Event Listeners
        state.boundKeydown = e => onKeyDown(e, state);
        state.boundKeyup = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing';
        state.clock.start();
        clearOverlay(state);
        
        state.playerBody.position.set(0, 5, 0);
        state.playerBody.velocity.set(0, 0, 0);
        state.playerMesh.position.copy(state.playerBody.position);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;
        
        const deltaTime = Math.min(state.clock.getDelta(), 0.1);

        if (state.gameState === 'playing') {
            state.world.step(1/60, deltaTime);
            
            updatePlayer(state);
            updateCamera(state);
            checkGameState(state);
            
            state.playerMesh.position.copy(state.playerBody.position);
            updateHUD(state);
        } else {
            if(state.keys['KeyR'] || state.keys['Enter']) resetGame(state);
        }
        
        state.renderer.render(state.scene, state.camera);
    }

    function addLights(scene) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 30, 15);
        dirLight.castShadow = true;
        scene.add(dirLight);
    }
    
    function buildLevel(state) {
        const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
        state.world.addBody(groundBody);
        
        const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(100,100), new THREE.MeshStandardMaterial({color: 0x4a5d23}));
        groundMesh.rotation.x = -Math.PI/2;
        groundMesh.receiveShadow = true;
        state.scene.add(groundMesh);

        LEVEL_DATA.forEach(data => {
            const [px, py, pz] = data.p; const [sx, sy, sz] = data.s;
            const mat = new THREE.MeshStandardMaterial({ color: data.isFinish ? 0xffd700 : 0x8b4513 });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
            mesh.position.set(px, py, pz);
            mesh.castShadow = mesh.receiveShadow = true;
            state.scene.add(mesh);
            
            const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(sx/2, sy/2, sz/2)) });
            body.position.set(px, py, pz);
            state.world.addBody(body);
            state.platforms.push({ mesh, body, isFinish: !!data.isFinish });
        });
    }

    function updatePlayer(state) {
        const moveDirection = new THREE.Vector3();
        if (state.keys['KeyW']) moveDirection.z = -1;
        if (state.keys['KeyS']) moveDirection.z = 1;
        if (state.keys['KeyA']) moveDirection.x = -1;
        if (state.keys['KeyD']) moveDirection.x = 1;

        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
            const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
            state.playerMesh.rotation.y += (targetRotation - state.playerMesh.rotation.y) * 0.2;
            
            const moveVelocity = moveDirection.multiplyScalar(GAME_CONST.PLAYER_SPEED);
            state.playerBody.velocity.x = moveVelocity.x;
            state.playerBody.velocity.z = moveVelocity.z;
        }
    }
    
    function onKeyDown(e, state) {
        state.keys[e.code] = true;
        if (e.code === 'Space' && state.gameState === 'playing' && isPlayerOnGround(state)) {
            state.playerBody.velocity.y = GAME_CONST.JUMP_FORCE;
        }
    }

    function isPlayerOnGround(state) {
        const from = state.playerBody.position;
        const to = new CANNON.Vec3(from.x, from.y - GAME_CONST.PLAYER_RADIUS - 0.1, from.z);
        return state.world.raycastClosest(from, to, {}, new CANNON.RaycastResult());
    }

    function updateCamera(state) {
        const targetPos = state.playerBody.position.clone().add(GAME_CONST.CAM_OFFSET);
        state.camera.position.lerp(targetPos, 0.1);
        state.camera.lookAt(state.playerBody.position);
    }
    
    function checkGameState(state) {
        if (state.playerBody.position.y < GAME_CONST.FALL_LIMIT) handleEndGame(state, false);
        for (const p of state.platforms) {
            if (p.isFinish && state.playerBody.position.distanceTo(p.body.position) < 2.5) {
                handleEndGame(state, true);
            }
        }
    }

    function handleEndGame(state, isWin) {
        if (state.gameState !== 'playing') return;
        state.gameState = isWin ? 'won' : 'lost';
        const msg1 = isWin ? "YOU WIN!" : "YOU FELL";
        const msg = `${msg1}\nTime: ${state.clock.elapsedTime.toFixed(1)}s\n\n[R] or [ENTER] to restart`;
        
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "32px Courier New", align: "center", width: 600, height: 250, bg: "rgba(0,0,0,0.8)"
        });
        state.overlayMesh.position.copy(state.camera.position).add(new THREE.Vector3(0,0,-5));
        state.overlayMesh.quaternion.copy(state.camera.quaternion);
        state.scene.add(state.overlayMesh);
    }
    
    function clearOverlay(state) {
        if (state.overlayMesh) {
            state.scene.remove(state.overlayMesh);
            disposeMesh(state.overlayMesh);
            state.overlayMesh = null;
        }
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) state.camera.remove(state.hudMesh);
        const text = `Time: ${state.clock.elapsedTime.toFixed(1)}s`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 300, height: 50 });
        state.hudMesh.position.set(0, 1.8, -4);
        state.camera.add(state.hudMesh);
    }

    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial", width = opts.width || 512, height = opts.height || 128;
        canvas.width = width; canvas.height = height;
        ctx.font = font;
        if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, width, height); }
        ctx.fillStyle = opts.color || "#fff";
        ctx.textAlign = opts.align || "center";
        ctx.textBaseline = "middle";
        const lines = text.split("\n"), lineH = height / lines.length;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], width / 2, lineH * (i + 0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width/200, height/200),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
        );
        mesh.renderOrder = 10;
        return mesh;
    }

    // =============== EXPORT DESTROY HANDLER ===============
    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);

        window.removeEventListener('keydown', state.boundKeydown);
        window.removeEventListener('keyup', state.boundKeyup);
        window.removeEventListener('resize', state.boundResize);

        if (state.camera && state.hudMesh) state.camera.remove(state.hudMesh);

        if (state.renderer) {
            const canvas = state.renderer.domElement;
            if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
            state.renderer.dispose();
            try { state.renderer.forceContextLoss(); } catch(e){}
        }

        if(state.world) while(state.world.bodies.length > 0) state.world.removeBody(state.world.bodies[0]);
        if (state.scene) state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        
        state = null;
    };

    init();
})();
