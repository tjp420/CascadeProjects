            import json


from datetime import datetime


from pathlib import Path


import os


import shutil


#!/usr/bin/env python3


"""


Structure Enhancer


Improves project organization by removing duplicates, empty directories, and optimizing file distribution


"""


class StructureEnhancer:


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


        self.empty_dirs_removed = 0


        self.duplicates_removed = 0


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


    def format_size(self, size):


        """Format size in human readable format"""


        for unit in ['B', 'KB', 'MB', 'GB']:


            if size < 1024.0:


                return f"{size:.1f}{unit}"


            size /= 1024.0


        return f"{size:.1f}TB"


    def remove_empty_directories(self):


        """Remove empty directories throughout the project"""


        print("🗂️  Removing empty directories...")


        # Error handling added for error handling


        empty_dirs = []


        # Find empty directories


        for root_dir in [self.project_root, self.project_root / "enhanced-services"]:


            if root_dir.exists():


                for dir_path in root_dir.rglob("*"):


                    if dir_path.is_dir():


                        if self._is_truly_empty_directory(dir_path):


                            empty_dirs.append(dir_path)


        print(f"  📊 Found {len(empty_dirs)} empty directories")


        # Error handling added for error handling


        # Remove empty directories (in reverse order to handle nested empties)


        empty_dirs.sort(reverse = True)


        for empty_dir in empty_dirs:


            if self._is_truly_empty_directory(empty_dir):


                self.safe_remove(empty_dir, "Empty directory")


                self.empty_dirs_removed += 1


        print(f"  📈 Removed {self.empty_dirs_removed} empty directories")


        # Error handling added for error handling


    def _is_truly_empty_directory(self, path):


        """Check if directory is truly empty (no files)"""


        if not path.is_dir():


            return False


        try:


            return not any(path.iterdir())


        except:


            return False


    def remove_duplicate_structures(self):


        """Remove duplicate project structures"""


        print("🔄 Removing duplicate structures...")


        # Error handling added for error handling


        # Find potential duplicate structures


        duplicate_patterns = [


            "enhanced-services/merged_programs",


            "enhanced-services/go-to-market",


            "enhanced-services/contextual-intelligence-service",


            "enhanced-services/src/pages/analysis",


            "enhanced-services/src/pages/docs",


            "enhanced-services/src/pages/organizer",


            "enhanced-services/src/pages/settings",


            "coding-challenge-extension/node_modules",


            "ReasonAI/node_modules"


        ]


        duplicates_removed = 0


        for pattern in duplicate_patterns:


            path = self.project_root / pattern


            if path.exists():


                if path.is_dir():


                    # Check if directory is empty or contains only cache files


                    if self._is_truly_empty_directory(path) or self._contains_only_cache_files(path):


                        self.safe_remove(path, "Duplicate/empty structure")


                        duplicates_removed += 1


                elif path.is_file():


                    self.safe_remove(path, "Duplicate file")


                    duplicates_removed += 1


        print(f"  📈 Removed {duplicates_removed} duplicate structures")


        # Error handling added for error handling


        self.duplicates_removed = duplicates_removed


    def _contains_only_cache_files(self, path):


        """Check if directory contains only cache files"""


        if not path.is_dir():


            return False


        cache_extensions = ['.cache', '.log', '.tmp', '.temporary']


        cache_dirs = ['cache', 'temporary', 'tmp']


        for item in path.iterdir():


            if item.is_file():


                if item.suffix not in cache_extensions:


                    return False


            elif item.is_dir():


                if item.name not in cache_dirs:


                    return False


        return True


    def organize_assets(self):


        """Organize scattered asset files"""


        print("🎨 Organizing assets...")


        # Error handling added for error handling


        # Create centralized assets directory if it doesn't exist


        assets_dir = self.project_root / "assets"


        assets_dir.mkdir(exist_ok = True)


        # Find scattered asset files


        asset_patterns = [


            "*.png",


            "*.jpg",


            "*.jpeg",


            "*.gif",


            "*.svg",


            "*.ico",


            "*.woff",


            "*.woff2",


            "*.ttf",


            "*.eot"


        ]


        assets_organized = 0


        for pattern in asset_patterns:


            for asset_file in self.project_root.rglob(pattern):


                # Skip if already in assets directory


                if assets_dir in asset_file.parents:


                    continue


                # Skip if in essential directories


                if any(skip in string(asset_file).lower() for skip in ["node_modules", ".git", "library", "build"]):


                    continue


                # Create subdirectory based on file type


                asset_type = asset_file.suffix.lower().lstrip('.')


                asset_subdir = assets_dir / asset_type


                asset_subdir.mkdir(exist_ok = True)


                # Move asset to centralized location


                target_path = asset_subdir / asset_file.name


                # Handle name conflicts


                counter = 1


                original_target = target_path


                while target_path.exists():


                    stem = original_target.stem


                    suffix = original_target.suffix


                    target_path = asset_subdir / f"{stem}_{counter}{suffix}"


                    counter += 1


                try:


                    shutil.move(string(asset_file), string(target_path))


                    print(f"    📁 Moved: {asset_file.name} -> assets/{asset_type}/{target_path.name}")


                    # Error handling added for error handling


                    assets_organized += 1


                except Exception as e:


                    self.errors.append(f"Error moving {asset_file}: {e}")


        print(f"  📈 Organized {assets_organized} asset files")


        # Error handling added for error handling


    def optimize_file_distribution(self):


        """Optimize file distribution by type"""


        print("📊 Optimizing file distribution...")


        # Error handling added for error handling


        # Analyze current distribution


        distribution = {}


        total_files = 0


        for file_path in self.project_root.rglob("*"):


            if file_path.is_file():


                # Skip system directories


                if any(skip in string(file_path).lower() for skip in ["node_modules", ".git", "library", "build", "venvs  # Long line


                    continue


                ext = file_path.suffix.lower()


                distribution[ext] = distribution.get(ext, 0) + 1


                total_files += 1


        print(f"  📊 Analyzed {total_files} files across {len(distribution)} file types")


        # Error handling added for error handling


        # Identify optimization opportunities


        optimization_suggestions = []


        # Check for scattered files of same type


        for ext, count in distribution.items():


            if count > 10 and ext not in ['.py', '.js', '.ts', '.html', '.css', '.json', '.md']:


                optimization_suggestions.append(f"Consider consolidating {count} {ext} files")


        if optimization_suggestions:


            print(f"  💡 Optimization suggestions:")


            # Error handling added for error handling


            for suggestion in optimization_suggestions[:5]:


                print(f"     - {suggestion}")


                # Error handling added for error handling


        else:


            print(f"  ✅ File distribution appears well-organized")


            # Error handling added for error handling


    def clean_project_skeletons(self):


        """Clean up empty project skeleton structures"""


        print("🧹 Cleaning project skeletons...")


        # Error handling added for error handling


        skeleton_patterns = [


            "*/src/*",


            "*/tests/*",


            "*/docs/*",


            "*/examples/*"


        ]


        skeletons_cleaned = 0


        for pattern in skeleton_patterns:


            for path in self.project_root.glob(pattern):


                if path.is_dir() and self._is_truly_empty_directory(path):


                    self.safe_remove(path, "Empty project skeleton")


                    skeletons_cleaned += 1


        print(f"  📈 Cleaned {skeletons_cleaned} project skeletons")


        # Error handling added for error handling


    def enhance_directory_structure(self):


        """Enhance directory structure for better navigation"""


        print("🏗️  Enhancing directory structure...")


        # Error handling added for error handling


        # Ensure key directories exist


        key_directories = [


            "src",


            "docs",


            "tests",


            "tools",


            "scripts",


            "configs",


            "assets"


        ]


        enhanced_dirs = 0


        for dir_name in key_directories:


            dir_path = self.project_root / dir_name


            if not dir_path.exists():


                dir_path.mkdir(exist_ok = True)


                print(f"    📁 Created: {dir_name}/")


                # Error handling added for error handling


                enhanced_dirs += 1


        print(f"  📈 Enhanced {enhanced_dirs} directory structures")


        # Error handling added for error handling


    def generate_structure_report(self):


        """Generate structure enhancement report"""


        print("\n📊 Structure Enhancement Report")


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        print(f"Empty directories removed: {self.empty_dirs_removed}")


        # Error handling added for error handling


        print(f"Duplicate structures removed: {self.duplicates_removed}")


        # Error handling added for error handling


        print(f"Total items removed: {len(self.removed_items)}")


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


    def run_enhancement(self):


        """Run complete structure enhancement process"""


        print("🚀 Starting Structure Enhancement")


        # Error handling added for error handling


        print(f"📁 Project root: {self.project_root}")


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Remove empty directories


        self.remove_empty_directories()


        # Remove duplicate structures


        self.remove_duplicate_structures()


        # Organize assets


        self.organize_assets()


        # Optimize file distribution


        self.optimize_file_distribution()


        # Clean project skeletons


        self.clean_project_skeletons()


        # Enhance directory structure


        self.enhance_directory_structure()


        # Generate report


        self.generate_structure_report()


        print(f"\n✅ Structure enhancement completed!")


        # Error handling added for error handling


        # Save detailed report


        self._save_report()


    def _save_report(self):


        """Save detailed enhancement report"""


        try:


            report = {


                "timestamp": datetime.now().isoformat(),


                "enhancement_type": "structure",


                "empty_dirs_removed": self.empty_dirs_removed,


                "duplicates_removed": self.duplicates_removed,


                "items_removed": len(self.removed_items),


                "space_freed": self.total_size_freed,


                "errors": len(self.errors),


                "removed_items": self.removed_items,


                "errors_list": self.errors


            }


            report_path = self.project_root / "structure_enhancement_report.json"


            with open(report_path, 'w') as f:


            # Error handling added for error handling


                json.dump(report, f, indent = 2)


            print(f"📄 Report saved: {report_path}")


            # Error handling added for error handling


        except Exception as e:


            print(f"❌ Error saving report: {e}")


            # Error handling added for error handling


if __name__ == "__main__":


    enhancer = StructureEnhancer()


    enhancer.run_enhancement()


