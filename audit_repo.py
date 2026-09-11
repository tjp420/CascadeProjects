import os
import sys
from collections import Counter
import subprocess

def analyze_directory(root_dir):
    print(f"🕵️  Scanning Workspace: {root_dir}\nPlucking out hidden file clusters...")
    
    has_git = os.path.exists(os.path.join(root_dir, '.git'))
    tracked_files = set()
    ignored_files = set()
    
    if has_git:
        try:
            # Fetch all explicitly tracked structural files
            out = subprocess.check_output(['git', 'ls-files'], cwd=root_dir, text=True, errors='ignore')
            for line in out.splitlines():
                tracked_files.add(os.path.normpath(os.path.join(root_dir, line)))
                
            # Fetch all files actively ignored by standard rule scopes
            out_ignored = subprocess.check_output(['git', 'ls-files', '--others', '--ignored', '--exclude-standard'], cwd=root_dir, text=True, errors='ignore')
            for line in out_ignored.splitlines():
                ignored_files.add(os.path.normpath(os.path.join(root_dir, line)))
        except Exception as e:
            print(f"⚠️  Git mapping interrupted ({e}). Processing via raw fallback loop...")

    total_files = 0
    extension_counter = Counter()
    folder_counter = Counter()
    
    tracked_count = 0
    ignored_count = 0
    untracked_but_not_ignored_count = 0
    
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            total_files += 1
            full_path = os.path.normpath(os.path.join(root, file))
            
            _, ext = os.path.splitext(file)
            ext = ext.lower() if ext else '[No Extension]'
            extension_counter[ext] += 1
            
            # Map top subdirectories out cleanly
            rel_path = os.path.relpath(full_path, root_dir)
            parts = rel_path.split(os.sep)
            top_folder = parts[0] if parts else '[Root]'
            
            if len(parts) > 1 and parts[0] in ['.git', 'node_modules', '.artifacts', 'src', 'dist', 'out']:
                folder_key = f"{parts[0]}/{parts[1]}"
            else:
                folder_key = top_folder
            folder_counter[folder_key] += 1
            
            if has_git:
                if full_path in tracked_files:
                    tracked_count += 1
                elif full_path in ignored_files or '.git' in parts:
                    ignored_count += 1
                else:
                    untracked_but_not_ignored_count += 1

    print("\n=== 📊 WORKSPACE METRIC RECAP ===")
    print(f"Total physical files on disk: {total_files:,}")
    if has_git:
        print(f"  🟢 Git Tracked (Needed / Application Core): {tracked_count:,} files")
        print(f"  🔴 Git Ignored / System Cache (Safe to Nuke):  {ignored_count:,} files")
        print(f"  🟡 Untracked / Staged Workspace Assets:      {untracked_but_not_ignored_count:,} files")
        
    print("\n=== 📁 TOP CULPRIT DIRECTORIES ===")
    print("Review this list to instantly locate where the large file clusters hide:")
    for folder, count in folder_counter.most_common(15):
        percentage = (count / total_files) * 100
        status = "❌ SAFE TO DELETE" if any(x in folder for x in ['node_modules', '.git/objects', '.artifacts', 'dist', 'out', 'cache', '.next', '.turbo']) else "🔒 KEEP"
        print(f"  [{status}] -> {count:,} files ({percentage:.1f}%) inside -> {folder}")
        
    print("\n=== 🗂️  FILE EXTENSION MATRIX ===")
    for ext, count in extension_counter.most_common(15):
        print(f"  {count:,} files -> {ext}")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    analyze_directory(target)
