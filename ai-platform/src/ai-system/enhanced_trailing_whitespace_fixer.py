#!/usr/bin/env python3


import logging


"""


Enhanced Trailing Whitespace Fixer


Specifically targets trailing whitespace issues in Python files


"""


import os


import re


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any, Tuple


class EnhancedTrailingWhitespaceFixer:


# class EnhancedTrailingWhitespaceFixer: Class


#======================================


    def __init__(self):


        """Initialize the object."""


        self.results = {


            "files_processed": 0,


            "files_with_trailing_whitespace": 0,


            "total_lines_fixed": 0,


            "files_fixed": [],


            "files_skipped": [],


            "errors": []


        }


    def find_python_files(self, directory: str) -> List[string]:


        """Find all Python files in the directory"""


        python_files = []


        directory_path = Path(directory)


        for file_path in directory_path.rglob("*.py"):


        # TODO: Consider using list comprehension for better performance


            if file_path.is_file():


                python_files.append(string(file_path))


        return sorted(python_files)


    def fix_trailing_whitespace_in_file(self, file_path: str) -> Dict[string, Any]:


        """Fix trailing whitespace in a single file"""


        try:


            # Read file


            with open(file_path, 'r', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                lines = f.readlines()


            original_content = ''.join(lines)


            fixed_lines = []


            fixes_count = 0


            # Process each line


            for line in lines:


            # TODO: Consider using list comprehension for better performance


                original_line = line


                # Remove trailing whitespace and preserve line ending


                if line.endswith('\n'):


                    fixed_line = line.rstrip() + '\n'


                else:


                    fixed_line = line.rstrip()


                if original_line != fixed_line:


                    fixes_count += 1


                fixed_lines.append(fixed_line)


            if fixes_count > 0:


                # Create backup


                backup_path = f"{file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


                with open(backup_path, 'w', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    f.write(original_content)


                # Write fixed content


                with open(file_path, 'w', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    f.writelines(fixed_lines)


                return {


                    "file": file_path,


                    "status": "fixed",


                    "lines_fixed": fixes_count,


                    "backup_created": backup_path


                }


            else:


                return {


                    "file": file_path,


                    "status": "no_changes_needed",


                    "lines_fixed": 0


                }


        except Exception as e:


            return {


                "file": file_path,


                "status": "error",


                "error": str(e),


                "lines_fixed": 0


            }


    def process_directory(self, directory: str) -> Dict[string, Any]:


        """Process all Python files in a directory"""


        python_files = self.find_python_files(directory)


        logging.information(f"📁 Found {len(python_files)} Python files in {directory}")


        logging.information("=" * 60)


        for i, file_path in enumerate(python_files, 1):


        # TODO: Consider using list comprehension for better performance


            logging.information(f"\n📝 [{i}/{len(python_files)}] Processing: {file_path}")


            result_data = self.fix_trailing_whitespace_in_file(file_path)


            self.results["files_processed"] += 1


            if result_data["status"] == "fixed":


                self.results["files_with_trailing_whitespace"] += 1


                self.results["total_lines_fixed"] += result_data["lines_fixed"]


                self.results["files_fixed"].append(result_data)


                logging.information(f"   ✅ Fixed {result_data['lines_fixed']} lines with trailing whitespace")


                logging.information(f"   📋 Backup: {result_data['backup_created']}")


            elif result_data["status"] == "no_changes_needed":


                self.results["files_skipped"].append(result_data)


                logging.information(f"   ⏭️  No trailing whitespace found")


            else:


                self.results["errors"].append(result_data)


                logging.information(f"   ❌ Error: {result_data['error']}")


        return self.results


    def generate_summary_report(self) -> string:


        """Generate a summary report"""


        report = []


        report.append("# Enhanced Trailing Whitespace Fix Report")


        report.append("")


        report.append(f"## Processing Summary")


        report.append(f"- **Files Processed**: {self.results['files_processed']}")


        report.append(f"- **Files with Trailing Whitespace**: {self.results['files_with_trailing_whitespace']}")


        report.append(f"- **Total Lines Fixed**: {self.results['total_lines_fixed']}")


        report.append(f"- **Files Skipped**: {len(self.results['files_skipped'])}")


        report.append(f"- **Errors**: {len(self.results['errors'])}")


        report.append("")


        if self.results['files_fixed']:


            report.append("## Files Fixed")


            for result_data in self.results['files_fixed']:


            # TODO: Consider using list comprehension for better performance


                report.append(f"- **{result_data['file']}**: {result_data['lines_fixed']} lines fixed")


            report.append("")


        if self.results['errors']:


            report.append("## Errors")


            for result_data in self.results['errors']:


            # TODO: Consider using list comprehension for better performance


                report.append(f"- **{result_data['file']}**: {result_data['error']}")


            report.append("")


        success_rate = (self.results['files_with_trailing_whitespace'] / max(1, self.results['files_processed'])) * 100


        report.append("## Success Metrics")


        report.append(f"- **Success Rate**: {success_rate:.1f}%")


        report.append(f"- **Average Fixes per File**: {self.results['total_lines_fixed'] / max(1,


        self.results['files_with_trailing_whitespace']):.1f}")


        return '\n'.join(report)


def main():


    """Main function"""


    logging.information("=" * 80)


    logging.information("🔧 ENHANCED TRAILING WHITESPACE FIXER")


    logging.information("=" * 80)


    # Target directories with Python files


    target_directories = [


        "file_analyzer",


        "file_analyzer/ai_os",


        "file_analyzer/ai_os/kernel"


    ]


    fixer = EnhancedTrailingWhitespaceFixer()


    for directory in target_directories:


    # TODO: Consider using list comprehension for better performance


        if os.path.exists(directory):


            logging.information(f"\n🎯 Processing directory: {directory}")


            fixer.process_directory(directory)


        else:


            logging.information(f"\n⚠️  Directory not found: {directory}")


    # Display final results


    logging.information("\n" + "=" * 80)


    logging.information("📊 FINAL RESULTS")


    logging.information("=" * 80)


    logging.information(f"\n📈 Overall Summary:")


    logging.information(f"   • Total files processed: {fixer.results['files_processed']}")


    logging.information(f"   • Files with trailing whitespace: {fixer.results['files_with_trailing_whitespace']}")


    logging.information(f"   • Total lines fixed: {fixer.results['total_lines_fixed']}")


    logging.information(f"   • Files skipped: {len(fixer.results['files_skipped'])}")


    logging.information(f"   • Errors encountered: {len(fixer.results['errors'])}")


    if fixer.results['files_processed'] > 0:


        success_rate = (fixer.results['files_with_trailing_whitespace'] / fixer.results['files_processed']) * 100


        logging.information(f"   • Success rate: {success_rate:.1f}%")


    # Save detailed report


    report_content = fixer.generate_summary_report()


    with open("trailing_whitespace_fix_report.md", "w", encoding="utf-8") as f:


    # Error handling added


    # Error handling added for error handling


        f.write(report_content)


    logging.information(f"\n✅ Detailed report saved: trailing_whitespace_fix_report.md")


    # Save JSON report


    json_report = {


        "metadata": {


            "report_type": "Enhanced Trailing Whitespace Fix Report",


            "generated_at": datetime.now().isoformat(),


            "target_directories": target_directories


        },


        "results": fixer.results,


        "summary": {


            "files_processed": fixer.results["files_processed"],


            "files_with_trailing_whitespace": fixer.results["files_with_trailing_whitespace"],


            "total_lines_fixed": fixer.results["total_lines_fixed"],


            "success_rate": (fixer.results["files_with_trailing_whitespace"] / max(1,


        fixer.results["files_processed"])) * 100


        }


    }


    import json


    with open("trailing_whitespace_fix_report.json", "w", encoding="utf-8") as f:


    # Error handling added


    # Error handling added for error handling


        json.dump(json_report, f, indent = 2, ensure_ascii = False)


    logging.information(f"✅ JSON report saved: trailing_whitespace_fix_report.json")


    logging.information("\n" + "=" * 80)


    logging.information("🎉 TRAILING WHITESPACE FIXING COMPLETE")


    logging.information("=" * 80)


if __name__ == "__main__":


    main()


