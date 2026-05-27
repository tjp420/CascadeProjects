#!/usr/bin/env python3
"""
Batch Mock Data Consolidator
Processes all mock data files to find and consolidate duplicates
"""

import os
import json
from mock_data_consolidator import MockDataConsolidator

def main():
    """Run batch consolidation on all mock data files"""
    consolidator = MockDataConsolidator()
    
    # Get all mock data files
    mock_data_dir = "test-batch-data"
    all_files = []
    
    if os.path.exists(mock_data_dir):
        consolidated = os.path.join(mock_data_dir, "mock_data.json")
        if os.path.exists(consolidated):
            all_files.append(consolidated)
        else:
            for filename in os.listdir(mock_data_dir):
                if filename.startswith("mock_data_") and filename.endswith(".json") and not filename.endswith("_consolidated.json"):
                    all_files.append(os.path.join(mock_data_dir, filename))
    
    # Found {len(all_files)} mock data files to process
    
    # Process in batches to avoid memory issues
    batch_size = 10
    total_consolidated = 0
    total_space_saved = 0
    
    for i in range(0, len(all_files), batch_size):
        batch = all_files[i:i+batch_size]
        # Processing batch {i//batch_size + 1}/{(len(all_files)-1)//batch_size + 1}
        
        # Reset consolidator for each batch
        consolidator = MockDataConsolidator()
        consolidator.process_consolidation(batch)
        
        total_consolidated += consolidator.patterns_consolidated
        total_space_saved += consolidator.space_saved
    
    # Batch Consolidation Complete!
    # Total patterns consolidated: {total_consolidated}
    # Total space saved: {total_space_saved:.2f}MB

if __name__ == "__main__":
    main()
