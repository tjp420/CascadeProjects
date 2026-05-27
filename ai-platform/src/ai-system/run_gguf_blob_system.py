#!/usr/bin/env python3
"""
Direct GGUF AI Blob System Runner
"""

import os
import sys

# Set AI Provider to GGUF
os.environ['AI_PROVIDER'] = 'gguf'

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    try:
        from ai_blob_system_final import main as blob_main
        print("🤖 Starting GGUF AI Blob System...")
        print("=" * 50)
        print("🔑 Using GGUF Local AI (no API keys required)")
        print("🔒 All processing stays local and private")
        print("💰 No ongoing costs - completely free")
        print("=" * 50)
        
        # Run the blob system
        blob_main()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("❌ GGUF AI Blob System failed to start")

if __name__ == "__main__":
    main()
