
// Global storage for loaded textures
const textureCache = {};
const normalMapCache = {};
const heightmapCache = {};

// Update object list in inspector
function updateObjectList() {
    const objectList = document.getElementById('objectList');
    objectList.innerHTML = '';

    objects.forEach((obj, index) => {
        if (!obj.userData.isGround) {
            const div = document.createElement('div');
            div.className = 'selected-object';
            if (obj === selectedObject) div.classList.add('active');
            div.textContent = obj.userData.name || `Object_${index}`;
            div.onclick = () => selectObject(obj);
            objectList.appendChild(div);
        }
    });
}

function selectObject(obj) {
    selectedObject = obj;
    updateObjectList();
    updateInspector();
}

function updateInspector() {
    const propertyEditor = document.getElementById('propertyEditor');
    const materialSection = document.getElementById('materialSection');
    const textureSection = document.getElementById('textureSection');
    const heightmapSection = document.getElementById('heightmapSection');

    if (!selectedObject) {
        propertyEditor.style.display = 'none';
        updateAnimationSection();
        return;
    }
    
    propertyEditor.style.display = 'block';
    
    // Update basic properties
    const inputs = document.querySelectorAll('.inspector-input');
    inputs.forEach(input => {
        const property = input.dataset.property;
        if (property.startsWith('position.')) {
            const axis = property.split('.')[1];
            input.value = selectedObject.position[axis];
        } else if (property.startsWith('rotation.')) {
            const axis = property.split('.')[1];
            input.value = selectedObject.rotation[axis];
        } else if (property.startsWith('scale.')) {
            const axis = property.split('.')[1];
            input.value = selectedObject.scale[axis];
        } else if (property === 'material.color' && selectedObject.material) {
            input.value = '#' + selectedObject.material.color.getHexString();
        } else if (property === 'material.roughness' && selectedObject.material) {
            input.value = selectedObject.material.roughness || 0.7;
        } else if (property === 'material.metalness' && selectedObject.material) {
            input.value = selectedObject.material.metalness || 0.2;
        }
    });
    
    // Show/hide material section
    if (selectedObject.material) {
        materialSection.style.display = 'block';
        textureSection.style.display = 'block';
        
        // Update texture scale display
        const textureScaleInput = document.getElementById('textureScale');
        const textureScaleValue = document.getElementById('textureScaleValue');
        if (textureScaleInput && textureScaleValue) {
            const scale = selectedObject.userData.textureScale || 1;
            textureScaleInput.value = scale;
            textureScaleValue.textContent = scale.toFixed(1);
        }
        
        // Restore texture if it exists in cache
        if (selectedObject.userData.textureFile) {
            const textureKey = selectedObject.userData.textureFile;
            if (textureCache[textureKey]) {
                selectedObject.material.map = textureCache[textureKey];
                selectedObject.material.needsUpdate = true;
            }
        }
        
        // Restore normal map if it exists in cache
        if (selectedObject.userData.normalMapFile) {
            const normalKey = selectedObject.userData.normalMapFile;
            if (normalMapCache[normalKey]) {
                selectedObject.material.normalMap = normalMapCache[normalKey];
                selectedObject.material.needsUpdate = true;
            }
        }
        
        // Check if object has heightmap/displacement capability
        if (selectedObject.userData.type === 'plane' || 
            selectedObject.geometry.type.includes('Plane')) {
            heightmapSection.style.display = 'block';
            
            // Update heightmap controls
            const heightScaleInput = document.getElementById('heightScale');
            const heightScaleValue = document.getElementById('heightScaleValue');
            const heightmapFileInput = document.getElementById('heightmapFile');
            const generateRandomHeightmapBtn = document.getElementById('generateRandomHeightmap');
            
            if (heightScaleInput && heightScaleValue) {
                const heightScale = selectedObject.userData.heightScale || 1.0;
                heightScaleInput.value = heightScale;
                heightScaleValue.textContent = heightScale.toFixed(1);
            }
            
            // Restore heightmap if it exists
            if (selectedObject.userData.hasHeightmap) {
                if (selectedObject.userData.heightmapFile) {
                    const heightmapKey = selectedObject.userData.heightmapFile;
                    if (heightmapCache[heightmapKey]) {
                        applyHeightmapToGeometry(heightmapCache[heightmapKey]);
                    }
                } else if (selectedObject.userData.isRandomHeightmap) {
                    document.getElementById('heightmapFile').style.display = 'none';
                    if (generateRandomHeightmapBtn) {
                        generateRandomHeightmapBtn.textContent = 'Regenerate Random Terrain';
                    }
                }
            }
        } else {
            heightmapSection.style.display = 'none';
        }
        
        // Update terrain info
        updateTerrainInfo();
    } else {
        materialSection.style.display = 'none';
        textureSection.style.display = 'none';
        heightmapSection.style.display = 'none';
    }

    // Update texture preview
    updateTexturePreview();
    
    // Update animation section
    updateAnimationSection();
}

