(function () {
    // ========== PRIVATE SCOPE ==========
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        MAX_SPEED: 1.2, ACCEL: 0.015, TURN_SPEED: 0.045, STEER_ASSIST: 0.4, CAM_LAG: 0.05,
        FRICTION: 0.02, TRACK_FINISH_Z: -780,
    };
    
    function GameState() {
        this.scene = null; this.camera = null; this.renderer = null; this.clock = new THREE.Clock();
        this.player = { mesh: null, velocity: 0 };
        this.walls = [];
        this.keys = {};
        this.gameState = 'playing'; // playing, finished
        this.lapData = { startTime: 0, finishTime: 0, progress: 0 };

        this.hudMesh = null; this.overlayMesh = null;
        this.boundKeyDown = null; this.boundKeyUp = null; this.boundResize = null;
    }

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x87ceeb);
        state.scene.fog = new THREE.Fog(0x87ceeb, 100, 500);

        state.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);
        
        // Lights, Track, Player
        addLights(state.scene);
        buildTrack(state);
        createPlayer(state);

        // Event Listeners
        state.boundKeyDown = e => onKey(e, true);
        state.boundKeyUp = e => onKey(e, false);
        state.boundResize = () => onResize(state);
        window.addEventListener('keydown', state.boundKeyDown);
        window.addEventListener('keyup', state.boundKeyUp);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }
    
    function resetGame(state) {
        state.gameState = 'playing';
        state.lapData = { startTime: state.clock.getElapsedTime(), finishTime: 0, progress: 0 };
        state.player.velocity = 0;
        state.player.mesh.position.set(0, 0.3, 10);
        state.player.mesh.rotation.set(0, 0, 0);
        clearOverlay(state);
        updateHUD(state);
    }
    
    function animate() {
        loopId = requestAnimationFrame(animate);
        if(!state) return;
        
        const delta = Math.min(0.05, state.clock.getDelta());
        
        if (state.gameState === 'playing') {
            updatePlayer(state, delta);
            checkCollisions(state);
            updateLapProgress(state);
        } else if (state.gameState === 'finished') {
            if (state.keys['Enter'] || state.keys['KeyR']) resetGame(state);
        }

        updateCamera(state, delta);
        updateHUD(state);
        state.renderer.render(state.scene, state.camera);
    }

    function addLights(scene) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);
    }
    
    function createPlayer(state) {
        // Fallback box
        const carMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 3.5), new THREE.MeshStandardMaterial({color: 0xff4444}));
        carMesh.castShadow = true;
        
        state.player.mesh = new THREE.Group();
        state.player.mesh.add(carMesh)
        state.scene.add(state.player.mesh);

        // GLB Loader
        new THREE.GLTFLoader().load('f1.glb', (gltf) => {
            if (state && state.player) {
                state.player.mesh.remove(carMesh);
                const model = gltf.scene;
                model.scale.set(1,1,1);
                state.player.mesh.add(model);
            }
        }, undefined, (err) => { console.warn('GLTF load error:', err) });
    }

    function buildTrack(state) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 800), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        road.rotation.x = -Math.PI/2; road.position.z = -800/2 + 10;
        state.scene.add(road);

        const makeWall = (x,z,w,h,d) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color:0x4444aa}));
            wall.position.set(x, h/2, z);
            state.scene.add(wall);
            const box = new THREE.Box3().setFromObject(wall);
            state.walls.push({mesh: wall, box});
        }
        for (let i = 0; i < 15; i++) {
            makeWall(6, -i * 20 - 20, 1, 2, 8);
            makeWall(-6, -i * 20 - 20, 1, 2, 8);
        }
        const chicaneZ = -320;
        makeWall(-2, chicaneZ, 12, 2, 1);
        makeWall(2, chicaneZ - 20, 12, 2, 1);

        for(let i=0; i<20; ++i) {
            makeWall(15, -i * 20 + chicaneZ - 80, 1, 2, 8)
            makeWall(-15, -i * 20 + chicaneZ - 80, 1, 2, 8)
        }
        
        const finishLine = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 1), new THREE.MeshStandardMaterial({color:0xffffff}));
        finishLine.position.set(0, 0.1, GAME_CONST.TRACK_FINISH_Z);
        state.scene.add(finishLine);
    }
    
    function onKey(e, isDown) {
        const keyMap = {'w':'front', 's':'back', 'a':'left', 'd':'right', 'ArrowUp':'front', 'ArrowDown':'back', 'ArrowLeft':'left', 'ArrowRight':'right'};
        const action = keyMap[e.key];
        if(action) state.keys[action] = isDown;
        if(e.code) state.keys[e.code] = isDown;
    }

    function updatePlayer(state, delta) {
        const p = state.player;
        if (state.keys.front) p.velocity -= GAME_CONST.ACCEL * delta * 60;
        else if (state.keys.back) p.velocity += GAME_CONST.ACCEL * 0.7 * delta * 60;
        else {
            p.velocity += (p.velocity > 0 ? -GAME_CONST.FRICTION : GAME_CONST.FRICTION) * delta * 60;
            if(Math.abs(p.velocity) < 0.001) p.velocity = 0;
        }
        p.velocity = THREE.MathUtils.clamp(p.velocity, -GAME_CONST.MAX_SPEED, GAME_CONST.MAX_SPEED * 0.7);

        const speedFactor = Math.min(1, Math.abs(p.velocity) / GAME_CONST.MAX_SPEED);
        const turn = GAME_CONST.TURN_SPEED * (0.5 + 0.5 * speedFactor);
        if (Math.abs(p.velocity) > 0.001) {
            if(state.keys.left) p.mesh.rotation.y += turn * delta * 60 * (p.velocity > 0 ? -1:1);
            if(state.keys.right) p.mesh.rotation.y -= turn * delta * 60 * (p.velocity > 0 ? -1:1);
        }
        p.mesh.translateZ(p.velocity * delta * 60);
    }
    
    function checkCollisions(state) {
        const carBox = new THREE.Box3().setFromObject(state.player.mesh);
        for(const wall of state.walls) {
            if(carBox.intersectsBox(wall.box)) {
                const overlap = carBox.clone().intersect(wall.box);
                const overlapSize = new THREE.Vector3();
                overlap.getSize(overlapSize);
                
                const pushSignX = Math.sign(state.player.mesh.position.x - wall.mesh.position.x);
                const pushSignZ = Math.sign(state.player.mesh.position.z - wall.mesh.position.z);
                
                if (overlapSize.x < overlapSize.z) state.player.mesh.position.x += pushSignX * overlapSize.x;
                else state.player.mesh.position.z += pushSignZ * overlapSize.z;

                state.player.velocity *= -0.4;
                return;
            }
        }
    }

    function updateLapProgress(state) {
        state.lapData.progress = Math.max(0, Math.min(1, (10 - state.player.mesh.position.z) / (10 - GAME_CONST.TRACK_FINISH_Z)));
        if (state.lapData.progress >= 1 && state.lapData.finishTime === 0) {
            state.lapData.finishTime = state.clock.getElapsedTime() - state.lapData.startTime;
            handleEndGame(state);
        }
    }
    
    function handleEndGame(state) {
        state.gameState = 'finished';
        const timeStr = state.lapData.finishTime.toFixed(2);
        showOverlay(state, `Finished!\nTime: ${timeStr}s\n\n[ENTER] to restart`, true);
    }

    function updateCamera(state, delta) {
        const camOffset = new THREE.Vector3(0, 3.2, 6.5);
        const worldOffset = camOffset.clone().applyMatrix4(state.player.mesh.matrixWorld);
        const factor = 1 - Math.pow(1 - GAME_CONST.CAM_LAG, delta * 60);
        state.camera.position.lerp(worldOffset, factor);
        
        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(state.player.mesh.quaternion);
        const camTarget = state.player.mesh.position.clone().add(forward.multiplyScalar(4 + Math.abs(state.player.velocity)*10 * GAME_CONST.STEER_ASSIST));
        state.camera.lookAt(camTarget);
    }
    
    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function updateHUD(state) {
        if(state.hudMesh) state.camera.remove(state.hudMesh);
        const speed = (Math.abs(state.player.velocity) / GAME_CONST.MAX_SPEED * 280).toFixed(0);
        const progress = (state.lapData.progress * 100).toFixed(0);
        const time = (state.clock.getElapsedTime() - state.lapData.startTime).toFixed(1);
        const text = `Speed: ${speed} km/h\nTime: ${time}s\nProgress: ${progress}%`;
        state.hudMesh = createTextLabelMesh(text, { font: "24px Courier New", width: 400, height: 100, align: "left" });
        state.hudMesh.position.set(-state.camera.aspect * 2.5, 1.4, -4);
        state.camera.add(state.hudMesh);
    }

    function showOverlay(state, text, hasBg = true) {
        clearOverlay(state);
        const opts = { font: "48px Impact", width: 800, height: 300, ...(hasBg && {bg: 'rgba(0,0,0,0.7)'}) };
        state.overlayMesh = createTextLabelMesh(text, opts);
        state.overlayMesh.position.set(0, 0, -3);
        state.camera.add(state.overlayMesh);
    }

    function clearOverlay(state) {
        if (state.overlayMesh) {
            state.camera.remove(state.overlayMesh);
            disposeMesh(state.overlayMesh);
            state.overlayMesh = null;
        }
    }

    function disposeMesh(mesh) { if(mesh?.geometry) mesh.geometry.dispose(); if(mesh?.material) mesh.material.dispose(); }
    function createTextLabelMesh(text, opts) {
        const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
        const font = opts.font || "24px Arial", width = opts.width || 512, height = opts.height || 128;
        canvas.width = width; canvas.height = height; ctx.font = font;
        if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, width, height); }
        ctx.fillStyle = opts.color || "#fff"; ctx.textAlign = opts.align || "center"; ctx.textBaseline = "middle";
        const lines = text.split("\n"), lineH = height / lines.length;
        const x = opts.align === 'left' ? 20 : width/2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, lineH * (i + 0.5));
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
        window.removeEventListener('keydown', state.boundKeyDown);
        window.removeEventListener('keyup', state.boundKeyUp);
        window.removeEventListener('resize', state.boundResize);
        if(state.camera) {
            if(state.hudMesh) state.camera.remove(state.hudMesh);
            if(state.overlayMesh) state.camera.remove(state.overlayMesh);
        }
        if (state.renderer) {
            const canvas = state.renderer.domElement;
            if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
            state.renderer.dispose();
        }
        if (state.scene) state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
        state = null;
    };

    init();
})();
