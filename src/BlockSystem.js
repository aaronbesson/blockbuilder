import * as THREE from 'three';

// Define block types with their properties
const BLOCK_TYPES = {
  GRASS: { 
    color: 0x3A9D23, 
    name: 'Grass' 
  },
  DIRT: { 
    color: 0x8B4513, 
    name: 'Dirt' 
  },
  STONE: { 
    color: 0x7D7D7D, 
    name: 'Stone' 
  },
  WOOD: { 
    color: 0x966F33, 
    name: 'Wood' 
  },
  WATER: { 
    color: 0x1CA3EC, 
    name: 'Water', 
    transparent: true, 
    opacity: 0.7 
  },
  SAND: { 
    color: 0xEDC9AF, 
    name: 'Sand' 
  },
};

export class BlockSystem {
  constructor(scene) {
    this.scene = scene;
    this.blocks = new Map(); // Map to store blocks: key = "x,y,z", value = mesh
    this.blockSize = 1; // Size of each block (1x1x1 units)
    this.selectedBlockType = BLOCK_TYPES.GRASS; // Default selected block type
    
    // Create block geometry (shared across all blocks)
    this.blockGeometry = new THREE.BoxGeometry(
      this.blockSize, 
      this.blockSize, 
      this.blockSize
    );
    
    // Create block materials (shared across block types)
    this.blockMaterials = this.createBlockMaterials();
    
    // Create a highlighted block preview for placement
    this.createHighlightBlock();
    
    // Raycaster for block placement
    this.raycaster = new THREE.Raycaster();
  }
  
  // Create materials for each block type
  createBlockMaterials() {
    const materials = {};
    
    for (const [type, props] of Object.entries(BLOCK_TYPES)) {
      materials[type] = new THREE.MeshStandardMaterial({
        color: props.color,
        roughness: 0.7,
        metalness: 0.0,
        transparent: props.transparent || false,
        opacity: props.opacity || 1.0
      });
    }
    
    return materials;
  }
  
  // Create a semi-transparent block to show where a block will be placed
  createHighlightBlock() {
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      wireframe: true
    });
    
    this.highlightBlock = new THREE.Mesh(this.blockGeometry, highlightMaterial);
    this.highlightBlock.visible = false;
    this.scene.add(this.highlightBlock);
  }
  
  // Set the currently selected block type
  setSelectedBlockType(type) {
    if (BLOCK_TYPES[type]) {
      this.selectedBlockType = BLOCK_TYPES[type];
      return true;
    }
    return false;
  }
  
  // Get available block types
  getBlockTypes() {
    return BLOCK_TYPES;
  }
  
  // Convert world position to grid position (snap to grid)
  worldToGrid(position) {
    return {
      x: Math.floor(position.x / this.blockSize),
      y: Math.floor(position.y / this.blockSize),
      z: Math.floor(position.z / this.blockSize)
    };
  }
  
  // Convert grid position to world position
  gridToWorld(gridPos) {
    return {
      x: gridPos.x * this.blockSize + this.blockSize / 2,
      y: gridPos.y * this.blockSize + this.blockSize / 2,
      z: gridPos.z * this.blockSize + this.blockSize / 2
    };
  }
  
  // Create a key string from grid position
  positionToKey(pos) {
    return `${pos.x},${pos.y},${pos.z}`;
  }
  
  // Parse a key string back to grid position
  keyToPosition(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  }
  
  // Check if a block exists at the given grid position
  hasBlock(gridPos) {
    return this.blocks.has(this.positionToKey(gridPos));
  }
  
  // Update the highlight block position based on raycaster intersection
  updateHighlightPosition(intersection, face) {
    if (!intersection) {
      this.highlightBlock.visible = false;
      return null;
    }
    
    // Calculate grid position for the new block
    let position = intersection.point.clone();
    
    // Adjust position based on the face normal
    position.add(face.normal.clone().multiplyScalar(this.blockSize / 2));
    
    // Snap to grid
    const gridPos = this.worldToGrid(position);
    
    // Check if position is valid (not occupied)
    if (this.hasBlock(gridPos)) {
      this.highlightBlock.visible = false;
      return null;
    }
    
    // Place highlight at correct world position
    const worldPos = this.gridToWorld(gridPos);
    this.highlightBlock.position.set(
      worldPos.x - this.blockSize / 2, 
      worldPos.y - this.blockSize / 2, 
      worldPos.z - this.blockSize / 2
    );
    this.highlightBlock.visible = true;
    
    return gridPos;
  }
  
  // Place a block at the given grid position
  placeBlock(gridPos) {
    if (this.hasBlock(gridPos)) {
      return false; // Block already exists here
    }
    
    // Get the block type key from the selected block type
    const blockTypeKey = Object.keys(BLOCK_TYPES).find(
      key => BLOCK_TYPES[key].name === this.selectedBlockType.name
    );
    
    // Create new block mesh using the block type key
    const material = this.blockMaterials[blockTypeKey];
    
    const blockMesh = new THREE.Mesh(this.blockGeometry, material);
    
    // Position the block
    const worldPos = this.gridToWorld(gridPos);
    blockMesh.position.set(
      worldPos.x - this.blockSize / 2, 
      worldPos.y - this.blockSize / 2, 
      worldPos.z - this.blockSize / 2
    );
    
    // Set up shadows
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    
    // Add to scene and store in blocks map
    this.scene.add(blockMesh);
    this.blocks.set(this.positionToKey(gridPos), blockMesh);
    
    return true;
  }
  
  // Remove a block at the given grid position
  removeBlock(gridPos) {
    const key = this.positionToKey(gridPos);
    
    if (this.blocks.has(key)) {
      const blockMesh = this.blocks.get(key);
      this.scene.remove(blockMesh);
      this.blocks.delete(key);
      return true;
    }
    
    return false;
  }
  
  // Process a click event for placing or removing blocks
  handleClick(intersection, face, isRightClick) {
    if (!intersection) return false;
    
    if (isRightClick) {
      // Right click: remove block
      const gridPos = this.worldToGrid(intersection.point);
      return this.removeBlock(gridPos);
    } else {
      // Left click: place block
      const position = intersection.point.clone();
      position.add(face.normal.clone().multiplyScalar(this.blockSize / 2));
      const gridPos = this.worldToGrid(position);
      return this.placeBlock(gridPos);
    }
  }
}

export { BLOCK_TYPES }; 