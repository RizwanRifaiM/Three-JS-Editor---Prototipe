(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        COURT_W: 10, COURT_H: 23,
        PADDLE_W: 2.5, PADDLE_H: 0.4, PADDLE_D: 0.5,
        BALL_RADIUS: 0.15,
        PLAYER_SPEED: 0.2,
        GRAVITY: new THREE.Vector3(0, -0.012, 0),
        MAX_SCORE: 5,
        NET_HEIGHT: 0.5,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null;
        this.player = null; this.opponent = null; this.ball = null; this.net = null;
        this.ballVelocity = new THREE.Vector3();
        this.keys = {};
        this.playerScore = 0; this.opponentScore = 0;
        this.gameState = 'serve'; // serve | play | pointEnd | gameOver
        this.servingPlayer = 'player';
        this.lastHitBy = null;
        this.bounces = 0;

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeydown = null; this.boundKeyup = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Scene, Camera, Renderer
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x3d3d4d);
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.shadowMap.enabled = true;
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        // Lighting, Court, Objects
        addLights(state.scene);
        createCourt(state);
        createPaddles(state);
        createBall(state);
        
        state.camera.position.set(0, 4, GAME_CONST.COURT_H / 2 + 3);
        state.camera.lookAt(0, 0, 0);

        // Event Listeners
        state.boundKeydown = e => { onKeyDown(e, state); };
        state.boundKeyup = e => { state.keys[e.key] = false; };
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);

        resetGame(state, true);
        animate();
    }
    
    function resetGame(state, isFullReset = false) {
        if(isFullReset) {
            state.playerScore = 0;
            state.opponentScore = 0;
            state.servingPlayer = 'player';
        }
        state.gameState = 'pointEnd';
        clearOverlay(state);
        updateHUD(state);
        setTimeout(() => resetBall(state), 500);
    }
    
    function resetBall(state) {
        state.bounces = 0;
        state.lastHitBy = null;
        state.ball.position.y = 1;
        state.ballVelocity.set(0, 0, 0);

        if (state.servingPlayer === 'player') {
            state.ball.position.x = state.player.position.x;
            state.ball.position.z = state.player.position.z - GAME_CONST.PADDLE_D - state.ball.geometry.parameters.radius - 0.1;
            state.gameState = 'serve';
        } else {
            state.ball.position.x = state.opponent.position.x;
            state.ball.position.z = state.opponent.position.z + GAME_CONST.PADDLE_D + state.ball.geometry.parameters.radius + 0.1;
            state.ballVelocity.set((Math.random() - 0.5) * 0.1, 0.2, 0.3); // AI serves
            state.gameState = 'play';
        }
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;

        if (state.gameState === 'play') {
            state.ballVelocity.add(GAME_CONST.GRAVITY);
            state.ball.position.add(state.ballVelocity);
            handleCollisions(state);
        }
        
        if(state.gameState !== 'gameOver') {
            movePlayer(state);
            updateAI(state);
        }

        state.renderer.render(state.scene, state.camera);
    }

    function createCourt(state) {
        const court = new THREE.Mesh(
            new THREE.PlaneGeometry(GAME_CONST.COURT_W, GAME_CONST.COURT_H),
            new THREE.MeshStandardMaterial({ color: 0x008800 })
        );
        court.rotation.x = -Math.PI / 2;
        court.receiveShadow = true;
        state.scene.add(court);

        state.net = new THREE.Mesh(
            new THREE.BoxGeometry(GAME_CONST.COURT_W, GAME_CONST.NET_HEIGHT, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.8 })
        );
        state.net.position.y = GAME_CONST.NET_HEIGHT / 2;
        state.net.receiveShadow = true;
        state.scene.add(state.net);
    }
    
    function createPaddles(state) {
        const paddleGeo = new THREE.BoxGeometry(GAME_CONST.PADDLE_W, GAME_CONST.PADDLE_H, GAME_CONST.PADDLE_D);
        state.player = new THREE.Mesh(paddleGeo, new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        state.player.position.set(0, GAME_CONST.PADDLE_H / 2, GAME_CONST.COURT_H / 2 - 1);
        state.player.castShadow = true;
        
        state.opponent = state.player.clone();
        state.opponent.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        state.opponent.position.z = -GAME_CONST.COURT_H / 2 + 1;
        state.scene.add(state.player, state.opponent);
    }

    function createBall(state) {
        state.ball = new THREE.Mesh(
            new THREE.SphereGeometry(GAME_CONST.BALL_RADIUS, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xffff00 })
        );
        state.ball.castShadow = true;
        state.scene.add(state.ball);
    }
    
    function addLights(scene) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(5, 10, 7.5);
        light.castShadow = true;
        scene.add(light);
    }
    
    function onKeyDown(e, state) {
        state.keys[e.key] = true;
        if ((e.key === ' ' || e.key === 'Spacebar') && state.gameState === 'serve' && state.servingPlayer === 'player') {
            state.ballVelocity.set((Math.random() - 0.5) * 0.1, 0.2, -0.35);
            state.lastHitBy = 'player';
            state.bounces = 0;
            state.gameState = 'play';
        }
        if (e.key === 'Enter' && state.gameState === 'gameOver') {
            resetGame(state, true);
        }
    }
    
    function movePlayer(state) {
        const halfCourt = GAME_CONST.COURT_W / 2 - GAME_CONST.PADDLE_W / 2;
        if (state.keys['ArrowLeft'] || state.keys['a']) state.player.position.x -= GAME_CONST.PLAYER_SPEED;
        if (state.keys['ArrowRight'] || state.keys['d']) state.player.position.x += GAME_CONST.PLAYER_SPEED;
        state.player.position.x = THREE.MathUtils.clamp(state.player.position.x, -halfCourt, halfCourt);
    }

    function updateAI(state) {
        const reactionSpeed = 0.08;
        const targetX = state.ball.position.z > 0 ? 0 : state.ball.position.x;
        state.opponent.position.x += (targetX - state.opponent.position.x) * reactionSpeed;
    }

    function handleCollisions(state) {
        const ballR = GAME_CONST.BALL_RADIUS;
        const ballBox = new THREE.Box3().setFromObject(state.ball);
        const playerBox = new THREE.Box3().setFromObject(state.player);
        const opponentBox = new THREE.Box3().setFromObject(state.opponent);
        const netBox = new THREE.Box3().setFromObject(state.net);

        // Paddle hits
        if (ballBox.intersectsBox(playerBox) && state.ballVelocity.z < 0) {
            state.ballVelocity.z *= -1.05;
            state.ballVelocity.y = 0.22; state.lastHitBy = 'player'; state.bounces = 0;
        }
        if (ballBox.intersectsBox(opponentBox) && state.ballVelocity.z > 0) {
            state.ballVelocity.z *= -1.05;
            state.ballVelocity.y = 0.2; state.lastHitBy = 'opponent'; state.bounces = 0;
        }

        // Ground bounce
        if (state.ball.position.y <= ballR) {
            state.ball.position.y = ballR;
            state.ballVelocity.y *= -0.8;
            state.bounces++;
            if (state.bounces > 1) {
                handlePointEnd(state, state.ball.position.z > 0 ? 'opponent' : 'player');
            }
        }
        
        // Out of bounds / Net
        if (ballBox.intersectsBox(netBox)) handlePointEnd(state, state.lastHitBy === 'player' ? 'opponent' : 'player');
        if (Math.abs(state.ball.position.x) > GAME_CONST.COURT_W / 2 + ballR || Math.abs(state.ball.position.z) > GAME_CONST.COURT_H / 2 + ballR) {
            if (state.gameState === 'play') handlePointEnd(state, state.lastHitBy === 'player' ? 'opponent' : 'player');
        }
    }
    
    function handlePointEnd(state, winner) {
        if(state.gameState !== 'play') return;
        state.gameState = 'pointEnd';
        
        if (winner === 'player') state.playerScore++; else state.opponentScore++;
        
        state.servingPlayer = winner;
        updateHUD(state);

        if (state.playerScore >= GAME_CONST.MAX_SCORE || state.opponentScore >= GAME_CONST.MAX_SCORE) {
            handleEndGame(state, winner);
        } else {
            setTimeout(() => resetBall(state), 1000);
        }
    }
    
    function handleEndGame(state, winner) {
        state.gameState = 'gameOver';
        const msg = `${winner === 'player' ? 'You Win!' : 'You Lose!'}\n${state.playerScore} - ${state.opponentScore}\n\n[ENTER] to restart`;
        state.overlayMesh = createTextLabelMesh(msg, {
            font: "40px Courier New", align: "center", width: 600, height: 300, bg: "rgba(0,0,0,0.8)"
        });
        state.overlayMesh.position.copy(state.camera.position).add(new THREE.Vector3(0,-0.5,-5));
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
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = `${state.playerScore}  -  ${state.opponentScore}`;
        state.hudMesh = createTextLabelMesh(text, { font: "48px Courier New", width: 300, height: 70 });
        state.hudMesh.position.set(0, GAME_CONST.COURT_H / 2 - 4, -GAME_CONST.COURT_H / 2);
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
        const lines = text.split("\n"), lineH = height / lines.length;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], width / 2, lineH * (i + 0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width/150, height/150),
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
