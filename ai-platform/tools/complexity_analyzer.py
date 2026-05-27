#!/usr/bin/env python3
"""
Code Complexity Analyzer
Identifies complex functions that need refactoring based on cyclomatic complexity and other metrics.
"""

import ast
import os
import json
from pathlib import Path
from typing import List, Dict, Any
import re

class ComplexityAnalyzer:
    """Analyzes Python code complexity and identifies functions needing refactoring."""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.complexity_threshold = 10
        self.line_threshold = 100
        self.nesting_threshold = 4
        self.results = {
            'analysis_metadata': {
                'project_root': str(project_root),
                'analysis_date': None,
                'files_analyzed': 0,
                'total_functions': 0,
                'complex_functions': 0
            },
            'complex_functions': [],
            'summary': {
                'by_complexity': {},
                'by_lines': {},
                'by_nesting': {},
                'overall_metrics': {}
            }
        }
    
    def analyze_project(self) -> Dict[str, Any]:
        """Analyze the entire project for code complexity."""
        from datetime import datetime
        self.results['analysis_metadata']['analysis_date'] = datetime.now().isoformat()
        
        python_files = list(self.project_root.rglob('*.py'))
        
        # Skip common directories to ignore
        ignore_dirs = {
            '.git', '__pycache__', 'node_modules', '.pytest_cache',
            'venv', 'env', 'dist', 'build', 'archive', 'archive_cleanup'
        }
        
        python_files = [
            f for f in python_files 
            if not any(ignore_dir in f.parts for ignore_dir in ignore_dirs)
        ]
        
        self.results['analysis_metadata']['files_analyzed'] = len(python_files)
        
        for py_file in python_files:
            try:
                self.analyze_file(py_file)
            except Exception as e:
                print(f"Error analyzing {py_file}: {e}")
        
        self.generate_summary()
        return self.results
    
    def analyze_file(self, file_path: Path):
        """Analyze a single Python file for complexity."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    function_info = self.analyze_function(node, file_path, content)
                    if function_info:
                        self.results['complex_functions'].append(function_info)
                        self.results['analysis_metadata']['total_functions'] += 1
                        
                        if function_info['complexity'] > self.complexity_threshold:
                            self.results['analysis_metadata']['complex_functions'] += 1
                            
        except SyntaxError as e:
            print(f"Syntax error in {file_path}: {e}")
    
    def analyze_function(self, node: ast.FunctionDef, file_path: Path, content: str) -> Dict[str, Any]:
        """Analyze a single function for complexity metrics."""
        # Calculate cyclomatic complexity
        complexity = self.calculate_complexity(node)
        
        # Get function length
        lines = self.get_function_lines(node, content)
        
        # Get nesting depth
        nesting = self.get_nesting_depth(node)
        
        # Get parameter count
        param_count = len(node.args.args) + len(getattr(node.args, 'kwonly', []))
        
        function_info = {
            'name': node.name,
            'file': str(file_path.relative_to(self.project_root)),
            'line_number': node.lineno,
            'complexity': complexity,
            'lines': lines,
            'nesting_depth': nesting,
            'parameter_count': param_count,
            'is_async': isinstance(node, ast.AsyncFunctionDef),
            'has_decorator': len(node.decorator_list) > 0,
            'needs_refactoring': False,
            'refactoring_priority': None
        }
        
        # Determine if refactoring is needed
        reasons = []
        if complexity > self.complexity_threshold:
            reasons.append(f'Complexity ({complexity}) exceeds threshold ({self.complexity_threshold})')
            function_info['needs_refactoring'] = True
        
        if lines > self.line_threshold:
            reasons.append(f'Lines ({lines}) exceeds threshold ({self.line_threshold})')
            function_info['needs_refactoring'] = True
        
        if nesting > self.nesting_threshold:
            reasons.append(f'Nesting depth ({nesting}) exceeds threshold ({self.nesting_threshold})')
            function_info['needs_refactoring'] = True
        
        if param_count > 7:
            reasons.append(f'Parameter count ({param_count}) exceeds best practice (7)')
            function_info['needs_refactoring'] = True
        
        if function_info['needs_refactoring']:
            function_info['refactoring_reasons'] = reasons
            
            # Calculate priority
            priority_score = (
                (complexity - self.complexity_threshold) * 2 +
                (lines - self.line_threshold) // 10 +
                (nesting - self.nesting_threshold) * 3
            )
            
            if priority_score > 30:
                function_info['refactoring_priority'] = 'CRITICAL'
            elif priority_score > 15:
                function_info['refactoring_priority'] = 'HIGH'
            elif priority_score > 5:
                function_info['refactoring_priority'] = 'MEDIUM'
            else:
                function_info['refactoring_priority'] = 'LOW'
        
        return function_info if function_info['needs_refactoring'] else None
    
    def calculate_complexity(self, node: ast.FunctionDef) -> int:
        """Calculate cyclomatic complexity of a function."""
        complexity = 1  # Base complexity
        
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(child, ast.ExceptHandler):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
            elif isinstance(child, (ast.And, ast.Or)):
                complexity += 1
        
        return complexity
    
    def get_function_lines(self, node: ast.FunctionDef, content: str) -> int:
        """Get the number of lines in a function."""
        lines = content.split('\n')
        start_line = node.lineno - 1
        
        # Find the end of the function
        end_line = start_line
        if hasattr(node, 'end_lineno') and node.end_lineno:
            end_line = node.end_lineno - 1
        else:
            # Fallback: find the next line at same or lower indentation
            current_indent = len(lines[start_line]) - len(lines[start_line].lstrip())
            for i in range(start_line + 1, len(lines)):
                line_indent = len(lines[i]) - len(lines[i].lstrip())
                if lines[i].strip() and line_indent <= current_indent:
                    end_line = i - 1
                    break
            else:
                end_line = len(lines) - 1
        
        return end_line - start_line + 1
    
    def get_nesting_depth(self, node: ast.FunctionDef) -> int:
        """Get the maximum nesting depth within a function."""
        max_depth = 0
        current_depth = 0
        
        def check_nesting(n, depth):
            nonlocal max_depth
            if depth > max_depth:
                max_depth = depth
            
            if isinstance(n, (ast.If, ast.While, ast.For, ast.AsyncFor, ast.With, ast.AsyncWith, ast.Try)):
                for child in ast.iter_child_nodes(n):
                    check_nesting(child, depth + 1)
            else:
                for child in ast.iter_child_nodes(n):
                    check_nesting(child, depth)
        
        for child in ast.iter_child_nodes(node):
            check_nesting(child, current_depth + 1)
        
        return max_depth
    
    def generate_summary(self):
        """Generate summary statistics from analysis results."""
        complex_funcs = self.results['complex_functions']
        
        if not complex_funcs:
            return
        
        # Summary by complexity
        complexity_ranges = {
            '11-15': 0, '16-20': 0, '21-30': 0, '31+': 0
        }
        for func in complex_funcs:
            c = func['complexity']
            if 11 <= c <= 15:
                complexity_ranges['11-15'] += 1
            elif 16 <= c <= 20:
                complexity_ranges['16-20'] += 1
            elif 21 <= c <= 30:
                complexity_ranges['21-30'] += 1
            elif c > 30:
                complexity_ranges['31+'] += 1
        
        self.results['summary']['by_complexity'] = complexity_ranges
        
        # Summary by lines
        line_ranges = {
            '101-150': 0, '151-200': 0, '201-300': 0, '300+': 0
        }
        for func in complex_funcs:
            l = func['lines']
            if 101 <= l <= 150:
                line_ranges['101-150'] += 1
            elif 151 <= l <= 200:
                line_ranges['151-200'] += 1
            elif 201 <= l <= 300:
                line_ranges['201-300'] += 1
            elif l > 300:
                line_ranges['300+'] += 1
        
        self.results['summary']['by_lines'] = line_ranges
        
        # Summary by nesting
        nesting_ranges = {
            '5': 0, '6-8': 0, '9-12': 0, '12+': 0
        }
        for func in complex_funcs:
            n = func['nesting_depth']
            if n == 5:
                nesting_ranges['5'] += 1
            elif 6 <= n <= 8:
                nesting_ranges['6-8'] += 1
            elif 9 <= n <= 12:
                nesting_ranges['9-12'] += 1
            elif n > 12:
                nesting_ranges['12+'] += 1
        
        self.results['summary']['by_nesting'] = nesting_ranges
        
        # Overall metrics
        self.results['summary']['overall_metrics'] = {
            'total_complex_functions': len(complex_funcs),
            'avg_complexity': sum(f['complexity'] for f in complex_funcs) / len(complex_funcs),
            'avg_lines': sum(f['lines'] for f in complex_funcs) / len(complex_funcs),
            'max_complexity': max(f['complexity'] for f in complex_funcs),
            'max_lines': max(f['lines'] for f in complex_funcs),
            'priority_breakdown': {
                'CRITICAL': sum(1 for f in complex_funcs if f['refactoring_priority'] == 'CRITICAL'),
                'HIGH': sum(1 for f in complex_funcs if f['refactoring_priority'] == 'HIGH'),
                'MEDIUM': sum(1 for f in complex_funcs if f['refactoring_priority'] == 'MEDIUM'),
                'LOW': sum(1 for f in complex_funcs if f['refactoring_priority'] == 'LOW')
            }
        }

def main():
    """Main execution function."""
    project_root = r'c:\Users\Trevor\CascadeProjects'
    
    print("Starting Code Complexity Analysis...")
    print(f"Project Root: {project_root}")
    
    analyzer = ComplexityAnalyzer(project_root)
    results = analyzer.analyze_project()
    
    # Save results
    output_file = Path(project_root) / 'complexity_analysis_results.json'
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nAnalysis Complete!")
    print(f"Results saved to: {output_file}")
    print(f"\nSummary:")
    print(f"  Files Analyzed: {results['analysis_metadata']['files_analyzed']}")
    print(f"  Total Functions: {results['analysis_metadata']['total_functions']}")
    print(f"  Complex Functions: {results['analysis_metadata']['complex_functions']}")
    
    if results['complex_functions']:
        print(f"\nPriority Breakdown:")
        priority = results['summary']['overall_metrics']['priority_breakdown']
        print(f"  CRITICAL: {priority['CRITICAL']}")
        print(f"  HIGH: {priority['HIGH']}")
        print(f"  MEDIUM: {priority['MEDIUM']}")
        print(f"  LOW: {priority['LOW']}")
        
        print(f"\nTop 5 Most Complex Functions:")
        sorted_funcs = sorted(results['complex_functions'], key=lambda x: x['complexity'], reverse=True)
        for i, func in enumerate(sorted_funcs[:5], 1):
            print(f"  {i}. {func['name']} (Complexity: {func['complexity']})")
            print(f"     File: {func['file']}")
            print(f"     Lines: {func['lines']}, Nesting: {func['nesting_depth']}")
            print(f"     Priority: {func['refactoring_priority']}")

if __name__ == '__main__':
    main()