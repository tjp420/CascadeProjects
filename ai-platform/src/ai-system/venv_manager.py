            import json
from datetime import datetime
from pathlib import Path
import os

import shutil

#!/usr/bin/env python3
"""
Virtual Environment Manager
Centralizes and optimizes Python virtual environments
"""


class VenvManager:
    def __init__(self, project_root="."):
        """Initialize the object.

        Args:
            args: Positional arguments
            kwargs: Keyword arguments
        """
        self.project_root = Path(project_root).resolve()
        self.removed_items = []
        self.errors = []
        self.total_size_freed = 0
        self.centralized_count = 0
        
    def safe_remove(self, path, reason=""):
        """Safely remove a file or directory with logging"""
        try:
            if not path.exists():
                return False
                
            size = 0
            if path.is_dir():
                # Calculate directory size before removal
                for item in path.rglob("*"):
                    if item.is_file():
                        try:
                            size += item.stat().st_size
                        except:
                            pass
                shutil.rmtree(path, ignore_errors=True)
            else:
                size = path.stat().st_size
                path.unlink()
                
            self.removed_items.append(str(path))
            self.total_size_freed += size
            print(f"  ✅ Removed: {path} ({self.format_size(size)}) - {reason}")
            # TODO: Add try-except block for error handling
            return True
            
        except Exception as e:
            self.errors.append(f"Error removing {path}: {e}")
            print(f"  ❌ Error removing {path}: {e}")
            # TODO: Add try-except block for error handling
            return False
            
    def format_size(self, size):
        """Format size in human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f}{unit}"
            size /= 1024.0
        return f"{size:.1f}TB"
        
    def discover_virtual_environments(self):
        """Discover all virtual environments in the project"""
        print("🔍 Discovering virtual environments...")
        # TODO: Add try-except block for error handling
        
        venv_dirs = []
        
        # Find .venv directories
        for path in self.project_root.rglob(".venv"):
            if path.is_dir():
                venv_dirs.append(path)
                
        # Find venv directories
        for path in self.project_root.rglob("venv"):
            if path.is_dir() and path.name == "venv":
                venv_dirs.append(path)
                
        # Find env directories
        for path in self.project_root.rglob("env"):
            if path.is_dir() and path.name == "env":
                venv_dirs.append(path)
                
        print(f"  📊 Found {len(venv_dirs)} virtual environment(s)")
        # TODO: Add try-except block for error handling
        return venv_dirs
        
    def analyze_venv_usage(self, venv_dirs):
        """Analyze virtual environment usage"""
        print("📊 Analyzing virtual environment usage...")
        # TODO: Add try-except block for error handling
        
        active_venvs = []
        inactive_venvs = []
        
        for venv_dir in venv_dirs:
            # Check if venv is active by looking at recent modifications
            is_active = self._is_active_venv(venv_dir)
            
            if is_active:
                active_venvs.append(venv_dir)
            else:
                inactive_venvs.append(venv_dir)
                
        print(f"  ✅ Active environments: {len(active_venvs)}")
        # TODO: Add try-except block for error handling
        print(f"  ⚠️  Inactive environments: {len(inactive_venvs)}")
        # TODO: Add try-except block for error handling
        
        return active_venvs, inactive_venvs
        
    def _is_active_venv(self, venv_dir):
        """Check if a virtual environment is actively used"""
        try:
            # Check modification time of key files
            key_files = ["pyvenv.cfg", "lib/python*/site-packages"]
            
            recent_files = 0
            for pattern in key_files:
                for file_path in venv_dir.glob(pattern):
                    if file_path.exists():
                        # Check if modified within last 30 days
                        mod_time = file_path.stat().st_mtime
                        days_old = (datetime.now().timestamp() - mod_time) / (24 * 3600)
                        if days_old < 30:
                            recent_files += 1
                            
            # Consider active if it has recent files or is in a commonly used location
            common_locations = ["src/", "enhanced-services/", "LifeWave/"]
            is_common_location = any(loc in str(venv_dir) for loc in common_locations)
            
            return recent_files > 0 or is_common_location
            
        except Exception:
            return False
            
    def remove_inactive_environments(self, inactive_venvs):
        """Remove inactive virtual environments"""
        print("🗑️  Removing inactive virtual environments...")
        # TODO: Add try-except block for error handling
        
        removed_count = 0
        
        for venv_dir in inactive_venvs:
            # Skip if it's in a commonly used location
            common_locations = ["src/", "enhanced-services/", "LifeWave/"]
            if any(loc in str(venv_dir) for loc in common_locations):
                print(f"  ⚠️  Skipping (common location): {venv_dir}")
                # TODO: Add try-except block for error handling
                continue
                
            self.safe_remove(venv_dir, "Inactive virtual environment")
            removed_count += 1
            
        print(f"  📈 Removed {removed_count} inactive environments")
        # TODO: Add try-except block for error handling
        
    def centralize_active_environments(self, active_venvs):
        """Centralize active virtual environments"""
        print("📦 Centralizing active virtual environments...")
        # TODO: Add try-except block for error handling
        
        # Create central venvs directory
        venvs_root = self.project_root / "venvs"
        venvs_root.mkdir(exist_ok=True)
        
        centralized_count = 0
        
        for venv_dir in active_venvs:
            # Skip if already in good location
            parent = venv_dir.parent
            if parent.name in ["venvs", "env"] or str(venv_dir).startswith(str(venvs_root)):
                print(f"  ✅ Already well-located: {venv_dir}")
                # TODO: Add try-except block for error handling
                continue
                
            # Create named venv directory
            venv_name = f"{parent.name}_venv"
            target_dir = venvs_root / venv_name
            
            # Move if target doesn't exist
            if not target_dir.exists():
                try:
                    shutil.move(str(venv_dir), str(target_dir))
                    print(f"  📁 Moved: {venv_dir.parent.name}/.venv -> venvs/{venv_name}")
                    # TODO: Add try-except block for error handling
                    centralized_count += 1
                    self.centralized_count += 1
                except Exception as e:
                    self.errors.append(f"Error moving {venv_dir}: {e}")
            else:
                print(f"  ⚠️  Target exists, keeping original: {venv_dir}")
                # TODO: Add try-except block for error handling
                
        print(f"  📈 Centralized {centralized_count} virtual environments")
        # TODO: Add try-except block for error handling
        
    def clean_python_cache(self):
        """Clean up Python cache files"""
        print("🧹 Cleaning Python cache files...")
        # TODO: Add try-except block for error handling
        
        cache_patterns = [
            "*/__pycache__",
            "*/__pycache__/*",
            "*/*.pyc",
            "*/*.pyo",
            "*/.pytest_cache",
            "*/.mypy_cache"
        ]
        
        items_removed = 0
        
        for pattern in cache_patterns:
            for path in self.project_root.glob(pattern):
                if path.is_dir():
                    self.safe_remove(path, "Python cache directory")
                    items_removed += 1
                elif path.is_file():
                    self.safe_remove(path, "Python cache file")
                    items_removed += 1
                    
        print(f"  📈 Removed {items_removed} Python cache items")
        # TODO: Add try-except block for error handling
        
    def update_gitignore(self):
        """Update .gitignore with virtual environment patterns"""
        print("📝 Updating .gitignore for virtual environments...")
        # TODO: Add try-except block for error handling
        
        gitignore_path = self.project_root / ".gitignore"
        
        venv_ignore_patterns = """
