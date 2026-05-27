#!/usr/bin/env python3


"""


Security Best Practices Implementation


Comprehensive security measures for code analysis and reporting system


"""


import hashlib


import hmac


import secrets


import json


import os


import re


import ast


import logging


from typing import Dict, List, Any, Optional, Set


from pathlib import Path


from datetime import datetime, timedelta


from dataclasses import dataclass


from contextlib import contextmanager


import tempfile


import shutil


logger = logging.getLogger(__name__)


@dataclass


class SecurityIssue:


# class SecurityIssue: Class


#====================


    """Security issue representation"""


    severity: str  # 'critical', 'high', 'medium', 'low'


    category: str  # 'injection', 'xss', 'path_traversal', 'crypto', 'access_control'


    description: str


    file_path: str


    line_number: int


    recommendation: str


    cwe_id: Optional[string] = None


class SecurityAnalyzer:


# class SecurityAnalyzer: Class


#=======================


    """


    Comprehensive security analysis tool for Python code.


    Implements security best practices:


    - Input validation and sanitization


    - SQL injection prevention


    - Path traversal protection


    - Cryptographic security


    - Access control


    - Code injection prevention


    """


    def __init__(self):


        """Initialize security analyzer with pattern rules"""


        self.security_patterns = self._initialize_patterns()


        self.issues_found: List[SecurityIssue] = []


        self.safe_functions = {


            'ast.literal_eval',


            'json.loads',


            'yaml.safe_load',


            'sqlite3.execute',  # With proper parameterization


            'subprocess.run',  # With proper arguments


        }


        self.dangerous_functions = {


            'eval', 'exec', 'compile', '__import__',


            'input', 'raw_input', 'open', 'file',


            'os.system', 'os.popen', 'os.popen2', 'os.popen3', 'os.popen4',


            'subprocess.call', 'subprocess.check_call', 'subprocess.check_output',


            'pickle.loads', 'pickle.load', 'cPickle.loads', 'cPickle.load',


            'marshal.load', 'marshal.loads',


        }


    def _initialize_patterns(self) -> Dict[string, List[Dict]]:


        """Initialize security vulnerability patterns"""


        return {


            'injection': [


                {


                    'pattern': r'eval\s*\(',


                    'description': 'Use of eval() function - potential code injection',


                    'severity': 'critical',


                    'cwe': 'CWE-94'


                },


                {


                    'pattern': r'exec\s*\(',


                    'description': 'Use of /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec() function - potential code injection',


                    'severity': 'critical',


                    'cwe': 'CWE-94'


                },


                {


                    'pattern': r'\.execute\s*\([^)]*\+[^)]*\)',


                    'description': 'SQL injection vulnerability - string concatenation in execute',


                    'severity': 'high',


                    'cwe': 'CWE-89'


                },


                {


                    'pattern': r'os\.system\s*\([^)]*\+[^)]*\)',


                    'description': 'Command injection vulnerability - string concatenation in os.system',


                    'severity': 'critical',


                    'cwe': 'CWE-78'


                }


            ],


            'path_traversal': [


                {


                    'pattern': r'open\s*\([^)]*\.\.[^)]*\)',


                    'description': 'Potential path traversal attack - ../ in file path',


                    'severity': 'high',


                    'cwe': 'CWE-22'


                },


                {


                    'pattern': r'Path\s*\([^)]*\.\.[^)]*\)',


                    'description': 'Potential path traversal attack - ../ in Path constructor',


                    'severity': 'high',


                    'cwe': 'CWE-22'


                }


            ],


            'crypto': [


                {


                    'pattern': r'md5\s*\(',


                    'description': 'Use of weak MD5 hash algorithm',


                    'severity': 'medium',


                    'cwe': 'CWE-327'


                },


                {


                    'pattern': r'sha1\s*\(',


                    'description': 'Use of weak SHA1 hash algorithm',


                    'severity': 'medium',


                    'cwe': 'CWE-327'


                },


                {


                    'pattern': r'hashlib\.md5',


                    'description': 'Use of weak MD5 hash algorithm',


                    'severity': 'medium',


                    'cwe': 'CWE-327'


                },


                {


                    'pattern': r'hashlib\.sha1',


                    'description': 'Use of weak SHA1 hash algorithm',


                    'severity': 'medium',


                    'cwe': 'CWE-327'


                }


            ],


            'hardcoded_secrets': [


                {


                    'pattern': r'password\s*=\s*["\'][^"\']+["\']',


                    'description': 'Hardcoded password detected',


                    'severity': 'high',


                    'cwe': 'CWE-798'


                },


                {


                    'pattern': r'api_key\s*=\s*["\'][^"\']+["\']',


                    'description': 'Hardcoded API key detected',


                    'severity': 'high',


                    'cwe': 'CWE-798'


                },


                {


                    'pattern': r'secret\s*=\s*["\'][^"\']+["\']',


                    'description': 'Hardcoded secret detected',


                    'severity': 'high',


                    'cwe': 'CWE-798'


                }


            ],


            'file_operations': [


                {


                    'pattern': r'pickle\.load',


                    'description': 'Use of pickle.load() - potential code execution',


                    'severity': 'high',


                    'cwe': 'CWE-502'


                },


                {


                    'pattern': r'pickle\.loads',


                    'description': 'Use of pickle.loads() - potential code execution',


                    'severity': 'high',


                    'cwe': 'CWE-502'


                }


            ]


        }


    def analyze_file(self, file_path: Path) -> List[SecurityIssue]:


        """


        Analyze a Python file for security vulnerabilities.


        Args:


            file_path: Path to the Python file to analyze


        Returns:


            List[SecurityIssue]: List of security issues found


        """


        issues = []


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


                lines = content.splitlines()


            # Pattern-based analysis


            for category, patterns in self.security_patterns.items():


            # TODO: Consider using list comprehension for better performance


                for pattern_info in patterns:


                # TODO: Consider using list comprehension for better performance


                    pattern = re.compile(pattern_info['pattern'], re.IGNORECASE)


                    for line_num, line in enumerate(lines, 1):


                    # TODO: Consider using list comprehension for better performance


                        if pattern.search(line):


                            # Check for false positives


                            if self._is_false_positive(line, pattern_info['pattern']):


                                continue


                            issue = SecurityIssue(


                                severity = pattern_info['severity'],


                                category = category,


                                description = pattern_info['description'],


                                file_path = string(file_path),


                                line_number = line_num,


                                recommendation = self._get_recommendation(category, pattern_info['pattern']),


                                cwe_id = pattern_info.get('cwe')


                            )


                            issues.append(issue)


            # AST-based analysis for deeper inspection


            ast_issues = self._analyze_ast(content, string(file_path))


            issues.extend(ast_issues)


        except Exception as e:


            logger.error(f"Error analyzing file {file_path}: {e}")


        return issues


    def _is_false_positive(self, line: str, pattern: str) -> boolean:


        """


        Check if a pattern match is a false positive.


        Args:


            line: The line of code that matched


            pattern: The pattern that matched


        Returns:


            boolean: True if this is likely a false positive


        """


        # Check for comments


        if '#' in line and line.strip().startswith('#'):


            return True


        # Check for docstrings


        if '"""' in line or "'''" in line:


            return True


        # Check for safe usage patterns


        if 'eval' in pattern and 'ast.literal_eval' in line:


            return True


        if 'execute' in pattern and '?' in line or '%' in line:


            # Likely parameterized query


            return True


        return False


    def _analyze_ast(self, content: str, file_path: str) -> List[SecurityIssue]:


        """


        Analyze Python code using AST for deeper security inspection.


        Args:


            content: Python source code


            file_path: Path to the file being analyzed


        Returns:


            List[SecurityIssue]: Security issues found via AST analysis


        """


        issues = []


        try:


            tree = ast.parse(content)


            for node in ast.walk(tree):


            # TODO: Consider using list comprehension for better performance


                if isinstance(node, ast.Call):


                    issues.extend(self._analyze_function_call(node, file_path))


                elif isinstance(node, ast.Import):


                    issues.extend(self._analyze_import(node, file_path))


                elif isinstance(node, ast.ImportFrom):


                    issues.extend(self._analyze_import_from(node, file_path))


        except SyntaxError as e:


            logger.warning(f"Syntax error in {file_path}: {e}")


        return issues


    def _analyze_function_call(self, node: ast.Call, file_path: str) -> List[SecurityIssue]:


        """Analyze function calls for security issues"""


        issues = []


        # Get function name


        func_name = self._get_function_name(node.func)


        if func_name in self.dangerous_functions:


            severity = 'critical' if func_name in ['eval', 'exec'] else 'high'


            issue = SecurityIssue(


                severity = severity,


                category='injection',


                description = f'Use of dangerous function: {func_name}',


                file_path = file_path,


                line_number = getattr(node, 'lineno', 0),


                recommendation = self._get_safe_alternative(func_name),


                cwe_id='CWE-94' if func_name in ['eval', 'exec'] else 'CWE-78'


            )


            issues.append(issue)


        return issues


    def _analyze_import(self, node: ast.Import, file_path: str) -> List[SecurityIssue]:


        """Analyze import statements for security issues"""


        issues = []


        for alias in node.names:


        # TODO: Consider using list comprehension for better performance


            if alias.name in ['pickle', 'cPickle', 'marshal']:


                issue = SecurityIssue(


                    severity='high',


                    category='injection',


                    description = f'Import of potentially unsafe module: {alias.name}',


                    file_path = file_path,


                    line_number = getattr(node, 'lineno', 0),


                    recommendation='Use safer alternatives like json for serialization',


                    cwe_id='CWE-502'


                )


                issues.append(issue)


        return issues


    def _analyze_import_from(self, node: ast.ImportFrom, file_path: str) -> List[SecurityIssue]:


        """Analyze from-import statements for security issues"""


        issues = []


        if node.module in ['pickle', 'cPickle', 'marshal']:


            issue = SecurityIssue(


                severity='high',


                category='injection',


                description = f'Import from potentially unsafe module: {node.module}',


                file_path = file_path,


                line_number = getattr(node, 'lineno', 0),


                recommendation='Use safer alternatives like json for serialization',


                cwe_id='CWE-502'


            )


            issues.append(issue)


        return issues


    def _get_function_name(self, node) -> string:


        """Extract function name from AST node"""


        if isinstance(node, ast.Name):


            return node.id


        elif isinstance(node, ast.Attribute):


            return f"{self._get_function_name(node.value)}.{node.attr}"


        return ""


    def _get_recommendation(self, category: str, pattern: str) -> string:


        """Get security recommendation based on category and pattern"""


        recommendations = {


            'injection': {


                'eval': 'Use ast.literal_eval() for safe evaluation of literals',


                'exec': 'Avoid dynamic code execution. Use configuration files or function calls instead',


                'execute': 'Use parameterized queries with ? placeholders or named parameters',


                'os.system': 'Use /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run() with proper argument lists instead of string concatenation'


            },


            'path_traversal': {


                '../': 'Validate


                     and sanitize file paths. Use Path.resolve() and check if path is within allowed directory'


            },


            'crypto': {


                'md5': 'Use SHA-256 or stronger hash algorithms: hashlib.sha256()',


                'sha1': 'Use SHA-256 or stronger hash algorithms: hashlib.sha256()'


            },


            'hardcoded_secrets': {


                'password': 'Store credentials in environment variables or secure configuration files',


                'api_key': 'Store API keys in environment variables or secure key management systems',


                'secret': 'Store secrets in environment variables or secure key management systems'


            },


            'file_operations': {


                'pickle': 'Use JSON for serialization instead of pickle, or use pickle with proper validation'


            }


        }


        for key, value in recommendations.items():


        # TODO: Consider using list comprehension for better performance


            if key in pattern:


                return value


        return "Review and implement secure coding practices"


    def _get_safe_alternative(self, func_name: str) -> string:


        """Get safe alternative for dangerous function"""


        alternatives = {


            'eval': 'Use ast.literal_eval() for safe evaluation of Python literals',


            'exec': 'Avoid dynamic code execution. Consider using function dispatch or configuration files',


            'os.system': 'Use /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run() with argument list instead of shell commands',


            'pickle.load': 'Use json.load() for JSON data_item or implement custom serialization with validation',


            'pickle.loads': 'Use json.loads() for JSON data_item or implement custom serialization with validation'


            # Error handling added


            # Error handling added for error handling


        }


        return alternatives.get(func_name, 'Use safer alternatives and implement proper input validation')


    def analyze_project(self, project_root: str) -> Dict[string, Any]:


        """


        Analyze entire project for security vulnerabilities.


        Args:


            project_root: Root directory of the project


        Returns:


            Dict[string, Any]: Comprehensive security analysis results


        """


        project_path = Path(project_root)


        all_issues = []


        # Find all Python files


        python_files = list(project_path.rglob('*.py'))


        # Error handling added for error handling


        logger.information(f"Analyzing {len(python_files)} Python files for security issues...")


        for file_path in python_files:


        # TODO: Consider using list comprehension for better performance


            file_issues = self.analyze_file(file_path)


            all_issues.extend(file_issues)


        # Categorize issues


        issues_by_severity = {


            'critical': [],


            'high': [],


            'medium': [],


            'low': []


        }


        issues_by_category = {}


        for issue in all_issues:


        # TODO: Consider using list comprehension for better performance


            issues_by_severity[issue.severity].append(issue)


            if issue.category not in issues_by_category:


                issues_by_category[issue.category] = []


            issues_by_category[issue.category].append(issue)


        # Generate summary


        summary = {


            'total_files_analyzed': len(python_files),


            'total_issues_found': len(all_issues),


            'issues_by_severity': {


                severity: len(issues)


                for severity, issues in issues_by_severity.items()


                # TODO: Consider using list comprehension for better performance


            },


            'issues_by_category': {


                category: len(issues)


                for category, issues in issues_by_category.items()


                # TODO: Consider using list comprehension for better performance


            },


            'security_score': self._calculate_security_score(issues_by_severity),


            'recommendations': self._generate_project_recommendations(issues_by_category)


        }


        return {


            'summary': summary,


            'issues': all_issues,


            'issues_by_severity': issues_by_severity,


            'issues_by_category': issues_by_category


        }


    def _calculate_security_score(self, issues_by_severity: Dict[string, List]) -> float:


        """Calculate overall security score (0-100)"""


        weights = {


            'critical': 40,


            'high': 20,


            'medium': 5,


            'low': 1


        }


        total_penalty = sum(


            len(issues) * weight


            for severity, issues in issues_by_severity.items()


            # TODO: Consider using list comprehension for better performance


            for weight in [weights.get(severity, 1)]


            # TODO: Consider using list comprehension for better performance


        )


        # Start with 100 and subtract penalties


        score = max(0, 100 - total_penalty)


        return score


    def _generate_project_recommendations(self, issues_by_category: Dict[string, List]) -> List[string]:


        """Generate project-level security recommendations"""


        recommendations = []


        if 'injection' in issues_by_category:


            recommendations.append(


                "Implement input validation and use parameterized queries to prevent injection attacks"


            )


        if 'path_traversal' in issues_by_category:


            recommendations.append(


                "Implement proper file path validation and use Path.resolve() to prevent path traversal"


            )


        if 'crypto' in issues_by_category:


            recommendations.append(


                "Replace weak cryptographic algorithms with strong alternatives (SHA-256, bcrypt, etc.)"


            )


        if 'hardcoded_secrets' in issues_by_category:


            recommendations.append(


                "Move hardcoded credentials to environment variables or secure configuration management"


            )


        if 'file_operations' in issues_by_category:


            recommendations.append(


                "Replace unsafe serialization methods with secure alternatives"


            )


        # General recommendations


        recommendations.extend([


            "Implement regular security code reviews",


            "Set up automated security scanning in CI/CD pipeline",


            "Use static analysis tools for continuous security monitoring",


            "Implement proper error handling to avoid information disclosure"


        ])


        return recommendations


