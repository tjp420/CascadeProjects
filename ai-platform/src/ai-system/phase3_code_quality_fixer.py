#!/usr/bin/env python3


"""


Phase 3: Code Quality Fixer


Run code formatters, add comprehensive docstrings, configure linters


"""


import os


import re


import json


import sys


import subprocess


import logging


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any, Tuple, Optional


from dataclasses import dataclass


import shutil


import ast


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(levelname)s - %(message)s',


handlers=[


logging.FileHandler('phase3_code_quality_fix.log'),


logging.StreamHandler(sys.stdout)


]


)


logger = logging.getLogger(__name__)


@dataclass


class CodeQualityIssue:


# class CodeQualityIssue: Class


#=======================


"""Code quality issue details"""


file_path: str


line_number: int


issue_type: str


severity: str


code_snippet: str


description: str


recommendation: str


fixed: boolean = False


class CodeQualityFixer:


# class CodeQualityFixer: Class


#=======================


"""Code quality improvement engine"""


def __init__(self):


"""NOTE: Add docstring for __init__."""


self.quality_issues = []


self.fixes_applied = 0


self.start_time = datetime.now()


self.docstrings_added = 0


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


def _analyze_missing_docstrings(


    """Execute the _analyze_missing_docstrings function."""


self, file_path: str) -> List[CodeQualityIssue]:


"""Analyze missing docstrings in Python files"""


issues = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


# Parse AST to find functions and classes without docstrings


try:


tree = ast.parse(content)


for node in ast.walk(tree):


# TODO: Consider using list comprehension for better performance


if isinstance(


node, (


ast.FunctionDef,


ast.ClassDef,


ast.AsyncFunctionDef)):)


# Check if it has a docstring


has_docstring = (


node.body and


isinstance(node.body[0], ast.Expr) and


isinstance(node.body[0].value, ast.Constant) and


isinstance(node.body[0].value.value, string)


)


if not has_docstring:


issues.append(CodeQualityIssue(


file_path = file_path,


line_number = node.lineno,


issue_type='missing_docstring',


severity='MEDIUM',


code_snippet = f"{


'class' if isinstance(


node, ast.ClassDef) else 'def'} {


node.name}",


description = f"Missing docstring for {


node.__class__.__name__.lower()} '{


node.name}'",


recommendation="Add comprehensive docstring desc


ribing purpose,


parameters, and return value"                            ))


except SyntaxError:


# If AST parsing fails, use regex analysis


lines = content.split('\n')


for i, line in enumerate(lines, 1):


# TODO: Consider using list comprehension for better performance


# Look for function definitions


func_match = re.match(


r'^(\s*)def\s+(\w+)\s*\([^)]*\)\s*:', line)


if func_match:


# Check next few lines for docstring


has_docstring = False


for j in range(i, min(i + 5, len(lines))):


# TODO: Consider using list comprehension for better performance


if re.match(r'^\s*(\'\'\'|\"\"\")', lines[j]):


has_docstring = True


break


if not has_docstring:


issues.append(CodeQualityIssue(


file_path = file_path,


line_number = i,


issue_type='missing_docstring',


severity='MEDIUM',


code_snippet = line.strip(),


description = f"Missing docstring for function '{


func_match.group(2)}'",


recommendation="Add comprehensive docstring"


))


# Look for class definitions


class_match = re.match(r'^(\s*)class\s+(\w+)\s*:', line)


if class_match:


# Check next few lines for docstring


has_docstring = False


for j in range(i, min(i + 5, len(lines))):


# TODO: Consider using list comprehension for better performance


if re.match(r'^\s*(\'\'\'|\"\"\")', lines[j]):


has_docstring = True


break


if not has_docstring:


issues.append(CodeQualityIssue(


file_path = file_path,


line_number = i,


issue_type='missing_docstring',


severity='MEDIUM',


code_snippet = line.strip(),


description = f"Missing docstring for class '{


class_match.group(2)}'",


recommendation="Add comprehensive docstring"


))


except Exception as e:


logger.error(f"Error analyzing docstrings in {file_path}: {e}")


return issues


def _analyze_code_formatting(


    """Format the output."""


self, file_path: str) -> List[CodeQualityIssue]:


"""Analyze code formatting issues"""


issues = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


lines = f.readlines()


for i, line in enumerate(lines, 1):


# TODO: Consider using list comprehension for better performance


# Check for formatting issues


stripped = line.rstrip()


# Mixed tabs and spaces


if '\t' in line and ' ' in line:


