"""Metrics calculator for code analysis


This module provides functions to calculate various code metrics including:


- Lines of code (LOC)


- Cyclomatic complexity


- Function/class counts


- Code duplication metrics


"""


from typing import Dict, List, Optional, Any


from pathlib import Path


import os


import ast


class MetricsCalculator:


    """Calculator for various code metrics"""


    def __init__(self, project_root: Path):


        """Initialize metrics calculator


        Args:


            project_root: Root directory of the project to analyze


        """


        self.project_root = project_root


    def calculate_loc(self, file_path: Path) -> int:


        """Calculate lines of code for a file


        Args:


            file_path: Path to the file


        Returns:


            Number of lines of code (excluding blank lines and comments)


        """


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                lines = f.readlines()


                loc = 0


                for line in lines:


                    stripped = line.strip()


                    if stripped and not stripped.startswith('#') and not stripped.startswith('"""'):


                        loc += 1


                return loc


        except Exception:


            return 0


    def calculate_total_loc(self) -> int:


        """Calculate total lines of code for the project


        Returns:


            Total lines of code across all files


        """


        total_loc = 0


        for file_path in self.project_root.rglob('*'):


            if file_path.is_file() and self._is_code_file(file_path):


                total_loc += self.calculate_loc(file_path)


        return total_loc


    def calculate_complexity(self, file_path: Path) -> int:


        """Calculate cyclomatic complexity for a file


        Args:


            file_path: Path to the file


        Returns:


            Cyclomatic complexity score


        """


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                content = f.read()


                # Simple complexity calculation based on control flow keywords


                complexity = 1  # Base complexity


                keywords = ['if', 'elif', 'for', 'while', 'except', 'case']


                for keyword in keywords:


                    complexity += content.count(keyword)


                return complexity


        except Exception:


            return 1


    def calculate_function_count(self, file_path: Path) -> int:


        """Count number of functions in a file


        Args:


            file_path: Path to the file


        Returns:


            Number of functions


        """


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                content = f.read()


                # Simple function detection (Python and JavaScript)


                count = 0


                count += content.count('def ')


                count += content.count('function ')


                return count


        except Exception:


            return 0


    def calculate_class_count(self, file_path: Path) -> int:


        """Count number of classes in a file


        Args:


            file_path: Path to the file


        Returns:


            Number of classes


        """


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                content = f.read()


                # Simple class detection (Python and JavaScript)


                count = 0


                count += content.count('class ')


                return count


        except Exception:


            return 0


    def calculate_all_metrics(self) -> Dict[str, Any]:


        """Calculate all metrics for the project


        Returns:


            Dictionary containing all calculated metrics


        """


        return {


            'total_loc': self.calculate_total_loc(),


            'file_count': len(list(self.project_root.rglob('*'))),


            'function_count': sum(self.calculate_function_count(f) for f in self.project_root.rglob('*') if f.is_file()),


            'class_count': sum(self.calculate_class_count(f) for f in self.project_root.rglob('*') if f.is_file()),


        }


    def _is_code_file(self, file_path: Path) -> bool:


        """Check if a file is a code file


        Args:


            file_path: Path to the file


        Returns:


            True if the file is a code file, False otherwise


        """


        code_extensions = {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.go', '.rs'}


        return file_path.suffix in code_extensions