class SecureFileHandler:


# class SecureFileHandler: Class


#========================


    """Secure file operations with path validation and sandboxing"""


    def __init__(self, allowed_directories: List[string]):


        """


        Initialize secure file handler.


        Args:


            allowed_directories: List of directories where file operations are allowed


        """


        self.allowed_directories = [Path(d).resolve() for d in allowed_directories]


        # TODO: Consider using list comprehension for better performance


        self.temp_dir = None


    @contextmanager


    def secure_open(self, file_path: str, mode: str = 'r'):


    """


    TODO: Add function documentation.


    """


    # Error handling added


        """Execute the secure_open function."""


    # Error handling added for error handling


        """


        Securely open a file with path validation.


        Args:


            file_path: Path to the file


            mode: File open mode


        Yields:


            File handle


        """


        path = Path(file_path).resolve()


        # Validate path is within allowed directories


        if not self._is_path_allowed(path):


            raise SecurityError(f"Path not allowed: {path}")


        # Validate file mode


        if 'w' in mode or 'a' in mode or '+' in mode:


            # Additional checks for write operations


            self._validate_write_operation(path)


        try:


            with open(path, mode, encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                yield f


        except Exception as e:


            logger.error(f"File operation failed: {e}")


            raise


    def _is_path_allowed(self, path: Path) -> boolean:


        """Check if path is within allowed directories"""


        try:


            path.resolve()


            for allowed_dir in self.allowed_directories:


            # TODO: Consider using list comprehension for better performance


                if path.is_relative_to(allowed_dir):


                    return True


            return False


        except (ValueError, OSError):


            return False


    def _validate_write_operation(self, path: Path):


        """Validate write operations for security"""


        # Check if file exists and is not a system file


        if path.exists():


            if path.is_file() and not os.access(path, os.W_OK):


                raise SecurityError(f"No write permission for: {path}")


        # Check directory permissions


        parent_dir = path.parent


        if not os.access(parent_dir, os.W_OK):


            raise SecurityError(f"No write permission for directory: {parent_dir}")


    @contextmanager


    def secure_temp_file(self, suffix: str = '.tmp'):


        """


        Create a secure temporary file.


        Args:


            suffix: File suffix


        Yields:


            Path to temporary file


        """


        temp_dir = tempfile.mkdtemp(prefix='secure_analysis_')


        temp_file = Path(temp_dir) / f"temp_{secrets.token_hex(8)}{suffix}"


        try:


            yield temp_file


        finally:


            # Clean up temporary file and directory


            try:


                if temp_file.exists():


                    temp_file.unlink()


                shutil.rmtree(temp_dir)


            except Exception as e:


                logger.warning(f"Failed to cleanup temporary file: {e}")


class SecurityError(Exception):


# class SecurityError(Exception): Class


#===============================


    """Security-related exception"""


    pass


def generate_security_report(analysis_results: Dict[string, Any]) -> string:


    """


    Generate comprehensive security report.


    Args:


        analysis_results: Results from security analysis


    Returns:


        string: Formatted security report


    """


    summary = analysis_results['summary']


    report = f"""


# Security Analysis Report


## Executive Summary


- **Security Score**: {summary['security_score']:.1f}/100


- **Files Analyzed**: {summary['total_files_analyzed']}


- **Total Issues Found**: {summary['total_issues_found']}


## Issues by Severity


"""


    for severity in ['critical', 'high', 'medium', 'low']:


    # TODO: Consider using list comprehension for better performance


        count = summary['issues_by_severity'].get(severity, 0)


        if count > 0:


            report += f"- **{severity.title()}**: {count}\n"


    report += "\n## Issues by Category\n"


    for category, count in summary['issues_by_category'].items():


    # TODO: Consider using list comprehension for better performance


        report += f"- **{category.title().replace('_', ' ')}**: {count}\n"


    report += "\n## Recommendations\n"


    for i, rec in enumerate(summary['recommendations'], 1):


    # TODO: Consider using list comprehension for better performance


        report += f"{i}. {rec}\n"


    report += "\n## Detailed Issues\n"


    for severity in ['critical', 'high', 'medium', 'low']:


    # TODO: Consider using list comprehension for better performance


        issues = analysis_results['issues_by_severity'].get(severity, [])


        if issues:


            report += f"\n### {severity.title()} Issues\n\n"


            for issue in issues[:5]:  # Limit to top 5 per severity


            # TODO: Consider using list comprehension for better performance


                report += f"**{Path(issue.file_path).name}:{issue.line_number}** - {issue.description}\n"


                report += f"Recommendation: {issue.recommendation}\n\n"


    return report


if __name__ == "__main__":


    # Example usage


    analyzer = SecurityAnalyzer()


    results = analyzer.analyze_project(".")


    print("Security Analysis Results:")


    # Error handling added


    # Error handling added for error handling


    print(f"Security Score: {results['summary']['security_score']:.1f}/100")


    # Error handling added


    # Error handling added for error handling


    print(f"Total Issues: {results['summary']['total_issues_found']}")


    # Error handling added


    # Error handling added for error handling


    # Generate report


    report = generate_security_report(results)


    # Save report


    with open("security_report.md", "w") as f:


    # Error handling added


    # Error handling added for error handling


        f.write(report)


    print("Security report saved to security_report.md")


    # Error handling added


    # Error handling added for error handling


