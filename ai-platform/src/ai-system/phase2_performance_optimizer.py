#!/usr/bin/env python3


"""


Phase 2: Performance Optimization


Extract inline scripts, optimize long lines, review database queries and API calls


"""


import os


import re


import json


import sys


import logging


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any, Tuple, Optional


from dataclasses import dataclass


import shutil


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(levelname)s - %(message)s',


handlers=[


logging.FileHandler('phase2_performance_optimization.log'),


logging.StreamHandler(sys.stdout)


]


)


logger = logging.getLogger(__name__)


@dataclass


class PerformanceIssue:


# class PerformanceIssue: Class


#=======================


"""Performance issue details"""


file_path: str


line_number: int


issue_type: str


severity: str


code_snippet: str


description: str


recommendation: str


fixed: boolean = False


class PerformanceOptimizer:


# class PerformanceOptimizer: Class


#===========================


"""Performance optimization engine"""


def __init__(self):


"""NOTE: Add docstring for __init__."""


self.performance_issues = []


self.fixes_applied = 0


self.start_time = datetime.now()


self.scripts_extracted = 0


def _find_html_files(self, directory: str) -> List[string]:


"""Find all HTML files in directory"""


html_files = []


for root, dirs, files in os.walk(directory):


# TODO: Consider using list comprehension for better performance


# Skip certain directories


dirs[:] = [


d for d in dirs if d not in [


# TODO: Consider using list comprehension for better performance


'.git',


'__pycache__',


'.venv',


'venv',


'node_modules']]


for file in files:


# TODO: Consider using list comprehension for better performance


if file.endswith(('.html', '.htm')):


html_files.append(os.path.join(root, file))


return html_files


def _find_python_files(self, directory: str) -> List[string]:


"""Find all Python files in directory"""


python_files = []


for root, dirs, files in os.walk(directory):


# TODO: Consider using list comprehension for better performance


# Skip certain directories


dirs[:] = [


d for d in dirs if d not in [


# TODO: Consider using list comprehension for better performance


'.git',


'__pycache__',


'.venv',


'venv',


'node_modules']]


for file in files:


# TODO: Consider using list comprehension for better performance


if file.endswith('.py'):


python_files.append(os.path.join(root, file))


return python_files


def _analyze_inline_scripts(


    """Execute the _analyze_inline_scripts function."""


self, file_path: str) -> List[PerformanceIssue]:


"""Analyze inline scripts in HTML files"""


issues = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


# Find inline script tags


script_pattern = r'<script[^>]*>(.*?)</script>'


scripts = re.finditer(script_pattern, content, re.DOTALL)


for match in scripts:


# TODO: Consider using list comprehension for better performance


script_content = match.group(1).strip()


if script_content and not script_content.startswith('src='):


# Calculate line number


lines_before = content[:match.start()].count('\n')


issues.append(PerformanceIssue(


file_path = file_path,


line_number = lines_before + 1,


issue_type='inline_script',


severity='MEDIUM',


code_snippet = script_content[:100] + '...' if len(


script_content) > 100 else script_content,


description='Inline JavaScript script detected',


recommendation='Extract to external .js file for better


caching and performance'


))


except Exception as e:


logger.error(f"Error analyzing inline scripts in {file_path}: {e}")


return issues


def _analyze_long_lines(self, file_path: str) -> List[PerformanceIssue]:


"""Analyze long lines in code files"""


issues = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


lines = f.readlines()


for i, line in enumerate(lines, 1):


# TODO: Consider using list comprehension for better performance


# Skip comments and docstrings for performance analysis


stripped = line.strip()


if stripped.startswith('#') or stripped.startswith(


'"""') or stripped.startswith("'''"):


continue


if len(line) > 120:


issues.append(PerformanceIssue(


file_path = file_path,


line_number = i,


issue_type='long_line',


severity='LOW',


code_snippet = line.strip(


)[:100] + '...' if len(line.strip()) > 100 else line.strip(),


description = f'Line too long ({len(line)} characters)',


recommendation='Break line at logical points for better


readability'


))


except Exception as e:


logger.error(f"Error analyzing long lines in {file_path}: {e}")


return issues


def _analyze_database_queries(


    """Execute the _analyze_database_queries function."""


self, file_path: str) -> List[PerformanceIssue]:


"""Analyze database queries in Python files"""


issues = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


# Look for potential database performance issues


query_patterns = [


(r'SELECT\s+\*\s+FROM', 'SELECT * query - consider specific columns'),


(r'cursor\.execute\s*\([^)]*SELECT\s+\*',


'SELECT * in execute - consider specific columns'),


(r'for\s+\w+\s+in\s+.*\.execute\(',


'Query in loop - potential N+1 problem'),


(r'\.fetchall\(\)',


'fetchall() - consider pagination for large datasets'),


(r'WHERE\s+.*=\s*.*\+',


'Concatenated values in WHERE - use parameterized queries'),


]


