(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 22,
        WORLD_H: 16,
        PLAYER_SPEED: 0.15,
        ITEM_COUNT: 15,
        TIME_LIMIT: 45, // seconds
    };

    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.player = null;
        this.items = [];
        this.walls = [];
        this.keys = {};
        this.score = 0;
        this.timeLeft = 0;
        this.isGameOver = false;

        this.hudMesh = null;
        this.overlayMesh = null;

        // cleanup list
        this.boundKeydown = null;
        this.boundKeyup = null;
        this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Scene
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x2d1b4e);

        // Camera
        state.camera = new THREE.OrthographicCamera(
            -GAME_CONST.WORLD_W / 2, GAME_CONST.WORLD_W / 2,
            GAME_CONST.WORLD_H / 2, -GAME_CONST.WORLD_H / 2,
            0.1, 100
        );
        state.camera.position.z = 10;

        // Renderer
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);

        // Lights
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, 10, 5);
        state.scene.add(dirLight);

        // Game Objects
        state.player = new THREE.Mesh(
            new THREE.CircleGeometry(0.5, 32),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );
        state.scene.add(state.player);
        
        buildWalls(state);
        
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
        state.isGameOver = false;
        state.score = 0;
        state.timeLeft = GAME_CONST.TIME_LIMIT;
        
        if (state.overlayMesh) clearOverlay(state);

        state.player.position.set(0, 0, 0);

        state.items.forEach(i => state.scene.remove(i));
        state.items = [];
        spawnItems(state, GAME_CONST.ITEM_COUNT);
        
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;

        const deltaTime = state.clock.getDelta();

        if (state.isGameOver) {
            if(state.keys['Enter']) resetGame(state);
        } else {
            updatePlayer(state);
            updateGame(state, deltaTime);
            handleCollisions(state);
            updateHUD(state);
        }
        state.renderer.render(state.scene, state.camera);
    }
    
    function spawnItems(state, count) {
        const geo = new THREE.IcosahedronGeometry(0.4, 0);
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6) });
            const item = new THREE.Mesh(geo, mat);
            item.position.set(
                (Math.random() - 0.5) * (GAME_CONST.WORLD_W - 2),
                (Math.random() - 0.5) * (GAME_CONST.WORLD_H - 2),
                0
            );
            state.items.push(item);
            state.scene.add(item);
        }
    }

    function updatePlayer(state) {
        if (state.keys['KeyW'] || state.keys['ArrowUp']) state.player.position.y += GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) state.player.position.y -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.player.position.x -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.player.position.x += GAME_CONST.PLAYER_SPEED;
        
        const halfW = GAME_CONST.WORLD_W / 2 - 0.5;
        const halfH = GAME_CONST.WORLD_H / 2 - 0.5;
        state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -halfW, halfW);
        state.player.position.y = THREE.MathUtils.clamp(state.player.position.y, -halfH, halfH);
    }
    
    function updateGame(state, deltaTime) {
        if (state.isGameOver) return;
        
        state.timeLeft -= deltaTime;
        if (state.timeLeft <= 0) {
            state.timeLeft = 0;
            handleEndGame(state, false);
        }
        
        state.items.forEach(item => {
            item.rotation.x += 0.5 * deltaTime;
            item.rotation.y += 0.5 * deltaTime;
        });
    }

    function handleCollisions(state) {
        for (let i = state.items.length - 1; i >= 0; i--) {
            if (state.player.position.distanceTo(state.items[i].position) < 0.8) {
                state.scene.remove(state.items[i]);
                disposeMesh(state.items[i]);
                state.items.splice(i, 1);
                state.score++;
                if (state.score >= GAME_CONST.ITEM_COUNT) {
                    handleEndGame(state, true);
                }
            }
        }
    }

    function handleEndGame(state, isWin) {
        if (state.isGameOver) return;
        state.isGameOver = true;
        
        const timeTaken = GAME_CONST.TIME_LIMIT - state.timeLeft;
        const endMsg1 = isWin ? "YOU WIN!" : "TIME'S UP!";
        let endMsg2 = `You collected ${state.score}/${GAME_CONST.ITEM_COUNT} items`;
        if(isWin) endMsg2 += `\n in ${timeTaken.toFixed(1)} seconds.`;
        
        const fullMsg = `${endMsg1}\n${endMsg2}\n\n[ENTER] to restart`;
        
        state.overlayMesh = createTextLabelMesh(fullMsg, {
            font: "28px Courier New", align: "center", width: 600, height: 300, bg: "rgba(30,0,30,0.9)"
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

    function buildWalls(state) {
        const wallMat = new THREE.MeshStandardMaterial({color: 0x4a4a6e});
        const T = 0.5; // thickness
        const geometries = [
            new THREE.BoxGeometry(GAME_CONST.WORLD_W + T, T, T), // top
            new THREE.BoxGeometry(GAME_CONST.WORLD_W + T, T, T), // bottom
            new THREE.BoxGeometry(T, GAME_CONST.WORLD_H + T, T), // left
            new THREE.BoxGeometry(T, GAME_CONST.WORLD_H + T, T)  // right
        ];
        const positions = [
            [0, GAME_CONST.WORLD_H / 2, 0],
            [0, -GAME_CONST.WORLD_H / 2, 0],
            [-GAME_CONST.WORLD_W / 2, 0, 0],
            [GAME_CONST.WORLD_W / 2, 0, 0]
        ];
        for(let i=0; i < 4; i++) {
            const wall = new THREE.Mesh(geometries[i], wallMat);
            wall.position.set(...positions[i]);
            state.walls.push(wall);
            state.scene.add(wall);
        }
    }
    
    function updateHUD(state) {
        if (state.hudMesh) {
            state.scene.remove(state.hudMesh);
            disposeMesh(state.hudMesh);
        }
        const text = `Items: ${state.score}/${GAME_CONST.ITEM_COUNT}\nTime: ${Math.ceil(state.timeLeft)}`;
        state.hudMesh = createTextLabelMesh(text, { font: "20px Courier New", width: 300, height: 60, align: "left" });
        state.hudMesh.position.set(-GAME_CONST.WORLD_W/2 + 2, GAME_CONST.WORLD_H/2 - 1.8, 0);
        state.scene.add(state.hudMesh);
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
