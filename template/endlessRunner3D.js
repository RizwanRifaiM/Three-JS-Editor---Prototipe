(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRAVITY: -0.015,
        JUMP_FORCE: 0.35,
        LANE_WIDTH: 3,
        LANES: [-3, 0, 3],
        INITIAL_SPEED: 0.15,
        SPEED_ACCEL: 0.00005,
        SEGMENT_LENGTH: 20,
        VISIBLE_SEGMENTS: 6,
    };

    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        this.player = {
            mesh: null,
            velocity: new THREE.Vector3(),
            targetLane: 1,
            isOnGround: true
        };
        
        this.track = [];
        this.obstacles = [];
        this.keys = {};
        this.score = 0;
        this.gameSpeed = 0;
        this.gameState = 'playing'; // 'playing' | 'game_over'
        
        this.hudMesh = null;
        this.overlayMesh = null;

        this.boundKeydown = null;
        this.boundKeyup = null;
        this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Scene
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x87CEEB);
        state.scene.fog = new THREE.Fog(0x87CEEB, 15, 80);

        // Camera & Renderer
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);

        // Lights
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 0);
        dirLight.castShadow = true;
        state.scene.add(dirLight);

        // Player
        state.player.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.8, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x00dd00, roughness: 0.8 })
        );
        state.player.mesh.castShadow = true;
        state.scene.add(state.player.mesh);

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
        state.score = 0;
        state.gameSpeed = GAME_CONST.INITIAL_SPEED;

        state.player.targetLane = 1;
        state.player.mesh.position.set(GAME_CONST.LANES[1], 0.9, 0);
        state.player.velocity.set(0, 0, 0);
        
        if (state.overlayMesh) clearOverlay(state);

        [...state.track, ...state.obstacles].forEach(obj => state.scene.remove(obj));
        state.track = [];
        state.obstacles = [];

        for (let i = 0; i < GAME_CONST.VISIBLE_SEGMENTS; i++) {
            addTrackSegment(state, i);
        }
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;

        if (state.gameState === 'playing') {
            updatePlayer(state);
            updateWorld(state);
            handleCollisions(state);
            updateCamera(state);
            updateHUD(state);
        } else if (state.keys['KeyR'] || state.keys['Enter']) {
            resetGame(state);
        }
        
        state.renderer.render(state.scene, state.camera);
    }
    
    function onKeyDown(e, state) {
        state.keys[e.code] = true;
        if(state.gameState === 'playing') {
            if ((e.code === 'KeyD' || e.code === 'ArrowRight') && state.player.targetLane > 0) state.player.targetLane--;
            if ((e.code === 'KeyA' || e.code === 'ArrowLeft') && state.player.targetLane < 2) state.player.targetLane++;
            if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && state.player.isOnGround) {
                state.player.velocity.y = GAME_CONST.JUMP_FORCE;
                state.player.isOnGround = false;
            }
        }
    }

    function addTrackSegment(state, index) {
        const segmentZ = index * GAME_CONST.SEGMENT_LENGTH;
        const segment = new THREE.Mesh(
            new THREE.PlaneGeometry(GAME_CONST.LANE_WIDTH * 3 + 4, GAME_CONST.SEGMENT_LENGTH),
            new THREE.MeshStandardMaterial({ color: 0x4a5d23, side: THREE.DoubleSide })
        );
        segment.rotation.x = -Math.PI / 2;
        segment.position.set(0, 0, segmentZ);
        segment.receiveShadow = true;
        segment.userData.index = index;
        state.track.push(segment);
        state.scene.add(segment);
        
        if (index > 1) { // Don't spawn on first few segments
            const spawnCount = Math.floor(Math.random() * 3); // 0, 1, or 2 obstacles
            for (let i = 0; i < spawnCount; i++) {
                 spawnObstacle(state, segmentZ + (Math.random() - 0.5) * GAME_CONST.SEGMENT_LENGTH);
            }
        }
    }

    function spawnObstacle(state, z) {
        const lane = Math.floor(Math.random() * 3);
        const obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(GAME_CONST.LANE_WIDTH * 0.8, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0xcc0000 })
        );
        obstacle.position.set(GAME_CONST.LANES[lane], 0.5, z);
        obstacle.castShadow = true;
        state.obstacles.push(obstacle);
        state.scene.add(obstacle);
    }

    function updatePlayer(state) {
        const p = state.player;
        const targetX = GAME_CONST.LANES[p.targetLane];
        p.mesh.position.x += (targetX - p.mesh.position.x) * 0.1;
        
        p.velocity.y += GAME_CONST.GRAVITY;
        p.mesh.position.y += p.velocity.y;

        if (p.mesh.position.y <= 0.9) {
            p.mesh.position.y = 0.9;
            p.velocity.y = 0;
            p.isOnGround = true;
        }

        p.mesh.position.z += state.gameSpeed;
        state.gameSpeed += GAME_CONST.SPEED_ACCEL;
        state.score = Math.floor(p.mesh.position.z);
    }

    function updateWorld(state) {
        const playerSegmentIndex = Math.floor(state.player.mesh.position.z / GAME_CONST.SEGMENT_LENGTH);

        for (let i = state.track.length - 1; i >= 0; i--) {
            const segment = state.track[i];
            if (segment.userData.index < playerSegmentIndex - 1) {
                state.track.splice(i, 1);
                const newIndex = segment.userData.index + GAME_CONST.VISIBLE_SEGMENTS;
                segment.userData.index = newIndex;
                segment.position.z = newIndex * GAME_CONST.SEGMENT_LENGTH;
                state.track.push(segment);
                
                const spawnCount = Math.floor(Math.random() * 3);
                for (let j = 0; j < spawnCount; j++) {
                     spawnObstacle(state, segment.position.z + (Math.random() - 0.5) * GAME_CONST.SEGMENT_LENGTH);
                }
            }
        }
        
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
            if (state.obstacles[i].position.z < state.player.mesh.position.z - GAME_CONST.SEGMENT_LENGTH) {
                const o = state.obstacles.splice(i, 1)[0];
                state.scene.remove(o);
                disposeMesh(o);
            }
        }
    }

    function handleCollisions(state) {
        const playerBox = new THREE.Box3().setFromObject(state.player.mesh);
        for (const obstacle of state.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            if (playerBox.intersectsBox(obstacleBox)) {
                handleEndGame(state);
                return;
            }
        }
        if (state.player.mesh.position.y < -5) { // Fell off world
            handleEndGame(state);
        }
    }

    function handleEndGame(state) {
        if (state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        const msg = `GAME OVER\nScore: ${state.score}\n\n[ENTER] or [R] to restart`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "32px Courier New", align: "center", width: 600, height: 250, bg: "rgba(30,0,0,0.9)"
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

    function updateCamera(state) {
        const targetPos = new THREE.Vector3(0, state.player.mesh.position.y + 4, state.player.mesh.position.z - 7);
        state.camera.position.lerp(targetPos, 0.1);
        const lookAtTarget = new THREE.Vector3(state.player.mesh.position.x, state.player.mesh.position.y, state.player.mesh.position.z);
        state.camera.lookAt(lookAtTarget);
    }
    
    function updateHUD(state) {
        if (state.hudMesh) {
            state.scene.remove(state.hudMesh);
            disposeMesh(state.hudMesh);
        }
        const text = `Score: ${state.score}`;
        state.hudMesh = createTextLabelMesh(text, { font: "36px Courier New", width: 400, height: 60 });
        
        // Attach HUD to camera
        state.hudMesh.position.set(0, 2.8, -7);
        state.camera.add(state.hudMesh); // Note: adding to camera, not scene
    }
    
    function onResize(state) {
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
    }
    
    // Standard utility functions
    function disposeMesh(mesh) {
        if (!mesh) return;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
        }
    }

    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial";
        ctx.font = font;
        
        const lines = text.split("\n");
        const metrics = lines.map(line => ctx.measureText(line));
        const textWidth = Math.max(...metrics.map(m => m.width));
        const textHeight = metrics.reduce((sum, m) => sum + (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent), 0) * 1.4;

        const width = opts.width || THREE.MathUtils.ceilPowerOfTwo(textWidth);
        const height = opts.height || THREE.MathUtils.ceilPowerOfTwo(textHeight);
        canvas.width = width;
        canvas.height = height;
        
        ctx.font = font;
        if (opts.bg) {
            ctx.fillStyle = opts.bg;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.fillStyle = opts.color || "#fff";
        ctx.textAlign = opts.align || "center";
        ctx.textBaseline = "middle";

        const lineH = height / lines.length;
        for (let i = 0; i < lines.length; i++) {
             ctx.fillText(lines[i], width / 2, lineH * (i + 0.5));
        }

        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width/100, height/100),
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
            if (state.renderer.domElement?.parentNode) {
                state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
            }
            state.renderer.dispose();
            try { state.renderer.forceContextLoss(); } catch(e){}
            state.renderer = null;
        }

        if (state.scene) {
            state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        }
        state = null;
    };

    init();
})();