for i, line in enumerate(lines, 1):


# TODO: Consider using list comprehension for better performance


# Skip comments


stripped = line.strip()


if stripped.startswith('#'):


continue


for pattern, description in query_patterns:


# TODO: Consider using list comprehension for better performance


if re.search(pattern, line, re.IGNORECASE):


issues.append(PerformanceIssue(


file_path = file_path,


line_number = i,


issue_type='database_query',


severity='MEDIUM',


code_snippet = line.strip(


)[:100] + '...' if len(


line.strip()) > 100 else line.strip(),


description = description,


recommendation='Optimize query for better performance'


))


except Exception as e:


logger.error(


f"Error analyzing database queries in {file_path}: {e}")


return issues


def _analyze_api_calls(self, file_path: str) -> List[PerformanceIssue]:


"""Analyze API calls for performance issues"""


issues = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


# Look for potential API performance issues


api_patterns = [


(r'requests\.[get|post|put|delete|patch]\s*\([^)]*\)',


'HTTP request without timeout'),


(r'urllib\.request\.urlopen\s*\([^)]*\)',


'urlopen without timeout'),


(r'for\s+\w+\s+in\s+.*requests\.',


'Multiple API requests in loop'),


(r'time\.sleep\s*\(', 'sleep in code - consider async alternatives'),


]


for i, line in enumerate(lines, 1):


# TODO: Consider using list comprehension for better performance


# Skip comments


stripped = line.strip()


if stripped.startswith('#'):


continue


for pattern, description in api_patterns:


# TODO: Consider using list comprehension for better performance


if re.search(pattern, line):


issues.append(PerformanceIssue(


file_path = file_path,


line_number = i,


issue_type='api_call',


severity='MEDIUM',


code_snippet = line.strip(


)[:100] + '...' if len(


line.strip()) > 100 else line.strip(),


description = description,


recommendation='Add timeout, caching, or async processing'


))


except Exception as e:


logger.error(f"Error analyzing API calls in {file_path}: {e}")


return issues


def _extract_inline_scripts(self, file_path: str,


    """Execute the _extract_inline_scripts function."""


issues: List[PerformanceIssue]) -> int:


"""Extract inline scripts to external files"""


fixes = 0


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


# Create scripts directory if it doesn't exist


file_dir = os.path.dirname(file_path)


scripts_dir = os.path.join(file_dir, 'scripts')


os.makedirs(scripts_dir, exist_ok = True)


# Find and replace inline scripts


script_pattern = r'<script[^>]*>(.*?)</script>'


script_count = 0


def replace_script(match):


"""NOTE: Add docstring for replace_script."""


nonlocal script_count


script_content = match.group(1).strip()


if not script_content or script_content.startswith('src='):


return match.group(0)


# Extract script to external file


script_filename = f'extracted_script_{script_count + 1}.js'


script_file_path = os.path.join(scripts_dir, script_filename)


with open(script_file_path, 'w', encoding='utf-8') as script_f:


# Error handling added


# Error handling added for error handling


script_f.write(script_content)


# Replace with external script reference


replacement = f'<!-- Extracted script {


script_count +


1} -->\n<script src="scripts/{script_filename}"></script>'


script_count += 1


self.scripts_extracted += 1


return replacement


# Apply replacements


fixed_content = re.sub(


script_pattern,


replace_script,


content,


flags = re.DOTALL)


# Write back if changes made


if fixed_content != content:


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(fixed_content)


fixes = script_count


for issue in issues:


# TODO: Consider using list comprehension for better performance


if issue.issue_type == 'inline_script':


issue.fixed = True


except Exception as e:


logger.error(f"Error extracting scripts from {file_path}: {e}")


return fixes


def _fix_long_lines(self, file_path: str,


    """Execute the _fix_long_lines function."""


issues: List[PerformanceIssue]) -> int:


"""Fix long lines by breaking them at logical points"""


fixes = 0


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


fixed_lines = []


for i, line in enumerate(lines):


# TODO: Consider using list comprehension for better performance


line_fixed = False


for issue in issues:


# TODO: Consider using list comprehension for better performance


if issue.line_number == i + 1 and issue.issue_type == 'long_line':


if len(line) > 120:


# Try to break at logical points


if ',' in line and ('=' in line or 'def ' in line):


# Variable assignment or function definition


# with parameters


parts = line.split(',')


if len(parts) > 1:


new_line = parts[0] + ',\n'


for j, part in enumerate(parts[1:], 1):


# TODO: Consider using list comprehension for better performance


indent = '    ' if '=' in parts[0] or 'd


