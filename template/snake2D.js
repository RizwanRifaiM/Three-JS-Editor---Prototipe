(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_W: 20, WORLD_H: 15, CELL_SIZE: 1,
        SNAKE_SPEED: 0.15, // time in seconds per move
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.snake = []; this.food = null;
        this.direction = new THREE.Vector2(1, 0); // initial right
        this.nextDirection = new THREE.Vector2(1, 0);
        this.lastMoveTime = 0;
        this.score = 0;
        this.isGameOver = false;

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x3a5a3a);

        state.camera = new THREE.OrthographicCamera(-GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_W/2, GAME_CONST.WORLD_H/2, -GAME_CONST.WORLD_H/2, 0.1, 100);
        state.camera.position.z = 10;
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        state.scene.add(new THREE.DirectionalLight(0xffffff, 0.4).position.set(5,10,5));

        state.boundKeyDown = e => onKeyDown(e, state);
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.isGameOver = false; state.score = 0;
        state.direction.set(1, 0); state.nextDirection.set(1, 0);
        state.lastMoveTime = state.clock.getElapsedTime();
        
        state.snake.forEach(s => state.scene.remove(s));
        state.snake = [];
        if (state.food) state.scene.remove(state.food);
        state.food = null;
        
        createSnake(state);
        spawnFood(state);
        
        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        if (state.isGameOver) {
            if (state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
        } else {
            const currentTime = state.clock.getElapsedTime();
            if (currentTime - state.lastMoveTime > GAME_CONST.SNAKE_SPEED) {
                state.lastMoveTime = currentTime;
                state.direction.copy(state.nextDirection);
                updateGame(state);
                updateHUD(state);
            }
        }
        state.renderer.render(state.scene, state.camera);
    }
    
    function createSnake(state) {
        const head = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.CELL_SIZE,GAME_CONST.CELL_SIZE,GAME_CONST.CELL_SIZE), new THREE.MeshBasicMaterial({color:0x00ff00}));
        head.position.set(0,0,0);
        state.snake.push(head);
        state.scene.add(head);
        for(let i=1; i<3; ++i) {
            const segment = new THREE.Mesh(new THREE.BoxGeometry(GAME_CONST.CELL_SIZE,GAME_CONST.CELL_SIZE,GAME_CONST.CELL_SIZE), new THREE.MeshBasicMaterial({color:0x00cc00}));
            segment.position.set(-i * GAME_CONST.CELL_SIZE, 0, 0);
            state.snake.push(segment);
            state.scene.add(segment);
        }
    }

    function spawnFood(state) {
        if (state.food) state.scene.remove(state.food);
        let foodX, foodY;
        do {
            foodX = Math.floor(Math.random() * GAME_CONST.WORLD_W / GAME_CONST.CELL_SIZE) * GAME_CONST.CELL_SIZE - (GAME_CONST.WORLD_W/2 - GAME_CONST.CELL_SIZE/2);
            foodY = Math.floor(Math.random() * GAME_CONST.WORLD_H / GAME_CONST.CELL_SIZE) * GAME_CONST.CELL_SIZE - (GAME_CONST.WORLD_H/2 - GAME_CONST.CELL_SIZE/2);
        } while (state.snake.some(s => s.position.x === foodX && s.position.y === foodY));

        state.food = new THREE.Mesh(new THREE.SphereGeometry(GAME_CONST.CELL_SIZE/2, 8, 8), new THREE.MeshBasicMaterial({color:0xff0000}));
        state.food.position.set(foodX, foodY, 0);
        state.scene.add(state.food);
    }
    
    function updateGame(state) {
        const head = state.snake[0];
        const newHeadPos = new THREE.Vector3(
            head.position.x + state.direction.x * GAME_CONST.CELL_SIZE,
            head.position.y + state.direction.y * GAME_CONST.CELL_SIZE,
            0
        );

        // Wall collision
        const halfW = GAME_CONST.WORLD_W/2, halfH = GAME_CONST.WORLD_H/2;
        if (Math.abs(newHeadPos.x) >= halfW || Math.abs(newHeadPos.y) >= halfH) {
            handleEndGame(state); return;
        }

        // Self collision
        if (state.snake.some((s, i) => i > 0 && s.position.equals(newHeadPos))) {
            handleEndGame(state); return;
        }

        // Move snake
        const newHead = head.clone();
        newHead.position.copy(newHeadPos);
        state.snake.unshift(newHead);
        state.scene.add(newHead);

        // Food collision
        if (newHeadPos.equals(state.food.position)) {
            state.score += 10;
            state.scene.remove(state.food);
            spawnFood(state);
        } else {
            const tail = state.snake.pop();
            state.scene.remove(tail);
        }
        state.scene.remove(head);
        state.snake[0] = newHead;
    }

    function onKeyDown(e, state) {
        state.keys[e.code] = true;
        const currentDir = state.direction;
        const newDir = state.nextDirection.clone();

        if (e.code === 'ArrowUp' && currentDir.y === 0) newDir.set(0, 1);
        else if (e.code === 'ArrowDown' && currentDir.y === 0) newDir.set(0, -1);
        else if (e.code === 'ArrowLeft' && currentDir.x === 0) newDir.set(-1, 0);
        else if (e.code === 'ArrowRight' && currentDir.x === 0) newDir.set(1, 0);
        
        if (!newDir.equals(currentDir) && !newDir.equals(currentDir.clone().negate())) {
            state.nextDirection.copy(newDir);
        }
    }

    function handleEndGame(state) {
        if(state.isGameOver) return;
        state.isGameOver = true;
        showOverlay(state, `GAME OVER\nScore: ${state.score}\n\n[ENTER] to restart`, true);
    }
    
    function onResize(state) {
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        const aspect = window.innerWidth / window.innerHeight;
        const targetAspect = GAME_CONST.WORLD_W / GAME_CONST.WORLD_H;
        
        let w = GAME_CONST.WORLD_W, h = GAME_CONST.WORLD_H;
        if(aspect > targetAspect) w = h * aspect;
        else h = w / aspect;
        
        state.camera.left = -w / 2; state.camera.right = w / 2;
        state.camera.top = h / 2; state.camera.bottom = -h / 2;
        state.camera.updateProjectionMatrix();
    }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.scene.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        state.hudMesh = createTextLabelMesh(`Score: ${state.score}`, { font: "24px Courier New", width: 300, height: 50, align: "left" });
        const cam = state.camera;
        state.hudMesh.position.set(cam.left + 2.5, cam.top - 1.5, 0);
        state.scene.add(state.hudMesh);
    }

    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:"32px Courier New", align:"center", width:500,height:250,...(bg&&{bg:'rgba(0,0,0,0.8)'})}); state.overlayMesh.position.z=5; state.scene.add(state.overlayMesh); }
    function clearOverlay(state) { if(state.overlayMesh) { state.scene.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
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
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();