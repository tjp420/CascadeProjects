#!/usr/bin/env python3
"""
Real Mock Pattern Detector
Scans codebase for actual mock data patterns, test data, and placeholder content
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Tuple

class RealMockDetector:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir)
        self.mock_patterns = self._initialize_patterns()
        self.scan_results = {
            "files_scanned": 0,
            "files_with_findings": 0,
            "total_findings": 0,
            "categories": {},
            "findings": []
        }
        
    def _initialize_patterns(self) -> Dict[str, Dict]:
        """Initialize regex patterns for detecting mock data"""
        return {
            "test_emails": {
                "patterns": [
                    r'\b[A-Za-z0-9._%+-]+@(test|mock|demo|example|fake|sample)\.[A-Za-z]{2,}\b',
                    r'\btest[A-Za-z0-9._%+-]*@',
                    r'\b[A-Za-z0-9._%+-]+@example\.com\b',
                    r'\b[A-Za-z0-9._%+-]+@test\.com\b',
                    r'\bno-reply@',
                    r'\bdo-not-reply@',
                ],
                "description": "Test email addresses",
                "severity": "low"
            },
            "fake_names": {
                "patterns": [
                    r'\b(John|Jane|Test|Demo|Mock|Sample)\s+(Doe|Smith|User|Admin|Customer)\b',
                    r'\b(First|Last|User|Test)\s*Name\b',
                    r'\bplaceholder_name\b',
                    r'\bname_test\b',
                    r'\btest_user\b',
                ],
                "description": "Fake or placeholder names",
                "severity": "low"
            },
            "mock_phones": {
                "patterns": [
                    r'\b555[-\s]?\d{3}[-\s]?\d{4}\b',
                    r'\b\+1[-\s]?555[-\s]?\d{3}[-\s]?\d{4}\b',
                    r'\b\d{3}[-\s]?555[-\s]?\d{4}\b',
                    r'\b\(555\)\s*\d{3}[-\s]?\d{4}\b',
                    r'\b1?[-\s]?\(?555\)?[-\s]?\d{3}[-\s]?\d{4}\b',
                ],
                "description": "Mock phone numbers",
                "severity": "low"
            },
            "fake_addresses": {
                "patterns": [
                    r'\b\d+\s+(Main|Oak|Pine|Maple|Elm)\s+(Street|St|Ave|Avenue|Road|Rd|Boulevard|Blvd)\b',
                    r'\b123\s+Mock\s+Street\b',
                    r'\b\d+\s+(Test|Demo|Sample)\s+(Street|St|Ave)\b',
                    r'\bplaceholder_address\b',
                    r'\btest_address\b',
                    r'\b[0-9]+\s+[A-Z][a-z]+\s+(Street|St|Avenue|Ave|Road|Rd)\b',
                ],
                "description": "Fake or placeholder addresses",
                "severity": "low"
            },
            "mock_api_keys": {
                "patterns": [
                    r'\bsk_test_[A-Za-z0-9]{32,}\b',
                    r'\bsk_live_[A-Za-z0-9]{32,}\b',
                    r'\btest_api_key\b',
                    r'\bmock_api_key\b',
                    r'\bplaceholder_api_key\b',
                    r'\bAIza[A-Za-z0-9_-]{35}\b',  # Google API keys
                    r'\bghp_[A-Za-z0-9]{36}\b',  # GitHub tokens
                ],
                "description": "Mock or test API keys",
                "severity": "critical"
            },
            "test_urls": {
                "patterns": [
                    r'https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?',
                    r'https?://(example\.com|test\.com|mock\.com|demo\.com|sample\.com)',
                    r'https?://fake',
                    r'http://test',
                    r'\bplaceholder_url\b',
                    r'\btest_url\b',
                ],
                "description": "Test or placeholder URLs",
                "severity": "medium"
            },
            "sample_credit_cards": {
                "patterns": [
                    r'\b4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',  # Visa
                    r'\b5\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',  # MasterCard
                    r'\b3\d{3}[-\s]?\d{6}[-\s]?\d{5}\b',     # Amex
                    r'\b6011[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',  # Discover
                    r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',  # Generic
                    r'\b(4111111111111111|4242424242424242|5555555555554444)\b',  # Known test cards
                ],
                "description": "Sample credit card numbers",
                "severity": "critical"
            },
            "placeholder_text": {
                "patterns": [
                    r'\b(PLACEHOLDER|FIXME|TODO|XXX|HACK|NOTE)\b',
                    r'\bplaceholder_\w+\b',
                    r'\btest_\w+_data\b',
                    r'\bmock_\w+_data\b',
                    r'\bsample_\w+\b',
                    r'\b\dummy_\w+\b',
                ],
                "description": "Placeholder text or comments",
                "severity": "low"
            },
            "mock_databases": {
                "patterns": [
                    r'\b(mock|test|sample)_database\b',
                    r'\btest_db\b',
                    r'\bfake_db\b',
                    r'\bplaceholder_database\b',
                    r'\bsqlite:///:memory:',
                    r'\bmemory://\b',
                ],
                "description": "Mock or test database references",
                "severity": "medium"
            },
            "test_user_data": {
                "patterns": [
                    r'\b(test|mock|demo|sample)_user\b',
                    r'\buser_test\b',
                    r'\btestuser\b',
                    r'\bmockuser\b',
                    r'\btest_admin\b',
                    r'\btest_customer\b',
                ],
                "description": "Test user account references",
                "severity": "low"
            },
            "mock_functions": {
                "patterns": [
                    r'\b(mock|test|fake|stub)_\w+\b',
                    r'\b\w+_(mock|test|stub|fake)\b',
                    r'jest\.fn\(\)',
                    r'sinon\.stub\(',
                    r'vi\.fn\(',
                ],
                "description": "Mock or test function names",
                "severity": "low"
            }
        }
    
    def scan_file(self, file_path: Path) -> List[Dict[str, Any]]:
        """Scan a single file for mock patterns"""
        findings = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
                
                for category, category_data in self.mock_patterns.items():
                    for pattern in category_data["patterns"]:
                        for match in re.finditer(pattern, content, re.IGNORECASE):
                            # Find line number
                            line_num = content[:match.start()].count('\n') + 1
                            line_content = lines[line_num - 1].strip()
                            
                            finding = {
                                "category": category,
                                "severity": category_data["severity"],
                                "file": str(file_path.relative_to(self.root_dir)),
                                "line": line_num,
                                "pattern": pattern,
                                "match": match.group(),
                                "context": line_content[:200]  # First 200 chars of the line
                            }
                            findings.append(finding)
                            
        except Exception as e:
            print(f"Error scanning {file_path}: {e}")
            
        return findings
    
    def scan_directory(self, exclude_dirs: List[str] = None, max_files: int = 500) -> None:
        """Scan entire directory for mock patterns"""
        if exclude_dirs is None:
            exclude_dirs = ['node_modules', '.git', 'venv', '.venv', 'build', 'dist', '.next', '__pycache__', 'archive']
        
        print(f"Scanning {self.root_dir} for mock patterns (max {max_files} files)...")
        print(f"Excluding directories: {exclude_dirs}")
        
        # Track statistics
        file_count = 0
        files_with_findings = 0
        category_stats = defaultdict(int)
        
        # Scan files
        for file_path in self.root_dir.rglob('*'):
            # Stop if we've reached max files
            if file_count >= max_files:
                print(f"Reached maximum file limit ({max_files}), stopping scan")
                break
                
            # Skip directories and excluded paths
            if not file_path.is_file():
                continue
                
            if any(exclude_dir in str(file_path) for exclude_dir in exclude_dirs):
                continue
                
            # Only scan text files
            if file_path.suffix in ['.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml']:
                file_count += 1
                findings = self.scan_file(file_path)
                
                if findings:
                    files_with_findings += 1
                    for finding in findings:
                        category_stats[finding["category"]] += 1
                        self.scan_results["findings"].append(finding)
        
        # Update scan results
        self.scan_results["files_scanned"] = file_count
        self.scan_results["files_with_findings"] = files_with_findings
        self.scan_results["total_findings"] = len(self.scan_results["findings"])
        
        # Format category statistics
        for category, data in self.mock_patterns.items():
            self.scan_results["categories"][category] = {
                "count": category_stats[category],
                "description": data["description"],
                "severity": data["severity"]
            }
        
        print(f"Scan complete: {file_count} files scanned, {files_with_findings} files with findings")
        print(f"Total findings: {self.scan_results['total_findings']}")
    
    def calculate_health_score(self) -> int:
        """Calculate a mock data health score"""
        if self.scan_results["files_scanned"] == 0:
            return 50
        
        # Calculate ratio of files with mock data
        mock_ratio = self.scan_results["files_with_findings"] / self.scan_results["files_scanned"]
        
        # Calculate severity impact
        severity_weights = {
            "critical": 10,
            "high": 7,
            "medium": 4,
            "low": 1
        }
        
        severity_score = 0
        for finding in self.scan_results["findings"][:100]:  # Sample first 100 for performance
            severity_score += severity_weights.get(finding["severity"], 1)
        
        # Calculate final score (0-100, lower is worse)
        base_score = 100 - int(mock_ratio * 50)
        severity_penalty = min(30, severity_score // 10)
        final_score = max(0, base_score - severity_penalty)
        
        return final_score
    
    def get_health_grade(self) -> str:
        """Get health grade based on score"""
        score = self.calculate_health_score()
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive mock data analysis report"""
        return {
            "scan_summary": {
                "files_scanned": self.scan_results["files_scanned"],
                "files_with_findings": self.scan_results["files_with_findings"],
                "total_findings": self.scan_results["total_findings"],
                "health_score": self.calculate_health_score(),
                "health_grade": self.get_health_grade(),
                "health_status": self._get_health_status()
            },
            "categories": self.scan_results["categories"],
            "findings": self.scan_results["findings"][:100],  # Limit to top 100 findings
            "recommendations": self._generate_recommendations()
        }
    
    def _get_health_status(self) -> str:
        """Get health status description"""
        score = self.calculate_health_score()
        if score >= 90:
            return "Excellent"
        elif score >= 70:
            return "Good"
        elif score >= 50:
            return "Fair"
        else:
            return "Critical"
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on findings"""
        recommendations = []
        
        # Analyze findings to generate recommendations
        category_counts = {cat: data["count"] for cat, data in self.scan_results["categories"].items()}
        
        if category_counts.get("mock_api_keys", 0) > 0:
            recommendations.append("CRITICAL: Remove or secure mock API keys immediately")
        
        if category_counts.get("sample_credit_cards", 0) > 0:
            recommendations.append("CRITICAL: Remove sample credit card numbers from code")
        
        if category_counts.get("test_emails", 0) > 50:
            recommendations.append("Consider consolidating test email addresses into fixtures")
        
        if category_counts.get("placeholder_text", 0) > 100:
            recommendations.append("Address TODO/FIXME comments to reduce technical debt")
        
        if category_counts.get("mock_functions", 0) > 100:
            recommendations.append("Review mock function usage for potential optimization")
        
        if not recommendations:
            recommendations.append("Mock data usage appears minimal - continue good practices")
        
        return recommendations

def main():
    """Run the real mock pattern detector"""
    import sys
    
    # Get directory from command line or use current directory
    root_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    max_files = int(sys.argv[2]) if len(sys.argv) > 2 else 500
    
    print("Real Mock Pattern Detector")
    print("=" * 50)
    
    # Initialize detector
    detector = RealMockDetector(root_dir)
    
    # Scan directory
    detector.scan_directory(max_files=max_files)
    
    # Generate report
    report = detector.generate_report()
    
    # Print summary
    print("\nMock Data Analysis Summary:")
    print(f"Files Scanned: {report['scan_summary']['files_scanned']}")
    print(f"Files with Findings: {report['scan_summary']['files_with_findings']}")
    print(f"Total Findings: {report['scan_summary']['total_findings']}")
    print(f"Health Score: {report['scan_summary']['health_score']}/100")
    print(f"Health Grade: {report['scan_summary']['health_grade']}")
    print(f"Health Status: {report['scan_summary']['health_status']}")
    
    print("\nFindings by Category:")
    for category, data in report["categories"].items():
        if data["count"] > 0:
            print(f"  {data['description']}: {data['count']} (severity: {data['severity']})")
    
    print("\nRecommendations:")
    for rec in report["recommendations"]:
        print(f"  - {rec}")
    
    # Print all findings details
    print("\n" + "="*80)
    print("ALL FINDINGS DETAILS:")
    print("="*80)
    for i, finding in enumerate(report["findings"], 1):
        print(f"\n{i}. {finding['type']}")
        print(f"   File: {finding['file']}")
        print(f"   Line: {finding['line']}")
        print(f"   Severity: {finding['severity']}")
        print(f"   Description: {finding['description']}")
    
    # Save report to JSON
    output_file = Path(root_dir) / "real_mock_analysis_results.json"
    with open(output_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nReport saved to: {output_file}")

if __name__ == "__main__":
    main()