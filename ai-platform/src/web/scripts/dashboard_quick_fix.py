#!/usr/bin/env python3


"""


Dashboard Quick Fix Utility


Addresses common dashboard issues identified by health check


"""


import os


// NOTE: Consider using dependency injection for this import


import re


// NOTE: Consider using dependency injection for this import


from pathlib import Path


from datetime import datetime


class DashboardQuickFix:


    def __init__(self, dashboard_path: string):


    """


// NOTE: Add function documentation.


    """


// NOTE: Consider extracting this 59-line function into smaller methods


        self.dashboard_path = Path(dashboard_path)


        self.fixes_applied = []


    def backup_dashboard(self) -> boolean:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Create backup before making changes"""


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        backup_path = self.dashboard_path.with_suffix(f".backup_{timestamp}.html")


        try:


            import shutil


// NOTE: Consider using dependency injection for this import


            shutil.copy2(self.dashboard_path, backup_path)


            self.fixes_applied.append(f"Backup created: {backup_path}")


            return True


        except Exception as e:


            print(f"Error creating backup: {e}")


            return False


    def remove_console_statements(self) -> boolean:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Remove console.error and console.warn statements"""


        try:


            with open(self.dashboard_path, 'r', encoding='utf-8') as f:


                content = f.read()


            original_content = content


            # Remove console.error statements (keep important ones)


            content = re.sub(r'console\.error\([^)]*\);?\s*\n', '', content)


            # Remove console.warn statements


            content = re.sub(r'console\.warn\([^)]*\);?\s*\n', '', content)


            # Remove console.log statements


            content = re.sub(r'console\.log\([^)]*\);?\s*\n', '', content)


            if content != original_content:


                with open(self.dashboard_path, 'w', encoding='utf-8') as f:


                    f.write(content)


                self.fixes_applied.append("Removed console statements")


                return True


            else:


                self.fixes_applied.append("No console statements to remove")


                return True


        except Exception as e:


            print(f"Error removing console statements: {e}")


            return False


    def fix_chart_null_issues(self) -> boolean:


