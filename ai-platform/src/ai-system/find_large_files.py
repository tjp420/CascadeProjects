#!/usr/bin/env python3
"""
Find large Python files that need modularization
"""

import os
from pathlib import Path

def find_large_files():
    """Find Python files with more than 500 lines"""
    print("🔍 Finding large Python files...")
    
    large_files = []
    
    for file_path in Path('.').rglob('*.py'):
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                line_count = sum(1 for _ in f)
                if line_count > 500:
                    large_files.append((file_path, line_count))
        except Exception as e:
            print(f"    ⚠️ Error reading {file_path}: {e}")
    
    # Sort by line count (descending)
    large_files.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\n📊 Found {len(large_files)} files with >500 lines:")
    for i, (file_path, line_count) in enumerate(large_files[:10]):
        print(f"  {i+1}. {file_path.name}: {line_count:,} lines")
    
    return large_files

def main():
    large_files = find_large_files()
    
    if large_files:
        print(f"\n🎯 Next Steps:")
        print(f"  1. Modularize the largest file: {large_files[0][0].name}")
        print(f"  2. Apply the same approach used for make.py")
        print(f"  3. Create module files and update imports")
        print(f"  4. Test functionality")
        print(f"  5. Remove moved code from original")
        
        return large_files
    else:
        print("✅ No large files found!")
        return []

if __name__ == "__main__":
    main()
