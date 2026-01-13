// js/code-generator.js - Code generation and export functionality

// Switch between preview and code modes
function switchToPreview() {
    document.getElementById('canvas').style.display = 'block';
    document.getElementById('codeDisplay').style.display = 'none';
}

function switchToCode() {
    document.getElementById('canvas').style.display = 'none';
    document.getElementById('codeDisplay').style.display = 'block';
    generateCode();
}

// Generate Three.js code from scene
function generateCode() {
    let code = `const scene = new THREE.Scene();
                scene.background = new THREE.Color(0x1a1a1a);

                const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                camera.position.set(0, 1, 5);

                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.shadowMap.enabled = true;
                document.body.appendChild(renderer.domElement);

                // Ground
                const groundGeometry = new THREE.PlaneGeometry(100, 100);
                const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, side: THREE.DoubleSide });
                const ground = new THREE.Mesh(groundGeometry, groundMaterial);
                ground.rotation.x = -Math.PI / 2;
                ground.position.y = -2;
                ground.receiveShadow = true;
                scene.add(ground);

                // Lights\n`;

    // Generate lights code
    let hasLights = false;
    objects.forEach((obj, index) => {
        if (obj.isLight) {
            hasLights = true;
            if (obj.type === 'AmbientLight') {
                code += `// Ambient Light
    const ambientLight = new THREE.AmbientLight(0x${obj.color.getHexString()}, ${obj.intensity});
    scene.add(ambientLight);\n\n`;
            } else if (obj.type === 'DirectionalLight') {
                code += `// Directional Light
    const directionalLight = new THREE.DirectionalLight(0x${obj.color.getHexString()}, ${obj.intensity});
    directionalLight.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
    directionalLight.castShadow = true;
    scene.add(directionalLight);\n\n`;
            } else if (obj.type === 'PointLight') {
                code += `// Point Light
    const pointLight = new THREE.PointLight(0x${obj.color.getHexString()}, ${obj.intensity}, ${obj.distance});
    pointLight.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
    scene.add(pointLight);\n\n`;
            }
        }
    });
    
    if (!hasLights) {
        code += `// Default lights if none were added
            const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 20, 5);
            directionalLight.castShadow = true;
            scene.add(directionalLight);\n\n`;
    }

    code += `// Objects\n`;

    // Generate objects code
    objects.forEach((obj, index) => {
        if (!obj.userData.isGround && !obj.isLight) {
            if (obj.userData.type === 'gltf') {
                // For GLTF models, add loading code
                code += `// Imported model: ${obj.userData.fileName}
            const model${index} = new THREE.Object3D();
            model${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
            model${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
            model${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});

            // Note: To load the GLTF model, you'll need to:
            // 1. Include GLTFLoader: <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
            // 2. Load the model and add it to scene
            // const loader = new THREE.GLTFLoader();
            // loader.load('${obj.userData.fileName}', (gltf) => {
            //     gltf.scene.position.copy(model${index}.position);
            //     gltf.scene.rotation.copy(model${index}.rotation);
            //     gltf.scene.scale.copy(model${index}.scale);
            //     scene.add(gltf.scene);
            // });
            scene.add(model${index});\n\n`;
            } else if (obj.isMesh) {
                const type = obj.userData.type || 'cube';
                const color = obj.material.color.getHexString ? obj.material.color.getHexString() : 'ffffff';
                
                let textureCode = '';
                if (obj.material.map) {
                    // Simpan informasi tekstur
                    obj.userData.textureFile = obj.userData.textureFile || 'texture.png';
                    textureCode = `
            // Load texture
            const textureLoader${index} = new THREE.TextureLoader();
            material${index}.map = textureLoader${index}.load('textures/${obj.userData.textureFile}');
            material${index}.map.wrapS = THREE.RepeatWrapping;
            material${index}.map.wrapT = THREE.RepeatWrapping;`;
                }
                
                if (obj.material.normalMap) {
                    // Simpan informasi normal map
                    obj.userData.normalMapFile = obj.userData.normalMapFile || 'normal.png';
                    textureCode += `
            // Load normal map
            material${index}.normalMap = textureLoader${index}.load('textures/${obj.userData.normalMapFile}');
            material${index}.normalMap.wrapS = THREE.RepeatWrapping;
            material${index}.normalMap.wrapT = THREE.RepeatWrapping;`;
                }
                
                code += `// ${type.charAt(0).toUpperCase() + type.slice(1)}
    const geometry${index} = new THREE.${getGeometryType(obj)};
    const material${index} = new THREE.MeshStandardMaterial({
        color: 0x${color},
        roughness: ${obj.material.roughness || 0.7},
        metalness: ${obj.material.metalness || 0.2}
    });${textureCode}
    const mesh${index} = new THREE.Mesh(geometry${index}, material${index});
    mesh${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
    mesh${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
    mesh${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
    mesh${index}.castShadow = true;
    mesh${index}.receiveShadow = true;
    scene.add(mesh${index});\n\n`;
            }
        }
    });

    // Add camera controls
    code += generateCameraControls();

    document.getElementById('codeDisplay').value = code;
}

