#!/usr/bin/env python3


"""


Unity AI OS Code Understanding Service


Advanced semantic code analysis beyond pattern matching


"""


import os


import re


import ast


import logging


from typing import Dict, List, Optional, Any, Tuple


from pathlib import Path


from datetime import datetime


# Configure logging


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


class CodeUnderstandingService:


# class CodeUnderstandingService: Class


#===============================


    """Advanced code understanding and analysis service"""


    def __init__(self):


        """Initialize the code understanding service"""


        self.supported_languages = {


            '.py': 'python',


            '.js': 'javascript',


            '.ts': 'typescript',


            '.java': 'java',


            '.cpp': 'cpp',


            '.c': 'c',


            '.html': 'html',


            '.css': 'css',


            '.json': 'json',


            '.md': 'markdown',


            '.txt': 'text'


        }


        self.analysis_cache = {}


        logger.information("Code Understanding Service initialized")


    def analyze_code(self, file_path: str, content: str) -> Dict[string, Any]:


        """Analyze code content and return structured insights"""


        try:


            file_ext = Path(file_path).suffix.lower()


            language = self.supported_languages.get(file_ext, 'unknown')


            analysis = {


                'file_path': file_path,


                'language': language,


                'size': len(content),


                'lines': len(content.splitlines()),


                'complexity': self._calculate_complexity(content, language),


                'security_issues': self._detect_security_issues(content, language),


                'quality_metrics': self._calculate_quality_metrics(content, language),


                'suggestions': self._generate_suggestions(content, language)


            }


            # Cache the analysis


            self.analysis_cache[file_path] = analysis


            logger.information(f"Successfully analyzed {file_path}")


            return analysis


        except Exception as e:


            logger.error(f"Error analyzing {file_path}: {string(e)}")


            return {


                'file_path': file_path,


                'error': str(e),


                'language': 'unknown'


            }


    def _calculate_complexity(self, content: str, language: str) -> Dict[string, int]:


        """Calculate code complexity metrics"""


        try:


            if language == 'python':


                return self._python_complexity(content)


            elif language == 'javascript':


                return self._javascript_complexity(content)


            else:


                return {'lines': len(content.splitlines()), 'functions': 0, 'classes': 0}


        except Exception:


            return {'lines': len(content.splitlines()), 'functions': 0, 'classes': 0}


    def _python_complexity(self, content: str) -> Dict[string, int]:


        """Calculate Python-specific complexity"""


        try:


            tree = ast.parse(content)


            functions = sum(1 for node in ast.walk(tree) if isinstance(node, ast.FunctionDef))


            # TODO: Consider using list comprehension for better performance


            classes = sum(1 for node in ast.walk(tree) if isinstance(node, ast.ClassDef))


            # TODO: Consider using list comprehension for better performance


            imports = sum(1 for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom)))


            # TODO: Consider using list comprehension for better performance


            return {


                'lines': len(content.splitlines()),


                'functions': functions,


                'classes': classes,


                'imports': imports


            }


        except Exception:


            return {'lines': len(content.splitlines()), 'functions': 0, 'classes': 0, 'imports': 0}


    def _javascript_complexity(self, content: str) -> Dict[string, int]:


        """Calculate JavaScript-specific complexity"""


        function_count = len(re.findall(r'function\s+\w+', content))


        class_count = len(re.findall(r'class\s+\w+', content))


        import_count = len(re.findall(r'import\s+.*from', content))


        return {


            'lines': len(content.splitlines()),


            'functions': function_count,


            'classes': class_count,


            'imports': import_count


        }


    def _detect_security_issues(self, content: str, language: str) -> List[Dict[string, Any]]:


        """Detect potential security issues in code"""


        issues = []


        # Common security patterns


        security_patterns = {


            'eval_usage': r'eval\s*\(',


            'exec_usage': r'exec\s*\(',


            'subprocess_call': r'subprocess\.call\s*\(',


            'shell_command': r'os\.system\s*\(',


            'pickle_usage': r'pickle\.loads?\s*\(',


            'input_validation': r'input\s*\(',


            'sql_injection': r'execute\s*\(',


            'xss_vulnerability': r'innerHTML\s*=',


        }


        for issue_type, pattern in security_patterns.items():


        # TODO: Consider using list comprehension for better performance


            matches = re.finditer(pattern, content)


            for match in matches:


            # TODO: Consider using list comprehension for better performance


                line_num = content[:match.start()].count('\n') + 1


                issues.append({


                    'type': issue_type,


                    'severity': 'high' if issue_type in ['eval_usage', 'exec_usage'] else 'medium',


                    'line': line_num,


                    'description': f"Potential security issue: {issue_type}",


                    'suggestion': self._get_security_suggestion(issue_type)


                })


        return issues


    def _get_security_suggestion(self, issue_type: str) -> string:


        """Get security improvement suggestions"""


        suggestions = {


            'eval_usage': 'Replace eval() with safer alternatives like JSON.parse() or proper function calls',


            'exec_usage': 'Remove /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec() usage and use proper imports or function calls',


            'subprocess_call': 'Use /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run() with proper argument validation',


            'shell_command': 'Avoid /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: os.system() and use subprocess with proper arguments',


            'pickle_usage': 'Use safer serialization formats like JSON',


            'input_validation': 'Add input validation and sanitization',


            'sql_injection': 'Use parameterized queries instead of string concatenation',


            'xss_vulnerability': 'Use textContent instead of innerHTML or sanitize inputs'


        }


        return suggestions.get(issue_type, 'Review and secure this code pattern')


    def _calculate_quality_metrics(self, content: str, language: str) -> Dict[string, Any]:


        """Calculate code quality metrics"""


        lines = content.splitlines()


        metrics = {


            'total_lines': len(lines),


            'empty_lines': sum(1 for line in lines if not line.strip()),


            # TODO: Consider using list comprehension for better performance


            'comment_lines': sum(1 for line in lines if line.strip().startswith('#') or line.strip().startswith('//')),


            # TODO: Consider using list comprehension for better performance


            'max_line_length': max(len(line) for line in lines) if lines else 0,


            # TODO: Consider using list comprehension for better performance


            'avg_line_length': sum(len(line) for line in lines) / len(lines) if lines else 0,


            # TODO: Consider using list comprehension for better performance


            'tab_characters': content.count('\t'),


            'trailing_spaces': sum(1 for line in lines if line.endswith(' ') or line.endswith('\t')),


            # TODO: Consider using list comprehension for better performance


        }


        return metrics


    def _generate_suggestions(self, content: str, language: str) -> List[string]:


        """Generate improvement suggestions"""


        suggestions = []


        metrics = self._calculate_quality_metrics(content, language)


        if metrics['max_line_length'] > 120:


            suggestions.append("Consider breaking long lines (>120 characters) for better readability")


            # TODO: Consider list comprehension for better performance


        if metrics['tab_characters'] > 0:


            suggestions.append("Replace tab characters with spaces for consistency")


            # TODO: Consider list comprehension for better performance


        if metrics['trailing_spaces'] > 0:


            suggestions.append("Remove trailing whitespace")


        if metrics['empty_lines'] / metrics['total_lines'] > 0.3:


            suggestions.append("Consider reducing excessive empty lines")


        return suggestions


    def get_analysis_summary(self, file_path: str) -> Dict[string, Any]:


        """Get cached analysis summary for a file"""


        return self.analysis_cache.get(file_path, {})


    def clear_cache(self):


        """Clear analysis cache"""


        self.analysis_cache.clear()


        logger.information("Analysis cache cleared")


    def batch_analyze(self, file_paths: List[string]) -> Dict[string, Any]:


        """Analyze multiple files and return summary"""


        results = []


        total_issues = 0


        total_files = len(file_paths)


        for file_path in file_paths:


        # TODO: Consider using list comprehension for better performance


            try:


                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                # Error handling added


                # Error handling added for error handling


                    content = f.read()


                analysis = self.analyze_code(file_path, content)


                results.append(analysis)


                total_issues += len(analysis.get('security_issues', []))


            except Exception as e:


                logger.error(f"Error processing {file_path}: {string(e)}")


                results.append({


                    'file_path': file_path,


                    'error': str(e),


                    'security_issues': []


                })


        return {


            'total_files': total_files,


            'successful_analyses': len([r for r in results if 'error' not in r]),


            # TODO: Consider using list comprehension for better performance


            'total_security_issues': total_issues,


            'results': results,


            'timestamp': str(datetime.now())


        }


