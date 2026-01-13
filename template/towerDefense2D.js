(function() {
// === Tower Defense 2D (Refactored) ===

// Settings
const TOWER_SPECS = {
    gun: { cost: 100, range: 3, fireRate: 500, projectileSpeed: 0.2, damage: 25 }
};
const WAVE_DATA = [
    { count: 10, health: 50, speed: 0.015, delay: 600 },
    { count: 15, health: 75, speed: 0.018, delay: 500 },
    { count: 20, health: 100, speed: 0.02, delay: 400 },
    { count: 25, health: 120, speed: 0.02, delay: 300 },
    { count: 30, health: 150, speed: 0.022, delay: 250 },
];
const ENEMY_PATH = [
    new THREE.Vector2(-12, 0), new THREE.Vector2(-8, 0), new THREE.Vector2(-8, 4),
    new THREE.Vector2(8, 4), new THREE.Vector2(8, -4), new THREE.Vector2(-8, -4),
    new THREE.Vector2(-8, -8), new THREE.Vector2(12, -8)
];

// Globals
let scene, camera, renderer, clock;
let towers = [], enemies = [], projectiles = [];
let playerState = { lives: 20, money: 100 };
let currentWave = 0;
let gameState = 'building';
let placingTower = null;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a5a3a);
    clock = new THREE.Clock();

    camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
    camera.position.z = 10;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    
    document.getElementById('info').innerHTML = `
        <b>Tower Defense</b><br>
        <span>Build towers, then start the wave!</span>
    `;

    buildPathVisual();
    resetGame();

    document.getElementById('gun-tower-btn').addEventListener('click', () => setPlacingTower('gun'));
    document.getElementById('start-wave-btn').addEventListener('click', startWave);
    renderer.domElement.addEventListener('mousedown', onCanvasClick);
    window.addEventListener('keydown', e => { if (gameState === 'game_over' && e.code === 'Enter') resetGame(); });
    window.addEventListener('resize', onWindowResize);
    
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
            mesh: new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0xff0000 })),
            health: wave.health, maxHealth: wave.health,
            speed: wave.speed, pathIndex: 0,
            value: 10
        };
        enemy.mesh.position.set(ENEMY_PATH[0].x, ENEMY_PATH[0].y, 0);
        enemy.mesh.userData = enemy;
        enemies.push(enemy);
        scene.add(enemy.mesh);
        spawned++;
    }, wave.delay);
}

function setPlacingTower(type) {
    if (placingTower) {
        scene.remove(placingTower.ghost);
        document.getElementById(`${placingTower.type}-tower-btn`).classList.remove('selected');
    }
    if (placingTower?.type === type) {
        placingTower = null;
        return;
    }

    const spec = TOWER_SPECS[type];
    placingTower = { type, spec };
    
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.7 });
    const rangeGeo = new THREE.CircleGeometry(spec.range, 32);
    const rangeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    placingTower.ghost = new THREE.Group();
    placingTower.ghost.add(new THREE.Mesh(geo, mat), new THREE.Mesh(rangeGeo, rangeMat).rotateX(-Math.PI/2));
    scene.add(placingTower.ghost);
    document.getElementById(`${type}-tower-btn`).classList.add('selected');
}

function onCanvasClick(e) {
    if (!placingTower || playerState.money < placingTower.spec.cost) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((e.clientX / rect.left) * 2 - 1),
        -((e.clientY / rect.top) / rect.height) * 2 + 1
    );
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const worldPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, worldPos);

    const tower = {
        mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1, 8), new THREE.MeshStandardMaterial({color: 0x999999})),
        fireCooldown: 0,
        ...placingTower.spec
    };
    tower.mesh.position.copy(worldPos);
    towers.push(tower);
    scene.add(tower.mesh);

    playerState.money -= tower.spec.cost;
    updateHUD();
}

function updateTowers(deltaTime) {
    towers.forEach(t => {
        t.fireCooldown -= deltaTime;
        if (t.fireCooldown > 0) return;

        let target = null;
        let minDistance = t.range;
        enemies.forEach(e => {
            const dist = t.mesh.position.distanceTo(e.mesh.position);
            if (dist < minDistance) {
                minDistance = dist;
                target = e;
            }
        });

        if (target) {
            t.fireCooldown = t.fireRate / 1000;
            const dir = target.mesh.position.clone().sub(t.mesh.position).normalize();
            const proj = {
                mesh: new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({color: 0xffff00})),
                velocity: dir.multiplyScalar(t.projectileSpeed),
                damage: t.damage,
            };
            proj.mesh.position.copy(t.mesh.position);
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
        const dir = targetPos.clone().sub(new THREE.Vector2(e.mesh.position.x, e.mesh.position.y)).normalize();
        e.mesh.position.x += dir.x * e.speed;
        e.mesh.position.y += dir.y * e.speed;

        if (e.mesh.position.distanceTo(new THREE.Vector3(targetPos.x, targetPos.y, 0)) < 0.1) {
            e.pathIndex++;
        }
    }
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.mesh.position.add(p.velocity);
        if(p.mesh.position.length() > 30) { // Out of bounds
            scene.remove(p.mesh);
            projectiles.splice(i,1);
            continue;
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (p.mesh.position.distanceTo(e.mesh.position) < 0.5) {
                e.health -= p.damage;
                if(e.health <= 0) {
                    playerState.money += e.value;
                    scene.remove(e.mesh);
                    enemies.splice(j,1);
                }
                scene.remove(p.mesh);
                projectiles.splice(i,1);
                break;
            }
        }
    }
}

function checkWaveEnd() {
    if (gameState === 'wave_in_progress' && enemies.length === 0) {
        gameState = 'building';
        currentWave++;
        playerState.money += 100 + currentWave * 20;
        document.getElementById('start-wave-btn').disabled = false;
        if(currentWave >= WAVE_DATA.length) handleEndGame(true);
    }
}

function handleEndGame(isWin) {
    gameState = 'game_over';
    document.getElementById('end-message').textContent = isWin ? "YOU WIN!" : "GAME OVER";
    document.getElementById('end-score').textContent = `You survived ${currentWave} waves.`;
    document.getElementById('restart-prompt').textContent = 'Press [ENTER] to restart';
    document.getElementById('gameover').style.display = 'flex';
}

function buildPathVisual() {
    const pathMat = new THREE.MeshBasicMaterial({ color: 0x8b4513, opacity: 0.5, transparent: true });
    for (let i = 0; i < ENEMY_PATH.length - 1; i++) {
        const p1 = ENEMY_PATH[i];
        const p2 = ENEMY_PATH[i+1];
        const length = p1.distanceTo(p2);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const mid = new THREE.Vector2().addVectors(p1, p2).multiplyScalar(0.5);
        
        const segment = new THREE.Mesh(new THREE.BoxGeometry(length, 1, 0.05), pathMat);
        segment.position.set(mid.x, mid.y, -0.2);
        segment.rotation.z = angle;
        scene.add(segment);
    }
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -12 * aspect; camera.right = 12 * aspect;
    camera.top = 9; camera.bottom = -9;
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

const animate = () => {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    if (placingTower) {
        const plane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
        const raycaster = new THREE.Raycaster();
        const mousePosition = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mousePosition, camera);
        const worldPos = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, worldPos);
        placingTower.ghost.position.copy(worldPos);
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
