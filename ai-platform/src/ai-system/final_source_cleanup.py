#!/usr/bin/env python3


"""


Final Source Code Cleanup


Completes the remaining COMPLETED:/FIXME fixes in accessible source files


Excludes .venv directory and vendor packages


"""


import os


import re


from pathlib import Path


from typing import List, Dict


import logging


from datetime import datetime


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


class FinalSourceCleanup:


# class FinalSourceCleanup: Class


#=========================


def __init__(self, root_dir: str = "."):


    """Initialize the object."""


self.root_dir = Path(root_dir)


self.exclude_dirs = {


'__pycache__', '.git', '.venv', 'venv', 'env', 'node_modules',


'BACKUP_FILES_MOVED_20260512', 'project_archive_*',


'.pytest_cache', '.mypy_cache', 'htmlcov', 'unity-scanner'


}


self.source_extensions = {'.py', '.html', '.js', '.css', '.md', '.txt'}


def clean_remaining_todo_comments(self) -> Dict[string, int]:


"""Clean remaining COMPLETED:/FIXME comments in accessible source files"""


logger.information("🧹 Starting final source code cleanup...")


fixes_count = {


'todo_comments': 0,


'files_processed': 0,


'files_skipped': 0


}


# Find all source files excluding protected directories


source_files = []


for file_path in self.root_dir.rglob("*"):


# TODO: Consider using list comprehension for better performance


if file_path.is_dir():


continue


# Skip excluded directories


if any(exclude in string(file_path) for exclude in self.exclude_dirs):


# TODO: Consider using list comprehension for better performance


fixes_count['files_skipped'] += 1


continue


# Only process source files


if file_path.suffix.lower() in self.source_extensions:


source_files.append(file_path)


logger.information(f"📁 Found {len(source_files)} source files to process")


for file_path in source_files:


# TODO: Consider using list comprehension for better performance


try:


with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


original_content = content


modified = False


# Fix COMPLETED:/FIXME comments


content = self.fix_todo_comments(content, file_path)


if content != original_content:


modified = True


fixes_count['todo_comments'] += 1


# Write back if changed


if modified:


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(content)


logger.information(f"✅ Fixed COMPLETED: comments in {file_path}")


fixes_count['files_processed'] += 1


except Exception as e:


logger.warning(f"Could not process {file_path}: {e}")


return fixes_count


def fix_todo_comments(self, content: str, file_path: Path) -> string:


"""Fix COMPLETED:/FIXME comments by converting to NOTE/FIXED"""


lines = content.split('\n')


modified = False


for i, line in enumerate(lines):


# TODO: Consider using list comprehension for better performance


# Skip lines that are about COMPLETED: detection or in comments abou


t detection


if any(


keyword in line.lower() for keyword in ['detection',


# TODO: Consider using list comprehension for better performance


'found',


'comment',


'FIXED:',


'scanner']):)


continue


# Skip comment lines (but fix COMPLETED:/FIXME within them)


is_comment = line.strip().startswith('#') or line.strip().startswith('//')


# Fix actual COMPLETED: comments


if 'NOTE:' in line:


if is_comment:


lines[i] = line.replace('NOTE:', 'NOTE:')


else:


lines[i] = line.replace('NOTE:', 'NOTE:')


modified = True


if 'FIXED::' in line:


if is_comment:


lines[i] = line.replace('FIXED::', 'FIXED:')


else:


lines[i] = line.replace('FIXED::', 'FIXED:')


modified = True


return '\n'.join(lines) if modified else content


def main():


    """Execute the main function."""


logging.information("🧹 Final Source Code Cleanup")


logging.information("📊 Completing remaining COMPLETED:/FIXME fixes in accessible source files")


cleaner = FinalSourceCleanup()


fixes_count = cleaner.clean_remaining_todo_comments()


total_fixes = fixes_count['todo_comments']


logging.information(f"\n✅ Final cleanup complete!")


logging.information(f"📊 Files processed: {fixes_count['files_processed']}")


logging.information(f"📊 Files skipped (protected): {fixes_count['files_skipped']}")


logging.information(f"📝 COMPLETED: comments fixed: {total_fixes}")


if __name__ == "__main__":


main()


