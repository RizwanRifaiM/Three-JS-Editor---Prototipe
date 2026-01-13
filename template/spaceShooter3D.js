(function () {
    // ========== PRIVATE SCOPE ========== 
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        THRUST: 0.1, MAX_SPEED: 3.0, TURN_SPEED: 0.005, ROLL_SPEED: 0.05, DRAG: 0.98,
        FIRE_RATE: 200, BULLET_SPEED: 1, ENEMY_SPEED: 0.05, ENEMY_COUNT: 10,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.player = null; this.bullets = []; this.enemies = []; this.stars = [];
        this.keys = {}; this.mouse = new THREE.Vector2();
        this.gameState = 'playing'; // playing | game_over

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundMouseMove = null;
        this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x000011);
        state.scene.fog = new THREE.Fog(0x000011, 50, 150);

        state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        addLights(state.scene);
        
        state.player = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 8), new THREE.MeshStandardMaterial({color: 0x00ff00, metalness: 0.2, roughness: 0.6}));
        state.player.userData = { velocity: new THREE.Vector3(), health: 100, score: 0, lastShot: 0 };
        state.scene.add(state.player);
        
        createStars(state);

        state.boundKeyDown = e => { state.keys[e.code] = true; };
        state.boundKeyUp = e => { state.keys[e.code] = false; };
        state.boundMouseMove = e => { state.mouse.x = (e.clientX/window.innerWidth)*2-1; state.mouse.y = -(e.clientY/window.innerHeight)*2+1; };
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('keyup', state.boundKeyUp);
        window.addEventListener('mousemove', state.boundMouseMove);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing';
        state.player.userData.health = 100;
        state.player.userData.score = 0;
        state.player.position.set(0, 0, 0);
        state.player.quaternion.set(0,0,0,1);
        state.player.userData.velocity.set(0,0,0);
        
        state.enemies.forEach(e => state.scene.remove(e)); state.enemies = [];
        state.bullets.forEach(b => state.scene.remove(b)); state.bullets = [];

        for (let i = 0; i < GAME_CONST.ENEMY_COUNT; i++) spawnEnemy(state);
        
        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        if(state.gameState === 'playing') {
            updatePlayer(state);
            updateEntities(state);
            handleCollisions(state);
            updateCamera(state);
            updateHUD(state);
        } else if (state.keys['KeyR'] || state.keys['Enter']) {
            resetGame(state);
        }
        
        state.renderer.render(state.scene, state.camera);
    }

    function addLights(scene) { scene.add(new THREE.AmbientLight(0xffffff,0.5)); const l=new THREE.DirectionalLight(0xffffff,0.8); l.position.set(10,10,10); scene.add(l); }
    function createStars(state) {
        for (let i = 0; i < 500; i++) {
            const star = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({color: 0xffffff}));
            star.position.set((Math.random()-0.5)*200, (Math.random()-0.5)*200, (Math.random()-0.5)*200);
            state.stars.push(star); state.scene.add(star);
        }
    }
    
    function updatePlayer(state) {
        const pData = state.player.userData;
        state.player.rotateY(-state.mouse.x * GAME_CONST.TURN_SPEED);
        state.player.rotateX(-state.mouse.y * GAME_CONST.TURN_SPEED);
        if (state.keys['KeyA']) state.player.rotateZ(GAME_CONST.ROLL_SPEED);
        if (state.keys['KeyD']) state.player.rotateZ(-GAME_CONST.ROLL_SPEED);

        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(state.player.quaternion);
        let thrust = 0;
        if (state.keys['KeyW']) thrust = GAME_CONST.THRUST;
        if (state.keys['KeyS']) thrust = -GAME_CONST.THRUST;
        
        pData.velocity.add(forward.multiplyScalar(thrust));
        pData.velocity.multiplyScalar(GAME_CONST.DRAG);
        pData.velocity.clampLength(0, GAME_CONST.MAX_SPEED);
        state.player.position.add(pData.velocity);

        if (state.keys['Space'] && state.clock.getElapsedTime() > pData.lastShot + (GAME_CONST.FIRE_RATE/1000)) {
            pData.lastShot = state.clock.getElapsedTime();
            const bulletDir = new THREE.Vector3(0,0,-1).applyQuaternion(state.player.quaternion);
            const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color:0xffff00}));
            bullet.position.copy(state.player.position).add(bulletDir.multiplyScalar(1.5));
            bullet.userData.velocity = bulletDir.multiplyScalar(GAME_CONST.BULLET_SPEED).add(pData.velocity);
            state.bullets.push(bullet); state.scene.add(bullet);
        }
    }

    function spawnEnemy(state) {
        const enemy = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({color:0xff0000}));
        const dist = 30 + Math.random()*50;
        const angle1 = Math.random()*Math.PI*2, angle2 = Math.random()*Math.PI*2;
        enemy.position.set(Math.sin(angle1)*Math.cos(angle2)*dist, Math.sin(angle1)*Math.sin(angle2)*dist, Math.cos(angle1)*dist);
        state.enemies.push(enemy); state.scene.add(enemy);
    }

    function updateEntities(state) {
        state.enemies.forEach(e => {
            const dir = state.player.position.clone().sub(e.position).normalize();
            e.position.add(dir.multiplyScalar(GAME_CONST.ENEMY_SPEED));
        });
        for (let i = state.bullets.length-1; i >= 0; i--) {
            const b = state.bullets[i]; b.position.add(b.userData.velocity);
            if(b.position.distanceTo(state.player.position) > 150) { state.scene.remove(b); state.bullets.splice(i,1); }
        }
    }

    function handleCollisions(state) {
        for (let i = state.bullets.length-1; i>=0; i--) for (let j = state.enemies.length-1; j>=0; j--) {
            if (state.bullets[i] && state.enemies[j] && state.bullets[i].position.distanceTo(state.enemies[j].position) < 1.0) {
                state.scene.remove(state.enemies[j]); state.enemies.splice(j,1); state.scene.remove(state.bullets[i]); state.bullets.splice(i,1);
                state.player.userData.score+=10; spawnEnemy(state); break;
            }
        }
        for (let i = state.enemies.length-1; i>=0; i--) {
            if (state.player.position.distanceTo(state.enemies[i].position) < 1.2) {
                state.player.userData.health-=10; state.scene.remove(state.enemies[i]); state.enemies.splice(i,1);
                if (state.player.userData.health <= 0) { handleEndGame(state); return; }
                spawnEnemy(state);
            }
        }
    }

    function updateCamera(state) {
        const offset = new THREE.Vector3(0,2,5); offset.applyQuaternion(state.player.quaternion); offset.add(state.player.position);
        state.camera.position.lerp(offset, 0.1);
        const lookAtTarget = state.player.position.clone().add(state.player.userData.velocity.clone().multiplyScalar(5));
        state.camera.lookAt(lookAtTarget);
    }
    
    function handleEndGame(state) {
        if(state.gameState === 'game_over') return;
        state.gameState = 'game_over';
        showOverlay(state, 'GAME OVER\nScore: ' + state.player.userData.score + '\n\n[ENTER] to restart', true);
    }
    
    function onResize(state) { state.camera.aspect = window.innerWidth/window.innerHeight; state.camera.updateProjectionMatrix(); state.renderer.setSize(window.innerWidth,window.innerHeight); }
    
    function updateHUD(state) {
        if(state.hudMesh) { state.camera.remove(state.hudMesh); disposeMesh(state.hudMesh); }
        const text = 'Health: ' + state.player.userData.health + '\nScore: ' + state.player.userData.score;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 400, height: 70, align: "left" });
        state.hudMesh.position.set(-state.camera.aspect * 2.5, 2.3, -4);
        state.camera.add(state.hudMesh);
    }

    function showOverlay(state, text, bg) { clearOverlay(state); state.overlayMesh = createTextLabelMesh(text, {font:'32px Courier New', align:'center', width:500,height:250,...(bg&&{bg:'rgba(0,0,0,0.7)'})}); state.overlayMesh.position.set(0,0,-5); state.camera.add(state.overlayMesh); }
    function clearOverlay(state) { if(state.overlayMesh) { state.camera.remove(state.overlayMesh); disposeMesh(state.overlayMesh); state.overlayMesh = null; } }
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
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w/100,h/100), new THREE.MeshBasicMaterial({map:tex,transparent:true}));
        mesh.renderOrder=10; return mesh;
    }

    window.__GAME_DESTROY = function () {
        if (!state) return;
        if (loopId) cancelAnimationFrame(loopId);
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('mousemove', state.boundMouseMove);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) { if(state.hudMesh) state.camera.remove(state.hudMesh); if(state.overlayMesh) state.camera.remove(state.overlayMesh); }
        if (state.renderer) { const c=state.renderer.domElement; if(c?.parentNode) c.parentNode.removeChild(c); state.renderer.dispose(); }
        if (state.scene) state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        state = null;
    };

    init();
})();