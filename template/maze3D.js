(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        MAZE_SIZE: 15, // Odd number works best
        CELL_SIZE: 4,
        WALL_HEIGHT: 3,
        PLAYER_SPEED: 4.0,
        PLAYER_HEIGHT: 1.6,
        PLAYER_RADIUS: 0.4,
    };

    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        this.player = new THREE.Group();
        this.finish = null;
        this.walls = [];
        this.keys = {};
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.mazeData = [];
        this.gameState = 'playing'; // 'playing' | 'game_over'
        this.elapsedTime = 0;

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

        // Scene
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x1a1a2e);
        state.scene.fog = new THREE.Fog(0x1a1a2e, 1, GAME_CONST.CELL_SIZE * 5);

        // Camera & Renderer
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        state.player.add(state.camera);
        state.player.position.y = GAME_CONST.PLAYER_HEIGHT;
        state.scene.add(state.player);

        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);

        // Lights & Floor
        state.scene.add(new THREE.AmbientLight(0x404040, 1.5));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 30, 10);
        state.scene.add(dirLight);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE, GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE),
            new THREE.MeshStandardMaterial({ color: 0x444444 })
        );
        floor.rotation.x = -Math.PI / 2;
        state.scene.add(floor);
        
        addCrosshair(state);
        
        // Event Listeners
        const canvas = state.renderer.domElement;
        state.boundCanvasClick = () => canvas.requestPointerLock();
        state.boundPointerLockChange = () => onPointerLockChange(state);
        state.boundMouseMove = e => onMouseMove(e, state);
        state.boundKeydown = e => { state.keys[e.code] = true; };
        state.boundKeyup = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);
        
        canvas.addEventListener('click', state.boundCanvasClick);
        document.addEventListener('pointerlockchange', state.boundPointerLockChange);
        document.addEventListener('mousemove', state.boundMouseMove);
        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing';
        state.elapsedTime = 0;
        if(state.overlayMesh) clearOverlay(state);
        
        state.walls.forEach(w => state.scene.remove(w));
        state.walls = [];
        if(state.finish) state.scene.remove(state.finish);
        
        generateMaze(state);
        buildMaze(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;
        
        const deltaTime = state.clock.getDelta();
        
        if (state.gameState === 'playing') {
            updatePlayer(state, deltaTime);
            handleCollisions(state);
            state.elapsedTime += deltaTime;
            updateHUD(state);
        } else if (state.gameState === 'game_over') {
            if (state.keys['Enter']) resetGame(state);
        }
        
        state.renderer.render(state.scene, state.camera);
    }
    
    function generateMaze(state) {
        state.mazeData = Array(GAME_CONST.MAZE_SIZE).fill(null).map(() => Array(GAME_CONST.MAZE_SIZE).fill(1));
        function carve(x, y) {
            state.mazeData[y][x] = 0;
            const dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]].sort(() => Math.random() - 0.5);
            for (let [dx, dy] of dirs) {
                const [nx, ny] = [x + dx, y + dy];
                if (nx > 0 && nx < GAME_CONST.MAZE_SIZE - 1 && ny > 0 && ny < GAME_CONST.MAZE_SIZE - 1 && state.mazeData[ny][nx] === 1) {
                    state.mazeData[y + dy / 2][x + dx / 2] = 0;
                    carve(nx, ny);
                }
            }
        }
        carve(1, 1);
        state.mazeData[1][0] = 0; 
        state.mazeData[GAME_CONST.MAZE_SIZE - 2][GAME_CONST.MAZE_SIZE - 1] = 0;
    }

    function buildMaze(state) {
        const wallGeo = new THREE.BoxGeometry(GAME_CONST.CELL_SIZE, GAME_CONST.WALL_HEIGHT, GAME_CONST.CELL_SIZE);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888899 });
        const finishMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xcccc00 });
        const offset = (GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE) / 2 - GAME_CONST.CELL_SIZE / 2;

        for (let r = 0; r < GAME_CONST.MAZE_SIZE; r++) {
            for (let c = 0; c < GAME_CONST.MAZE_SIZE; c++) {
                const x = c * GAME_CONST.CELL_SIZE - offset;
                const z = r * GAME_CONST.CELL_SIZE - offset;
                if (r === 1 && c === 0) {
                    state.player.position.set(x, GAME_CONST.PLAYER_HEIGHT, z);
                } else if (r === GAME_CONST.MAZE_SIZE - 2 && c === GAME_CONST.MAZE_SIZE - 1) {
                    state.finish = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.CELL_SIZE, GAME_CONST.WALL_HEIGHT, GAME_CONST.CELL_SIZE), finishMat);
                    state.finish.position.set(x, GAME_CONST.WALL_HEIGHT / 2, z);
                    state.scene.add(state.finish);
                } else if (state.mazeData[r][c] === 1) {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(x, GAME_CONST.WALL_HEIGHT / 2, z);
                    state.walls.push(wall);
                    state.scene.add(wall);
                }
            }
        }
    }

    function updatePlayer(state, deltaTime) {
        const moveDirection = new THREE.Vector3();
        if (state.keys['KeyW']) moveDirection.z = -1;
        if (state.keys['KeyS']) moveDirection.z = 1;
        if (state.keys['KeyA']) moveDirection.x = -1;
        if (state.keys['KeyD']) moveDirection.x = 1;
        
        if(moveDirection.lengthSq() > 0) {
            moveDirection.normalize().applyQuaternion(state.camera.quaternion);
            moveDirection.y = 0;
            state.player.position.add(moveDirection.multiplyScalar(GAME_CONST.PLAYER_SPEED * deltaTime));
        }
    }

    function handleCollisions(state) {
        const playerBox = new THREE.Box3().setFromCenterAndSize(state.player.position, new THREE.Vector3(GAME_CONST.PLAYER_RADIUS*2, GAME_CONST.PLAYER_HEIGHT, GAME_CONST.PLAYER_RADIUS*2));
        
        state.walls.forEach(wall => {
            const wallBox = new THREE.Box3().setFromObject(wall);
            if (playerBox.intersectsBox(wallBox)) {
                const overlap = playerBox.clone().intersect(wallBox);
                const overlapSize = new THREE.Vector3();
                overlap.getSize(overlapSize);
                
                if (overlapSize.x < overlapSize.z) {
                    state.player.position.x += overlapSize.x * Math.sign(state.player.position.x - wall.position.x);
                } else {
                    state.player.position.z += overlapSize.z * Math.sign(state.player.position.z - wall.position.z);
                }
            }
        });

        if (state.finish && state.player.position.distanceTo(state.finish.position) < GAME_CONST.CELL_SIZE * 0.8) {
            handleWin(state);
        }
    }

    function handleWin(state) {
        if (state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        document.exitPointerLock();
        
        const msg = `YOU WIN!\nCompleted in ${state.elapsedTime.toFixed(1)}s\n\n[ENTER] to play again`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "32px Courier New", align: "center", width: 600, height: 250, bg: "rgba(30,30,0,0.9)"
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

    function onPointerLockChange(state) {
        state.crosshairMesh.visible = (document.pointerLockElement === state.renderer.domElement);
    }

    function onMouseMove(e, state) {
        if (document.pointerLockElement !== state.renderer.domElement) return;
        state.euler.setFromQuaternion(state.camera.quaternion);
        state.euler.y -= e.movementX * 0.002;
        state.euler.x -= e.movementY * 0.002;
        state.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.euler.x));
        state.camera.quaternion.setFromEuler(state.euler);
    }
    
    function addCrosshair(state) {
        const map = new THREE.TextureLoader().load('data:image/svg+xml,' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' + 
            '<path fill="rgba(255,255,255,0.8)" d="M15 0h2v15h-2z M0 15h15v2h-15z M17 15h15v2h-15z M15 17h2v15h-2z"/>' + 
            '</svg>');
        const material = new THREE.SpriteMaterial({ map: map, color: 0xffffff, transparent: true, opacity: 0.8 });
        state.crosshairMesh = new THREE.Sprite(material);
        state.crosshairMesh.scale.set(0.05, 0.05, 1);
        state.crosshairMesh.position.set(0, 0, -1);
        state.crosshairMesh.visible = false;
        state.camera.add(state.crosshairMesh);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) state.camera.remove(state.hudMesh);

        const text = `Time: ${state.elapsedTime.toFixed(1)}s`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 300, height: 50 });
        state.hudMesh.position.set(0, 0.9, -2);
        state.camera.add(state.hudMesh);
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }

    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial";
        ctx.font = font;
        
        const lines = text.split("\n");
        const width = opts.width || 512;
        const height = opts.height || 128;
        canvas.width = width;
        canvas.height = height;
        
        ctx.font = font;
        if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, width, height); }
        ctx.fillStyle = opts.color || "#fff";
        ctx.textAlign = opts.align || "center";
        ctx.textBaseline = "middle";

        const lineH = height / lines.length;
        for (let i = 0; i < lines.length; i++) {
             ctx.fillText(lines[i], width / 2, lineH * (i + 0.5));
        }

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

        if (state.scene) {
            state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        }
        state = null;
    };

    init();
})();
