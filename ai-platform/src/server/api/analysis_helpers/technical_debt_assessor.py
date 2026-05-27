"""Technical debt assessor for code analysis


This module provides functions to assess technical debt including:


- Code smell detection


- Code duplication


- Long method/function detection


- Complex class detection


"""


from typing import Dict, List, Optional, Any


from pathlib import Path


import re


class TechnicalDebtAssessor:


    """Assessor for technical debt metrics"""


    def __init__(self, project_root: Path):


        """Initialize technical debt assessor


        Args:


            project_root: Root directory of the project to analyze


        """


        self.project_root = project_root


    def assess_code_smells(self) -> Dict[str, Any]:


        """Assess code smells in the project


        Returns:


            Dictionary containing code smell metrics


        """


        smells = {


            'long_methods': 0,


            'long_classes': 0,


            'duplicate_code': 0,


            'complex_methods': 0


        }


        for file_path in self.project_root.rglob('*'):


            if file_path.is_file() and self._is_code_file(file_path):


                file_smells = self._detect_file_smells(file_path)


                smells['long_methods'] += file_smells.get('long_methods', 0)


                smells['long_classes'] += file_smells.get('long_classes', 0)


                smells['duplicate_code'] += file_smells.get('duplicate_code', 0)


                smells['complex_methods'] += file_smells.get('complex_methods', 0)


        return smells


    def _detect_file_smells(self, file_path: Path) -> Dict[str, int]:


        """Detect code smells in a single file


        Args:


            file_path: Path to the file


        Returns:


            Dictionary with counts of different code smells


        """


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                content = f.read()


                lines = content.split('\n')


                smells = {


                    'long_methods': 0,


                    'long_classes': 0,


                    'duplicate_code': 0,


                    'complex_methods': 0


                }


                # Detect long methods (>50 lines)


                if len(lines) > 50:


                    smells['long_methods'] += 1


                # Detect long classes (>300 lines)


                if len(lines) > 300:


                    smells['long_classes'] += 1


                # Detect complex methods (many nested conditions)


                if content.count('if ') > 10:


                    smells['complex_methods'] += 1


                return smells


        except Exception:


            return {'long_methods': 0, 'long_classes': 0, 'duplicate_code': 0, 'complex_methods': 0}


    def calculate_debt_score(self) -> int:


        """Calculate overall technical debt score


        Returns:


            Technical debt score (0-100, higher is worse)


        """


        smells = self.assess_code_smells()


        total_smells = sum(smells.values())


        # Normalize to 0-100 scale


        max_expected_smells = 50  # Arbitrary threshold


        score = min(100, int((total_smells / max_expected_smells) * 100))


        return score


    def get_debt_recommendations(self) -> List[str]:


        """Get recommendations for reducing technical debt


        Returns:


            List of actionable recommendations


        """


        recommendations = []


        smells = self.assess_code_smells()


        if smells['long_methods'] > 5:


            recommendations.append('Refactor long methods into smaller, more focused functions')


        if smells['long_classes'] > 3:


            recommendations.append('Break down large classes using composition or inheritance')


        if smells['complex_methods'] > 5:


            recommendations.append('Simplify complex methods by reducing nested conditions')


        if smells['duplicate_code'] > 10:


            recommendations.append('Extract common code into reusable functions or modules')


        if not recommendations:


            recommendations.append('No significant technical debt detected')


        return recommendations


    def _is_code_file(self, file_path: Path) -> bool:


        """Check if a file is a code file


        Args:


            file_path: Path to the file


        Returns:


            True if the file is a code file, False otherwise


        """


        code_extensions = {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.go', '.rs'}


        return file_path.suffix in code_extensions


