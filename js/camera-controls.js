// js/camera-controls.js - Camera movement and interaction controls

// Camera controls
function updateCameraPosition() {
    const x = cameraDistance * Math.cos(cameraTheta) * Math.cos(cameraPhi);
    const y = cameraDistance * Math.sin(cameraPhi);
    const z = cameraDistance * Math.sin(cameraTheta) * Math.cos(cameraPhi);

    camera.position.set(
        cameraTarget.x + x,
        cameraTarget.y + y,
        cameraTarget.z + z
    );

    camera.lookAt(cameraTarget);
}

function onMouseDown(event) {
    if (isEditMode) {
        isDragging = true;
        isPanning = event.shiftKey;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    } else {
        // Preview mode
        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function onMouseMove(event) {
    if (isEditMode) {
        if (!isDragging) return;

        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        if (isPanning) {
            const panSpeed = 0.01;
            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();
            const up = new THREE.Vector3(0, 1, 0);

            camera.getWorldDirection(forward);
            right.crossVectors(up, forward).normalize();

            cameraTarget.add(right.multiplyScalar(-deltaMove.x * panSpeed));
            cameraTarget.add(up.multiplyScalar(deltaMove.y * panSpeed));

            updateCameraPosition();
        } else {
            const rotateSpeed = 0.01;
            cameraTheta += deltaMove.x * rotateSpeed;
            cameraPhi += deltaMove.y * rotateSpeed;
            cameraPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraPhi));
            updateCameraPosition();
        }

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    } else {
        // Preview mode mouse look
        if (!isDragging) return;
        
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };
        
        yaw -= deltaMove.x * 0.01;
        pitch -= deltaMove.y * 0.01;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
        
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function onMouseUp() {
    isDragging = false;
}

function onWheel(event) {
    if (!isEditMode) return;

    const zoomSpeed = 0.1;
    cameraDistance = Math.max(1, cameraDistance * (1 + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed)));
    updateCameraPosition();
    event.preventDefault();
}

function onCanvasClick(event) {
    if (!isEditMode) return;

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / canvas.offsetWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / canvas.offsetHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(objects.filter(obj => obj.isMesh && !obj.userData.isGround));

    if (intersects.length > 0) {
        selectObject(intersects[0].object);
    } else {
        selectedObject = null;
        updateInspector();
    }
}