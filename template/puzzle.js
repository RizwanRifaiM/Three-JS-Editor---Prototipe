(function () {
    // ======= PRIVATE SCOPE - Three.js only puzzle (no HTML IDs) ======
    let state = null;
    let loopId = null;

    function GameState() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.hudCanvas = null;
        this.hudTexture = null;
        this.hudMesh = null;
        this.orthoCamera = null;
        this.grid = [];
        this.colorSets = null;
        this.score = 0;
        this.phase = 1;
        this.mistakes = 0;
        this.MAX_MISTAKES = 10;
        this.dragging = null;
        this.dragOffset = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.boundResize = null;
        this.gameOver = false;
    }

    // CONFIG
    const GRID_SIZE = 6;
    const TILE_SIZE = 1;
    const GAP = 0.15;
    const CAM_Y = 12;
    const PHASE_THRESHOLDS = [0, 200, 500, 1000, 2000];

    const COLORS_BY_PHASE = [
        [0x3b2f2f, 0x2e2424, 0x241b1b, 0x1a1313, 0x120d0d, 0x0a0707],
        [0xf5e6c8, 0xf0dfbe, 0xebd7b3, 0xe4cfa8, 0xdfc89e, 0xd8c095],
        [0xbfbfbf, 0xb5b5b5, 0xababab, 0xa2a2a2, 0x999999, 0x909090],
        [0xff2b2b, 0xff1f1f, 0xff1414, 0xff0808, 0xf70000, 0xea0000],
        [0x111111, 0x0f0f0f, 0x0d0d0d, 0x0b0b0b, 0x090909, 0x070707]
    ];

    // helpers
    const gridToWorldX = x => x * (TILE_SIZE + GAP) - (GRID_SIZE - 1) * (TILE_SIZE + GAP) / 2;
    const gridToWorldZ = y => y * (TILE_SIZE + GAP) - (GRID_SIZE - 1) * (TILE_SIZE + GAP) / 2;

    function init() {
        state = new GameState();
        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x111111);

        // perspective camera for the board
        const aspect = window.innerWidth / window.innerHeight;
        state.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        state.camera.position.set(0, CAM_Y, 0.001);
        state.camera.lookAt(0, 0, 0);

        // renderer
        state.renderer = new THREE.WebGLRenderer({ antialias: true });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(state.renderer.domElement);

        // lights
        state.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        const d = new THREE.DirectionalLight(0xffffff, 0.6);
        d.position.set(5, 10, 5);
        state.scene.add(d);

        // orthographic camera for HUD
        state.orthoCamera = new THREE.OrthographicCamera(-aspect * 8, aspect * 8, 8, -8, 0.1, 50);
        state.orthoCamera.position.set(0, 0, 10);

        // HUD as canvas texture mapped to a plane in front
        state.hudCanvas = document.createElement('canvas');
        state.hudCanvas.width = 512;
        state.hudCanvas.height = 128;
        state.hudTexture = new THREE.CanvasTexture(state.hudCanvas);
        const hudMat = new THREE.MeshBasicMaterial({ map: state.hudTexture, transparent: true });
        const hudGeo = new THREE.PlaneGeometry(12, 3);
        state.hudMesh = new THREE.Mesh(hudGeo, hudMat);
        state.hudMesh.position.set(0, GRID_SIZE * (TILE_SIZE + GAP) / 2 + 1.5, -1);
        state.scene.add(state.hudMesh);

        // floor plane for grounding
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0x080808 }));
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.4;
        state.scene.add(plane);

        state.clock = new THREE.Clock();
        state.colorSets = COLORS_BY_PHASE;

        // build grid
        for (let x = 0; x < GRID_SIZE; x++) {
            state.grid[x] = [];
            for (let y = 0; y < GRID_SIZE; y++) {
                state.grid[x][y] = null;
            }
        }
        fillGridPreventInstantMatches();

        // events
        state.boundResize = () => onResize(state);
        window.addEventListener('resize', state.boundResize);
        state.renderer.domElement.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        updateHUD();
        animate();
    }

    // create cube
    function makeCube(color) {
        return new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE, 0.6, TILE_SIZE),
            new THREE.MeshStandardMaterial({ color })
        );
    }

    function createCell(x, y, colorIndex) {
        const colorSet = state.colorSets[state.phase - 1];
        const realColorIndex = colorIndex % colorSet.length;
        const mesh = makeCube(colorSet[realColorIndex]);
        mesh.position.set(gridToWorldX(x), 0, gridToWorldZ(y));
        mesh.userData.cell = { x, y, colorIndex: realColorIndex };
        state.scene.add(mesh);
        state.grid[x][y] = mesh;
    }

    function fillGridPreventInstantMatches() {
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (state.grid[x][y]) continue;
                let attempts = 0, ci;
                do {
                    ci = Math.floor(Math.random() * state.colorSets[0].length);
                    attempts++;
                } while (wouldCreateImmediateMatchOnSpawn(x, y, ci) && attempts < 200);
                createCell(x, y, ci);
            }
        }
        // remove any pre-game matches (safety, edge case)
        let matched;
        while ((matched = findMatches()).length) {
            for (const m of matched) {
                const { x, y } = m.userData.cell;
                state.scene.remove(m);
                state.grid[x][y] = null;
            }
            for (let x = 0; x < GRID_SIZE; x++) {
                for (let y = 0; y < GRID_SIZE; y++) {
                    if (state.grid[x][y] === null) {
                        let attempts = 0, ci;
                        do {
                            ci = Math.floor(Math.random() * state.colorSets[0].length);
                            attempts++;
                        } while (wouldCreateImmediateMatchOnSpawn(x, y, ci) && attempts < 200);
                        createCell(x, y, ci);
                    }
                }
            }
        }
        // ensure at least one possible move
        if (!hasPossibleMoves()) reshuffleGrid();
    }

    function wouldCreateImmediateMatchOnSpawn(x, y, colorIndex) {
        // Defensive: Use only defined cells!
        if (x >= 2) {
            const a = state.grid[x - 1][y]?.userData.cell?.colorIndex;
            const b = state.grid[x - 2][y]?.userData.cell?.colorIndex;
            if (a === colorIndex && b === colorIndex) return true;
        }
        if (y >= 2) {
            const a = state.grid[x][y - 1]?.userData.cell?.colorIndex;
            const b = state.grid[x][y - 2]?.userData.cell?.colorIndex;
            if (a === colorIndex && b === colorIndex) return true;
        }
        return false;
    }

    // MATCHING LOGIC
    function findMatches() {
        const matched = new Set();
        // horizontal
        for (let y = 0; y < GRID_SIZE; y++) {
            let runColor = null, runStart = 0, runLen = 0;
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = state.grid[x][y];
                if (!cell) {
                    runColor = null; runLen = 0; continue;
                }
                const ci = cell.userData.cell.colorIndex;
                if (ci === runColor) runLen++;
                else {
                    if (runLen >= 3) for (let k = runStart; k < x; k++) if (state.grid[k][y]) matched.add(state.grid[k][y]);
                    runColor = ci; runStart = x; runLen = 1;
                }
            }
            if (runLen >= 3) for (let k = runStart; k < GRID_SIZE; k++) if (state.grid[k][y]) matched.add(state.grid[k][y]);
        }
        // vertical
        for (let x = 0; x < GRID_SIZE; x++) {
            let runColor = null, runStart = 0, runLen = 0;
            for (let y = 0; y < GRID_SIZE; y++) {
                const cell = state.grid[x][y];
                if (!cell) {
                    runColor = null; runLen = 0; continue;
                }
                const ci = cell.userData.cell.colorIndex;
                if (ci === runColor) runLen++;
                else {
                    if (runLen >= 3) for (let k = runStart; k < y; k++) if (state.grid[x][k]) matched.add(state.grid[x][k]);
                    runColor = ci; runStart = y; runLen = 1;
                }
            }
            if (runLen >= 3) for (let k = runStart; k < GRID_SIZE; k++) if (state.grid[x][k]) matched.add(state.grid[x][k]);
        }
        return Array.from(matched);
    }

    async function removeMatches(matches) {
        if (!matches.length) return;
        // award points
        state.score += matches.length * 10;
        updatePhase();
        updateHUD();
        // animate scale down and remove
        await Promise.all(matches.map(m => new Promise(res => {
            const start = performance.now(), dur = 220;
            (function tick(t) {
                const p = Math.min(1, (t - start) / dur);
                const s = 1 - p;
                if (m.scale) m.scale.setScalar(Math.max(s, 0));
                if (p < 1) requestAnimationFrame(tick);
                else {
                    state.scene.remove(m);
                    const x = m.userData.cell.x, y = m.userData.cell.y;
                    state.grid[x][y] = null;
                    res();
                }
            })(start);
        })));
        await dropAndRefill();
        const next = findMatches();
        if (next.length) await removeMatches(next);
    }

    function dropAndRefill() {
        return new Promise(res => {
            for (let x = 0; x < GRID_SIZE; x++) {
                let write = 0;
                for (let y = 0; y < GRID_SIZE; y++) {
                    const c = state.grid[x][y];
                    if (c) {
                        if (y !== write) {
                            state.grid[x][write] = c;
                            c.userData.cell.y = write;
                            c.position.set(gridToWorldX(x), 0, gridToWorldZ(write));
                            state.grid[x][y] = null;
                        }
                        write++;
                    }
                }
                for (let y = write; y < GRID_SIZE; y++) {
                    let attempts = 0, ci;
                    do {
                        ci = Math.floor(Math.random() * state.colorSets[0].length);
                        attempts++;
                    } while (wouldCreateImmediateMatchOnSpawn(x, y, ci) && attempts < 200);
                    createCell(x, y, ci);
                }
            }
            setTimeout(res, 120);
        });
    }

    function checkMatchAt(x, y) {
        const cell = state.grid[x][y];
        if (!cell) return false;
        const c = cell.userData.cell.colorIndex;
        let cnt = 1, i = x - 1;
        while (i >= 0 && state.grid[i][y] && state.grid[i][y].userData.cell.colorIndex === c) { cnt++; i--; }
        i = x + 1;
        while (i < GRID_SIZE && state.grid[i][y] && state.grid[i][y].userData.cell.colorIndex === c) { cnt++; i++; }
        if (cnt >= 3) return true;
        cnt = 1; i = y - 1;
        while (i >= 0 && state.grid[x][i] && state.grid[x][i].userData.cell.colorIndex === c) { cnt++; i--; }
        i = y + 1;
        while (i < GRID_SIZE && state.grid[x][i] && state.grid[x][i].userData.cell.colorIndex === c) { cnt++; i++; }
        return cnt >= 3;
    }

    function canSwapMakeMatch(a, b) {
        if (!a || !b) return false;
        const ax = a.userData.cell.x, ay = a.userData.cell.y;
        const bx = b.userData.cell.x, by = b.userData.cell.y;
        const ca = a.userData.cell.colorIndex, cb = b.userData.cell.colorIndex;

        // Temporarily swap colors for simulation
        a.userData.cell.colorIndex = cb;
        b.userData.cell.colorIndex = ca;
        const ok = checkMatchAt(ax, ay) || checkMatchAt(bx, by);
        a.userData.cell.colorIndex = ca;
        b.userData.cell.colorIndex = cb;
        return ok;
    }

    function hasPossibleMoves() {
        for (let x = 0; x < GRID_SIZE; x++)
            for (let y = 0; y < GRID_SIZE; y++) {
                const c = state.grid[x][y];
                if (!c) continue;
                if (x < GRID_SIZE - 1 && canSwapMakeMatch(c, state.grid[x + 1][y])) return true;
                if (y < GRID_SIZE - 1 && canSwapMakeMatch(c, state.grid[x][y + 1])) return true;
            }
        return false;
    }

    function reshuffleGrid() {
        // gather all colorIndexes in a list
        const colorPool = [];
        for (let x = 0; x < GRID_SIZE; x++)
            for (let y = 0; y < GRID_SIZE; y++)
                colorPool.push(state.grid[x][y] ? state.grid[x][y].userData.cell.colorIndex : Math.floor(Math.random() * state.colorSets[0].length));
        // randomize pool and assign back to cells, then fix visuals
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                const idx = Math.floor(Math.random() * colorPool.length);
                const ci = colorPool.splice(idx, 1)[0];
                if (state.grid[x][y]) {
                    state.grid[x][y].userData.cell.colorIndex = ci;
                    state.grid[x][y].material.color.setHex(state.colorSets[state.phase - 1][ci % state.colorSets[state.phase - 1].length]);
                } else {
                    createCell(x, y, ci);
                }
            }
        }
        // ensure no initial matches after shuffle
        let matched;
        while ((matched = findMatches()).length) {
            for (const m of matched) {
                const { x, y } = m.userData.cell;
                state.scene.remove(m);
                state.grid[x][y] = null;
            }
            for (let x = 0; x < GRID_SIZE; x++) {
                for (let y = 0; y < GRID_SIZE; y++) {
                    if (state.grid[x][y] === null) {
                        let attempts = 0, ci;
                        do {
                            ci = Math.floor(Math.random() * state.colorSets[0].length);
                            attempts++;
                        } while (wouldCreateImmediateMatchOnSpawn(x, y, ci) && attempts < 200);
                        createCell(x, y, ci);
                    }
                }
            }
        }
        if (!hasPossibleMoves()) setTimeout(reshuffleGrid, 50);
    }

    // SWAP with animation
    function swapCells(a, b) {
        if (state.gameOver) return;
        const ax = a.userData.cell.x, ay = a.userData.cell.y;
        const bx = b.userData.cell.x, by = b.userData.cell.y;

        // Swap references in grid
        state.grid[ax][ay] = b; state.grid[bx][by] = a;
        a.userData.cell.x = bx; a.userData.cell.y = by;
        b.userData.cell.x = ax; b.userData.cell.y = ay;

        const pA = new THREE.Vector3(gridToWorldX(bx), 0, gridToWorldZ(by));
        const pB = new THREE.Vector3(gridToWorldX(ax), 0, gridToWorldZ(ay));

        // animate positions
        const start = performance.now(), dur = 180;
        return new Promise(res => {
            (function tick(t) {
                const p = Math.min(1, (t - start) / dur);
                a.position.lerpVectors(a.position, pA, p);
                b.position.lerpVectors(b.position, pB, p);
                if (p < 1) {
                    requestAnimationFrame(tick);
                } else {
                    // snap to pos
                    a.position.copy(pA);
                    b.position.copy(pB);
                    // Check for matches
                    const matches = findMatches();
                    if (matches.length) {
                        removeMatches(matches).then(() => {
                            if (!hasPossibleMoves()) handleNoMoreMoves();
                            res();
                        });
                    } else {
                        // swap back with animation, increment mistakes
                        setTimeout(() => {
                            state.grid[ax][ay] = a; state.grid[bx][by] = b;
                            a.userData.cell.x = ax; a.userData.cell.y = ay;
                            b.userData.cell.x = bx; b.userData.cell.y = by;

                            const s = performance.now(), d2 = 140;
                            (function tick2(t2) {
                                const q = Math.min(1, (t2 - s) / d2);
                                a.position.lerpVectors(a.position, new THREE.Vector3(gridToWorldX(ax), 0, gridToWorldZ(ay)), q);
                                b.position.lerpVectors(b.position, new THREE.Vector3(gridToWorldX(bx), 0, gridToWorldZ(by)), q);
                                if (q < 1)
                                    requestAnimationFrame(tick2);
                                else {
                                    a.position.set(gridToWorldX(ax), 0, gridToWorldZ(ay));
                                    b.position.set(gridToWorldX(bx), 0, gridToWorldZ(by));
                                    state.mistakes++;
                                    updateHUD();
                                    if (state.mistakes >= state.MAX_MISTAKES) handleNoMoreMoves();
                                    res();
                                }
                            })(s);
                        }, 120);
                    }
                }
            })(start);
        });
    }

    // MOUSE / RAYCAST DRAG (visual following)
    function onMouseDown(e) {
        if (state.gameOver) return;
        if (state.dragging) return;
        const rect = state.renderer.domElement.getBoundingClientRect();
        state.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        state.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        state.raycaster.setFromCamera(state.mouse, state.camera);

        // Only hit cubes
        const intersects = state.raycaster.intersectObjects(
            state.scene.children.filter(o => o.userData && o.userData.cell), false
        );
        if (intersects.length) {
            const obj = intersects.find(i => i.object.userData && i.object.userData.cell);
            if (obj) {
                state.dragging = obj.object;
                state.dragging.position.y = 0.6; // visually lift
                // compute offset between world intersection and mesh center
                const hit = intersects[0].point;
                state.dragOffset.copy(hit).sub(state.dragging.position);
            }
        }
    }

    function onMouseMove(e) {
        if (state.gameOver) return;
        if (!state.dragging) return;
        const rect = state.renderer.domElement.getBoundingClientRect();
        state.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        state.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        state.raycaster.setFromCamera(state.mouse, state.camera);
        // intersect plane y=0
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const pos = new THREE.Vector3();
        state.raycaster.ray.intersectPlane(plane, pos);
        state.dragging.position.x = pos.x - state.dragOffset.x;
        state.dragging.position.z = pos.z - state.dragOffset.z;
    }

    function onMouseUp(e) {
        if (state.gameOver) return;
        if (!state.dragging) return;
        const rect = state.renderer.domElement.getBoundingClientRect();
        state.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        state.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        state.raycaster.setFromCamera(state.mouse, state.camera);
        // Only hit cubes
        const intersects = state.raycaster.intersectObjects(
            state.scene.children.filter(o => o.userData && o.userData.cell), false
        );
        let target = null;
        if (intersects.length) {
            const obj = intersects.find(i => i.object.userData && i.object.userData.cell);
            if (obj) target = obj.object;
        }
        const source = state.dragging;
        state.dragging.position.set(gridToWorldX(source.userData.cell.x), 0, gridToWorldZ(source.userData.cell.y));
        state.dragging.position.y = 0;
        if (target && target !== source) {
            const dx = Math.abs(source.userData.cell.x - target.userData.cell.x);
            const dy = Math.abs(source.userData.cell.y - target.userData.cell.y);
            if (dx + dy === 1) { // attempt swap only for neighbors
                swapCells(source, target);
            }
        }
        state.dragging = null;
        state.dragOffset.set(0, 0, 0);
    }

    // HUD drawing
    function updateHUD() {
        const ctx = state.hudCanvas.getContext('2d');
        ctx.clearRect(0, 0, state.hudCanvas.width, state.hudCanvas.height);

        if (!state.gameOver)
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
        else
            ctx.fillStyle = 'rgba(150,0,0,0.7)';
        ctx.fillRect(0, 0, state.hudCanvas.width, state.hudCanvas.height);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px monospace';
        ctx.textBaseline = "top";
        ctx.fillText(`Score:`, 24, 18);
        ctx.font = '32px monospace';
        ctx.fillText(`${state.score}`, 120, 18);

        ctx.font = 'bold 28px monospace';
        ctx.fillText(`Phase: ${state.phase}`, 220, 22);

        ctx.font = 'bold 24px monospace';
        ctx.fillText(`Mistakes:`, 24, 70);
        ctx.fillText(`${state.mistakes} / ${state.MAX_MISTAKES}`, 180, 70);

        if (state.gameOver) {
            ctx.font = 'bold 48px monospace';
            ctx.fillStyle = "#fff";
            ctx.fillText('GAME OVER', 125, 90);
        }
        state.hudTexture.needsUpdate = true;
    }

    function updatePhase() {
        let newP = 1;
        for (let i = 0; i < COLORS_BY_PHASE.length; i++) {
            if (state.score >= PHASE_THRESHOLDS[i]) newP = i + 1;
        }
        newP = Math.min(newP, COLORS_BY_PHASE.length);
        if (newP !== state.phase) {
            state.phase = newP;
            // recolor everything
            for (let x = 0; x < GRID_SIZE; x++)
                for (let y = 0; y < GRID_SIZE; y++)
                    if (state.grid[x][y]) {
                        const ci = state.grid[x][y].userData.cell.colorIndex % state.colorSets[state.phase - 1].length;
                        state.grid[x][y].userData.cell.colorIndex = ci;
                        state.grid[x][y].material.color.setHex(state.colorSets[state.phase - 1][ci]);
                    }
        }
    }

    function handleNoMoreMoves() {
        if (state.gameOver) return;
        state.gameOver = true;
        updateHUD();
        cancelAnimationFrame(loopId);
        // visually lower cubes and block future moves
        for (let x = 0; x < GRID_SIZE; x++)
            for (let y = 0; y < GRID_SIZE; y++)
                if (state.grid[x][y])
                    state.grid[x][y].material.opacity = 0.5;
    }

    function animate() {
        if (!state) return;
        loopId = requestAnimationFrame(animate);
        updateHUD();
        state.renderer.render(state.scene, state.camera);
    }

    function onResize(s) {
        const aspect = window.innerWidth / window.innerHeight;
        s.camera.aspect = aspect;
        s.camera.updateProjectionMatrix();
        s.renderer.setSize(window.innerWidth, window.innerHeight);
        s.orthoCamera.left = -aspect * 8;
        s.orthoCamera.right = aspect * 8;
        s.orthoCamera.updateProjectionMatrix();
    }

    function disposeMesh(m) {
        if (!m) return;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
            if (m.material.map) m.material.map.dispose();
            m.material.dispose();
        }
    }

    // EXPORT destroy
    window.__GAME_DESTROY = function () {
        if (!state) return;
        cancelAnimationFrame(loopId);
        window.removeEventListener('resize', state.boundResize);
        state.renderer.domElement.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (state.renderer) {
            if (state.renderer.domElement.parentNode) state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
            try { state.renderer.forceContextLoss(); } catch (e) { }
            state.renderer.dispose();
            state.renderer = null;
        }
        if (state.scene) {
            state.scene.traverse(o => { if (o.isMesh) disposeMesh(o); });
        }
        state = null;
    };

    // start
    init();
})();
