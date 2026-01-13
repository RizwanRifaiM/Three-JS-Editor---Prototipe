(function () {
    // ========== PRIVATE SCOPE ==========
    let state = null;
    let loopId = null;

    // Game state
    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.box = null;

        // cleanup list
        this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Scene
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x111111);

        // Camera
        state.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        state.camera.position.z = 5;

        // Renderer
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);

        // Game Objects
        state.box = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1), // Ukuran disamakan dengan basic.js agar konsisten
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        state.scene.add(state.box);

        // Event Listeners
        state.boundResize = () => onResize(state);
        window.addEventListener('resize', state.boundResize);

        // Start loop
        animate();
    }

    function animate() {
        loopId = requestAnimationFrame(animate);

        if (!state) return;

        state.box.rotation.x += 0.01;
        state.box.rotation.y += 0.01;

        state.renderer.render(state.scene, state.camera);
    }

    function onResize(state) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function disposeMesh(mesh) {
        if (!mesh) return;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
        }
    }

    // =============== EXPORT DESTROY HANDLER ===============
    window.__GAME_DESTROY = function () {
        if (!state) return;

        if (loopId) cancelAnimationFrame(loopId);
        
        // Hapus event listener
        if (state.boundResize) window.removeEventListener('resize', state.boundResize);

        // Hapus renderer
        if (state.renderer) {
            if (state.renderer.domElement?.parentNode) {
                state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
            }
            state.renderer.dispose();
            try { state.renderer.forceContextLoss(); } catch(e){}
            state.renderer = null;
        }

        // Hapus semua object dari scene
        if (state.scene) {
            state.scene.traverse(obj => {
                if (obj.isMesh) disposeMesh(obj);
            });
        }

        // Hapus state
        state = null;
    };

    // Start
    init();
})();
