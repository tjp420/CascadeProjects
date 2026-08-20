# Code Map Visualization Feature

## Overview

The Code Map Visualization feature allows you to visualize your analyzed code data in interactive, intuitive visual representations. This helps you understand code structure, relationships, and patterns at a glance.

## Features

### 🗺️ **Interactive Visualizations**

- **Force-Directed Graph**: See how files and modules connect
- **Tree Layout**: Hierarchical view of code structure
- **Cluster Layout**: Group files by language or patterns

### 📊 **Rich Data Display**

- **File Nodes**: Color-coded by health (green = no issues, red = many issues)
- **Dependency Links**: Visual connections between files
- **Pattern Overlays**: Highlight detected architectural patterns
- **Issue Indicators**: See problem areas at a glance

### 🎛️ **Interactive Controls**

- **Layout Selection**: Switch between visualization types
- **Filtering Options**: Focus on specific file types or issues
- **Export Capabilities**: Save visualizations as JSON or SVG
- **Real-time Updates**: Refresh with new scan data

## Usage

### 1. Run a Scan

First, analyze your codebase:

```
> SimpleBeacon: Scan Workspace
```

### 2. Open Code Map

```
> SimpleBeacon: Show Code Map
```

### 3. Explore the Visualization

- **Click nodes** to see file details
- **Hover** for quick information tooltips
- **Drag nodes** to rearrange the layout
- **Use controls** to filter and change layouts

## Visualization Types

### Force-Directed Graph

- **Best for**: Understanding complex relationships
- **Features**: Physics-based layout, draggable nodes
- **Use case**: Large codebases with many dependencies

### Tree Layout

- **Best for**: Hierarchical code structure
- **Features**: Clear parent-child relationships
- **Use case**: Projects with clear module hierarchy

### Cluster Layout

- **Best for**: Language or pattern grouping
- **Features**: Automatic clustering by type
- **Use case**: Multi-language projects

## Color Coding

| Color     | Meaning  | Issues     |
| --------- | -------- | ---------- |
| 🟢 Green  | Healthy  | 0 issues   |
| 🟡 Yellow | Minor    | 1-2 issues |
| 🟠 Orange | Moderate | 3-5 issues |
| 🔴 Red    | Critical | 6+ issues  |

## Metrics Panel

The sidebar displays key metrics:

- **Total Files**: Number of files analyzed
- **Total Issues**: Combined issue count
- **Health Score**: Overall code health (0-100)
- **Dependencies**: Number of file dependencies

## File Details Panel

Click any node to see:

- File path and name
- Programming language
- File size
- Complexity score
- Issue count
- Detected patterns

## Filtering Options

### All Files

Show every file in the analysis

### Files with Issues

Focus only on files that have detected problems

### Files with Patterns

Highlight files containing architectural patterns

## Export Options

### JSON Export

- **Format**: Structured JSON data
- **Contains**: All nodes, edges, and metadata
- **Use case**: Further analysis or custom visualizations

### SVG Export

- **Format**: Scalable vector graphics
- **Contains**: Current visualization state
- **Use case**: Documentation and presentations

## Integration with Analysis

The code map integrates with all SimpleBeacon analysis features:

### Enhanced AI Analysis

- Shows AI-detected patterns
- Highlights complexity areas
- Displays confidence scores

### Pattern Detection

- Visualizes architectural patterns
- Shows pattern relationships
- Groups by pattern type

### Real-time Analysis

- Updates as you code
- Shows live changes
- Maintains session state

## Performance Considerations

### Large Codebases

- Use filtering to focus on relevant areas
- Consider tree layout for better performance
- Export data for external analysis tools

### Memory Usage

- The visualization loads data incrementally
- Large datasets may take longer to render
- Consider filtering for very large projects

## Troubleshooting

### Empty Visualization

- Ensure you've run a scan first
- Check that the scan completed successfully
- Verify the scan data contains file information

### Performance Issues

- Reduce the number of files shown with filters
- Use a simpler layout (tree instead of force-directed)
- Close other VSCode panels to free memory

### Missing Dependencies

- Check that files have import/require statements
- Verify the analysis includes dependency detection
- Ensure file paths are correctly resolved

## Keyboard Shortcuts

| Shortcut       | Action               |
| -------------- | -------------------- |
| `Ctrl+Shift+M` | Show Code Map        |
| `Ctrl+Shift+S` | Scan Workspace       |
| `Ctrl+Shift+A` | Enhanced AI Analysis |
| `Ctrl+Shift+R` | Real-time Analysis   |

## API Integration

The code map can be accessed programmatically:

```typescript
// Show code map with custom data
const codeMapProvider = CodeMapProvider.getInstance();
codeMapProvider.showCodeMap(analysisData, context);

// Export current visualization
const data = codeMapProvider.exportData('json');
```

## Customization

### Node Styling

Node appearance is determined by:

- File health (color)
- File size (node size)
- Language (optional styling)
- Issue count (border thickness)

### Edge Styling

Connection appearance shows:

- Dependency strength (line thickness)
- Relationship type (line style)
- Direction (arrows for imports)

## Future Enhancements

Planned improvements include:

- **3D Visualization**: Three-dimensional code maps
- **Time-based Views**: Historical changes over time
- **Collaboration Features**: Shared annotations
- **Advanced Filtering**: More sophisticated filter options
- **Custom Layouts**: User-defined visualization algorithms

## Examples

### Web Application

- **Force-directed**: Shows component relationships
- **Clusters**: Groups by framework (React, Node.js, etc.)
- **Colors**: Red for API endpoints with security issues

### Mobile App

- **Tree Layout**: Shows screen hierarchy
- **Dependencies**: Navigation and data flow
- **Patterns**: MVVM architecture detection

### Library Project

- **Cluster Layout**: Groups by module
- **Health**: Green for well-tested modules
- **Dependencies**: Internal vs external imports

---

**The Code Map Visualization feature transforms your static analysis data into an interactive, visual exploration tool, making it easier to understand complex codebases and identify areas that need attention.**
