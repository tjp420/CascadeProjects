#!/usr/bin/env python3
"""
Automated Testing and Validation System
Generates comprehensive tests and validates code quality automatically
"""

import ast
import json
import subprocess
import unittest
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import logging
import importlib.util
import sys

@dataclass
class TestSuite:
    name: str
    file_path: str
    test_cases: List[Dict[str, Any]]
    coverage_target: float
    status: str = "pending"

@dataclass
class TestResult:
    suite_name: str
    tests_run: int
    tests_passed: int
    tests_failed: int
    coverage_percentage: float
    execution_time: float
    errors: List[str]

@dataclass
class ValidationReport:
    project_path: str
    test_suites: List[TestResult]
    overall_coverage: float
    quality_score: float
    recommendations: List[str]

class AutomatedTestingSystem:
    """Comprehensive automated testing and validation system"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.logger = logging.getLogger("AutomatedTesting")
        self.test_templates = self._load_test_templates()
        
    def _load_test_templates(self) -> Dict[str, str]:
        """Load test templates for different languages and frameworks"""
        return {
            "python_unit": '''import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

{{imports}}

class Test{{ClassName}}(unittest.TestCase):
    """
    Automated test suite for {{ClassName}}
    Generated on: {{timestamp}}
    """
    
    def setUp(self):
        """Set up test fixtures"""
        {{setup_code}}
    
    def tearDown(self):
        """Clean up after tests"""
        {{teardown_code}}
    
    {{test_methods}}
    
    def test_edge_cases(self):
        """Test edge cases and boundary conditions"""
        {{edge_case_tests}}
    
    def test_error_handling(self):
        """Test error handling and exceptions"""
        {{error_tests}}

if __name__ == '__main__':
    unittest.main()
''',
            "python_integration": '''import unittest
import asyncio
from unittest.mock import patch, AsyncMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

{{imports}}

class Test{{ClassName}}Integration(unittest.TestCase):
    """
    Integration tests for {{ClassName}}
    Generated on: {{timestamp}}
    """
    
    def setUp(self):
        """Set up integration test fixtures"""
        {{setup_code}}
    
    @patch('{{external_dependencies}}')
    def test_full_workflow(self, mock_deps):
        """Test complete workflow"""
        {{workflow_test}}
    
    def test_api_integration(self):
        """Test API integration points"""
        {{api_tests}}
    
    def test_database_integration(self):
        """Test database operations"""
        {{database_tests}}

if __name__ == '__main__':
    unittest.main()
''',
            "javascript_unit": '''const {{ClassName}} = require('../{{module_path}}');

describe('{{ClassName}}', () => {
    let instance;
    
    beforeEach(() => {
        {{setup_code}}
    });
    
    afterEach(() => {
        {{teardown_code}}
    });
    
    {{test_methods}}
    
    describe('Edge Cases', () => {
        {{edge_case_tests}}
    });
    
    describe('Error Handling', () => {
        {{error_tests}}
    });
});
''',
            "api_tests": '''import pytest
import requests
from unittest.mock import patch, Mock
import json

class TestAPIEndpoints:
    """
    Automated API endpoint tests
    Generated on: {{timestamp}}
    """
    
    BASE_URL = "{{base_url}}"
    
    @patch('requests.get')
    def test_get_endpoint(self, mock_get):
        """Test GET endpoint"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {{mock_response}}
        mock_get.return_value = mock_response
        
        response = requests.get(f"{self.BASE_URL}/{{endpoint}}")
        
        assert response.status_code == 200
        {{assertions}}
    
    @patch('requests.post')
    def test_post_endpoint(self, mock_post):
        """Test POST endpoint"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {{mock_response}}
        mock_post.return_value = mock_response
        
        data = {{request_data}}
        response = requests.post(f"{self.BASE_URL}/{{endpoint}}", json=data)
        
        assert response.status_code == 201
        {{assertions}}
    
    def test_endpoint_validation(self):
        """Test input validation"""
        {{validation_tests}}
    
    def test_endpoint_error_handling(self):
        """Test error handling"""
        {{error_tests}}
'''
        }
    
    def analyze_code_for_testing(self) -> List[Dict[str, Any]]:
        """Analyze codebase to identify testing needs"""
        testable_modules = []
        
        # Find Python modules
        for file_path in self.project_path.rglob("*.py"):
            if file_path.name != "__init__.py" and "test" not in file_path.name.lower():
                module_info = self._analyze_python_module(file_path)
                if module_info:
                    testable_modules.append(module_info)
        
        # Find JavaScript modules
        for file_path in self.project_path.rglob("*.js"):
            if "test" not in file_path.name.lower() and "node_modules" not in str(file_path):
                module_info = self._analyze_javascript_module(file_path)
                if module_info:
                    testable_modules.append(module_info)
        
        return testable_modules
    
    def _analyze_python_module(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Analyze Python module for test generation"""
        try:
            content = file_path.read_text(encoding='utf-8')
            tree = ast.parse(content)
            
            classes = []
            functions = []
            imports = []
            
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    methods = []
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef) and item.name.startswith('_') is False:
                            methods.append({
                                'name': item.name,
                                'args': [arg.arg for arg in item.args.args],
                                'returns': self._get_return_type(item)
                            })
                    
                    classes.append({
                        'name': node.name,
                        'methods': methods,
                        'base_classes': [base.id for base in node.bases if isinstance(base, ast.Name)]
                    })
                
                elif isinstance(node, ast.FunctionDef) and node.name.startswith('_') is False:
                    functions.append({
                        'name': node.name,
                        'args': [arg.arg for arg in node.args.args],
                        'returns': self._get_return_type(node)
                    })
                
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    if isinstance(node, ast.Import):
                        imports.extend([alias.name for alias in node.names])
                    else:
                        imports.append(node.module)
            
            return {
                'file_path': str(file_path),
                'module_name': file_path.stem,
                'language': 'python',
                'classes': classes,
                'functions': functions,
                'imports': imports,
                'complexity': self._calculate_module_complexity(tree)
            }
        
        except Exception as e:
            self.logger.error(f"Error analyzing {file_path}: {e}")
            return None
    
    def _analyze_javascript_module(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Analyze JavaScript module for test generation"""
        try:
            content = file_path.read_text(encoding='utf-8')
            
            # Simple regex-based analysis (in production, use proper JS parser)
            functions = []
            classes = []
            
            # Find functions
            func_pattern = r'(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))'
            for match in re.finditer(func_pattern, content):
                func_name = match.group(1) or match.group(2)
                if func_name:
                    functions.append({'name': func_name, 'args': []})
            
            # Find classes
            class_pattern = r'class\s+(\w+)'
            for match in re.finditer(class_pattern, content):
                classes.append({'name': match.group(1), 'methods': []})
            
            return {
                'file_path': str(file_path),
                'module_name': file_path.stem,
                'language': 'javascript',
                'classes': classes,
                'functions': functions,
                'imports': [],
                'complexity': len(functions) + len(classes)
            }
        
        except Exception as e:
            self.logger.error(f"Error analyzing {file_path}: {e}")
            return None
    
    def _get_return_type(self, node: ast.FunctionDef) -> str:
        """Extract return type from function node"""
        if node.returns:
            if isinstance(node.returns, ast.Name):
                return node.returns.id
            elif isinstance(node.returns, ast.Constant):
                return str(node.returns.value)
        return "Any"
    
    def _calculate_module_complexity(self, tree: ast.AST) -> int:
        """Calculate cyclomatic complexity of module"""
        complexity = 0
        
        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.For, ast.While, ast.ExceptHandler, ast.And, ast.Or)):
                complexity += 1
        
        return complexity
    
    def generate_tests(self, modules: List[Dict[str, Any]]) -> List[TestSuite]:
        """Generate comprehensive test suites"""
        test_suites = []
        
        for module in modules:
            if module['language'] == 'python':
                suite = self._generate_python_tests(module)
            elif module['language'] == 'javascript':
                suite = self._generate_javascript_tests(module)
            else:
                continue
            
            if suite:
                test_suites.append(suite)
        
        return test_suites
    
    def _generate_python_tests(self, module: Dict[str, Any]) -> Optional[TestSuite]:
        """Generate Python test suite"""
        test_cases = []
        
        # Generate tests for each class
        for class_info in module['classes']:
            test_methods = []
            
            for method in class_info['methods']:
                test_method = self._generate_test_method(method, class_info['name'])
                test_methods.append(test_method)
            
            test_cases.append({
                'type': 'class',
                'name': class_info['name'],
                'test_methods': test_methods
            })
        
        # Generate tests for standalone functions
        for func in module['functions']:
            test_method = self._generate_test_method(func, module['module_name'])
            test_cases.append({
                'type': 'function',
                'name': func['name'],
                'test_methods': [test_method]
            })
        
        # Create test file content
        test_content = self._create_python_test_content(module, test_cases)
        
        # Save test file
        test_dir = self.project_path / "tests"
        test_dir.mkdir(exist_ok=True)
        
        test_file = test_dir / f"test_{module['module_name']}.py"
        test_file.write_text(test_content, encoding='utf-8')
        
        return TestSuite(
            name=f"test_{module['module_name']}",
            file_path=str(test_file),
            test_cases=test_cases,
            coverage_target=80.0
        )
    
    def _generate_javascript_tests(self, module: Dict[str, Any]) -> Optional[TestSuite]:
        """Generate JavaScript test suite"""
        test_cases = []
        
        # Generate tests for each class
        for class_info in module['classes']:
            test_methods = []
            
            for method in class_info['methods']:
                test_method = self._generate_js_test_method(method, class_info['name'])
                test_methods.append(test_method)
            
            test_cases.append({
                'type': 'class',
                'name': class_info['name'],
                'test_methods': test_methods
            })
        
        # Generate tests for standalone functions
        for func in module['functions']:
            test_method = self._generate_js_test_method(func, module['module_name'])
            test_cases.append({
                'type': 'function',
                'name': func['name'],
                'test_methods': [test_method]
            })
        
        # Create test file content
        test_content = self._create_js_test_content(module, test_cases)
        
        # Save test file
        test_dir = self.project_path / "tests"
        test_dir.mkdir(exist_ok=True)
        
        test_file = test_dir / f"{module['module_name']}.test.js"
        test_file.write_text(test_content, encoding='utf-8')
        
        return TestSuite(
            name=f"{module['module_name']}.test",
            file_path=str(test_file),
            test_cases=test_cases,
            coverage_target=80.0
        )
    
    def _generate_test_method(self, method: Dict[str, Any], class_name: str) -> str:
        """Generate a single test method"""
        method_name = method['name']
        test_name = f"test_{method_name}"
        
        # Generate test based on method name and parameters
        if method_name.startswith('get'):
            return f'''    def {test_name}(self):
        """Test {method_name} method"""
        # Arrange
        test_data = {{}}
        
        # Act
        result = self.instance.{method_name}({', '.join(['test_data'] * len(method['args']))})
        
        # Assert
        self.assertIsNotNone(result)
        self.assertIsInstance(result, {method['returns']})'''
        
        elif method_name.startswith('set'):
            return f'''    def {test_name}(self):
        """Test {method_name} method"""
        # Arrange
        test_value = "test_value"
        
        # Act
        self.instance.{method_name}({', '.join(['test_value'] * len(method['args']))})
        
        # Assert
        # Add assertions based on what should be set'''
        
        elif method_name.startswith('create'):
            return f'''    def {test_name}(self):
        """Test {method_name} method"""
        # Arrange
        test_data = {{"key": "value"}}
        
        # Act
        result = self.instance.{method_name}({', '.join(['test_data'] * len(method['args']))})
        
        # Assert
        self.assertIsNotNone(result)
        self.assertTrue(hasattr(result, 'id'))'''
        
        else:
            return f'''    def {test_name}(self):
        """Test {method_name} method"""
        # Arrange
        # Set up test data
        
        # Act
        result = self.instance.{method_name}({', '.join(['test_data'] * len(method['args']))})
        
        # Assert
        self.assertIsNotNone(result)'''
    
    def _generate_js_test_method(self, method: Dict[str, Any], class_name: str) -> str:
        """Generate JavaScript test method"""
        method_name = method['name']
        test_name = f"should {method_name} correctly"
        
        return f'''    it('{test_name}', () => {{
        // Arrange
        const testData = {{}};
        
        // Act
        const result = instance.{method_name}({', '.join(['testData'] * len(method['args']))});
        
        // Assert
        expect(result).toBeDefined();
    }});'''
    
    def _create_python_test_content(self, module: Dict[str, Any], test_cases: List[Dict[str, Any]]) -> str:
        """Create complete Python test file content"""
        imports = []
        for imp in module['imports']:
            if imp and imp != module['module_name']:
                imports.append(f"from {module['module_name']} import {module['module_name']}")
        
        if not imports:
            imports.append(f"from {module['module_name']} import {module['module_name']}")
        
        template = self.test_templates["python_unit"]
        
        # Collect all test methods
        all_test_methods = []
        for test_case in test_cases:
            all_test_methods.extend(test_case['test_methods'])
        
        return template.format(
            imports='\n'.join(imports),
            ClassName=module['module_name'].title(),
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            setup_code="self.instance = " + module['module_name'] + + "()",
            teardown_code="pass",
            test_methods='\n\n'.join(all_test_methods),
            edge_case_tests="# Add edge case tests here",
            error_tests="# Add error handling tests here"
        )
    
    def _create_js_test_content(self, module: Dict[str, Any], test_cases: List[Dict[str, Any]]) -> str:
        """Create complete JavaScript test file content"""
        template = self.test_templates["javascript_unit"]
        
        # Collect all test methods
        all_test_methods = []
        for test_case in test_cases:
            all_test_methods.extend(test_case['test_methods'])
        
        return template.format(
            ClassName=module['module_name'].title(),
            module_path=f"../{module['module_name']}",
            setup_code=f"instance = new {module['module_name'].title()}();",
            teardown_code="instance = null;",
            test_methods='\n\n'.join(all_test_methods),
            edge_case_tests="// Add edge case tests here",
            error_tests="// Add error handling tests here"
        )
    
    def run_tests(self, test_suites: List[TestSuite]) -> List[TestResult]:
        """Run all test suites and collect results"""
        results = []
        
        for suite in test_suites:
            result = self._run_test_suite(suite)
            results.append(result)
        
        return results
    
    def _run_test_suite(self, suite: TestSuite) -> TestResult:
        """Run a single test suite"""
        start_time = datetime.now()
        
        try:
            if suite.file_path.endswith('.py'):
                result = self._run_python_tests(suite)
            elif suite.file_path.endswith('.js'):
                result = self._run_javascript_tests(suite)
            else:
                raise ValueError(f"Unsupported test file type: {suite.file_path}")
            
            result.execution_time = (datetime.now() - start_time).total_seconds()
            return result
        
        except Exception as e:
            self.logger.error(f"Error running test suite {suite.name}: {e}")
            return TestResult(
                suite_name=suite.name,
                tests_run=0,
                tests_passed=0,
                tests_failed=0,
                coverage_percentage=0.0,
                execution_time=(datetime.now() - start_time).total_seconds(),
                errors=[str(e)]
            )
    
    def _run_python_tests(self, suite: TestSuite) -> TestResult:
        """Run Python tests using unittest"""
        try:
            # Run tests with coverage
            result = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([
                sys.executable, "-m", "coverage", "run", "-m", "unittest",
                suite.file_path, "-v"
            ], capture_output=True, text=True, cwd=self.project_path)
            
            # Parse output
            output = result.stdout + result.stderr
            tests_run = self._extract_test_count(output)
            tests_failed = self._extract_failure_count(output)
            tests_passed = tests_run - tests_failed
            
            # Get coverage
            coverage_result = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([
                sys.executable, "-m", "coverage", "report", "--format=json"
            ], capture_output=True, text=True, cwd=self.project_path)
            
            coverage_percentage = 0.0
            try:
                coverage_data = json.loads(coverage_result.stdout)
                coverage_percentage = coverage_data.get('totals', {}).get('percent_covered', 0.0)
            except:
                pass
            
            errors = []
            if result.returncode != 0:
                errors.append("Test execution failed")
            
            return TestResult(
                suite_name=suite.name,
                tests_run=tests_run,
                tests_passed=tests_passed,
                tests_failed=tests_failed,
                coverage_percentage=coverage_percentage,
                execution_time=0.0,  # Will be set by caller
                errors=errors
            )
        
        except Exception as e:
            return TestResult(
                suite_name=suite.name,
                tests_run=0,
                tests_passed=0,
                tests_failed=0,
                coverage_percentage=0.0,
                execution_time=0.0,
                errors=[str(e)]
            )
    
    def _run_javascript_tests(self, suite: TestSuite) -> TestResult:
        """Run JavaScript tests using Jest"""
        try:
            # Check if Jest is available
            result = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([
                "npx", "jest", suite.file_path, "--coverage", "--json"
            ], capture_output=True, text=True, cwd=self.project_path)
            
            # Parse Jest output
            output = result.stdout
            tests_run = self._extract_jest_test_count(output)
            tests_failed = self._extract_jest_failure_count(output)
            tests_passed = tests_run - tests_failed
            
            # Extract coverage
            coverage_percentage = self._extract_jest_coverage(output)
            
            errors = []
            if result.returncode != 0:
                errors.append("Test execution failed")
            
            return TestResult(
                suite_name=suite.name,
                tests_run=tests_run,
                tests_passed=tests_passed,
                tests_failed=tests_failed,
                coverage_percentage=coverage_percentage,
                execution_time=0.0,  # Will be set by caller
                errors=errors
            )
        
        except Exception as e:
            return TestResult(
                suite_name=suite.name,
                tests_run=0,
                tests_passed=0,
                tests_failed=0,
                coverage_percentage=0.0,
                execution_time=0.0,
                errors=[str(e)]
            )
    
    def _extract_test_count(self, output: str) -> int:
        """Extract test count from unittest output"""
        import re
        match = re.search(r'Ran (\d+) test', output)
        return int(match.group(1)) if match else 0
    
    def _extract_failure_count(self, output: str) -> int:
        """Extract failure count from unittest output"""
        import re
        match = re.search(r'FAILED \((\d+)\)', output)
        return int(match.group(1)) if match else 0
    
    def _extract_jest_test_count(self, output: str) -> int:
        """Extract test count from Jest output"""
        import re
        match = re.search(r'Tests:\s+(\d+)', output)
        return int(match.group(1)) if match else 0
    
    def _extract_jest_failure_count(self, output: str) -> int:
        """Extract failure count from Jest output"""
        import re
        match = re.search(r'Failed:\s+(\d+)', output)
        return int(match.group(1)) if match else 0
    
    def _extract_jest_coverage(self, output: str) -> float:
        """Extract coverage percentage from Jest output"""
        import re
        match = re.search(r'All files\s+\|\s+([\d.]+)', output)
        return float(match.group(1)) if match else 0.0
    
    def generate_validation_report(self, test_results: List[TestResult]) -> ValidationReport:
        """Generate comprehensive validation report"""
        total_tests = sum(r.tests_run for r in test_results)
        total_passed = sum(r.tests_passed for r in test_results)
        total_failed = sum(r.tests_failed for r in test_results)
        
        overall_coverage = sum(r.coverage_percentage for r in test_results) / len(test_results) if test_results else 0.0
        
        # Calculate quality score
        pass_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
        quality_score = (pass_rate + overall_coverage) / 2
        
        # Generate recommendations
        recommendations = self._generate_recommendations(test_results)
        
        return ValidationReport(
            project_path=str(self.project_path),
            test_suites=test_results,
            overall_coverage=overall_coverage,
            quality_score=quality_score,
            recommendations=recommendations
        )
    
    def _generate_recommendations(self, test_results: List[TestResult]) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []
        
        total_tests = sum(r.tests_run for r in test_results)
        total_failed = sum(r.tests_failed for r in test_results)
        avg_coverage = sum(r.coverage_percentage for r in test_results) / len(test_results) if test_results else 0
        
        if total_failed > 0:
            recommendations.append(f"Fix {total_failed} failing tests to improve reliability")
        
        if avg_coverage < 80:
            recommendations.append(f"Increase test coverage from {avg_coverage:.1f}% to 80%+")
        
        if total_tests < 50:
            recommendations.append("Add more test cases to improve test coverage")
        
        for result in test_results:
            if result.errors:
                recommendations.append(f"Fix test execution errors in {result.suite_name}")
        
        return recommendations

if __name__ == "__main__":
    # Example usage
    tester = AutomatedTestingSystem(".")
    modules = tester.analyze_code_for_testing()
    test_suites = tester.generate_tests(modules)
    results = tester.run_tests(test_suites)
    report = tester.generate_validation_report(results)
    print(f"Generated report with quality score: {report.quality_score:.1f}")
