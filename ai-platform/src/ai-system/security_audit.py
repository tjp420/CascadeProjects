#!/usr/bin/env python3
"""
Security Audit
Test security measures and identify vulnerabilities
"""

import re
import os
from pathlib import Path

class SecurityAuditor:
    """Security testing framework"""
    
    def __init__(self):
        self.vulnerabilities = []
        self.security_score = 100
    
    def scan_for_secrets(self):
        """Scan for hardcoded secrets"""
        sensitive_patterns = [
            r'password\s*=\s*["'][^"']+["']',
            r'api_key\s*=\s*["'][^"']+["']',
            r'secret\s*=\s*["'][^"']+["']',
            r'token\s*=\s*["'][^"']+["']'
        ]
        
        vulnerabilities = []
        
        for file_path in Path('.').rglob('*.py'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                for pattern in sensitive_patterns:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    if matches:
                        vulnerabilities.append({
                            'file': str(file_path),
                            'type': 'hardcoded_secret',
                            'matches': len(matches)
                        })
            except Exception:
                continue
        
        self.vulnerabilities.extend(vulnerabilities)
        return vulnerabilities
    
    def check_sql_injection(self):
        """Check for SQL injection vulnerabilities"""
        sql_patterns = [
            r'execute\s*\(\s*["'].*?\%.*?["']',
            r'query\s*=\s*["'].*?\+.*?["']'
        ]
        
        vulnerabilities = []
        
        for file_path in Path('.').rglob('*.py'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    for pattern in sql_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            vulnerabilities.append({
                                'file': str(file_path),
                                'type': 'sql_injection_risk',
                                'pattern': pattern
                            })
            except Exception:
                continue
        
        self.vulnerabilities.extend(vulnerabilities)
        return vulnerabilities
    
    def check_input_validation(self):
        """Check input validation"""
        validation_files = []
        
        for file_path in Path('.').rglob('*.py'):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Check if input validation exists
                    if 'validate' in content.lower() or 'sanitize' in content.lower():
                        validation_files.append(str(file_path))
            except Exception:
                continue
        
        return validation_files
    
    def run_security_audit(self):
        """Run complete security audit"""
        print("🔒 Running Security Audit...")
        
        # Scan for secrets
        secrets = self.scan_for_secrets()
        print(f"  🔍 Found {len(secrets)} potential hardcoded secrets")
        
        # Check SQL injection
        sql_risks = self.check_sql_injection()
        print(f"  🔍 Found {len(sql_risks)} potential SQL injection risks")
        
        # Check input validation
        validation_files = self.check_input_validation()
        print(f"  🔍 Found {len(validation_files)} files with input validation")
        
        # Calculate security score
        total_issues = len(secrets) + len(sql_risks)
        self.security_score = max(0, 100 - (total_issues * 10))
        
        print(f"  📊 Security Score: {self.security_score}/100")
        
        return {
            'secrets': secrets,
            'sql_risks': sql_risks,
            'validation_files': validation_files,
            'security_score': self.security_score
        }

if __name__ == "__main__":
    auditor = SecurityAuditor()
    results = auditor.run_security_audit()
    print(f"\n🎯 Security Audit Complete: Score {results['security_score']}/100")
