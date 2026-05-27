#!/usr/bin/env python3
"""
Real Mock Pattern Scanner API
Provides real-time scanning of files for mock data patterns
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import re
import json
from typing import Dict, List, Any
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Directory to scan (can be configured)
SCAN_ROOT = Path(__file__).parent.parent.parent

# Mock pattern detection regex patterns
MOCK_PATTERNS = {
    "console_logging": {
        "pattern": r'console\.(log|debug|info|warn|error)',
        "severity": "low",
        "icon": "fa-terminal",
        "category": "quality",
        "type": "Console Logging",
        "description": "Console.log statement in production code"
    },
    "test_urls": {
        "pattern": r'https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|example\.com|test\.com|mock\.com|fake\.com)',
        "severity": "medium",
        "icon": "fa-link",
        "category": "security",
        "type": "Test URLs",
        "description": "Test URL found in production code"
    },
    "placeholder_text": {
        "pattern": r'\b(PLACEHOLDER|DUMMY|MOCK|FAKE|SAMPLE|TEST|TEMP)\w*\b',
        "severity": "low",
        "icon": "fa-font",
        "category": "quality",
        "type": "Placeholder Text",
        "description": "Mock data comment found in source code"
    },
    "test_emails": {
        "pattern": r'\b[A-Za-z0-9._%+-]+@(test|mock|demo|example|fake|sample|temp|dev|staging)\.[A-Za-z]{2,}\b',
        "severity": "low",
        "icon": "fa-envelope",
        "category": "security",
        "type": "Test Email Addresses",
        "description": "Test email address found"
    },
    "mock_phones": {
        "pattern": r'\b(555[-\s]?\d{3}[-\s]?\d{4}|123[-\s]?\d{3}[-\s]?\d{4}|000[-\s]?\d{3}[-\s]?\d{4})\b',
        "severity": "low",
        "icon": "fa-phone",
        "category": "security",
        "type": "Mock Phone Numbers",
        "description": "Mock phone number found"
    },
    "hardcoded_credentials": {
        "pattern": r'(password|secret|api_key|token)\s*[:=]\s*["\']?(test|mock|demo|dummy|sample|123456|password)',
        "severity": "high",
        "icon": "fa-key",
        "category": "security",
        "type": "Hardcoded Credentials",
        "description": "Hardcoded test credentials found"
    },
    "mock_data_variables": {
        "pattern": r'\b(mock|test|dummy|fake|sample|temp)_\w+\s*=',
        "severity": "low",
        "icon": "fa-database",
        "category": "quality",
        "type": "Mock Data Variables",
        "description": "Mock data variable declaration found"
    },
    "debugger_statements": {
        "pattern": r'\b(debugger|debugger;|breakpoint)\b',
        "severity": "medium",
        "icon": "fa-bug",
        "category": "quality",
        "type": "Debugger Statements",
        "description": "Debugger statement found in production code"
    },
    "todo_comments": {
        "pattern": r'(//|#|/\*|<!--)\s*(TODO|FIXME|HACK|XXX|NOTE)',
        "severity": "low",
        "icon": "fa-tasks",
        "category": "quality",
        "type": "TODO Comments",
        "description": "Development comment found in production code"
    },
    "sample_names": {
        "pattern": r'\b(John|Jane|Test|Demo|Sample|Mock)\s+(Doe|Smith|User|Admin|Customer)\b',
        "severity": "low",
        "icon": "fa-user",
        "category": "quality",
        "type": "Sample Names",
        "description": "Sample person name found"
    },
    "placeholder_images": {
        "pattern": r'(placeholder\.com|via\.placeholder|picsum|loremflickr|unsplash\.com\/placeholder)',
        "severity": "low",
        "icon": "fa-image",
        "category": "quality",
        "type": "Placeholder Images",
        "description": "Placeholder image URL found"
    },
    "mock_functions": {
        "pattern": r'\b(mock|test|dummy|fake|stub)_\w+\s*\(',
        "severity": "low",
        "icon": "fa-code",
        "category": "quality",
        "type": "Mock Functions",
        "description": "Mock function call found"
    }
}

def scan_file_for_patterns(file_path: Path) -> List[Dict[str, Any]]:
    """Scan a single file for mock patterns"""
    findings = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line_stripped = line.strip()
                
                for pattern_name, pattern_data in MOCK_PATTERNS.items():
                    pattern = pattern_data["pattern"]
                    
                    try:
                        matches = re.finditer(pattern, line_stripped, re.IGNORECASE)
                        for match in matches:
                            finding = {
                                "type": pattern_data["type"],
                                "severity": pattern_data["severity"],
                                "icon": pattern_data["icon"],
                                "category": pattern_data["category"],
                                "file": str(file_path.relative_to(SCAN_ROOT)),
                                "line": line_num,
                                "confidence": 95,  # High confidence for direct regex matches
                                "description": pattern_data["description"],
                                "context": line_stripped[:200]
                            }
                            findings.append(finding)
                    except re.error:
                        continue
                        
    except Exception as e:
        print(f"Error scanning {file_path}: {e}")
    
    return findings

def scan_directory(target_dir: str = ".", max_files: int = 100) -> Dict[str, Any]:
    """Scan directory for mock patterns"""
    print(f"Received target_dir: {target_dir}")
    target_path = Path(target_dir)
    
    # If relative path, resolve relative to SCAN_ROOT
    if not target_path.is_absolute():
        target_path = SCAN_ROOT / target_dir
        print(f"Resolved relative path to: {target_path}")
    
    # If still doesn't exist, try SCAN_ROOT itself
    if not target_path.exists():
        print(f"Path doesn't exist: {target_path}, trying SCAN_ROOT")
        target_path = SCAN_ROOT
    
    print(f"Final scanning directory: {target_path} with max_files: {max_files}")
    
    findings = []
    files_scanned = 0
    
    # Scan files
    for file_path in target_path.rglob('*'):
        if files_scanned >= max_files:
            break
            
        if not file_path.is_file():
            continue
            
        # Skip certain directories
        if any(skip in str(file_path) for skip in ['node_modules', '.git', 'venv', '.venv', 'build', 'dist', '.next', '__pycache__', 'archive']):
            continue
            
        # Only scan text files
        if file_path.suffix in ['.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml', '.env']:
            files_scanned += 1
            file_findings = scan_file_for_patterns(file_path)
            findings.extend(file_findings)
    
    # Remove duplicates (same pattern at same location)
    unique_findings = []
    seen = set()
    for finding in findings:
        key = (finding['file'], finding['line'], finding['type'])
        if key not in seen:
            seen.add(key)
            unique_findings.append(finding)
    
    # Calculate statistics
    patterns_found = len(unique_findings)
    potential_issues = len(set(f['file'] for f in unique_findings))
    avg_confidence = sum(f['confidence'] for f in unique_findings) / len(unique_findings) if unique_findings else 0
    
    return {
        "filesScanned": files_scanned,
        "patternsFound": patterns_found,
        "potentialIssues": potential_issues,
        "avgConfidence": round(avg_confidence, 1),
        "findings": unique_findings[:20]  # Limit to top 20 findings
    }

@app.route('/api/analyze-mock-data', methods=['POST'])
def analyze_mock_data():
    """API endpoint for mock data analysis"""
    try:
        data = request.json
        target_dir = data.get('targetDirectory', '.')
        mode = data.get('mode', 'quick')
        
        # Adjust max files based on mode - increased for comprehensive scanning
        max_files = 500 if mode == 'quick' else 2000 if mode == 'deep' else 100
        
        # Perform real scanning
        results = scan_directory(target_dir, max_files)
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "scanner": "real"})

if __name__ == '__main__':
    print("Starting Real Mock Pattern Scanner API...")
    print(f"Scan root: {SCAN_ROOT}")
    print("Attempting to start server on port 56744...")
    try:
        app.run(host='0.0.0.0', port=56744, debug=False, threaded=True)
    except Exception as e:
        print(f"Error starting server: {e}")
        print("Trying alternative port 56745...")
        app.run(host='0.0.0.0', port=56745, debug=False, threaded=True)