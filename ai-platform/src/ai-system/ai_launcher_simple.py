#!/usr/bin/env python3
"""
Simple AI Launcher - Fixed Version
Provides both AI Development Assistant and AI Blob System options
"""

import sys
import subprocess
from pathlib import Path

def print_banner():
    """Print the AI banner"""
    print("🤖 AI-Powered Development Assistant & Blob System")
    print("=" * 50)
    print("🚀 Real AI-powered development assistance and blob management")
    print("📊 Intelligent analysis, planning, optimization, and automation")
    print("=" * 50)

def show_menu():
    """Show the main menu"""
    print("\n📋 Choose your AI-powered tool:")
    print("1. 🤖 AI Development Assistant")
    print("2. 🤖 AI Blob System")
    print("3. ⚙️ System Configuration")
    print("0. ❌ Exit")
    print("-" * 40)

def run_ai_assistant():
    """Run AI Development Assistant"""
    print("\n🚀 Starting AI Development Assistant...")
    try:
        /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, "ai_launcher_real.py"], check=False)
    except Exception as e:
        print(f"❌ Error running AI Assistant: {e}")
        print("🔧 Falling back to basic assistant...")
        try:
            /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, "ai_launcher.py"], check=False)
        except Exception as e2:
            print(f"❌ Error running fallback assistant: {e2}")

def run_ai_blob_system():
    """Run AI Blob System"""
    print("\n🤖 Starting AI Blob System...")
    try:
        /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, "ai_blob_system.py"], check=False)
    except Exception as e:
        print(f"❌ Error running AI Blob System: {e}")

def show_system_configuration():
    """Show system configuration"""
    print("\n⚙️ System Configuration:")
    print("📊 AI Service Status:")
    try:
        result = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, "-c", 
            "from ai_service import is_ai_available; print('✅ AI Available' if is_ai_available() else '❌ AI Not Available')"], 
            capture_output=True, text=True)
        print(result.stdout.strip())
    except Exception as e:
        print(f"❌ Error checking AI status: {e}")
    
    print("🔑 API Key Configuration:")
    if Path(".env").exists():
        print("✅ .env file found")
        print("📝 API Key configured")
    else:
        print("❌ .env file not found")
        print("📝 Please create .env with your API key")
        print("📝 See REAL_AI_SETUP_GUIDE.md for instructions")

def main():
    """Main execution function"""
    print_banner()
    
    while True:
        show_menu()
        
        try:
            choice = input("\n🎯 Choose an option (0-3): ").strip()
            
            if choice == '0':
                print("\n👋 Goodbye!")
                break
            elif choice == '1':
                run_ai_assistant()
                input("\nPress Enter to continue...")
            elif choice == '2':
                run_ai_blob_system()
                input("\nPress Enter to continue...")
            elif choice == '3':
                show_system_configuration()
                input("\nPress Enter to continue...")
            else:
                print(f"\n❌ Invalid choice: {choice}")
                input("\nPress Enter to continue...")
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()
