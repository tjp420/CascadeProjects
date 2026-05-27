# Project Consolidation Plan

## Current Issues
- 4,901 files across 223 directories
- Multiple duplicate Unity projects
- Scattered AI/ML projects
- Large build artifacts not properly managed
- No proper .gitignore implementation

## Immediate Actions Required

### 1. Unity Project Consolidation
**Current Unity Projects:**
- `loop-haven/OrbitalDefender_3D_Unity/` (main project with builds)
- `loop-haven/OrbitalDefender_Clean/` (clean version)
- `loop-haven/orbital_defender_3d/` (another version)

**Action:**
- Keep `OrbitalDefender_3D_Unity` as primary
- Archive others to `archive/unity-projects/`
- Remove build artifacts:
  - `WebGL_Final_Build/`
  - `WebGL_Fixed_Build/` 
  - `WebGL_Uncompressed_Build/`
  - `Library/` (except essential files)

### 2. AI/ML Project Consolidation
**Current AI Projects:**
- `enhanced-services/` (279MB docs)
- `ReasonAI/`
- `market_intelligence_demo/`

**Action:**
- Merge into single `ai-projects/` directory
- Consolidate documentation
- Remove duplicate virtual environments

### 3. Build Artifact Cleanup
**Remove:**
- All `node_modules/` directories
- Unity build folders
- Python `__pycache__/` 
- Build artifacts and compiled files

### 4. New Directory Structure
```
CascadeProjects/
├── ai-projects/
│   ├── enhanced-services/
│   ├── reasonai/
│   └── market-intelligence/
├── unity-projects/
│   └── orbital-defender/
├── tools/
│   ├── ai-bridge/
│   ├── method-adder/
│   └── ollama-fixer/
├── docs/
├── archive/
└── scripts/
```

### 5. Files to Create
- `.gitignore` (comprehensive)
- `README.md` (project overview)
- Directory structure documentation

## Estimated Impact
- **File count reduction:** 60-70%
- **Space savings:** 200-300MB
- **Improved maintainability:** Significantly
- **Better development workflow:** Clear separation of concerns

## Implementation Order
1. Create .gitignore
2. Archive duplicate projects
3. Remove build artifacts
4. Reorganize directory structure
5. Update documentation
6. Test consolidated projects
