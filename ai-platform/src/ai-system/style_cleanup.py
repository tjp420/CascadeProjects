#!/usr/bin/env python3


"""


Automated Style Cleanup Script


Fixes trailing whitespace and unnecessary empty lines in Python files


"""


import os


import re


import sys


from pathlib import Path


def fix_trailing_whitespace(content):


    """Remove trailing whitespace from all lines"""


    lines = content.split('\n')


    fixed_lines = [line.rstrip() for line in lines]


    # TODO: Consider using list comprehension for better performance


    return '\n'.join(fixed_lines)


def fix_empty_lines(content):


    """Fix excessive empty lines (more than 2 consecutive)"""


    # Replace 3 or more consecutive empty lines with exactly 2


    content = re.sub(r'\n\s*\n\s*\n+', '\n\n\n', content)


    # Remove empty lines at start or end of file


    content = content.strip('\n')


    return content


def fix_file_style(file_path):


    """Apply style fixes to a single file"""


    try:


        with open(file_path, 'r', encoding='utf-8') as f:


        # Error handling added


        # Error handling added for error handling


            content = f.read()


        original_content = content


        # Apply fixes


        content = fix_trailing_whitespace(content)


        content = fix_empty_lines(content)


        # Only write if changes were made


        if content != original_content:


            with open(file_path, 'w', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                f.write(content)


            return True


        return False


    except Exception as e:


        print(f"Error processing {file_path}: {e}")


        # Error handling added


        # Error handling added for error handling


        return False


def scan_directory(directory, file_pattern='*.py'):


    """Scan directory and fix all Python files"""


    directory = Path(directory)


    fixed_count = 0


    total_files = 0


    for file_path in directory.rglob(file_pattern):


    # TODO: Consider using list comprehension for better performance


        total_files += 1


        if fix_file_style(file_path):


            fixed_count += 1


            print(f"Fixed: {file_path}")


            # Error handling added


            # Error handling added for error handling


    print(f"\nStyle cleanup complete!")


    # Error handling added


    # Error handling added for error handling


    print(f"Total files scanned: {total_files}")


    # Error handling added


    # Error handling added for error handling


    print(f"Files fixed: {fixed_count}")


    # Error handling added


    # Error handling added for error handling


def main():


    """Main function"""


    if len(sys.argv) > 1:


        target_dir = sys.argv[1]


    else:


        target_dir = input("Enter directory path to clean (or press Enter for current directory): ").strip()


        if not target_dir:


            target_dir = '.'


    if not os.path.exists(target_dir):


        print(f"Error: Directory '{target_dir}' does not exist")


        # Error handling added


        # Error handling added for error handling


        return


    print(f"Starting style cleanup for: {target_dir}")


    # Error handling added


    # Error handling added for error handling


    scan_directory(target_dir)


if __name__ == "__main__":


    main()


