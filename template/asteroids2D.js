(function () {
    // ========== PRIVATE SCOPE ==========
    // Semua variabel game disini private
    let state = null;
    let loopId = null;

    const GAME_CONST = {
        WORLD_WIDTH: 40,
        WORLD_HEIGHT: 30,
        PLAYER_SPEED: 0.01,
        PLAYER_TURN_SPEED: 0.05,
        PLAYER_FRICTION: 0.99,
        BULLET_SPEED: 0.3,
        BULLET_LIFETIME: 60,
        ASTEROID_COUNT_INIT: 5,
        ASTEROID_SPEED_MAX: 0.1,
        INVINCIBILITY_TIME: 120
    };

    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.bullets = [];
        this.asteroids = [];
        this.keys = {};
        this.score = 0;
        this.lives = 3;
        this.isGameOver = false;
        this.lastShotTime = 0;
        this.playerInvincible = 0;
        this.hudMesh = null;
        this.gameOverMesh = null;

        // cleanup list
        this.boundKeydown = null;
        this.boundKeyup = null;
        this.boundResize = null;
    }

    function init() {
        state = new GameState();

        // Scene
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x000000);

        state.camera = new THREE.OrthographicCamera(
            -GAME_CONST.WORLD_WIDTH / 2, GAME_CONST.WORLD_WIDTH / 2,
            GAME_CONST.WORLD_HEIGHT / 2, -GAME_CONST.WORLD_HEIGHT / 2,
            0.1, 100
        );
        state.camera.position.z = 10;

        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);

        document.getElementById("game-canvas-container").appendChild(state.renderer.domElement);

        // event listeners (with stored reference for removal)
        state.boundKeydown = e => { state.keys[e.code] = true; };
        state.boundKeyup = e => { state.keys[e.code] = false; };
        state.boundResize = () => onResize(state);

        window.addEventListener('keydown', state.boundKeydown);
        window.addEventListener('keyup', state.boundKeyup);
        window.addEventListener('resize', state.boundResize);

        resetGame(state);
        animate();
    }

    function animate() {
        loopId = requestAnimationFrame(animate);

        if (!state) return;

        if (state.isGameOver) {
            if (state.keys["Enter"]) resetGame(state);
        } else {
            updatePlayer(state);
            updateBullets(state);
            updateAsteroids(state);
            checkCollisions(state);
            updateHUD(state);

            if (state.asteroids.length === 0) {
                spawnAsteroids(state, GAME_CONST.ASTEROID_COUNT_INIT + 2, 3);
            }
        }

        state.renderer.render(state.scene, state.camera);
    }

    // ————————— REST OF GAME CODE SAME —————————
    // (semua fungsi original kamu tetap sama)
    // Hanya dipertahankan penuh, tidak ada global variable
    // ------------------------------------------------------

    // ======================
    // ALL your game functions ↓↓↓
    // (Full original code tetap disini tanpa perubahan logika)
    // Identik dengan kode mu, hanya tidak aku pangkas agar kamu bisa paste 1:1
    // ======================

    function resetGame(state) {
        state.bullets.forEach(b => state.scene.remove(b.mesh));
        state.asteroids.forEach(a => state.scene.remove(a.mesh));
        state.bullets = [];
        state.asteroids = [];

        if (state.hudMesh) {
            state.scene.remove(state.hudMesh);
            disposeMesh(state.hudMesh);
            state.hudMesh = null;
        }
        if (state.gameOverMesh) {
            state.scene.remove(state.gameOverMesh);
            disposeMesh(state.gameOverMesh);
            state.gameOverMesh = null;
        }

        state.score = 0;
        state.lives = 3;
        state.isGameOver = false;

        if (!state.player) {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.5);
            shape.lineTo(-0.3, -0.5);
            shape.lineTo(0.3, -0.5);
            shape.closePath();
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });

            state.player = {
                mesh: new THREE.Mesh(geometry, material),
                velocity: new THREE.Vector2(0, 0)
            };
            state.scene.add(state.player.mesh);
        }

        state.player.mesh.position.set(0, 0, 0);
        state.player.mesh.rotation.z = 0;
        state.player.velocity.set(0, 0);
        state.playerInvincible = GAME_CONST.INVINCIBILITY_TIME;

        spawnAsteroids(state, GAME_CONST.ASTEROID_COUNT_INIT, 3);
        updateHUD(state);
    }

    function disposeMesh(mesh) {
        if (!mesh) return;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
        }
    }

    function spawnAsteroids(state, count, size) {
        for (let i = 0; i < count; i++) {
            let position;
            do {
                position = new THREE.Vector2(
                    (Math.random() - 0.5) * GAME_CONST.WORLD_WIDTH,
                    (Math.random() - 0.5) * GAME_CONST.WORLD_HEIGHT
                );
            } while (position.length() < 5);
            createAsteroid(state, position, size);
        }
    }

    function createAsteroid(state, position, size) {
        if (size < 1) return;
        const geo = new THREE.IcosahedronGeometry(size / 2, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(position.x, position.y, 0);

        const asteroid = {
            mesh,
            velocity: new THREE.Vector2(
                (Math.random() - 0.5) * GAME_CONST.ASTEROID_SPEED_MAX * 2,
                (Math.random() - 0.5) * GAME_CONST.ASTEROID_SPEED_MAX * 2
            ),
            size
        };

        state.asteroids.push(asteroid);
        state.scene.add(mesh);
    }

    function onResize(state) {
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updatePlayer(state) {
        if (state.playerInvincible > 0) {
            state.playerInvincible--;
            state.player.mesh.visible = (state.playerInvincible % 20 < 10);
        } else {
            state.player.mesh.visible = true;
        }

        if (state.keys['KeyA'] || state.keys['ArrowLeft']) state.player.mesh.rotation.z += GAME_CONST.PLAYER_TURN_SPEED;
        if (state.keys['KeyD'] || state.keys['ArrowRight']) state.player.mesh.rotation.z -= GAME_CONST.PLAYER_TURN_SPEED;

        if (state.keys['KeyW'] || state.keys['ArrowUp']) {
            const dir = new THREE.Vector2(
                -Math.sin(state.player.mesh.rotation.z),
                Math.cos(state.player.mesh.rotation.z)
            );
            state.player.velocity.add(dir.multiplyScalar(GAME_CONST.PLAYER_SPEED));
        }

        state.player.velocity.multiplyScalar(GAME_CONST.PLAYER_FRICTION);
        state.player.mesh.position.x += state.player.velocity.x;
        state.player.mesh.position.y += state.player.velocity.y;
        wrap(state.player.mesh.position);

        if (state.keys['Space'] && !state.isGameOver && Date.now() - state.lastShotTime > 250) {
            shoot(state);
            state.lastShotTime = Date.now();
        }
    }

    function shoot(state) {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xff00ff })
        );

        const dir = new THREE.Vector2(
            -Math.sin(state.player.mesh.rotation.z),
            Math.cos(state.player.mesh.rotation.z)
        );
        mesh.position.set(
            state.player.mesh.position.x + dir.x * 0.5,
            state.player.mesh.position.y + dir.y * 0.5,
            0
        );

        state.bullets.push({
            mesh,
            velocity: dir.multiplyScalar(GAME_CONST.BULLET_SPEED).add(state.player.velocity),
            lifetime: GAME_CONST.BULLET_LIFETIME
        });

        state.scene.add(mesh);
    }

    function updateBullets(state) {
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.mesh.position.x += b.velocity.x;
            b.mesh.position.y += b.velocity.y;
            b.lifetime--;
            wrap(b.mesh.position);

            if (b.lifetime <= 0) {
                state.scene.remove(b.mesh);
                state.bullets.splice(i, 1);
            }
        }
    }

    function updateAsteroids(state) {
        state.asteroids.forEach(a => {
            a.mesh.position.x += a.velocity.x;
            a.mesh.position.y += a.velocity.y;
            wrap(a.mesh.position);
        });
    }

    function checkCollisions(state) {
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            for (let j = state.asteroids.length - 1; j >= 0; j--) {
                const b = state.bullets[i];
                const a = state.asteroids[j];

                if (b.mesh.position.distanceTo(a.mesh.position) < a.size / 2 + 0.1) {
                    state.scene.remove(b.mesh);
                    state.bullets.splice(i, 1);
                    splitAsteroid(state, a, j);
                    state.score += Math.round(100 / a.size);
                    return;
                }
            }
        }

        if (state.playerInvincible <= 0) {
            for (let i = state.asteroids.length - 1; i >= 0; i--) {
                const a = state.asteroids[i];
                if (state.player.mesh.position.distanceTo(a.mesh.position) < a.size / 2 + 0.3) {
                    state.lives--;
                    splitAsteroid(state, a, i);
                    if (state.lives <= 0) {
                        state.isGameOver = true;
                        showGameOver(state);
                    } else {
                        state.player.mesh.position.set(0, 0, 0);
                        state.player.velocity.set(0, 0);
                        state.playerInvincible = GAME_CONST.INVINCIBILITY_TIME;
                    }
                    break;
                }
            }
        }
    }

    function splitAsteroid(state, a, index) {
        const pos = a.mesh.position.clone();
        const size = a.size;

        state.scene.remove(a.mesh);
        state.asteroids.splice(index, 1);

        if (size > 1.5) {
            createAsteroid(state, new THREE.Vector2(pos.x, pos.y), size / 2);
            createAsteroid(state, new THREE.Vector2(pos.x, pos.y), size / 2);
        }
    }

    function updateHUD(state) {
        if (state.hudMesh) {
            state.scene.remove(state.hudMesh);
            disposeMesh(state.hudMesh);
            state.hudMesh = null;
        }

        const text = `Score: ${state.score}\nLives: ${state.lives}`;
        state.hudMesh = createTextLabelMesh(text, {
            color: "#fff", font: "24px Courier New", width: 300, height: 65, align: "left"
        });

        state.hudMesh.position.set(-GAME_CONST.WORLD_WIDTH/2 + 3.7, GAME_CONST.WORLD_HEIGHT/2 - 2.2, 0);
        state.scene.add(state.hudMesh);
    }

    function showGameOver(state) {
        if (state.gameOverMesh) {
            state.scene.remove(state.gameOverMesh);
            disposeMesh(state.gameOverMesh);
            state.gameOverMesh = null;
        }

        const msg = "GAME OVER\nPress [ENTER] to restart";
        state.gameOverMesh = createTextLabelMesh(msg, {
            color: "#fff", font: "36px Courier New",
            width: 600, height: 180,
            align: "center", bg: "rgba(0,0,0,0.8)"
        });

        state.gameOverMesh.position.set(0, 0, 0);
        state.scene.add(state.gameOverMesh);
    }

    function createTextLabelMesh(text, opts) {
        opts = opts || {};
        const font = opts.font || "24px Arial";
        const color = opts.color || "#fff";
        const width = opts.width || 256;
        const height = opts.height || 64;
        const align = opts.align || "center";
        const bg = opts.bg || "";

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);

        if (bg) {
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = "middle";

        const lines = text.split("\n");
        const lineH = height / lines.length;

        for (let i = 0; i < lines.length; i++) {
            let y = lineH * (i + 0.5);
            ctx.fillText(
                lines[i],
                align === "left" ? 10 : align === "right" ? width - 10 : width / 2,
                y
            );
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width/50, height/50),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        mesh.renderOrder = 10;
        return mesh;
    }

    function wrap(p) {
        if (p.x > GAME_CONST.WORLD_WIDTH / 2) p.x = -GAME_CONST.WORLD_WIDTH / 2;
        if (p.x < -GAME_CONST.WORLD_WIDTH / 2) p.x = GAME_CONST.WORLD_WIDTH / 2;
        if (p.y > GAME_CONST.WORLD_HEIGHT / 2) p.y = -GAME_CONST.WORLD_HEIGHT / 2;
        if (p.y < -GAME_CONST.WORLD_HEIGHT / 2) p.y = GAME_CONST.WORLD_HEIGHT / 2;
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
            state.scene.traverse(obj => {
                if (obj.isMesh) disposeMesh(obj);
            });
        }

        state = null;
    };

    // Start
    init();
})();
