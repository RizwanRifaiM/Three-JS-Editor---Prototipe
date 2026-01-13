// Import Three.js via script tag if it's not already loaded
// This module will define a createRubiksCube function you must call to run

(function () {
    function createRubiksCube(container) {
        // Everything from previous "state" and code must live in this function scope!
        let state = null;
        let loopId = null;
        let isRotatingFace = false;
        let currentRotation = null;
        let moveCount = 0;

        // Cube colors - standard Rubik's Cube colors
        const COLORS = {
            WHITE: 0xFFFFFF,   // Front
            RED: 0xFF0000,     // Right
            BLUE: 0x0000FF,    // Up
            ORANGE: 0xFFA500,  // Left
            GREEN: 0x00FF00,   // Down
            YELLOW: 0xFFFF00   // Back
        };

        // Face mappings
        const FACES = {
            U: 0,  // Up
            D: 1,  // Down
            F: 2,  // Front
            B: 3,  // Back
            L: 4,  // Left
            R: 5   // Right
        };

        // Cube state representation
        let cubeState = [];

        function GameState() {
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.cubeGroup = null;
            this.cubies = [];
            this.raycaster = null;
            this.mouse = null;
            this.boundResize = null;
            this.boundKeyDown = null;
            this.controls = {
                isLeftDragging: false,
                isRightDragging: false,
                previousMousePosition: { x: 0, y: 0 }
            };
        }

        // Initialize the cube state
        function initCubeState() {
            cubeState = [];
            for (let x = 0; x < 3; x++) {
                cubeState[x] = [];
                for (let y = 0; y < 3; y++) {
                    cubeState[x][y] = [];
                    for (let z = 0; z < 3; z++) {
                        let colors = [-1, -1, -1, -1, -1, -1];
                        if (y === 2) colors[0] = FACES.U;
                        if (y === 0) colors[1] = FACES.D;
                        if (z === 2) colors[2] = FACES.F;
                        if (z === 0) colors[3] = FACES.B;
                        if (x === 0) colors[4] = FACES.L;
                        if (x === 2) colors[5] = FACES.R;

                        cubeState[x][y][z] = {
                            colors: colors,
                            position: { x: x, y: y, z: z }
                        };
                    }
                }
            }
        }

        function createCubie(x, y, z) {
            const cubieSize = 0.95;
            const gap = 0.05;
            const cubieGroup = new THREE.Group();
            cubieGroup.position.set(x - 1, y - 1, z - 1);
            const colors = cubeState[x][y][z].colors;

            if (colors[0] !== -1) {
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(cubieSize, cubieSize),
                    new THREE.MeshBasicMaterial({ 
                        color: getColorByFaceIndex(colors[0]),
                        side: THREE.DoubleSide
                    })
                );
                face.position.set(0, cubieSize/2 + gap/2, 0);
                face.rotation.x = Math.PI / 2;
                face.userData.isFace = true;
                face.userData.faceDirection = 'U';
                face.userData.cubieIndex = {x, y, z};
                cubieGroup.add(face);
            }

            if (colors[1] !== -1) {
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(cubieSize, cubieSize),
                    new THREE.MeshBasicMaterial({ 
                        color: getColorByFaceIndex(colors[1]),
                        side: THREE.DoubleSide
                    })
                );
                face.position.set(0, -cubieSize/2 - gap/2, 0);
                face.rotation.x = -Math.PI / 2;
                face.userData.isFace = true;
                face.userData.faceDirection = 'D';
                face.userData.cubieIndex = {x, y, z};
                cubieGroup.add(face);
            }

            if (colors[2] !== -1) {
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(cubieSize, cubieSize),
                    new THREE.MeshBasicMaterial({ 
                        color: getColorByFaceIndex(colors[2]),
                        side: THREE.DoubleSide
                    })
                );
                face.position.set(0, 0, cubieSize/2 + gap/2);
                face.userData.isFace = true;
                face.userData.faceDirection = 'F';
                face.userData.cubieIndex = {x, y, z};
                cubieGroup.add(face);
            }

            if (colors[3] !== -1) {
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(cubieSize, cubieSize),
                    new THREE.MeshBasicMaterial({ 
                        color: getColorByFaceIndex(colors[3]),
                        side: THREE.DoubleSide
                    })
                );
                face.position.set(0, 0, -cubieSize/2 - gap/2);
                face.rotation.y = Math.PI;
                face.userData.isFace = true;
                face.userData.faceDirection = 'B';
                face.userData.cubieIndex = {x, y, z};
                cubieGroup.add(face);
            }

            if (colors[4] !== -1) {
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(cubieSize, cubieSize),
                    new THREE.MeshBasicMaterial({ 
                        color: getColorByFaceIndex(colors[4]),
                        side: THREE.DoubleSide
                    })
                );
                face.position.set(-cubieSize/2 - gap/2, 0, 0);
                face.rotation.y = -Math.PI / 2;
                face.userData.isFace = true;
                face.userData.faceDirection = 'L';
                face.userData.cubieIndex = {x, y, z};
                cubieGroup.add(face);
            }

            if (colors[5] !== -1) {
                const face = new THREE.Mesh(
                    new THREE.PlaneGeometry(cubieSize, cubieSize),
                    new THREE.MeshBasicMaterial({ 
                        color: getColorByFaceIndex(colors[5]),
                        side: THREE.DoubleSide
                    })
                );
                face.position.set(cubieSize/2 + gap/2, 0, 0);
                face.rotation.y = Math.PI / 2;
                face.userData.isFace = true;
                face.userData.faceDirection = 'R';
                face.userData.cubieIndex = {x, y, z};
                cubieGroup.add(face);
            }

            const wireframe = new THREE.LineSegments(
                new THREE.EdgesGeometry(new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize)),
                new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            cubieGroup.add(wireframe);
            cubieGroup.userData.isCubie = true;
            cubieGroup.userData.position = {x, y, z};
            return cubieGroup;
        }

        function getColorByFaceIndex(faceIndex) {
            switch(faceIndex) {
                case FACES.U: return COLORS.BLUE;
                case FACES.D: return COLORS.GREEN;
                case FACES.F: return COLORS.WHITE;
                case FACES.B: return COLORS.YELLOW;
                case FACES.L: return COLORS.ORANGE;
                case FACES.R: return COLORS.RED;
                default: return 0x777777;
            }
        }

        function updateCubeDisplay() {
            // No-op: no DOM UI in minimal version
        }

        function isCubeSolved() {
            for (let face = 0; face < 6; face++) {
                let faceColor = -1;
                for (let x = 0; x < 3; x++) {
                    for (let y = 0; y < 3; y++) {
                        for (let z = 0; z < 3; z++) {
                            const cubie = cubeState[x][y][z];
                            let isOnFace = false;
                            let cubieFaceColor = -1;
                            if (face === FACES.U && y === 2) { isOnFace = true; cubieFaceColor = cubie.colors[0]; }
                            if (face === FACES.D && y === 0) { isOnFace = true; cubieFaceColor = cubie.colors[1]; }
                            if (face === FACES.F && z === 2) { isOnFace = true; cubieFaceColor = cubie.colors[2]; }
                            if (face === FACES.B && z === 0) { isOnFace = true; cubieFaceColor = cubie.colors[3]; }
                            if (face === FACES.L && x === 0) { isOnFace = true; cubieFaceColor = cubie.colors[4]; }
                            if (face === FACES.R && x === 2) { isOnFace = true; cubieFaceColor = cubie.colors[5]; }
                            if (isOnFace) {
                                if (faceColor === -1) faceColor = cubieFaceColor;
                                else if (cubieFaceColor !== faceColor) return false;
                            }
                        }
                    }
                }
            }
            return true;
        }

        function rotateFace(face, clockwise = true) {
            if (isRotatingFace) return;

            isRotatingFace = true;
            currentRotation = { face, clockwise };

            // Get all cubies that belong to this face
            const faceCubies = [];
            const faceGroup = new THREE.Group();

            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    for (let z = 0; z < 3; z++) {
                        let isOnFace = false;
                        if (face === FACES.U && y === 2) isOnFace = true;
                        if (face === FACES.D && y === 0) isOnFace = true;
                        if (face === FACES.F && z === 2) isOnFace = true;
                        if (face === FACES.B && z === 0) isOnFace = true;
                        if (face === FACES.L && x === 0) isOnFace = true;
                        if (face === FACES.R && x === 2) isOnFace = true;

                        if (isOnFace) {
                            const cubieIndex = x * 9 + y * 3 + z;
                            faceCubies.push({
                                cubie: state.cubies[cubieIndex],
                                position: { x, y, z }
                            });
                            faceGroup.add(state.cubies[cubieIndex]);
                        }
                    }
                }
            }
            state.scene.add(faceGroup);

            let axis = new THREE.Vector3();
            let angle = clockwise ? -Math.PI / 2 : Math.PI / 2;
            switch(face) {
                case FACES.U: axis.set(0, 1, 0); break;
                case FACES.D: axis.set(0, 1, 0); break;
                case FACES.F: axis.set(0, 0, 1); break;
                case FACES.B: axis.set(0, 0, 1); break;
                case FACES.L: axis.set(1, 0, 0); break;
                case FACES.R: axis.set(1, 0, 0); break;
            }
            if (face === FACES.D || face === FACES.B || face === FACES.R) angle = -angle;
            const startTime = Date.now();
            const duration = 300;

            function animateRotation() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                faceGroup.rotation.setFromVector3(axis.clone().multiplyScalar(angle * easeProgress));
                if (progress < 1) {
                    requestAnimationFrame(animateRotation);
                } else {
                    state.scene.remove(faceGroup);
                    faceCubies.forEach(item => {
                        state.scene.add(item.cubie);
                    });
                    updateCubeStateAfterRotation(face, clockwise);
                    updateCubieTransforms();
                    isRotatingFace = false;
                    currentRotation = null;
                    moveCount++;
                    updateCubeDisplay();
                }
            }
            animateRotation();
        }

        function updateCubeStateAfterRotation(face, clockwise) {
            // Create a copy of the current state
            const newState = [];
            for (let x = 0; x < 3; x++) {
                newState[x] = [];
                for (let y = 0; y < 3; y++) {
                    newState[x][y] = [];
                    for (let z = 0; z < 3; z++) {
                        newState[x][y][z] = {
                            colors: [...cubeState[x][y][z].colors],
                            position: { x, y, z }
                        };
                    }
                }
            }
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    for (let z = 0; z < 3; z++) {
                        let isOnFace = false;
                        if (face === FACES.U && y === 2) isOnFace = true;
                        if (face === FACES.D && y === 0) isOnFace = true;
                        if (face === FACES.F && z === 2) isOnFace = true;
                        if (face === FACES.B && z === 0) isOnFace = true;
                        if (face === FACES.L && x === 0) isOnFace = true;
                        if (face === FACES.R && x === 2) isOnFace = true;

                        if (isOnFace) {
                            let newX = x, newY = y, newZ = z;
                            let oldColors = cubeState[x][y][z].colors;
                            let newColors = [...oldColors];
                            switch(face) {
                                case FACES.U:
                                case FACES.D:
                                    if (face === FACES.D) clockwise = !clockwise;
                                    if (clockwise) {
                                        newX = 2 - z;
                                        newZ = x;
                                        const tempF = newColors[FACES.F];
                                        newColors[FACES.F] = newColors[FACES.L];
                                        newColors[FACES.L] = newColors[FACES.B];
                                        newColors[FACES.B] = newColors[FACES.R];
                                        newColors[FACES.R] = tempF;
                                    } else {
                                        newX = z;
                                        newZ = 2 - x;
                                        const tempF = newColors[FACES.F];
                                        newColors[FACES.F] = newColors[FACES.R];
                                        newColors[FACES.R] = newColors[FACES.B];
                                        newColors[FACES.B] = newColors[FACES.L];
                                        newColors[FACES.L] = tempF;
                                    }
                                    break;
                                case FACES.F:
                                case FACES.B:
                                    if (face === FACES.B) clockwise = !clockwise;
                                    if (clockwise) {
                                        newX = 2 - y;
                                        newY = x;
                                        const tempU = newColors[FACES.U];
                                        newColors[FACES.U] = newColors[FACES.L];
                                        newColors[FACES.L] = newColors[FACES.D];
                                        newColors[FACES.D] = newColors[FACES.R];
                                        newColors[FACES.R] = tempU;
                                    } else {
                                        newX = y;
                                        newY = 2 - x;
                                        const tempU = newColors[FACES.U];
                                        newColors[FACES.U] = newColors[FACES.R];
                                        newColors[FACES.R] = newColors[FACES.D];
                                        newColors[FACES.D] = newColors[FACES.L];
                                        newColors[FACES.L] = tempU;
                                    }
                                    break;
                                case FACES.L:
                                case FACES.R:
                                    if (face === FACES.R) clockwise = !clockwise;
                                    if (clockwise) {
                                        newY = 2 - z;
                                        newZ = y;
                                        const tempU = newColors[FACES.U];
                                        newColors[FACES.U] = newColors[FACES.B];
                                        newColors[FACES.B] = newColors[FACES.D];
                                        newColors[FACES.D] = newColors[FACES.F];
                                        newColors[FACES.F] = tempU;
                                    } else {
                                        newY = z;
                                        newZ = 2 - y;
                                        const tempU = newColors[FACES.U];
                                        newColors[FACES.U] = newColors[FACES.F];
                                        newColors[FACES.F] = newColors[FACES.D];
                                        newColors[FACES.D] = newColors[FACES.B];
                                        newColors[FACES.B] = tempU;
                                    }
                                    break;
                            }
                            newState[newX][newY][newZ] = {
                                colors: newColors,
                                position: { x: newX, y: newY, z: newZ }
                            };
                        }
                    }
                }
            }
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    for (let z = 0; z < 3; z++) {
                        cubeState[x][y][z] = newState[x][y][z];
                    }
                }
            }
        }

        function updateCubieTransforms() {
            // Noop; handled in animation
        }

        function scrambleCube() {
            const moves = ['U', 'D', 'F', 'B', 'L', 'R'];
            const directions = [true, false];
            resetCube();
            for (let i = 0; i < 20; i++) {
                const face = FACES[moves[Math.floor(Math.random() * moves.length)]];
                const clockwise = directions[Math.floor(Math.random() * directions.length)];
                updateCubeStateAfterRotation(face, clockwise);
            }
            recreateVisualCube();
            moveCount = 0;
            updateCubeDisplay();
        }

        function resetCube() {
            initCubeState();
            recreateVisualCube();
            moveCount = 0;
            updateCubeDisplay();
        }

        function recreateVisualCube() {
            if (state.cubies.length > 0) {
                state.cubies.forEach(cubie => {
                    state.scene.remove(cubie);
                });
                state.cubies = [];
            }
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    for (let z = 0; z < 3; z++) {
                        if (x === 1 && y === 1 && z === 1) continue;
                        const cubie = createCubie(x, y, z);
                        state.cubies.push(cubie);
                        state.scene.add(cubie);
                    }
                }
            }
        }

        function onMouseDown(event) {
            event.preventDefault();
            state.controls.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            if (event.button === 2) { // Right click
                state.mouse.x = (event.clientX / state.renderer.domElement.clientWidth) * 2 - 1;
                state.mouse.y = -(event.clientY / state.renderer.domElement.clientHeight) * 2 + 1;
                state.raycaster.setFromCamera(state.mouse, state.camera);
                const intersects = state.raycaster.intersectObjects(state.scene.children, true);
                if (intersects.length > 0) {
                    const face = intersects[0].object;
                    if (face.userData.isFace) {
                        const faceDirection = face.userData.faceDirection;
                        let faceIndex;
                        switch(faceDirection) {
                            case 'U': faceIndex = FACES.U; break;
                            case 'D': faceIndex = FACES.D; break;
                            case 'F': faceIndex = FACES.F; break;
                            case 'B': faceIndex = FACES.B; break;
                            case 'L': faceIndex = FACES.L; break;
                            case 'R': faceIndex = FACES.R; break;
                        }
                        state.controls.isRightDragging = true;
                        state.controls.rotationFace = faceIndex;
                        return;
                    }
                }
            } else if (event.button === 0) {
                state.controls.isLeftDragging = true;
            }
        }

        function onMouseMove(event) {
            if (!state.controls.isLeftDragging && !state.controls.isRightDragging) return;

            const deltaX = event.clientX - state.controls.previousMousePosition.x;
            const deltaY = event.clientY - state.controls.previousMousePosition.y;

            if (state.controls.isLeftDragging) {
                const deltaRotationQuaternion = new THREE.Quaternion()
                    .setFromEuler(new THREE.Euler(
                        (deltaY * 0.01),
                        (deltaX * 0.01),
                        0,
                        'XYZ'
                    ));
                state.cubeGroup.quaternion.multiplyQuaternions(deltaRotationQuaternion, state.cubeGroup.quaternion);
            } else if (state.controls.isRightDragging && !isRotatingFace) {
                const dragThreshold = 30;
                if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
                    let clockwise = true;
                    if (state.controls.rotationFace === FACES.U || state.controls.rotationFace === FACES.D) {
                        clockwise = deltaX > 0;
                    } else if (state.controls.rotationFace === FACES.F || state.controls.rotationFace === FACES.B) {
                        clockwise = deltaX > 0;
                    } else if (state.controls.rotationFace === FACES.L || state.controls.rotationFace === FACES.R) {
                        clockwise = deltaY > 0;
                    }
                    rotateFace(state.controls.rotationFace, clockwise);
                    state.controls.isRightDragging = false;
                }
            }

            state.controls.previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        }

        function onMouseUp(event) {
            state.controls.isLeftDragging = false;
            state.controls.isRightDragging = false;
        }

        function onKeyDown(event) {
            const key = event.key.toUpperCase();
            if (isRotatingFace) return;
            switch(key) {
                case 'U': rotateFace(FACES.U, !event.shiftKey); break;
                case 'D': rotateFace(FACES.D, !event.shiftKey); break;
                case 'F': rotateFace(FACES.F, !event.shiftKey); break;
                case 'B': rotateFace(FACES.B, !event.shiftKey); break;
                case 'L': rotateFace(FACES.L, !event.shiftKey); break;
                case 'R': rotateFace(FACES.R, !event.shiftKey); break;
                case ' ': state.cubeGroup.rotation.set(0, 0, 0); break;
                case 'S': scrambleCube(); break;
                case 'Z': resetCube(); break;
            }
        }

        function init() {
            state = new GameState();

            initCubeState();

            state.scene = new THREE.Scene();
            state.scene.background = new THREE.Color(0x1a1a2e);

            state.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
            state.camera.position.set(5, 5, 5);

            state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            state.renderer.setSize(container.clientWidth, container.clientHeight);
            state.renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(state.renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            state.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 10, 7);
            state.scene.add(directionalLight);

            state.cubeGroup = new THREE.Group();
            state.scene.add(state.cubeGroup);

            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    for (let z = 0; z < 3; z++) {
                        if (x === 1 && y === 1 && z === 1) continue;
                        const cubie = createCubie(x, y, z);
                        state.cubies.push(cubie);
                        state.cubeGroup.add(cubie);
                    }
                }
            }

            state.raycaster = new THREE.Raycaster();
            state.mouse = new THREE.Vector2();

            state.boundResize = () => onResize();
            window.addEventListener('resize', state.boundResize);

            state.boundKeyDown = (e) => onKeyDown(e);
            window.addEventListener('keydown', state.boundKeyDown);

            state.renderer.domElement.addEventListener('mousedown', onMouseDown);
            state.renderer.domElement.addEventListener('mousemove', onMouseMove);
            state.renderer.domElement.addEventListener('mouseup', onMouseUp);
            state.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

            animate();
        }

        function animate() {
            loopId = requestAnimationFrame(animate);
            if (!state) return;
            if (!state.controls.isLeftDragging && !state.controls.isRightDragging && !isRotatingFace) {
                state.cubeGroup.rotation.y += 0.002;
            }
            state.renderer.render(state.scene, state.camera);
        }

        function onResize() {
            if (!state) return;
            state.camera.aspect = container.clientWidth / container.clientHeight;
            state.camera.updateProjectionMatrix();
            state.renderer.setSize(container.clientWidth, container.clientHeight);
        }

        function disposeMesh(mesh) {
            if (!mesh) return;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }

        // Expose cleanup if caller wants it
        function destroy() {
            if (!state) return;
            if (loopId) cancelAnimationFrame(loopId);
            window.removeEventListener('resize', state.boundResize);
            window.removeEventListener('keydown', state.boundKeyDown);
            if (state.renderer) {
                state.renderer.domElement.removeEventListener('mousedown', onMouseDown);
                state.renderer.domElement.removeEventListener('mousemove', onMouseMove);
                state.renderer.domElement.removeEventListener('mouseup', onMouseUp);
                const canvas = state.renderer.domElement;
                if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
                state.renderer.dispose();
            }
            if (state.scene) state.scene.traverse(obj => { if (obj.isMesh) disposeMesh(obj); });
            state = null;
        }

        // Start immediately
        init();

        // Optionally return controls or destroy function for the caller
        return {
            destroy,
            scramble: scrambleCube,
            reset: resetCube,
            getMoveCount: () => moveCount,
            solved: isCubeSolved
        };
    }

    // Export if running in browser module style, otherwise attach to window
    if (typeof module !== "undefined" && module.exports) {
        module.exports = createRubiksCube;
    } else {
        window.createRubiksCube = createRubiksCube;
    }
})();
