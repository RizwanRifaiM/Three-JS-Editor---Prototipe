(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        ACCELERATION: 0.002, BRAKE_FORCE: -0.003, FRICTION: 0.98, MAX_SPEED: 0.4,
        TRACK_LENGTH: 150, LANES: [-3, 0, 3],
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.player = null; this.npcs = [];
        this.keys = {};
        this.gameState = 'waiting'; // waiting, countdown, racing, finished
        this.winner = null;
        this.countdown = 0;

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x446688);

        const aspect = window.innerWidth / window.innerHeight;
        state.camera = new THREE.OrthographicCamera(-10*aspect, 10*aspect, 10, -10, 0.1, 200);
        state.camera.position.set(0, 5, 15);
        state.camera.lookAt(0, 0, 0);

        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.8), new THREE.DirectionalLight(0xffffff, 0.5));
        buildTrack(state.scene);
        
        state.player = createCar(0x00ff00, GAME_CONST.LANES[1]);
        state.npcs.push(createCar(0xff0000, GAME_CONST.LANES[0]));
        state.npcs.push(createCar(0x00ffff, GAME_CONST.LANES[2]));
        state.npcs[0].userData.ai = { baseSpeed: 0.25 + Math.random()*0.05, reaction: 0.1 };
        state.npcs[1].userData.ai = { baseSpeed: 0.28 + Math.random()*0.05, reaction: 0.05 };
        state.scene.add(state.player, ...state.npcs);

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
        state.gameState = 'countdown';
        state.winner = null;
        state.countdown = 3.99;
        
        state.player.position.x = 0; state.player.userData.velocity = 0;
        state.npcs.forEach(npc => { npc.position.x = 0; npc.userData.velocity = 0; });
        
        clearOverlay(state);
        updateHUD(state);
    }
    
    function createCar(color, z) {
        const car = new THREE.Group();
        car.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 1), new THREE.MeshStandardMaterial({ color })));
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        top.position.y = 0.5; car.add(top);
        car.position.z = z; car.userData = { velocity: 0 };
        return car;
    }

    function buildTrack(scene) {
        const ground = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.TRACK_LENGTH + 40, 1, 12), new THREE.MeshStandardMaterial({ color: 0x555555 }));
        ground.position.set(GAME_CONST.TRACK_LENGTH / 2, -0.5, 0);
        scene.add(ground);
        
        const finishLine = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 10), new THREE.MeshStandardMaterial({color: 0xffffff}));
        finishLine.position.set(GAME_CONST.TRACK_LENGTH, 0.51, 0);
        scene.add(finishLine);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        const deltaTime = state.clock.getDelta();
        
        switch(state.gameState) {
            case 'countdown':
                state.countdown -= deltaTime;
                showOverlay(state, `${Math.ceil(state.countdown)}`, false);
                if (state.countdown <= 0.99) {
                    showOverlay(state, 'GO!', true, 800);
                    state.gameState = 'racing';
                }
                break;
            case 'racing':
                updatePlayer(state);
                updateNPCs(state);
                checkWinCondition(state);
                updateHUD(state);
                break;
            case 'finished':
                if (state.keys['Enter']) resetGame(state);
                break;
        }
        updateCamera(state);
        state.renderer.render(state.scene, state.camera);
    }

    function updatePlayer(state) {
        if (state.keys['KeyW'] || state.keys['ArrowUp']) state.player.userData.velocity += GAME_CONST.ACCELERATION;
        else if (state.keys['KeyS'] || state.keys['ArrowDown']) state.player.userData.velocity += GAME_CONST.BRAKE_FORCE;
        
        state.player.userData.velocity *= GAME_CONST.FRICTION;
        state.player.userData.velocity = THREE.MathUtils.clamp(state.player.userData.velocity, 0, GAME_CONST.MAX_SPEED);
        state.player.position.x += state.player.userData.velocity;
    }

    function updateNPCs(state) {
        state.npcs.forEach(npc => {
            if (npc.userData.velocity < npc.userData.ai.baseSpeed) npc.userData.velocity += GAME_CONST.ACCELERATION * (0.8 + Math.random() * 0.4);
            if(Math.random() < npc.userData.ai.reaction) npc.userData.velocity *= (0.95 + Math.random() * 0.1);
            npc.userData.velocity = THREE.MathUtils.clamp(npc.userData.velocity, 0, GAME_CONST.MAX_SPEED * 0.95) * GAME_CONST.FRICTION;
            npc.position.x += npc.userData.velocity;
        });
    }

    function checkWinCondition(state) {
        if (state.winner) return;
        if (state.player.position.x >= GAME_CONST.TRACK_LENGTH) state.winner = 'You';
        if (state.npcs[0].position.x >= GAME_CONST.TRACK_LENGTH) state.winner = 'Red Car';
        if (state.npcs[1].position.x >= GAME_CONST.TRACK_LENGTH) state.winner = 'Blue Car';
        if (state.winner) handleEndGame(state);
    }

    function handleEndGame(state) {
        state.gameState = 'finished';
        showOverlay(state, `${state.winner} Wins!\n\n[ENTER] to restart`, true);
    }

    function updateCamera(state) {
        state.camera.position.x += (state.player.position.x - state.camera.position.x) * 0.1;
    }
    
    function onResize(state) {
        const aspect = window.innerWidth / window.innerHeight;
        state.camera.left = -10 * aspect; state.camera.right = 10 * aspect;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.camera.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const speedKmh = (state.player.userData.velocity / GAME_CONST.MAX_SPEED * 200).toFixed(0);
        const text = `Speed: ${speedKmh} km/h`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 400, height: 50, align: "left" });
        
        const aspect = window.innerWidth / window.innerHeight;
        state.hudMesh.position.set(-10 * aspect + 2, 9, -1);
        state.camera.add(state.hudMesh);
    }

    function showOverlay(state, text, hasBg = true, autoClear = 0) {
        clearOverlay(state);
        const opts = { font: "80px Impact", width: 800, height: 200 };
        if(hasBg) opts.bg = 'rgba(0,0,0,0.7)';
        state.overlayMesh = createTextLabelMesh(text, opts);
        state.overlayMesh.position.set(0, 2, -1);
        state.camera.add(state.overlayMesh);
        if(autoClear > 0) setTimeout(() => clearOverlay(state), autoClear);
    }

    function clearOverlay(state) {
        if (state.overlayMesh) {
            state.camera.remove(state.overlayMesh);
            disposeMesh(state.overlayMesh);
            state.overlayMesh = null;
        }
    }

    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
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
            new THREE.PlaneGeometry(width/50, height/50),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
        );
        mesh.renderOrder = 10;
        return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) {
            if(state.hudMesh) state.camera.remove(state.hudMesh);
            if(state.overlayMesh) state.camera.remove(state.overlayMesh);
        }
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
