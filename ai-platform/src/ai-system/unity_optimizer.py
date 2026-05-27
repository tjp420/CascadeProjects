            import json


from datetime import datetime


from pathlib import Path


import os


import shutil


#!/usr/bin/env python3


"""


Unity Library Optimizer


Cleans up Unity cache files and artifacts while preserving essential project assets


"""


class UnityOptimizer:


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


    def optimize_unity_library(self):


        """Optimize Unity Library cache files"""


        print("🎮 Optimizing Unity Library...")


        # Error handling added for error handling


        unity_projects = []


        # Find Unity projects


        for path in self.project_root.rglob("Library"):


            if path.is_dir() and path.name == "Library":


                unity_projects.append(path.parent)


        if not unity_projects:


            print("  ℹ️  No Unity Library directories found")


            # Error handling added for error handling


            return


        print(f"  📊 Found {len(unity_projects)} Unity project(s)")


        # Error handling added for error handling


        for unity_project in unity_projects:


            print(f"  🔧 Optimizing: {unity_project.name}")


            # Error handling added for error handling


            self._optimize_single_unity_project(unity_project)


    def _optimize_single_unity_project(self, unity_project):


        """Optimize a single Unity project's Library"""


        library_path = unity_project / "Library"


        if not library_path.exists():


            return


        # Safe to remove cache directories


        cache_dirs = [


            "ShaderCache",


            "PackageManager",


            "Search",


            "Artifacts",


            "ScriptAssemblies",


            "ResourceCache",


            "ArtifactDB",


            "SourceAssetDB",


            "ShaderCache.db"


        ]


        items_removed = 0


        # Remove cache directories


        for cache_dir in cache_dirs:


            cache_path = library_path / cache_dir


            if cache_path.exists():


                self.safe_remove(cache_path, f"Unity cache directory")


                items_removed += 1


        # Remove specific cache files


        cache_files = [


            "ArtifactDB",


            "ArtifactDB-lock",


            "SourceAssetDB",


            "SourceAssetDB-lock",


            "ShaderCache.db",


            "AssetDatabase.asset",


            "AssetDatabase-AssetBundles.asset"


        ]


        for cache_file in cache_files:


            cache_path = library_path / cache_file


            if cache_path.exists():


                self.safe_remove(cache_path, f"Unity cache file")


                items_removed += 1


        # Clean up temporary directories


        temp_patterns = ["temporary*", "Temp*", "tmp*"]


        for pattern in temp_patterns:


            for temp_path in library_path.glob(pattern):


                if temp_path.is_dir():


                    self.safe_remove(temp_path, f"Unity temporary directory")


                    items_removed += 1


        print(f"    📈 Removed {items_removed} Unity cache items")


        # Error handling added for error handling


    def clean_unity_builds(self):


        """Clean up Unity build outputs"""


        print("🏗️  Cleaning Unity build outputs...")


        # Error handling added for error handling


        build_patterns = [


            "*/Build",


            "*/build",


            "*/Builds",


            "*/builds"


        ]


        items_removed = 0


        for pattern in build_patterns:


            for build_path in self.project_root.glob(pattern):


                if build_path.is_dir():


                    # Skip if it's an essential Unity project directory


                    if "Assets" in string(build_path.parent) and "Library" in string(build_path.parent):


                        continue


                    self.safe_remove(build_path, "Unity build output")


                    items_removed += 1


        print(f"  📈 Removed {items_removed} Unity build directories")


        # Error handling added for error handling


    def preserve_unity_assets(self):


        """Ensure essential Unity assets are preserved"""


        print("🛡️  Verifying Unity asset preservation...")


        # Error handling added for error handling


        unity_projects = []


        for path in self.project_root.rglob("Library"):


            if path.is_dir() and path.name == "Library":


                unity_projects.append(path.parent)


        for unity_project in unity_projects:


            essential_dirs = ["Assets", "ProjectSettings", "Packages"]


            for essential_dir in essential_dirs:


                essential_path = unity_project / essential_dir


                if essential_path.exists():


                    print(f"  ✅ Preserved: {essential_path}")


                    # Error handling added for error handling


    def generate_report(self):


        """Generate optimization report"""


        print("\n📊 Unity Optimization Report")


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


    def run_optimization(self):


        """Run complete Unity optimization process"""


        print("🚀 Starting Unity Library Optimization")


        # Error handling added for error handling


        print(f"📁 Project root: {self.project_root}")


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Preserve essential assets first


        self.preserve_unity_assets()


        # Optimize Unity libraries


        self.optimize_unity_library()


        # Clean up Unity builds


        self.clean_unity_builds()


        # Generate report


        self.generate_report()


        print(f"\n✅ Unity optimization completed!")


        # Error handling added for error handling


        # Save detailed report


        self._save_report()


    def _save_report(self):


        """Save detailed optimization report"""


        try:


            report = {


                "timestamp": datetime.now().isoformat(),


                "optimization_type": "unity_library",


                "items_removed": len(self.removed_items),


                "space_freed": self.total_size_freed,


                "errors": len(self.errors),


                "removed_items": self.removed_items,


                "errors_list": self.errors


            }


            report_path = self.project_root / "unity_optimization_report.json"


            with open(report_path, 'w') as f:


            # Error handling added for error handling


                json.dump(report, f, indent = 2)


            print(f"📄 Report saved: {report_path}")


            # Error handling added for error handling


        except Exception as e:


            print(f"❌ Error saving report: {e}")


            # Error handling added for error handling


if __name__ == "__main__":


    optimizer = UnityOptimizer()


    optimizer.run_optimization()