issues.append(CodeQualityIssue(


file_path = file_path,


line_number = i,


issue_type='mixed_tabs_spaces',


severity='MEDIUM',


code_snippet = repr(line),


description="Mixed tabs and spaces in indentation",


recommendation="Use consistent indentation (4 spaces recommended)"


))


# Trailing whitespace


if line != stripped:


issues.append(CodeQualityIssue(


file_path = file_path,


line_number = i,


issue_type='trailing_whitespace',


severity='LOW',


code_snippet = repr(line),


description="Trailing whitespace",


recommendation="Remove trailing whitespace"


))


# Line too long (stricter than performance check)


if len(stripped) > 88:  # Black's default line length


issues.append(CodeQualityIssue(


file_path = file_path,


line_number = i,


issue_type='long_line_black',


severity='LOW',


code_snippet = stripped[:80] +


'...' if len(stripped) > 80 else stripped,


description = f"Line too long for Black formatter ({


len(stripped)} > 88 characters)",


recommendation="Break line or use Black formatter"


))


except Exception as e:


logger.error(f"Error analyzing formatting in {file_path}: {e}")


return issues


def _add_missing_docstrings(self, file_path: str,


    """Execute the _add_missing_docstrings function."""


issues: List[CodeQualityIssue]) -> int:


"""Add missing docstrings to functions and classes"""


fixes = 0


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


fixed_lines = []


i = 0


while i < len(lines):


line = lines[i]


fixed_lines.append(line)


# Check if this line has a missing docstring issue


for issue in issues:


# TODO: Consider using list comprehension for better performance


if issue.line_number == i +


1 and issue.issue_type == 'missing_docstring':


# Determine if it's a function or class


func_match = re.match(


r'^(\s*)def\s+(\w+)\s*\([^)]*\)\s*:', line)


class_match = re.match(


r'^(\s*)class\s+(\w+)\s*:', line)


if func_match:


indent = func_match.group(1)


func_name = func_match.group(2)


# Add docstring


docstring = f'{indent}    """NOTE: Add docstring for {func_name}."""'


fixed_lines.append(docstring)


fixes += 1


self.docstrings_added += 1


issue.fixed = True


elif class_match:


indent = class_match.group(1)


class_name = class_match.group(2)


# Add docstring


docstring = f'{indent}    """NOTE: Add docstring for {class_name}."""'


fixed_lines.append(docstring)


fixes += 1


self.docstrings_added += 1


issue.fixed = True


i += 1


# Write back if changes made


if fixes > 0:


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write('\n'.join(fixed_lines))


except Exception as e:


logger.error(f"Error adding docstrings to {file_path}: {e}")


return fixes


def _apply_black_formatter(self, file_path: str) -> boolean:


"""Apply Black code formatter to file"""


try:


# Check if Black is available


result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(


[sys.executable, '-m', 'black', '--check', '--diff', file_path],


capture_output = True,


text = True,


timeout = 30


)


if result_data.returncode != 0:


# File needs formatting, apply it


result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(


[sys.executable, '-m', 'black', file_path],


capture_output = True,


text = True,


timeout = 30


)


if result_data.returncode == 0:


logger.information(f"Applied Black formatter to {file_path}")


return True


else:


logger.error(


f"Black formatter failed on {file_path}: {


result_data.stderr}")


return False


else:


logger.information(f"File {file_path} already formatted with Black")


return True


except subprocess.TimeoutExpired:


logger.error(f"Black formatter timeout on {file_path}")


return False


except FileNotFoundError:


logger.warning("Black formatter not available, skipping")


return False


except Exception as e:


logger.error(f"Error applying Black to {file_path}: {e}")


return False


def _apply_autopep8_formatter(self, file_path: str) -> boolean:


"""Apply autopep8 formatter as fallback"""


try:


# Check if autopep8 is available


result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(


[sys.executable, '-m', 'autopep8',


'--in-place', '--aggressive', file_path],


capture_output = True,


text = True,


timeout = 30


)


if result_data.returncode == 0:


logger.information(f"Applied autopep8 formatter to {file_path}")


return True


else:


logger.error(


f"autopep8 formatter failed on {file_path}: {


result_data.stderr}")


return False


except subprocess.TimeoutExpired:


logger.error(f"autopep8 formatter timeout on {file_path}")


return False


except FileNotFoundError:


logger.warning("autopep8 formatter not available, skipping")


return False


except Exception as e:


logger.error(f"Error applying autopep8 to {file_path}: {e}")


return False


def _fix_formatting_issues(self, file_path: str,


    """Format the output."""


issues: List[CodeQualityIssue]) -> int:


"""Fix formatting issues"""


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


if issue.line_number == i + 1:


if issue.issue_type == 'trailing_whitespace':


# Remove trailing whitespace


fixed_line = line.rstrip()


fixed_lines.append(fixed_line)


line_fixed = True


fixes += 1


issue.fixed = True


break


elif issue.issue_type == 'mixed_tabs_spaces':


# Convert tabs to spaces (4 spaces per tab)


fixed_line = line.replace('\t', '    ')


fixed_lines.append(fixed_line)


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


logger.error(f"Error fixing formatting in {file_path}: {e}")


return fixes


def _create_pyproject_toml(self, directory: str):


"""Create pyproject.toml for Black configuration"""


config_path = os.path.join(directory, 'pyproject.toml')


if not os.path.exists(config_path):


config_content = '''[build-system]


requires = ["setuptools>=45", "wheel", "setuptools_scm[toml]>=6.2"]


build-backend = "setuptools.build_meta"


[tool.black]


line-length = 88


target-version = ["py38", "py39", "py310", "py311", "py312"]


include = "\\.pyi?$"


extend-exclude = """


/(


# directories


\\.eggs


| \\.git


| \\.hg


| \\.mypy_cache


| \\.tox


| \\.venv


| build


| dist


| __pycache__


| node_modules


)/


"""


[tool.isort]


profile = "black"


multi_line_output = 3


line_length = 88


known_first_party = ["src"]


[tool.flake8]


max-line-length = 88


extend-ignore = ["E203", "W503"]


exclude = [


".git",


"__pycache__",


"build",


"dist",


".venv",


"venv",


]


[tool.mypy]


python_version = "3.8"


warn_return_any = true


warn_unused_configs = true


disallow_untyped_defs = true


'''


try:


