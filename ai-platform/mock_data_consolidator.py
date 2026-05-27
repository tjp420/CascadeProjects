#!/usr/bin/env python3
"""
Mock Data Consolidator
Consolidates duplicate mock data patterns identified by GGUF AI
Target: 15.2MB reduction in storage
"""

import json
import os
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Tuple
from collections import defaultdict

class MockDataConsolidator:
    def __init__(self):
        self.consolidated_files = []
        self.space_saved = 0
        self.patterns_consolidated = 0
        
    def calculate_file_hash(self, data: Dict[str, Any]) -> str:
        """Calculate hash of data structure for pattern matching"""
        # Normalize data for consistent hashing
        normalized = json.dumps(data, sort_keys=True, separators=(',', ':'))
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def find_duplicate_patterns(self, file_path: str) -> Dict[str, List[Tuple[str, Any]]]:
        """Find duplicate patterns in mock data file"""
        patterns = defaultdict(list)
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            if isinstance(data, list) and data and all(isinstance(item, list) for item in data):
                for shard_idx, shard in enumerate(data):
                    for i, item in enumerate(shard):
                        if isinstance(item, dict):
                            pattern_hash = self.calculate_file_hash(item)
                            patterns[pattern_hash].append((f"{file_path}[{shard_idx}][{i}]", item))
            elif isinstance(data, list):
                for i, item in enumerate(data):
                    if isinstance(item, dict):
                        pattern_hash = self.calculate_file_hash(item)
                        patterns[pattern_hash].append((f"{file_path}[{i}]", item))
            elif isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, dict):
                        pattern_hash = self.calculate_file_hash(value)
                        patterns[pattern_hash].append((f"{file_path}.{key}", value))
                        
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
        
        return patterns
    
    def consolidate_duplicates(self, patterns: Dict[str, List[Tuple[str, Any]]]) -> Dict[str, Any]:
        """Consolidate duplicate patterns"""
        consolidated = {}
        duplicates_found = 0
        space_saved = 0
        
        for pattern_hash, occurrences in patterns.items():
            if len(occurrences) > 1:
                duplicates_found += len(occurrences) - 1
                
                # Keep the first occurrence, create reference for others
                primary_location, primary_data = occurrences[0]
                consolidated[pattern_hash] = {
                    'data': primary_data,
                    'reference': primary_location,
                    'duplicates': [loc for loc, _ in occurrences[1:]],
                    'count': len(occurrences)
                }
                
                # Calculate space savings (rough estimate)
                for loc, data in occurrences[1:]:
                    space_saved += len(json.dumps(data))
        
        return {
            'consolidated_patterns': consolidated,
            'duplicates_found': duplicates_found,
            'estimated_space_saved_bytes': space_saved,
            'estimated_space_saved_mb': space_saved / (1024 * 1024)
        }
    
    def create_consolidated_structure(self, file_path: str, consolidation_result: Dict[str, Any]):
        """Create consolidated mock data structure"""
        try:
            with open(file_path, 'r') as f:
                original_data = json.load(f)
            
            # Create new consolidated structure
            consolidated_data = {
                'metadata': {
                    'consolidated_at': datetime.now().isoformat(),
                    'original_file': file_path,
                    'duplicates_removed': consolidation_result['duplicates_found'],
                    'space_saved_mb': consolidation_result['estimated_space_saved_mb'],
                    'patterns_consolidated': len(consolidation_result['consolidated_patterns'])
                },
                'consolidated_patterns': consolidation_result['consolidated_patterns'],
                'unique_data': []
            }
            
            # Add unique data (non-duplicate items)
            if isinstance(original_data, list) and original_data and all(isinstance(item, list) for item in original_data):
                for shard_idx, shard in enumerate(original_data):
                    for i, item in enumerate(shard):
                        if isinstance(item, dict):
                            pattern_hash = self.calculate_file_hash(item)
                            if pattern_hash not in consolidation_result['consolidated_patterns']:
                                consolidated_data['unique_data'].append(item)
            elif isinstance(original_data, list):
                for i, item in enumerate(original_data):
                    if isinstance(item, dict):
                        pattern_hash = self.calculate_file_hash(item)
                        if pattern_hash not in consolidation_result['consolidated_patterns']:
                            consolidated_data['unique_data'].append(item)
            elif isinstance(original_data, dict):
                for key, value in original_data.items():
                    if isinstance(value, dict):
                        pattern_hash = self.calculate_file_hash(value)
                        if pattern_hash not in consolidation_result['consolidated_patterns']:
                            consolidated_data['unique_data'].append({key: value})
            
            # Save consolidated file
            consolidated_path = file_path.replace('.json', '_consolidated.json')
            with open(consolidated_path, 'w') as f:
                json.dump(consolidated_data, f, indent=2)
            
            self.consolidated_files.append(consolidated_path)
            self.patterns_consolidated += len(consolidation_result['consolidated_patterns'])
            self.space_saved += consolidation_result['estimated_space_saved_mb']
            
            print(f"✅ Consolidated: {file_path}")
            print(f"📊 Duplicates removed: {consolidation_result['duplicates_found']}")
            print(f"💾 Space saved: {consolidation_result['estimated_space_saved_mb']:.2f}MB")
            
        except Exception as e:
            print(f"Error consolidating {file_path}: {e}")
    
    def process_consolidation(self, file_paths: List[str]):
        """Process consolidation for multiple files"""
        print("🔄 Starting mock data consolidation...")
        
        total_duplicates = 0
        total_space_saved = 0
        
        for file_path in file_paths:
            if os.path.exists(file_path):
                print(f"\n📁 Analyzing: {file_path}")
                
                # Find duplicate patterns
                patterns = self.find_duplicate_patterns(file_path)
                
                # Consolidate duplicates
                consolidation_result = self.consolidate_duplicates(patterns)
                
                if consolidation_result['duplicates_found'] > 0:
                    self.create_consolidated_structure(file_path, consolidation_result)
                    total_duplicates += consolidation_result['duplicates_found']
                    total_space_saved += consolidation_result['estimated_space_saved_mb']
                else:
                    print(f"ℹ️ No duplicates found in {file_path}")
            else:
                print(f"⚠️ File not found: {file_path}")
        
        print(f"\n✅ Consolidation Complete!")
        print(f"📁 Files processed: {len(self.consolidated_files)}")
        print(f"🔄 Patterns consolidated: {self.patterns_consolidated}")
        print(f"💾 Total space saved: {total_space_saved:.2f}MB")
        print(f"📊 Total duplicates removed: {total_duplicates}")

# Main execution
if __name__ == "__main__":
    from datetime import datetime
    
    consolidator = MockDataConsolidator()
    
    # Files identified by GGUF AI for consolidation (in test-batch-data directory)
    files_to_consolidate = [
        "test-batch-data/mock_data.json"
    ]
    
    consolidator.process_consolidation(files_to_consolidate)
