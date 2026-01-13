// js/animation.js - Animation functionality for objects

const THREE = window.THREE;

// Animation variables
let isAnimating = false;
let animationStartTime = 0;
let animationDuration = 2; // seconds
let startPosition = new THREE.Vector3();
let targetPosition = new THREE.Vector3();

// Initialize animation system
function initAnimation() {
    // Animation loop for object animations
    function animateObjects() {
        requestAnimationFrame(animateObjects);

        if (isAnimating && selectedObject) {
            const currentTime = Date.now();
            const elapsed = (currentTime - animationStartTime) / 1000; // Convert to seconds
            const progress = Math.min(elapsed / animationDuration, 1);

            // Smooth interpolation using ease-in-out
            const easedProgress = easeInOutCubic(progress);

            // Interpolate position
            selectedObject.position.lerpVectors(startPosition, targetPosition, easedProgress);

            // Stop animation when complete
            if (progress >= 1) {
                isAnimating = false;
                selectedObject.position.copy(targetPosition);
            }
        }
    }

    animateObjects();
}

// Ease-in-out cubic function for smooth animation
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Animate object to specific position
function animateToPosition() {
    if (!selectedObject || isEditMode) {
        alert('Animation only works in Preview Mode with a selected object!');
        return;
    }

    const posX = parseFloat(document.getElementById('animPosX').value);
    const posY = parseFloat(document.getElementById('animPosY').value);
    const posZ = parseFloat(document.getElementById('animPosZ').value);

    if (isNaN(posX) || isNaN(posY) || isNaN(posZ)) {
        alert('Please enter valid coordinates!');
        return;
    }

    // Stop any current animation
    stopAnimation();

    // Set animation parameters
    startPosition.copy(selectedObject.position);
    targetPosition.set(posX, posY, posZ);
    animationDuration = parseFloat(document.getElementById('animDuration').value) || 2;

    // Start animation
    isAnimating = true;
    animationStartTime = Date.now();
}

// Animate object to camera position
function animateToCamera() {
    if (!selectedObject || isEditMode) {
        alert('Animation only works in Preview Mode with a selected object!');
        return;
    }

    // Stop any current animation
    stopAnimation();

    // Set animation parameters
    startPosition.copy(selectedObject.position);
    targetPosition.copy(camera.position);
    animationDuration = parseFloat(document.getElementById('animDuration').value) || 2;

    // Start animation
    isAnimating = true;
    animationStartTime = Date.now();
}

// Stop current animation
function stopAnimation() {
    isAnimating = false;
}

// Update inspector to show/hide animation section based on mode and selection
function updateAnimationSection() {
    const animationSection = document.getElementById('animationSection');

    if (selectedObject && !isEditMode) {
        animationSection.style.display = 'block';
    } else {
        animationSection.style.display = 'none';
        stopAnimation(); // Stop animation when switching modes
    }
}

// Initialize animation system when page loads
window.addEventListener('load', initAnimation);