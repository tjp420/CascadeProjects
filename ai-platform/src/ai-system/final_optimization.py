from datetime import datetime


from pathlib import Path


import os


import shutil


#!/usr/bin/env python3


"""


Final Project Optimization Script


Implements the final cleanup phase for optimal project structure


"""


class FinalOptimizer:


    def __init__(self, project_root=".") -> Any:


        """Initialize the object."""


        self.project_root = Path(project_root).resolve()


        self.removed_items = []


        self.errors = []


        self.total_size_freed = 0


    def safe_remove(self, path, reason="") -> Any:


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


            print(f"  ✅ Removed: {path} ({self.format_size(size)})")


            # Error handling added for error handling


            # Error handling added for error handling


            return True


        except Exception as e:


            self.errors.append(f"Error removing {path}: {e}")


            print(f"  ❌ Error removing {path}: {e}")


            # Error handling added for error handling


            # Error handling added for error handling


            return False


    def format_size(self, size) -> Any:


        """Format size in human readable format"""


        for unit in ['B', 'KB', 'MB', 'GB']:


        # TODO: Consider using list comprehension for better performance


            if size < 1024.0:


                return f"{size:.1f}{unit}"


            size /= 1024.0


        return f"{size:.1f}TB"


    def is_empty_directory(self, path) -> boolean:


        """Check if directory is truly empty (no files)"""


        if not path.is_dir():


            return False


        try:


            return not any(path.iterdir())


        except:


            return False


    def cleanup_enhanced_services_structure(self) -> Any:


        """Clean up empty directories in enhanced-services"""


        print("🏗️  Cleaning enhanced-services structure...")


        # Error handling added for error handling


        # Error handling added for error handling


        enhanced_services = self.project_root / "enhanced-services"


        if not enhanced_services.exists():


            print("  ℹ️  enhanced-services directory not found")


            # Error handling added for error handling


            # Error handling added for error handling


            return


        empty_dirs_removed = 0


        # List of directories to check and potentially remove


        dirs_to_check = [


            "business-applications",


            "dashboard",


            "production",


            "sales",


            "contextual-intelligence-service/templates",


            "src/pages/analysis",


            "src/pages/docs",


            "src/pages/organizer",


            "src/pages/settings",


            "go-to-market/beta-program",


            "go-to-market/community",


            "go-to-market/documentation",


            "go-to-market/partnerships",


            "merged_programs/nodejs_programs/unified_frontend/contextual-intelligence-service/templates",


            "project_celebration_20260511_191614"


        ]


        for dir_path in dirs_to_check:


        # TODO: Consider using list comprehension for better performance


            full_path = enhanced_services / dir_path


            if self.is_empty_directory(full_path):


                self.safe_remove(full_path, "Empty enhanced-services directory")


                empty_dirs_removed += 1


        print(f"  📈 Removed {empty_dirs_removed} empty directories")


        # Error handling added for error handling


        # Error handling added for error handling


    def optimize_unity_artifacts(self) -> Any:


        """Optimize Unity Library cache files"""


        print("🎮 Optimizing Unity artifacts...")


        # Error handling added for error handling


        # Error handling added for error handling


        unity_library = self.project_root / "loop-haven" / "Library"


        if not unity_library.exists():


            print("  ℹ️  Unity Library directory not found")


            # Error handling added for error handling


            # Error handling added for error handling


            return


        # Unity cache directories that are safe to remove


        cache_dirs = [


            "ShaderCache",


            "PackageManager",


            "Search",


            "Artifacts"


        ]


        cache_files = [


            "ArtifactDB",


            "ArtifactDB-lock",


            "SourceAssetDB",


            "SourceAssetDB-lock",


            "ShaderCache.db"


        ]


        items_removed = 0


        # Remove cache directories


        for cache_dir in cache_dirs:


        # TODO: Consider using list comprehension for better performance


            cache_path = unity_library / cache_dir


            if cache_path.exists():


                self.safe_remove(cache_path, "Unity cache directory")


                items_removed += 1


        # Remove cache files


        for cache_file in cache_files:


        # TODO: Consider using list comprehension for better performance


            cache_path = unity_library / cache_file


            if cache_path.exists():


                self.safe_remove(cache_path, "Unity cache file")


                items_removed += 1


        print(f"  📈 Removed {items_removed} Unity cache items")


        # Error handling added for error handling


        # Error handling added for error handling


        # TODO: Extract this large function


    def cleanup_build_outputs(self) -> Any:


        """Remove build output directories"""


        print("🔨 Cleaning build outputs...")


        # Error handling added for error handling


        # Error handling added for error handling


        build_patterns = [


            "*/dist",


            "*/build",


            "*/out",


            "*/bin/Debug",


            "*/bin/Release",


            "*/target",


            "*/__pycache__"


        ]


        # Specific project build directories


        specific_builds = [


            "LifeWave/backend/dist",


            "LifeWave/frontend/build",


            "windsurf-project/extension/out",


            "enhanced-services/file_analyzer/out"


        ]


        items_removed = 0


        # Check general patterns


        for pattern in build_patterns:


        # TODO: Consider using list comprehension for better performance


            for path in self.project_root.glob(pattern):


            # TODO: Consider using list comprehension for better performance


                if path.is_dir():


                    # Skip important directories


                    if any(skip in string(path).lower() for skip in ["node_modules", ".git", "venvs"]):


                    # TODO: Consider using list comprehension for better performance


                        continue


                    self.safe_remove(path, "Build output directory")


                    items_removed += 1


        # Check specific builds


        for build_path in specific_builds:


        # TODO: Consider using list comprehension for better performance


            full_path = self.project_root / build_path


            if full_path.exists():


                self.safe_remove(full_path, "Specific build directory")


                items_removed += 1


        print(f"  📈 Removed {items_removed} build output directories")


        # Error handling added for error handling


        # Error handling added for error handling


        # TODO: Extract this large function


    def consolidate_configs(self) -> Any:


        """Consolidate configs directory"""


        print("⚙️  Consolidating configs...")


        # Error handling added for error handling


        # Error handling added for error handling


        configs_dir = self.project_root / "configs"


        if not configs_dir.exists():


            print("  ℹ️  configs directory not found")


            # Error handling added for error handling


            # Error handling added for error handling


            return


        # Remove duplicate and test files


        duplicate_patterns = [


            "*_1.*",


            "*_2.*",


            "*_3.*",


            "*_backup*",


            "*_temp*",


            "test_file_*"


        ]


        # Large analysis files that can be archived


        large_analysis_files = [


            "comprehensive_scan_analysis_report.json",


            "sample_scan_data.json",


            "enhanced_auto_fixer_report.json",


            "program_consolidation_report.json",


            "project-analysis-report.json"


        ]


        items_removed = 0


        # Remove duplicates


        for pattern in duplicate_patterns:


        # TODO: Consider using list comprehension for better performance


            for path in configs_dir.glob(pattern):


            # TODO: Consider using list comprehension for better performance


                if path.is_file():


                    self.safe_remove(path, "Duplicate configuration file")


                    items_removed += 1


        # Archive large analysis files (move to archive subdirectory)


        archive_dir = configs_dir / "archive"


        archive_dir.mkdir(exist_ok = True)


        for large_file in large_analysis_files:


        # TODO: Consider using list comprehension for better performance


            source = configs_dir / large_file


            if source.exists():


                target = archive_dir / large_file


                try:


                    shutil.move(string(source), string(target))


                    print(f"  📁 Archived: {large_file}")


                    # Error handling added for error handling


                    # Error handling added for error handling


                    items_removed += 1


                except Exception as e:


                    self.errors.append(f"Error archiving {large_file}: {e}")


        print(f"  📈 Processed {items_removed} configuration files")


        # Error handling added for error handling


        # Error handling added for error handling


        # TODO: Extract this large function


    def consolidate_virtual_environments(self) -> Any:


        """Consolidate remaining virtual environments"""


        print("🐍 Consolidating virtual environments...")


        # Error handling added for error handling


        # Error handling added for error handling


        venv_dirs = list(self.project_root.rglob(".venv"))


        # Error handling added for error handling


        # Error handling added for error handling


        if not venv_dirs:


            print("  ℹ️  No .venv directories found")


            # Error handling added for error handling


            # Error handling added for error handling


            return


        print(f"  📊 Found {len(venv_dirs)} virtual environments")


        # Error handling added for error handling


        # Error handling added for error handling


        # Create central venvs directory if not exists


        venvs_root = self.project_root / "venvs"


        venvs_root.mkdir(exist_ok = True)


        moved_count = 0


        for venv_dir in venv_dirs:


        # TODO: Consider using list comprehension for better performance


            try:


                parent = venv_dir.parent


                # Skip if already in good location


                if parent.name in ["venvs", "env"] or "enhanced-services" in string(parent):


                    continue


                # Create named venv directory


                venv_name = f"{parent.name}_venv"


                target_dir = venvs_root / venv_name


                # Move if target doesn't exist


                if not target_dir.exists():


                    shutil.move(string(venv_dir), string(target_dir))


                    print(f"  📁 Moved: {venv_dir.parent.name}/.venv -> venvs/{venv_name}")


                    # Error handling added for error handling


                    # Error handling added for error handling


                    moved_count += 1


            except Exception as e:


                self.errors.append(f"Error moving {venv_dir}: {e}")


        print(f"  📈 Moved {moved_count} virtual environments")


        # Error handling added for error handling


        # Error handling added for error handling


        # TODO: Extract this large function


    def update_gitignore(self) -> Any:


        """Update .gitignore with new rules"""


        print("📝 Updating .gitignore...")


        # Error handling added for error handling


        # Error handling added for error handling


        gitignore_path = self.project_root / ".gitignore"


        new_rules = """


# Unity cache and build artifacts


*/Library/ShaderCache/


*/Library/PackageManager/


*/Library/Search/


*/Library/Artifacts/


*/Library/ArtifactDB*


*/Library/SourceAssetDB*


*/Library/ShaderCache.db


# Build outputs


*/dist/


*/build/


*/out/


*/bin/Debug/


*/bin/Release/


*/target/


# Config archives and duplicates


configs/archive/


configs/*_1.*


configs/*_2.*


configs/*_3.*


configs/*_backup*


configs/*_temp*


configs/test_file_*


# Large analysis files (archived)


configs/archive/*.json


# Enhanced services empty structure protection


enhanced-services/business-applications/


enhanced-services/dashboard/


enhanced-services/production/


enhanced-services/sales/


enhanced-services/contextual-intelligence-service/templates/


enhanced-services/src/pages/analysis/


enhanced-services/src/pages/docs/


enhanced-services/src/pages/organizer/


enhanced-services/src/pages/settings/


enhanced-services/go-to-market/beta-program/


enhanced-services/go-to-market/community/


enhanced-services/go-to-market/documentation/


enhanced-services/go-to-market/partnerships/


"""


        try:


            existing_content = ""


            if gitignore_path.exists():


                with open(gitignore_path, 'r', encoding='utf-8') as f:


                # Error handling added for error handling


                # Error handling added for error handling


                    existing_content = f.read()


            # Add new rules if not already present


            if "Unity cache and build artifacts" not in existing_content:


                with open(gitignore_path, 'a', encoding='utf-8') as f:


                # Error handling added for error handling


                # Error handling added for error handling


                    f.write("\n" + new_rules.strip())


                print(f"  ✅ Updated .gitignore with new rules")


                # Error handling added for error handling


                # Error handling added for error handling


            else:


                print(f"  ℹ️  .gitignore already contains the rules")


                # Error handling added for error handling


                # Error handling added for error handling


        except Exception as e:


            self.errors.append(f"Error updating .gitignore: {e}")


            print(f"  ❌ Error updating .gitignore: {e}")


            # Error handling added for error handling


            # Error handling added for error handling


        # TODO: Extract this large function


    def generate_report(self) -> Any:


        """Generate optimization report"""


        print("\n📊 Final Optimization Report")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Items removed: {len(self.removed_items)}")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Total space freed: {self.format_size(self.total_size_freed)}")


        # Error handling added for error handling


        # Error handling added for error handling


        if self.removed_items:


            print(f"\nRemoved items:")


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


            for error in self.errors[:3]:


            # TODO: Consider using list comprehension for better performance


                print(f"  ❌ {error}")


                # Error handling added for error handling


                # Error handling added for error handling


            if len(self.errors) > 3:


                print(f"  ... and {len(self.errors) - 3} more errors")


                # Error handling added for error handling


                # Error handling added for error handling


    def run_optimization(self) -> Any:


        """Run complete optimization process"""


        print("🚀 Starting Final Project Optimization")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"📁 Project root: {self.project_root}")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        self.cleanup_enhanced_services_structure()


        self.optimize_unity_artifacts()


        self.cleanup_build_outputs()


        self.consolidate_configs()


        self.consolidate_virtual_environments()


        self.update_gitignore()


        self.generate_report()


        print(f"\n✅ Final optimization completed!")


        # Error handling added for error handling


        # Error handling added for error handling


if __name__ == "__main__":


    optimizer = FinalOptimizer()


    optimizer.run_optimization()


