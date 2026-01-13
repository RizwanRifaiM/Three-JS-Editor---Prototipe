(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        MAZE_SIZE: 17, // Odd number works best
        CELL_SIZE: 1.0,
        PLAYER_SPEED: 0.08,
    };

    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.player = null;
        this.finish = null;
        this.walls = [];
        this.keys = {};
        this.mazeData = [];
        this.isGameWon = false;
        this.elapsedTime = 0;

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
        state.scene.background = new THREE.Color(0x1a1a2e);

        // Camera & Renderer
        const worldSize = GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE;
        state.camera = new THREE.OrthographicCamera(-worldSize/2, worldSize/2, worldSize/2, -worldSize/2, 0.1, 100);
        state.camera.position.z = 10;
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        onResize(state); // Initial sizing

        // Lights
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        dirLight.position.set(5, 10, 5);
        state.scene.add(dirLight);

        // Player
        state.player = new THREE.Mesh(
            new THREE.SphereGeometry(GAME_CONST.CELL_SIZE * 0.3, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        state.scene.add(state.player);

        // Event Listeners
        state.boundKeydown = e => { state.keys[e.code] = true; };
        state.boundKeyup = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);
        
        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.isGameWon = false;
        state.elapsedTime = 0;
        if(state.overlayMesh) clearOverlay(state);
        
        generateMaze(state);
        buildMaze(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;
        
        if (state.isGameWon) {
            if (state.keys['Enter']) resetGame(state);
        } else {
            state.elapsedTime += state.clock.getDelta();
            updatePlayer(state);
            handleCollisions(state);
            updateHUD(state);
        }
        
        state.renderer.render(state.scene, state.camera);
    }
    
    function generateMaze(state) {
        state.mazeData = Array(GAME_CONST.MAZE_SIZE).fill(null).map(() => Array(GAME_CONST.MAZE_SIZE).fill(1));
        
        function carve(x, y) {
            state.mazeData[y][x] = 0;
            const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
            directions.sort(() => Math.random() - 0.5);
            
            for (let [dx, dy] of directions) {
                const [nx, ny] = [x + dx, y + dy];
                if (nx > 0 && nx < GAME_CONST.MAZE_SIZE - 1 && ny > 0 && ny < GAME_CONST.MAZE_SIZE - 1 && state.mazeData[ny][nx] === 1) {
                    state.mazeData[y + dy / 2][x + dx / 2] = 0;
                    carve(nx, ny);
                }
            }
        }
        carve(1, 1);
        state.mazeData[1][0] = 0; // Entrance
        state.mazeData[GAME_CONST.MAZE_SIZE - 2][GAME_CONST.MAZE_SIZE - 1] = 0; // Exit
    }

    function buildMaze(state) {
        state.walls.forEach(w => state.scene.remove(w));
        state.walls = [];
        if(state.finish) state.scene.remove(state.finish);

        const wallGeo = new THREE.BoxGeometry(GAME_CONST.CELL_SIZE, GAME_CONST.CELL_SIZE, GAME_CONST.CELL_SIZE);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x555588 });
        const finishMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xcccc00 });

        const offset = (GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE) / 2 - GAME_CONST.CELL_SIZE / 2;

        for (let r = 0; r < GAME_CONST.MAZE_SIZE; r++) {
            for (let c = 0; c < GAME_CONST.MAZE_SIZE; c++) {
                const x = c * GAME_CONST.CELL_SIZE - offset;
                const y = -r * GAME_CONST.CELL_SIZE + offset;

                if (r === 1 && c === 0) { // Start
                    state.player.position.set(x, y, 0);
                } else if (r === GAME_CONST.MAZE_SIZE - 2 && c === GAME_CONST.MAZE_SIZE - 1) { // Finish
                    state.finish = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.CELL_SIZE,GAME_CONST.CELL_SIZE,GAME_CONST.CELL_SIZE), finishMat);
                    state.finish.position.set(x, y, 0);
                    state.scene.add(state.finish);
                } else if (state.mazeData[r][c] === 1) {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(x, y, 0);
                    state.walls.push(wall);
                    state.scene.add(wall);
                }
            }
        }
    }

    function updatePlayer(state) {
        let moveX = 0, moveY = 0;
        if (state.keys['KeyW'] || state.keys['ArrowUp']) moveY = 1;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) moveY = -1;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) moveX = -1;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) moveX = 1;

        if(moveX !== 0 || moveY !== 0) {
            const moveVec = new THREE.Vector2(moveX, moveY).normalize().multiplyScalar(GAME_CONST.PLAYER_SPEED);
            state.player.position.x += moveVec.x;
            state.player.position.y += moveVec.y;
        }
    }

    function handleCollisions(state) {
        const playerBox = new THREE.Box3().setFromObject(state.player);

        state.walls.forEach(wall => {
            const wallBox = new THREE.Box3().setFromObject(wall);
            if (playerBox.intersectsBox(wallBox)) {
                const overlap = playerBox.clone().intersect(wallBox);
                const overlapSize = new THREE.Vector3();
                overlap.getSize(overlapSize);

                const signX = Math.sign(state.player.position.x - wall.position.x);
                const signY = Math.sign(state.player.position.y - wall.position.y);
                
                if (overlapSize.x < overlapSize.y) {
                    state.player.position.x += overlapSize.x * signX;
                } else {
                    state.player.position.y += overlapSize.y * signY;
                }
            }
        });

        if (state.finish && state.player.position.distanceTo(state.finish.position) < GAME_CONST.CELL_SIZE * 0.7) {
            handleWin(state);
        }
    }

    function handleWin(state) {
        if (state.isGameWon) return;
        state.isGameWon = true;
        const msg = `YOU WIN!\nCompleted in ${state.elapsedTime.toFixed(1)}s\n\n[ENTER] to play again`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "24px Courier New", align: "center", width: 500, height: 250, bg: "rgba(30,30,0,0.9)"
        });
        state.overlayMesh.position.z = 5;
        state.scene.add(state.overlayMesh);
    }
    
    function clearOverlay(state) {
        if (state.overlayMesh) {
            state.scene.remove(state.overlayMesh);
            disposeMesh(state.overlayMesh);
            state.overlayMesh = null;
        }
    }
    
    function updateHUD(state) {
        if (state.hudMesh) {
            state.scene.remove(state.hudMesh);
            disposeMesh(state.hudMesh);
        }
        const text = `Time: ${state.elapsedTime.toFixed(1)}s`;
        state.hudMesh = createTextLabelMesh(text, { font: "20px Courier New", width: 250, height: 40, align: "left" });
        
        const worldSize = GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE;
        const aspect = window.innerWidth / window.innerHeight;
        state.hudMesh.position.set(-worldSize/2*aspect + 2.5, worldSize/2 - 0.8, 0);
        state.scene.add(state.hudMesh);
    }
    
    function onResize(state) {
        renderer.setSize(window.innerWidth, window.innerHeight);
        const worldSize = GAME_CONST.MAZE_SIZE * GAME_CONST.CELL_SIZE;
        const aspect = window.innerWidth / window.innerHeight;
        state.camera.left = -worldSize/2*aspect;
        state.camera.right = worldSize/2*aspect;
        state.camera.top = worldSize/2;
        state.camera.bottom = -worldSize/2;
        state.camera.updateProjectionMatrix();
        if(state.hudMesh) updateHUD(state); //reposition HUD
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
        const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const textHeight = lines.length * (parseInt(font) * 1.2);

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
        const xPos = opts.align === "left" ? 10 : (opts.align === "right" ? width - 10 : width / 2);

        for (let i = 0; i < lines.length; i++) {
             ctx.fillText(lines[i], xPos, lineH * (i + 0.5));
        }

        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width/50, height/50),
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
