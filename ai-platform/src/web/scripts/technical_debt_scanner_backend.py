#!/usr/bin/env python3


"""


Technical Debt Scanner Backend


Provides comprehensive technical debt analysis and prioritization


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


        logging.FileHandler('technical_debt_scanner.log'),


        logging.StreamHandler()


    ]


)


logger = logging.getLogger(__name__)


class TechnicalDebtScanner:


    def __init__(self):


    """


// NOTE: Add function documentation.


    """


        self.analysis_data = {}


        self.start_time = None


        self.debt_rules = self.initialize_debt_rules()


    def initialize_debt_rules(self):


        """Initialize comprehensive technical debt detection rules"""


        return {


            'python': {


                'patterns': [


                    {


                        'pattern': r'def\s+\w+\([^)]*\)\s*:',


                        'type': 'complexity',


                        'severity': 'medium',


                        'message': 'Complex function detected',


                        'check': self._check_python_function_complexity


                    },


                    {


                        'pattern': r'class\s+\w+\s*\(',


                        'type': 'design',


                        'severity': 'medium',


                        'message': 'Large class detected',


                        'check': self._check_python_class_size


                    },


                    {


                        'pattern': r'except\s*:',


                        'type': 'error_handling',


                        'severity': 'medium',


                        'message': 'Poor exception handling',


                        'check': self._check_python_exception_handling


                    },


                    {


                        'pattern': r'try\s*:',


                        'type': 'error_handling',


                        'severity': 'low',


                        'message': 'Try block found',


                        'check': self._check_python_try_block


                    },


                    {


                        'pattern': r'import\s+\w+',


                        'type': 'architecture',


                        'severity': 'low',


                        'message': 'Import statement',


                        'check': self._check_python_imports


                    },


                    {


                        'pattern': r'from\s+\w+\s+import',


                        'type': 'architecture',


                        'severity': 'low',


                        'message': 'From import statement',


                        'check': self._check_python_from_imports


                    },


                    {


// NOTE: |#\s*FIXME|#\s*XXX',


                        'type': 'documentation',


                        'severity': 'medium',


// NOTE: comment indicates technical debt',


                        'check': self._check_todo_comment


                    },


                    {


                        'pattern': r'print\s*\(',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Debug code in production',


                        'check': self._check_python_print


                    },


                    {


                        'pattern': r'"""',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'Docstring found',


                        'check': self._check_python_docstring


                    },


                    {


                        'pattern': r'if\s+__name__\s*==\s*["\']__main__["\']',


                        'type': 'architecture',


                        'severity': 'low',


                        'message': 'Main guard found',


                        'check': self._check_python_main_guard


                    },


                    {


                        'pattern': r'@\w+',


                        'type': 'design',


                        'severity': 'medium',


                        'message': 'Decorator found',


                        'check': self._check_python_decorator


                    },


                    {


                        'pattern': r'lambda\s+',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Lambda function found',


                        'check': self._check_python_lambda


                    },


                    {


                        'pattern': r'list\s*comp\(|dict\s*comp\(|set\s*comp\(',


                        'type': 'complexity',


                        'severity': 'medium',


                        'message': 'Comprehension found',


                        'check': self._check_python_comprehension


                    }


                ]


            },


            'javascript': {


                'patterns': [


                    {


                        'pattern': r'function\s+\w+\s*\(',


                        'type': 'complexity',


                        'severity': 'medium',


                        'message': 'Complex function detected',


                        'check': self._check_javascript_function_complexity


                    },


                    {


                        'pattern': r'const\s+\w+\s*=',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Constant declaration found',


                        'check': self._check_javascript_const


                    },


                    {


                        'pattern': r'let\s+\w+\s*=',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Variable declaration found',


                        'check': self._check_javascript_let


                    },


                    {


                        'pattern': r'var\s+\w+\s*=',


                        'type': 'code_quality',


                        'severity': 'medium',


                        'message': 'Outdated variable declaration',


                        'check': self._check_javascript_var


                    },


                    {


                        'pattern': r'console\.log',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Debug code in production',


                        'check': self._check_javascript_console_log


                    },


                    {


                        'pattern': r'==\s*=',


                        'type': 'code_quality',


                        'severity': 'high',


                        'message': 'Assignment in comparison',


                        'check': self._check_javascript_assignment_comparison


                    },


                    {


                        'pattern': r'===|!==',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Strict equality operator found',


                        'check': self._check_javascript_strict_equality


                    },


                    {


                        'pattern': r'async\s+function',


                        'type': 'complexity',


                        'severity': 'medium',


                        'message': 'Async function found',


                        'check': self._check_javascript_async_function


                    },


                    {


                        'pattern': r'await\s+',


                        'type': 'complexity',


                        'severity': 'medium',


                        'message': 'Await expression found',


                        'check': self._check_javascript_await


                    },


                    {


// NOTE: |//\s*FIXME|//\s*XXX',


                        'type': 'documentation',


                        'severity': 'medium',


// NOTE: comment indicates technical debt',


                        'check': self._check_todo_comment


                    },


                    {


                        'pattern': r'callback',


                        'type': 'design',


                        'severity': 'medium',


                        'message': 'Callback pattern found',


                        'check': self._check_javascript_callback


                    }


                ]


            },


            'typescript': {


                'patterns': [


                    {


                        'pattern': r'interface\s+\w+',


                        'type': 'design',


                        'severity': 'low',


                        'message': 'Interface definition found',


                        'check': self._check_typescript_interface


                    },


                    {


                        'pattern': r'type\s+\w+',


                        'type': 'design',


                        'severity': 'low',


                        'message': 'Type alias found',


                        'check': self._check_typescript_type_alias


                    },


                    {


                        'pattern': r':\s*\w+\s*:',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Type annotation found',


                        'check': self._check_typescript_type_annotation


                    },


                    {


                        'pattern': r'abstract\s+class',


                        'type': 'design',


                        'severity': 'medium',


                        'message': 'Abstract class found',


                        'check': self._check_typescript_abstract_class


                    },


                    {


                        'pattern': r'implements\s+\w+',


                        'type': 'design',


                        'severity': 'low',


                        'message': 'Interface implementation found',


                        'check': self._check_typescript_implements


                    },


                    {


                        'pattern': r'extends\s+\w+',


                        'type': 'design',


                        'severity': 'low',


                        'message': 'Class extension found',


                        'check': self._check_typescript_extends


                    },


                    {


                        'pattern': r'any\s*:',


                        'type': 'code_quality',


                        'severity': 'medium',


                        'message': 'Type safety issues',


                        'check': self._check_typescript_any


                    },


                    {


                        'pattern': r'@ts-ignore',


                        'type': 'code_quality',


                        'severity': 'high',


                        'message': 'TypeScript ignore directive',


                        'check': self._check_typescript_ignore


                    }


                ]


            },


            'html': {


                'patterns': [


                    {


                        'pattern': r'<script',


                        'type': 'architecture',


                        'severity': 'medium',


                        'message': 'Inline scripts',


                        'check': self._check_html_inline_script


                    },


                    {


                        'pattern': r'<style',


                        'type': 'architecture',


                        'severity': 'medium',


                        'message': 'Inline styles',


                        'check': self._check_html_inline_style


                    },


                    {


                        'pattern': r'<div|<span|<p|<h[1-6]',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'HTML element found',


                        'check': self._check_html_element


                    },


                    {


                        'pattern': r'id\s*=',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'ID attribute found',


                        'check': self._check_html_id


                    },


                    {


                        'pattern': r'class\s*=',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'CSS class found',


                        'check': self._check_html_class


                    },


                    {


                        'pattern': r'alt\s*=',


                        'type': 'accessibility',


                        'severity': 'medium',


                        'message': 'Alt attribute found',


                        'check': self._check_html_alt


                    }


                ]


            },


            'css': {


                'patterns': [


                    {


                        'pattern': r'\.[\w-]+\s*{',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'CSS selector found',


                        'check': self._check_css_selector


                    },


                    {


                        'pattern': r'color\s*:',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Color property found',


                        'check': self._check_css_color


                    },


                    {


                        'pattern': r'background\s*:',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Background property found',


                        'check': self._check_css_background


                    },


                    {


                        'pattern': r'!important',


                        'type': 'code_quality',


                        'severity': 'medium',


                        'message': 'CSS specificity issues',


                        'check': self._check_css_important


                    },


                    {


                        'pattern': r'@media',


                        'type': 'design',


                        'severity': 'low',


                        'message': 'Media query found',


                        'check': self._check_css_media_query


                    },


                    {


                        'pattern': r'@keyframes',


                        'type': 'design',


                        'severity': 'low',


                        'message': 'Keyframes found',


                        'check': self._check_css_keyframes


                    }


                ]


            },


            'json': {


                'patterns': [


                    {


                        'pattern': r'{\s*"',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'JSON property found',


                        'check': self._check_json_property


                    },


                    {


                        'pattern': r',\s*$',


                        'type': 'code_quality',


                        'severity': 'medium',


                        'message': 'Trailing comma in JSON',


                        'check': self._check_json_trailing_comma


                    },


                    {


                        'pattern': r'//.*|/\*.*\*/',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'Comment found in JSON',


                        'check': self._check_json_comment


                    }


                ]


            },


            'xml': {


                'patterns': [


                    {


                        'pattern': r'<\?xml',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'XML declaration found',


                        'check': self._check_xml_declaration


                    },


                    {


                        'pattern': r'<\w+[^>]*>',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'XML element found',


                        'check': self._check_xml_element


                    },


                    {


                        'pattern': r'</\w+>',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'XML closing tag found',


                        'check': self._check_xml_closing_tag


                    }


                ]


            },


            'yaml': {


                'patterns': [


                    {


                        'pattern': r'^\s*\w+:',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'YAML key-value pair found',


                        'check': self._check_yaml_key_value


                    },


                    {


                        'pattern': r'^\s*-',


                        'type': 'code_quality',


                        'severity': 'low',


                        'message': 'YAML list item found',


                        'check': self._check_yaml_list


                    },


                    {


                        'pattern': r'#.*',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'YAML comment found',


                        'check': self._check_yaml_comment


                    }


                ]


            },


            'markdown': {


                'patterns': [


                    {


                        'pattern': r'^#+\s',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'Markdown header found',


                        'check': self._check_markdown_header


                    },


                    {


                        'pattern': r'\*\*.*\*\*|\*\*.*\*',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'Markdown bold text found',


                        'check': self._check_markdown_bold


                    },


                    {


                        'pattern': r'\*.*\*',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'Markdown italic text found',


                        'check': self._check_markdown_italic


                    },


                    {


                        'pattern': r'\[.*\]\(.*\)',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'Markdown link found',


                        'check': self._check_markdown_link


                    },


                    {


                        'pattern': r'```',


                        'type': 'documentation',


                        'severity': 'low',


                        'message': 'Markdown code block found',


                        'check': self._check_markdown_code_block


                    }


                ]


            }


        }


    def scan_directory(self, directory_path: string, output_format: string = 'json') -> Dict:


        """Comprehensive technical debt scanning for directory"""


        logger.information(f"Starting technical debt scan for: {directory_path}")


        self.start_time = time.time()


        try:


            directory = Path(directory_path)


            if not directory.exists():


                raise FileNotFoundError(f"Directory not found: {directory_path}")


            if not directory.is_dir():


                raise NotADirectoryError(f"Path is not a directory: {directory_path}")


            # Perform comprehensive scan


            overview = self._scan_overview(directory)


            debt_analysis = self._analyze_technical_debt(directory)


            categories = self._calculate_debt_categories(debt_analysis)


            effort_estimation = self._calculate_effort_estimation(debt_analysis)


            recommendations = self._generate_debt_recommendations(debt_analysis, overview)


            debt_metrics = self._calculate_debt_metrics(debt_analysis, overview)


            scan = {


                'metadata': self._get_metadata(directory),


                'overview': overview,


                'debt_analysis': debt_analysis,


                'categories': categories,


                'effort_estimation': effort_estimation,


                'recommendations': recommendations,


                'debt_metrics': debt_metrics


            }


            self.analysis_data = scan


            # Export results


            if output_format == 'json':


                self._export_json(scan)


            elif output_format == 'csv':


                self._export_csv(scan)


            elif output_format == 'report':


                self._export_report(scan)


            logger.information(f"Scan completed in {time.time() - self.start_time:.2f} seconds")


            return scan


        except Exception as e:


            logger.error(f"Error scanning directory: {e}")


            raise


    def _get_metadata(self, directory: Path) -> Dict:


        """Get scan metadata"""


        return {


            'directory_name': directory.name,


            'directory_path': string(directory.absolute()),


            'scan_date': datetime.now().isoformat(),


            'scan_duration': time.time() - self.start_time if self.start_time else 0,


            'parent_directory': string(directory.parent) if directory.parent else None


        }


    def _scan_overview(self, directory: Path) -> Dict:


        """Scan overview statistics"""


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


    def _analyze_technical_debt(self, directory: Path) -> Dict:


        """Analyze technical debt issues"""


        all_debt_items = []


        debt_by_severity = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}


        debt_by_category = {}


        debt_by_effort = {'high': 0, 'medium': 0, 'low': 0}


        debt_by_file = {}


        debt_by_language = {}


        total_effort_hours = 0


        for file_path in directory.rglob('*'):


            if file_path.is_file():


                extension = file_path.suffix.lower()


                if extension in self.debt_rules:


                    try:


                        with open(file_path, 'r', encoding='utf-8') as f:


                            content = f.read()


                            lines = content.splitlines()


                        file_debt_items = []


                        for index, line in enumerate(lines):


                            rules = self.debt_rules[extension]['patterns']


                            for rule in rules:


                                if re.search(rule['pattern'], line):


                                    try:


                                        result_data = rule['check'](line, content, index)


                                        if result_data:


                                            debt_item = {


                                                'file': string(file_path),


                                                'line': index + 1,


                                                'content': line.strip(),


                                                'type': rule['type'],


                                                'severity': result_data.get('severity', rule['severity']),


                                                'message': result_data.get('message', rule['message']),


                                                'extension': extension,


                                                'effort': result_data.get('effort', 'low')


                                            }


                                            file_debt_items.append(debt_item)


                                            all_debt_items.append(debt_item)


                                            debt_by_severity[debt_item['severity']] += 1


                                            # Track by category


                                            if debt_item['type'] not in debt_by_category:


                                                debt_by_category[debt_item['type']] = 0


                                            debt_by_category[debt_item['type']] += 1


                                            # Track by effort


                                            debt_by_effort[debt_item['effort']] += 1


                                            # Calculate effort hours


                                            effort_hours = self._calculate_effort_hours(debt_item)


                                            total_effort_hours += effort_hours


                                            # Track by file


                                            file_key = string(file_path)


                                            if file_key not in debt_by_file:


                                                debt_by_file[file_key] = []


                                            debt_by_file[file_key].append(debt_item)


                                            # Track by language


                                            if extension not in debt_by_language:


                                                debt_by_language[extension] = []


                                            debt_by_language[extension].append(debt_item)


                                    except Exception as e:


                                        logger.warning(f"Error checking rule {rule['pattern']}: {e}")


                                        continue


                    except (OSError, PermissionError, UnicodeDecodeError):


                        continue


        return {


            'total_debt_items': len(all_debt_items),


            'debt_by_severity': debt_by_severity,


            'debt_by_category': debt_by_category,


            'debt_by_effort': debt_by_effort,


            'debt_by_file': debt_by_file,


            'debt_by_language': debt_by_language,


            'total_effort_hours': total_effort_hours,


            'most_common_debt': self._get_most_common_debt(debt_by_category),


            'files_with_most_debt': self._get_files_with_most_debt(debt_by_file)


        }


    def _calculate_debt_categories(self, debt_analysis: Dict) -> Dict:


        """Calculate debt categories with detailed analysis"""


        debt_analysis = self._analyze_technical_debt(directory)


        categories = {}


        # Initialize categories with descriptions


        category_descriptions = {


            'complexity': 'Code complexity and maintainability issues',


            'design': 'Design and architectural problems',


            'code_quality': 'Code quality and best practices violations',


            'error_handling': 'Poor error handling and exception management',


            'documentation': 'Missing or inadequate documentation',


            'architecture': 'Architectural and structural issues',


            'accessibility': 'Accessibility and usability issues'


        }


        for category, description in category_descriptions.items():


            categories[category] = {


                'count': debt_analysis['debt_by_category'].get(category, 0),


                'description': description,


                'severity_breakdown': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0},


                'effort_breakdown': {'high': 0, 'medium': 0, 'low': 0},


                'priority': self._calculate_category_priority(category, debt_analysis)


            }


        # Calculate severity and effort breakdown for each category


        for item in debt_analysis['debt_analysis']:


            category = item['type']


            if category in categories:


                categories[category]['severity_breakdown'][item['severity']] += 1


                categories[category]['effort_breakdown'][item['effort']] += 1


        return categories


    def _calculate_effort_estimation(self, debt_analysis: Dict) -> Dict:


        """Calculate comprehensive effort estimation"""


        debt_analysis = self._analyze_technical_debt(directory)


        effort_breakdown = {


            'total_hours': debt_analysis['total_effort_hours'],


            'by_severity': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0},


            'by_category': {},


            'by_file': {},


            'by_effort': debt_analysis['debt_by_effort'],


            'timeline_estimates': {


                '1_week': 0,


                '2_weeks': 0,


                '1_month': 0,


                '3_months': 0,


                '6_months': 0


            }


        }


        # Calculate by severity


        for item in debt_analysis['debt_analysis']:


            effort_hours = self._calculate_effort_hours(item)


            effort_breakdown['by_severity'][item['severity']] += effort_hours


            # Calculate by category


            if item['type'] not in effort_breakdown['by_category']:


                effort_breakdown['by_category'][item['type']] = 0


            effort_breakdown['by_category'][item['type']] += effort_hours


            # Calculate by file


            if item['file'] not in effort_breakdown['by_file']:


                effort_breakdown['by_file'][item['file']] = 0


            effort_breakdown['by_file'][item['file']] += effort_hours


        # Sort files by effort


        effort_breakdown['by_file'] = dict(


            sorted(effort_breakdown['by_file'].items(), key = lambda x: x[1], reverse = True)[:10]


        )


        # Calculate timeline estimates


        total_hours = effort_breakdown['total_hours']


        effort_breakdown['timeline_estimates']['1_week'] = min(total_hours, 40)


        effort_breakdown['timeline_estimates']['2_weeks'] = min(total_hours, 80)


        effort_breakdown['timeline_estimates']['1_month'] = min(total_hours, 160)


        effort_breakdown['timeline_estimates']['3_months'] = min(total_hours, 480)


        effort_breakdown['timeline_estimates']['6_months'] = min(total_hours, 960)


        return effort_breakdown


    def _calculate_debt_metrics(self, debt_analysis: Dict, overview: Dict) -> Dict:


        """Calculate comprehensive debt metrics"""


        debt_analysis = self._analyze_technical_debt(directory)


        overview = self._scan_overview(directory)


        total_debt = debt_analysis['total_debt_items']


        total_files = overview['total_files']


        total_lines = overview['total_lines_of_code']


        return {


            'debt_density': total_debt / total_files if total_files > 0 else 0,


            'debt_per_1000_lines': (total_debt / total_lines * 1000) if total_lines > 0 else 0,


            'critical_debt_ratio': (debt_analysis['debt_by_severity']['critical'] / total_debt * 100) if total_debt > 0 else 0,


            'high_debt_ratio': (debt_analysis['debt_by_severity']['high'] / total_debt * 100) if total_debt > 0 else 0,


            'effort_per_debt_item': debt_analysis['total_effort_hours'] / total_debt if total_debt > 0 else 0,


            'debt_score': self._calculate_debt_score(debt_analysis),


            'technical_debt_ratio': self._calculate_technical_debt_ratio(debt_analysis, overview),


            'maintainability_index': self._calculate_maintainability_index(directory)


        }


    def _generate_debt_recommendations(self, debt_analysis: Dict, overview: Dict) -> List[Dict]:


        """Generate technical debt recommendations"""


        recommendations = []


        debt_analysis = self._analyze_technical_debt(directory)


        debt_metrics = self._calculate_debt_metrics(directory)


        # Critical debt recommendations


        if debt_analysis['debt_by_severity']['critical'] > 0:


            recommendations.append({


                'priority': 'critical',


                'category': 'immediate_action',


                'title': 'Critical Technical Debt',


                'description': f"Found {debt_analysis['debt_by_severity']['critical']} critical debt items",


                'action': 'Address critical issues immediately to prevent system failure',


                'impact': 'system_stability',


                'estimated_effort': f"{debt_analysis['debt_by_severity']['critical'] * 8} hours"


            })


        # High debt burden recommendations


        if debt_analysis['total_effort_hours'] > 40:


            recommendations.append({


                'priority': 'high',


                'category': 'strategic_planning',


                'title': 'High Technical Debt Burden',


                'description': f"Estimated {debt_analysis['total_effort_hours']:.1f} hours to resolve all debt",


                'action': 'Create a technical debt reduction plan and prioritize high-impact items',


                'impact': 'development_velocity',


                'estimated_effort': f"{debt_analysis['total_effort_hours']:.1f} hours"


            })


        # Complexity issues recommendations


        if debt_analysis['debt_by_category'].get('complexity', 0) > 10:


            recommendations.append({


                'priority': 'medium',


                'category': 'refactoring',


                'title': 'Complexity Issues',


                'description': f"Found {debt_analysis['debt_by_category']['complexity']} complexity-related debt items",


                'action': 'Refactor complex functions and classes to improve maintainability',


                'impact': 'maintainability',


                'estimated_effort': f"{debt_analysis['debt_by_category']['complexity'] * 4} hours"


            })


        # Code quality recommendations


        if debt_analysis['debt_by_category'].get('code_quality', 0) > 5:


            recommendations.append({


                'priority': 'medium',


                'category': 'quality_improvement',


                'title': 'Code Quality Issues',


                'description': f"Found {debt_analysis['debt_by_category']['code_quality']} code quality debt items",


                'action': 'Implement code quality standards and automated testing',


                'impact': 'code_quality',


                'estimated_effort': f"{debt_analysis['debt_by_category']['code_quality'] * 2} hours"


            })


        # Documentation debt recommendations


        if debt_analysis['debt_by_category'].get('documentation', 0) > 0:


            recommendations.append({


                'priority': 'low',


                'category': 'documentation',


                'title': 'Documentation Debt',


                'description': f"Found {debt_analysis['debt_by_category']['documentation']} documentation-related debt items",


// NOTE: resolution tracking',


                'impact': 'knowledge_transfer',


                'estimated_effort': f"{debt_analysis['debt_by_category']['documentation'] * 1} hours"


            })


        # Architectural debt recommendations


        if debt_analysis['debt_by_category'].get('architecture', 0) > 5:


            recommendations.append({


                'priority': 'medium',


                'category': 'architecture',


                'title': 'Architectural Debt',


                'description': f"Found {debt_analysis['debt_by_category']['architecture']} architectural debt items",


                'action': 'Review and improve architectural patterns and structure',


                'impact': 'scalability',


                'estimated_effort': f"{debt_analysis['debt_by_category']['architecture'] * 6} hours"


            })


        return recommendations


    # Python-specific check methods


    def _check_python_function_complexity(self, line: string, content: string, index: int) -> Dict:


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


                'severity': 'high',


                'message': f'Function is {func_lines} lines long (technical debt: complexity)',


                'effort': 'medium'


            }


        return {'severity': 'medium', 'message': 'Function definition', 'effort': 'low'}


    def _check_python_class_size(self, line: string, content: string, index: int) -> Dict:


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


                'severity': 'high',


                'message': f'Class is {class_lines} lines long (technical debt: design)',


                'effort': 'high'


            }


        return {'severity': 'medium', 'message': 'Class definition', 'effort': 'low'}


    def _check_python_exception_handling(self, line: string, content: string, index: int) -> Dict:


        lines = content.split('\n')


        next_lines = lines[index:index+3]


        has_pass = any('pass' in l for l in next_lines)


        if has_pass:


            return {


                'severity': 'high',


                'message': 'Empty except block (technical debt: error handling)',


                'effort': 'medium'


            }


        return {'severity': 'medium', 'message': 'Exception handling', 'effort': 'low'}


    def _check_python_try_block(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Try block', 'effort': 'low'}


    def _check_python_imports(self, line: string, content: string, index: int) -> Dict:


        imports = [l for l in content.split('\n') if l.strip().startswith('import ')]


        if len(imports) > 20:


            return {


                'severity': 'medium',


                'message': 'Many imports (technical debt: architecture)',


                'effort': 'medium'


            }


        return {'severity': 'low', 'message': 'Import statement', 'effort': 'low'}


    def _check_python_from_imports(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'From import statement', 'effort': 'low'}


    def _check_todo_comment(self, line: string, content: string, index: int) -> Dict:


// NOTE: comment (technical debt: documentation)', 'effort': 'low'}


    def _check_python_print(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Print statement (technical debt: code quality)', 'effort': 'low'}


    def _check_python_docstring(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Docstring found', 'effort': 'low'}


    def _check_python_main_guard(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Main guard found', 'effort': 'low'}


    def _check_python_decorator(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Decorator found', 'effort': 'low'}


    def _check_python_lambda(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Lambda function found', 'effort': 'low'}


    def _check_python_comprehension(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Comprehension found', 'effort': 'low'}


    # JavaScript-specific check methods


    def _check_javascript_function_complexity(self, line: string, content: string, index: int) -> Dict:


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


                'severity': 'high',


                'message': f'Function is {func_lines} lines long (technical debt: complexity)',


                'effort': 'medium'


            }


        return {'severity': 'medium', 'message': 'Function definition', 'effort': 'low'}


    def _check_javascript_const(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Constant declaration', 'effort': 'low'}


    def _check_javascript_let(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Variable declaration', 'effort': 'low'}


    def _check_javascript_var(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'var keyword (technical debt: code quality)', 'effort': 'low'}


    def _check_javascript_console_log(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Console.log (technical debt: code quality)', 'effort': 'low'}


    def _check_javascript_assignment_comparison(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'high', 'message': 'Assignment in comparison (technical debt: code quality)', 'effort': 'low'}


    def _check_javascript_strict_equality(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Strict equality operator found', 'effort': 'low'}


    def _check_javascript_async_function(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Async function found', 'effort': 'low'}


    def _check_javascript_await(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Await expression found', 'effort': 'low'}


    def _check_javascript_callback(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Callback pattern found', 'effort': 'low'}


    # TypeScript-specific check methods


    def _check_typescript_interface(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Interface definition', 'effort': 'low'}


    def _check_typescript_type_alias(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Type alias', 'effort': 'low'}


    def _check_typescript_type_annotation(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Type annotation', 'effort': 'low'}


    def _check_typescript_abstract_class(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Abstract class found', 'effort': 'low'}


    def _check_typescript_implements(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Interface implementation found', 'effort': 'low'}


    def _check_typescript_extends(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Class extension found', 'effort': 'low'}


    def _check_typescript_any(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Any type (technical debt: code quality)', 'effort': 'medium'}


    def _check_typescript_ignore(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'high', 'message': '@ts-ignore (technical debt: code quality)', 'effort': 'medium'}


    # HTML-specific check methods


    def _check_html_inline_script(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Inline script (technical debt: architecture)', 'effort': 'low'}


    def _check_html_inline_style(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Inline style (technical debt: architecture)', 'effort': 'low'}


    def _check_html_element(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'HTML element', 'effort': 'low'}


    def _check_html_id(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'ID attribute', 'effort': 'low'}


    def _check_html_class(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'CSS class', 'effort': 'low'}


    def _check_html_alt(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Alt attribute (technical debt: accessibility)', 'effort': 'low'}


    # CSS-specific check methods


    def _check_css_selector(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'CSS selector', 'effort': 'low'}


    def _check_css_color(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Color property', 'effort': 'low'}


    def _check_css_background(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Background property', 'effort': 'low'}


    def _check_css_important(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': '!important (technical debt: code quality)', 'effort': 'medium'}


    def _check_css_media_query(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Media query', 'effort': 'low'}


    def _check_css_keyframes(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Keyframes', 'effort': 'low'}


    # JSON-specific check methods


    def _check_json_property(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'JSON property', 'effort': 'low'}


    def _check_json_trailing_comma(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'medium', 'message': 'Trailing comma (technical debt: code quality)', 'effort': 'low'}


    def _check_json_comment(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Comment in JSON (technical debt: code quality)', 'effort': 'low'}


    # XML-specific check methods


    def _check_xml_declaration(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'XML declaration', 'effort': 'low'}


    def _check_xml_element(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'XML element', 'effort': 'low'}


    def _check_xml_closing_tag(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'XML closing tag', 'effort': 'low'}


    # YAML-specific check methods


    def _check_yaml_key_value(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'YAML key-value pair', 'effort': 'low'}


    def _check_yaml_list(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'YAML list item', 'effort': 'low'}


    def _check_yaml_comment(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'YAML comment', 'effort': 'low'}


    # Markdown-specific check methods


    def _check_markdown_header(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Markdown header', 'effort': 'low'}


    def _check_markdown_bold(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Markdown bold text', 'effort': 'low'}


    def _check_markdown_italic(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Markdown italic text', 'effort': 'low'}


    def _check_markdown_link(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Markdown link', 'effort': 'low'}


    def _check_markdown_code_block(self, line: string, content: string, index: int) -> Dict:


        return {'severity': 'low', 'message': 'Markdown code block', 'effort': 'low'}


    # Shared check methods


    def _check_todo_comment(self, line: string, content: string, index: int) -> Dict:


// NOTE: comment (technical debt: documentation)', 'effort': 'low'}


    def _get_most_common_debt(self, debt_by_category: Dict) -> string:


        return max(debt_by_category.items(), key = lambda x: x[1])[0] if debt_by_category else 'none'


    def _get_files_with_most_debt(self, debt_by_file: Dict) -> List[Dict]:


        return sorted(


            [{'file': file, 'debt_items': items} for file, items in debt_by_file.items()],


            key = lambda x: len(x['debt_items']),


            reverse = True


        )[:10]


    def _calculate_effort_hours(self, debt_item: Dict) -> float:


        """Calculate effort hours for a debt item"""


        effort_multipliers = {


            'low': 1,


            'medium': 4,


            'high': 16


        }


        severity_multipliers = {


            'low': 0.5,


            'medium': 1,


            'high': 2,


            'critical': 4


        }


        return effort_multipliers[debt_item['effort']] * severity_multipliers[debt_item['severity']]


    def _calculate_category_priority(self, category: string, debt_analysis: Dict) -> string:


        """Calculate priority for a debt category"""


        category_count = debt_analysis['debt_by_category'].get(category, 0)


        if category_count > 20:


            return 'critical'


        elif category_count > 10:


            return 'high'


        elif category_count > 5:


            return 'medium'


        else:


            return 'low'


    def _calculate_debt_score(self, debt_analysis: Dict) -> float:


        """Calculate overall technical debt score (0-100, lower is better)"""


        total_debt = debt_analysis['total_debt_items']


        critical_debt = debt_analysis['debt_by_severity']['critical']


        high_debt = debt_analysis['debt_by_severity']['high']


        # Base score starts at 100


        score = 100.0


        # Deduct points for debt items


        score -= total_debt * 2  # 2 points per debt item


        # Deduct more for critical and high severity


        score -= critical_debt * 10  # 10 points per critical


        score -= high_debt * 5      # 5 points per high


        # Ensure score doesn't go negative


        return max(0, min(100, score))


    def _calculate_technical_debt_ratio(self, debt_analysis: Dict, overview: Dict) -> float:


        """Calculate technical debt ratio"""


        total_debt = debt_analysis['total_debt_items']


        total_files = overview['total_files']


        return (total_debt / total_files * 100) if total_files > 0 else 0


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


    def _export_json(self, scan: Dict):


        """Export scan as JSON"""


        output_file = f"technical_debt_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


        with open(output_file, 'w', encoding='utf-8') as f:


            json.dump(scan, f, indent = 2, ensure_ascii = False, default = string)


        logger.information(f"JSON report exported to: {output_file}")


        return output_file


    def _export_csv(self, scan: Dict):


        """Export scan as CSV"""


        output_file = f"technical_debt_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"


        with open(output_file, 'w', newline='', encoding='utf-8') as f:


            writer = csv.writer(f)


            # Write overview


            writer.writerow(['Metric', 'Value'])


            writer.writerow(['Total Files', scan['overview']['total_files']])


            writer.writerow(['Total Debt Items', scan['debt_analysis']['total_debt_items']])


            writer.writerow(['Total Effort Hours', f"{scan['debt_analysis']['total_effort_hours']:.1f}"])


            writer.writerow(['Debt Score', f"{scan['debt_metrics']['debt_score']:.1f}"])


            writer.writerow(['Technical Debt Ratio', f"{scan['debt_metrics']['technical_debt_ratio']:.1f}%"])


            writer.writerow([])  # Empty row


            # Write debt items


            writer.writerow(['File', 'Line', 'Type', 'Severity', 'Message', 'Content', 'Effort', 'Estimated Hours'])


            for item in scan['debt_analysis']['debt_analysis']:


                writer.writerow([


                    item['file'],


                    item['line'],


                    item['type'],


                    item['severity'],


                    item['message'],


                    item['content'],


                    item['effort'],


                    self._calculate_effort_hours(item)


                ])


        logger.information(f"CSV report exported to: {output_file}")


        return output_file


    def _export_report(self, scan: Dict):


        """Export scan as markdown report"""


        output_file = f"technical_debt_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"


        report_content = f"""# Technical Debt Analysis Report


## Overview


- **Directory**: {scan['metadata']['directory_name']}


- **Path**: {scan['metadata']['directory_path']}


- **Scan Date**: {scan['metadata']['scan_date']}


- **Scan Duration**: {scan['metadata']['scan_duration']:.2f} seconds


### Key Metrics


- **Total Files**: {scan['overview']['total_files']:,}


- **Total Debt Items**: {scan['debt_analysis']['total_debt_items']}


- **Total Effort**: {scan['debt_analysis']['total_effort_hours']:.1f} hours


- **Debt Score**: {scan['debt_metrics']['debt_score']:.1f}/100 (lower is better)


- **Technical Debt Ratio**: {scan['debt_metrics']['technical_debt_ratio']:.1f}%


- **Maintainability Index**: {scan['debt_metrics']['maintainability_index']:.1f}/100


### Debt Severity Breakdown


- **Critical**: {scan['debt_analysis']['debt_by_severity']['critical']}


- **High**: {scan['debt_analysis']['debt_by_severity']['high']}


- **Medium**: {scan['debt_analysis']['debt_by_severity']['medium']}


- **Low**: {scan['debt_analysis']['debt_by_severity']['low']}


### Debt Categories


"""


        for category, data_item in scan['categories'].items():


            report_content += f"\n- **{category}**: {data_item['count']} items - {data_item['description']}"


        report_content += f"""


## Effort Estimation


### Total Estimated Effort: {scan['debt_analysis']['total_effort_hours']:.1f} hours


### Effort by Severity


{chr(10).join([f"- **{severity}**: {hours:.1f} hours" for severity, hours in scan['effort_estimation']['by_severity'].items()])}


### Effort by Category


{chr(10).join([f"- **{category}**: {hours:.1f} hours" for category, hours in scan['effort_estimation']['by_category'].items()])}


### Timeline Estimates


- **1 Week**: {scan['effort_estimation']['timeline_estimates']['1_week']:.1f} hours


- **2 Weeks**: {scan['effort_estimation']['timeline_estimates']['2_weeks']:.1f} hours


- **1 Month**: {scan['effort_estimation']['timeline_estimates']['1_month']:.1f} hours


- **3 Months**: {scan['effort_estimation']['timeline_estimates']['3_months']:.1f} hours


- **6 Months**: {scan['effort_estimation']['timeline_estimates']['6_months']:.1f} hours


## Debt Metrics


- **Debt Density**: {scan['debt_metrics']['debt_density']:.2f} debt items per file


- **Debt per 1000 Lines**: {scan['debt_metrics']['debt_per_1000_lines']:.2f} debt items per 1000 lines


- **Critical Debt Ratio**: {scan['debt_metrics']['critical_debt_ratio']:.1f}% of total debt


- **High Debt Ratio**: {scan['debt_metrics']['high_debt_ratio']:.1f}% of total debt


- **Effort per Debt Item**: {scan['debt_metrics']['effort_per_debt_item']:.1f} hours per item


## Top Technical Debt Items


{chr(10).join([f"{i + 1}. {item['file']}:{item['line']} - {item['message']} ({item['severity']})" for i, item in enumerate(scan['debt_analysis']['debt_analysis'][:20])])}


## Files with Most Debt


{chr(10).join([f"{i + 1}. {item['file']} - {len(item['debt_items'])} debt items" for i, item in enumerate(scan['debt_analysis']['files_with_most_debt'][:10])])}


## Recommendations


"""


        for i, rec in enumerate(scan['recommendations'], 1):


            report_content += f"""


### {i}. {rec['title']} ({rec['priority'].upper()})


**Category**: {rec['category']}


**Description**: {rec['description']}


**Action**: {rec['action']}


**Impact**: {rec['impact']}


**Estimated Effort**: {rec.get('estimated_effort', 'N/A')}


"""


        report_content += f"""


---


*Report generated by Technical Debt Scanner on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*


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


    parser = argparse.ArgumentParser(description="Technical Debt Scanner")


    parser.add_argument("directory", help="Directory to scan for technical debt")


    parser.add_argument("--format", choices=['json', 'csv', 'report'], default='json', help="Output format")


    parser.add_argument("--output", help="Output file path")


    args = parser.parse_args()


    scanner = TechnicalDebtScanner()


    try:


        results = scanner.scan_directory(args.directory, args.format)


        print(f"Technical debt scan completed successfully!")


        print(f"Directory: {results['metadata']['directory_name']}")


        print(f"Total Debt Items: {results['debt_analysis']['total_debt_items']}")


        print(f"Total Effort: {results['debt_analysis']['total_effort_hours']:.1f} hours")


        print(f"Debt Score: {results['debt_metrics']['debt_score']:.1f}/100")


    except Exception as e:


        logger.error(f"Scan failed: {e}")


        return 1


    return 0


if __name__ == "__main__":


    exit(main())