// Update object property from inspector input
function updateObjectProperty(event) {
    if (!selectedObject) return;

    const input = event.target;
    const property = input.dataset.property;
    
    if (input.type === 'color') {
        const value = new THREE.Color(input.value);
        if (property === 'material.color' && selectedObject.material) {
            selectedObject.material.color = value;
        }
    } else {
        const value = parseFloat(input.value);
        
        if (property.startsWith('position.')) {
            const axis = property.split('.')[1];
            selectedObject.position[axis] = value;
        } else if (property.startsWith('rotation.')) {
            const axis = property.split('.')[1];
            selectedObject.rotation[axis] = value;
        } else if (property.startsWith('scale.')) {
            const axis = property.split('.')[1];
            selectedObject.scale[axis] = value;
        } else if (property === 'material.roughness' && selectedObject.material) {
            selectedObject.material.roughness = value;
            selectedObject.material.needsUpdate = true;
        } else if (property === 'material.metalness' && selectedObject.material) {
            selectedObject.material.metalness = value;
            selectedObject.material.needsUpdate = true;
        }
    }
}

// Load texture from file input
function loadTexture(event) {
    if (!selectedObject || !selectedObject.material) return;
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const texture = new THREE.TextureLoader().load(e.target.result);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        // Apply texture scale if exists
        const scale = selectedObject.userData.textureScale || 1;
        texture.repeat.set(scale, scale);
        
        selectedObject.material.map = texture;
        selectedObject.material.needsUpdate = true;
        
        // Store texture in cache
        const textureKey = `${file.name}`;
        textureCache[textureKey] = texture;
        
        // Store texture info in object
        selectedObject.userData.textureFile = textureKey;
        selectedObject.userData.textureOriginalName = file.name;
        
        // Update preview
        updateTexturePreview();
    };
    reader.readAsDataURL(file);
}

// Load normal map
function loadNormalMap(event) {
    if (!selectedObject || !selectedObject.material) return;
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const normalMap = new THREE.TextureLoader().load(e.target.result);
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        
        selectedObject.material.normalMap = normalMap;
        selectedObject.material.needsUpdate = true;
        
        // Store normal map in cache
        const normalKey = `normal_${Date.now()}_${file.name}`;
        normalMapCache[normalKey] = normalMap;
        
        selectedObject.userData.normalMapFile = normalKey;
        selectedObject.userData.normalMapOriginalName = file.name;
    };
    reader.readAsDataURL(file);
}

// Update texture preview
function updateTexturePreview() {
    const preview = document.getElementById('texturePreview');
    const textureName = document.getElementById('textureName');
    
    if (!selectedObject || !selectedObject.material || !selectedObject.material.map) {
        preview.style.backgroundImage = 'none';
        preview.style.backgroundColor = '#333';
        preview.textContent = 'No Texture';
        if (textureName) textureName.textContent = '';
        return;
    }
    
    // Try to create preview from texture image
    const texture = selectedObject.material.map;
    if (texture.image && texture.image.src) {
        // Create scaled preview
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        
        // Draw the texture image
        ctx.drawImage(texture.image, 0, 0, 80, 80);
        preview.style.backgroundImage = `url(${canvas.toDataURL()})`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
        preview.textContent = '';
        
        // Show file name
        if (selectedObject.userData.textureOriginalName) {
            textureName.textContent = selectedObject.userData.textureOriginalName;
        }
    } else {
        // Fallback to pattern
        preview.style.backgroundImage = 'linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)';
        preview.style.backgroundSize = '20px 20px';
        preview.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
        preview.textContent = 'Texture Loaded';
        
        if (selectedObject.userData.textureOriginalName) {
            textureName.textContent = selectedObject.userData.textureOriginalName;
        }
    }
}

function removeTexture() {
    if (!selectedObject || !selectedObject.material) return;
    
    selectedObject.material.map = null;
    selectedObject.material.needsUpdate = true;
    delete selectedObject.userData.textureFile;
    delete selectedObject.userData.textureOriginalName;
    updateTexturePreview();
}

function removeNormalMap() {
    if (!selectedObject || !selectedObject.material) return;
    
    selectedObject.material.normalMap = null;
    selectedObject.material.needsUpdate = true;
    delete selectedObject.userData.normalMapFile;
    delete selectedObject.userData.normalMapOriginalName;
}

