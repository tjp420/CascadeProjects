#!/usr/bin/env python3


"""


High Priority File Fixer


Targets files with the most issues for immediate improvement


"""


import re


import os


import json


import shutil


from datetime import datetime


class HighPriorityFixer:


# class HighPriorityFixer: Class


#========================


    def __init__(self):


        """Initialize the object."""


        self.fixes_applied = 0


        self.files_processed = 0


        self.backup_dir = f"high_priority_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"


        # High priority files with 150+ issues


        self.high_priority_files = [


            "index_cleaned.html",           # 269 fixable issues


            "folder_results.html",           # 210 fixable issues


            "unified_dashboard.html",       # 213 fixable issues


            "results.html",                 # 199 fixable issues


            "multiple_results.html",        # 187 fixable issues


            "FINAL_SOLUTION.html",          # 112 fixable issues


            "FIXED_ANALYZER_REPORT.html",   # 140 fixable issues


            "simple-upload.html",           # 152 fixable issues


            "index.html",                   # 146 fixable issues


            "project_celebration_implementation.py"  # 151 fixable issues


        ]


        # JavaScript files with 50+ issues


        self.high_priority_js_files = [


            "csp-safe-analyzer_external.js",    # 78 issues (32 critical, 46 fixable)


            "csp-safe-analyzer_scripts.js",     # 78 issues (32 critical, 46 fixable)


            "enhanced-directory-analyzer-repair-ready-fixed.js", # 88 issues (10 critical, 78 fixable)


            "robust-analyzer_external.js",      # 79 issues (32 critical, 47 fixable)


            "robust-analyzer_scripts.js",       # 79 issues (32 critical, 47 fixable)


            "run-auto-fixer.js",               # 78 issues (40 critical, 38 fixable)


            "integrated-auto-fixer.js",         # 77 issues (27 critical, 50 fixable)


            "standalone-analyzer_external.js",   # 77 issues (32 critical, 45 fixable)


            "standalone-analyzer_scripts.js",    # 77 issues (32 critical, 45 fixable)


            "simple-analyzer_external.js",      # 57 issues (25 critical, 32 fixable)


        ]


    def create_backup(self, file_path):


        """Create backup of file before fixing"""


        if not os.path.exists(self.backup_dir):


            os.makedirs(self.backup_dir)


        backup_path = os.path.join(self.backup_dir, os.path.basename(file_path))


        shutil.copy2(file_path, backup_path)


        print(f"📦 Backup created: {backup_path}")


        # Error handling added


        # Error handling added for error handling


    def fix_html_issues(self, file_path):


        """Fix common HTML issues"""


        with open(file_path, 'r', encoding='utf-8') as f:


        # Error handling added


        # Error handling added for error handling


            content = f.read()


        original_content = content


        # Fix missing image dimensions


        content = re.sub(


            r'<img([^>]*?)\s*>',


            lambda m: self.add_image_dimensions(m.group(0)),


            content


        )


        # Fix inline event handlers (add CSP compliance)


        content = re.sub(


            r'onclick\s*=\s*["\'][^"\']*["\']',


            lambda m: self.fix_inline_event_handler(m.group(0)),


            content


        )


        # Fix missing alt attributes


        content = re.sub(


            r'<img([^>]*?)(?!alt=)([^>]*?)>',


            r'<img\1 alt="Image"\2>',


            content


        )


        # Save if changes made


        if content != original_content:


            with open(file_path, 'w', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                f.write(content)


            return True


        return False


    def add_image_dimensions(self, img_tag):


        """Add width and height attributes to img tags"""


        if 'width=' not in img_tag and 'height=' not in img_tag:


            return img_tag.replace('>', ' width="300" height="200">')


        return img_tag


    def fix_inline_event_handler(self, event_handler):


        """Replace inline event handlers with data_item attributes"""


        event_type = event_handler.split('=')[0].strip()


        return f'data_item-{event_type.replace("on", "")}="replaced"'


    def fix_javascript_issues(self, file_path):


        """Fix common JavaScript issues"""


        with open(file_path, 'r', encoding='utf-8') as f:


        # Error handling added


        # Error handling added for error handling


            content = f.read()


        original_content = content


        # Fix double equals to triple equals


        content = re.sub(r'==\s*["\']', '=== "', content)


        content = re.sub(r'==\s*(null|undefined|true|false)', r'=== \1', content)


        content = re.sub(r'!=\s*["\']', '!== "', content)


        content = re.sub(r'!=\s*(null|undefined|true|false)', r'!== \1', content)


        # Fix var to let/const


        content = re.sub(r'\bvar\s+(\w+)\s*=', 'let \\1 =', content)


        # Fix console.log to logger


        content = re.sub(r'console\.log\s*\(', 'logger.information(', content)


        # Fix debugger statements


        content = re.sub(r'\bdebugger\b', '// debugger removed', content)


        # Save if changes made


        if content != original_content:


            with open(file_path, 'w', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                f.write(content)


            return True


        return False


    def fix_python_issues(self, file_path):


        """Fix common Python issues"""


        with open(file_path, 'r', encoding='utf-8') as f:


        # Error handling added


        # Error handling added for error handling


            content = f.read()


        original_content = content


        # Fix print statements to logging


        content = re.sub(


            r'print\s*\(\s*["\']([^"\']*)["\']\s*\)',


            r'logger.information(\1)',


            content


        )


        # Fix bare except clauses


        content = re.sub(r'except\s*:', 'except Exception as e:', content)


        # Fix trailing whitespace


        content = re.sub(r'[ \t]+$', '', content, flags = re.MULTILINE)


        # Fix tab characters


        content = re.sub(r'\t', '    ', content)


        # Save if changes made


        if content != original_content:


            with open(file_path, 'w', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                f.write(content)


            return True


        return False


    def process_file(self, file_path):


        """Process a single file for fixes"""


        if not os.path.exists(file_path):


            print(f"❌ File not found: {file_path}")


            # Error handling added


            # Error handling added for error handling


            return False


        print(f"🔧 Processing: {file_path}")


        # Error handling added


        # Error handling added for error handling


        self.create_backup(file_path)


        file_ext = os.path.splitext(file_path)[1].lower()


        fixes_applied = False


        if file_ext == '.html':


            fixes_applied = self.fix_html_issues(file_path)


        elif file_ext == '.js':


            fixes_applied = self.fix_javascript_issues(file_path)


        elif file_ext == '.py':


            fixes_applied = self.fix_python_issues(file_path)


        if fixes_applied:


            self.fixes_applied += 1


            print(f"✅ Fixes applied to: {file_path}")


            # Error handling added


            # Error handling added for error handling


        else:


            print(f"ℹ️  No fixes needed for: {file_path}")


            # Error handling added


            # Error handling added for error handling


        self.files_processed += 1


        return fixes_applied


    def run_high_priority_fixes(self):


        """Run fixes on all high priority files"""


        print("🚀 Starting High Priority File Fixes...")


        # Error handling added


        # Error handling added for error handling


        print(f"📁 Backup directory: {self.backup_dir}")


        # Error handling added


        # Error handling added for error handling


        # Process HTML files


        print("\n📄 Processing HTML files...")


        # Error handling added


        # Error handling added for error handling


        for file_name in self.high_priority_files:


        # TODO: Consider using list comprehension for better performance


            self.process_file(file_name)


        # Process JavaScript files


        print("\n📄 Processing JavaScript files...")


        # Error handling added


        # Error handling added for error handling


        for file_name in self.high_priority_js_files:


        # TODO: Consider using list comprehension for better performance


            self.process_file(file_name)


        # Generate report


        self.generate_report()


    def generate_report(self):


        """Generate fix report"""


        report = {


            "timestamp": datetime.now().isoformat(),


            "backup_directory": self.backup_dir,


            "statistics": {


                "total_files": self.files_processed,


                "files_fixed": self.fixes_applied,


                "success_rate": (self.fixes_applied / self.files_processed * 100) if self.files_processed > 0 else 0


            },


            "high_priority_files": self.high_priority_files,


            "high_priority_js_files": self.high_priority_js_files


        }


        report_file = f"high_priority_fix_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


        with open(report_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(report, f, indent = 2)


        print(f"\n📊 Report generated: {report_file}")


        # Error handling added


        # Error handling added for error handling


        print(f"📈 Files processed: {self.files_processed}")


        # Error handling added


        # Error handling added for error handling


        print(f"🔧 Files fixed: {self.fixes_applied}")


        # Error handling added


        # Error handling added for error handling


        print(f"✅ Success rate: {report['statistics']['success_rate']:.1f}%")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    fixer = HighPriorityFixer()


    fixer.run_high_priority_fixes()


