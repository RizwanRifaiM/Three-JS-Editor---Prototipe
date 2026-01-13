(function() {
// === Tower Defense 3D (Refactored) ===

// --- SETTINGS ---
const TOWER_SPECS = {
    gun: { cost: 100, range: 4, fireRate: 400, projectileSpeed: 0.2, damage: 25 }
};
const WAVE_DATA = [
    { count: 10, health: 100, speed: 0.05, delay: 600, reward: 10 },
    { count: 15, health: 150, speed: 0.06, delay: 500, reward: 12 },
    { count: 25, health: 180, speed: 0.07, delay: 400, reward: 15 },
];
const ENEMY_PATH = [
    new THREE.Vector3(-14, 0.5, 0), new THREE.Vector3(-10, 0.5, 0),
    new THREE.Vector3(-10, 0.5, 8), new THREE.Vector3(10, 0.5, 8),
    new THREE.Vector3(10, 0.5, -8), new THREE.Vector3(-10, 0.5, -8),
    new THREE.Vector3(-10, 0.5, -12), new THREE.Vector3(14, 0.5, -12)
];

// --- GLOBALS ---
let scene, camera, renderer, clock, raycaster, mouse;
let towers = [], enemies = [], projectiles = [];
let playerState, currentWave, gameState;
let placingTower = null, groundPlane;

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a5a3a);
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(0, 18, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff, 0.7);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 5);
    scene.add(light, dirLight);

    groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({color:0x4a5d23}));
    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);
    
    document.getElementById('info').innerHTML = `
        <b>3D Tower Defense</b><br>
        <span>Build towers, then start the wave!</span>
    `;

    buildPathVisual();
    initControls();
    resetGame();
    animate();
}

function resetGame() {
    gameState = 'building';
    playerState = { lives: 20, money: 150 };
    currentWave = 0;
    
    [...towers, ...enemies, ...projectiles].forEach(e => scene.remove(e.mesh));
    towers = [], enemies = [], projectiles = [];
    if(placingTower) scene.remove(placingTower.ghost);
    placingTower = null;

    document.getElementById('gameover').style.display = 'none';
    document.getElementById('start-wave-btn').disabled = false;
    updateHUD();
}

function startWave() {
    if (gameState !== 'building' || currentWave >= WAVE_DATA.length) return;
    gameState = 'wave_in_progress';
    document.getElementById('start-wave-btn').disabled = true;

    const wave = WAVE_DATA[currentWave];
    let spawned = 0;
    const spawnInterval = setInterval(() => {
        if (spawned >= wave.count) {
            clearInterval(spawnInterval);
            return;
        }
        const enemy = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xff0000 })),
            health: wave.health, speed: wave.speed, pathIndex: 0,
            value: wave.reward
        };
        enemy.mesh.position.copy(ENEMY_PATH[0]);
        enemies.push(enemy);
        scene.add(enemy.mesh);
        spawned++;
    }, wave.delay);
}

// --- ENTITY & GAME LOGIC ---
function updateTowers(deltaTime) {
    towers.forEach(t => {
        t.fireCooldown -= deltaTime;
        if (t.fireCooldown > 0) return;

        let target = enemies.find(e => t.mesh.position.distanceTo(e.mesh.position) < t.range);
        if (target) {
            t.fireCooldown = t.fireRate / 1000;
            const dir = target.mesh.position.clone().sub(t.mesh.position).normalize();
            const proj = {
                mesh: new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color: 0xffff00})),
                velocity: dir.multiplyScalar(t.projectileSpeed),
                damage: t.damage,
            };
            proj.mesh.position.copy(t.mesh.position).add(new THREE.Vector3(0,1,0));
            projectiles.push(proj);
            scene.add(proj.mesh);
        }
    });
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.pathIndex >= ENEMY_PATH.length - 1) {
            playerState.lives--;
            scene.remove(e.mesh);
            enemies.splice(i, 1);
            if (playerState.lives <= 0) handleEndGame(false);
            continue;
        }
        const targetPos = ENEMY_PATH[e.pathIndex + 1];
        const dir = targetPos.clone().sub(e.mesh.position).normalize();
        e.mesh.position.add(dir.multiplyScalar(e.speed));
        if (e.mesh.position.distanceTo(targetPos) < 0.1) e.pathIndex++;
    }
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.add(p.velocity);
        if(p.mesh.position.length() > 50) {
            scene.remove(p.mesh); projectiles.splice(i,1); continue;
        }
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (p.mesh.position.distanceTo(e.mesh.position) < 0.6) {
                e.health -= p.damage;
                if(e.health <= 0) {
                    playerState.money += e.value;
                    scene.remove(e.mesh); enemies.splice(j,1);
                }
                scene.remove(p.mesh); projectiles.splice(i,1);
                break;
            }
        }
    }
}

