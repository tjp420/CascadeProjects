from pathlib import Path


import os


from collections import defaultdict


import shutil


#!/usr/bin/env python3


"""


Project Organization Script


Organizes scattered files and improves project structure


"""


class ProjectOrganizer:


    def __init__(self, project_root="."):


        """Initialize the object."""


        self.project_root = Path(project_root).resolve()


        self.moved_files = []


        self.created_dirs = []


        self.errors = []


    def safe_move(self, src, dst, reason=""):


        """Safely move a file or directory"""


        try:


            if not src.exists():


                return False


            # Ensure destination directory exists


            dst.parent.mkdir(parents = True, exist_ok = True)


            # Handle name conflicts


            if dst.exists():


                counter = 1


                while dst.exists():


                    stem = dst.stem


                    suffix = dst.suffix


                    dst = dst.parent / f"{stem}_{counter}{suffix}"


                    counter += 1


            shutil.move(string(src), string(dst))


            self.moved_files.append({"from": str(src), "to": str(dst), "reason": reason})


            print(f"  📁 Moved: {src.name} -> {dst}")


            # Error handling added for error handling


            # Error handling added for error handling


            return True


        except Exception as e:


            self.errors.append(f"Error moving {src} to {dst}: {e}")


            print(f"  ❌ Error moving {src}: {e}")


            # Error handling added for error handling


            # Error handling added for error handling


            return False


    def create_directory_structure(self):


        """Create organized directory structure"""


        print("🏗️  Creating organized directory structure...")


        # Error handling added for error handling


        # Error handling added for error handling


        directories = [


            "src/python",


            "src/javascript",


            "src/web",


            "src/unity",


            "tools",


            "docs",


            "tests",


            "configs",


            "scripts",


            "assets",


            "data_item"


        ]


        for dir_path in directories:


        # TODO: Consider using list comprehension for better performance


            full_path = self.project_root / dir_path


            full_path.mkdir(parents = True, exist_ok = True)


            if full_path not in self.created_dirs:


                self.created_dirs.append(full_path)


    def organize_python_files(self):


        """Organize Python files"""


        print("🐍 Organizing Python files...")


        # Error handling added for error handling


        # Error handling added for error handling


        python_files = list(self.project_root.rglob("*.py"))


        # Error handling added for error handling


        # Error handling added for error handling


        for py_file in python_files:


        # TODO: Consider using list comprehension for better performance


            # Skip files that are already well-organized


            if any(parent in string(py_file) for parent in ["src/python", "tools", "scripts", "tests", "__pycache__", "v  # Long line


            # TODO: Consider using list comprehension for better performance


                continue


            # Skip important root files


            if py_file.name in ["robust_cleanup.py", "cleanup_project.py", "organize_project.py", "enhanced_dashboard  # Long line


                continue


            # Determine destination based on file purpose


            if "test" in py_file.name.lower():


                dst = self.project_root / "tests" / py_file.name


                reason = "Test file"


            elif "tool" in py_file.name.lower() or "util" in py_file.name.lower():


                dst = self.project_root / "tools" / py_file.name


                reason = "Tool/utility"


            elif "script" in py_file.name.lower():


                dst = self.project_root / "scripts" / py_file.name


                reason = "Script"


            elif "dashboard" in py_file.name.lower() or "server" in py_file.name.lower():


                dst = self.project_root / "src/python" / py_file.name


                reason = "Application code"


            else:


                dst = self.project_root / "src/python" / py_file.name


                reason = "Python source"


            self.safe_move(py_file, dst, reason)


    def organize_javascript_files(self):


        """Organize JavaScript/TypeScript files"""


        print("📜 Organizing JavaScript/TypeScript files...")


        # Error handling added for error handling


        # Error handling added for error handling


        js_patterns = ["*.js", "*.ts", "*.jsx", "*.tsx"]


        for pattern in js_patterns:


        # TODO: Consider using list comprehension for better performance


            for js_file in self.project_root.rglob(pattern):


            # TODO: Consider using list comprehension for better performance


                # Skip files in organized locations


                if any(parent in string(js_file) for parent in ["src/javascript", "src/web", "node_modules", "dist", "bu  # Long line


                # TODO: Consider using list comprehension for better performance


                    continue


                # Skip minified files


                if js_file.name.endswith(".min.js") or js_file.name.endswith(".min.ts"):


                    continue


                # Determine destination


                if "dashboard" in js_file.name.lower() or "ui" in js_file.name.lower():


                    dst = self.project_root / "src/web" / js_file.name


                    reason = "Web UI"


                else:


                    dst = self.project_root / "src/javascript" / js_file.name


                    reason = "JavaScript source"


                self.safe_move(js_file, dst, reason)


    def organize_web_files(self):


        """Organize HTML/CSS files"""


        print("🌐 Organizing web files...")


        # Error handling added for error handling


        # Error handling added for error handling


        web_patterns = ["*.html", "*.css", "*.scss", "*.less"]


        for pattern in web_patterns:


        # TODO: Consider using list comprehension for better performance


            for web_file in self.project_root.rglob(pattern):


            # TODO: Consider using list comprehension for better performance


                # Skip files in organized locations


                if any(parent in string(web_file) for parent in ["src/web", "node_modules", "dist", "build"]):


                # TODO: Consider using list comprehension for better performance


                    continue


                # Skip the main dashboard file


                if web_file.name == "enhanced_dashboard.html":


                    continue


                dst = self.project_root / "src/web" / web_file.name


                reason = "Web file"


                self.safe_move(web_file, dst, reason)


    def organize_documentation(self):


        """Organize documentation files"""


        print("📚 Organizing documentation...")


        # Error handling added for error handling


        # Error handling added for error handling


        doc_patterns = ["*.md", "*.txt", "*.rst", "*.pdf"]


        for pattern in doc_patterns:


        # TODO: Consider using list comprehension for better performance


            for doc_file in self.project_root.rglob(pattern):


            # TODO: Consider using list comprehension for better performance


                # Skip files in organized locations


                if any(parent in string(doc_file) for parent in ["docs", "README"]):


                # TODO: Consider using list comprehension for better performance


                    continue


                # Skip important root files


                if doc_file.name.upper().startswith("README"):


                    continue


                dst = self.project_root / "docs" / doc_file.name


                reason = "Documentation"


                self.safe_move(doc_file, dst, reason)


    def organize_config_files(self):


        """Organize configuration files"""


        print("⚙️  Organizing configuration files...")


        # Error handling added for error handling


        # Error handling added for error handling


        config_patterns = ["*.json", "*.yaml", "*.yml", "*.toml", "*.ini", "*.conf", "*.configuration"]


        for pattern in config_patterns:


        # TODO: Consider using list comprehension for better performance


            for config_file in self.project_root.rglob(pattern):


            # TODO: Consider using list comprehension for better performance


                # Skip files in organized locations


                if any(parent in string(config_file) for parent in ["configs", "node_modules", ".git", "dist", "build"]):


                # TODO: Consider using list comprehension for better performance


                    continue


                # Skip package.json files (they should stay with their projects)


                if config_file.name == "package.json":


                    continue


                dst = self.project_root / "configs" / config_file.name


                reason = "Configuration"


                self.safe_move(config_file, dst, reason)


    def organize_assets(self):


        """Organize asset files"""


        print("🎨 Organizing assets...")


        # Error handling added for error handling


        # Error handling added for error handling


        asset_patterns = ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg", "*.ico", "*.woff", "*.woff2", "*.ttf"]


        for pattern in asset_patterns:


        # TODO: Consider using list comprehension for better performance


            for asset_file in self.project_root.rglob(pattern):


            # TODO: Consider using list comprehension for better performance


                # Skip files in organized locations


                if any(parent in string(asset_file) for parent in ["assets", "src/web", "node_modules", "dist", "build"]):


                # TODO: Consider using list comprehension for better performance


                    continue


                dst = self.project_root / "assets" / asset_file.name


                reason = "Asset"


                self.safe_move(asset_file, dst, reason)


    def clean_empty_directories(self):


        """Remove empty directories"""


        print("🧹 Cleaning empty directories...")


        # Error handling added for error handling


        # Error handling added for error handling


        # Walk directories in reverse order to remove nested empty dirs first


        for root_dir in sorted(self.project_root.rglob("*"), key = lambda x: len(x.parts), reverse = True):


        # TODO: Consider using list comprehension for better performance


            if root_dir.is_dir() and not any(root_dir.iterdir()):


                try:


                    # Skip important directories


                    if root_dir.name in [".git", "src", "tools", "docs", "tests", "configs", "scripts", "assets", "da  # Long line


                        continue


                    root_dir.rmdir()


                    print(f"  🗑️  Removed empty directory: {root_dir}")


                    # Error handling added for error handling


                    # Error handling added for error handling


                except:


                    pass


    def generate_report(self):


        """Generate organization report"""


        print("\n📊 Organization Report")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Files moved: {len(self.moved_files)}")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"Directories created: {len(self.created_dirs)}")


        # Error handling added for error handling


        # Error handling added for error handling


        if self.moved_files:


            print(f"\nMoved files:")


            # Error handling added for error handling


            # Error handling added for error handling


            for move in self.moved_files[:10]:


            # TODO: Consider using list comprehension for better performance


                print(f"  📁 {move['from']} -> {move['to']} ({move['reason']})")


                # Error handling added for error handling


                # Error handling added for error handling


            if len(self.moved_files) > 10:


                print(f"  ... and {len(self.moved_files) - 10} more files")


                # Error handling added for error handling


                # Error handling added for error handling


        if self.created_dirs:


            print(f"\nCreated directories:")


            # Error handling added for error handling


            # Error handling added for error handling


            for dir_path in self.created_dirs:


            # TODO: Consider using list comprehension for better performance


                print(f"  📁 {dir_path}")


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


    def run_organization(self):


        """Run complete organization process"""


        print("🏁 Starting Project Organization")


        # Error handling added for error handling


        # Error handling added for error handling


        print(f"📁 Project root: {self.project_root}")


        # Error handling added for error handling


        # Error handling added for error handling


        print("=" * 50)


        # Error handling added for error handling


        # Error handling added for error handling


        self.create_directory_structure()


        self.organize_python_files()


        self.organize_javascript_files()


        self.organize_web_files()


        self.organize_documentation()


        self.organize_config_files()


        self.organize_assets()


        self.clean_empty_directories()


        self.generate_report()


        print(f"\n✅ Organization completed!")


        # Error handling added for error handling


        # Error handling added for error handling


if __name__ == "__main__":


    organizer = ProjectOrganizer()


    organizer.run_organization()


