import os
import shutil
import sys

def purge_workspace(root_dir):
    print(f"🧹 Starting deep workspace purge in: {root_dir}")
    print("=" * 60)

    # These are the automated folders safe to blow away completely
    folders_to_delete = [
        'targets',          # Build test artifacts and deployment targets (33.9% of files!)
        '.artifacts',       # Playwright/Cypress test execution files and traces
        'dist',             # Compiled JavaScript output
        'out',              # Alternative compiled build output
        'build',            # Secondary compilation artifact folders
        'coverage',         # Unit test HTML visual coverage reports
        '.turbo',           # Turbo cache logs
        '.vite',            # Vite local development build cache
        '.next',            # Next.js build cache
        'node_modules_host',# Secondary node_modules clone (can rebuild)
    ]

    files_to_delete = [
        '.eslintcache',     # Temporary lint tracking state file
        '.tsbuildinfo'      # Incremental TypeScript compilation register
    ]

    deleted_folders = 0
    deleted_files = 0
    total_size_freed = 0

    # 1. Delete specific known cache/artifact directories
    for folder in folders_to_delete:
        target_path = os.path.join(root_dir, folder)
        if os.path.exists(target_path):
            try:
                # Calculate size before deletion
                folder_size = sum(
                    os.path.getsize(os.path.join(dirpath, filename))
                    for dirpath, dirnames, filenames in os.walk(target_path)
                    for filename in filenames
                )
                size_mb = folder_size / (1024 * 1024)
                
                print(f"❌ Deleting transient directory: {folder}/ ({size_mb:.1f} MB)")
                shutil.rmtree(target_path)
                deleted_folders += 1
                total_size_freed += folder_size
            except Exception as e:
                print(f"⚠️  Could not delete folder {folder}: {e}")

    # 2. Delete specific individual step-cache files
    for file in files_to_delete:
        target_path = os.path.join(root_dir, file)
        if os.path.exists(target_path):
            try:
                file_size = os.path.getsize(target_path)
                size_kb = file_size / 1024
                print(f"❌ Deleting cache file: {file} ({size_kb:.1f} KB)")
                os.remove(target_path)
                deleted_files += 1
                total_size_freed += file_size
            except Exception as e:
                print(f"⚠️  Could not delete file {file}: {e}")

    print("=" * 60)
    size_gb = total_size_freed / (1024 * 1024 * 1024)
    print(f"🏁 Clean-up finished. Purged {deleted_folders} folders and {deleted_files} files.")
    print(f"💾 Disk space freed: {size_gb:.2f} GB")
    print(f"ℹ️  node_modules/ was left intact so you can keep working.")
    print(f"💡 To nuke node_modules too (will need npm install after): python clean_repo.py --aggressive")

    if len(sys.argv) > 1 and sys.argv[1] == '--aggressive':
        node_path = os.path.join(root_dir, 'node_modules')
        if os.path.exists(node_path):
            print("\n💥 AGGRESSIVE MODE: Deleting node_modules/ (51K+ files)...")
            try:
                node_size = sum(
                    os.path.getsize(os.path.join(dirpath, filename))
                    for dirpath, dirnames, filenames in os.walk(node_path)
                    for filename in filenames
                )
                node_size_gb = node_size / (1024 * 1024 * 1024)
                
                shutil.rmtree(node_path)
                print(f"✨ node_modules/ has been completely flattened! ({node_size_gb:.2f} GB freed)")
                total_size_freed += node_size
                size_gb = total_size_freed / (1024 * 1024 * 1024)
                print(f"📊 TOTAL DISK FREED: {size_gb:.2f} GB")
                print(f"⚙️  Run 'npm install' when ready to restore dependencies.")
            except Exception as e:
                print(f"⚠️  Could not delete node_modules: {e}")

if __name__ == '__main__':
    current_directory = os.path.dirname(os.path.abspath(__file__))
    purge_workspace(current_directory)