function generateCameraControls() {
    return `// Camera controls (WASD movement, mouse look)
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();

let prevTime = performance.now();
let pitch = 0;
let yaw = 0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Smooth camera rotation variables
const rotationSmoothness = 0.15;
let targetPitch = 0;
let targetYaw = 0;
let currentPitch = 0;
let currentYaw = 0;

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveRight = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveLeft = true;
            break;
        case 'Space':
            if (canJump) {
                // Lompatan lebih pendek dan halus (0.27x dari sebelumnya: 350 -> 94.5)
                velocity.y += 90.5;
                canJump = false;
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveRight = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveLeft = false;
            break;
    }
}

function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    if (!isDragging) return;
    
    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };
    
    targetYaw -= deltaMove.x * 0.002;
    targetPitch -= deltaMove.y * 0.002;
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseUp() {
    isDragging = false;
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    
    // Gesekan untuk gerakan lebih halus
    velocity.x -= velocity.x * 12.0 * delta;
    velocity.z -= velocity.z * 12.0 * delta;
    // Gravitasi lebih lembut (0.27x dari sebelumnya: 9.8*100 -> 9.8*27)
    velocity.y -= 9.8 * 27.0 * delta;
    
    // Smooth camera rotation interpolation
    currentYaw += (targetYaw - currentYaw) * rotationSmoothness;
    currentPitch += (targetPitch - currentPitch) * rotationSmoothness;
    
    camera.rotation.order = 'YXZ';
    camera.rotation.y = currentYaw;
    camera.rotation.x = currentPitch;
    
    // Movement relative to camera direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize();
    
    // Calculate movement input
    const inputX = Number(moveRight) - Number(moveLeft);
    const inputZ = Number(moveForward) - Number(moveBackward);
    
    // Create movement vector based on camera orientation
    const moveVector = new THREE.Vector3();
    
    if (inputX !== 0) {
        moveVector.addScaledVector(right, inputX);
    }
    if (inputZ !== 0) {
        moveVector.addScaledVector(forward, inputZ);
    }
    
    if (moveVector.length() > 0) {
        moveVector.normalize();
        // Kecepatan gerakan lebih lambat (0.27x dari 400 -> 108)
        velocity.x += moveVector.x * 108.0 * delta;
        velocity.z += moveVector.z * 108.0 * delta;
    }
    
    // Apply movement
    const deltaVector = new THREE.Vector3(velocity.x * delta, velocity.y * delta, velocity.z * delta);
    camera.position.add(deltaVector);
    
    // Ground collision - dengan threshold yang lebih kecil untuk lompatan pendek
    if (camera.position.y < 1) {
        velocity.y = 0;
        camera.position.y = 1;
        canJump = true;
    }
    
    prevTime = time;
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});`;
}

