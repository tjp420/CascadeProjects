#!/usr/bin/env python3


"""


Code Analyzer Backend


Provides comprehensive code analysis with static analysis, code review, and quality metrics


"""


import os


import json


import csv


import time


import ast


import re


import math


from pathlib import Path


from datetime import datetime


from typing import Dict, List, Tuple, Optional, Any


import logging


# Configure logging


logging.basicConfig(


    level = logging.INFO,


    format='%(asctime)s - %(levelname)s - %(message)s',


    handlers=[


        logging.FileHandler('code_analyzer.log'),


        logging.StreamHandler()


    ]


)


logger = logging.getLogger(__name__)


class CodeAnalyzerBackend:


    def __init__(self):


    """


// NOTE: Add function documentation.


    """


        self.analysis_data = {}


        self.start_time = None


        self.code_review_rules = self.initialize_code_review_rules()


    def initialize_code_review_rules(self):


        """Initialize comprehensive code review rules for different languages"""


        return {


            'python': {


                'patterns': [


                    {


                        'pattern': r'def\s+\w+\([^)]*\)\s*:',


                        'type': 'information',


                        'message': 'Function definition found',


                        'check': self._check_python_function


                    },


                    {


                        'pattern': r'class\s+\w+\s*\(',


                        'type': 'information',


                        'message': 'Class definition found',


                        'check': self._check_python_class


                    },


                    {


                        'pattern': r'import\s+\w+',


                        'type': 'information',


                        'message': 'Import statement found',


                        'check': self._check_python_import


                    },


                    {


                        'pattern': r'from\s+\w+\s+import',


                        'type': 'information',


                        'message': 'From import statement found',


                        'check': self._check_python_from_import


                    },


                    {


                        'pattern': r'print\s*\(',


                        'type': 'warning',


                        'message': 'Print statement found (consider using logging)',


                        'check': self._check_python_print


                    },


                    {


                        'pattern': r'except\s*:',


                        'type': 'information',


                        'message': 'Exception handling found',


                        'check': self._check_python_exception


                    },


                    {


                        'pattern': r'try\s*:',


                        'type': 'information',


                        'message': 'Try block found',


                        'check': self._check_python_try


                    },


                    {


                        'pattern': r'if\s+__name__\s*==\s*["\']__main__["\']',


                        'type': 'information',


                        'message': 'Main guard found',


                        'check': self._check_python_main_guard


                    },


                    {


// NOTE: |#\s*FIXME|#\s*XXX',


                        'type': 'warning',


// NOTE: comment found',


                        'check': self._check_todo_comment


                    },


                    {


                        'pattern': r'"""',


                        'type': 'information',


                        'message': 'Docstring found',


                        'check': self._check_python_docstring


                    }


                ]


            },


            'javascript': {


                'patterns': [


                    {


                        'pattern': r'function\s+\w+\s*\(',


                        'type': 'information',


                        'message': 'Function definition found',


                        'check': self._check_javascript_function


                    },


                    {


                        'pattern': r'const\s+\w+\s*=',


                        'type': 'information',


                        'message': 'Constant declaration found',


                        'check': self._check_javascript_const


                    },


                    {


                        'pattern': r'let\s+\w+\s*=',


                        'type': 'information',


                        'message': 'Variable declaration found',


                        'check': self._check_javascript_let


                    },


                    {


                        'pattern': r'var\s+\w+\s*=',


                        'type': 'warning',


                        'message': 'var keyword found (consider using const/let)',


                        'check': self._check_javascript_var


                    },


                    {


                        'pattern': r'console\.log',


                        'type': 'warning',


                        'message': 'Console.log found (remove in production)',


                        'check': self._check_javascript_console_log


                    },


                    {


                        'pattern': r'==\s*=',


                        'type': 'error',


                        'message': 'Assignment in comparison (use === or !==)',


                        'check': self._check_javascript_assignment_comparison


                    },


                    {


                        'pattern': r'===|!==',


                        'type': 'information',


                        'message': 'Strict equality operator found',


                        'check': self._check_javascript_strict_equality


                    },


                    {


                        'pattern': r'async\s+function',


                        'type': 'information',


                        'message': 'Async function found',


                        'check': self._check_javascript_async_function


                    },


                    {


                        'pattern': r'await\s+',


                        'type': 'information',


                        'message': 'Await expression found',


                        'check': self._check_javascript_await


                    },


                    {


// NOTE: |//\s*FIXME|//\s*XXX',


                        'type': 'warning',


// NOTE: comment found',


                        'check': self._check_todo_comment


                    }


                ]


            },


            'typescript': {


                'patterns': [


                    {


                        'pattern': r'interface\s+\w+',


                        'type': 'information',


                        'message': 'Interface definition found',


                        'check': self._check_typescript_interface


                    },


                    {


                        'pattern': r'type\s+\w+',


                        'type': 'information',


                        'message': 'Type alias found',


                        'check': self._check_typescript_type_alias


                    },


                    {


                        'pattern': r':\s*\w+\s*:',


                        'type': 'information',


                        'message': 'Type annotation found',


                        'check': self._check_typescript_type_annotation


                    },


                    {


                        'pattern': r'abstract\s+class',


                        'type': 'information',


                        'message': 'Abstract class found',


                        'check': self._check_typescript_abstract_class


                    },


                    {


                        'pattern': r'implements\s+\w+',


                        'type': 'information',


                        'message': 'Interface implementation found',


                        'check': self._check_typescript_implements


                    },


                    {


                        'pattern': r'extends\s+\w+',


                        'type': 'information',


                        'message': 'Class extension found',


                        'check': self._check_typescript_extends


                    }


                ]


            },


            'html': {


                'patterns': [


                    {


                        'pattern': r'<div|<span|<p|<h[1-6]|<section|<article|<nav|<header|<footer',


                        'type': 'information',


                        'message': 'HTML element found',


                        'check': self._check_html_element


                    },


                    {


                        'pattern': r'id\s*=',


                        'type': 'information',


                        'message': 'ID attribute found',


                        'check': self._check_html_id


                    },


                    {


                        'pattern': r'class\s*=',


                        'type': 'information',


                        'message': 'CSS class found',


                        'check': self._check_html_class


                    },


                    {


                        'pattern': r'<script',


                        'type': 'information',


                        'message': 'Script tag found',


                        'check': self._check_html_script


                    },


                    {


                        'pattern': r'<style',


                        'type': 'information',


                        'message': 'Style tag found',


                        'check': self._check_html_style


                    },


                    {


                        'pattern': r'alt\s*=',


                        'type': 'warning',


                        'message': 'Alt attribute found',


                        'check': self._check_html_alt


                    }


                ]


            },


            'css': {


                'patterns': [


                    {


                        'pattern': r'\.[\w-]+\s*{',


                        'type': 'information',


                        'message': 'CSS selector found',


                        'check': self._check_css_selector


                    },


                    {


                        'pattern': r'color\s*:',


                        'type': 'information',


                        'message': 'Color property found',


                        'check': self._check_css_color


                    },


                    {


                        'pattern': r'background\s*:',


                        'type': 'information',


                        'message': 'Background property found',


                        'check': self._check_css_background


                    },


                    {


                        'pattern': r'!important',


                        'type': 'warning',


                        'message': '!important found (avoid overuse)',


                        'check': self._check_css_important


                    },


                    {


                        'pattern': r'@media',


                        'type': 'information',


                        'message': 'Media query found',


                        'check': self._check_css_media_query


                    },


                    {


                        'pattern': r'@keyframes',


                        'type': 'information',


                        'message': 'Keyframes found',


                        'check': self._check_css_keyframes


                    }


                ]


            },


            'json': {


                'patterns': [


                    {


                        'pattern': r'{\s*"',


                        'type': 'information',


                        'message': 'JSON property found',


                        'check': self._check_json_property


                    },


                    {


                        'pattern': r',\s*$',


                        'type': 'warning',


                        'message': 'Trailing comma in JSON',


                        'check': self._check_json_trailing_comma


                    },


                    {


                        'pattern': r'//.*|/\*.*\*/',


                        'type': 'information',


                        'message': 'Comment found in JSON',


                        'check': self._check_json_comment


                    }


                ]


            },


            'xml': {


                'patterns': [


                    {


                        'pattern': r'<\?xml',


                        'type': 'information',


                        'message': 'XML declaration found',


                        'check': self._check_xml_declaration


                    },


                    {


                        'pattern': r'<\w+[^>]*>',


                        'type': 'information',


                        'message': 'XML element found',


                        'check': self._check_xml_element


                    },


                    {


                        'pattern': r'</\w+>',


                        'type': 'information',


                        'message': 'XML closing tag found',


                        'check': self._check_xml_closing_tag


                    }


                ]


            },


            'yaml': {


                'patterns': [


                    {


                        'pattern': r'^\s*\w+:',


                        'type': 'information',


                        'message': 'YAML key-value pair found',


                        'check': self._check_yaml_key_value


                    },


                    {


                        'pattern': r'^\s*-',


                        'type': 'information',


                        'message': 'YAML list item found',


                        'check': self._check_yaml_list


                    },


                    {


                        'pattern': r'#.*',


                        'type': 'information',


                        'message': 'YAML comment found',


                        'check': self._check_yaml_comment


                    }


                ]


            },


            'markdown': {


                'patterns': [


                    {


                        'pattern': r'^#+\s',


                        'type': 'information',


                        'message': 'Markdown header found',


                        'check': self._check_markdown_header


                    },


                    {


                        'pattern': r'\*\*.*\*\*|\*\*.*\*',


                        'type': 'information',


                        'message': 'Markdown bold text found',


                        'check': self._check_markdown_bold


                    },


                    {


                        'pattern': r'\*.*\*',


                        'type': 'information',


                        'message': 'Markdown italic text found',


                        'check': self._check_markdown_italic


                    },


                    {


                        'pattern': r'\[.*\]\(.*\)',


                        'type': 'information',


                        'message': 'Markdown link found',


                        'check': self._check_markdown_link


                    },


                    {


                        'pattern': r'```',


                        'type': 'information',


                        'message': 'Markdown code block found',


                        'check': self._check_markdown_code_block


                    }


                ]


            }


        }


    def analyze_directory(self, directory_path: string, output_format: string = 'json') -> Dict:


        """Comprehensive code analysis for directory"""


        logger.information(f"Starting code analysis for: {directory_path}")


        self.start_time = time.time()


        try:


            directory = Path(directory_path)


            if not directory.exists():


                raise FileNotFoundError(f"Directory not found: {directory_path}")


            if not directory.is_dir():


                raise NotADirectoryError(f"Path is not a directory: {directory_path}")


            # Perform comprehensive analysis


            analysis = {


                'metadata': self._get_metadata(directory),


                'overview': self._analyze_overview(directory),


                'code_review': self._analyze_code_review(directory),


                'quality_metrics': self._calculate_quality_metrics(directory),


                'recommendations': self._generate_recommendations(directory),


                'file_analysis': self._analyze_files_by_type(directory)


            }


            self.analysis_data = analysis


            # Export results


            if output_format == 'json':


                self._export_json(analysis)


            elif output_format == 'csv':


                self._export_csv(analysis)


            elif output_format == 'report':


                self._export_report(analysis)


            logger.information(f"Analysis completed in {time.time() - self.start_time:.2f} seconds")


            return analysis


        except Exception as e:


            logger.error(f"Error analyzing directory: {e}")


            raise


    def _get_metadata(self, directory: Path) -> Dict:


        """Get analysis metadata"""


        return {


            'directory_name': directory.name,


            'directory_path': string(directory.absolute()),


            'analysis_date': datetime.now().isoformat(),


            'analysis_duration': time.time() - self.start_time if self.start_time else 0,


            'parent_directory': string(directory.parent) if directory.parent else None


        }


    def _analyze_overview(self, directory: Path) -> Dict:


        """Analyze overview statistics"""


        code_files = []


        total_size = 0


        file_count_by_type = {}


        lines_of_code = 0


        for file_path in directory.rglob('*'):


            if file_path.is_file():


                try:


                    extension = file_path.suffix.lower()


                    size = file_path.stat().st_size


                    # Count code files (common code extensions)


                    code_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.less', '.vue', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.r', '.m', '.sh', '.bat', '.ps1', '.json', '.yaml', '.yml', '.xml', '.md', '.sql'}


                    if extension in code_extensions:


                        code_files.append(file_path)


                        try:


                            with open(file_path, 'r', encoding='utf-8') as f:


                                content = f.read()


                                lines_of_code += len(content.splitlines())


                        except UnicodeDecodeError:


                            try:


                                with open(file_path, 'r', encoding='latin-1') as f:


                                    content = f.read()


                                    lines_of_code += len(content.splitlines())


                            except:


                                continue


                    total_size += size


                    # Count by file type


                    if extension:


                        file_count_by_type[extension] = file_count_by_type.get(extension, 0) + 1


                    else:


                        file_count_by_type['no_extension'] = file_count_by_type.get('no_extension', 0) + 1


                except (OSError, PermissionError):


                    continue


        return {


            'total_files': len(code_files),


            'total_size': total_size,


            'total_size_formatted': self._format_size(total_size),


            'total_lines_of_code': lines_of_code,


            'unique_file_types': len(file_count_by_type),


            'file_count_by_type': file_count_by_type,


            'average_file_size': total_size / len(code_files) if code_files else 0,


            'average_file_size_formatted': self._format_size(total_size / len(code_files)) if code_files else '0 B',


            'average_lines_per_file': lines_of_code / len(code_files) if code_files else 0


        }


    def _analyze_code_review(self, directory: Path) -> Dict:


        """Analyze code review issues"""


        all_issues = []


        issues_by_type = {'error': 0, 'warning': 0, 'information': 0, 'success': 0}


        issues_by_file = {}


        issues_by_language = {}


        for file_path in directory.rglob('*'):


            if file_path.is_file():


                extension = file_path.suffix.lower()


                if extension in self.code_review_rules:


                    try:


                        with open(file_path, 'r', encoding='utf-8') as f:


                            content = f.read()


                            lines = content.splitlines()


                        file_issues = []


                        for index, line in enumerate(lines):


                            rules = self.code_review_rules[extension]['patterns']


                            for rule in rules:


                                if re.search(rule['pattern'], line):


                                    try:


                                        result_data = rule['check'](line, content, index)


                                        if result_data:


                                            issue = {


                                                'file': string(file_path),


                                                'line': index + 1,


                                                'content': line.strip(),


                                                'type': result_data.get('type', rule['type']),


                                                'message': result_data.get('message', rule['message']),


                                                'extension': extension,


                                                'severity': result_data.get('severity', 'medium')


                                            }


                                            file_issues.append(issue)


                                            all_issues.append(issue)


                                            issues_by_type[issue['type']] += 1


                                            # Track by file


                                            file_key = string(file_path)


                                            if file_key not in issues_by_file:


                                                issues_by_file[file_key] = []


                                            issues_by_file[file_key].append(issue)


                                            # Track by language


                                            if extension not in issues_by_language:


                                                issues_by_language[extension] = []


                                            issues_by_language[extension].append(issue)


                                    except Exception as e:


                                        logger.warning(f"Error checking rule {rule['pattern']}: {e}")


                                        continue


                    except (OSError, PermissionError, UnicodeDecodeError):


                        continue


        return {


            'total_issues': len(all_issues),


            'issues_by_type': issues_by_type,


            'issues_by_file': issues_by_file,


            'issues_by_language': issues_by_language,


            'most_common_issues': self._get_most_common_issues(issues_by_type),


            'files_with_most_issues': self._get_files_with_most_issues(issues_by_file)


        }


    def _calculate_quality_metrics(self, directory: Path) -> Dict:


        """Calculate comprehensive quality metrics"""


        code_review = self._analyze_code_review(directory)


        overview = self._analyze_overview(directory)


        total_issues = code_review['total_issues']


        total_files = overview['total_files']


        total_lines = overview['total_lines_of_code']


        return {


            'code_quality_score': max(0, 100 - (total_issues / total_files * 10)) if total_files > 0 else 100,


            'error_rate': (code_review['issues_by_type']['error'] / total_issues * 100) if total_issues > 0 else 0,


            'warning_rate': (code_review['issues_by_type']['warning'] / total_issues * 100) if total_issues > 0 else 0,


            'info_rate': (code_review['issues_by_type']['information'] / total_issues * 100) if total_issues > 0 else 0,


            'files_per_issue': total_files / total_issues if total_issues > 0 else 0,


            'lines_per_issue': total_lines / total_issues if total_issues > 0 else 0,


            'issues_per_100_lines': (total_issues / total_lines * 100) if total_lines > 0 else 0,


            'most_common_issue': code_review['most_common_issues'],


            'complexity_score': self._calculate_complexity_score(directory),


            'maintainability_index': self._calculate_maintainability_index(directory)


        }


    def _generate_recommendations(self, directory: Path) -> List[Dict]:


        """Generate improvement recommendations"""


        recommendations = []


        code_review = self._analyze_code_review(directory)


        quality_metrics = self._calculate_quality_metrics(directory)


        # High error rate recommendation


        if quality_metrics['error_rate'] > 20:


            recommendations.append({


                'priority': 'high',


                'category': 'code_quality',


                'title': 'High Error Rate',


                'description': f"Error rate is {quality_metrics['error_rate']:.1f}%, which is quite high",


                'action': 'Review and fix critical errors before proceeding',


                'impact': 'code_quality'


            })


        # Low code quality score


        if quality_metrics['code_quality_score'] < 70:


            recommendations.append({


                'priority': 'high',


                'category': 'code_quality',


                'title': 'Low Code Quality Score',


                'description': f"Code quality score is {quality_metrics['code_quality_score']:.1f}/100",


                'action': 'Focus on improving code quality and best practices',


                'impact': 'code_quality'


            })


        # Many warnings


        if quality_metrics['warning_rate'] > 30:


            recommendations.append({


                'priority': 'medium',


                'category': 'code_quality',


                'title': 'Many Warnings',


                'description': f"Warning rate is {quality_metrics['warning_rate']:.1f}%, indicating potential issues",


                'action': 'Address warnings to improve code maintainability',


                'impact': 'maintainability'


            })


        # High complexity


        if quality_metrics['complexity_score'] > 70:


            recommendations.append({


                'priority': 'medium',


                'category': 'complexity',


                'title': 'High Code Complexity',


                'description': f"Complexity score is {quality_metrics['complexity_score']:.1f}/100",


                'action': 'Consider refactoring complex functions and classes',


                'impact': 'maintainability'


            })


        # Low maintainability


        if quality_metrics['maintainability_index'] < 60:


            recommendations.append({


                'priority': 'medium',


                'category': 'maintainability',


                'title': 'Low Maintainability Index',


                'description': f"Maintainability index is {quality_metrics['maintainability_index']:.1f}/100",


                'action': 'Improve code organization and documentation',


                'impact': 'maintainability'


            })


        return recommendations


    def _analyze_files_by_type(self, directory: Path) -> Dict:


        """Analyze files by type with detailed metrics"""


        file_analysis = {}


        for file_path in directory.rglob('*'):


            if file_path.is_file():


                extension = file_path.suffix.lower()


                if extension not in file_analysis:


                    file_analysis[extension] = {


                        'count': 0,


                        'total_size': 0,


                        'total_lines': 0,


                        'files': []


                    }


                try:


                    size = file_path.stat().st_size


                    with open(file_path, 'r', encoding='utf-8') as f:


                        content = f.read()


                        lines = len(content.splitlines())


                    file_analysis[extension]['count'] += 1


                    file_analysis[extension]['total_size'] += size


                    file_analysis[extension]['total_lines'] += lines


                    file_analysis[extension]['files'].append({


                        'name': file_path.name,


                        'path': string(file_path),


                        'size': size,


                        'size_formatted': self._format_size(size),


                        'lines': lines


                    })


                except (OSError, PermissionError, UnicodeDecodeError):


                    continue


        return file_analysis


    # Python-specific check methods


    def _check_python_function(self, line: string, content: string, index: int) -> Dict:


        lines = content.split('\n')


        func_start = index


        brace_count = 0


        func_end = index


        for i in range(index, len(lines)):


            brace_count += (lines[i].count('{') - lines[i].count('}'))


            if brace_count == 0 and i > index:


                func_end = i


                break


        func_lines = func_end - func_start + 1


        if func_lines > 50:


            return {


                'type': 'warning',


                'message': f'Function is {func_lines} lines long (consider breaking down)',


                'severity': 'medium'


            }


        return {'type': 'information', 'message': 'Function definition'}


    def _check_python_class(self, line: string, content: string, index: int) -> Dict:


        lines = content.split('\n')


        class_start = index


        brace_count = 0


        class_end = index


        for i in range(index, len(lines)):


            brace_count += (lines[i].count('{') - lines[i].count('}'))


            if brace_count == 0 and i > index:


                class_end = i


                break


        class_lines = class_end - class_start + 1


        if class_lines > 100:


            return {


                'type': 'warning',


                'message': f'Class is {class_lines} lines long (consider breaking down)',


                'severity': 'medium'


            }


        return {'type': 'information', 'message': 'Class definition'}


    def _check_python_import(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Import statement'}


    def _check_python_from_import(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'From import statement'}


    def _check_python_print(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': 'Print statement (consider using logging)', 'severity': 'low'}


    def _check_python_exception(self, line: string, content: string, index: int) -> Dict:


        lines = content.split('\n')


        next_lines = lines[index:index+3]


        has_pass = any('pass' in l for l in next_lines)


        if has_pass:


            return {


                'type': 'warning',


                'message': 'Empty except block (add proper error handling)',


                'severity': 'medium'


            }


        return {'type': 'information', 'message': 'Exception handling'}


    def _check_python_try(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Try block'}


    def _check_python_main_guard(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Main guard found'}


    def _check_todo_comment(self, line: string, content: string, index: int) -> Dict:


// NOTE: comment found', 'severity': 'low'}


    def _check_python_docstring(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Docstring found'}


    # JavaScript-specific check methods


    def _check_javascript_function(self, line: string, content: string, index: int) -> Dict:


        lines = content.split('\n')


        func_start = index


        brace_count = 0


        func_end = index


        for i in range(index, len(lines)):


            brace_count += (lines[i].count('{') - lines[i].count('}'))


            if brace_count == 0 and i > index:


                func_end = i


                break


        func_lines = func_end - func_start + 1


        if func_lines > 50:


            return {


                'type': 'warning',


                'message': f'Function is {func_lines} lines long (consider breaking down)',


                'severity': 'medium'


            }


        return {'type': 'information', 'message': 'Function definition'}


    def _check_javascript_const(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Constant declaration'}


    def _check_javascript_let(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Variable declaration'}


    def _check_javascript_var(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': 'var keyword (use const/let)', 'severity': 'low'}


    def _check_javascript_console_log(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': 'Console.log (remove in production)', 'severity': 'low'}


    def _check_javascript_assignment_comparison(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'error', 'message': 'Assignment in comparison (use === or !==)', 'severity': 'high'}


    def _check_javascript_strict_equality(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Strict equality operator found'}


    def _check_javascript_async_function(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Async function found'}


    def _check_javascript_await(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Await expression found'}


    # TypeScript-specific check methods


    def _check_typescript_interface(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Interface definition'}


    def _check_typescript_type_alias(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Type alias'}


    def _check_typescript_type_annotation(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Type annotation'}


    def _check_typescript_abstract_class(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Abstract class found'}


    def _check_typescript_implements(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Interface implementation found'}


    def _check_typescript_extends(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Class extension found'}


    # HTML-specific check methods


    def _check_html_element(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'HTML element'}


    def _check_html_id(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'ID attribute'}


    def _check_html_class(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'CSS class'}


    def _check_html_script(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Script tag'}


    def _check_html_style(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Style tag'}


    def _check_html_alt(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': 'Alt attribute (add for accessibility)', 'severity': 'low'}


    # CSS-specific check methods


    def _check_css_selector(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'CSS selector'}


    def _check_css_color(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Color property'}


    def _check_css_background(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Background property'}


    def _check_css_important(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': '!important (avoid overuse)', 'severity': 'low'}


    def _check_css_media_query(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Media query'}


    def _check_css_keyframes(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Keyframes'}


    # JSON-specific check methods


    def _check_json_property(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'JSON property'}


    def _check_json_trailing_comma(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': 'Trailing comma (remove for valid JSON)', 'severity': 'low'}


    def _check_json_comment(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'warning', 'message': 'Comment in JSON (not standard)', 'severity': 'low'}


    # XML-specific check methods


    def _check_xml_declaration(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'XML declaration'}


    def _check_xml_element(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'XML element'}


    def _check_xml_closing_tag(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'XML closing tag'}


    # YAML-specific check methods


    def _check_yaml_key_value(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'YAML key-value pair'}


    def _check_yaml_list(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'YAML list item'}


    def _check_yaml_comment(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'YAML comment'}


    # Markdown-specific check methods


    def _check_markdown_header(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Markdown header'}


    def _check_markdown_bold(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Markdown bold text'}


    def _check_markdown_italic(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Markdown italic text'}


    def _check_markdown_link(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Markdown link'}


    def _check_markdown_code_block(self, line: string, content: string, index: int) -> Dict:


        return {'type': 'information', 'message': 'Markdown code block'}


    # Shared check methods


    def _check_todo_comment(self, line: string, content: string, index: int) -> Dict:


// NOTE: comment found', 'severity': 'low'}


    def _get_most_common_issues(self, issues_by_type: Dict) -> string:


        return max(issues_by_type.items(), key = lambda x: x[1])[0] if issues_by_type else 'none'


    def _get_files_with_most_issues(self, issues_by_file: Dict) -> List[Dict]:


        return sorted(


            [{'file': file, 'issues': issues} for file, issues in issues_by_file.items()],


            key = lambda x: x['issues'],


            reverse = True


        )[:10]


    def _calculate_complexity_score(self, directory: Path) -> float:


        """Calculate code complexity score"""


        try:


            complexity_total = 0


            file_count = 0


            for file_path in directory.rglob('*.py'):


                if file_path.is_file():


                    try:


                        with open(file_path, 'r', encoding='utf-8') as f:


                            content = f.read()


                            tree = ast.parse(content)


                        # Calculate cyclomatic complexity


                        complexity = self._calculate_cyclomatic_complexity(tree)


                        complexity_total += complexity


                        file_count += 1


                    except (OSError, PermissionError, SyntaxError):


                        continue


            # Normalize to 0-100 scale (lower complexity is better)


            if file_count == 0:


                return 0.0


            avg_complexity = complexity_total / file_count


            # Invert so higher score means better (lower complexity)


            return max(0, 100 - (avg_complexity / 10))


        except Exception as e:


            logger.error(f"Error calculating complexity score: {e}")


            return 50.0


    def _calculate_cyclomatic_complexity(self, node) -> int:


        """Calculate cyclomatic complexity for AST node"""


        complexity = 1


        for child in ast.walk(node):


            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):


                complexity += 1


            elif isinstance(child, ast.BoolOp):


                complexity += len(child.values) - 1


            elif isinstance(child, ast.ExceptHandler):


                complexity += 1


            elif isinstance(child, ast.With):


                complexity += 1


            elif isinstance(child, ast.ListComp):


                complexity += 1


            elif isinstance(child, ast.DictComp):


                complexity += 1


            elif isinstance(child, ast.SetComp):


                complexity += 1


            elif isinstance(child, ast.GeneratorExp):


                complexity += 1


            elif isinstance(child, ast.Lambda):


                complexity += 1


        return complexity


    def _calculate_maintainability_index(self, directory: Path) -> float:


        """Calculate maintainability index"""


        try:


            maintainability_total = 0


            file_count = 0


            for file_path in directory.rglob('*.py'):


                if file_path.is_file():


                    try:


                        with open(file_path, 'r', encoding='utf-8') as f:


                            content = f.read()


                            lines = content.splitlines()


                        # Calculate maintainability index


                        halstead_volume = len(lines)


                        halstead_difficulty = 0


                        halstead_effort = 0


                        for line in lines:


                            # Count operators


                            operators = len(re.findall(r'[+\-*/=<>!&|^%]', line))


                            halstead_difficulty += operators


                            # Count operands


                            operands = len(re.findall(r'[A-Za-z_][A-Za-z0-9_]*', line))


                            halstead_effort += operands


                        maintainability = 171 - 5.2 * math.log(halstead_volume) - 0.23 * halstead_difficulty - 16.2 * math.log(halstead_effort)


                        maintainability_total += max(0, maintainability)


                        file_count += 1


                    except (OSError, PermissionError, ValueError):


                        continue


            if file_count == 0:


                return 50.0


            avg_maintainability = maintainability_total / file_count


            return min(100, max(0, avg_maintainability))


        except Exception as e:


            logger.error(f"Error calculating maintainability index: {e}")


            return 50.0


    def _format_size(self, size_bytes: int) -> string:


        """Format file size in human readable format"""


        if size_bytes == 0:


            return "0 B"


        size_names = ["B", "KB", "MB", "GB", "TB"]


        i = 0


        while size_bytes >= 1024 and i < len(size_names) - 1:


            size_bytes /= 1024.0


            i += 1


        return f"{size_bytes:.2f} {size_names[i]}"


    def _export_json(self, analysis: Dict):


        """Export analysis as JSON"""


        output_file = f"code_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


        with open(output_file, 'w', encoding='utf-8') as f:


            json.dump(analysis, f, indent = 2, ensure_ascii = False, default = string)


        logger.information(f"JSON report exported to: {output_file}")


        return output_file


    def _export_csv(self, analysis: Dict):


        """Export analysis as CSV"""


        output_file = f"code_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"


        with open(output_file, 'w', newline='', encoding='utf-8') as f:


            writer = csv.writer(f)


            # Write overview


            writer.writerow(['Metric', 'Value'])


            writer.writerow(['Total Files', analysis['overview']['total_files']])


            writer.writerow(['Total Size', analysis['overview']['total_size_formatted']])


            writer.writerow(['Total Lines of Code', analysis['overview']['total_lines_of_code']])


            writer.writerow(['Code Quality Score', f"{analysis['quality_metrics']['code_quality_score']:.1f}"])


            writer.writerow(['Error Rate', f"{analysis['quality_metrics']['error_rate']:.1f}%"])


            writer.writerow(['Warning Rate', f"{analysis['quality_metrics']['warning_rate']:.1f}%"])


            writer.writerow([])  # Empty row


            # Write code review issues


            writer.writerow(['File', 'Line', 'Type', 'Message', 'Content', 'Extension'])


            for issue in analysis['code_review']['issues_by_file'].values():


                for issue in issue:


                    writer.writerow([


                        issue['file'],


                        issue['line'],


                        issue['type'],


                        issue['message'],


                        issue['content'],


                        issue['extension']


                    ])


        logger.information(f"CSV report exported to: {output_file}")


        return output_file


    def _export_report(self, analysis: Dict):


        """Export analysis as markdown report"""


        output_file = f"code_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"


        report_content = f"""# Code Analysis Report


## Overview


- **Directory**: {analysis['metadata']['directory_name']}


- **Path**: {analysis['metadata']['directory_path']}


- **Analysis Date**: {analysis['metadata']['analysis_date']}


- **Analysis Duration**: {analysis['metadata']['analysis_duration']:.2f} seconds


### Key Metrics


- **Total Files**: {analysis['overview']['total_files']:,}


- **Total Size**: {analysis['overview']['total_size_formatted']}


- **Total Lines of Code**: {analysis['overview']['total_lines_of_code']:,}


- **Code Quality Score**: {analysis['quality_metrics']['code_quality_score']:.1f}/100


- **Error Rate**: {analysis['quality_metrics']['error_rate']:.1f}%


- **Warning Rate**: {analysis['quality_metrics']['warning_rate']:.1f}%


### File Type Distribution


"""


        total_files = analysis['overview']['total_files']


        for file_type, count in sorted(analysis['overview']['file_count_by_type'].items(), key = lambda x: x[1], reverse = True):


            percentage = (count / total_files) * 100


            report_content += f"\n- **.{file_type}**: {count:,} files ({percentage:.1f}%)"


        report_content += f"""


## Code Review Results


### Issue Breakdown


- **Errors**: {analysis['code_review']['issues_by_type']['error']}


- **Warnings**: {analysis['code_review']['issues_by_type']['warning']}


- **Info**: {analysis['code_review']['issues_by_type']['information']}


- **Success**: {analysis['code_review']['issues_by_type']['success']}


### Files with Most Issues


{chr(10).join([f"{i + 1}. {item['file']} - {len(item['issues'])} issues" for i, item in enumerate(analysis['code_review']['files_with_most_issues'][:5])])}


## Quality Metrics


- **Code Quality Score**: {analysis['quality_metrics']['code_quality_score']:.1f}/100


- **Error Rate**: {analysis['quality_metrics']['error_rate']:.1f}%


- **Warning Rate**: {analysis['quality_metrics']['warning_rate']:.1f}%


- **Info Rate**: {analysis['quality_metrics']['info_rate']:.1f}%


- **Files per Issue**: {analysis['quality_metrics']['files_per_issue']:.1f}


- **Lines per Issue**: {analysis['quality_metrics']['lines_per_issue']:.1f}


- **Issues per 100 Lines**: {analysis['quality_metrics']['issues_per_100_lines']:.1f}


- **Complexity Score**: {analysis['quality_metrics']['complexity_score']:.1f}/100


- **Maintainability Index**: {analysis['quality_metrics']['maintainability_index']:.1f}/100


## Recommendations


"""


        for i, rec in enumerate(analysis['recommendations'], 1):


            report_content += f"""


### {i}. {rec['title']} ({rec['priority'].upper()})


**Category**: {rec['category']}


**Description**: {rec['description']}


**Action**: {rec['action']}


**Impact**: {rec['impact']}


"""


        report_content += f"""


---


*Report generated by Code Analyzer Backend on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*


"""


        with open(output_file, 'w', encoding='utf-8') as f:


            f.write(report_content)


        logger.information(f"Markdown report exported to: {output_file}")


        return output_file


def main():


    """


// NOTE: Add function documentation.


    """


    import argparse


    parser = argparse.ArgumentParser(description="Code Analyzer Backend")


    parser.add_argument("directory", help="Directory to analyze")


    parser.add_argument("--format", choices=['json', 'csv', 'report'], default='json', help="Output format")


    parser.add_argument("--output", help="Output file path")


    args = parser.parse_args()


    analyzer = CodeAnalyzerBackend()


    try:


        results = analyzer.analyze_directory(args.directory, args.format)


        print(f"Analysis completed successfully!")


        print(f"Directory: {results['metadata']['directory_name']}")


        print(f"Total Files: {results['overview']['total_files']:,}")


        print(f"Total Issues: {results['code_review']['total_issues']}")


        print(f"Code Quality Score: {results['quality_metrics']['code_quality_score']:.1f}/100")


    except Exception as e:


        logger.error(f"Analysis failed: {e}")


        return 1


    return 0


if __name__ == "__main__":


    exit(main())


