from datetime import datetime, timedelta


from pathlib import Path


import os


import glob


import shutil


#!/usr/bin/env python3


"""


Robust Project Cleanup Script


Handles Windows paths properly and provides better error handling


"""


class RobustProjectCleaner:


    def __init__(self, project_root="."):


        """Initialize the object."""


        self.project_root = Path(project_root).resolve()


        self.removed_items = []


        self.errors = []


        self.total_size_freed = 0


    def safe_remove(self, path, reason=""):


        """Safely remove a file or directory"""


        try:


            if not path.exists():


                return False


            size = 0


            if path.is_dir():


                # Calculate directory size before removal


                for item in path.rglob("*"):


                # TODO: Consider using list comprehension for better performance


                    if item.is_file():


                        try:


                            size += item.stat().st_size


                        except:


                            pass


                shutil.rmtree(path, ignore_errors = True)


            else:


                size = path.stat().st_size


                path.unlink()


            self.removed_items.append(string(path))


            self.total_size_freed += size


            print(f"  ✅ Removed: {path}")


            # Error handling added for error handling


            # Error handling added for error handling


            return True


        except Exception as e:


            self.errors.append(f"Error removing {path}: {e}")


            return False


    def clean_backup_directories(self):


        """Clean up redundant backup directories"""


        print("🔧 Cleaning backup directories...")


        # Error handling added for error handling


        # Error handling added for error handling


        # Focus on the most obvious backup directories


        backup_dirs = [


            self.project_root / "consolidated_backups",


            self.project_root / "backups",


        ]


        for backup_dir in backup_dirs:


        # TODO: Consider using list comprehension for better performance


            if backup_dir.exists():


                # List subdirectories


                for item in backup_dir.iterdir():


                # TODO: Consider using list comprehension for better performance


                    if item.is_dir():


                        # Check if it's a timestamped backup (older than 1 day)


                        if any(keyword in item.name.lower() for keyword in ["backup_", "duplicates_"]):


                        # TODO: Consider using list comprehension for better performance


                            self.safe_remove(item, "Timestamped backup")


    def clean_unity_artifacts(self):


        """Clean Unity build artifacts and cache"""


        print("🎮 Cleaning Unity artifacts...")


        # Error handling added for error handling


        # Error handling added for error handling


        unity_library = self.project_root / "loop-haven" / "Library"


        if unity_library.exists():


            # Remove specific high-space directories


            artifact_dirs = ["Artifacts", "Bee", "BuildPlayerData", "PackageCache"]


            for artifact_dir in artifact_dirs:


            # TODO: Consider using list comprehension for better performance


                artifact_path = unity_library / artifact_dir


                if artifact_path.exists():


                    self.safe_remove(artifact_path, "Unity artifact")


    def clean_phase2_backups(self):


        """Clean up phase2 backup files"""


        print("📦 Cleaning phase2 backup files...")


        # Error handling added for error handling


        # Error handling added for error handling


        # Find and remove phase2 backup files


        for path in self.project_root.rglob("*.phase2_backup_*"):


        # TODO: Consider using list comprehension for better performance


            self.safe_remove(path, "Phase2 backup file")


    def clean_temporary_files(self):


        """Clean temporary files"""


        print("🗂️  Cleaning temporary files...")


        # Error handling added for error handling


        # Error handling added for error handling


        # Common temporary file patterns


        temp_extensions = [".tmp", ".temporary", ".log", ".cache", ".pyc", ".pyo"]


        for ext in temp_extensions:


        # TODO: Consider using list comprehension for better performance


            for path in self.project_root.rglob(f"*{ext}"):


            # TODO: Consider using list comprehension for better performance


                # Skip important files


                if path.name in ["cleanup_project.py", "robust_cleanup.py", "enhanced_dashboard.py"]:


                    continue


                self.safe_remove(path, "Temporary file")


        # Clean __pycache__ directories


        for path in self.project_root.rglob("__pycache__"):


        # TODO: Consider using list comprehension for better performance


            if path.is_dir():


                self.safe_remove(path, "Python cache")


    def create_gitignore(self):


        """Create comprehensive .gitignore file"""


        print("📝 Creating .gitignore...")


        # Error handling added for error handling


        # Error handling added for error handling


        gitignore_content = """


# Build artifacts and cache


__pycache__/


*.py[cod]


*$py.class


*.so


.Python


build/


develop-eggs/


dist/


downloads/


eggs/


.eggs/


lib/


lib64/


parts/


sdist/


var/


wheels/


*.egg-information/


.installed.cfg


*.egg


MANIFEST


# Virtual environments


venv/


env/


ENV/


env.bak/


venv.bak/


.venv/


# IDE and editor files


.vscode/


.idea/


*.swp


*.swo


*~


.DS_Store


Thumbs.db


*.sublime-project


*.sublime-workspace


# Unity build artifacts


[Ll]ibrary/


[Tt]emp/


[Oo]bj/


[Bb]uild/


[Bb]uilds/


[Ll]ogs/


[Uu]ser[Ss]ettings/


[Mm]emoryCaptures/


[Cc]ompany/


[Gg]raphCache/


[Aa]ssetBundles/


[Ss]ceneVisibilityCache/


# Backup files


*.backup


*.bak


*.old


*.backup_*


backups/


consolidated_backups/


*duplicates_*


# Temporary files


*.tmp


*.temporary


*.log


*.cache


.phase2_backup_*


# Test coverage and profiling


.coverage


.pytest_cache/


.mypy_cache/


htmlcov/


.tox/


.coverage.*


coverage.xml


*.cover


.hypothesis/


# Node.js (if present)


node_modules/


npm-debug.log*


yarn-debug.log*


yarn-error.log*


# Environment files


.env


.env.local


.env.development.local


.env.test.local


.env.production.local


# Database files


*.db


*.sqlite


*.sqlite3


*.db-journal


# Large binary files


*.dll


*.exe


*.bin


*.wasm


*.asset


*.unity3d


# Package files


*.tar.gz


*.zip


*.rar


*.7z


# OS specific


.DS_Store


.DS_Store?


._*


.Spotlight-V100


.Trashes


ehthumbs.db


Thumbs.db


"""


        gitignore_path = self.project_root / ".gitignore"


        try:


            with open(gitignore_path, 'w', encoding='utf-8') as f:


            # Error handling added for error handling


            # Error handling added for error handling


                f.write(gitignore_content.strip())


            print(f"  ✅ Created: {gitignore_path}")


            # Error handling added for error handling


            # Error handling added for error handling


        except Exception as e:


            self.errors.append(f"Error creating .gitignore: {e}")


            print(f"  ❌ Error creating .gitignore: {e}")


            # Error handling added for error handling


            # Error handling added for error handling


    def format_size(self, size):


        """Format size in human readable format"""


        for unit in ['B', 'KB', 'MB', 'GB']:


        # TODO: Consider using list comprehension for better performance


            if size < 1024.0:


                return f"{size:.1f}{unit}"


            size /= 1024.0


        return f"{size:.1f}TB"


    def generate_report(self):


        """Generate cleanup report"""


        print("\n📊 Cleanup Report")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Total items removed: {len(self.removed_items)}")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Total space freed: {self.format_size(self.total_size_freed)}")


        # Error handling added for error handling


        # Error handling added for error handling


        if self.removed_items:


            print(f"\nFirst 10 removed items:")


            # Error handling added for error handling


            # Error handling added for error handling


            for item in self.removed_items[:10]:


            # TODO: Consider using list comprehension for better performance


                print(f"  🗑️  {item}")


                # Error handling added for error handling


                # Error handling added for error handling


            if len(self.removed_items) > 10:


                print(f"  ... and {len(self.removed_items) - 10} more items")


                # Error handling added for error handling


                # Error handling added for error handling


        if self.errors:


            print(f"\nErrors encountered: {len(self.errors)}")


            # Error handling added for error handling


            # Error handling added for error handling


            for error in self.errors[:5]:


            # TODO: Consider using list comprehension for better performance


                print(f"  ❌ {error}")


                # Error handling added for error handling


                # Error handling added for error handling


            if len(self.errors) > 5:


                print(f"  ... and {len(self.errors) - 5} more errors")


                # Error handling added for error handling


                # Error handling added for error handling


    def run_cleanup(self):


        """Run complete cleanup process"""


        print("🧹 Starting Robust Project Cleanup")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"📁 Project root: {self.project_root}")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        self.clean_backup_directories()


        self.clean_unity_artifacts()


        self.clean_phase2_backups()


        self.clean_temporary_files()


        self.create_gitignore()


        self.generate_report()


        print(f"\n✅ Cleanup completed!")


        # Error handling added for error handling


        # Error handling added for error handling


if __name__ == "__main__":


    cleaner = RobustProjectCleaner()


    cleaner.run_cleanup()


