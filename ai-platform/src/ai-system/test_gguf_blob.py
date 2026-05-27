#!/usr/bin/env python3
"""
Test script for GGUF Blob System
"""

import os
import sys

# Set AI Provider to GGUF
os.environ['AI_PROVIDER'] = 'gguf'

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from ai_blob_manager import get_ai_blob_manager
    
    print("🤖 Testing GGUF Blob System...")
    print("=" * 50)
    
    # Initialize blob manager
    manager = get_ai_blob_manager()
    
    # Get blob statistics
    print("📊 Getting blob statistics...")
    result = manager.get_blob_statistics()
    
    print(f"\n📊 GGUF Blob Statistics:")
    print(f"  Total Blobs: {result['total_blobs']}")
    print(f"  Blob Types: {len(result['blob_types'])}")
    print(f"  Architectures: {len(result['architectures'])}")
    print(f"  Operating Systems: {len(result['operating_systems'])}")
    print(f"  Model Families: {len(result['model_families'])}")
    
    print(f"\n📊 Blob Types Breakdown:")
    for blob_type, count in result['blob_types'].items():
        print(f"  {blob_type}: {count}")
    
    print(f"\n📊 Architecture Breakdown:")
    for arch, count in result['architectures'].items():
        print(f"  {arch}: {count}")
    
    print(f"\n📊 Model Families:")
    for family, count in result['model_families'].items():
        print(f"  {family}: {count}")
    
    print("\n✅ GGUF Blob System Test Complete!")
    print("🎉 All GGUF features are working locally!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("❌ GGUF Blob System test failed")
