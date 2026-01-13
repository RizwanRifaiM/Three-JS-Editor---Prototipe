(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        GRAVITY: -0.035, JUMP_FORCE: 0.82, PLAYER_X_POS: -8.5, GROUND_Y: -4.0,
        INITIAL_GAME_SPEED: 0.16, GAME_SPEED_ACCEL: 0.00007,
        MIN_OBSTACLE_DIST: 6, MAX_OBSTACLE_DIST: 14,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null;
        this.player = null; this.ground = null; this.clouds = [];
        this.entities = []; // obstacles
        this.keys = {};
        this.score = 0; this.gameSpeed = 0;
        this.isGameOver = false;
        this.nextObstacleX = 13;

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
    }

    // --- GEOMETRY FACTORIES (moved for clarity) ---
    const createTrexMesh = () => { const g = new THREE.Group(); const m = (c, w, h, d) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color: c})); g.add(m(0x959393, 0.95, 0.6, 0.5).translateY(0.38), m(0xb4b4b4, 0.4, 0.3, 0.5).translateX(0.35).translateY(0.68), m(0x726f6f, 0.2, 0.25, 0.2).translateX(0.19).translateY(0.07).translateZ(0.12), m(0x726f6f, 0.18, 0.22, 0.18).translateX(-0.13).translateY(0.05).translateZ(-0.1), m(0xb4b4b4, 0.26, 0.18, 0.12).translateX(-0.47).translateY(0.32), m(0x222, 0.05, 0.05, 0.05).translateX(0.5).translateY(0.76).translateZ(0.15)); return g; };
    const createCactusMesh = () => { const g = new THREE.Group(), t = 0.75+Math.random()*1.1, m=(c,w,h,d)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c})); g.add(m(0x47bd51,0.18,t,0.18).translateY(t/2)); if(Math.random()<0.6){ g.add(m(0x33963a,0.09,0.38+Math.random()*0.23,0.09).translateX(-0.16).translateY(t-0.22)); g.add(m(0x33963a,0.09,0.38+Math.random()*0.23,0.09).translateX(0.16).translateY(t-0.22));} return g; };
    const createCloudMesh = () => { const g = new THREE.Group(); for(let i=0;i<3;++i){ const c=new THREE.Mesh(new THREE.SphereGeometry(0.4+0.2*Math.random(),8,8),new THREE.MeshBasicMaterial({color:0xffffff})); c.position.set(i*0.55,0,(Math.random()-0.5)*0.2); g.add(c);} return g;};

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0xf7f7f7);
        
        state.camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
        state.camera.position.z = 10;
        
        state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        state.renderer.setClearColor(0xf7f7f7);
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.95));
        const dl = new THREE.DirectionalLight(0xffffff, 0.17);
        dl.position.set(8, 20, 10); state.scene.add(dl);
        
        state.ground = new THREE.Mesh(new THREE.BoxGeometry(100, 1, 1), new THREE.MeshStandardMaterial({ color: 0xd1d1d1 }));
        state.ground.position.y = GAME_CONST.GROUND_Y - 0.5;
        state.scene.add(state.ground);
        
        state.player = createTrexMesh();
        state.player.userData = { velocity: new THREE.Vector2(0,0), isOnGround: true };
        state.scene.add(state.player);

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
        state.isGameOver = false; state.score = 0;
        state.gameSpeed = GAME_CONST.INITIAL_GAME_SPEED;
        state.nextObstacleX = 13;
        
        state.player.position.set(GAME_CONST.PLAYER_X_POS, GAME_CONST.GROUND_Y, 0);
        state.player.userData.velocity.set(0,0);
        state.player.userData.isOnGround = true;

        state.entities.forEach(e => state.scene.remove(e)); state.entities = [];
        state.clouds.forEach(c => state.scene.remove(c.mesh)); state.clouds = [];
        
        clearOverlay(state);
        updateHUD(state);
    }

    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        if (state.isGameOver) {
            if(state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
        } else {
            updatePlayer(state);
            spawnEntities(state);
            updateWorld(state);
            handleCollisions(state);
            updateHUD(state);
        }
        state.renderer.render(state.scene, state.camera);
    }
    
    function spawnEntities(state) {
        if (state.entities.length < 5 && state.nextObstacleX < 30) {
            const cactus = createCactusMesh();
            cactus.position.set(state.nextObstacleX, GAME_CONST.GROUND_Y + 0.01, 0);
            cactus.userData.type = "obstacle";
            state.entities.push(cactus);
            state.scene.add(cactus);
            state.nextObstacleX += GAME_CONST.MIN_OBSTACLE_DIST + Math.random()*(GAME_CONST.MAX_OBSTACLE_DIST-GAME_CONST.MIN_OBSTACLE_DIST);
        }
        if (Math.random() < 0.007 && state.clouds.length < 5) {
            const c = { mesh: createCloudMesh(), speed: 0.035 + Math.random()*0.07 };
            c.mesh.position.set(14+Math.random()*4, 3+(Math.random()*3), -2-Math.random());
            state.scene.add(c.mesh);
            state.clouds.push(c);
        }
    }

    function updatePlayer(state) {
        state.player.userData.velocity.y += GAME_CONST.GRAVITY;
        state.player.position.y += state.player.userData.velocity.y;
        if (state.player.position.y <= GAME_CONST.GROUND_Y) {
            state.player.position.y = GAME_CONST.GROUND_Y;
            state.player.userData.velocity.y = 0;
            state.player.userData.isOnGround = true;
        }
        if((state.keys['Space'] || state.keys['ArrowUp']) && state.player.userData.isOnGround) {
            state.player.userData.velocity.y = GAME_CONST.JUMP_FORCE;
            state.player.userData.isOnGround = false;
        }
    }

    function updateWorld(state) {
        state.gameSpeed += GAME_CONST.GAME_SPEED_ACCEL;
        state.score += Math.round(state.gameSpeed * 10);
        state.nextObstacleX -= state.gameSpeed;

        for(let i=state.entities.length-1; i>=0; i--){
            const ent = state.entities[i];
            ent.position.x -= state.gameSpeed;
            if (ent.position.x < -15) {
                state.scene.remove(ent);
                state.entities.splice(i, 1);
            }
        }
        for(let i=state.clouds.length-1; i>=0; i--){
            const cloud = state.clouds[i];
            cloud.mesh.position.x -= cloud.speed;
            if(cloud.mesh.position.x < -20){
                state.scene.remove(cloud.mesh);
                state.clouds.splice(i, 1);
            }
        }
    }

    function handleCollisions(state) {
        const playerBox = new THREE.Box3().setFromObject(state.player);
        for (const entity of state.entities) {
            if (playerBox.intersectsBox(new THREE.Box3().setFromObject(entity))) {
                handleEndGame(state);
                return;
            }
        }
    }

    function handleEndGame(state) {
        if(state.isGameOver) return;
        state.isGameOver = true;
        showOverlay(state, `GAME OVER\nFinal Score: ${state.score}\n\n[ENTER] to restart`, true);
    }
    
    function onResize(state) {
        const aspect = window.innerWidth / window.innerHeight;
        state.camera.left = -12 * aspect; state.camera.right = 12 * aspect;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updateHUD(state) {
        if(state.hudMesh) { state.camera.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        state.hudMesh = createTextLabelMesh(`Score: ${state.score}`, { font: "24px Courier New", width: 400, height: 50, align: "right" });
        const aspect = window.innerWidth / window.innerHeight;
        state.hudMesh.position.set(12 * aspect - 3, 8, -1);
        state.camera.add(state.hudMesh);
    }

    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:"32px Courier New", align:"center", width:500,height:250, ...(bg&&{bg:'rgba(0,0,0,0.7)'})}); state.overlayMesh.position.set(0,0,5); state.scene.add(state.overlayMesh); } 
    function clearOverlay(state) { if(state.overlayMesh) { state.scene.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font = opts.font||"24px Arial", w=opts.width||512, h=opts.height||128;
        canvas.width=w; canvas.height=h; ctx.font = font;
        if(opts.bg){ctx.fillStyle=opts.bg; ctx.fillRect(0,0,w,h);}
        ctx.fillStyle=opts.color||"#fff"; ctx.textAlign=opts.align||"center"; ctx.textBaseline="middle";
        const lines = text.split("\n"), lH = h / lines.length, x=opts.align==='left'?20:opts.align==='right'?w-20:w/2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, lH * (i + 0.5));
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/25,h/25), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
        mesh.renderOrder=10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) { if(state.hudMesh) state.camera.remove(state.hudMesh); }
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();