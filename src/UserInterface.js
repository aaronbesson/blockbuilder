import { BLOCK_TYPES } from './BlockSystem.js';

export class UserInterface {
  constructor(blockSystem) {
    this.blockSystem = blockSystem;
    this.blockPalette = document.getElementById('block-palette');
    
    // Create block palette
    this.createBlockPalette();
    
    // Create status indicator
    this.createStatusIndicator();
  }
  
  // Create the palette of block options
  createBlockPalette() {
    // Clear any existing content
    this.blockPalette.innerHTML = '';
    
    // Create a block option for each block type
    Object.entries(BLOCK_TYPES).forEach(([type, props]) => {
      const blockOption = document.createElement('div');
      blockOption.className = 'block-option';
      blockOption.dataset.type = type;
      blockOption.style.backgroundColor = `#${props.color.toString(16).padStart(6, '0')}`;
      
      // Set tooltip
      blockOption.title = props.name;
      
      // Add selection indicator if this is the currently selected type
      if (this.blockSystem.selectedBlockType === props) {
        blockOption.classList.add('selected');
      }
      
      // Add click handler
      blockOption.addEventListener('click', () => {
        // Remove selected class from all options
        document.querySelectorAll('.block-option').forEach(el => {
          el.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        blockOption.classList.add('selected');
        
        // Update selected block type in the block system
        this.blockSystem.setSelectedBlockType(type);
      });
      
      this.blockPalette.appendChild(blockOption);
    });
  }
  
  // Create a status indicator for the current action
  createStatusIndicator() {
    // Create the indicator if it doesn't exist
    if (!document.getElementById('status-indicator')) {
      const statusIndicator = document.createElement('div');
      statusIndicator.id = 'status-indicator';
      statusIndicator.style.position = 'absolute';
      statusIndicator.style.top = '20px';
      statusIndicator.style.left = '20px';
      statusIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      statusIndicator.style.color = 'white';
      statusIndicator.style.padding = '10px';
      statusIndicator.style.borderRadius = '5px';
      statusIndicator.style.fontFamily = 'Arial, sans-serif';
      statusIndicator.style.zIndex = '100';
      statusIndicator.style.pointerEvents = 'none'; // Don't interfere with scene interaction
      document.body.appendChild(statusIndicator);
    }
    
    this.statusIndicator = document.getElementById('status-indicator');
    this.updateStatusText('Left click to place, right click to remove blocks');
  }
  
  // Update the status text
  updateStatusText(text) {
    if (this.statusIndicator) {
      this.statusIndicator.textContent = text;
    }
  }
  
  // Update UI when a block type is selected
  updateSelectedBlock(type) {
    // Remove selected class from all options
    document.querySelectorAll('.block-option').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Add selected class to the matching option
    const option = document.querySelector(`.block-option[data-type="${type}"]`);
    if (option) {
      option.classList.add('selected');
    }
  }
  
  // Show coordinates of the currently highlighted position
  updateCoordinateDisplay(position) {
    if (!position) {
      this.updateStatusText('Left click to place, right click to remove blocks');
      return;
    }
    
    const blockType = this.blockSystem.selectedBlockType.name;
    this.updateStatusText(
      `Position: (${position.x}, ${position.y}, ${position.z}) | Selected: ${blockType} | Left click to place, right click to remove`
    );
  }
} 