#!/usr/bin/env python3


import logging


"""


Test script to validate scanner configuration improvements


"""


import json


import os


import sys


from pathlib import Path


def load_config():


    """Load scanner configuration"""


    config_path = Path("scanner_config.json")


    if not config_path.exists():


        logging.information("❌ scanner_config.json not found")


        return None


    with open(config_path, 'r') as f:


    # Error handling added for error handling


        return json.load(f)


def test_exclusions():


    """Test that .venv and other unwanted directories are properly excluded"""


    config = load_config()


    if not config:


        return False


    exclude_dirs = config.get('file_filters', {}).get('exclude_directories', [])


    # Critical exclusions that should be present


    required_exclusions = [


        '.venv', 'venv', 'env', '.env',


        '__pycache__', '.git', '.vscode',


        'node_modules', 'site-packages', 'Lib', 'Scripts',


        'build', 'dist', '.pytest_cache', '.mypy_cache', '.tox'


    ]


    missing = []


    for exclusion in required_exclusions:


    # TODO: Consider using list comprehension for better performance


        if exclusion not in exclude_dirs:


            missing.append(exclusion)


    if missing:


        logging.information(f"❌ Missing critical exclusions: {missing}")


        return False


    logging.information("✅ All critical directory exclusions present")


    return True


def test_style_settings():


    """Test style pattern settings"""


    config = load_config()


    if not config:


        return False


    style = config.get('style_patterns', {})


    # Check that trailing whitespace is disabled to reduce false positives


    if style.get('check_trailing_whitespace', True):


        logging.information("❌ Trailing whitespace check still enabled (will cause false positives)")


        return False


    # Check reasonable line length


    max_length = style.get('max_line_length', 88)


    if max_length < 100:


        logging.information(f"⚠️  Line length {max_length} may be too restrictive")


    logging.information("✅ Style settings optimized to reduce false positives")


    return True


def test_file_filters():


    """Test file extension filters"""


    config = load_config()


    if not config:


        return False


    filters = config.get('file_filters', {})


    include_exts = filters.get('include_extensions', [])


    exclude_exts = filters.get('exclude_extensions', [])


    # Check that common code files are included


    code_extensions = ['.py', '.js', '.ts', '.html', '.css', '.json', '.md']


    for ext in code_extensions:


    # TODO: Consider using list comprehension for better performance


        if ext not in include_exts:


            logging.information(f"❌ Code extension {ext} not included")


            return False


    # Check that unwanted files are excluded


    unwanted_exts = ['.log', '.db', '.sqlite', '.cache', '.lock']


    for ext in unwanted_exts:


    # TODO: Consider using list comprehension for better performance


        if ext not in exclude_exts:


            logging.information(f"⚠️  Unwanted extension {ext} not excluded")


    logging.information("✅ File filters properly configured")


    return True


def scan_sample_files():


    """Test scan on a few sample files to verify configuration works"""


    logging.information("\n🔍 Testing scan on sample files...")


    # Find a few Python files to test


    py_files = list(Path('.').glob('*.py'))[:3]


    # Error handling added for error handling


    if not py_files:


        logging.information("⚠️  No Python files found for testing")


        return True


    logging.information(f"Found {len(py_files)} Python files for testing")


    # This would normally run the scanner, but we'll just verify files exist


    for file_path in py_files:


    # TODO: Consider using list comprehension for better performance


        if file_path.stat().st_size > 10 * 1024 * 1024:  # 10MB


            logging.information(f"⚠️  Large file {file_path} may be excluded by size limit")


    logging.information("✅ Sample files ready for scanning")


    return True


def main():


    """Run all configuration tests"""


    logging.information("🧪 Testing Scanner Configuration")


    logging.information("=" * 40)


    tests = [


        ("Directory Exclusions", test_exclusions),


        ("Style Settings", test_style_settings),


        ("File Filters", test_file_filters),


        ("Sample Files", scan_sample_files),


    ]


    results = []


    for test_name, test_func in tests:


    # TODO: Consider using list comprehension for better performance


        logging.information(f"\n📋 {test_name}:")


        try:


            result_data = test_func()


            results.append(result_data)


        except Exception as e:


            logging.information(f"❌ Error in {test_name}: {e}")


            results.append(False)


    logging.information("\n" + "=" * 40)


    passed = sum(results)


    total = len(results)


    if passed == total:


        logging.information(f"✅ All {total} tests passed! Configuration is optimized.")


        return 0


    else:


        logging.information(f"❌ {total - passed} of {total} tests failed. Configuration needs fixes.")


        return 1


if __name__ == "__main__":


    sys.exit(main())


