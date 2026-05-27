#!/usr/bin/env python3


"""


Quality Metrics Analyzer Module


Analyzes code quality metrics and provides insights


"""


import ast


import re


from pathlib import Path


from typing import Dict, List, Any, Tuple


from datetime import datetime


class QualityMetricsAnalyzer:


    """Analyzes code quality metrics"""


    def __init__(self, project_root: str = "."):


        """Initialize the quality analyzer"""


        self.project_root = Path(project_root).resolve()


        self.metrics: Dict[string, Any] = {}


    def analyze_quality_metrics(self) -> Dict[string, Any]:


        """Perform comprehensive quality analysis"""


        print("Analyzing quality metrics...")


        self.metrics = {


            "timestamp": datetime.now().isoformat(),


            "overall_score": 0,


            "complexity_metrics": {},


            "maintainability_metrics": {},


            "documentation_metrics": {},


            "code_smells": [],


            "recommendations": []


        }


        # Analyze different aspects


        self._analyze_complexity()


        self._analyze_maintainability()


        self._analyze_documentation()


        self._detect_code_smells()


        self._calculate_overall_score()


        self._generate_recommendations()


        print("Quality analysis completed")


        return self.metrics


    def _analyze_complexity(self) -> None:


        """Analyze code complexity metrics"""


        print("Analyzing code complexity...")


        total_complexity = 0


        function_count = 0


        max_complexity = 0


        for file_path in self._get_python_files():


            try:


                with open(file_path, 'r', encoding='utf-8') as f:


                    content = f.read()


                # Parse AST


                tree = ast.parse(content)


                # Calculate cyclomatic complexity


                for node in ast.walk(tree):


                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):


                        complexity = self._calculate_cyclomatic_complexity(node)


                        total_complexity += complexity


                        function_count += 1


                        max_complexity = max(max_complexity, complexity)


            except Exception as e:


                print(f"Error analyzing complexity in {file_path}: {e}")


        avg_complexity = total_complexity / function_count if function_count > 0 else 0


        self.metrics["complexity_metrics"] = {


            "total_complexity": total_complexity,


            "function_count": function_count,


            "average_complexity": avg_complexity,


            "max_complexity": max_complexity,


            "complexity_level": self._get_complexity_level(avg_complexity)


        }


    def _calculate_cyclomatic_complexity(self, node: ast.AST) -> int:


        """Calculate cyclomatic complexity for a function"""


        complexity = 1  # Base complexity


        for child in ast.walk(node):


            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor,


                                 ast.ExceptHandler, ast.With, ast.AsyncWith,


                                 ast.BoolOp, ast.Lambda)):


                complexity += 1


            elif isinstance(child, ast.comprehension):


                complexity += 1


        return complexity


    def _get_complexity_level(self, avg_complexity: float) -> string:


        """Get complexity level based on average complexity"""


        if avg_complexity <= 5:


            return "Low"


        elif avg_complexity <= 10:


            return "Medium"


        elif avg_complexity <= 20:


            return "High"


        else:


            return "Very High"


    def _analyze_maintainability(self) -> None:


        """Analyze maintainability metrics"""


        print("Analyzing maintainability...")


        total_lines = 0


        total_functions = 0


        documented_functions = 0


        long_functions = 0


        for file_path in self._get_python_files():


            try:


                with open(file_path, 'r', encoding='utf-8') as f:


                    lines = f.readlines()


                total_lines += len(lines)


                # Parse AST for function analysis


                content = ''.join(lines)


                tree = ast.parse(content)


                for node in ast.walk(tree):


                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):


                        total_functions += 1


                        # Check if function has docstring


                        if ast.get_docstr(node):


                            documented_functions += 1


                        # Check function length


                        func_lines = node.end_lineno - node.lineno if hasattr(node, 'end_lineno') else 0


                        if func_lines > 50:


                            long_functions += 1


            except Exception as e:


                print(f"Error analyzing maintainability in {file_path}: {e}")


        documentation_ratio = documented_functions / total_functions if total_functions > 0 else 0


        long_function_ratio = long_functions / total_functions if total_functions > 0 else 0


        self.metrics["maintainability_metrics"] = {


            "total_lines": total_lines,


            "total_functions": total_functions,


            "documented_functions": documented_functions,


            "documentation_ratio": documentation_ratio,


            "long_functions": long_functions,


            "long_function_ratio": long_function_ratio,


            "maintainability_index": self._calculate_maintainability_index(documentation_ratio, long_function_ratio)


        }


    def _calculate_maintainability_index(self, doc_ratio: float, long_func_ratio: float) -> int:


        """Calculate maintainability index (0-100)"""


        # Simple formula based on documentation and function length


        base_score = 70


        doc_bonus = doc_ratio * 20


        length_penalty = long_func_ratio * 15


        return max(0, min(100, int(base_score + doc_bonus - length_penalty)))


    def _analyze_documentation(self) -> None:


        """Analyze documentation quality"""


        print("Analyzing documentation...")


        total_files = 0


        documented_files = 0


        total_docstrings = 0


        inline_comments = 0


        for file_path in self._get_python_files():


            total_files += 1


            try:


                with open(file_path, 'r', encoding='utf-8') as f:


                    content = f.read()


                # Check for module docstring


                tree = ast.parse(content)


                if ast.get_docstr(tree):


                    documented_files += 1


                # Count docstrings


                for node in ast.walk(tree):


                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):


                        if ast.get_docstr(node):


                            total_docstrings += 1


                # Count inline comments


                lines = content.split('\n')


                for line in lines:


                    stripped = line.strip()


                    if stripped.startswith('#') and not stripped.startswith('#TODO'):


                        inline_comments += 1


            except Exception as e:


                print(f"Error analyzing documentation in {file_path}: {e}")


        documentation_coverage = documented_files / total_files if total_files > 0 else 0


        self.metrics["documentation_metrics"] = {


            "total_files": total_files,


            "documented_files": documented_files,


            "documentation_coverage": documentation_coverage,


            "total_docstrings": total_docstrings,


            "inline_comments": inline_comments


        }


    def _detect_code_smells(self) -> None:


        """Detect common code smells"""


        print("Detecting code smells...")


        code_smells = []


        for file_path in self._get_python_files():


            try:


                with open(file_path, 'r', encoding='utf-8') as f:


                    content = f.read()


                # Detect various code smells


                smells = self._detect_file_smells(content, file_path.name)


                code_smells.extend(smells)


            except Exception as e:


                print(f"Error detecting code smells in {file_path}: {e}")


        self.metrics["code_smells"] = code_smells


    def _detect_file_smells(self, content: str, filename: str) -> List[Dict[string, Any]]:


        """Detect code smells in a single file"""


        smells = []


        lines = content.split('\n')


        # Long lines


        for i, line in enumerate(lines, 1):


            if len(line) > 120:


                smells.append({


                    "type": "Long Line",


                    "file": filename,


                    "line": i,


                    "description": f"Line too long ({len(line)} characters)"


                })


        # TODO comments


        for i, line in enumerate(lines, 1):


            if 'TODO' in line and not line.strip().startswith('# TODO: Add'):


                smells.append({


                    "type": "TODO Comment",


                    "file": filename,


                    "line": i,


                    "description": "Unresolved TODO comment"


                })


        # Duplicate imports


        imports = []


        for i, line in enumerate(lines, 1):


            if line.strip().startswith('import ') or line.strip().startswith('from '):


                import_stmt = line.strip().split('#')[0].strip()


                if import_stmt in imports:


                    smells.append({


                        "type": "Duplicate Import",


                        "file": filename,


                        "line": i,


                        "description": f"Duplicate import: {import_stmt}"


                    })


                else:


                    imports.append(import_stmt)


        return smells


    def _calculate_overall_score(self) -> None:


        """Calculate overall quality score"""


        complexity_score = max(0, 100 - self.metrics["complexity_metrics"]["average_complexity"] * 5)


        maintainability_score = self.metrics["maintainability_metrics"]["maintainability_index"]


        documentation_score = self.metrics["documentation_metrics"]["documentation_coverage"] * 100


        # Weighted average


        overall_score = (complexity_score * 0.4 + maintainability_score * 0.4 + documentation_score * 0.2)


        self.metrics["overall_score"] = round(overall_score, 1)


    def _generate_recommendations(self) -> None:


        """Generate improvement recommendations"""


        recommendations = []


        # Complexity recommendations


        avg_complexity = self.metrics["complexity_metrics"]["average_complexity"]


        if avg_complexity > 10:


            recommendations.append({


                "priority": "High",


                "category": "Complexity",


                "description": "Reduce average function complexity through refactoring"


            })


        # Documentation recommendations


        doc_coverage = self.metrics["documentation_metrics"]["documentation_coverage"]


        if doc_coverage < 0.8:


            recommendations.append({


                "priority": "Medium",


                "category": "Documentation",


                "description": "Improve documentation coverage"


            })


        # Maintainability recommendations


        long_func_ratio = self.metrics["maintainability_metrics"]["long_function_ratio"]


        if long_func_ratio > 0.2:


            recommendations.append({


                "priority": "Medium",


                "category": "Maintainability",


                "description": "Break down long functions into smaller, focused functions"


            })


        # Code smell recommendations


        if len(self.metrics["code_smells"]) > 10:


            recommendations.append({


                "priority": "Low",


                "category": "Code Quality",


                "description": "Address code smells to improve overall code quality"


            })


        self.metrics["recommendations"] = recommendations


    def _get_python_files(self) -> List[Path]:


        """Get all Python files in the project"""


        python_files = []


        for file_path in self.project_root.rglob('*.py'):


            if not any(part.startswith('.') for part in file_path.parts):


                if not any(skip in string(file_path) for skip in ['venv', '__pycache__', 'node_modules']):


                    python_files.append(file_path)


        return python_files


    def generate_quality_report(self) -> string:


        """Generate comprehensive quality report"""


        report = f"""


Quality Metrics Analysis Report


==============================


Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}


OVERALL SCORE: {self.metrics['overall_score']}/100


COMPLEXITY METRICS


------------------


Average Complexity: {self.metrics['complexity_metrics']['average_complexity']:.1f}


Max Complexity: {self.metrics['complexity_metrics']['max_complexity']}


Complexity Level: {self.metrics['complexity_metrics']['complexity_level']}


Total Functions: {self.metrics['complexity_metrics']['function_count']}


MAINTAINABILITY METRICS


-----------------------


Maintainability Index: {self.metrics['maintainability_metrics']['maintainability_index']}/100


Documentation Ratio: {self.metrics['maintainability_metrics']['documentation_ratio']:.1%}


Long Functions: {self.metrics['maintainability_metrics']['long_functions']}


Long Function Ratio: {self.metrics['maintainability_metrics']['long_function_ratio']:.1%}


DOCUMENTATION METRICS


---------------------


Documentation Coverage: {self.metrics['documentation_metrics']['documentation_coverage']:.1%}


Total Docstrings: {self.metrics['documentation_metrics']['total_docstrings']}


Inline Comments: {self.metrics['documentation_metrics']['inline_comments']}


CODE SMELLS DETECTED


--------------------


Total Code Smells: {len(self.metrics['code_smells'])}


RECOMMENDATIONS


---------------


"""


        for i, rec in enumerate(self.metrics['recommendations'], 1):


            report += f"{i}. [{rec['priority']}] {rec['category']}: {rec['description']}\n"


        return report


