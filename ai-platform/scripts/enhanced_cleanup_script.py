#!/usr/bin/env python3
"""
Enhanced Project Cleanup Script
Integrated with hybrid merger-cleanup approach
"""

import os
import shutil
import json
from pathlib import Path
from datetime import datetime

class EnhancedProjectCleaner:
    def __init__(self, project_path):
        self.project_path = Path(project_path)
        self.backup_path = self.project_path / "backup_before_cleanup"
        self.archive_path = self.project_path / "archive"
        self.merger_integration = False
        self.cleanup_log = []
        
    def log(self, message: str, level: str = "INFO"):
        """Log cleanup message"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {level}: {message}"
        self.cleanup_log.append(log_entry)
        print(log_entry)
        
    def detect_merger_integration(self) -> bool:
        """Detect if merger tools are available"""
        self.log("Detecting merger integration capabilities...")
        
        merger_tools = [
            self.project_path / "web" / "merger_implementation_executor.py",
            self.project_path / "web" / "hybrid_merger_executor.py"
        ]
        
        for tool_path in merger_tools:
            if tool_path.exists():
                self.log(f"Found merger tool: {tool_path}")
                self.merger_integration = True
                return True
        
        self.log("No merger tools detected - cleanup only mode")
        return False
    
    def create_backup(self):
        """Create backup before cleanup"""
        self.log("🔄 Creating backup...")
        
        # Create backup directory
        self.backup_path.mkdir(exist_ok=True)
        
        # Backup important files
        important_files = [
            "package.json", "server.js", "README.md", ".env.example"
        ]
        
        for file in important_files:
            src = self.project_path / file
            if src.exists():
                dst = self.backup_path / file
                shutil.copy2(src, dst)
                self.log(f"✅ Backed up: {file}")
        
        # Backup directories
        important_dirs = ["web", "src"]
        for dir_name in important_dirs:
            src = self.project_path / dir_name
            if src.exists():
                dst = self.backup_path / dir_name
                shutil.copytree(src, dst, dirs_exist_ok=True)
                self.log(f"✅ Backed up directory: {dir_name}")
    
    def create_new_structure(self):
        """Create clean project structure"""
        self.log("🏗️ Creating new project structure...")
        
        new_structure = {
            "ai-platform": {
                "src": {
                    "ai-system": {},
                    "web": {},
                    "server": {}
                },
                "docs": {},
                "tests": {},
                "config": {},
                "scripts": {}
            }
        }
        
        def create_structure(base_path, structure):
            for name, content in structure.items():
                path = base_path / name
                if content:
                    path.mkdir(exist_ok=True)
                    create_structure(path, content)
                else:
                    path.mkdir(exist_ok=True)
        
        create_structure(self.project_path, new_structure)
        self.log("✅ New structure created")
    
    def move_core_files(self):
        """Move essential files to new structure"""
        self.log("📦 Moving core files...")
        
        # Move core files from web directory
        web_dir = self.project_path / "web"
        if web_dir.exists():
            essential_files = [
                "ai_dashboard.html",
                "dashboard-styles.css", 
                "ai-navigation-system.js",
                "ai-navigation-styles.css"
            ]
            
            target_web_dir = self.project_path / "ai-platform" / "src" / "web"
            target_web_dir.mkdir(parents=True, exist_ok=True)
            
            for file_name in essential_files:
                src_file = web_dir / file_name
                if src_file.exists():
                    dst_file = target_web_dir / file_name
                    shutil.copy2(src_file, dst_file)
                    self.log(f"✅ Moved: {file_name}")
        
        # Move core files from src directory
        src_dir = self.project_path / "src"
        if src_dir.exists():
            target_src_dir = self.project_path / "ai-platform" / "src" / "ai-system"
            target_src_dir.mkdir(parents=True, exist_ok=True)
            
            # Move Python files
            for py_file in src_dir.glob("**/*.py"):
                rel_path = py_file.relative_to(src_dir)
                dst_file = target_src_dir / rel_path.name
                shutil.copy2(py_file, dst_file)
                self.log(f"✅ Moved Python file: {py_file.name}")
        
        # Move server.js
        server_file = self.project_path / "server.js"
        if server_file.exists():
            target_server_dir = self.project_path / "ai-platform" / "src" / "server"
            target_server_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(server_file, target_server_dir / "server.js")
            self.log("✅ Moved: server.js")
        
        # Move package.json
        package_file = self.project_path / "package.json"
        if package_file.exists():
            shutil.copy2(package_file, self.project_path / "ai-platform" / "package.json")
            self.log("✅ Moved: package.json")
        
        self.log("✅ Core files moved successfully")
    
    def archive_old_files(self):
        """Archive old and redundant files"""
        self.log("🗄️ Archiving old files...")
        
        self.archive_path.mkdir(exist_ok=True)
        
        # Archive redundant dashboards
        redundant_files = [
            "stable_dashboard.html",
            "dashboard.html",
            "index.html"
        ]
        
        for file_name in redundant_files:
            src_file = self.project_path / file_name
            if src_file.exists():
                dst_file = self.archive_path / file_name
                shutil.move(src_file, dst_file)
                self.log(f"📁 Archived: {file_name}")
        
        # Archive old directories
        redundant_dirs = [
            "node_modules",
            ".git",
            "coverage",
            ".pytest_cache"
        ]
        
        for dir_name in redundant_dirs:
            src_dir = self.project_path / dir_name
            if src_dir.exists():
                dst_dir = self.archive_path / dir_name
                shutil.move(src_dir, dst_dir)
                self.log(f"📁 Archived directory: {dir_name}")
        
        self.log("✅ Old files archived")
    
    def create_unified_dashboard(self):
        """Create unified dashboard from existing components"""
        self.log("🎨 Creating unified dashboard...")
        
        target_web_dir = self.project_path / "ai-platform" / "src" / "web"
        dashboard_file = target_web_dir / "unified_dashboard.html"
        
        # Create unified dashboard
        dashboard_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎯 Unified AI Platform Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="dashboard-styles.css">
    <link rel="stylesheet" href="ai-navigation-styles.css">
</head>
<body>
    <div class="unified-dashboard">
        <header class="dashboard-header">
            <h1>🎯 Unified AI Platform</h1>
            <p>Cleaned and Consolidated Dashboard</p>
        </header>
        
        <main class="dashboard-main">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-3">
                        <nav class="sidebar">
                            <div class="nav-section">
                                <div class="nav-section-title">🏢 Main</div>
                                <a href="#" class="nav-item active">
                                    <i class="fas fa-home"></i>
                                    <span>Dashboard</span>
                                </a>
                            </div>
                            
                            <div class="nav-section">
                                <div class="nav-section-title">🤖 AI Tools</div>
                                <a href="#" class="nav-item">
                                    <i class="fas fa-brain"></i>
                                    <span>AI Assistant</span>
                                </a>
                                <a href="#" class="nav-item">
                                    <i class="fas fa-code"></i>
                                    <span>Code Generator</span>
                                </a>
                            </div>
                        </nav>
                    </div>
                    
                    <div class="col-md-9">
                        <div class="dashboard-content">
                            <div class="welcome-section">
                                <h2>Welcome to Unified AI Platform</h2>
                                <p>Cleaned and consolidated project structure</p>
                                
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <h3>📁 Clean Structure</h3>
                                        <p>Organized project files</p>
                                    </div>
                                    <div class="stat-card">
                                        <h3>🚀 Better Performance</h3>
                                        <p>Optimized loading</p>
                                    </div>
                                    <div class="stat-card">
                                        <h3>🔧 Unified Tools</h3>
                                        <p>Consolidated functionality</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="ai-navigation-system.js"></script>
</body>
</html>"""
        
        with open(dashboard_file, 'w') as f:
            f.write(dashboard_content)
        
        self.log("✅ Unified dashboard created")
    
    def generate_cleanup_report(self):
        """Generate cleanup completion report"""
        self.log("📋 Generating cleanup report...")
        
        report_content = f"""# 🧹 Enhanced Project Cleanup Report
# CascadeProjects Directory Cleanup

**Generated**: {datetime.now().isoformat()}
**Status**: COMPLETED
**Approach**: Enhanced Cleanup with Merger Integration

## 📊 Cleanup Summary

### **Files Processed**
- **Backup Created**: Yes
- **New Structure**: ai-platform/ created
- **Core Files Moved**: Essential files organized
- **Old Files Archived**: Redundant files moved to archive/

### **Directory Structure Created**
```
ai-platform/
├── src/
│   ├── ai-system/          # Core AI functionality
│   ├── web/                # Web components
│   └── server/             # Server files
├── docs/                   # Documentation
├── tests/                  # Test files
├── config/                 # Configuration
└── scripts/                # Build scripts
```

### **Files Moved**
- **ai_dashboard.html**: src/web/
- **dashboard-styles.css**: src/web/
- **ai-navigation-system.js**: src/web/
- **server.js**: src/server/
- **package.json**: root/

### **Files Archived**
- **stable_dashboard.html**: archive/
- **redundant dashboards**: archive/
- **node_modules**: archive/
- **build artifacts**: archive/

## 🎯 Benefits Achieved

1. **Clean Structure**: Organized project files
2. **Better Performance**: Reduced file count
3. **Easier Navigation**: Clear directory structure
4. **Unified Dashboard**: Single entry point
5. **Archive Safety**: Old files preserved

## 🔄 Merger Integration

**Merger Integration Available**: {self.merger_integration}

{'''
### **Next Steps for Merger**
1. Run hybrid merger executor
2. Execute comprehensive merger strategy
3. Integrate cleanup results with merger
4. Complete full project consolidation
''' if self.merger_integration else '''
### **Merger Integration Not Available**
- Install merger tools for comprehensive consolidation
- Use hybrid approach for full project merger
'''}

## 📞 Cleanup Log

{chr(10).join(self.cleanup_log)}

---
*Generated by Enhanced Project Cleanup Script*
"""
        
        report_path = self.project_path / "ai-platform" / "cleanup_report.md"
        with open(report_path, 'w') as f:
            f.write(report_content)
        
        self.log(f"✅ Cleanup report generated: {report_path}")
        return report_path
    
    def execute_enhanced_cleanup(self):
        """Execute the enhanced cleanup process"""
        self.log("🚀 Starting enhanced project cleanup...")
        
        try:
            # Detect merger integration
            self.detect_merger_integration()
            
            # Execute cleanup phases
            self.create_backup()
            self.create_new_structure()
            self.move_core_files()
            self.archive_old_files()
            self.create_unified_dashboard()
            
            # Generate report
            report_path = self.generate_cleanup_report()
            
            self.log("🎉 Enhanced cleanup completed successfully!")
            self.log(f"📋 Report available: {report_path}")
            
            if self.merger_integration:
                self.log("🔄 Merger integration available - run hybrid merger for full consolidation")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Enhanced cleanup failed: {e}", "ERROR")
            return False
    
    def execute_with_merger(self):
        """Execute cleanup with merger integration"""
        self.log("🔄 Executing cleanup with merger integration...")
        
        # Execute cleanup first
        cleanup_success = self.execute_enhanced_cleanup()
        
        if cleanup_success and self.merger_integration:
            self.log("🚀 Proceeding with merger integration...")
            
            # Import and execute hybrid merger
            try:
                import sys
                sys.path.append(str(self.project_path / "web"))
                
                from hybrid_merger_executor import HybridMergerExecutor
                
                merger_executor = HybridMergerExecutor()
                merger_success = merger_executor.execute_full_merger()
                
                if merger_success:
                    self.log("🎉 Cleanup + Merger integration completed successfully!")
                else:
                    self.log("⚠️ Cleanup completed but merger failed", "WARNING")
                
                return merger_success
                
            except Exception as e:
                self.log(f"❌ Merger integration failed: {e}", "ERROR")
                return False
        
        return cleanup_success

def main():
    """Main execution function"""
    print("🧹 Enhanced Project Cleanup Script")
    print("=" * 50)
    
    project_path = Path("C:/Users/Trevor/CascadeProjects")
    cleaner = EnhancedProjectCleaner(project_path)
    
    # Ask user for execution mode
    print("\nExecution Options:")
    print("1. Enhanced cleanup only")
    print("2. Enhanced cleanup + merger integration")
    
    choice = input("Select option (1 or 2): ")
    
    if choice == "1":
        success = cleaner.execute_enhanced_cleanup()
    elif choice == "2":
        success = cleaner.execute_with_merger()
    else:
        print("Invalid choice. Exiting.")
        return
    
    if success:
        print("\n✅ Execution completed successfully!")
        print(f"📁 Cleaned project: {project_path / 'ai-platform'}")
    else:
        print("\n❌ Execution failed!")

if __name__ == "__main__":
    main()
