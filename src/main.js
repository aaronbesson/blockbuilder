import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Main application class
class BlockBuilder {
  constructor() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff); // White background
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0xffffff); // White background
    document.getElementById('app').appendChild(this.renderer.domElement);
    
    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.update();
    
    // Add minimal lighting
    this.setupLights();
    
    // Set up grid helper (minimal grid)
    this.setupGrid();
    
    // Initialize raycaster and mouse
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Store available block models
    this.blockModels = {};
    this.selectedModel = null;
    
    // Initialize the GLTF loader
    this.gltfLoader = new GLTFLoader();
    
    // Load block models
    this.loadBlockModels();
    
    // Add preview block for placement
    this.createPreviewBlock();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Handle window resizing
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Start render loop
    this.animate();
    
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragThreshold = 5; // Pixels of movement to consider as dragging
    this.clickedOnUI = false; // Track if the click started on a UI element
  }
  
  // Set up scene lighting
  setupLights() {
    // Simple ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Directional light for subtle shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }
  
  // Setup invisible plane for raycasting (no visible grid)
  setupGrid() {
    // No visible grid helper
    
    // Ground plane for raycasting - completely invisible
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
      visible: false  // Make the plane completely invisible
    });
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.plane.rotation.x = -Math.PI / 2; // Horizontal
    this.plane.position.y = 0; // At grid level
    this.scene.add(this.plane);
    
    // Blocks group and tracking
    this.blocksGroup = new THREE.Group();
    this.scene.add(this.blocksGroup);
    this.occupiedPositions = new Set();
    
    // Colors for blocks
    this.colors = [
      0x000000, // Black
      0x333333, // Dark gray
      0x666666, // Medium gray
      0x999999, // Light gray
    ];
  }
  
  // Load block models from the /public/blocks directory
  loadBlockModels() {
    // Fetch block definitions from the JSON file
    fetch('/blocks/blocks.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load blocks.json');
        }
        return response.json();
      })
      .then(data => {
        const modelFiles = data.blocks;
        
        // Sort models alphabetically by ID
        modelFiles.sort((a, b) => a.id.localeCompare(b.id));
        
        // Pagination setup - adjusted for larger block sizes (6 per page)
        this.pagination = {
          itemsPerPage: 6,
          currentPage: 1,
          totalItems: modelFiles.length,
          totalPages: Math.ceil(modelFiles.length / 6)
        };
        
        // Update pagination display
        document.getElementById('total-pages').textContent = this.pagination.totalPages;
        document.getElementById('current-page').textContent = this.pagination.currentPage;
        
        // Store all model data for pagination
        this.allModelFiles = modelFiles;
        
        // Get UI elements
        const blockSelector = document.getElementById('block-selector');
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');
        
        // Add event listeners for pagination buttons
        prevButton.addEventListener('click', () => {
          if (this.pagination.currentPage > 1) {
            this.pagination.currentPage--;
            this.updatePagination();
          }
        });
        
        nextButton.addEventListener('click', () => {
          if (this.pagination.currentPage < this.pagination.totalPages) {
            this.pagination.currentPage++;
            this.updatePagination();
          }
        });
        
        // Initialize pagination
        this.updatePagination();
      })
      .catch(error => {
        console.error('Error loading block models:', error);
        // Fallback to default blocks if JSON fails to load
        const modelFiles = [
          { id: 'block-grass', file: 'block-grass.glb' },
          { id: 'block-grass-large', file: 'block-grass-large.glb' },
          { id: 'block-grass-corner', file: 'block-grass-corner.glb' }
        ];
        this.allModelFiles = modelFiles;
        // Set up pagination with fallback data
        this.pagination = {
          itemsPerPage: 6,
          currentPage: 1,
          totalItems: modelFiles.length,
          totalPages: Math.ceil(modelFiles.length / 6)
        };
        this.updatePagination();
      });
  }
  
  // Update pagination display and load visible models
  updatePagination() {
    // Update buttons state
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    prevButton.disabled = this.pagination.currentPage === 1;
    nextButton.disabled = this.pagination.currentPage === this.pagination.totalPages;
    
    // Update current page display
    document.getElementById('current-page').textContent = this.pagination.currentPage;
    
    // Calculate visible items
    const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
    const endIndex = Math.min(startIndex + this.pagination.itemsPerPage, this.pagination.totalItems);
    const visibleModels = this.allModelFiles.slice(startIndex, endIndex);
    
    // Clear current block selector
    const blockSelector = document.getElementById('block-selector');
    blockSelector.innerHTML = '';
    
    // Load and add visible models
    visibleModels.forEach((model, index) => {
      // Create option element first
      const option = document.createElement('div');
      option.className = 'block-option';
      option.dataset.modelId = model.id;
      
      // Add to DOM immediately so the UI builds progressively
      blockSelector.appendChild(option);
      
      // Create a preview image
      const img = document.createElement('img');
      img.src = `/preview/${model.file.replace('.glb', '.png')}`;
      img.alt = model.id;
      
      // Handle image load errors with fallback
      img.onerror = () => {
        const fallbackPreview = document.createElement('div');
        fallbackPreview.style.width = '100%';
        fallbackPreview.style.height = '100%';
        fallbackPreview.style.backgroundColor = '#888888';
        fallbackPreview.textContent = model.id.substring(0, 4);
        fallbackPreview.style.fontSize = '10px';
        fallbackPreview.style.display = 'flex';
        fallbackPreview.style.justifyContent = 'center';
        fallbackPreview.style.alignItems = 'center';
        option.appendChild(fallbackPreview);
        img.remove();
      };
      
      option.appendChild(img);
      
      // Add click handler
      option.addEventListener('click', () => {
        // Load the model if not loaded yet
        if (!this.blockModels[model.id]) {
          this.gltfLoader.load(`/blocks/${model.file}`, (gltf) => {
            this.blockModels[model.id] = gltf;
            this.selectModel(model.id);
          });
        } else {
          this.selectModel(model.id);
        }
      });
      
      // Load the model in background
      this.gltfLoader.load(`/blocks/${model.file}`, (gltf) => {
        this.blockModels[model.id] = gltf;
        
        // Set first model in first page as default
        if (this.pagination.currentPage === 1 && index === 0 && !this.selectedModel) {
          this.selectModel(model.id);
        }
      });
    });
  }
  
  // Select a model and update UI
  selectModel(modelId) {
    // Update selected model
    this.selectedModel = modelId;
    
    // Update UI to show selection
    document.querySelectorAll('.block-option').forEach(el => {
      el.classList.remove('selected');
      if (el.dataset.modelId === modelId) {
        el.classList.add('selected');
      }
    });
  }
  
  // Set up mouse and touch event listeners
  setupEventListeners() {
    // Mouse move for highlighting blocks
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Mouse click for placing/removing blocks
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }
  
  // Create a preview block to show where blocks will be placed
  createPreviewBlock() {
    const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01); // Slightly larger than the blocks
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      opacity: 0.2,
      transparent: true,
      wireframe: true,
      depthTest: false // Make sure it's visible through other objects
    });
    
    this.previewBlock = new THREE.Mesh(geometry, material);
    this.previewBlock.visible = false;
    this.scene.add(this.previewBlock);
  }
  
  // Helper function to get position key
  getKey(pos) {
    return `${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}`;
  }
  
  // Add block function - now places the selected .glb model
  addBlock(pos) {
    // Check if model is loaded
    if (!this.selectedModel || !this.blockModels[this.selectedModel]) {
      console.warn('No model selected or model not loaded yet');
      return false;
    }
    
    // Check if position is already occupied
    const key = this.getKey(pos);
    if (this.occupiedPositions.has(key)) {
      return false;
    }
    
    // Clone the model
    const gltf = this.blockModels[this.selectedModel];
    const modelScene = gltf.scene.clone();
    
    // Position the model
    modelScene.position.set(
      Math.round(pos.x),
      Math.round(pos.y),
      Math.round(pos.z)
    );
    
    // Add to scene and tracking
    this.blocksGroup.add(modelScene);
    this.occupiedPositions.add(key);
    
    // Store reference to allow removal
    modelScene.userData.positionKey = key;
    
    return true;
  }
  
  // Remove block function
  removeBlock(object) {
    // Find the top-level parent (the model scene)
    let topObject = object;
    while (topObject.parent !== this.blocksGroup && topObject.parent !== null) {
      topObject = topObject.parent;
    }
    
    // Remove from tracking
    if (topObject.userData && topObject.userData.positionKey) {
      this.occupiedPositions.delete(topObject.userData.positionKey);
    }
    
    // Remove from scene
    this.blocksGroup.remove(topObject);
  }
  
  // Mouse move handler
  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Check if user is dragging
    if (!this.isDragging && (
        Math.abs(event.clientX - this.dragStartX) > this.dragThreshold ||
        Math.abs(event.clientY - this.dragStartY) > this.dragThreshold
    )) {
      this.isDragging = true;
    }
    
    // Update the preview for better user feedback
    this.updatePreview();
  }
  
  // Update the preview position
  updatePreview() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check intersections with plane and blocks
    const intersects = this.raycaster.intersectObjects([this.plane, ...this.blocksGroup.children], true);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      let previewPos;
      
      // Find the parent model if we hit a child object
      let targetObject = intersect.object;
      while (targetObject.parent !== this.blocksGroup && targetObject.parent !== null && targetObject !== this.plane) {
        targetObject = targetObject.parent;
      }
      
      if (targetObject === this.plane) {
        // Preview on the ground plane
        previewPos = new THREE.Vector3(
          intersect.point.x,
          0,
          intersect.point.z
        );
      } else {
        // Preview next to existing block - use world position if possible
        const objPos = new THREE.Vector3();
        targetObject.getWorldPosition(objPos);
        previewPos = objPos.clone();
        
        // Add normal from intersection
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
        const worldNormal = intersect.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        previewPos.add(worldNormal);
      }
      
      // Round to grid
      previewPos.x = Math.round(previewPos.x);
      previewPos.y = Math.round(previewPos.y);
      previewPos.z = Math.round(previewPos.z);
      
      // Position the preview block
      this.previewBlock.position.copy(previewPos);
      this.previewBlock.visible = true;
    } else {
      // Hide preview if no intersection
      this.previewBlock.visible = false;
    }
  }
  
  // Mouse down handler
  onMouseDown(event) {
    event.preventDefault();
    
    // Check if click started on a UI element
    this.clickedOnUI = event.target.closest('#block-selector, #prev-page, #next-page, .block-option') !== null;
    
    // Record starting position for drag detection
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.isDragging = false;
    
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (event.button === 2) { // Right click to remove
      const intersects = this.raycaster.intersectObjects(this.blocksGroup.children, true);
      if (intersects.length > 0) {
        this.removeBlock(intersects[0].object);
      }
    }
    // Note: We've removed the left-click block placement from here
    // It will happen on mouseup if not dragging
  }
  
  onMouseUp(event) {
    if (event.button === 0 && !this.isDragging && !this.clickedOnUI) { // Left click to place, only if not dragging and not on UI
      // Calculate mouse position in normalized device coordinates
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // Only place if preview is visible
      if (this.previewBlock.visible) {
        this.addBlock(this.previewBlock.position);
      }
    }
    this.isDragging = false;
    this.clickedOnUI = false; // Reset the UI click tracker
  }
  
  // Keyboard shortcut handler
  onKeyDown(event) {
    // Example: press 'R' to reset blocks
    if (event.key === 'r' || event.key === 'R') {
      // Remove all blocks
      while (this.blocksGroup.children.length > 0) {
        this.blocksGroup.remove(this.blocksGroup.children[0]);
      }
      this.occupiedPositions.clear();
    }
  }
  
  // Handle window resize
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // Animation loop
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Update controls
    this.controls.update();
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the application
const app = new BlockBuilder()