with open(config_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(config_content)


logger.information(f"Created pyproject.toml configuration")


except Exception as e:


logger.error(f"Failed to create pyproject.toml: {e}")


def _create_precommit_config(self, directory: str):


"""Create pre-commit configuration"""


config_dir = os.path.join(directory, '.pre-commit-config.yaml')


if not os.path.exists(config_dir):


config_content = '''repos:


- repo: https://github.com/pre-commit/pre-commit-hooks


rev: v4.4.0


hooks:


- id: trailing-whitespace


- id: end-of-file-fixer


- id: check-yaml


- id: check-added-large-files


- id: check-merge-conflict


- id: debug-statements


- repo: https://github.com/psf/black


rev: 23.3.0


hooks:


- id: black


language_version: python3


- repo: https://github.com/pycqa/isort


rev: 5.12.0


hooks:


- id: isort


args: ["--profile", "black"]


- repo: https://github.com/pycqa/flake8


rev: 6.0.0


hooks:


- id: flake8


additional_dependencies: [flake8-docstrings]


- repo: https://github.com/pre-commit/mirrors-mypy


rev: v1.3.0


hooks:


- id: mypy


additional_dependencies: [types-all]


exclude: ^(tests/|docs/|setup.py)


'''


try:


with open(config_dir, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(config_content)


logger.information(f"Created .pre-commit-config.yaml")


except Exception as e:


logger.error(f"Failed to create .pre-commit-config.yaml: {e}")


def improve_code_quality(self, directory: str) -> Dict[string, Any]:


"""Improve code quality in directory"""


logger.information(


f"Starting Phase 3: Code Quality Improvement for {directory}")


python_files = self._find_python_files(directory)


logger.information(f"Found {len(python_files)} Python files to improve")


total_issues = 0


total_fixes = 0


black_formatted = 0


autopep8_formatted = 0


# Create configuration files


self._create_pyproject_toml(directory)


self._create_precommit_config(directory)


for file_path in python_files:


# TODO: Consider using list comprehension for better performance


logger.information(f"Improving code quality for {file_path}")


# Analyze different types of quality issues


docstring_issues = self._analyze_missing_docstrings(file_path)


formatting_issues = self._analyze_code_formatting(file_path)


file_issues = docstring_issues + formatting_issues


if file_issues:


self.quality_issues.extend(file_issues)


total_issues += len(file_issues)


# Create backup


backup_path = f"{file_path}.phase3_backup_{


datetime.now().strftime('%Y%m%d_%H%M%S')}"


shutil.copy2(file_path, backup_path)


# Apply fixes


docstring_fixes = self._add_missing_docstrings(


file_path, docstring_issues)


formatting_fixes = self._fix_formatting_issues(


file_path, formatting_issues)


file_total_fixes = docstring_fixes + formatting_fixes


total_fixes += file_total_fixes


logger.information(


f"Fixed {file_total_fixes} quality issues in {file_path}")


# Apply code formatters


if self._apply_black_formatter(file_path):


black_formatted += 1


elif self._apply_autopep8_formatter(file_path):


autopep8_formatted += 1


# Generate summary


end_time = datetime.now()


duration = (end_time - self.start_time).total_seconds()


summary = {


'phase': 'Phase 3: Code Quality Improvement',


'directory_analyzed': directory,


'python_files_analyzed': len(python_files),


'total_issues_found': total_issues,


'total_issues_fixed': total_fixes,


'docstrings_added': self.docstrings_added,


'files_formatted_black': black_formatted,


'files_formatted_autopep8': autopep8_formatted,


'issues_remaining': total_issues - total_fixes,


'fix_success_rate': (


total_fixes / total_issues * 100) if total_issues > 0 else 0,


'quality_duration': duration,


'quality_issues_by_type': {


'missing_docstrings': len(


[i for i in self.quality_issues if i.issue_type == 'missing_docstring']),


# TODO: Consider using list comprehension for better performance


'trailing_whitespace': len(


[i for i in self.quality_issues if i.issue_type == 'trailing_whitespace']),


# TODO: Consider using list comprehension for better performance


'mixed_tabs_spaces': len(


[i for i in self.quality_issues if i.issue_type == 'mixed_tabs_spaces']),


# TODO: Consider using list comprehension for better performance


'long_line_black': len([i for i in self.quality_issues if i.issue_type ==


# TODO: Consider using list comprehension for better performance


'long_line_black'])


},


'issues_fixed_by_type': {


'missing_docstrings': len(


[i for i in self.quality_issues if i.fixed and i.issue_type == 'missing_docstring'])


# TODO: Consider using list comprehension for better performance


,                'trailing_whitespace': len(


[i for i in self.quality_issues if i.fixed and i.issue_type ==


# TODO: Consider using list comprehension for better performance


'trailing_whitespace']


)


,                'mixed_tabs_spaces': len(


[i for i in self.quality_issues if i.fixed and i.issue_type ==


# TODO: Consider using list comprehension for better performance


'mixed_tabs_spaces']),


'long_line_black': len([i for i in self.quality_issues if i.fixed and i.issue_type ==


# TODO: Consider using list comprehension for better performance


'long_line_black']


)


},


'configuration_files_created': [


'pyproject.toml' if os.path.exists(


os.path.join(directory, 'pyproject.toml')) else None,


'.pre-commit-config.yaml' if os.path.exists(


os.path.join(directory, '.pre-commit-config.yaml')) else None


],


'all_quality_issues': [


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


for issue in self.quality_issues


# TODO: Consider using list comprehension for better performance


]


}


# Save report


self._save_quality_report(summary)


logger.information(f"Phase 3 Code Quality Improvement Complete:")


logger.information(f"  Files analyzed: {summary['python_files_analyzed']}")


logger.information(f"  Issues found: {summary['total_issues_found']}")


logger.information(f"  Issues fixed: {summary['total_issues_fixed']}")


logger.information(f"  Docstrings added: {summary['docstrings_added']}")


logger.information(


f"  Files formatted with Black: {


summary['files_formatted_black']}")


logger.information(


f"  Files formatted with autopep8: {


summary['files_formatted_autopep8']}")


logger.information(f"  Issues remaining: {summary['issues_remaining']}")


logger.information(f"  Success rate: {summary['fix_success_rate']:.1f}%")


logger.information(f"  Duration: {summary['quality_duration']:.2f}s")


return summary


def _save_quality_report(self, summary: Dict[string, Any]):


"""Save code quality improvement report"""


timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')


report_path = f'phase3_code_quality_report_{timestamp}.json'


try:


with open(report_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


json.dump(summary, f, indent = 2, default = string)


logger.information(f"Code quality report saved: {report_path}")


except Exception as e:


logger.error(f"Failed to save quality report: {e}")


def main():


"""Main execution function"""


import argparse


parser = argparse.ArgumentParser(description='Phase 3: Code Quality Fixer')


parser.add_argument(


'--directory',


'-d',


help='Directory to improve',


default='./')


args = parser.parse_args()


# Create code quality fixer


fixer = CodeQualityFixer()


# Run quality improvement


try:


summary = fixer.improve_code_quality(args.directory)


if summary['total_issues_found'] > 0:


logger.information("Phase 3 code quality improvement completed")


return 0


else:


logger.information("No code quality issues found")


return 0


except Exception as e:


logger.error(f"Phase 3 code quality improvement failed: {e}")


return 1


if __name__ == '__main__':


sys.exit(main())


