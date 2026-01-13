(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 20, WORLD_H: 15,
        PADDLE_W: 0.5, PADDLE_H: 3.5,
        PADDLE_SPEED: 0.22, AI_PADDLE_SPEED: 0.13,
        BALL_RADIUS: 0.25, BALL_SPEED_INIT: 0.15, BALL_SPEED_INC: 0.01, BALL_SPEED_MAX: 0.4,
        MAX_SCORE: 7,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null;
        this.paddle1 = null; this.paddle2 = null; this.ball = null;
        this.ballVelocity = new THREE.Vector2();
        this.keys = {};
        this.score1 = 0; this.score2 = 0;
        this.isGameOver = false;

        this.hudMesh = null; this.overlayMesh = null;

        this.boundKeydown = null; this.boundKeyup = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Scene & Camera
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x111111);
        state.camera = new THREE.OrthographicCamera(-GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_H/2, -GAME_CONST.WORLD_H/2, 0.1, 100);
        state.camera.position.z = 10;

        // Renderer
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        state.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
        createObjects(state);

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
    
    function createObjects(state) {
        const paddleGeo = new THREE.BoxGeometry(GAME_CONST.PADDLE_W, GAME_CONST.PADDLE_H, 1);
        const paddleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        state.paddle1 = new THREE.Mesh(paddleGeo, paddleMat);
        state.paddle2 = new THREE.Mesh(paddleGeo, paddleMat.clone());
        state.scene.add(state.paddle1, state.paddle2);

        const ballGeo = new THREE.SphereGeometry(GAME_CONST.BALL_RADIUS, 16, 16);
        state.ball = new THREE.Mesh(ballGeo, paddleMat.clone());
        state.scene.add(state.ball);

        const netMat = new THREE.LineDashedMaterial({ color: 0x555555, dashSize: 0.5, gapSize: 0.25 });
        const netGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -GAME_CONST.WORLD_H/2, 0), new THREE.Vector3(0, GAME_CONST.WORLD_H/2, 0)
        ]);
        const net = new THREE.Line(netGeo, netMat);
        net.computeLineDistances();
        state.scene.add(net);
    }
    
    function resetGame(state) {
        state.isGameOver = false;
        state.score1 = 0;
        state.score2 = 0;
        clearOverlay(state);
        resetPositions(state);
        resetBall(state);
        updateHUD(state);
    }

    function resetPositions(state) {
        state.paddle1.position.set(-GAME_CONST.WORLD_W / 2 + 1.5, 0, 0);
        state.paddle2.position.set(GAME_CONST.WORLD_W / 2 - 1.5, 0, 0);
    }

    function resetBall(state) {
        state.ball.position.set(0, 0, 0);
        let angle = (Math.random() - 0.5) * 0.5;
        let dir = Math.random() < 0.5 ? 1 : -1;
        state.ballVelocity.set(GAME_CONST.BALL_SPEED_INIT * dir, GAME_CONST.BALL_SPEED_INIT * angle);
    }

    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;

        if (state.isGameOver) {
            if (state.keys['Enter']) resetGame(state);
        } else {
            updatePaddles(state);
            updateBall(state);
            checkCollisions(state);
        }
        state.renderer.render(state.scene, state.camera);
    }

    function updatePaddles(state) {
        const minY = -GAME_CONST.WORLD_H / 2 + GAME_CONST.PADDLE_H / 2;
        const maxY = GAME_CONST.WORLD_H / 2 - GAME_CONST.PADDLE_H / 2;

        if (state.keys['KeyW'] || state.keys['ArrowUp'])   state.paddle1.position.y += GAME_CONST.PADDLE_SPEED;
        if (state.keys['KeyS'] || state.keys['ArrowDown']) state.paddle1.position.y -= GAME_CONST.PADDLE_SPEED;
        state.paddle1.position.y = THREE.MathUtils.clamp(state.paddle1.position.y, minY, maxY);

        const dy = state.ball.position.y - state.paddle2.position.y;
        if (Math.abs(dy) > 0.1)
            state.paddle2.position.y += Math.sign(dy) * Math.min(Math.abs(dy), GAME_CONST.AI_PADDLE_SPEED);
        state.paddle2.position.y = THREE.MathUtils.clamp(state.paddle2.position.y, minY, maxY);
    }

    function updateBall(state) {
        state.ball.position.x += state.ballVelocity.x;
        state.ball.position.y += state.ballVelocity.y;

        if (state.ball.position.x > GAME_CONST.WORLD_W / 2) {
            state.score1++;
            updateHUD(state);
            state.score1 >= GAME_CONST.MAX_SCORE ? handleEndGame(state, "Player 1") : resetBall(state);
        }
        if (state.ball.position.x < -GAME_CONST.WORLD_W / 2) {
            state.score2++;
            updateHUD(state);
            state.score2 >= GAME_CONST.MAX_SCORE ? handleEndGame(state, "Computer") : resetBall(state);
        }
    }
    
    function checkCollisions(state) {
        const ballBox = new THREE.Box3().setFromObject(state.ball);
        const p1Box = new THREE.Box3().setFromObject(state.paddle1);
        const p2Box = new THREE.Box3().setFromObject(state.paddle2);

        // Top/Bottom wall
        if (state.ball.position.y > GAME_CONST.WORLD_H/2 - GAME_CONST.BALL_RADIUS || state.ball.position.y < -GAME_CONST.WORLD_H/2 + GAME_CONST.BALL_RADIUS) {
            state.ballVelocity.y *= -1;
        }

        // Paddles
        const hitPaddle = (paddle, box) => {
            if (ballBox.intersectsBox(box)) {
                state.ballVelocity.x *= -1;
                state.ballVelocity.x += Math.sign(state.ballVelocity.x) * GAME_CONST.BALL_SPEED_INC;
                
                const hitNorm = (state.ball.position.y - paddle.position.y) / (GAME_CONST.PADDLE_H / 2);
                state.ballVelocity.y = hitNorm * state.ballVelocity.length() * 0.9;
                
                state.ball.position.x = paddle.position.x + (Math.sign(state.ballVelocity.x) * (GAME_CONST.PADDLE_W / 2 + GAME_CONST.BALL_RADIUS));
                if (state.ballVelocity.length() > GAME_CONST.BALL_SPEED_MAX) state.ballVelocity.setLength(GAME_CONST.BALL_SPEED_MAX);
            }
        };
        hitPaddle(state.paddle1, p1Box);
        hitPaddle(state.paddle2, p2Box);
    }
    
    function handleEndGame(state, winner) {
        if(state.isGameOver) return;
        state.isGameOver = true;
        const msg = `${winner} Wins!\n\n[ENTER] to restart`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "40px Courier New", align: "center", width: 500, height: 250, bg: "rgba(0,0,0,0.8)"
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
    
    function onResize(state) {
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        const aspect = window.innerWidth / window.innerHeight;
        const targetAspect = GAME_CONST.WORLD_W / GAME_CONST.WORLD_H;
        
        let w, h;
        if(aspect > targetAspect) {
            h = GAME_CONST.WORLD_H;
            w = h * aspect;
        } else {
            w = GAME_CONST.WORLD_W;
            h = w / aspect;
        }
        state.camera.left = -w / 2;
        state.camera.right = w / 2;
        state.camera.top = h / 2;
        state.camera.bottom = -h / 2;
        state.camera.updateProjectionMatrix();
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = `${state.score1}  -  ${state.score2}`;
        state.hudMesh = createTextLabelMesh(text, { font: "48px Courier New", width: 300, height: 70 });
        state.hudMesh.position.set(0, GAME_CONST.WORLD_H/2 - 1.5, 0);
        state.scene.add(state.hudMesh);
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
        ctx.fillText(text, width / 2, height / 2);
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width/30, height/30),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
        );
        mesh.renderOrder = 10;
        return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeydown);
        window.removeEventListener('keyup', state.boundKeyup);
        window.removeEventListener('resize', state.boundResize);
        if (state.renderer) {
            const canvas = state.renderer.domElement;
            if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
            state.renderer.dispose();
            try { state.renderer.forceContextLoss(); } catch(e){}
        }
        if (state.scene) state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        state = null;
    };

    init();
})();