function getGeometryType(mesh) {
    if (mesh.geometry.type.includes('Box')) return 'BoxGeometry(2, 2, 2)';
    if (mesh.geometry.type.includes('Sphere')) return 'SphereGeometry(1, 32, 32)';
    if (mesh.geometry.type.includes('Cone')) return 'ConeGeometry(1, 2, 32)';
    if (mesh.geometry.type.includes('Cylinder')) return 'CylinderGeometry(1, 1, 2, 32)';
    if (mesh.geometry.type.includes('Plane')) return 'PlaneGeometry(5, 5)';
    return 'BoxGeometry(2, 2, 2)';
}

function debugTextureStatus() {
    console.log('=== Texture Status Debug ===');
    objects.forEach((obj, index) => {
        if (obj.isMesh && (obj.material.map || obj.material.normalMap)) {
            console.log(`Object ${index} (${obj.userData.type || 'unknown'}):`);
            
            if (obj.material.map) {
                console.log('  - Has texture map:', obj.material.map);
                console.log('  - Texture file name:', obj.userData.textureFile);
                console.log('  - Has original file:', !!obj.userData.originalTextureFile);
                if (obj.userData.originalTextureFile) {
                    console.log('  - File size:', obj.userData.originalTextureFile.size, 'bytes');
                }
            }
            
            if (obj.material.normalMap) {
                console.log('  - Has normal map:', obj.material.normalMap);
                console.log('  - Normal map file name:', obj.userData.normalMapFile);
                console.log('  - Has original file:', !!obj.userData.originalNormalMapFile);
            }
        }
    });
    console.log('==========================');
}

