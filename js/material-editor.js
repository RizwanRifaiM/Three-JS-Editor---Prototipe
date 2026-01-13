// Fungsi untuk mengunggah tekstur
function loadTexture(file, material, mapType) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const texture = new THREE.TextureLoader().load(e.target.result);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        if (currentObject) {
            if (mapType === 'map') {
                material.map = texture;
                // Simpan file asli dan nama file
                currentObject.userData.originalTextureFile = file;
                currentObject.userData.textureFile = file.name;
                currentObject.userData.texturePath = e.target.result; // Simpan data URL juga
                
                // Simpan repeat properties jika ada
                if (!currentObject.userData.textureRepeat) {
                    currentObject.userData.textureRepeat = { x: 1, y: 1 };
                }
            } else if (mapType === 'normalMap') {
                material.normalMap = texture;
                currentObject.userData.originalNormalMapFile = file;
                currentObject.userData.normalMapFile = file.name;
                currentObject.userData.normalMapPath = e.target.result;
                
                if (!currentObject.userData.normalMapRepeat) {
                    currentObject.userData.normalMapRepeat = { x: 1, y: 1 };
                }
            }
        }
        material.needsUpdate = true;
        
        // Update material preview
        updateMaterialPreview(material);
        showNotification(`Texture "${file.name}" loaded successfully`, 'success');
    };
    reader.onerror = function(error) {
        console.error('Error reading texture file:', error);
        showNotification('Error loading texture file', 'error');
    };
    
    reader.readAsDataURL(file);
}

// Fungsi untuk mengatur texture repeat
function setTextureRepeat(repeatX, repeatY, mapType) {
    if (currentObject && currentObject.material) {
        if (mapType === 'map' && currentObject.material.map) {
            currentObject.material.map.repeat.set(repeatX, repeatY);
            currentObject.userData.textureRepeat = { x: repeatX, y: repeatY };
            currentObject.material.map.needsUpdate = true;
        } else if (mapType === 'normalMap' && currentObject.material.normalMap) {
            currentObject.material.normalMap.repeat.set(repeatX, repeatY);
            currentObject.userData.normalMapRepeat = { x: repeatX, y: repeatY };
            currentObject.material.normalMap.needsUpdate = true;
        }
    }
}

