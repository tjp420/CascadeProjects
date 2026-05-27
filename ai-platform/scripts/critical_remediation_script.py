#!/usr/bin/env python3
"""
Critical Security Remediation Script
Targets files with mock_api_keys and sample_credit_cards for immediate remediation.
"""

import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path

def load_priority_files():
    """Load the identified priority files."""
    with open('top_50_priority_files.json', 'r') as f:
        return json.load(f)

def create_backup(file_path):
    """Create a backup of the file before modification."""
    backup_dir = Path('remediation_backups')
    backup_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = backup_dir / f"{file_path.replace('/', '_').replace('\\', '_')}_{timestamp}.backup"
    
    try:
        shutil.copy2(file_path, backup_path)
        print(f"Backup created: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"Error creating backup for {file_path}: {e}")
        return None

def remediate_mock_api_keys(content):
    """
    Replace mock API keys with environment variable references.
    """
    patterns = [
        (r"mock.*api.*key['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]", 
         r"process.env.MOCK_API_KEY"),  # Environment variable
        (r"test.*api.*key['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]", 
         r"process.env.TEST_API_KEY"),
        (r"fake.*api.*key['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]", 
         r"process.env.API_KEY"),
        (r"dummy.*api.*key['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]", 
         r"process.env.DUMMY_API_KEY"),
    ]
    
    modified_content = content
    replacements_made = 0
    
    for pattern, replacement in patterns:
        matches = re.findall(pattern, modified_content, re.IGNORECASE)
        if matches:
            modified_content = re.sub(pattern, replacement, modified_content, flags=re.IGNORECASE)
            replacements_made += len(matches)
    
    return modified_content, replacements_made

def remediate_sample_credit_cards(content):
    """
    Replace sample credit card numbers with safe placeholders or environment variables.
    """
    # Credit card patterns (basic detection)
    patterns = [
        (r'\b(4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b', 'process.env.TEST_CREDIT_CARD'),  # Visa
        (r'\b(5\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b', 'process.env.TEST_CREDIT_CARD'),  # MasterCard
        (r'\b(3\d{3}[-\s]?\d{6}[-\s]?\d{5})\b', 'process.env.TEST_CREDIT_CARD'),  # Amex
        (r'\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b', 'process.env.TEST_CREDIT_CARD'),  # Generic
    ]
    
    modified_content = content
    replacements_made = 0
    
    for pattern, replacement in patterns:
        matches = re.findall(pattern, modified_content)
        if matches:
            modified_content = re.sub(pattern, replacement, modified_content)
            replacements_made += len(matches)
    
    return modified_content, replacements_made

def remediate_test_urls(content):
    """
    Replace test URLs with configurable endpoints.
    """
    patterns = [
        (r'http://localhost:\d+', 'process.env.LOCAL_API_URL'),
        (r'https?://test\.', 'process.env.TEST_API_URL'),
        (r'https?://example\.', 'process.env.EXAMPLE_API_URL'),
        (r'https?://mock\.', 'process.env.MOCK_API_URL'),
    ]
    
    modified_content = content
    replacements_made = 0
    
    for pattern, replacement in patterns:
        matches = re.findall(pattern, modified_content)
        if matches:
            modified_content = re.sub(pattern, replacement, modified_content)
            replacements_made += len(matches)
    
    return modified_content, replacements_made

def apply_remediations(file_path, patterns):
    """
    Apply appropriate remediations based on detected patterns.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        modified_content = original_content
        total_replacements = 0
        remediation_summary = []
        
        # Apply remediations based on detected patterns
        unique_patterns = set(patterns)
        
        if 'mock_api_keys' in unique_patterns:
            modified_content, replacements = remediate_mock_api_keys(modified_content)
            if replacements > 0:
                total_replacements += replacements
                remediation_summary.append(f"Mock API keys: {replacements} replacements")
        
        if 'sample_credit_cards' in unique_patterns:
            modified_content, replacements = remediate_sample_credit_cards(modified_content)
            if replacements > 0:
                total_replacements += replacements
                remediation_summary.append(f"Sample credit cards: {replacements} replacements")
        
        if 'test_urls' in unique_patterns:
            modified_content, replacements = remediate_test_urls(modified_content)
            if replacements > 0:
                total_replacements += replacements
                remediation_summary.append(f"Test URLs: {replacements} replacements")
        
        # Only write if changes were made
        if modified_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(modified_content)
            return True, total_replacements, remediation_summary
        else:
            return False, 0, ["No changes needed"]
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False, 0, [f"Error: {str(e)}"]

def main():
    """Main execution function."""
    print("Loading priority files...")
    priority_files = load_priority_files()
    
    # Focus on critical files first (mock_api_keys and sample_credit_cards)
    critical_files = [f for f in priority_files if any(p in ['mock_api_keys', 'sample_credit_cards'] for p in f['patterns'])]
    
    print(f"Found {len(critical_files)} critical files requiring immediate remediation")
    
    # Process critical files first
    results = []
    
    for i, file_info in enumerate(critical_files[:10], 1):  # Start with top 10 critical files
        file_path = file_info['path']
        patterns = file_info['patterns']
        
        print(f"\n[{i}/{min(10, len(critical_files))}] Processing: {file_path}")
        print(f"   Detected patterns: {', '.join(set(patterns))}")
        
        # Create backup
        backup_path = create_backup(file_path)
        if not backup_path:
            print(f"   Skipping due to backup failure")
            continue
        
        # Apply remediations
        success, replacements, summary = apply_remediations(file_path, patterns)
        
        result = {
            'file': file_path,
            'backup': str(backup_path),
            'success': success,
            'replacements': replacements,
            'summary': summary
        }
        results.append(result)
        
        if success:
            print(f"   SUCCESS: {replacements} replacements made")
            for item in summary:
                print(f"   - {item}")
        else:
            print(f"   No changes made: {summary[0]}")
    
    # Save results
    with open('critical_remediation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n=== Remediation Summary ===")
    successful = sum(1 for r in results if r['success'])
    total_replacements = sum(r['replacements'] for r in results)
    
    print(f"Files processed: {len(results)}")
    print(f"Successfully remediated: {successful}")
    print(f"Total replacements made: {total_replacements}")
    print(f"Results saved to: critical_remediation_results.json")

if __name__ == '__main__':
    main()