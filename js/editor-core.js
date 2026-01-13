
let scene, camera, renderer, raycaster, mouse;
let objects = [];
let selectedObject = null;
let isEditMode = true;
let isDragging = false;
let isPanning = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraTarget = new THREE.Vector3(0, 0, 0);
let cameraDistance = 10;
let cameraTheta = Math.PI / 4;
let cameraPhi = Math.PI / 6;

// Preview mode controls
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
const velocity = new THREE.Vector3();
let prevTime = performance.now();
let pitch = 0;
let yaw = 0;

// Initialize the editor
function init() {
    const canvasElement = document.getElementById('canvas');
    
    // Scene
    scene = new THREE.Scene();
    console.log('hi');
    scene.background = new THREE.Color(0x333333);

    // Camera
    const aspect = canvasElement.offsetWidth / canvasElement.offsetHeight || 16/9;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.updateProjectionMatrix();

    // Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.shadowMap.enabled = true;
    canvasElement.appendChild(renderer.domElement);
    
    // Set renderer size to match the container
    const rect = canvasElement.getBoundingClientRect();
    const width = Math.max(rect.width || 800, 800);
    const height = Math.max(rect.height || 600, 600);
    renderer.setSize(width, height);
    
    // Update camera aspect
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Raycaster for object selection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Add default ground
    addGround();

    // Add default lighting
    addDefaultLights();

    // Add a test cube
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 1, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    objects.push(cube);

    // Add another visible object
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(3, 1, 0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);
    objects.push(sphere);

    // Setup camera controls
    updateCameraPosition();

    // Add event listeners
    setupEventListeners();

    // Start animation loop
    animate();
}

// Setup event listeners
function setupEventListeners() {
    const canvasElement = document.getElementById('canvas');

    canvasElement.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    canvasElement.addEventListener('wheel', onWheel);
    canvasElement.addEventListener('click', onCanvasClick);

    // Preview mode controls
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Inspector input listeners
    const inputs = document.querySelectorAll('.inspector-input');
    inputs.forEach(input => {
        input.addEventListener('change', updateObjectProperty);
        input.addEventListener('input', updateObjectProperty);
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (!isEditMode) {
        // Preview mode camera movement
        const time = performance.now();
        const delta = (time - prevTime) / 1000;
        
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 6.8 * 100.0 * delta/2.5; // gravity
        
        // Movement relative to camera direction
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, forward).normalize();
        
        const inputX = Number(moveRight) - Number(moveLeft);
        const inputZ = Number(moveForward) - Number(moveBackward);
        
        const moveVector = new THREE.Vector3();
        moveVector.addScaledVector(right, inputX);
        moveVector.addScaledVector(forward, inputZ);
        
        if (moveVector.length() > 0) {
            moveVector.normalize();
            velocity.x += moveVector.x * 400.0 * delta;
            velocity.z += moveVector.z * 400.0 * delta;
        }
        
        camera.position.x += velocity.x * delta;
        camera.position.z += velocity.z * delta;
        camera.position.y += velocity.y * delta;
        
        // Ground collision
        if (camera.position.y < 1) {
            velocity.y = 0;
            camera.position.y = 1;
            canJump = true;
        }
        
        prevTime = time;
    } else {
        // Update object highlighting
        objects.forEach(obj => {
            if (obj.isMesh && obj !== selectedObject && !obj.userData.isGround) {
                obj.material.emissive.setHex(0x000000);
            } else if (obj.isMesh && obj === selectedObject && !obj.userData.isGround) {
                obj.material.emissive.setHex(0x222222);
            }
        });
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    const canvas = document.getElementById('canvas');
    camera.aspect = canvas.offsetWidth / canvas.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
});

// Preview mode control functions
function onKeyDown(event) {
    if (isEditMode) return;
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
            if (canJump) velocity.y += 90;
            canJump = false;
            break;
    }
}

function onKeyUp(event) {
    if (isEditMode) return;
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

window.onload = init;
