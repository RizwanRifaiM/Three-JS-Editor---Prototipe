// js/mode-switching.js - Edit and preview mode switching

// Mode switching
function setEditMode() {
    if (!camera) return;
    isEditMode = true;
    document.getElementById('editModeBtn').classList.add('active');
    document.getElementById('previewModeBtn').classList.remove('active');
    camera.position.set(cameraTarget.x + 10, cameraTarget.y + 5, cameraTarget.z + 10);
    camera.lookAt(cameraTarget);
    updateAnimationSection();
}

function setPreviewMode() {
    if (!camera) return;
    isEditMode = false;
    document.getElementById('previewModeBtn').classList.add('active');
    document.getElementById('editModeBtn').classList.remove('active');
    // Reset camera to first-person view position
    camera.position.set(0, 1, 5);
    camera.lookAt(0, 1, 0);
    updateAnimationSection();
}