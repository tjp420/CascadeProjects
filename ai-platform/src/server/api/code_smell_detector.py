# Constants


CONSTANT_50 = 50


#!/usr/bin/env python3


"""


Code Smell Detector Module


Detects code smells and anti-patterns in the codebase


"""


import ast


import re


from pathlib import Path


from typing import Dict, Any, List


from collections import defaultdict


class CodeSmellDetector:


    """Detects code smells and anti-patterns"""


    def __init__(self, project_root: str = None):


        """


        """


        self.project_root = Path(project_root) if project_root else Path.cwd()


    def detect_code_smells(self) -> Dict[str, Any]:


        """Detect all code smells in the codebase"""


        try:


            python_files = list(self.project_root.rglob('*.py'))


            smells = {


                'long_functions': [],


                'large_classes': [],


                'duplicate_code': [],


                'complex_methods': [],


                'magic_numbers': [],


                'dead_code': [],


                'commented_code': [],


                'long_parameter_lists': []


            }


            for py_file in python_files:


                try:


                    with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:


                        content = f.read()


                    file_smells = self._analyze_file_for_smells(py_file, content)


                    for smell_type, smell_list in file_smells.items():


                        smells[smell_type].extend(smell_list)


                except Exception:


                    continue


            # Calculate smell metrics


            total_smells = sum(len(v) for v in smells.values())


            return {


                'totalSmells': total_smells,


                'smells': smells,


                'smellCounts': {k: len(v) for k, v in smells.items()},


                'severity': self._assess_smell_severity(total_smells),


                'recommendations': self._generate_smell_recommendations(smells)


            }


        except Exception as e:


            return {'error': f'Code smell detection failed: {str(e)}'}


    def _analyze_file_for_smells(self, file_path: Path, content: str) -> Dict[str, List]:


        """Analyze a single file for code smells"""


        smells = defaultdict(list)


        try:


            tree = ast.parse(content)


            # Detect long functions


            for node in ast.walk(tree):


                if isinstance(node, ast.FunctionDef):


                    func_lines = node.end_lineno - node.lineno if node.end_lineno else 0


                    if func_lines > CONSTANT_50:


                        smells['long_functions'].append({


                            'file': str(file_path.relative_to(self.project_root)),


                            'line': node.lineno,


                            'name': node.name,


                            'lines': func_lines,


                            'severity': 'high' if func_lines > 100 else 'medium'


                        })


                    # Detect long parameter lists


                    num_params = len(node.args.args)


                    if num_params > 7:


                        smells['long_parameter_lists'].append({


                            'file': str(file_path.relative_to(self.project_root)),


                            'line': node.lineno,


                            'name': node.name,


                            'parameters': num_params,


                            'severity': 'medium'


                        })


                    # Detect complex methods (cyclomatic complexity)


                    complexity = self._calculate_cyclomatic_complexity(node)


                    if complexity > 10:


                        smells['complex_methods'].append({


                            'file': str(file_path.relative_to(self.project_root)),


                            'line': node.lineno,


                            'name': node.name,


                            'complexity': complexity,


                            'severity': 'high' if complexity > 20 else 'medium'


                        })


            # Detect large classes


            for node in ast.walk(tree):


                if isinstance(node, ast.ClassDef):


                    class_lines = node.end_lineno - node.lineno if node.end_lineno else 0


                    methods = sum(1 for n in node.body if isinstance(n, ast.FunctionDef))


                    if class_lines > 300 or methods > 20:


                        smells['large_classes'].append({


                            'file': str(file_path.relative_to(self.project_root)),


                            'line': node.lineno,


                            'name': node.name,


                            'lines': class_lines,


                            'methods': methods,


                            'severity': 'high' if class_lines > 500 else 'medium'


                        })


            # Detect magic numbers


            lines = content.split('\n')


            for i, line in enumerate(lines, 1):


                # Look for numeric literals (excluding 0, 1, -1)


                numbers = re.findall(r'\b\d{2,}\b', line)


                for number in numbers:


                    if number not in ['0', '1', '-1', '100']:


                        smells['magic_numbers'].append({


                            'file': str(file_path.relative_to(self.project_root)),


                            'line': i,


                            'value': number,


                            'severity': 'low'


                        })


            # Detect commented code


            for i, line in enumerate(lines, 1):


                if line.strip().startswith('#') and any(


                    keyword in line.lower() for keyword in ['def ', 'class ', 'import ', 'for ', 'if ', 'while ']


                ):


                    smells['commented_code'].append({


                        'file': str(file_path.relative_to(self.project_root)),


                        'line': i,


                        'severity': 'low'


                    })


        except Exception:
            return {key: list(value) for key, value in smells.items()}


        return smells


    def _calculate_cyclomatic_complexity(self, node: ast.FunctionDef) -> int:


        """Calculate cyclomatic complexity of a function"""


        complexity = 1  # Base complexity


        for child in ast.walk(node):


            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):


                complexity += 1


            elif isinstance(child, ast.ExceptHandler):


                complexity += 1


            elif isinstance(child, (ast.And, ast.Or)):


                complexity += 1


        return complexity


    def _assess_smell_severity(self, total_smells: int) -> str:


        """Assess overall severity of code smells"""


        if total_smells == 0:


            return 'none'


        elif total_smells < 10:


            return 'low'


        elif total_smells < 30:


            return 'medium'


        else:


            return 'high'


    def _generate_smell_recommendations(self, smells: Dict[str, List]) -> List[Dict[str, Any]]:


        """Generate recommendations based on detected smells"""


        recommendations = []


        if len(smells['long_functions']) > 0:


            recommendations.append({


                'type': 'refactoring',


                'priority': 'high' if len(smells['long_functions']) > 5 else 'medium',


                'message': f'Found {len(smells["long_functions"])} long functions. Consider breaking them down.',


                'action': 'Extract smaller functions following Single Responsibility Principle'


            })


        if len(smells['large_classes']) > 0:


            recommendations.append({


                'type': 'refactoring',


                'priority': 'high' if len(smells['large_classes']) > 3 else 'medium',


                'message': f'Found {len(smells["large_classes"])} large classes. Consider applying SRP.',


                'action': 'Split large classes into smaller, focused classes'


            })


        if len(smells['complex_methods']) > 0:


            recommendations.append({


                'type': 'refactoring',


                'priority': 'high',


                'message': f'Found {len(smells["complex_methods"])} complex methods.',


                'action': 'Reduce cyclomatic complexity by simplifying logic'


            })


        if len(smells['magic_numbers']) > 10:


            recommendations.append({


                'type': 'quality',


                'priority': 'medium',


                'message': f'Found {len(smells["magic_numbers"])} magic numbers.',


                'action': 'Replace magic numbers with named constants'


            })


        return recommendations