function updateTextureScale(event) {
    if (!selectedObject || !selectedObject.material || !selectedObject.material.map) return;
    
    const scale = parseFloat(event.target.value);
    document.getElementById('textureScaleValue').textContent = scale.toFixed(1);
    
    selectedObject.material.map.repeat.set(scale, scale);
    selectedObject.material.map.needsUpdate = true;
    selectedObject.userData.textureScale = scale;
}

// Load heightmap for displacement
function loadHeightmap(event) {
    if (!selectedObject) return;
    
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if object is suitable for heightmaps
    if (!selectedObject.geometry || !selectedObject.geometry.type.includes('Plane')) {
        alert('Heightmaps only work on plane geometries');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Store image in cache
            const heightmapKey = `heightmap_${Date.now()}_${file.name}`;
            heightmapCache[heightmapKey] = img;
            
            // Apply heightmap
            applyHeightmapToGeometry(img, heightmapKey);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function applyHeightmapToGeometry(heightmapImage, heightmapKey = null) {
    if (!selectedObject) return;
    
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
    const positionAttribute = geometry.attributes.position;
    
    // Create canvas to read heightmap data
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(512, heightmapImage.width);
    canvas.height = Math.min(512, heightmapImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(heightmapImage, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Get height scale
    const heightScale = parseFloat(document.getElementById('heightScale').value) || 1.0;
    selectedObject.userData.heightScale = heightScale;
    
    // Apply displacement
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        
        // Map vertex to heightmap coordinates
        const u = (x + 5) / 10; // Normalize to 0-1
        const v = (y + 5) / 10; // Normalize to 0-1
        
        const pixelX = Math.floor(u * (canvas.width - 1));
        const pixelY = Math.floor((1 - v) * (canvas.height - 1));
        
        const pixelIndex = (pixelY * canvas.width + pixelX) * 4;
        // Use average of RGB channels for height
        const r = data[pixelIndex] / 255;
        const g = data[pixelIndex + 1] / 255;
        const b = data[pixelIndex + 2] / 255;
        const height = (r + g + b) / 3;
        
        // Apply height with scaling
        positionAttribute.setZ(i, height * heightScale * 5); // Increased multiplier for more visible effect
    }
    
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Replace geometry
    selectedObject.geometry.dispose();
    selectedObject.geometry = geometry;
    
    // Mark as having heightmap
    selectedObject.userData.hasHeightmap = true;
    selectedObject.userData.isRandomHeightmap = false;
    if (heightmapKey) {
        selectedObject.userData.heightmapFile = heightmapKey;
    }
    
    // Update UI
    document.getElementById('heightmapFile').style.display = 'none';
    document.getElementById('generateRandomHeightmap').textContent = 'Regenerate Random Terrain';
    
    // Update terrain info
    updateTerrainInfo();
}

// Generate random heightmap (for mountains/terrain)
function generateRandomHeightmap() {
    if (!selectedObject) return;
    
    // Check if object is suitable for heightmaps
    if (!selectedObject.geometry || !selectedObject.geometry.type.includes('Plane')) {
        alert('Heightmaps only work on plane geometries');
        return;
    }
    
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
    const positionAttribute = geometry.attributes.position;
    
    // Get height scale
    const heightScale = parseFloat(document.getElementById('heightScale').value) || 3.0;
    selectedObject.userData.heightScale = heightScale;
    
    // Create Perlin-like noise for natural looking terrain
    const noise = new SimplexNoise();
    
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        
        // Generate multiple octaves of noise for more natural terrain
        let height = 0;
        let amplitude = 1;
        let frequency = 1;
        
        for (let octave = 0; octave < 5; octave++) {
            height += amplitude * noise.noise2D(x * frequency * 0.5, y * frequency * 0.5);
            amplitude *= 0.5;
            frequency *= 2;
        }
        
        // Normalize and scale height
        height = (height + 1) * 0.5; // Normalize to 0-1
        height = Math.pow(height, 2); // Make peaks sharper
        
        positionAttribute.setZ(i, height * heightScale * 5); // Increased multiplier
    }
    
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Replace geometry
    selectedObject.geometry.dispose();
    selectedObject.geometry = geometry;
    
    // Mark as having heightmap
    selectedObject.userData.hasHeightmap = true;
    selectedObject.userData.isRandomHeightmap = true;
    delete selectedObject.userData.heightmapFile;
    
    // Update UI
    document.getElementById('heightmapFile').style.display = 'none';
    document.getElementById('generateRandomHeightmap').textContent = 'Regenerate Random Terrain';
    
    // Update terrain info
    updateTerrainInfo();
}

// Update height scale
function updateHeightScale(event) {
    if (!selectedObject || !selectedObject.userData.hasHeightmap) return;
    
    const scale = parseFloat(event.target.value);
    selectedObject.userData.heightScale = scale;
    document.getElementById('heightScaleValue').textContent = scale.toFixed(1);
    
    // Regenerate with new scale
    if (selectedObject.userData.isRandomHeightmap) {
        generateRandomHeightmap();
    } else if (selectedObject.userData.heightmapFile) {
        // Reapply image heightmap with new scale
        const heightmapKey = selectedObject.userData.heightmapFile;
        if (heightmapCache[heightmapKey]) {
            applyHeightmapToGeometry(heightmapCache[heightmapKey], heightmapKey);
        }
    }
}

function resetHeightmap() {
    if (!selectedObject) return;
    
    // Reset to flat plane
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
    
    // Replace geometry
    selectedObject.geometry.dispose();
    selectedObject.geometry = geometry;
    
    // Reset user data
    selectedObject.userData.hasHeightmap = false;
    delete selectedObject.userData.heightScale;
    delete selectedObject.userData.heightmapFile;
    delete selectedObject.userData.isRandomHeightmap;
    
    // Update UI
    document.getElementById('heightmapFile').style.display = 'block';
    document.getElementById('heightScale').value = 1.0;
    document.getElementById('heightScaleValue').textContent = '1.0';
    document.getElementById('generateRandomHeightmap').textContent = 'Generate Random Terrain';
    
    // Update terrain info
    updateTerrainInfo();
}

function updateTerrainInfo() {
    const infoElement = document.getElementById('terrainInfo');
    if (!selectedObject || !selectedObject.userData.hasHeightmap) {
        infoElement.innerHTML = 'Select a plane object to enable terrain tools';
        return;
    }
    
    let info = '';
    if (selectedObject.userData.isRandomHeightmap) {
        info = '📈 Generated terrain (procedural)<br>';
    } else if (selectedObject.userData.heightmapFile) {
        info = '🖼️ Heightmap from image<br>';
    }
    
    info += `📏 Height scale: ${selectedObject.userData.heightScale || 1.0}<br>`;
    info += `🔲 Segments: 100x100<br>`;
    info += `📍 Vertices: ${selectedObject.geometry.attributes.position.count.toLocaleString()}`;
    
    infoElement.innerHTML = info;
}

// Delete selected object
function deleteSelectedObject() {
    if (!selectedObject) return;

    const index = objects.indexOf(selectedObject);
    if (index > -1) {
        objects.splice(index, 1);
        scene.remove(selectedObject);
        selectedObject = null;
        updateObjectList();
        updateInspector();
    }
}

// Update selected object (refresh inspector display)
function updateSelectedObject() {
    if (selectedObject) {
        updateInspector();
    }
}

// Simplex Noise implementation for random terrain generation
class SimplexNoise {
    constructor() {
        this.grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        this.p = [];
        for (let i=0; i<256; i++) {
            this.p[i] = Math.floor(Math.random()*256);
        }
        this.perm = new Array(512);
        for(let i=0; i<512; i++) {
            this.perm[i]=this.p[i & 255];
        }
    }
    
    dot(g, x, y) {
        return g[0]*x + g[1]*y;
    }
    
    noise2D(xin, yin) {
        const F2 = 0.5*(Math.sqrt(3)-1);
        const s = (xin+yin)*F2;
        const i = Math.floor(xin+s);
        const j = Math.floor(yin+s);
        const G2 = (3-Math.sqrt(3))/6;
        const t = (i+j)*G2;
        const X0 = i-t;
        const Y0 = j-t;
        const x0 = xin-X0;
        const y0 = yin-Y0;
        
        let i1, j1;
        if(x0>y0) { i1=1; j1=0; }
        else { i1=0; j1=1; }
        
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2*G2;
        const y2 = y0 - 1 + 2*G2;
        
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.perm[ii+this.perm[jj]] % 12;
        const gi1 = this.perm[ii+i1+this.perm[jj+j1]] % 12;
        const gi2 = this.perm[ii+1+this.perm[jj+1]] % 12;
        
        let t0 = 0.5 - x0*x0 - y0*y0;
        let n0 = t0<0 ? 0.0 : Math.pow(t0,4) * this.dot(this.grad3[gi0], x0, y0);
        
        let t1 = 0.5 - x1*x1 - y1*y1;
        let n1 = t1<0 ? 0.0 : Math.pow(t1,4) * this.dot(this.grad3[gi1], x1, y1);
        
        let t2 = 0.5 - x2*x2 - y2*y2;
        let n2 = t2<0 ? 0.0 : Math.pow(t2,4) * this.dot(this.grad3[gi2], x2, y2);
        
        return 70.0 * (n0 + n1 + n2);
    }
}