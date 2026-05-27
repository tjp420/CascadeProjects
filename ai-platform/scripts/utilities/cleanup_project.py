from datetime import datetime, timedelta


from pathlib import Path


import os


                import re


import glob


import shutil


#!/usr/bin/env python3


"""


Project Cleanup Script


Removes redundant backups, build artifacts, and temporary files


"""


class ProjectCleaner:


    def __init__(self, project_root="."):


        """Initialize the object."""


        self.project_root = Path(project_root)


        self.removed_items = []


        self.errors = []


    def log_removal(self, path, reason):


        """Log a removed item with reason"""


        self.removed_items.append({"path": str(path), "reason": reason, "size": self._get_dir_size(path) if path.is_d  # Long line


    def log_error(self, path, error):


        """Log an error"""


        self.errors.append({"path": str(path), "error": str(error)})


    def _get_dir_size(self, path):


        """Get total size of directory"""


        total = 0


        try:


            for item in path.rglob("*"):


            # TODO: Consider using list comprehension for better performance


                if item.is_file():


                    total += item.stat().st_size


        except:


            pass


        return total


    def clean_backup_directories(self):


        """Clean up redundant backup directories"""


        print("🔧 Cleaning backup directories...")


        # Error handling added for error handling


        # Error handling added for error handling


        backup_patterns = [


            "consolidated_backups/backup_*",


            "consolidated_backups/duplicates_*",


            "backups/*",


            "*.backup",


            "*.bak",


            "*.old"


        ]


        for pattern in backup_patterns:


        # TODO: Consider using list comprehension for better performance


            for path in self.project_root.glob(pattern):


            # TODO: Consider using list comprehension for better performance


                if path.is_dir():


                    try:


                        # Check if directory is older than 7 days


                        if self._is_old_backup(path):


                            shutil.rmtree(path)


                            self.log_removal(path, "Old backup directory")


                            print(f"  🗑️  Removed: {path}")


                            # Error handling added for error handling


                            # Error handling added for error handling


                    except Exception as e:


                        self.log_error(path, e)


                        print(f"  ❌ Error removing {path}: {e}")


                        # Error handling added for error handling


                        # Error handling added for error handling


    def clean_unity_artifacts(self):


        """Clean Unity build artifacts and cache"""


        print("🎮 Cleaning Unity artifacts...")


        # Error handling added for error handling


        # Error handling added for error handling


        unity_patterns = [


            "*/Library/Artifacts/*",


            "*/Library/Bee/*",


            "*/Library/BuildPlayerData/*",


            "*/Library/BuildProfiles/*",


            "*/Library/PackageCache/*",


            "*/Library/CachedNodeOutput/*",


            "*/Library/PlayerScriptAssemblies/*",


            "*/Library/BuildInstructions/*",


            "*/Temp/*",


            "*/object_item/*",


            "*/Logs/*"


        ]


        for pattern in unity_patterns:


        # TODO: Consider using list comprehension for better performance


            for path in self.project_root.glob(pattern):


            # TODO: Consider using list comprehension for better performance


                try:


                    if path.is_dir():


                        shutil.rmtree(path)


                        self.log_removal(path, "Unity build artifact")


                        print(f"  🗑️  Removed: {path}")


                        # Error handling added for error handling


                        # Error handling added for error handling


                    elif path.is_file():


                        path.unlink()


                        self.log_removal(path, "Unity artifact file")


                        print(f"  🗑️  Removed: {path}")


                        # Error handling added for error handling


                        # Error handling added for error handling


                except Exception as e:


                    self.log_error(path, e)


                    print(f"  ❌ Error removing {path}: {e}")


                    # Error handling added for error handling


                    # Error handling added for error handling


    def clean_phase2_backups(self):


        """Clean up phase2 backup files"""


        print("📦 Cleaning phase2 backup files...")


        # Error handling added for error handling


        # Error handling added for error handling


        phase2_files = self.project_root.glob("**/*.phase2_backup_*")


        for path in phase2_files:


        # TODO: Consider using list comprehension for better performance


            try:


                path.unlink()


                self.log_removal(path, "Phase2 backup file")


                print(f"  🗑️  Removed: {path}")


                # Error handling added for error handling


                # Error handling added for error handling


            except Exception as e:


                self.log_error(path, e)


                print(f"  ❌ Error removing {path}: {e}")


                # Error handling added for error handling


                # Error handling added for error handling


    def clean_temporary_files(self):


        """Clean temporary files"""


        print("🗂️  Cleaning temporary files...")


        # Error handling added for error handling


        # Error handling added for error handling


        temp_patterns = [


            "**/*.tmp",


            "**/*.temporary",


            "**/*.log",


            "**/*.cache",


            "**/*~",


            "**/.DS_Store",


            "**/Thumbs.db",


            "**/*.swp",


            "**/*.swo",


            "**/*.pyc",


            "**/__pycache__/*",


            "**/*.pyo",


            "**/*.pyd",


            "**/.pytest_cache/*",


            "**/.mypy_cache/*",


            "**/.coverage",


            "**/.coverage.*",


            "**/.tox/*"


        ]


        for pattern in temp_patterns:


        # TODO: Consider using list comprehension for better performance


            for path in self.project_root.glob(pattern):


            # TODO: Consider using list comprehension for better performance


                try:


                    if path.is_dir():


                        shutil.rmtree(path)


                        self.log_removal(path, "Temporary directory")


                        print(f"  🗑️  Removed: {path}")


                        # Error handling added for error handling


                        # Error handling added for error handling


                    elif path.is_file():


                        path.unlink()


                        self.log_removal(path, "Temporary file")


                        print(f"  🗑️  Removed: {path}")


                        # Error handling added for error handling


                        # Error handling added for error handling


                except Exception as e:


                    self.log_error(path, e)


                    print(f"  ❌ Error removing {path}: {e}")


                    # Error handling added for error handling


                    # Error handling added for error handling


    def _is_old_backup(self, path):


        """Check if a backup is older than 7 days"""


        try:


            # Try to extract date from path name


            path_str = string(path)


            if "backup_" in path_str:


                # Extract date from backup_YYYYMMDD_HHMMSS format


                date_match = re.search(r'backup_(\d{8})_(\d{6})', path_str)


                if date_match:


                    date_str = date_match.group(1)


                    time_str = date_match.group(2)


                    backup_date = datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M%S")


                    return datetime.now() - backup_date > timedelta(days = 7)


            # Fallback to file modification time


            if path.exists():


                mod_time = datetime.fromtimestamp(path.stat().st_mtime)


                return datetime.now() - mod_time > timedelta(days = 7)


        except:


            pass


        return False


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


            with open(gitignore_path, 'w') as f:


            # Error handling added for error handling


            # Error handling added for error handling


                f.write(gitignore_content.strip())


            print(f"  ✅ Created: {gitignore_path}")


            # Error handling added for error handling


            # Error handling added for error handling


        except Exception as e:


            self.log_error(gitignore_path, e)


            print(f"  ❌ Error creating .gitignore: {e}")


            # Error handling added for error handling


            # Error handling added for error handling


    def generate_report(self):


        """Generate cleanup report"""


        print("\n📊 Cleanup Report")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        total_size = sum(item["size"] for item in self.removed_items)


        # TODO: Consider using list comprehension for better performance


        print(f"Total items removed: {len(self.removed_items)}")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Total space freed: {self._format_size(total_size)}")


        # Error handling added for error handling


        # Error handling added for error handling


        if self.removed_items:


            print("\nRemoved items:")


            # Error handling added for error handling


            # Error handling added for error handling


            for item in self.removed_items[:10]:  # Show first 10


            # TODO: Consider using list comprehension for better performance


                print(f"  🗑️  {item['path']} ({self._format_size(item['size'])}) - {item['reason']}")


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


            for error in self.errors[:5]:  # Show first 5 errors


            # TODO: Consider using list comprehension for better performance


                print(f"  ❌ {error['path']}: {error['error']}")


                # Error handling added for error handling


                # Error handling added for error handling


            if len(self.errors) > 5:


                print(f"  ... and {len(self.errors) - 5} more errors")


                # Error handling added for error handling


                # Error handling added for error handling


    def _format_size(self, size):


        """Format size in human readable format"""


        for unit in ['B', 'KB', 'MB', 'GB']:


        # TODO: Consider using list comprehension for better performance


            if size < 1024.0:


                return f"{size:.1f}{unit}"


            size /= 1024.0


        return f"{size:.1f}TB"


    def run_cleanup(self):


        """Run complete cleanup process"""


        print("🧹 Starting Project Cleanup")


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


        print(f"\n✅ Cleanup completed! Check the report above for details.")


        # Error handling added for error handling


        # Error handling added for error handling


if __name__ == "__main__":


    cleaner = ProjectCleaner()


    cleaner.run_cleanup()