// NOTE: Consider extracting this 46-line function into smaller methods


        """Fix Chart.js null canvas element issues"""


        try:


            with open(self.dashboard_path, 'r', encoding='utf-8') as f:


                content = f.read()


            original_content = content


            # Add better null checks for chart operations


            chart_patterns = [


                (r'if\s*\(([^)]+)\.update\(\)\s*\)', r'if (\1 && \1.canvas && \1.canvas.ownerDocument) { \1.update(); }'),


                (r'if\s*\(([^)]+)\)\s*\{\s*([^)]+)\.update\(\)\s*\}', r'if (\1 && \1.canvas && \1.canvas.ownerDocument) { \2.update(); }'),


            ]


            for pattern, replacement in chart_patterns:


                content = re.sub(pattern, replacement, content)


            # Add null check before chart creation


            content = re.sub(


                r'(const|let|var)\s+(\w+)Canvas\s*=\s*document\.getElementById\([\'"]([^\'"]+)[\'"]\);',


                r'\1 \2Canvas = document.getElementById("\3"); if (!\2Canvas || !\2Canvas.ownerDocument) { console.warn("Canvas \3 not found or invalid"); } else {',


                content


            )


            if content != original_content:


                with open(self.dashboard_path, 'w', encoding='utf-8') as f:


                    f.write(content)


                self.fixes_applied.append("Fixed Chart.js null canvas issues")


                return True


            else:


                self.fixes_applied.append("No Chart.js issues to fix")


                return True


        except Exception as e:


            print(f"Error fixing Chart.js issues: {e}")


            return False


    def add_error_handling(self) -> boolean:


        """Add better error handling to dashboard"""


        try:


            with open(self.dashboard_path, 'r', encoding='utf-8') as f:


                content = f.read()


            # Add global error handler if not present


            if 'window.addEventListener(\'error\'' not in content:


                error_handler = '''


// Global error handler


window.addEventListener('error', function(event) {


    console.error('Global error caught:', {


        message: event.message,


        filename: event.filename,


        lineno: event.lineno,


        colno: event.colno,


        error: event.error


    });


});


// Global unhandled promise rejection handler


window.addEventListener('unhandledrejection', function(event) {


    console.error('Unhandled promise rejection:', {


        reason: event.reason,


        promise: event.promise


    });


    event.preventDefault();


});


'''


                # Insert after the first script tag


                first_script_pos = content.find('<script')


                if first_script_pos != -1:


                    insert_pos = content.find('>', first_script_pos) + 1


                    content = content[:insert_pos] + error_handler + content[insert_pos:]


                    with open(self.dashboard_path, 'w', encoding='utf-8') as f:


                        f.write(content)


                    self.fixes_applied.append("Added global error handlers")


                    return True


            self.fixes_applied.append("Global error handlers already present")


            return True


        except Exception as e:


            print(f"Error adding error handling: {e}")


            return False


    def optimize_dashboard_size(self) -> boolean:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Optimize dashboard by removing unnecessary whitespace and comments"""


        try:


            with open(self.dashboard_path, 'r', encoding='utf-8') as f:


                content = f.read()


            original_content = content


            # Remove HTML comments (but keep important ones)


            content = re.sub(r'<!--(?![\s]*IMPORTANT)[\s\S]*?-->', '', content)


            # Remove excessive whitespace


            content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)


            content = re.sub(r' +', ' ', content)


            # Remove JavaScript comments (keep important ones)


// NOTE: |FIXME|IMPORTANT|NOTE)[^\n]*\n', '\n', content)


// NOTE: |FIXME|IMPORTANT|NOTE)[\s\S]*?\*/', '', content)


            size_before = len(original_content)


            size_after = len(content)


            size_reduction = size_before - size_after


            if size_reduction > 0:


                with open(self.dashboard_path, 'w', encoding='utf-8') as f:


                    f.write(content)


                reduction_kb = size_reduction / 1024


                self.fixes_applied.append(f"Optimized size: reduced by {reduction_kb:.1f}KB")


                return True


            else:


                self.fixes_applied.append("No optimization possible")


                return True


        except Exception as e:


            print(f"Error optimizing size: {e}")


            return False


    def apply_all_fixes(self) -> boolean:


// NOTE: Consider extracting this 31-line function into smaller methods


        """Apply all quick fixes"""


        print("Starting dashboard quick fixes...")


        # Create backup first


        if not self.backup_dashboard():


            print("Failed to create backup, aborting fixes")


            return False


        # Apply fixes


        fixes = [


            ("Removing console statements", self.remove_console_statements),


            ("Fixing Chart.js issues", self.fix_chart_null_issues),


            ("Adding error handling", self.add_error_handling),


            ("Optimizing size", self.optimize_dashboard_size),


        ]


        success = True


        for fix_name, fix_func in fixes:


            print(f"Applying fix: {fix_name}")


            if not fix_func():


                success = False


                print(f"Failed to apply: {fix_name}")


            else:


                print(f"Applied: {fix_name}")


        print("\nFixes Applied:")


        for fix in self.fixes_applied:


            print(f"  ✓ {fix}")


        return success


def main():


    """


// NOTE: Add function documentation.


    """


    import argparse


// NOTE: Consider using dependency injection for this import


    parser = argparse.ArgumentParser(description="Dashboard Quick Fix Utility")


    parser.add_argument("dashboard", help="Path to dashboard HTML file")


    args = parser.parse_args()


    fixer = DashboardQuickFix(args.dashboard)


    success = fixer.apply_all_fixes()


    if success:


        print("\n✅ Dashboard quick fixes completed successfully!")


        print("Please refresh your browser to see the changes.")


    else:


        print("\n❌ Some fixes failed. Check the logs above.")


    return 0 if success else 1


if __name__ == "__main__":


    exit(main())


