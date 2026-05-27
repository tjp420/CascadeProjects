#!/usr/bin/env python3
"""
Backup and Recovery System

Provides automated backup and recovery for project files and configuration
"""

import os
import shutil
import json
import gzip
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import subprocess
import hashlib

# Constants
CONSTANT_4096 = 4096


class BackupSystem:
    """Handles backup and recovery operations"""

    def __init__(self, project_root: str = None):
        """Initialize the backup system"""
        self.project_root = Path(project_root) if project_root else Path(__file__).parent.parent.parent
        self.backup_dir = self.project_root / 'backups'
        self.backup_dir.mkdir(exist_ok=True)

        # Configuration
        self.max_backups = 10
        self.compression = True


    def create_backup(self, backup_name: str = None, include_patterns: List[str] = None,
                      exclude_patterns: List[str] = None) -> Dict:
        """Create a backup of the project"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_name = backup_name or f'backup_{timestamp}'
        backup_path = self.backup_dir / f'{backup_name}.tar.gz'

        print(f'Creating backup: {backup_name}')

        try:
            # Create tarball
            with tarfile.open(backup_path, 'w:gz' if self.compression else 'w') as tar:
                # Add files based on patterns
                for item in self._get_files_to_backup(include_patterns, exclude_patterns):
                    tar.add(item, arcname=item.relative_to(self.project_root))

            # Calculate checksum
            checksum = self._calculate_checksum(backup_path)

            # Get backup size
            backup_size = backup_path.stat().st_size

            # Create metadata
            metadata = {
                'name': backup_name,
                'timestamp': datetime.now().isoformat(),
                'size': backup_size,
                'checksum': checksum,
                'files_count': len(self._get_files_to_backup(include_patterns, exclude_patterns)),
                'compression': self.compression
            }

            # Save metadata
            metadata_path = self.backup_dir / f'{backup_name}.metadata.json'
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            # Clean up old backups
            self._cleanup_old_backups()

            print(f'Backup created successfully: {backup_name}')
            print(f'Size: {backup_size / (1024*1024):.2f} MB')
            print(f'Files: {metadata["files_count"]}')

            return {
                'success': True,
                'backup_name': backup_name,
                'backup_path': str(backup_path),


                'metadata': metadata
            }

        except Exception as e:
            print(f'Backup failed: {str(e)}')

            return {
                'success': False,
                'error': str(e)
            }


    def restore_backup(self, backup_name: str, target_dir: str = None) -> Dict:
        """Restore a backup"""
        backup_path = self.backup_dir / f'{backup_name}.tar.gz'
        metadata_path = self.backup_dir / f'{backup_name}.metadata.json'

        if not backup_path.exists():
            return {
                'success': False,
                'error': f'Backup {backup_name} not found'
            }

        # Load metadata
        metadata = {}
        if metadata_path.exists():
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)

        # Verify checksum
        if metadata.get('checksum'):
            current_checksum = self._calculate_checksum(backup_path)
            if current_checksum != metadata['checksum']:
                return {
                    'success': False,
                    'error': 'Backup checksum verification failed'
                }

        # Determine target directory
        target = Path(target_dir) if target_dir else self.project_root

        print(f'Restoring backup: {backup_name}')
        print(f'Target directory: {target}')

        try:


            # Extract backup


            with tarfile.open(backup_path, 'r:gz' if self.compression else 'r') as tar:


                tar.extractall(target)


            print(f'Backup restored successfully: {backup_name}')


            return {


                'success': True,


                'backup_name': backup_name,


                'target_directory': str(target),


                'metadata': metadata


            }


        except Exception as e:


            print(f'Restore failed: {str(e)}')


            return {


                'success': False,


                'error': str(e)


            }


    def list_backups(self) -> List[Dict]:


        """List all available backups"""


        backups = []


        for metadata_file in self.backup_dir.glob('*.metadata.json'):


            try:


                with open(metadata_file, 'r') as f:


                    metadata = json.load(f)


                backups.append(metadata)


            except Exception as e:


                print(f'Error reading metadata {metadata_file}: {str(e)}')


        # Sort by timestamp (newest first)


        backups.sort(key = lambda x: x.get('timestamp', ''), reverse = True)


        return backups


    def delete_backup(self, backup_name: str) -> Dict:


        """Delete a backup"""


        backup_path = self.backup_dir / f'{backup_name}.tar.gz'


        metadata_path = self.backup_dir / f'{backup_name}.metadata.json'


        try:


            if backup_path.exists():


                backup_path.unlink()


            if metadata_path.exists():


                metadata_path.unlink()


            print(f'Backup deleted: {backup_name}')


            return {


                'success': True,


                'backup_name': backup_name


            }


        except Exception as e:


            print(f'Delete failed: {str(e)}')


            return {


                'success': False,


                'error': str(e)


            }


    def _get_files_to_backup(self, include_patterns: List[str] = None,


                            exclude_patterns: List[str] = None) -> List[Path]:


        """Get list of files to backup based on patterns"""


        files = []


        # Default include patterns


        if include_patterns is None:


            include_patterns = [


                'src/**',


                'web/**',


                'tests/**',


                'tools/**',


                'docs/**',


                '*.md',


                '*.json',


                '*.py',


                '*.js',


                '.env.example'


            ]


        # Default exclude patterns


        if exclude_patterns is None:


            exclude_patterns = [


                'node_modules/**',


                '__pycache__/**',


                '*.pyc',


                '.git/**',


                'backups/**',


                'dist/**',


                'build/**',


                '.pytest_cache/**',


                '*.log'


            ]


        # Collect files


        for pattern in include_patterns:


            for item in self.project_root.glob(pattern):


                if item.is_file():


                    # Check if file matches exclude patterns


                    excluded = False


                    for exclude in exclude_patterns:


                        if item.match(exclude):


                            excluded = True


                            break


                    if not excluded:


                        files.append(item)


                elif item.is_dir():


                    for file in item.rglob('*'):


                        if file.is_file():


                            excluded = False


                            for exclude in exclude_patterns:


                                if file.match(exclude):


                                    excluded = True


                                    break


                            if not excluded:


                                files.append(file)


        # Remove duplicates


        files = list(set(files))


        return files


    def _calculate_checksum(self, file_path: Path) -> str:


        """Calculate SHA256 checksum of a file"""


        sha256_hash = hashlib.sha256()


        with open(file_path, 'rb') as f:


            for chunk in iter(lambda: f.read(CONSTANT_4096), b''):


                sha256_hash.update(chunk)


        return sha256_hash.hexdigest()


    def _cleanup_old_backups(self):


        """


        """


        backups = self.list_backups()


        if len(backups) > self.max_backups:


            # Remove oldest backups


            for backup in backups[self.max_backups:]:


                self.delete_backup(backup['name'])


                print(f'Cleaned up old backup: {backup["name"]}')


def main():


    """Main function for command-line usage"""


    import sys


    backup_system = BackupSystem()


    if len(sys.argv) < 2:


        print('Usage: python backup_system.py [create|restore|list|delete] [args...]')


        print('Commands:')


        print('  create [name] - Create a backup')


        print('  restore <name> [target] - Restore a backup')


        print('  list - List all backups')


        print('  delete <name> - Delete a backup')


        return


    command = sys.argv[1]


    if command == 'create':


        name = sys.argv[2] if len(sys.argv) > 2 else None


        result_data = backup_system.create_backup(name)


        print(json.dumps(result_data, indent = 2))


    elif command == 'restore':


        if len(sys.argv) < 3:


            print('Error: backup name required')


            return


        name = sys.argv[2]


        target = sys.argv[3] if len(sys.argv) > 3 else None


        result_data = backup_system.restore_backup(name, target)


        print(json.dumps(result_data, indent = 2))


    elif command == 'list':


        backups = backup_system.list_backups()


        print(f'Total backups: {len(backups)}')


        for backup in backups:


            print(f"\n{backup['name']}")


            print(f"  Timestamp: {backup['timestamp']}")


            print(f"  Size: {backup['size'] / (1024*1024):.2f} MB")


            print(f"  Files: {backup['files_count']}")


    elif command == 'delete':


        if len(sys.argv) < 3:


            print('Error: backup name required')


            return


        name = sys.argv[2]


        result_data = backup_system.delete_backup(name)


        print(json.dumps(result_data, indent = 2))


    else:


        print(f'Unknown command: {command}')


if __name__ == '__main__':


    main()


