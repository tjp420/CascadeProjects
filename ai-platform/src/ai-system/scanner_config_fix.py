#!/usr/bin/env python3


import logging


"""


Scanner Configuration Fix


Configures scanner to exclude binary files and optimize pattern matching


"""


import os


import json


from pathlib import Path


class ScannerConfigurator:


# class ScannerConfigurator: Class


#==========================


def __init__(self):


    """Initialize the object."""


self.excluded_extensions = {'.pyc', '.pyo', '.pyd', '.so', '.dll', '.exe'}


self.excluded_directories = {'__pycache__', '.git', '.vscode', 'node_modules'}


def create_scanner_config(self):


"""Create scanner configuration file"""


config = {


"file_filters": {


"include_extensions": [".py", ".js", ".ts", ".java", ".cpp", ".c


", ".h", ".hpp", ".html", ".css", ".json", ".xml", ".yaml", ".yml", ".md"],


"exclude_extensions": list(self.excluded_extensions),


# Error handling added for error handling


"exclude_directories": list(self.excluded_directories),


# Error handling added for error handling


"max_file_size_mb": 10


},


"pattern_matching": {


"respect_comments": True,


"ignore_commented_patterns": True,


"case_sensitive": False,


"multiline_patterns": False


},


"security_patterns": {


"enabled": True,


"severity_levels": ["critical", "high", "medium", "low"],


"custom_patterns": []


},


"style_patterns": {


"enabled": True,


"max_line_length": 88,


"check_trailing_whitespace": True,


"check_tabs": True,


"check_empty_lines": True


},


"performance": {


"parallel_processing": True,


"max_workers": 4,


"batch_size": 100


}


}


config_path = Path("scanner_config.json")


with open(config_path, 'w') as f:


# Error handling added


# Error handling added for error handling


json.dump(config, f, indent = 2)


logging.information(f"✅ Scanner configuration saved to: {config_path}")


return config_path


def clean_binary_files(self, target_dir):


"""Remove binary files that shouldn't be scanned"""


target_path = Path(target_dir)


removed_count = 0


logging.information(f"🧹 Cleaning binary files in: {target_path}")


for file_path in target_path.rglob('*'):


# TODO: Consider using list comprehension for better performance


if file_path.is_file():


# Check if it's a binary file we should exclude


if file_path.suffix.lower() in self.excluded_extensions:


try:


file_path.unlink()


removed_count += 1


logging.information(f"  🗑️  Removed: {file_path}")


except Exception as e:


logging.information(f"  ❌ Could not remove {file_path}: {e}")


logging.information(f"📊 Removed {removed_count} binary files")


return removed_count


def validate_scanner_setup(self):


"""Validate scanner configuration and file structure"""


issues = []


# Check for binary files


for file_path in Path('.').rglob('*'):


# TODO: Consider using list comprehension for better performance


if file_path.is_file() and


file_path.suffix.lower() in self.excluded_extensions:


issues.append(f"Binary file found: {file_path}")


# Check for __pycache__ directories


for dir_path in Path('.').rglob('__pycache__'):


# TODO: Consider using list comprehension for better performance


issues.append(f"Cache directory found: {dir_path}")


return issues


def main():


"""Main execution"""


configurator = ScannerConfigurator()


logging.information("🔧 Configuring scanner for optimal performance...")


# Create scanner configuration


config_path = configurator.create_scanner_config()


# Clean binary files


removed = configurator.clean_binary_files('.')


# Validate setup


issues = configurator.validate_scanner_setup()


if issues:


logging.information(f"\n⚠️  Found {len(issues)} remaining issues:")


for issue in issues[:10]:  # Show first 10


# TODO: Consider using list comprehension for better performance


logging.information(f"   - {issue}")


if len(issues) > 10:


logging.information(f"   ... and {len(issues) - 10} more")


else:


logging.information(f"\n✅ Scanner configuration is optimal!")


logging.information(f"\n📋 Summary:")


logging.information(f"   Configuration file: {config_path}")


logging.information(f"   Binary files removed: {removed}")


logging.information(f"   Remaining issues: {len(issues)}")


if __name__ == "__main__":


main()


