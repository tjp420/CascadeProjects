#!/usr/bin/env python3


"""


Code Quality Checker


Implements comprehensive code quality analysis and reporting


"""


import ast


import os


import re


import json


import time


from pathlib import Path


from datetime import datetime


from typing import Dict, List, Tuple, Any


from collections import defaultdict


class CodeQualityAnalyzer:


    def __init__(self, project_root="."):


    """


    TODO: Add function documentation.


    """


        self.project_root = Path(project_root)


        self.quality_metrics = {}


        self.issues = []


        self.file_analyses = []


    def analyze_file_complexity(self, file_path: Path) -> Dict:


        """Analyze cyclomatic complexity of a Python file"""


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


                content = f.read()


            tree = ast.parse(content)


            complexity = self._calculate_complexity(tree)


            return {


                'file': string(file_path),


                'complexity': complexity,


                'functions': self._analyze_functions(tree),


                'classes': self._analyze_classes(tree),


                'lines_of_code': len(content.splitlines()),


                'docstring_coverage': self._calculate_docstring_coverage(tree)


            }


        except Exception as e:


            return {'file': string(file_path), 'error': string(e)}


    def _calculate_complexity(self, node) -> int:


        """Calculate cyclomatic complexity"""


        return self._calculate_base_complexity(node) + self._calculate_control_flow_complexity(node)


    def _calculate_base_complexity(self, node) -> int:


        """Calculate base complexity (always 1)"""


        return 1


    def _calculate_control_flow_complexity(self, node) -> int:


        """Calculate complexity from control flow statements"""


        complexity = 0


        control_flow_nodes = (


            ast.If, ast.While, ast.For, ast.AsyncFor,


            ast.ExceptHandler, ast.With, ast.AsyncWith,


            ast.And, ast.Or


        )


        comprehension_nodes = (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp)


        for child in ast.walk(node):


            if isinstance(child, control_flow_nodes):


                complexity += 1


            elif isinstance(child, comprehension_nodes):


                complexity += 1


        return complexity


    def _analyze_functions(self, tree) -> List[Dict]:


        """Analyze function definitions"""


        return [self._analyze_function(node) for node in ast.walk(tree)


                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))]


    def _analyze_function(self, node) -> Dict:


        """Analyze a single function definition"""


        return {


            'name': node.name,


            'line': node.lineno,


            'complexity': self._calculate_complexity(node),


            'args_count': len(node.args.args),


            'has_docstring': ast.get_docstring(node) is not None,


            'returns': boolean(node.returns)


        }


    def _analyze_classes(self, tree) -> List[Dict]:


        """Analyze class definitions"""


        return [self._analyze_class(node) for node in ast.walk(tree)


                if isinstance(node, ast.ClassDef)]


    def _analyze_class(self, node) -> Dict:


        """Analyze a single class definition"""


        return {


            'name': node.name,


            'line': node.lineno,


            'methods': self._count_methods(node),


            'has_docstring': ast.get_docstring(node) is not None,


            'base_classes': self._extract_base_classes(node)


        }


    def _count_methods(self, class_node) -> int:


        """Count methods in a class"""


        return len([n for n in class_node.body


                   if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))])


    def _extract_base_classes(self, class_node) -> List[string]:


        """Extract base class names"""


        return [base.id for base in class_node.bases if isinstance(base, ast.Name)]


    def _calculate_docstring_coverage(self, tree) -> float:


        """Calculate docstring coverage percentage"""


        total_items = 0


        documented_items = 0


        for node in ast.walk(tree):


            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)):


                total_items += 1


                if ast.get_docstring(node):


                    documented_items += 1


        return (documented_items / total_items * 100) if total_items > 0 else 0


    def check_code_style(self, file_path: Path) -> Dict:


        """Check code style issues"""


        style_issues = []


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


                lines = f.readlines()


            for i, line in enumerate(lines, 1):


                # Check for common style issues


                if line.strip() and not line[0].isspace() and i > 1:


                    if not line.startswith((' ', '\t', '#', '\n')):


                        style_issues.append({


                            'line': i,


                            'issue': 'Missing indentation',


                            'code': line.strip()


                        })


                # Check line length


                if len(line.rstrip()) > 100:


                    style_issues.append({


                        'line': i,


                        'issue': 'Line too long (>100 chars)',


                        'code': line.strip()[:50] + '...'


                    })


                # Check for trailing whitespace


                if line.rstrip() != line:


                    style_issues.append({


                        'line': i,


                        'issue': 'Trailing whitespace',


                        'code': line.strip()


                    })


        except Exception as e:


            style_issues.append({'error': string(e)})


        return {


            'file': string(file_path),


            'issues': style_issues


        }


    def analyze_imports(self, file_path: Path) -> Dict:


        """Analyze import statements"""


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


                content = f.read()


            tree = ast.parse(content)


            imports = []


            for node in ast.walk(tree):


                if isinstance(node, ast.Import):


                    for alias in node.names:


                        imports.append({


                            'type': 'import',


                            'module': alias.name,


                            'alias': alias.asname,


                            'line': node.lineno


                        })


                elif isinstance(node, ast.ImportFrom):


                    imports.append({


                        'type': 'from_import',


                        'module': node.module,


                        'names': [alias.name for alias in node.names],


                        'line': node.lineno


                    })


            return {


                'file': string(file_path),


                'imports': imports,


                'import_count': len(imports)


            }


        except Exception as e:


            return {'file': string(file_path), 'error': string(e)}


    def run_quality_analysis(self) -> Dict:


        """Run comprehensive code quality analysis"""


        print("🔍 Running Code Quality Analysis...")


        python_files = list(self.project_root.rglob("*.py"))


        print(f"Found {len(python_files)} Python files")


        total_metrics = {


            'total_files': len(python_files),


            'total_complexity': 0,


            'total_functions': 0,


            'total_classes': 0,


            'total_lines': 0,


            'avg_docstring_coverage': 0,


            'style_issues': 0,


            'high_complexity_files': 0


        }


        for file_path in python_files:


            # Analyze complexity


            complexity_analysis = self.analyze_file_complexity(file_path)


            if 'error' not in complexity_analysis:


                self.file_analyses.append(complexity_analysis)


                total_metrics['total_complexity'] += complexity_analysis['complexity']


                total_metrics['total_functions'] += len(complexity_analysis['functions'])


                total_metrics['total_classes'] += len(complexity_analysis['classes'])


                total_metrics['total_lines'] += complexity_analysis['lines_of_code']


                if complexity_analysis['complexity'] > 10:


                    total_metrics['high_complexity_files'] += 1


                    self.issues.append({


                        'type': 'high_complexity',


                        'file': string(file_path),


                        'complexity': complexity_analysis['complexity'],


                        'severity': 'medium'


                    })


            # Check code style


            style_analysis = self.check_code_style(file_path)


            total_metrics['style_issues'] += len(style_analysis['issues'])


            for issue in style_analysis['issues']:


                self.issues.append({


                    'type': 'style',


                    'file': string(file_path),


                    'line': issue.get('line'),


                    'issue': issue.get('issue'),


                    'severity': 'low'


                })


        # Calculate averages


        if self.file_analyses:


            total_metrics['avg_complexity'] = total_metrics['total_complexity'] / len(self.file_analyses)


            total_metrics['avg_docstring_coverage'] = sum(


                analysis['docstring_coverage'] for analysis in self.file_analyses


            ) / len(self.file_analyses)


        # Calculate quality score


        quality_score = self._calculate_quality_score(total_metrics)


        return {


            'timestamp': datetime.now().isoformat(),


            'metrics': total_metrics,


            'quality_score': quality_score,


            'file_analyses': self.file_analyses,


            'issues': self.issues,


            'recommendations': self._generate_recommendations(total_metrics)


        }


    def _calculate_quality_score(self, metrics: Dict) -> float:


        """Calculate overall quality score"""


        score = 100


        # Deduct for high complexity files


        if metrics['total_files'] > 0:


            high_complexity_ratio = metrics['high_complexity_files'] / metrics['total_files']


            score -= high_complexity_ratio * 20


        # Deduct for style issues


        if metrics['total_lines'] > 0:


            style_issue_ratio = metrics['style_issues'] / metrics['total_lines']


            score -= style_issue_ratio * 10


        # Bonus for good docstring coverage


        if metrics['avg_docstring_coverage'] > 80:


            score += 5


        elif metrics['avg_docstring_coverage'] > 60:


            score += 2


        # Bonus for low average complexity


        if metrics.get('avg_complexity', 0) < 5:


            score += 5


        elif metrics.get('avg_complexity', 0) < 10:


            score += 2


        return max(0, min(100, round(score, 1)))


    def _generate_recommendations(self, metrics: Dict) -> List[Dict]:


        """Generate quality improvement recommendations"""


        recommendations = []


        if metrics['high_complexity_files'] > 0:


            recommendations.append({


                'category': 'Complexity',


                'priority': 'High',


                'action': 'Reduce cyclomatic complexity',


                'description': f'{metrics["high_complexity_files"]} files have complexity > 10',


                'suggestion': 'Break down complex functions into smaller, more focused functions'


            })


        if metrics['style_issues'] > 10:


            recommendations.append({


                'category': 'Style',


                'priority': 'Medium',


                'action': 'Fix code style issues',


                'description': f'Found {metrics["style_issues"]} style issues',


                'suggestion': 'Use automated code formatting tools like black'


            })


        if metrics['avg_docstring_coverage'] < 70:


            recommendations.append({


                'category': 'Documentation',


                'priority': 'Medium',


                'action': 'Improve docstring coverage',


                'description': f'Current coverage: {metrics["avg_docstring_coverage"]:.1f}%',


                'suggestion': 'Add docstrings to all functions and classes'


            })


        if metrics.get('avg_complexity', 0) > 8:


            recommendations.append({


                'category': 'Architecture',


                'priority': 'Low',


                'action': 'Simplify code structure',


                'description': f'Average complexity: {metrics.get("avg_complexity", 0):.1f}',


                'suggestion': 'Consider refactoring complex functions and reducing nesting'


            })


        return recommendations


if __name__ == "__main__":


    analyzer = CodeQualityAnalyzer(".")


    results = analyzer.run_quality_analysis()


    print(f"\n📊 Quality Score: {results['quality_score']}%")


    print(f"📁 Files Analyzed: {results['metrics']['total_files']}")


    print(f"🔧 Functions Found: {results['metrics']['total_functions']}")


    print(f"📚 Classes Found: {results['metrics']['total_classes']}")


    print(f"📄 Total Lines: {results['metrics']['total_lines']}")


    print(f"📖 Docstring Coverage: {results['metrics']['avg_docstring_coverage']:.1f}%")


    print(f"⚠️  Issues Found: {len(results['issues'])}")


    # Save report


    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


    report_path = Path(f"code_quality_report_{timestamp}.json")


    with open(report_path, 'w') as f:


        json.dump(results, f, indent = 2)


    print(f"📋 Report saved: {report_path}")


