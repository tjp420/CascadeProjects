#!/usr/bin/env python3
"""
GGUF AI Platform Menu
Simple menu to access GGUF AI features
"""

import os
import sys

# Set AI Provider to GGUF
os.environ['AI_PROVIDER'] = 'gguf'

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def clear_screen():
    """Clear the screen"""
    /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: os.system('cls' if os.name == 'nt' else 'clear')

def show_menu():
    """Show the GGUF AI menu"""
    clear_screen()
    print("=" * 60)
    print("🤖 GGUF AI Platform - Local AI Assistant")
    print("=" * 60)
    print("🔑 Using GGUF Local AI (no API keys required)")
    print("🔒 All processing stays local and private")
    print("💰 No ongoing costs - completely free")
    print("=" * 60)
    print()
    print("Choose your AI-powered tool:")
    print()
    print("1. AI Development Assistant (GGUF Local AI)")
    print("2. AI Blob System (GGUF Local AI)")
    print("3. System Configuration")
    print("0. Exit")
    print()
    print("=" * 60)

def run_ai_development_assistant():
    """Run AI Development Assistant with GGUF"""
    print("\n🚀 Starting AI Development Assistant (GGUF Local AI)...")
    print("=" * 50)
    
    try:
        from ai_development_assistant import main as dev_main
        dev_main()
    except Exception as e:
        print(f"❌ Error: {e}")
        input("\nPress Enter to continue...")

def run_ai_blob_system():
    """Run AI Blob System with GGUF"""
    print("\n🚀 Starting AI Blob System (GGUF Local AI)...")
    print("=" * 50)
    
    try:
        from ai_blob_system_final import main as blob_main
        blob_main()
    except Exception as e:
        print(f"❌ Error: {e}")
        input("\nPress Enter to continue...")

def run_system_configuration():
    """Run system configuration"""
    print("\n🚀 System Configuration")
    print("=" * 50)
    
    try:
        print("🔍 Checking system status...")
        print()
        
        # Check GGUF service
        try:
            from gguf_service import is_gguf_available
            print(f"🤖 GGUF Service: {'Available' if is_gguf_available() else 'Not Available'}")
        except:
            print("🤖 GGUF Service: Not Available")
        
        # Check enhanced AI service
        try:
            from ai_service_enhanced import is_enhanced_ai_available
            print(f"🤖 Enhanced AI Service: {'Available' if is_enhanced_ai_available() else 'Not Available'}")
        except:
            print("🤖 Enhanced AI Service: Not Available")
        
        # Check blob directory
        try:
            from pathlib import Path
            blobs_dir = Path("blobs")
            if blobs_dir.exists():
                blob_files = list(blobs_dir.glob("sha256-*"))
                print(f"📁 Blob Directory: {len(blob_files)} blobs found")
                
                # Check for GGUF model
                for blob_file in blob_files:
                    if blob_file.stat().st_size > 1000000:  # > 1MB
                        try:
                            with open(blob_file, 'rb') as f:
                                header = f.read(4)
                                if header == b'GGUF':
                                    print(f"🤖 GGUF Model: Found ({blob_file.stat().st_size / (1024*1024):.1f} MB)")
                                    break
                        except:
                            continue
            else:
                print("📁 Blob Directory: Not found")
        except:
            print("📁 Blob Directory: Error checking")
        
        print()
        print("🔑 Environment Variables:")
        print(f"   AI_PROVIDER: {os.getenv('AI_PROVIDER', 'Not set')}")
        print(f"   OPENAI_API_KEY: {'Set' if os.getenv('OPENAI_API_KEY') else 'Not set'}")
        print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    input("\nPress Enter to continue...")

def main():
    """Main menu function"""
    while True:
        show_menu()
        
        try:
            choice = input("Choose an option (0-3): ").strip()
            
            if choice == "0":
                print("\n👋 Goodbye!")
                break
            elif choice == "1":
                run_ai_development_assistant()
            elif choice == "2":
                run_ai_blob_system()
            elif choice == "3":
                run_system_configuration()
            else:
                print("\n❌ Invalid choice. Please choose 0, 1, 2, or 3.")
                input("Press Enter to continue...")
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            input("Press Enter to continue...")

if __name__ == "__main__":
    main()
