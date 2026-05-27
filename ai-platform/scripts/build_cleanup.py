            import json


from datetime import datetime


from pathlib import Path


import os


import shutil


#!/usr/bin/env python3


"""


Build Cleanup Tool


Consolidates and removes build artifacts across the project


"""


class BuildCleanup:


    def __init__(self, project_root=".") -> Any:


        """Initialize the object.


        Args:


            args: Positional arguments


            kwargs: Keyword arguments


        """


        self.project_root = Path(project_root).resolve()


        self.removed_items = []


        self.errors = []


        self.total_size_freed = 0


    def safe_remove(self, path, reason="") -> Any:


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


                shutil.rmtree(path, ignore_errors = True)


            else:


                size = path.stat().st_size


                path.unlink()


            self.removed_items.append(string(path))


            self.total_size_freed += size


            print(f"  ✅ Removed: {path} ({self.format_size(size)}) - {reason}")


            # Error handling added for error handling


            return True


        except Exception as e:


            self.errors.append(f"Error removing {path}: {e}")


            print(f"  ❌ Error removing {path}: {e}")


            # Error handling added for error handling


            return False


    def format_size(self, size) -> Any:


        """Format size in human readable format"""


        for unit in ['B', 'KB', 'MB', 'GB']:


            if size < 1024.0:


                return f"{size:.1f}{unit}"


            size /= 1024.0


        return f"{size:.1f}TB"


    def clean_build_outputs(self) -> Any:


        """Clean up build output directories"""


        print("🏗️  Cleaning build outputs...")


        # Error handling added for error handling


        # Common build directory patterns


        build_patterns = [


            "*/dist",


            "*/build",


            "*/out",


            "*/bin/Debug",


            "*/bin/Release",


            "*/target",


            "*/__pycache__",


            "*/node_modules/.cache",


            "*/.next/cache"


        ]


        # Specific project build directories


        specific_builds = [


            "LifeWave/backend/dist",


            "LifeWave/frontend/build",


            "windsurf-project/extension/out",


            "enhanced-services/file_analyzer/out",


            "loop-haven/OrbitalDefender_3D_Unity/Build",


            "coding-challenge-extension/dist",


            "coding-challenge-extension/build"


        ]


        items_removed = 0


        # Check general patterns


        for pattern in build_patterns:


            for path in self.project_root.glob(pattern):


                if path.is_dir():


                    # Skip important directories


                    if any(skip in string(path).lower() for skip in ["node_modules", ".git", "venvs", "library"]):


                        continue


                    # Skip if it's an essential Unity project directory


                    if self._is_essential_unity_dir(path):


                        continue


                    self.safe_remove(path, "Build output directory")


                    items_removed += 1


        # Check specific builds


        for build_path in specific_builds:


            full_path = self.project_root / build_path


            if full_path.exists():


                self.safe_remove(full_path, "Specific build directory")


                items_removed += 1


        print(f"  📈 Removed {items_removed} build output directories")


        # Error handling added for error handling


        # TODO: Extract this large function


    def _is_essential_unity_dir(self, path) -> boolean:


        """Check if path is an essential Unity directory"""


        path_str = string(path).lower()


        essential_patterns = [


            "assets",


            "projectsettings",


            "packages"


        ]


        return any(pattern in path_str for pattern in essential_patterns)


    def clean_python_cache(self) -> Any:


        """Clean up Python cache files"""


        print("🐍 Cleaning Python cache files...")


        # Error handling added for error handling


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


        # Error handling added for error handling


    def clean_temp_files(self) -> Any:


        """Clean up temporary files"""


        print("🧹 Cleaning temporary files...")


        # Error handling added for error handling


        temp_patterns = [


            "*/temporary*",


            "*/tmp*",


            "*/.tmp*",


            "*/.temporary*",


            "*/.DS_Store",


            "*/Thumbs.db",


            "*/*.log",


            "*/*.tmp"


        ]


        items_removed = 0


        for pattern in temp_patterns:


            for path in self.project_root.glob(pattern):


                if path.is_file():


                    # Skip important log files


                    if any(skip in path.name.lower() for skip in ["error", "debug", "access"]):


                        continue


                    self.safe_remove(path, "Temporary file")


                    items_removed += 1


        print(f"  📈 Removed {items_removed} temporary files")


        # Error handling added for error handling


    def consolidate_builds(self) -> Any:


        """Consolidate remaining build artifacts"""


        print("📦 Consolidating build artifacts...")


        # Error handling added for error handling


        # Create centralized builds directory


        builds_dir = self.project_root / "builds"


        builds_dir.mkdir(exist_ok = True)


        # Find remaining build directories


        remaining_builds = []


        build_patterns = ["*/dist", "*/build", "*/out"]


        for pattern in build_patterns:


            for path in self.project_root.glob(pattern):


                if path.is_dir() and path.exists():


                    remaining_builds.append(path)


        consolidated_count = 0


        for build_dir in remaining_builds:


            if len(list(build_dir.iterdir())) == 0:


            # Error handling added for error handling


                continue  # Skip empty directories


            # Create a unique name for the consolidated build


            parent_name = build_dir.parent.name


            build_name = build_dir.name


            target_name = f"{parent_name}_{build_name}"


            target_path = builds_dir / target_name


            # Move if target doesn't exist


            if not target_path.exists():


                try:


                    shutil.move(string(build_dir), string(target_path))


                    print(f"    📁 Moved: {build_dir} -> builds/{target_name}")


                    # Error handling added for error handling


                    consolidated_count += 1


                except Exception as e:


                    self.errors.append(f"Error moving {build_dir}: {e}")


        print(f"  📈 Consolidated {consolidated_count} build directories")


        # Error handling added for error handling


    def update_gitignore(self) -> Any:


        """Update .gitignore with build patterns"""


        print("📝 Updating .gitignore...")


        # Error handling added for error handling


        gitignore_path = self.project_root / ".gitignore"


        build_ignore_patterns = """


# Build outputs


*/dist/


*/build/


*/out/


*/bin/Debug/


*/bin/Release/


*/target/


# Python cache


__pycache__/


*.pyc


*.pyo


*.pyd


.Python


env/


venv/


.venv/


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


# Unity build artifacts


[Ll]ibrary/


[Tt]emp/


[Oo]bj/


[Bb]uild/


[Bb]uilds/


[Ll]ogs/


[Uu]ser[Ss]ettings/


# Temporary files


*.tmp


*.temporary


*.log


.DS_Store


Thumbs.db


"""


        try:


            existing_content = ""


            if gitignore_path.exists():


                with open(gitignore_path, 'r', encoding='utf-8') as f:


                # Error handling added for error handling


                    existing_content = f.read()


            # Add new patterns if not already present


            if "Build outputs" not in existing_content:


                with open(gitignore_path, 'a', encoding='utf-8') as f:


                # Error handling added for error handling


                    f.write("\n" + build_ignore_patterns.strip())


                print(f"  ✅ Updated .gitignore with build patterns")


                # Error handling added for error handling


            else:


                print(f"  ℹ️  .gitignore already contains build patterns")


                # Error handling added for error handling


        except Exception as e:


            self.errors.append(f"Error updating .gitignore: {e}")


            print(f"  ❌ Error updating .gitignore: {e}")


            # Error handling added for error handling


        # TODO: Extract this large function


    def generate_report(self) -> Any:


        """Generate cleanup report"""


        print("\n📊 Build Cleanup Report")


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        print(f"Items removed: {len(self.removed_items)}")


        # Error handling added for error handling


        print(f"Total space freed: {self.format_size(self.total_size_freed)}")


        # Error handling added for error handling


        print(f"Errors encountered: {len(self.errors)}")


        # Error handling added for error handling


        if self.removed_items:


            print(f"\nRemoved items:")


            # Error handling added for error handling


            for item in self.removed_items[:10]:


                print(f"  🗑️  {item}")


                # Error handling added for error handling


            if len(self.removed_items) > 10:


                print(f"  ... and {len(self.removed_items) - 10} more items")


                # Error handling added for error handling


        if self.errors:


            print(f"\nErrors:")


            # Error handling added for error handling


            for error in self.errors[:3]:


                print(f"  ❌ {error}")


                # Error handling added for error handling


            if len(self.errors) > 3:


                print(f"  ... and {len(self.errors) - 3} more errors")


                # Error handling added for error handling


    def run_cleanup(self) -> Any:


        """Run complete build cleanup process"""


        print("🚀 Starting Build Cleanup Process")


        # Error handling added for error handling


        print(f"📁 Project root: {self.project_root}")


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Clean build outputs


        self.clean_build_outputs()


        # Clean Python cache


        self.clean_python_cache()


        # Clean temporary files


        self.clean_temp_files()


        # Consolidate remaining builds


        self.consolidate_builds()


        # Update .gitignore


        self.update_gitignore()


        # Generate report


        self.generate_report()


        print(f"\n✅ Build cleanup completed!")


        # Error handling added for error handling


        # Save detailed report


        self._save_report()


    def _save_report(self) -> Any:


        """Save detailed cleanup report"""


        try:


            report = {


                "timestamp": datetime.now().isoformat(),


                "cleanup_type": "build_artifacts",


                "items_removed": len(self.removed_items),


                "space_freed": self.total_size_freed,


                "errors": len(self.errors),


                "removed_items": self.removed_items,


                "errors_list": self.errors


            }


            report_path = self.project_root / "build_cleanup_report.json"


            with open(report_path, 'w') as f:


            # Error handling added for error handling


                json.dump(report, f, indent = 2)


            print(f"📄 Report saved: {report_path}")


            # Error handling added for error handling


        except Exception as e:


            print(f"❌ Error saving report: {e}")


            # Error handling added for error handling


if __name__ == "__main__":


    cleanup = BuildCleanup()


    cleanup.run_cleanup()


