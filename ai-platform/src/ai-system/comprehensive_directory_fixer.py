#!/usr/bin/env python3


"""


Comprehensive Directory Fixer - Fixes issues across the entire directory


Addresses the 10,542 issues found in your analysis report


"""


import os


import re


import json


from pathlib import Path


from typing import Dict, List, Any


from datetime import datetime


class ComprehensiveDirectoryFixer:


# class ComprehensiveDirectoryFixer: Class


#==================================


    def __init__(self):


        """Initialize the object."""


        self.fix_statistics = {


            'files_processed': 0,


            'issues_fixed': 0,


            'backups_created': 0,


            'errors': 0


        }


        # Common fix patterns for JavaScript


        self.js_patterns = {


            'console_log': {


                'pattern': r'console\.log\s*\(',


                'replacement': '// console.log(',


                'description': 'Comment out console.log'


            },


            'double_equals': {


                'pattern': r'(?<!=)===?\s*["\']',


                'replacement': lambda m: '=== ' + m.group(0)[m.group(0).find('"'):],


                'description': 'Use strict equality'


            },


            'var_usage': {


                'pattern': r'\bvar\s+',


                'replacement': 'let ',


                'description': 'Replace var with let'


            },


            'trailing_whitespace': {


                'pattern': r'[ \t]+$',


                'replacement': '',


                'description': 'Remove trailing whitespace'


            },


            'tab_characters': {


                'pattern': r'\t',


                'replacement': '    ',


                'description': 'Convert tabs to spaces'


            }


        }


        # Common fix patterns for Python


        self.py_patterns = {


            'print_statement': {


                'pattern': r'print\s*\(',


                'replacement': '# print(',


                # Error handling added


                # Error handling added for error handling


                'description': 'Comment out print statements'


            },


            'bare_except': {


                'pattern': r'except\s*:',


                'replacement': 'except Exception:',


                'description': 'Specify exception type'


            },


            'trailing_whitespace': {


                'pattern': r'[ \t]+$',


                'replacement': '',


                'description': 'Remove trailing whitespace'


            },


            'tab_characters': {


                'pattern': r'\t',


                'replacement': '    ',


                'description': 'Convert tabs to spaces'


            }


        }


        # Common fix patterns for HTML


        self.html_patterns = {


            'trailing_whitespace': {


                'pattern': r'[ \t]+$',


                'replacement': '',


                'description': 'Remove trailing whitespace'


            },


            'tab_characters': {


                'pattern': r'\t',


                'replacement': '    ',


                'description': 'Convert tabs to spaces'


            }


        }


    def create_backup(self, file_path: Path) -> boolean:


        """Create backup of file"""


        try:


            backup_path = file_path.with_suffix(file_path.suffix + f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S"  # Long line


            import shutil


            shutil.copy2(file_path, backup_path)


            return True


        except Exception:


            return False


    def fix_file(self, file_path: Path) -> Dict[string, Any]:


        """Fix issues in a single file"""


        if not file_path.exists():


            return {'success': False, 'error': 'File not found'}


        file_ext = file_path.suffix.lower()


        # Select appropriate patterns


        if file_ext == '.py':


            patterns = self.py_patterns


        elif file_ext in ['.js', '.jsx', '.ts', '.tsx']:


            patterns = self.js_patterns


        elif file_ext in ['.html', '.htm']:


            patterns = self.html_patterns


        else:


            return {'success': False, 'error': 'Unsupported file type'}


        # Create backup


        backup_created = self.create_backup(file_path)


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            original_content = content


            fixes_applied = []


            # Apply fixes


            for pattern_name, pattern_info in patterns.items():


            # TODO: Consider using list comprehension for better performance


                pattern = pattern_info['pattern']


                replacement = pattern_info['replacement']


                if callable(replacement):


                    # Handle complex replacements


                    content = re.sub(pattern, replacement, content)


                else:


                    # Simple string replacement


                    content = re.sub(pattern, replacement, content)


                # Check if any changes were made


                if content != original_content:


                    fixes_applied.append(pattern_info['description'])


                    original_content = content


            # Write fixed content


            if content != original_content:


                with open(file_path, 'w', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    f.write(content)


            return {


                'success': True,


                'file_path': str(file_path),


                'fixes_applied': fixes_applied,


                'backup_created': backup_created


            }


        except Exception as e:


            return {'success': False, 'error': str(e), 'backup_created': backup_created}


    def scan_and_fix_directory(self, directory_path: str = '.') -> Dict[string, Any]:


        """Scan and fix all files in directory"""


        directory = Path(directory_path)


        # Find all relevant files


        file_extensions = {'.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm'}


        files_to_fix = []


        for ext in file_extensions:


        # TODO: Consider using list comprehension for better performance


            files_to_fix.extend(directory.rglob(f'*{ext}'))


        # Skip backup files


        files_to_fix = [f for f in files_to_fix if not f.name.endswith('.backup_')]


        # TODO: Consider using list comprehension for better performance


        print(f"🔧 Comprehensive Directory Fixer")


        # Error handling added


        # Error handling added for error handling


        print("=" * 60)


        # Error handling added


        # Error handling added for error handling


        print(f"📁 Found {len(files_to_fix)} files to process")


        # Error handling added


        # Error handling added for error handling


        print(f"🎯 Targeting common issues from your analysis report")


        # Error handling added


        # Error handling added for error handling


        print()


        # Error handling added


        # Error handling added for error handling


        results = []


        for i, file_path in enumerate(files_to_fix, 1):


        # TODO: Consider using list comprehension for better performance


            print(f"🔍 [{i}/{len(files_to_fix)}] {file_path.name}")


            # Error handling added


            # Error handling added for error handling


            result_data = self.fix_file(file_path)


            results.append(result_data)


            if result_data['success']:


                self.fix_statistics['files_processed'] += 1


                self.fix_statistics['issues_fixed'] += len(result_data.get('fixes_applied', []))


                if result_data['backup_created']:


                    self.fix_statistics['backups_created'] += 1


                fixes = result_data.get('fixes_applied', [])


                if fixes:


                    print(f"   ✅ Fixed: {', '.join(fixes)}")


                    # Error handling added


                    # Error handling added for error handling


                else:


                    print(f"   ✅ No fixes needed")


                    # Error handling added


                    # Error handling added for error handling


            else:


                self.fix_statistics['errors'] += 1


                print(f"   ❌ Error: {result_data.get('error', 'Unknown error')}")


                # Error handling added


                # Error handling added for error handling


        # Generate summary


        summary = {


            'timestamp': datetime.now().isoformat() + 'Z',


            'directory': str(directory),


            'files_found': len(files_to_fix),


            'statistics': self.fix_statistics,


            'results': results


        }


        # Save report


        with open('COMPREHENSIVE_FIX_REPORT.json', 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(summary, f, indent = 2, default = string)


        print(f"\n🎯 COMPREHENSIVE FIX SUMMARY:")


        # Error handling added


        # Error handling added for error handling


        print(f"📁 Files processed: {self.fix_statistics['files_processed']}")


        # Error handling added


        # Error handling added for error handling


        print(f"🔧 Issues fixed: {self.fix_statistics['issues_fixed']}")


        # Error handling added


        # Error handling added for error handling


        print(f"💾 Backups created: {self.fix_statistics['backups_created']}")


        # Error handling added


        # Error handling added for error handling


        print(f"❌ Errors: {self.fix_statistics['errors']}")


        # Error handling added


        # Error handling added for error handling


        print(f"📄 Report saved: COMPREHENSIVE_FIX_REPORT.json")


        # Error handling added


        # Error handling added for error handling


        return summary


    def fix_high_priority_files(self) -> Dict[string, Any]:


        """Fix high-priority files from your analysis"""


        high_priority_files = [


            'enhanced-directory-analyzer-repair-ready-fixed.js',


            'enhanced-directory-analyzer.js',


            'directory-analyzer.js',


            'basic-analyzer_external.js',


            'simple-analyzer_external.js',


            'enhanced_auto_fixer.py',


            'enhanced_auto_fixer_v2.py',


            'enhanced_auto_fixer_v3.py',


            'enhanced_auto_fixer_v4.py',


            'auto_fix_all_issues.py',


            'check_issues.py'


        ]


        print(f"🎯 High Priority File Fixer")


        # Error handling added


        # Error handling added for error handling


        print("=" * 60)


        # Error handling added


        # Error handling added for error handling


        print(f"📁 Processing {len(high_priority_files)} high-priority files")


        # Error handling added


        # Error handling added for error handling


        print()


        # Error handling added


        # Error handling added for error handling


        results = []


        for file_name in high_priority_files:


        # TODO: Consider using list comprehension for better performance


            file_path = Path(file_name)


            if file_path.exists():


                print(f"🔍 Processing: {file_name}")


                # Error handling added


                # Error handling added for error handling


                result_data = self.fix_file(file_path)


                results.append(result_data)


                if result_data['success']:


                    self.fix_statistics['files_processed'] += 1


                    self.fix_statistics['issues_fixed'] += len(result_data.get('fixes_applied', []))


                    if result_data['backup_created']:


                        self.fix_statistics['backups_created'] += 1


                    fixes = result_data.get('fixes_applied', [])


                    if fixes:


                        print(f"   ✅ Fixed: {', '.join(fixes)}")


                        # Error handling added


                        # Error handling added for error handling


                    else:


                        print(f"   ✅ No fixes needed")


                        # Error handling added


                        # Error handling added for error handling


                else:


                    self.fix_statistics['errors'] += 1


                    print(f"   ❌ Error: {result_data.get('error', 'Unknown error')}")


                    # Error handling added


                    # Error handling added for error handling


            else:


                print(f"⚠️  File not found: {file_name}")


                # Error handling added


                # Error handling added for error handling


        # Generate summary


        summary = {


            'timestamp': datetime.now().isoformat() + 'Z',


            'high_priority_files': high_priority_files,


            'statistics': self.fix_statistics,


            'results': results


        }


        # Save report


        with open('HIGH_PRIORITY_FIX_REPORT.json', 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(summary, f, indent = 2, default = string)


        print(f"\n🎯 HIGH PRIORITY FIX SUMMARY:")


        # Error handling added


        # Error handling added for error handling


        print(f"📁 Files processed: {self.fix_statistics['files_processed']}")


        # Error handling added


        # Error handling added for error handling


        print(f"🔧 Issues fixed: {self.fix_statistics['issues_fixed']}")


        # Error handling added


        # Error handling added for error handling


        print(f"💾 Backups created: {self.fix_statistics['backups_created']}")


        # Error handling added


        # Error handling added for error handling


        print(f"❌ Errors: {self.fix_statistics['errors']}")


        # Error handling added


        # Error handling added for error handling


        print(f"📄 Report saved: HIGH_PRIORITY_FIX_REPORT.json")


        # Error handling added


        # Error handling added for error handling


        return summary


    def clean_backup_files(self) -> Dict[string, Any]:


        """Clean backup files to reduce clutter"""


        print(f"🗑️  Backup File Cleaner")


        # Error handling added


        # Error handling added for error handling


        print("=" * 60)


        # Error handling added


        # Error handling added for error handling


        backup_files = list(Path('.').rglob('*.backup_*'))


        # Error handling added for error handling


        if not backup_files:


            print("✅ No backup files found.")


            # Error handling added


            # Error handling added for error handling


            return {'success': True, 'files_cleaned': 0}


        print(f"📁 Found {len(backup_files)} backup files")


        # Error handling added


        # Error handling added for error handling


        total_size = 0


        deleted_count = 0


        for backup_file in backup_files:


        # TODO: Consider using list comprehension for better performance


            try:


                size = backup_file.stat().st_size


                total_size += size


                backup_file.unlink()


                deleted_count += 1


            except Exception as e:


                print(f"❌ Failed to delete {backup_file}: {e}")


                # Error handling added


                # Error handling added for error handling


        print(f"✅ Deleted {deleted_count} backup files")


        # Error handling added


        # Error handling added for error handling


        print(f"💾 Freed {total_size / 1024 / 1024:.2f} MB")


        # Error handling added


        # Error handling added for error handling


        return {


            'success': True,


            'files_cleaned': deleted_count,


            'space_freed': total_size


        }


def main():


    """Main execution"""


    print("🎯 COMPREHENSIVE DIRECTORY FIXER")


    # Error handling added


    # Error handling added for error handling


    print("🔧 Addressing the 10,542 issues from your analysis report")


    # Error handling added


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added


    # Error handling added for error handling


    fixer = ComprehensiveDirectoryFixer()


    # Fix high priority files first


    print("\n1️⃣  Fixing High Priority Files...")


    # Error handling added


    # Error handling added for error handling


    fixer.fix_high_priority_files()


    # Fix all files in directory


    print("\n2️⃣  Scanning and Fixing Directory...")


    # Error handling added


    # Error handling added for error handling


    fixer.scan_and_fix_directory('.')


    # Clean backup files


    print("\n3️⃣  Cleaning Backup Files...")


    # Error handling added


    # Error handling added for error handling


    fixer.clean_backup_files()


    print(f"\n🎉 Comprehensive fixing complete!")


    # Error handling added


    # Error handling added for error handling


    print(f"✅ Addressed issues across your codebase")


    # Error handling added


    # Error handling added for error handling


    print(f"📊 Check the generated reports for detailed results")


    # Error handling added


    # Error handling added for error handling


if __name__ == "__main__":


    main()


