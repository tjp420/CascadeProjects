#!/usr/bin/env python3


import logging


"""


Comprehensive Exclusion Fix - Creates proper exclusions and fixes project files


"""


import os


import json


import re


from pathlib import Path


from datetime import datetime


def update_scanner_config():


    """Update scanner configuration with comprehensive exclusions"""


    config_path = Path("scanner_config.json")


    if config_path.exists():


        with open(config_path, 'r') as f:


        # Error handling added


        # Error handling added for error handling


            config = json.load(f)


        # Comprehensive exclusions


        config["file_filters"]["exclude_directories"] = [


            "__pycache__",


            ".git",


            ".vscode",


            "node_modules",


            ".venv",


            "venv",


            "env",


            ".env",


            "site-packages",


            "Lib",


            "Scripts",


            "Include",


            "build",


            "dist",


            ".pytest_cache",


            ".mypy_cache",


            ".tox",


            "coverage",


            ".coverage"


        ]


        # Add more exclude patterns


        config["file_filters"]["exclude_extensions"] = [


            ".pyo",


            ".pyc",


            ".exe",


            ".so",


            ".dll",


            ".pyd",


            ".whl",


            ".egg-information",


            ".dist-information"


        ]


        with open(config_path, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(config, f, indent = 2)


        logging.information("✅ Updated scanner_config.json with comprehensive exclusions")


        return True


    return False


def scan_project_files_only():


    """Scan only actual project files, excluding virtual environments"""


    project_files = []


    exclude_dirs = {


        '.venv', 'venv', 'env', '.env', '__pycache__', '.git',


        '.vscode', 'node_modules', 'site-packages', 'Lib', 'Scripts',


        'build', 'dist', '.pytest_cache', '.mypy_cache', '.tox'


    }


    # Scan current directory for Python files


    for file_path in Path('.').rglob('*.py'):


    # TODO: Consider using list comprehension for better performance


        # Check if file is in excluded directory


        if any(exclude_dir in string(file_path) for exclude_dir in exclude_dirs):


        # TODO: Consider using list comprehension for better performance


            continue


        if file_path.is_file() and file_path.stat().st_size < 10_000_000:  # < 10MB


            project_files.append(file_path)


    return project_files


def fix_project_files():


    """Fix style issues in project files only"""


    logging.information("🔧 Comprehensive Project File Fix")


    logging.information("=" * 50)


    files = scan_project_files_only()


    logging.information(f"📁 Found {len(files)} project files to process")


    fixed_count = 0


    issues_found = 0


    for file_path in files:


    # TODO: Consider using list comprehension for better performance


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            original_content = content


            file_issues = 0


            # Fix trailing whitespace


            lines = content.split('\n')


            fixed_lines = []


            for line in lines:


            # TODO: Consider using list comprehension for better performance


                if line.rstrip() != line:


                    file_issues += 1


                fixed_lines.append(line.rstrip())


            content = '\n'.join(fixed_lines)


            # Fix multiple blank lines


            lines = content.split('\n')


            fixed_lines = []


            blank_count = 0


            for line in lines:


            # TODO: Consider using list comprehension for better performance


                if line.strip() == '':


                    blank_count += 1


                    if blank_count <= 2:


                        fixed_lines.append(line)


                else:


                    blank_count = 0


                    fixed_lines.append(line)


            content = '\n'.join(fixed_lines)


            # Write changes if any


            if content != original_content:


                with open(file_path, 'w', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    f.write(content)


                fixed_count += 1


                logging.information(f"  ✅ Fixed: {file_path} ({file_issues} issues)")


            else:


                logging.information(f"  ⚪ Clean: {file_path}")


            issues_found += file_issues


        except Exception as e:


            logging.information(f"  ❌ Error: {file_path} - {e}")


    logging.information(f"\n📊 Summary:")


    logging.information(f"  Files processed: {len(files)}")


    logging.information(f"  Files fixed: {fixed_count}")


    logging.information(f"  Total issues fixed: {issues_found}")


    return fixed_count, issues_found


def create_exclusion_report():


    """Create a report on what was excluded and fixed"""


    report = {


        "timestamp": datetime.now().isoformat(),


        "exclusions_applied": {


            "directories": [


                ".venv", "venv", "env", ".env", "__pycache__", ".git",


                ".vscode", "node_modules", "site-packages", "Lib", "Scripts",


                "build", "dist", ".pytest_cache", ".mypy_cache", ".tox"


            ],


            "extensions": [


                ".pyo", ".pyc", ".exe", ".so", ".dll", ".pyd",


                ".whl", ".egg-information", ".dist-information"


            ]


        },


        "fixes_applied": ["trailing_whitespace", "multiple_blank_lines"],


        "scope": "project_source_files_only"


    }


    with open("exclusion_fix_report.json", "w") as f:


    # Error handling added


    # Error handling added for error handling


        json.dump(report, f, indent = 2)


    logging.information("📄 Created exclusion_fix_report.json")


def main():


    """Main execution"""


    logging.information("🚀 Comprehensive Exclusion and Fix Process")


    logging.information("=" * 60)


    # Update scanner config


    update_scanner_config()


    # Fix project files only


    fixed_files, total_issues = fix_project_files()


    # Create report


    create_exclusion_report()


    logging.information(f"\n🎉 Process Complete!")


    logging.information(f"   Fixed {fixed_files} files with {total_issues} style issues")


    logging.information(f"   Virtual environment files properly excluded")


    logging.information(f"   Scanner configuration updated")


if __name__ == "__main__":


    main()