// Export game with all objects including GLTF
function exportGame() {
    console.log('Starting export process...');
    debugTextureStatus();
    console.log('Objects to export:', objects.length);
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported 3D Game</title>
    <script src="https://unpkg.com/three@0.128.0/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
        #loading {
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            color: white; 
            font-family: Arial; 
            z-index: 1000;
            font-size: 20px;
            background: rgba(0, 0, 0, 0.7);
            padding: 20px;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div id="loading">Loading models and textures...</div>
    <script>
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1, 5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);

        // Create texture loader
        const textureLoader = new THREE.TextureLoader();
        
        // Track loading progress
        let texturesToLoad = 0;
        let texturesLoaded = 0;
        let modelsToLoad = 0;
        let modelsLoaded = 0;

        function updateLoadingProgress() {
            const loadingDiv = document.getElementById('loading');
            const totalItems = texturesToLoad + modelsToLoad;
            const loadedItems = texturesLoaded + modelsLoaded;
            
            if (totalItems > 0) {
                const percent = Math.round((loadedItems / totalItems) * 100);
                loadingDiv.textContent = \`Loading... \${percent}% (\${loadedItems}/\${totalItems})\`;
            }
            
            if (loadedItems >= totalItems && totalItems > 0) {
                setTimeout(() => {
                    loadingDiv.style.display = 'none';
                    console.log('All assets loaded successfully');
                }, 500);
            }
        }

        // Ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3a3a3a, 
            side: THREE.DoubleSide 
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Lights\n`;
        // Export game with all objects including GLTF    
    // Hitung jumlah textures dan models yang akan di-load
    let texturesToLoad = 0;
    let modelsToLoad = 0;

    // Count textures to load
    objects.forEach(obj => {
        if (obj.isMesh && obj.material.map) {
            texturesToLoad++;
        }
        if (obj.isMesh && obj.material.normalMap) {
            texturesToLoad++;
        }
        if (obj.userData.type === 'gltf') {
            modelsToLoad++;
        }
    });

    // Add all lights
    objects.forEach((obj, index) => {
        if (obj.isLight) {
            if (obj.type === 'AmbientLight') {
                html += `        // Ambient Light ${index}
        const ambientLight${index} = new THREE.AmbientLight(0x${obj.color.getHexString()}, ${obj.intensity});
        scene.add(ambientLight${index});\n`;
            } else if (obj.type === 'DirectionalLight') {
                html += `        // Directional Light ${index}
        const directionalLight${index} = new THREE.DirectionalLight(0x${obj.color.getHexString()}, ${obj.intensity});
        directionalLight${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        directionalLight${index}.castShadow = true;
        directionalLight${index}.shadow.mapSize.width = 2048;
        directionalLight${index}.shadow.mapSize.height = 2048;
        scene.add(directionalLight${index});\n`;
            } else if (obj.type === 'PointLight') {
                html += `        // Point Light ${index}
        const pointLight${index} = new THREE.PointLight(0x${obj.color.getHexString()}, ${obj.intensity}, ${obj.distance});
        pointLight${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        pointLight${index}.castShadow = true;
        scene.add(pointLight${index});\n`;
            }
        }
    });

    // Add all meshes
    objects.forEach((obj, index) => {
    if (!obj.userData.isGround && !obj.isLight) {
        if (obj.userData.type === 'gltf') {
            html += `        // GLTF Model: ${obj.userData.fileName}
        const modelPlaceholder${index} = new THREE.Object3D();
        modelPlaceholder${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        modelPlaceholder${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
        modelPlaceholder${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
        scene.add(modelPlaceholder${index});\n`;
                
        } else if (obj.isMesh) {
            const type = obj.userData.type || 'cube';
            const color = obj.material.color.getHexString ? obj.material.color.getHexString() : 'ffffff';
            
            // Generate unique ID untuk texture - gunakan string biasa, bukan template literal
            const textureId = index;
            let textureCode = '';
            
            if (obj.material.map) {
                const textureName = obj.userData.textureFile || (textureId + '.jpg');
                textureCode = `
            // Texture: ${textureName}
            material${index}.map = textureLoader.load('textures/${textureName}', 
                function() {
                    material${index}.needsUpdate = true;
                    texturesLoaded++;
                    updateLoadingProgress();
                },
                undefined,
                function(error) {
                    console.error('Error loading texture ${textureName}:', error);
                    texturesLoaded++;
                    updateLoadingProgress();
                }
            );
            material${index}.map.wrapS = THREE.RepeatWrapping;
            material${index}.map.wrapT = THREE.RepeatWrapping;`;
                
                // Tambahkan texture repeat jika ada
                if (obj.userData.textureRepeat) {
                    textureCode += `
            material${index}.map.repeat.set(${obj.userData.textureRepeat.x}, ${obj.userData.textureRepeat.y});`;
                }
            }
            
            if (obj.material.normalMap) {
                const normalMapName = obj.userData.normalMapFile || (textureId + '_normal.jpg');
                // Perbaiki: tambahkan dengan +=, bukan mengganti string
                textureCode += `
            // Normal Map: ${normalMapName}
            material${index}.normalMap = textureLoader.load('textures/${normalMapName}', 
                function() {
                    material${index}.needsUpdate = true;
                    texturesLoaded++;
                    updateLoadingProgress();
                },
                undefined,
                function(error) {
                    console.error('Error loading normal map ${normalMapName}:', error);
                    texturesLoaded++;
                    updateLoadingProgress();
                }
            );
            material${index}.normalMap.wrapS = THREE.RepeatWrapping;
            material${index}.normalMap.wrapT = THREE.RepeatWrapping;`;
                
                if (obj.userData.normalMapRepeat) {
                    textureCode += `
            material${index}.normalMap.repeat.set(${obj.userData.normalMapRepeat.x}, ${obj.userData.normalMapRepeat.y});`;
                }
            }
            
            // Sekarang type bisa digunakan karena masih dalam scope yang sama
            const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
            html += `        // ${capitalizedType} ${index}
        const geometry${index} = new THREE.${getGeometryType(obj)};
        const material${index} = new THREE.MeshStandardMaterial({
            color: 0x${color},
            roughness: ${obj.material.roughness || 0.7},
            metalness: ${obj.material.metalness || 0.2}
        });${textureCode}
        const mesh${index} = new THREE.Mesh(geometry${index}, material${index});
        mesh${index}.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
        mesh${index}.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});
        mesh${index}.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
        mesh${index}.castShadow = true;
        mesh${index}.receiveShadow = true;
        scene.add(mesh${index});\n`;
        }
    }
});
    

    // Add default lights if no lights were added
    let hasExportedLights = false;
    objects.forEach(obj => {
        if (obj.isLight) hasExportedLights = true;
    });
    
    if (!hasExportedLights) {
        html += `        // Default lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);\n`;
    }

    // Add GLTF loading code if there are models
    if (modelsToLoad > 0) {
        html += `
        // GLTF Models loading
        const loader = new THREE.GLTFLoader();
        \n`;

        objects.forEach((obj, index) => {
            if (obj.userData.type === 'gltf') {
                html += `
        // Loading model: ${obj.userData.fileName}
        loader.load('models/${obj.userData.fileName}', 
            function(gltf) {
                console.log('Model loaded:', '${obj.userData.fileName}');
                gltf.scene.position.copy(modelPlaceholder${index}.position);
                gltf.scene.rotation.copy(modelPlaceholder${index}.rotation);
                gltf.scene.scale.copy(modelPlaceholder${index}.scale);
                
                // Enable shadows for all meshes in the model
                gltf.scene.traverse(function(child) {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Update material for better rendering
                        if (child.material) {
                            child.material.needsUpdate = true;
                        }
                    }
                });
                
                // Replace placeholder with actual model
                scene.remove(modelPlaceholder${index});
                scene.add(gltf.scene);
                
                modelsLoaded++;
                updateLoadingProgress();
                console.log('Models loaded:', modelsLoaded, '/', modelsToLoad);
            }, 
            // onProgress callback
            function(xhr) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                console.log('Loading ${obj.userData.fileName}:', percent + '%');
            },
            // onError callback
            function(error) {
                console.error('Error loading model ${obj.userData.fileName}:', error);
                modelsLoaded++;
                updateLoadingProgress();
            }
        );\n`;
            }
        });
    }

    // Update loading progress initially
    html += `
        // Initial loading progress update
        updateLoadingProgress();\n`;

    // Add camera controls
    html += `
        ${generateCameraControls()}
    </script>
</body>
</html>`;

    // Create a ZIP file containing the HTML and all assets
    const zip = new JSZip();
    zip.file("game.html", html);
    
    // Create folders
    const modelsFolder = zip.folder("models");
    const texturesFolder = zip.folder("textures");

    console.log('Creating ZIP structure...');
    
    // Add all GLTF models to the ZIP
    let modelsAdded = 0;
    objects.forEach((obj) => {
        if (obj.userData.type === 'gltf' && obj.userData.originalFile) {
            try {
                modelsFolder.file(obj.userData.fileName, obj.userData.originalFile);
                modelsAdded++;
                console.log(`✓ Added model: ${obj.userData.fileName} (${(obj.userData.originalFile.size / 1024).toFixed(2)} KB)`);
            } catch (error) {
                console.error(`✗ Error adding model ${obj.userData.fileName}:`, error);
            }
        }
    });

    // Add all texture files to the ZIP
    let texturesAdded = 0;
    objects.forEach((obj, index) => {
        if (obj.isMesh && obj.material.map) {
            const textureName = obj.userData.textureFile || `${index}.jpg`;
            
            // Cek apakah ada file asli
            if (obj.userData.originalTextureFile) {
                try {
                    texturesFolder.file(textureName, obj.userData.originalTextureFile);
                    texturesAdded++;
                    console.log(`✓ Added texture: ${textureName} (${(obj.userData.originalTextureFile.size / 1024).toFixed(2)} KB)`);
                } catch (error) {
                    console.error(`✗ Error adding texture ${textureName}:`, error);
                    // Coba simpan dari data URL jika ada
                    if (obj.userData.texturePath) {
                        try {
                            const blob = dataURLtoBlob(obj.userData.texturePath);
                            texturesFolder.file(textureName, blob);
                            texturesAdded++;
                            console.log(`✓ Added texture from data URL: ${textureName}`);
                        } catch (e) {
                            console.error(`✗ Could not save texture from data URL:`, e);
                        }
                    }
                }
            } else if (obj.userData.texturePath) {
                // Coba simpan dari data URL
                try {
                    const blob = dataURLtoBlob(obj.userData.texturePath);
                    texturesFolder.file(textureName, blob);
                    texturesAdded++;
                    console.log(`✓ Added texture from data URL: ${textureName} (${(blob.size / 1024).toFixed(2)} KB)`);
                } catch (error) {
                    console.error(`✗ Could not save texture from data URL:`, error);
                }
            } else {
                console.warn(`⚠ Texture file not found for object ${index}: ${textureName}`);
                // Buat texture placeholder (kotak warna solid)
                createTexturePlaceholder(textureName, obj.material.color || 0xffffff, texturesFolder);
            }
        }
        
        if (obj.isMesh && obj.material.normalMap) {
            const normalMapName = obj.userData.normalMapFile || normal_(Date.now())(index.jpg);
            
            if (obj.userData.originalNormalMapFile) {
                try {
                    texturesFolder.file(normalMapName, obj.userData.originalNormalMapFile);
                    texturesAdded++;
                    console.log(`✓ Added normal map:`, normalMapName);
                } catch (error) {
                    console.error(`✗ Error adding normal map ${normalMapName}:`, error);
                }
            } else if (obj.userData.normalMapPath) {
                try {
                    const blob = dataURLtoBlob(obj.userData.normalMapPath);
                    texturesFolder.file(normalMapName, blob);
                    texturesAdded++;
                    console.log(`✓ Added normal map from data URL:`,normalMapName);
                } catch (error) {
                    console.error(`✗ Could not save normal map from data URL:`, error);
                }
            }
        }
    });
        

    // Helper function untuk convert data URL ke blob
    function dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    // Helper function untuk membuat texture placeholder
    function createTexturePlaceholder(filename, color, folder) {
        try {
            // Buat canvas untuk texture placeholder
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Isi dengan warna
            const hexColor = typeof color === 'number' ? color.toString(16).padStart(6, '0') : '808080';
            ctx.fillStyle ='#'+hexColor;
            ctx.fillRect(0, 0, 256, 256);
            
            // Tambahkan grid untuk menunjukkan bahwa ini placeholder
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            for (let i = 0; i <= 256; i += 32) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 256);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(256, i);
                ctx.stroke();
            }
            
            // Tambahkan teks "Placeholder"
            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TEXTURE', 128, 100);
            ctx.fillText('PLACEHOLDER', 128, 130);
            
            // Convert ke blob
            canvas.toBlob((blob) => {
                if (blob) {
                    folder.file(filename, blob);
                    console.log('✓ Created texture placeholder:',filename);
                }
            }, 'image/png');
        } catch (error) {
            console.error('✗ Error creating texture placeholder:', error);
        }
    }

    console.log('Export summary:');
    console.log('- Models added: ',modelsAdded);
    console.log('- Textures added: ',texturesAdded);
    console.log('- Total objects: ',objects.length);

    // Generate and download the ZIP
    zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
            level: 6
        }
    })
    .then(function(content) {
        const totalSize = (content.size / 1024 / 1024).toFixed(2);
        console.log(`ZIP file generated successfully!`);
        console.log(`- Total size: ${totalSize} MB`);
        console.log(`- Models: ${modelsAdded}`);
        console.log(`- Textures: ${texturesAdded}`);
        
        const a = document.createElement('a');
        const url = URL.createObjectURL(content);
        a.href = url;
        a.download = '3d-game-export.zip';
        
        // Show download notification
        showNotification(`Game exported successfully!<br>Downloading ${totalSize} MB file..., 'success'`);
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        setTimeout(() => {
            URL.revokeObjectURL(url);
            console.log('URL object revoked');
        }, 1000);
    })
    .catch(function(error) {
        console.error('Error generating ZIP:', error);
        showNotification('Error exporting game: ' + error.message, 'error');
    });



// Helper function to show notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-family: Arial, sans-serif;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
        }, 300);
    }, 5000);
}
}