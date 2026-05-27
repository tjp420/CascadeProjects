# Code Map Visualizer Feature

## Overview
The Code Map Visualizer is a new feature integrated into the web application that provides an interactive visualization of your project's code structure and dependencies.

## Features
- **Interactive Visualization**: Visual representation of code structure using SVG
- **Statistics Display**: Shows file counts, directory counts, and dependency information
- **Export Functionality**: Export the visualization as PNG
- **Error Handling**: Graceful error handling with user-friendly messages

## How to Use

1. **Generate Code Map Data**:
   ```bash
   python generate_code_map_data.py
   ```
   This will create a `code_map_data.json` file with the project structure.

2. **Access the Code Map**:
   - Open the web application
   - Click on the "Code Map" tab in the navigation
   - Click "Load Code Map" to visualize the data

3. **Export Visualization**:
   - After loading the code map, click "Export PNG" to download the visualization

## Integration Details

### Navigation
- Added "Code Map" tab to the main navigation
- Integrated with the existing tab switching system

### Components
- **HTML Structure**: Added `code-map-content` section with controls and visualization area
- **CSS Styles**: Added responsive styles for the code map interface
- **JavaScript Functionality**: Added `initializeCodeMap()` function and `CodeMapVisualizer` class

### File Structure
```
web/
├── index.html                    # Main application with Code Map integration
├── generate_code_map_data.py     # Python script to generate code map data
├── code_map_data.json           # Generated code structure data
└── CODE_MAP_FEATURE.md         # This documentation
```

## Data Format

The `code_map_data.json` file contains:
- `statistics`: Overall project statistics
- `directories`: List of directories with metadata
- `files`: List of files with dependencies and metadata

## Error Handling

If the `code_map_data.json` file is not found, the system will:
1. Display a user-friendly error message
2. Provide instructions on how to generate the data
3. Gracefully handle the missing data without breaking the interface

## Future Enhancements

Potential improvements for the Code Map feature:
- Interactive node selection and details
- Zoom and pan functionality
- Real-time updates
- Advanced filtering options
- Integration with code analysis data
- Dependency path visualization

## Browser Compatibility

The Code Map feature uses modern JavaScript features:
- ES6 classes
- Async/await
- SVG manipulation
- Canvas export functionality

Compatible with modern browsers (Chrome, Firefox, Safari, Edge).
