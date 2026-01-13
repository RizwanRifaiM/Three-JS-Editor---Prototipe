(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRID_SIZE: 14, // Bounded box is from -7 to 7
        GAME_SPEED_MS: 150, // ms per step
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.snake = []; this.food = null;
        this.direction = new THREE.Vector3(1, 0, 0);
        this.nextDirection = new THREE.Vector3(1, 0, 0);
        this.keys = {};
        this.score = 0; this.lastStepTime = 0;
        this.gameState = 'playing'; // playing | game_over

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x171e30);
        
        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        state.scene.add(new THREE.AmbientLight(0x808080));
        state.scene.add(new THREE.PointLight(0xffffff, 1, 100).position.set(0,10,0));

        const cage = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.GRID_SIZE, GAME_CONST.GRID_SIZE, GAME_CONST.GRID_SIZE), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2 }));
        state.scene.add(cage);

        state.boundKeyDown = e => onKeyDown(e, state);
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing'; state.score = 0; state.lastStepTime = 0;
        
        state.snake.forEach(s => state.scene.remove(s));
        state.snake = [];
        if(state.food) state.scene.remove(state.food);
        state.food = null;

        state.direction.set(1, 0, 0); state.nextDirection.set(1, 0, 0);

        const startPos = new THREE.Vector3(-2, 0, 0);
        for (let i = 0; i < 3; i++) {
            const pos = startPos.clone().sub(state.direction.clone().multiplyScalar(i));
            state.snake.push(createSegment(state, pos));
        }
        
        spawnFood(state);
        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        const elapsedTime = state.clock.getElapsedTime();

        if (state.gameState === 'playing' && elapsedTime > state.lastStepTime + (GAME_CONST.GAME_SPEED_MS/1000)) {
            state.lastStepTime = elapsedTime;
            updateGame(state);
            updateHUD(state);
        } else if (state.gameState === 'game_over') {
            if(state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
        }
        
        updateCamera(state, elapsedTime);
        state.renderer.render(state.scene, state.camera);
    }

    function createSegment(state, pos) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        state.scene.add(mesh);
        return mesh;
    }

    function spawnFood(state) {
        if (state.food) state.scene.remove(state.food);
        let pos = new THREE.Vector3();
        const halfGrid = GAME_CONST.GRID_SIZE / 2 - 1;
        
        do {
            pos.set(
                THREE.MathUtils.randInt(-halfGrid, halfGrid),
                THREE.MathUtils.randInt(-halfGrid, halfGrid),
                THREE.MathUtils.randInt(-halfGrid, halfGrid)
            );
        } while (state.snake.some(s => s.position.equals(pos)));
        
        state.food = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x441111 }));
        state.food.position.copy(pos);
        state.scene.add(state.food);
    }
    
    function updateGame(state) {
        if (!state.direction.equals(state.nextDirection) && !state.direction.clone().negate().equals(state.nextDirection)) {
            state.direction.copy(state.nextDirection);
        }

        const newHeadPos = state.snake[0].position.clone().add(state.direction);
        
        const halfGrid = GAME_CONST.GRID_SIZE / 2;
        if (Math.abs(newHeadPos.x) >= halfGrid || Math.abs(newHeadPos.y) >= halfGrid || Math.abs(newHeadPos.z) >= halfGrid) {
            handleEndGame(state); return;
        }
        if (state.snake.some(s => s.position.equals(newHeadPos))) {
            handleEndGame(state); return;
        }

        const ateFood = newHeadPos.equals(state.food.position);
        
        const newHead = createSegment(state, newHeadPos);
        newHead.material.color.setHex(0x33ff33);
        state.snake[0].material.color.setHex(0x00ff00);
        state.snake.unshift(newHead);

        if (ateFood) {
            state.score += 10;
            spawnFood(state);
        } else {
            const tail = state.snake.pop();
            state.scene.remove(tail);
        }
    }

    function onKeyDown(e, state) {
        state.keys[e.code] = true;
        const currentDir = state.direction;
        const newDir = state.nextDirection.clone();

        if (e.code === 'KeyW' && currentDir.z === 0) newDir.set(0, 0, -1);
        else if (e.code === 'KeyS' && currentDir.z === 0) newDir.set(0, 0, 1);
        else if (e.code === 'KeyA' && currentDir.x === 0) newDir.set(-1, 0, 0);
        else if (e.code === 'KeyD' && currentDir.x === 0) newDir.set(1, 0, 0);
        else if (e.code === 'KeyQ' && currentDir.y === 0) newDir.set(0, 1, 0);
        else if (e.code === 'KeyE' && currentDir.y === 0) newDir.set(0, -1, 0);
        
        state.nextDirection.copy(newDir);
    }

    function handleEndGame(state) {
        if(state.isGameOver) return;
        state.isGameOver = true;
        showOverlay(state, `GAME OVER\nScore: ${state.score}\n\n[ENTER] to restart`, true);
    }

    function updateCamera(state, time) {
        const dist = 18;
        state.camera.position.set(
            Math.sin(time * 0.1) * dist,
            10,
            Math.cos(time * 0.1) * dist
        );
        state.camera.lookAt(0,0,0);
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        state.hudMesh = createTextLabelMesh(`Score: ${state.score}`, { font: "24px Courier New", width: 300, height: 50, align: "right" });
        state.hudMesh.position.set(state.camera.aspect * 10 - 2.5, 9, -1);
        state.scene.add(state.hudMesh);
    }

    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:"32px Courier New", align:"center", width:500,height:250,...(bg&&{bg:'rgba(0,0,0,0.8)'})}); state.overlayMesh.position.z=5; state.scene.add(state.overlayMesh); } function clearOverlay(state) { if(state.overlayMesh) { state.scene.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } } function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); } function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font=opts.font||"24px Arial", w=opts.width||512, h=opts.height||128;
        canvas.width=w; canvas.height=h; ctx.font=font;
        if(opts.bg){ctx.fillStyle=opts.bg; ctx.fillRect(0,0,w,h);}
        ctx.fillStyle=opts.color||"#fff"; ctx.textAlign=opts.align||"center"; ctx.textBaseline="middle";
        const lines=text.split("\n"), lH=h/lines.length, x=opts.align==='left'?20:w/2;
        for(let i=0; i<lines.length; i++) ctx.fillText(lines[i], x, lH*(i+0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/25, h/25), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
        mesh.renderOrder=10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) { if(state.hudMesh) state.camera.remove(state.hudMesh); }
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();