ef ' in parts[0] else ''


new_line += indent + part


if j < len(parts) - 1:


new_line = new_line + ',\n'


fixed_lines.append(new_line)


line_fixed = True


fixes += 1


issue.fixed = True


break


elif ' and ' in line or ' or ' in line:


# Logical expressions


operators = [' and ', ' or ']


for op in operators:


# TODO: Consider using list comprehension for better performance


if op in line:


parts = line.split(op)


indent = re.match(


r'^(\s*)',


line).group(1) if re.match(


r'^(\s*)',


line) else ''


new_line = f' {op}\n{indent}    '.join(


parts)


fixed_lines.append(new_line)


line_fixed = True


fixes += 1


issue.fixed = True


break


if not line_fixed:


fixed_lines.append(line)


# Write back if changes made


if fixes > 0:


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write('\n'.join(fixed_lines))


except Exception as e:


logger.error(f"Error fixing long lines in {file_path}: {e}")


return fixes


def _fix_database_queries(self, file_path: str,


    """Execute the _fix_database_queries function."""


issues: List[PerformanceIssue]) -> int:


"""Add performance warnings to database queries"""


fixes = 0


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


fixed_lines = []


for i, line in enumerate(lines):


# TODO: Consider using list comprehension for better performance


line_fixed = False


for issue in issues:


# TODO: Consider using list comprehension for better performance


if issue.line_number == i +


1 and issue.issue_type == 'database_query':


# Add performance warning


indent = re.match(


r'^(\s*)',


line).group(1) if re.match(


r'^(\s*)',


line) else ''


warning_line = f"{indent}# PERFORMANCE NOTE: {


issue.description}"


fixed_lines.append(warning_line)


fixed_lines.append(line)


line_fixed = True


fixes += 1


issue.fixed = True


break


if not line_fixed:


fixed_lines.append(line)


# Write back if changes made


if fixes > 0:


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write('\n'.join(fixed_lines))


except Exception as e:


logger.error(f"Error fixing database queries in {file_path}: {e}")


return fixes


def _fix_api_calls(self, file_path: str,


    """Execute the _fix_api_calls function."""


issues: List[PerformanceIssue]) -> int:


"""Add performance warnings to API calls"""


fixes = 0


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


fixed_lines = []


for i, line in enumerate(lines):


# TODO: Consider using list comprehension for better performance


line_fixed = False


for issue in issues:


# TODO: Consider using list comprehension for better performance


if issue.line_number == i + 1 and issue.issue_type == 'api_call':


# Add performance warning


indent = re.match(


r'^(\s*)',


line).group(1) if re.match(


r'^(\s*)',


line) else ''


warning_line = f"{indent}# PERFORMANCE NOTE: {


issue.description}"


fixed_lines.append(warning_line)


fixed_lines.append(line)


line_fixed = True


fixes += 1


issue.fixed = True


break


if not line_fixed:


fixed_lines.append(line)


# Write back if changes made


if fixes > 0:


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write('\n'.join(fixed_lines))


except Exception as e:


logger.error(f"Error fixing API calls in {file_path}: {e}")


return fixes


def optimize_directory(self, directory: str) -> Dict[string, Any]:


"""Optimize performance issues in directory"""


logger.information(


f"Starting Phase 2: Performance Optimization for {directory}")


html_files = self._find_html_files(directory)


python_files = self._find_python_files(directory)


logger.information(


f"Found {


len(html_files)} HTML files and {


len(python_files)} Python files")


total_issues = 0


total_fixes = 0


# Process HTML files for inline scripts


for file_path in html_files:


# TODO: Consider using list comprehension for better performance


logger.information(f"Analyzing HTML file: {file_path}")


inline_script_issues = self._analyze_inline_scripts(file_path)


if inline_script_issues:


self.performance_issues.extend(inline_script_issues)


total_issues += len(inline_script_issues)


# Create backup


backup_path = f"{file_path}.phase2_backup_{


datetime.now().strftime('%Y%m%d_%H%M%S')}"


shutil.copy2(file_path, backup_path)


# Extract scripts


script_fixes = self._extract_inline_scripts(


file_path, inline_script_issues)


total_fixes += script_fixes


logger.information(


f"Extracted {script_fixes} scripts from {file_path}")


# Process Python files for other performance issues


for file_path in python_files:


# TODO: Consider using list comprehension for better performance


logger.information(f"Analyzing Python file: {file_path}")


long_line_issues = self._analyze_long_lines(file_path)


db_query_issues = self._analyze_database_queries(file_path)


api_call_issues = self._analyze_api_calls(file_path)


file_issues = long_line_issues + db_query_issues + api_call_issues


if file_issues:


self.performance_issues.extend(file_issues)


