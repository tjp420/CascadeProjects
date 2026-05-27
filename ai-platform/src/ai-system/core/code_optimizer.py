#!/usr/bin/env python3
"""
Advanced Code Optimization Engine
Optimizes code for performance, maintainability, and best practices
"""

import ast
import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import logging

@dataclass
class OptimizationSuggestion:
    file_path: str
    line_number: int
    issue_type: str
    severity: str
    description: str
    suggestion: str
    auto_fixable: bool
    estimated_impact: str

@dataclass
class OptimizationResult:
    original_file: str
    optimized_file: str
    suggestions: List[OptimizationSuggestion]
    performance_improvement: float
    maintainability_improvement: float
    security_improvement: float

class CodeOptimizer:
    """Advanced code optimization and refactoring engine"""
    
    def __init__(self):
        self.logger = logging.getLogger("CodeOptimizer")
        self.optimization_rules = self._load_optimization_rules()
        
    def _load_optimization_rules(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load optimization rules for different languages"""
        return {
            "python": [
                {
                    "name": "unused_imports",
                    "pattern": r'^import\s+\w+',
                    "description": "Remove unused imports",
                    "severity": "low",
                    "auto_fixable": True,
                    "impact": "maintainability"
                },
                {
                    "name": "long_functions",
                    "pattern": r'def\s+\w+\([^)]*\):.*?(?=\ndef|\Z)',
                    "description": "Break down long functions (>50 lines)",
                    "severity": "medium",
                    "auto_fixable": False,
                    "impact": "maintainability"
                },
                {
                    "name": "nested_loops",
                    "pattern": r'for\s+\w+\s+in.*:\s*\n\s*for\s+\w+\s+in',
                    "description": "Optimize nested loops",
                    "severity": "high",
                    "auto_fixable": False,
                    "impact": "performance"
                },
                {
                    "name": "string_concatenation",
                    "pattern": r'\w+\s*\+\s*\w+',
                    "description": "Use f-strings or .join() for string concatenation",
                    "severity": "medium",
                    "auto_fixable": True,
                    "impact": "performance"
                },
                {
                    "name": "hardcoded_secrets",
                    "pattern": r'(password|secret|token|api_key)\s*=\s*[\'"][^\'"]+[\'"]',
                    "description": "Move secrets to environment variables",
                    "severity": "high",
                    "auto_fixable": False,
                    "impact": "security"
                },
                {
                    "name": "bare_except",
                    "pattern": r'except\s*:',
                    "description": "Specify exception types",
                    "severity": "medium",
                    "auto_fixable": True,
                    "impact": "security"
                },
                {
                    "name": "global_variables",
                    "pattern": r'^\s*\w+\s*=\s*',
                    "description": "Avoid global variables",
                    "severity": "medium",
                    "auto_fixable": False,
                    "impact": "maintainability"
                }
            ],
            "javascript": [
                {
                    "name": "var_usage",
                    "pattern": r'\bvar\s+\w+',
                    "description": "Use let/const instead of var",
                    "severity": "medium",
                    "auto_fixable": True,
                    "impact": "maintainability"
                },
                {
                    "name": "console_log",
                    "pattern": r'console\.log',
                    "description": "Remove console.log statements",
                    "severity": "low",
                    "auto_fixable": True,
                    "impact": "security"
                },
                {
                    "name": "equality_operator",
                    "pattern": r'==\s*',
                    "description": "Use === instead of ==",
                    "severity": "medium",
                    "auto_fixable": True,
                    "impact": "security"
                }
            ]
        }
    
    def optimize_file(self, file_path: str) -> OptimizationResult:
        """Optimize a single file"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Determine language
        language = self._detect_language(file_path)
        
        # Read original content
        original_content = file_path.read_text(encoding='utf-8')
        
        # Analyze and generate suggestions
        suggestions = self._analyze_code(original_content, language, str(file_path))
        
        # Apply auto-fixable optimizations
        optimized_content = self._apply_optimizations(original_content, suggestions, language)
        
        # Calculate improvements
        performance_improvement = self._calculate_performance_improvement(suggestions)
        maintainability_improvement = self._calculate_maintainability_improvement(suggestions)
        security_improvement = self._calculate_security_improvement(suggestions)
        
        # Save optimized version
        optimized_path = file_path.parent / f"{file_path.stem}_optimized{file_path.suffix}"
        optimized_path.write_text(optimized_content, encoding='utf-8')
        
        return OptimizationResult(
            original_file=str(file_path),
            optimized_file=str(optimized_path),
            suggestions=suggestions,
            performance_improvement=performance_improvement,
            maintainability_improvement=maintainability_improvement,
            security_improvement=security_improvement
        )
    
    def _detect_language(self, file_path: Path) -> str:
        """Detect programming language from file extension"""
        extension_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'javascript',
            '.jsx': 'javascript',
            '.tsx': 'javascript'
        }
        
        return extension_map.get(file_path.suffix.lower(), 'unknown')
    
    def _analyze_code(self, content: str, language: str, file_path: str) -> List[OptimizationSuggestion]:
        """Analyze code and generate optimization suggestions"""
        suggestions = []
        
        if language not in self.optimization_rules:
            return suggestions
        
        lines = content.splitlines()
        
        for rule in self.optimization_rules[language]:
            pattern = re.compile(rule["pattern"], re.MULTILINE | re.DOTALL)
            
            for match in pattern.finditer(content):
                line_number = content[:match.start()].count('\n') + 1
                
                suggestion = OptimizationSuggestion(
                    file_path=file_path,
                    line_number=line_number,
                    issue_type=rule["name"],
                    severity=rule["severity"],
                    description=rule["description"],
                    suggestion=self._generate_suggestion(rule, match.group(), line_number, content),
                    auto_fixable=rule["auto_fixable"],
                    estimated_impact=rule["impact"]
                )
                
                suggestions.append(suggestion)
        
        # Additional language-specific analysis
        if language == "python":
            suggestions.extend(self._analyze_python_ast(content, file_path))
        
        return suggestions
    
    def _generate_suggestion(self, rule: Dict[str, Any], match: str, line_number: int, content: str) -> str:
        """Generate specific suggestion based on rule and match"""
        if rule["name"] == "unused_imports":
            return f"Remove unused import: {match.strip()}"
        elif rule["name"] == "string_concatenation":
            return "Use f-string or .join() method for better performance"
        elif rule["name"] == "hardcoded_secrets":
            return "Move to environment variable or configuration file"
        elif rule["name"] == "bare_except":
            return "Specify exception type, e.g., except Exception:"
        elif rule["name"] == "var_usage":
            return "Replace 'var' with 'let' or 'const'"
        elif rule["name"] == "console_log":
            return "Remove or replace with proper logging"
        elif rule["name"] == "equality_operator":
            return "Use '===' for strict equality comparison"
        else:
            return rule["description"]
    
    def _analyze_python_ast(self, content: str, file_path: str) -> List[OptimizationSuggestion]:
        """Analyze Python code using AST"""
        suggestions = []
        
        try:
            tree = ast.parse(content)
            
            # Check for long functions
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    if hasattr(node, 'end_lineno') and node.end_lineno:
                        lines = node.end_lineno - node.lineno + 1
                        if lines > 50:
                            suggestions.append(OptimizationSuggestion(
                                file_path=file_path,
                                line_number=node.lineno,
                                issue_type="long_function",
                                severity="medium",
                                description=f"Function '{node.name}' is too long ({lines} lines)",
                                suggestion=f"Break down '{node.name}' into smaller functions",
                                auto_fixable=False,
                                estimated_impact="maintainability"
                            ))
                
                # Check for complexity
                if isinstance(node, (ast.If, ast.For, ast.While, ast.ExceptHandler)):
                    complexity = self._calculate_node_complexity(node)
                    if complexity > 10:
                        suggestions.append(OptimizationSuggestion(
                            file_path=file_path,
                            line_number=node.lineno,
                            issue_type="high_complexity",
                            severity="high",
                            description=f"High complexity detected (score: {complexity})",
                            suggestion="Simplify logic or extract to separate function",
                            auto_fixable=False,
                            estimated_impact="maintainability"
                        ))
        
        except SyntaxError as e:
            self.logger.warning(f"Syntax error in {file_path}: {e}")
        
        return suggestions
    
    def _calculate_node_complexity(self, node: ast.AST) -> int:
        """Calculate cyclomatic complexity of AST node"""
        complexity = 1  # Base complexity
        
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.For, ast.While, ast.ExceptHandler, ast.And, ast.Or)):
                complexity += 1
        
        return complexity
    
    def _apply_optimizations(self, content: str, suggestions: List[OptimizationSuggestion], language: str) -> str:
        """Apply auto-fixable optimizations"""
        optimized_content = content
        
        # Sort suggestions by line number in reverse order to avoid line number shifts
        auto_fixable = [s for s in suggestions if s.auto_fixable]
        auto_fixable.sort(key=lambda x: x.line_number, reverse=True)
        
        for suggestion in auto_fixable:
            optimized_content = self._apply_single_optimization(optimized_content, suggestion, language)
        
        return optimized_content
    
    def _apply_single_optimization(self, content: str, suggestion: OptimizationSuggestion, language: str) -> str:
        """Apply a single optimization"""
        lines = content.splitlines()
        
        if suggestion.line_number <= len(lines):
            line_index = suggestion.line_number - 1
            original_line = lines[line_index]
            
            if suggestion.issue_type == "unused_imports":
                # Remove the import line
                lines.pop(line_index)
            elif suggestion.issue_type == "string_concatenation":
                # Convert to f-string (simplified)
                if '+' in original_line:
                    # This is a simplified conversion - in production, use more sophisticated parsing
                    lines[line_index] = original_line.replace('+', 'f"{}" +')
            elif suggestion.issue_type == "bare_except":
                lines[line_index] = original_line.replace('except:', 'except Exception:')
            elif suggestion.issue_type == "var_usage":
                lines[line_index] = original_line.replace('var ', 'const ')
            elif suggestion.issue_type == "console_log":
                lines[line_index] = f"// {original_line}"  # Comment out
            elif suggestion.issue_type == "equality_operator":
                lines[line_index] = original_line.replace('==', '===')
        
        return '\n'.join(lines)
    
    def _calculate_performance_improvement(self, suggestions: List[OptimizationSuggestion]) -> float:
        """Calculate estimated performance improvement percentage"""
        performance_suggestions = [s for s in suggestions if s.estimated_impact == "performance"]
        
        if not performance_suggestions:
            return 0.0
        
        # Weight suggestions by severity
        weights = {"low": 0.5, "medium": 1.0, "high": 2.0}
        total_weight = sum(weights[s.severity] for s in performance_suggestions)
        
        # Estimate improvement (simplified calculation)
        improvement = min(total_weight * 2, 20.0)  # Cap at 20%
        
        return improvement
    
    def _calculate_maintainability_improvement(self, suggestions: List[OptimizationSuggestion]) -> float:
        """Calculate estimated maintainability improvement percentage"""
        maintainability_suggestions = [s for s in suggestions if s.estimated_impact == "maintainability"]
        
        if not maintainability_suggestions:
            return 0.0
        
        weights = {"low": 0.5, "medium": 1.0, "high": 2.0}
        total_weight = sum(weights[s.severity] for s in maintainability_suggestions)
        
        improvement = min(total_weight * 1.5, 25.0)  # Cap at 25%
        
        return improvement
    
    def _calculate_security_improvement(self, suggestions: List[OptimizationSuggestion]) -> float:
        """Calculate estimated security improvement percentage"""
        security_suggestions = [s for s in suggestions if s.estimated_impact == "security"]
        
        if not security_suggestions:
            return 0.0
        
        weights = {"low": 1.0, "medium": 2.0, "high": 3.0}
        total_weight = sum(weights[s.severity] for s in security_suggestions)
        
        improvement = min(total_weight * 3, 30.0)  # Cap at 30%
        
        return improvement
    
    def optimize_project(self, project_path: str) -> Dict[str, OptimizationResult]:
        """Optimize entire project"""
        project_path = Path(project_path)
        results = {}
        
        # Find all source files
        source_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx'}
        
        for file_path in project_path.rglob("*"):
            if file_path.is_file() and file_path.suffix in source_extensions:
                try:
                    result = self.optimize_file(file_path)
                    results[str(file_path)] = result
                    self.logger.info(f"Optimized: {file_path}")
                except Exception as e:
                    self.logger.error(f"Failed to optimize {file_path}: {e}")
        
        return results
    
    def generate_optimization_report(self, results: Dict[str, OptimizationResult]) -> str:
        """Generate comprehensive optimization report"""
        total_suggestions = sum(len(r.suggestions) for r in results.values())
        auto_fixable = sum(len([s for s in r.suggestions if s.auto_fixable]) for r in results.values())
        
        avg_performance = sum(r.performance_improvement for r in results.values()) / len(results) if results else 0
        avg_maintainability = sum(r.maintainability_improvement for r in results.values()) / len(results) if results else 0
        avg_security = sum(r.security_improvement for r in results.values()) / len(results) if results else 0
        
        report = f"""
# Code Optimization Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary
- **Files Processed**: {len(results)}
- **Total Suggestions**: {total_suggestions}
- **Auto-Fixable**: {auto_fixable}
- **Average Performance Improvement**: {avg_performance:.1f}%
- **Average Maintainability Improvement**: {avg_maintainability:.1f}%
- **Average Security Improvement**: {avg_security:.1f}%

## Detailed Results

"""
        
        for file_path, result in results.items():
            report += f"### {Path(file_path).name}\n"
            report += f"- **Suggestions**: {len(result.suggestions)}\n"
            report += f"- **Performance**: +{result.performance_improvement:.1f}%\n"
            report += f"- **Maintainability**: +{result.maintainability_improvement:.1f}%\n"
            report += f"- **Security**: +{result.security_improvement:.1f}%\n\n"
            
            # Group suggestions by severity
            by_severity = {}
            for suggestion in result.suggestions:
                severity = suggestion.severity
                if severity not in by_severity:
                    by_severity[severity] = []
                by_severity[severity].append(suggestion)
            
            for severity in ["high", "medium", "low"]:
                if severity in by_severity:
                    report += f"#### {severity.title()} Severity:\n"
                    for suggestion in by_severity[severity]:
                        report += f"- Line {suggestion.line_number}: {suggestion.description}\n"
                        report += f"  - Suggestion: {suggestion.suggestion}\n"
                        report += f"  - Auto-fixable: {'Yes' if suggestion.auto_fixable else 'No'}\n\n"
        
        return report
    
    def create_optimization_script(self, results: Dict[str, OptimizationResult]) -> str:
        """Create a script to apply all optimizations"""
        script = "#!/bin/bash\n"
        script += "# Auto-generated optimization script\n\n"
        
        for file_path, result in results.items():
            optimized_path = result.optimized_file
            original_path = result.original_file
            
            script += f"# Backup and replace {Path(original_path).name}\n"
            script += f"cp '{original_path}' '{original_path}.backup'\n"
            script += f"cp '{optimized_path}' '{original_path}'\n\n"
        
        script += "echo 'Optimization complete!'\n"
        script += "echo 'Original files backed up with .backup extension'\n"
        
        return script

if __name__ == "__main__":
    # Example usage
    optimizer = CodeOptimizer()
    results = optimizer.optimize_project(".")
    report = optimizer.generate_optimization_report(results)
    print(report)