function checkWaveEnd() {
    if (gameState === 'wave_in_progress' && enemies.length === 0) {
        gameState = 'building';
        currentWave++;
        playerState.money += 100 + currentWave * 25;
        document.getElementById('start-wave-btn').disabled = false;
        if(currentWave >= WAVE_DATA.length) handleEndGame(true);
    }
}

// --- UI & CONTROLS ---
function initControls() {
    document.getElementById('gun-tower-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        setPlacingTower('gun');
    });
    document.getElementById('start-wave-btn').addEventListener('click', startWave);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onCanvasClick);
    window.addEventListener('keydown', e => { if (gameState === 'game_over' && e.code === 'KeyR') resetGame(); });
    window.addEventListener('resize', onWindowResize);
}

function setPlacingTower(type) {
    if (placingTower) {
        scene.remove(placingTower.ghost);
        document.getElementById(`${placingTower.type}-tower-btn`).classList.remove('selected');
    }
    if (!type || placingTower?.type === type) {
        placingTower = null;
        return;
    }
    const spec = TOWER_SPECS[type];
    placingTower = { type, spec };
    
    const geo = new THREE.CylinderGeometry(0.5,0.5,1.5,8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x888, transparent: true, opacity: 0.7 });
    const rangeGeo = new THREE.CircleGeometry(spec.range, 32);
    const rangeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    placingTower.ghost = new THREE.Group();
    placingTower.ghost.add(new THREE.Mesh(geo, mat), new THREE.Mesh(rangeGeo, rangeMat).rotateX(Math.PI/2));
    scene.add(placingTower.ghost);
    document.getElementById(`${type}-tower-btn`).classList.add('selected');
}
function onMouseMove(e) {
    mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
}
function onCanvasClick() {
    if (!placingTower || !placingTower.spec || playerState.money < placingTower.spec.cost) return;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(groundPlane);
    if(intersects.length > 0) {
        const pos = intersects[0].point;
        const tower = {
            mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8), new THREE.MeshStandardMaterial({color: 0x999999})),
            fireCooldown: 0,
            ...placingTower.spec
        };
        tower.mesh.position.set(pos.x, 0.75, pos.z);
        towers.push(tower);
        scene.add(tower.mesh);
        playerState.money -= tower.spec.cost;
        setPlacingTower(null); // Deselect after placing
    }
}
function handleEndGame(isWin) {
    gameState = 'game_over';
    const go = document.getElementById('gameover');
    go.querySelector('#end-message').textContent = isWin ? "VICTORY!" : "DEFEAT";
    go.querySelector('#end-score').textContent = `You survived ${isWin ? WAVE_DATA.length : currentWave} waves.`;
    go.querySelector('#restart-prompt').textContent = 'Press [R] to restart';
    go.style.display = 'flex';
}

function buildPathVisual() {
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x8b4513, opacity: 0.8, transparent: true });
    for (let i = 0; i < ENEMY_PATH.length - 1; i++) {
        const p1 = ENEMY_PATH[i];
        const p2 = ENEMY_PATH[i+1];
        const length = p1.distanceTo(p2);
        const angle = Math.atan2(p2.z - p1.z, p2.x - p1.x);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        
        const segment = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, 1.5), pathMat);
        segment.position.set(mid.x, 0.05, mid.z);
        segment.rotation.y = angle;
        scene.add(segment);
    }
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
function updateHUD() {
    document.getElementById('lives').textContent = `Lives: ${playerState.lives}`;
    document.getElementById('money').textContent = `Money: ${playerState.money}`;
    document.getElementById('wave').textContent = `Wave: ${currentWave}`;

    // Hide unused stats
    document.getElementById('score').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('phase').style.display = 'none';
    document.getElementById('pong-score').style.display = 'none';
    if(document.getElementById('race3d-ui')) document.getElementById('race3d-ui').style.display = 'none';
    document.getElementById('message').style.display = 'none';
    document.getElementById('countdown').style.display = 'none';

    // Specific HUD for Tower Defense
    document.getElementById('game-stats').innerHTML = `
        <span id="lives">Lives: ${playerState.lives}</span><br>
        <span id="money">Money: ${playerState.money}</span><br>
        <span id="wave">Wave: ${currentWave}</span>
    `;
}

// --- Main Loop ---
const animate = () => {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    if (placingTower) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(groundPlane);
        if (intersects.length > 0) placingTower.ghost.position.copy(intersects[0].point);
    }
    
    if (gameState === 'wave_in_progress') {
        updateTowers(deltaTime);
        updateEnemies();
        updateProjectiles();
        checkWaveEnd();
    }
    updateHUD();
    renderer.render(scene, camera);
}

init();
})();