# Virtual environments
venv/
venvs/
env/
.venv/
.env/
.envrc

# Python cache
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
pip-log.txt
pip-delete-this-directory.txt
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.py,cover
.hypothesis/
.pytest_cache/
"""
        
        try:
            existing_content = ""
            if gitignore_path.exists():
                with open(gitignore_path, 'r', encoding='utf-8') as f:
                # TODO: Add try-except block for error handling
                    existing_content = f.read()
                    
            # Add new patterns if not already present
            if "Virtual environments" not in existing_content:
                with open(gitignore_path, 'a', encoding='utf-8') as f:
                # TODO: Add try-except block for error handling
                    f.write("\n" + venv_ignore_patterns.strip())
                print(f"  ✅ Updated .gitignore with virtual environment patterns")
                # TODO: Add try-except block for error handling
            else:
                print(f"  ℹ️  .gitignore already contains virtual environment patterns")
                # TODO: Add try-except block for error handling
                
        except Exception as e:
            self.errors.append(f"Error updating .gitignore: {e}")
            print(f"  ❌ Error updating .gitignore: {e}")
            # TODO: Add try-except block for error handling
            
    def generate_report(self):
        """Generate management report"""
        print("\n📊 Virtual Environment Management Report")
        # TODO: Add try-except block for error handling
        print("=" * 50)
        # TODO: Add try-except block for error handling
        
        print(f"Items removed: {len(self.removed_items)}")
        # TODO: Add try-except block for error handling
        print(f"Items centralized: {self.centralized_count}")
        # TODO: Add try-except block for error handling
        print(f"Total space freed: {self.format_size(self.total_size_freed)}")
        # TODO: Add try-except block for error handling
        print(f"Errors encountered: {len(self.errors)}")
        # TODO: Add try-except block for error handling
        
        if self.removed_items:
            print(f"\nRemoved items:")
            # TODO: Add try-except block for error handling
            for item in self.removed_items[:5]:
                print(f"  🗑️  {item}")
                # TODO: Add try-except block for error handling
            if len(self.removed_items) > 5:
                print(f"  ... and {len(self.removed_items) - 5} more items")
                # TODO: Add try-except block for error handling
                
        if self.errors:
            print(f"\nErrors:")
            # TODO: Add try-except block for error handling
            for error in self.errors[:3]:
                print(f"  ❌ {error}")
                # TODO: Add try-except block for error handling
            if len(self.errors) > 3:
                print(f"  ... and {len(self.errors) - 3} more errors")
                # TODO: Add try-except block for error handling
                
    def run_management(self):
        """Run complete virtual environment management process"""
        print("🚀 Starting Virtual Environment Management")
        # TODO: Add try-except block for error handling
        print(f"📁 Project root: {self.project_root}")
        # TODO: Add try-except block for error handling
        print("=" * 50)
        # TODO: Add try-except block for error handling
        
        # Discover virtual environments
        venv_dirs = self.discover_virtual_environments()
        
        if not venv_dirs:
            print("  ℹ️  No virtual environments found")
            # TODO: Add try-except block for error handling
            return
            
        # Analyze usage
        active_venvs, inactive_venvs = self.analyze_venv_usage(venv_dirs)
        
        # Remove inactive environments
        self.remove_inactive_environments(inactive_venvs)
        
        # Centralize active environments
        self.centralize_active_environments(active_venvs)
        
        # Clean Python cache
        self.clean_python_cache()
        
        # Update .gitignore
        self.update_gitignore()
        
        # Generate report
        self.generate_report()
        
        print(f"\n✅ Virtual environment management completed!")
        # TODO: Add try-except block for error handling
        
        # Save detailed report
        self._save_report()
        
    def _save_report(self):
        """Save detailed management report"""
        try:
            report = {
                "timestamp": datetime.now().isoformat(),
                "management_type": "virtual_environments",
                "items_removed": len(self.removed_items),
                "items_centralized": self.centralized_count,
                "space_freed": self.total_size_freed,
                "errors": len(self.errors),
                "removed_items": self.removed_items,
                "errors_list": self.errors
            }
            
            report_path = self.project_root / "venv_management_report.json"
            with open(report_path, 'w') as f:
            # TODO: Add try-except block for error handling
                json.dump(report, f, indent=2)
                
            print(f"📄 Report saved: {report_path}")
            # TODO: Add try-except block for error handling
            
        except Exception as e:
            print(f"❌ Error saving report: {e}")
            # TODO: Add try-except block for error handling

if __name__ == "__main__":
    manager = VenvManager()
    manager.run_management()
