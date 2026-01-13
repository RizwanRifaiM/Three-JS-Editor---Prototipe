(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRAVITY: -25,
        PLAYER_SPEED: 5,
        JUMP_FORCE: 9,
        PLAYER_RADIUS: 0.5,
        PLAYER_HEIGHT: 1.8,
        FALL_LIMIT: -20,
    };

    const LEVEL_DATA = [
        { p: [0, -0.5, 0], s: [4, 1, 4] }, { p: [6, 1, 0], s: [2, 1, 2] },
        { p: [10, 2, 0], s: [2, 1, 2] }, { p: [13, 4, 3], s: [2, 1, 2] },
        { p: [10, 5, 8], s: [3, 1, 2] }, { p: [4, 6, 8], s: [3, 1, 2] },
        { p: [0, 7.5, 8], s: [2, 1, 2], isFinish: true },
    ];
    
    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.clock = new THREE.Clock();
        
        this.player = new THREE.Group();
        this.playerBody = null;
        this.platforms = [];
        this.keys = {};
        this.gameState = 'playing';

        this.hudMesh = null;
        this.crosshairMesh = null;
        this.overlayMesh = null;

        this.boundKeydown = null;
        this.boundKeyup = null;
        this.boundResize = null;
        this.boundPointerLockChange = null;
        this.boundMouseMove = null;
        this.boundCanvasClick = null;
    }

    function init() {
        state = new GameState();

        // Three.js Setup
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x87CEEB);
        state.scene.fog = new THREE.Fog(0x87CEEB, 10, 60);
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        state.player.add(state.camera);
        state.scene.add(state.player);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        // Cannon.js Setup
        state.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GAME_CONST.GRAVITY, 0) });
        state.world.broadphase = new CANNON.NaiveBroadphase();
        const playerShape = new CANNON.Sphere(GAME_CONST.PLAYER_RADIUS);
        state.playerBody = new CANNON.Body({ mass: 5, shape: playerShape, linearDamping: 0.8 });
        state.world.addBody(state.playerBody);
        
        // Lighting & UI
        addLights(state.scene);
        addCrosshair(state);

        // Event Listeners
        const canvas = state.renderer.domElement;
        state.boundCanvasClick = () => canvas.requestPointerLock();
        state.boundPointerLockChange = () => onPointerLockChange(state);
        state.boundMouseMove = e => onMouseMove(e, state);
        state.boundKeydown = e => onKeyDown(e, state);
        state.boundKeyup = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);
        
        canvas.addEventListener('click', state.boundCanvasClick);
        document.addEventListener('pointerlockchange', state.boundPointerLockChange);
        document.addEventListener('mousemove', state.boundMouseMove);
        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);

        buildLevel(state);
        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing';
        state.clock.start();
        clearOverlay(state);
        
        state.playerBody.position.set(0, 5, 0);
        state.playerBody.velocity.set(0, 0, 0);
        state.player.position.copy(state.playerBody.position);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;
        
        const deltaTime = Math.min(state.clock.getDelta(), 0.1);

        if (state.gameState === 'playing') {
            state.world.step(1/60, deltaTime);
            
            updatePlayer(state);
            checkGameState(state);
            
            state.player.position.copy(state.playerBody.position);
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
        dirLight.shadow.camera.zoom = 0.2;
        scene.add(dirLight);
    }
    
    function buildLevel(state) {
        // Ground
        const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        state.world.addBody(groundBody);

        LEVEL_DATA.forEach(data => {
            const [px, py, pz] = data.p;
            const [sx, sy, sz] = data.s;
            
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(sx, sy, sz), 
                new THREE.MeshStandardMaterial({ color: data.isFinish ? 0xffd700 : 0x8b4513 })
            );
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
        const forward = new THREE.Vector3();
        state.player.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(state.player.up, forward).normalize();
        
        const moveVel = new THREE.Vector3();
        if (state.keys['KeyW']) moveVel.add(forward);
        if (state.keys['KeyS']) moveVel.sub(forward);
        if (state.keys['KeyA']) moveVel.sub(right);
        if (state.keys['KeyD']) moveVel.add(right);
        
        if(moveVel.lengthSq() > 0) {
            moveVel.normalize().multiplyScalar(GAME_CONST.PLAYER_SPEED);
            state.playerBody.velocity.x = moveVel.x;
            state.playerBody.velocity.z = moveVel.z;
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
        const result = new CANNON.RaycastResult();
        state.world.raycastClosest(from, to, {}, result);
        return result.hasHit;
    }

    function checkGameState(state) {
        if (state.playerBody.position.y < GAME_CONST.FALL_LIMIT) {
            handleEndGame(state, false);
        }
        for (const p of state.platforms) {
            if (p.isFinish && state.playerBody.position.distanceTo(p.body.position) < 2.5) {
                handleEndGame(state, true);
            }
        }
    }

    function handleEndGame(state, isWin) {
        if (state.gameState !== 'playing') return;
        state.gameState = isWin ? 'won' : 'lost';
        document.exitPointerLock();
        
        const msg1 = isWin ? "YOU WIN!" : "YOU FELL";
        const msg = `${msg1}\nTime: ${state.clock.elapsedTime.toFixed(1)}s\n\n[R] or [ENTER] to restart`;
        
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "32px Courier New", align: "center", width: 600, height: 250, bg: "rgba(0,0,0,0.8)"
        });
        state.overlayMesh.position.copy(state.camera.position);
        state.overlayMesh.position.z -= 5;
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

    function onPointerLockChange(state) { state.crosshairMesh.visible = (document.pointerLockElement === state.renderer.domElement); }
    function onMouseMove(e, state) {
        if (document.pointerLockElement !== state.renderer.domElement) return;
        state.player.rotation.y -= e.movementX * 0.002;
        state.camera.rotation.x -= e.movementY * 0.002;
        state.camera.rotation.x = THREE.MathUtils.clamp(state.camera.rotation.x, -Math.PI / 2, Math.PI / 2);
    }
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function addCrosshair(state) {
        const map = new THREE.TextureLoader().load('data:image/svg+xml,' + '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="rgba(255,255,255,0.8)" d="M15 0h2v15h-2z M0 15h15v2h-15z M17 15h15v2h-15z M15 17h2v15h-2z"/></svg>');
        state.crosshairMesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: map, transparent: true, opacity: 0.8 }));
        state.crosshairMesh.scale.set(0.05, 0.05, 1);
        state.crosshairMesh.position.set(0, 0, -1);
        state.crosshairMesh.visible = false;
        state.camera.add(state.crosshairMesh);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) state.camera.remove(state.hudMesh);
        const text = `Time: ${state.clock.elapsedTime.toFixed(1)}s`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 300, height: 50 });
        state.hudMesh.position.set(0, 0.9, -2);
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
            new THREE.PlaneGeometry(width/250, height/250),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
        );
        mesh.renderOrder = 10;
        return mesh;
    }

    // =============== EXPORT DESTROY HANDLER ===============
    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);

        const canvas = state.renderer?.domElement;
        if(canvas) canvas.removeEventListener('click', state.boundCanvasClick);
        document.removeEventListener('pointerlockchange', state.boundPointerLockChange);
        document.removeEventListener('mousemove', state.boundMouseMove);
        window.removeEventListener('keydown', state.boundKeydown);
        window.removeEventListener('keyup', state.boundKeyup);
        window.removeEventListener('resize', state.boundResize);

        if (state.camera) {
            if(state.hudMesh) state.camera.remove(state.hudMesh);
            if(state.crosshairMesh) state.camera.remove(state.crosshairMesh);
        }

        if (state.renderer) {
            if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
            state.renderer.dispose();
            try { state.renderer.forceContextLoss(); } catch(e){}
        }

        // Cannon.js cleanup
        if(state.world) {
            while(state.world.bodies.length > 0) state.world.removeBody(state.world.bodies[0]);
        }
        
        if (state.scene) state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        
        state = null;
    };

    init();
})();
