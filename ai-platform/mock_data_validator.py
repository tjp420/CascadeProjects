#!/usr/bin/env python3
"""
Mock Data Validator
Automated validation system based on GGUF AI insights
Prevents future issues and maintains data quality
"""

import json
import os
import re
from typing import Dict, List, Any, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

class ValidationSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class ValidationResult:
    severity: ValidationSeverity
    issue_type: str
    description: str
    file_path: str
    location: str
    recommended_action: str
    line_number: int = -1

class MockDataValidator:
    def __init__(self):
        self.validation_rules = self._setup_validation_rules()
        self.results: List[ValidationResult] = []
        
    def _setup_validation_rules(self) -> Dict[str, Any]:
        """Setup validation rules based on GGUF AI insights"""
        return {
            'required_fields': {
                'user_profile': ['id', 'username', 'email', 'timestamp', 'status'],
                'api_response': ['status', 'data', 'timestamp', 'request_id'],
                'analytics': ['metric_name', 'value', 'timestamp', 'category'],
                'configuration': ['key', 'value', 'environment', 'version'],
                'test_scenario': ['test_id', 'description', 'expected_result', 'actual_result']
            },
            'data_patterns': {
                'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
                'timestamp': r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$',
                'uuid': r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                'status': r'^(active|inactive|pending|completed|failed|success)$'
            },
            'field_types': {
                'id': str,
                'timestamp': str,
                'status': str,
                'value': (int, float, str),
                'count': int,
                'size': (int, float)
            }
        }
    
    def validate_file(self, file_path: str) -> List[ValidationResult]:
        """Validate a single mock data file"""
        results = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Determine data type based on file name
            data_type = self._determine_data_type(file_path)
            
            # Validate structure
            if isinstance(data, list):
                for i, item in enumerate(data):
                    results.extend(self._validate_item(item, file_path, f"[{i}]", data_type))
            elif isinstance(data, dict):
                results.extend(self._validate_item(data, file_path, "root", data_type))
            else:
                results.append(ValidationResult(
                    severity=ValidationSeverity.HIGH,
                    issue_type="Invalid Structure",
                    description="Root element must be object or array",
                    file_path=file_path,
                    location="root",
                    recommended_action="Restructure data as object or array"
                ))
                
        except json.JSONDecodeError as e:
            results.append(ValidationResult(
                severity=ValidationSeverity.CRITICAL,
                issue_type="JSON Syntax Error",
                description=f"Invalid JSON syntax: {str(e)}",
                file_path=file_path,
                location="syntax",
                recommended_action="Fix JSON syntax errors"
            ))
        except Exception as e:
            results.append(ValidationResult(
                severity=ValidationSeverity.HIGH,
                issue_type="File Access Error",
                description=f"Error reading file: {str(e)}",
                file_path=file_path,
                location="file",
                recommended_action="Check file permissions and format"
            ))
        
        return results
    
    def _determine_data_type(self, file_path: str) -> str:
        """Determine data type from file name"""
        file_name = os.path.basename(file_path).lower()
        
        if 'user' in file_name or 'profile' in file_name:
            return 'user_profile'
        elif 'api' in file_name or 'response' in file_name:
            return 'api_response'
        elif 'analytics' in file_name or 'metric' in file_name:
            return 'analytics'
        elif 'config' in file_name or 'setting' in file_name:
            return 'configuration'
        elif 'test' in file_name or 'scenario' in file_name:
            return 'test_scenario'
        else:
            return 'generic'
    
    def _validate_item(self, item: Any, file_path: str, location: str, data_type: str) -> List[ValidationResult]:
        """Validate a single data item"""
        results = []
        
        if not isinstance(item, dict):
            results.append(ValidationResult(
                severity=ValidationSeverity.MEDIUM,
                issue_type="Invalid Item Type",
                description="Item must be an object",
                file_path=file_path,
                location=location,
                recommended_action="Convert item to object"
            ))
            return results
        
        # Check required fields
        if data_type in self.validation_rules['required_fields']:
            required_fields = self.validation_rules['required_fields'][data_type]
            for field in required_fields:
                if field not in item:
                    results.append(ValidationResult(
                        severity=ValidationSeverity.HIGH,
                        issue_type="Missing Required Field",
                        description=f"Required field '{field}' is missing",
                        file_path=file_path,
                        location=f"{location}.{field}",
                        recommended_action=f"Add required field '{field}'"
                    ))
        
        # Validate field patterns
        for field, value in item.items():
            if isinstance(value, str):
                # Check email pattern
                if field.lower() in ['email', 'email_address']:
                    if not re.match(self.validation_rules['data_patterns']['email'], value):
                        results.append(ValidationResult(
                            severity=ValidationSeverity.MEDIUM,
                            issue_type="Invalid Email Format",
                            description=f"Invalid email format: {value}",
                            file_path=file_path,
                            location=f"{location}.{field}",
                            recommended_action="Use valid email format"
                        ))
                
                # Check timestamp pattern
                elif field.lower() in ['timestamp', 'created_at', 'updated_at']:
                    if not re.match(self.validation_rules['data_patterns']['timestamp'], value):
                        results.append(ValidationResult(
                            severity=ValidationSeverity.MEDIUM,
                            issue_type="Invalid Timestamp Format",
                            description=f"Invalid timestamp format: {value}",
                            file_path=file_path,
                            location=f"{location}.{field}",
                            recommended_action="Use ISO 8601 timestamp format"
                        ))
                
                # Check status pattern
                elif field.lower() == 'status':
                    if not re.match(self.validation_rules['data_patterns']['status'], value):
                        results.append(ValidationResult(
                            severity=ValidationSeverity.LOW,
                            issue_type="Invalid Status Value",
                            description=f"Invalid status value: {value}",
                            file_path=file_path,
                            location=f"{location}.{field}",
                            recommended_action="Use valid status: active, inactive, pending, completed, failed, success"
                        ))
        
        return results
    
    def validate_directory(self, directory_path: str) -> Dict[str, Any]:
        """Validate all mock data files in directory"""
        all_results = []
        file_count = 0
        
        print(f"🔍 Starting validation in: {directory_path}")
        
        for root, dirs, files in os.walk(directory_path):
            for file in files:
                if file.endswith('.json') and 'mock' in file.lower():
                    file_path = os.path.join(root, file)
                    print(f"📁 Validating: {file_path}")
                    
                    file_results = self.validate_file(file_path)
                    all_results.extend(file_results)
                    file_count += 1
        
        # Generate summary
        summary = self._generate_summary(all_results, file_count)
        
        # Save detailed report
        self._save_validation_report(all_results, summary, directory_path)
        
        return summary
    
    def _generate_summary(self, results: List[ValidationResult], file_count: int) -> Dict[str, Any]:
        """Generate validation summary"""
        severity_counts = {severity.value: 0 for severity in ValidationSeverity}
        issue_type_counts = {}
        
        for result in results:
            severity_counts[result.severity.value] += 1
            issue_type_counts[result.issue_type] = issue_type_counts.get(result.issue_type, 0) + 1
        
        return {
            'validation_date': datetime.now().isoformat(),
            'files_validated': file_count,
            'total_issues': len(results),
            'severity_breakdown': severity_counts,
            'issue_type_breakdown': issue_type_counts,
            'quality_score': max(0, 100 - (len(results) * 2)),  # Simple quality score
            'recommendations': self._generate_recommendations(results)
        }
    
    def _generate_recommendations(self, results: List[ValidationResult]) -> List[str]:
        """Generate recommendations based on validation results"""
        recommendations = []
        
        # High priority recommendations
        critical_issues = [r for r in results if r.severity == ValidationSeverity.CRITICAL]
        if critical_issues:
            recommendations.append("🚨 Address critical issues immediately - they prevent system functionality")
        
        high_issues = [r for r in results if r.severity == ValidationSeverity.HIGH]
        if high_issues:
            recommendations.append("🔴 Fix high-priority issues - they impact data integrity")
        
        # Common patterns
        missing_fields = [r for r in results if r.issue_type == "Missing Required Field"]
        if len(missing_fields) > 5:
            recommendations.append("📋 Create mock data templates to ensure consistent required fields")
        
        format_issues = [r for r in results if "Invalid" in r.issue_type and "Format" in r.issue_type]
        if len(format_issues) > 10:
            recommendations.append("🔧 Implement automated formatting validation in development workflow")
        
        return recommendations
    
    def _save_validation_report(self, results: List[ValidationResult], summary: Dict[str, Any], directory_path: str):
        """Save detailed validation report"""
        report = {
            'summary': summary,
            'detailed_results': [
                {
                    'severity': result.severity.value,
                    'issue_type': result.issue_type,
                    'description': result.description,
                    'file_path': result.file_path,
                    'location': result.location,
                    'recommended_action': result.recommended_action
                }
                for result in results
            ]
        }
        
        report_path = os.path.join(directory_path, 'mock_data_validation_report.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        print(f"📄 Validation report saved: {report_path}")

# Main execution
if __name__ == "__main__":
    validator = MockDataValidator()
    
    # Validate current directory
    current_dir = "."
    summary = validator.validate_directory(current_dir)
    
    print(f"\n✅ Validation Complete!")
    print(f"📁 Files validated: {summary['files_validated']}")
    print(f"🔍 Total issues: {summary['total_issues']}")
    print(f"📊 Quality score: {summary['quality_score']}%")
    
    if summary['recommendations']:
        print(f"\n💡 Recommendations:")
        for rec in summary['recommendations']:
            print(f"  {rec}")
