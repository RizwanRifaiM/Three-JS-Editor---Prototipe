// js/object-management.js - Object creation and management functions

// Add ground plane
function addGround() {
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    ground.userData.isGround = true;
    scene.add(ground);
    objects.push(ground);
}

// Add default lights
function addDefaultLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x808080, 0.6);
    scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    objects.push(ambientLight, directionalLight);
}

// Add 3D objects
function addObject(type) {
    if (!scene) return;
    let geometry, material, mesh;

    switch(type) {
        case 'cube':
            geometry = new THREE.BoxGeometry(2, 2, 2);
            material = new THREE.MeshStandardMaterial({
                color: Math.random() * 0xffffff,
                roughness: 0.7,
                metalness: 0.2
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 1, 0);
            break;

        case 'sphere':
            geometry = new THREE.SphereGeometry(1, 32, 32);
            material = new THREE.MeshStandardMaterial({
                color: Math.random() * 0xffffff,
                roughness: 0.7,
                metalness: 0.2
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 1, 0);
            break;

        case 'cone':
            geometry = new THREE.ConeGeometry(1, 2, 32);
            material = new THREE.MeshStandardMaterial({
                color: Math.random() * 0xffffff,
                roughness: 0.7,
                metalness: 0.2
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 1, 0);
            break;

        case 'cylinder':
            geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
            material = new THREE.MeshStandardMaterial({
                color: Math.random() * 0xffffff,
                roughness: 0.7,
                metalness: 0.2
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 1, 0);
            break;

        case 'plane':
            geometry = new THREE.PlaneGeometry(5, 5);
            material = new THREE.MeshStandardMaterial({
                color: Math.random() * 0xffffff,
                side: THREE.DoubleSide
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 1, 0);
            break;
    }

    if (mesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.type = type;
        mesh.userData.name = `${type}_${objects.length}`;
        scene.add(mesh);
        objects.push(mesh);
        updateObjectList();
        selectObject(mesh);
    }
}

// Add lights
function addLight(type) {
    if (!scene) return;
    let light;

    switch(type) {
        case 'ambient':
            light = new THREE.AmbientLight(0xffffff, 0.5);
            light.userData.type = 'ambientLight';
            light.userData.name = `AmbientLight_${objects.length}`;
            break;

        case 'directional':
            light = new THREE.DirectionalLight(0xffffff, 0.8);
            light.position.set(5, 10, 3);
            light.castShadow = true;
            light.userData.type = 'directionalLight';
            light.userData.name = `DirectionalLight_${objects.length}`;
            break;

        case 'point':
            light = new THREE.PointLight(0xffffff, 1, 100);
            light.position.set(0, 5, 0);
            light.userData.type = 'pointLight';
            light.userData.name = `PointLight_${objects.length}`;
            break;
    }

    if (light) {
        scene.add(light);
        objects.push(light);
        updateObjectList();
        selectObject(light);
    }
}

// Load GLTF models
// Update the loadGLTF function:
function loadGLTF(file) {
    if (!scene) return;
    if (!file) return;

    const loader = new THREE.GLTFLoader();
    const reader = new FileReader();

    reader.onload = function(e) {
        loader.parse(e.target.result, '', function(gltf) {
            const model = gltf.scene;
            model.position.set(0, 1, 0);
            model.scale.set(1, 1, 1);
            model.userData.type = 'gltf';
            model.userData.name = `Model_${objects.length}`;
            model.userData.fileName = file.name;
            // Store the original file for export
            model.userData.originalFile = file;

            // Enable shadows for all meshes in the model
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(model);
            objects.push(model);
            updateObjectList();
            selectObject(model);
        });
    };

    reader.readAsArrayBuffer(file);
}