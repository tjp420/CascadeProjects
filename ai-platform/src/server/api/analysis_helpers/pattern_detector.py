"""Pattern detector for code analysis


This module provides functions to detect architectural patterns including:


- Design patterns (Singleton, Factory, Observer, etc.)


- Architectural patterns (MVC, MVVM, etc.)


- Code structure patterns


"""


from typing import Dict, List, Optional, Any


from pathlib import Path


import re


class PatternDetector:


    """Detector for architectural and design patterns"""


    def __init__(self, project_root: Path):


        """Initialize pattern detector


        Args:


            project_root: Root directory of the project to analyze


        """


        self.project_root = project_root


    def detect_design_patterns(self) -> Dict[str, int]:


        """Detect design patterns in the project


        Returns:


            Dictionary with counts of detected design patterns


        """


        patterns = {


            'singleton': 0,


            'factory': 0,


            'observer': 0,


            'decorator': 0,


            'strategy': 0


        }


        for file_path in self.project_root.rglob('*'):


            if file_path.is_file() and self._is_code_file(file_path):


                file_patterns = self._detect_file_patterns(file_path)


                for pattern, count in file_patterns.items():


                    patterns[pattern] += count


        return patterns


    def _detect_file_patterns(self, file_path: Path) -> Dict[str, int]:


        """Detect design patterns in a single file


        Args:


            file_path: Path to the file


        Returns:


            Dictionary with counts of detected patterns in this file


        """


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                content = f.read().lower()


                patterns = {


                    'singleton': 0,


                    'factory': 0,


                    'observer': 0,


                    'decorator': 0,


                    'strategy': 0


                }


                # Simple pattern detection based on keywords


                if 'singleton' in content or 'instance' in content:


                    patterns['singleton'] += 1


                if 'factory' in content or 'create' in content:


                    patterns['factory'] += 1


                if 'observer' in content or 'subscribe' in content or 'notify' in content:


                    patterns['observer'] += 1


                if 'decorator' in content or 'wrapper' in content:


                    patterns['decorator'] += 1


                if 'strategy' in content or 'algorithm' in content:


                    patterns['strategy'] += 1


                return patterns


        except Exception:


            return {'singleton': 0, 'factory': 0, 'observer': 0, 'decorator': 0, 'strategy': 0}


    def detect_architectural_patterns(self) -> Dict[str, bool]:


        """Detect architectural patterns in the project structure


        Returns:


            Dictionary with detected architectural patterns


        """


        patterns = {


            'mvc': False,


            'mvvm': False,


            'layered': False,


            'microservices': False


        }


        # Check for MVC pattern


        if self._has_directory('models') and self._has_directory('views') and self._has_directory('controllers'):


            patterns['mvc'] = True


        # Check for MVVM pattern


        if self._has_directory('models') and self._has_directory('viewmodels') and self._has_directory('views'):


            patterns['mvvm'] = True


        # Check for layered architecture


        if self._has_directory('controllers') or self._has_directory('services') or self._has_directory('repositories'):


            patterns['layered'] = True


        # Check for microservices


        if self._has_directory('microservices') or self._has_directory('services'):


            patterns['microservices'] = True


        return patterns


    def _has_directory(self, dir_name: str) -> bool:


        """Check if a directory exists in the project


        Args:


            dir_name: Name of the directory to check


        Returns:


            True if directory exists, False otherwise


        """


        return any(d.name.lower() == dir_name.lower() for d in self.project_root.iterdir() if d.is_dir())


    def detect_code_structure(self) -> Dict[str, Any]:


        """Detect overall code structure and organization


        Returns:


            Dictionary with code structure information


        """


        structure = {


            'total_files': 0,


            'total_directories': 0,


            'file_types': {},


            'directory_depth': 0


        }


        for item in self.project_root.rglob('*'):


            if item.is_file():


                structure['total_files'] += 1


                ext = item.suffix


                structure['file_types'][ext] = structure['file_types'].get(ext, 0) + 1


            elif item.is_dir():


                structure['total_directories'] += 1


                depth = len(item.relative_to(self.project_root).parts)


                structure['directory_depth'] = max(structure['directory_depth'], depth)


        return structure


    def _is_code_file(self, file_path: Path) -> bool:


        """Check if a file is a code file


        Args:


            file_path: Path to the file


        Returns:


            True if the file is a code file, False otherwise


        """


        code_extensions = {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.go', '.rs'}


        return file_path.suffix in code_extensions