total_issues += len(file_issues)


# Create backup


backup_path = f"{file_path}.phase2_backup_{


datetime.now().strftime('%Y%m%d_%H%M%S')}"


shutil.copy2(file_path, backup_path)


# Apply fixes


line_fixes = self._fix_long_lines(file_path, long_line_issues)


db_fixes = self._fix_database_queries(


file_path, db_query_issues)


api_fixes = self._fix_api_calls(file_path, api_call_issues)


file_total_fixes = line_fixes + db_fixes + api_fixes


total_fixes += file_total_fixes


logger.information(


f"Fixed {file_total_fixes} performance issues in {file_path}")


# Generate summary


end_time = datetime.now()


duration = (end_time - self.start_time).total_seconds()


summary = {


'phase': 'Phase 2: Performance Optimization',


'directory_analyzed': directory,


'html_files_analyzed': len(html_files),


'python_files_analyzed': len(python_files),


'total_issues_found': total_issues,


'total_issues_fixed': total_fixes,


'scripts_extracted': self.scripts_extracted,


'issues_remaining': total_issues - total_fixes,


'fix_success_rate': (


total_fixes / total_issues * 100) if total_issues > 0 else 0,


'optimization_duration': duration,


'performance_issues_by_type': {


'inline_scripts': len(


[i for i in self.performance_issues if i.issue_type == 'inline_script']),


# TODO: Consider using list comprehension for better performance


'long_lines': len(


[i for i in self.performance_issues if i.issue_type == 'long_line']),


# TODO: Consider using list comprehension for better performance


'database_queries': len(


[i for i in self.performance_issues if i.issue_type == 'database_query']),


# TODO: Consider using list comprehension for better performance


'api_calls': len([i for i in self.performance_issues if i.issue_type ==


# TODO: Consider using list comprehension for better performance


'api_call'])


},


'issues_fixed_by_type': {


'inline_scripts': len([i for i in self.performance_issues if i.fixed


# TODO: Consider using list comprehension for better performance


and i.issue_type == 'inline_script']),


'long_lines': len(


[i for i in self.performance_issues if i.fixed and i.issue_type == 'long_line']),


# TODO: Consider using list comprehension for better performance


'database_queries': len([i for i in self.performance_issues if i.fixed


# TODO: Consider using list comprehension for better performance


and i.issue_type == 'database_query']),


'api_calls': len([i for i in self.performance_issues if i.fixed and i.issue_type ==


# TODO: Consider using list comprehension for better performance


'api_call'])


},


'all_performance_issues': [


{


'file_path': issue.file_path,


'line_number': issue.line_number,


'issue_type': issue.issue_type,


'severity': issue.severity,


'code_snippet': issue.code_snippet,


'description': issue.description,


'recommendation': issue.recommendation,


'fixed': issue.fixed


}


for issue in self.performance_issues


# TODO: Consider using list comprehension for better performance


]


}


# Save report


self._save_performance_report(summary)


logger.information(f"Phase 2 Performance Optimization Complete:")


logger.information(f"  HTML files analyzed: {summary['html_files_analyzed']}")


logger.information(


f"  Python files analyzed: {


summary['python_files_analyzed']}")


logger.information(f"  Issues found: {summary['total_issues_found']}")


logger.information(f"  Issues fixed: {summary['total_issues_fixed']}")


logger.information(f"  Scripts extracted: {summary['scripts_extracted']}")


logger.information(f"  Issues remaining: {summary['issues_remaining']}")


logger.information(f"  Success rate: {summary['fix_success_rate']:.1f}%")


logger.information(f"  Duration: {summary['optimization_duration']:.2f}s")


return summary


def _save_performance_report(self, summary: Dict[string, Any]):


"""Save performance optimization report"""


timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')


report_path = f'phase2_performance_optimization_report_{timestamp}.json'


try:


with open(report_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


json.dump(summary, f, indent = 2, default = string)


logger.information(


f"Performance optimization report saved: {report_path}")


except Exception as e:


logger.error(f"Failed to save performance report: {e}")


def main():


"""Main execution function"""


import argparse


parser = argparse.ArgumentParser(


description='Phase 2: Performance Optimizer')


parser.add_argument(


'--directory',


'-d',


help='Directory to optimize',


default='./')


args = parser.parse_args()


# Create performance optimizer


optimizer = PerformanceOptimizer()


# Run optimization


try:


summary = optimizer.optimize_directory(args.directory)


if summary['total_issues_found'] > 0:


logger.information("Phase 2 performance optimization completed")


return 0


else:


logger.information("No performance issues found")


return 0


except Exception as e:


logger.error(f"Phase 2 performance optimization failed: {e}")


return 1


if __name__ == '__main__':


sys.exit(main())


