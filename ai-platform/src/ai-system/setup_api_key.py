#!/usr/bin/env python3
"""
API Key Setup Script
Simplifies the process of configuring API keys for the AI Assistant
"""

import os
import sys
from pathlib import Path

def setup_api_key():
    """Guide user through API key setup process"""
    print("🔑 AI API Key Setup")
    print("=" * 50)
    print()
    print("This script will help you configure your API key for the AI Assistant.")
    print("Choose your AI provider and follow the instructions below.")
    print()
    
    # Check if .env file exists
    env_file = Path(".env")
    if env_file.exists():
        print("✅ .env file already exists")
        choice = input("Do you want to update it? (y/n): ").strip().lower()
        if choice != 'y':
            print("❌ Setup cancelled.")
            return False
    
    print()
    print("📋 Choose your AI provider:")
    print("1. OpenAI (Recommended)")
    print("2. Anthropic Claude")
    print("3. Google AI")
    print("0. Cancel")
    print()
    
    choice = input("Enter your choice (0-3): ").strip()
    
    if choice == "0":
        print("❌ Setup cancelled.")
        return False
    
    providers = {
        "1": "openai",
        "2": "anthropic", 
        "3": "google"
    }
    
    provider = providers.get(choice, "openai")
    
    print(f"\n🔑 Selected provider: {provider.upper()}")
    
    if provider == "openai":
        print("\n📝 OpenAI API Key Setup:")
        print("1. Go to: https://platform.openai.com/")
        print("2. Sign in or create an account")
        print("3. Navigate to API Keys section")
        print("4. Create a new API key")
        print("5. Copy the key (starts with sk-)")
        print()
        api_key = input("🔑 Enter your OpenAI API key (sk-...): ").strip()
        
    elif provider == "anthropic":
        print("\n📝 Anthropic Claude API Key Setup:")
        print("1. Go to: https://console.anthropic.com/")
        print("2. Sign in or create an account")
        print("3. Navigate to API Keys section")
        print("4. Create a new API key")
        print("5. Copy the key (starts with sk-ant-...)")
        print()
        api_key = input("🔑 Enter your Anthropic API key (sk-ant-...): ").strip()
        
    elif provider == "google":
        print("\n📝 Google AI API Key Setup:")
        print("1. Go to: https://makersuite.google.com/app/apikey")
        print("2. Sign in or create a Google account")
        print("3. Create a new API key")
        print("4. Copy the key")
        print()
        api_key = input("🔑 Enter your Google AI API key: ").strip()
    
    else:
        print("❌ Invalid choice. Setup cancelled.")
        return False
    
    if not api_key:
        print("❌ No API key provided. Setup cancelled.")
        return False
    
    # Validate API key format
    if provider == "openai" and not api_key.startswith("sk-"):
        print("❌ Invalid OpenAI API key format. Should start with 'sk-'")
        return False
    elif provider == "anthropic" and not api_key.startswith("sk-ant-"):
        print("❌ Invalid Anthropic API key format. Should start with 'sk-ant-'")
        return False
    elif provider == "google" and len(api_key) < 20:
        print("❌ Invalid Google AI API key format. Should be longer.")
        return False
    
    # Create or update .env file
    env_content = f"""# AI Development Assistant Configuration
# Set your preferred AI provider and API key

# Choose one: openai, anthropic, google
AI_PROVIDER={provider}

# {provider.upper()} Configuration
{provider.upper()}_API_KEY={api_key}
"""
    
    try:
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(env_content)
        print(f"✅ API key configured successfully for {provider.upper()}")
        print(f"📁 Configuration saved to: {env_file.absolute()}")
        return True
    except Exception as e:
        print(f"❌ Error saving configuration: {e}")
        return False

def test_api_key():
    """Test if API key is working"""
    print("\n🧪 Testing API key...")
    
    try:
        from ai_service import get_ai_service, is_ai_available
        ai_service = get_ai_service()
        
        if is_ai_available():
            print("✅ API key is working!")
            print("🤖 AI service is available")
            return True
        else:
            print("❌ API key not working or not configured")
            print("🔧 Check your API key configuration")
            return False
    except Exception as e:
        print(f"❌ Error testing API key: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 AI Development Assistant - API Key Setup")
    print("=" * 50)
    print()
    print("🎯 Configure your API key to unlock full AI capabilities!")
    print("💡 Benefits: Real AI analysis, strategic planning, code optimization")
    print()
    
    if setup_api_key():
        print("\n🎉 API key setup completed!")
        print("\n🧪 Testing API key...")
        if test_api_key():
            print("\n🎉 SUCCESS! Your AI Assistant is now fully functional!")
            print("\n🚀 Next Steps:")
            print("   1. Run: run_ai_assistant.bat")
            print("   2. Choose AI Development Assistant or AI Blob System")
            print("   3. Experience real AI-powered capabilities!")
            print("\n🌟 You now have access to:")
            print("   • Intelligent code analysis and recommendations")
            print("   • Strategic development planning")
            print("   • AI-powered code optimization")
            print("   • Automated documentation generation")
            print("   • Custom AI assistance for any question")
        else:
            print("\n⚠️ API key test failed")
            print("\n🔧 Troubleshooting:")
            print("   • Check your API key is correct")
            print("   • Ensure you have internet connection")
            print("   • Verify your API key has sufficient credits")
            print("\n📋 Re-run: python setup_api_key.py")
    else:
        print("\n❌ API key setup failed")
        print("\n🔧 Troubleshooting:")
        print("   • Ensure you have a valid API key")
        print("   • Check your internet connection")
        print("   • Verify API key format (starts with 'sk-' for OpenAI)")
        print("\n📋 Try again: python setup_api_key.py")
    
    print("\n" + "=" * 50)
    print("📚 Need help? Check USER_GUIDE_COMPLETE.md for detailed instructions")

if __name__ == "__main__":
    main()
