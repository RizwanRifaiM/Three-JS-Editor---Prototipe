(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 20,
        WORLD_H: 26,
        PADDLE_W: 3.5,
        PADDLE_H: 0.5,
        PADDLE_Y: -11,
        BALL_RADIUS: 0.25,
        BALL_SPEED_INIT: 0.25,
        LIVES_INIT: 3,
        BRICK_ROWS: 6,
        BRICK_COLS: 8,
    };
    GAME_CONST.BRICK_W = (GAME_CONST.WORLD_W - 1) / GAME_CONST.BRICK_COLS - 0.2;
    GAME_CONST.BRICK_H = 0.8;
    const BRICK_COLORS = [0xcc0000, 0xcc6600, 0xcccc00, 0x00cc00, 0x0066cc, 0x6600cc];


    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.paddle = null;
        this.ball = null;
        this.bricks = [];
        this.ballVelocity = new THREE.Vector2(0, 0);
        this.keys = {};
        this.score = 0;
        this.lives = 0;
        this.bricksRemaining = 0;
        this.isGameActive = false;
        this.isGameOver = false;

        this.hudMesh = null;
        this.overlayMesh = null;

        // cleanup list
        this.boundKeydown = null;
        this.boundKeyup = null;
        this.boundResize = null;
        this.boundMousemove = null;
        this.boundMousedown = null;
    }

    function init() {
        state = new GameState();

        // Scene
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x000022);

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
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const pointLight = new THREE.PointLight(0xffffff, 0.8);
        pointLight.position.set(0, 0, 5);
        state.scene.add(pointLight);

        // Game Objects
        state.paddle = new THREE.Mesh(
            new THREE.BoxGeometry(GAME_CONST.PADDLE_W, GAME_CONST.PADDLE_H, 1),
            new THREE.MeshStandardMaterial({ color: 0x00ccff })
        );
        state.scene.add(state.paddle);

        state.ball = new THREE.Mesh(
            new THREE.SphereGeometry(GAME_CONST.BALL_RADIUS, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        state.scene.add(state.ball);

        // Event Listeners
        state.boundKeydown = e => onKeyDown(e, state);
        state.boundKeyup = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);
        state.boundMousemove = e => onMouseMove(e, state);
        state.boundMousedown = () => onMouseDown(state);

        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);
        window.addEventListener('mousemove', state.boundMousemove);
        window.addEventListener('mousedown', state.boundMousedown);
        
        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.isGameOver = false;
        state.isGameActive = false;
        state.score = 0;
        state.lives = GAME_CONST.LIVES_INIT;
        
        clearOverlay(state);
        buildBricks(state);
        resetPaddleAndBall(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if (!state) return;

        if (state.isGameOver) {
            if (state.keys['Enter']) {
                resetGame(state);
            }
        } else if (state.isGameActive) {
            state.ball.position.x += state.ballVelocity.x;
            state.ball.position.y += state.ballVelocity.y;
            checkCollisions(state);
        }

        state.renderer.render(state.scene, state.camera);
    }
    
    function onKeyDown(e, state) {
        state.keys[e.code] = true;
        if (state.overlayMesh && (e.key === 'Escape' || e.key === 'Esc')) {
            clearOverlay(state);
        }
        if (!state.overlayMesh && (e.key === 'h' || e.key === 'H')) {
            showHint(state);
        }
    }
    
    function showHint(state) {
        if (state.overlayMesh) return;
        const msg = `Hint:\n- Move mouse to move paddle\n- Left click to launch ball\n- Bounce ball at different\n  paddle angles to aim\n\n[ESC] to close hint`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "24px Courier New", align: "center", width: 500, height: 300, bg: "rgba(0,0,30,0.9)"
        });
        state.overlayMesh.position.z = 5;
        state.scene.add(state.overlayMesh);
    }
    
    function handleEndGame(state, isWin) {
        state.isGameOver = true;
        state.isGameActive = false;
        const msg = `${isWin ? 'YOU WIN!' : 'GAME OVER'}\nScore: ${state.score}\n\n[ENTER] to restart`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "32px Courier New", align: "center", width: 500, height: 250, bg: "rgba(30,0,0,0.9)"
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

    function buildBricks(state) {
        state.bricks.forEach(b => state.scene.remove(b));
        state.bricks = [];
        const startY = GAME_CONST.WORLD_H / 2 - 4;

        for (let r = 0; r < GAME_CONST.BRICK_ROWS; r++) {
            for (let c = 0; c < GAME_CONST.BRICK_COLS; c++) {
                const brick = new THREE.Mesh(
                    new THREE.BoxGeometry(GAME_CONST.BRICK_W, GAME_CONST.BRICK_H, 1),
                    new THREE.MeshStandardMaterial({ color: BRICK_COLORS[r % BRICK_COLORS.length] })
                );
                brick.position.x = (c - GAME_CONST.BRICK_COLS / 2 + 0.5) * (GAME_CONST.BRICK_W + 0.2);
                brick.position.y = startY - r * (GAME_CONST.BRICK_H + 0.2);
                state.bricks.push(brick);
                state.scene.add(brick);
            }
        }
        state.bricksRemaining = state.bricks.length;
    }

    function resetPaddleAndBall(state) {
        state.isGameActive = false;
        state.paddle.position.set(0, GAME_CONST.PADDLE_Y, 0);
        state.ball.position.set(0, GAME_CONST.PADDLE_Y + GAME_CONST.PADDLE_H / 2 + GAME_CONST.BALL_RADIUS, 0);
        state.ballVelocity.set(0, 0);
    }

    function onMouseMove(e, state) {
        if (state.overlayMesh) return;
        const rect = state.renderer.domElement.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const paddleLimit = GAME_CONST.WORLD_W / 2 - GAME_CONST.PADDLE_W / 2;
        state.paddle.position.x = THREE.MathUtils.clamp(mouseX * (GAME_CONST.WORLD_W / 2), -paddleLimit, paddleLimit);
        if (!state.isGameActive) {
            state.ball.position.x = state.paddle.position.x;
        }
    }

    function onMouseDown(state) {
        if (state.overlayMesh || state.isGameOver || state.isGameActive) return;
        state.isGameActive = true;
        state.ballVelocity.set((Math.random() - 0.5) * 0.1, GAME_CONST.BALL_SPEED_INIT);
    }
    
    function checkCollisions(state) {
        const ballBox = new THREE.Box3().setFromObject(state.ball);

        // Walls
        const halfW = GAME_CONST.WORLD_W / 2;
        const halfH = GAME_CONST.WORLD_H / 2;
        if (state.ball.position.x > halfW - GAME_CONST.BALL_RADIUS || state.ball.position.x < -halfW + GAME_CONST.BALL_RADIUS) {
            state.ballVelocity.x *= -1;
            state.ball.position.x = THREE.MathUtils.clamp(state.ball.position.x, -halfW + GAME_CONST.BALL_RADIUS, halfW - GAME_CONST.BALL_RADIUS);
        }
        if (state.ball.position.y > halfH - GAME_CONST.BALL_RADIUS) {
            state.ballVelocity.y *= -1;
            state.ball.position.y = halfH - GAME_CONST.BALL_RADIUS;
        }

        // Bottom (lose life)
        if (state.ball.position.y < -halfH) {
            state.lives--;
            updateHUD(state);
            if (state.lives <= 0) {
                handleEndGame(state, false);
            } else {
                resetPaddleAndBall(state);
            }
            return;
        }

        // Paddle
        const paddleBox = new THREE.Box3().setFromObject(state.paddle);
        if (state.ballVelocity.y < 0 && ballBox.intersectsBox(paddleBox)) {
            state.ballVelocity.y *= -1;
            const hitPos = (state.ball.position.x - state.paddle.position.x) / (GAME_CONST.PADDLE_W / 2);
            state.ballVelocity.x = THREE.MathUtils.clamp(hitPos, -1, 1) * GAME_CONST.BALL_SPEED_INIT;
            state.ball.position.y = state.paddle.position.y + GAME_CONST.PADDLE_H/2 + GAME_CONST.BALL_RADIUS;
        }

        // Bricks
        for (let i = state.bricks.length - 1; i >= 0; i--) {
            const brick = state.bricks[i];
            const brickBox = new THREE.Box3().setFromObject(brick);
            if (ballBox.intersectsBox(brickBox)) {
                state.scene.remove(brick);
                state.bricks.splice(i, 1);
                state.score += 10;
                state.bricksRemaining--;
                updateHUD(state);

                const overlap = ballBox.clone().intersect(brickBox);
                const overlapSize = new THREE.Vector3();
                overlap.getSize(overlapSize);
                
                state.ballVelocity[overlapSize.x < overlapSize.y ? 'x' : 'y'] *= -1;

                if (state.bricksRemaining <= 0) {
                    handleEndGame(state, true);
                }
                break;
            }
        }
    }
    
    function updateHUD(state) {
        if (state.hudMesh) {
            state.scene.remove(state.hudMesh);
            disposeMesh(state.hudMesh);
        }
        const text = `Score: ${state.score}\nLives: ${state.lives}`;
        state.hudMesh = createTextLabelMesh(text, { font: "20px Courier New", width: 250, height: 60, align: "left" });
        state.hudMesh.position.set(-GAME_CONST.WORLD_W/2 + 3.2, GAME_CONST.WORLD_H/2 - 1.8, 0);
        state.scene.add(state.hudMesh);
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
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
        const textHeight = metrics.reduce((sum, m) => sum + (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent), 0) * 1.2;

        const width = opts.width || THREE.MathUtils.ceilPowerOfTwo(textWidth)
        const height = opts.height || THREE.MathUtils.ceilPowerOfTwo(textHeight)
        canvas.width = width;
        canvas.height = height;
        
        ctx.font = font; // reset font after resize
        if (opts.bg) {
            ctx.fillStyle = opts.bg;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.fillStyle = opts.color || "#fff";
        ctx.textAlign = opts.align || "center";
        ctx.textBaseline = "middle";

        const lineH = height / lines.length;
        for (let i = 0; i < lines.length; i++) {
             ctx.fillText(lines[i], opts.align === "left" ? 10 : width / 2, lineH * (i + 0.5));
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
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
        window.removeEventListener('mousemove', state.boundMousemove);
        window.removeEventListener('mousedown', state.boundMousedown);

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
