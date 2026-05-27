#!/usr/bin/env python3
"""
Setup Real AI Dependencies
Installs required packages for real AI integration
"""

import subprocess
import sys
import os
from pathlib import Path

def install_package(package_name):
    """Install a package using pip"""
    try:
        print(f"📦 Installing {package_name}...")
        result = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, "-m", "pip", "install", package_name], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {package_name} installed successfully")
            return True
        else:
            print(f"❌ Failed to install {package_name}: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error installing {package_name}: {e}")
        return False

def check_package_installed(package_name):
    """Check if a package is installed"""
    try:
        __import__(package_name)
        return True
    except ImportError:
        return False

def create_env_file():
    """Create environment configuration file"""
    env_content = """# Real AI Development Assistant Configuration
# Set your preferred AI provider and API key

# Choose one: openai, anthropic, google
AI_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration  
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google AI Configuration
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Instructions:
# 1. Set AI_PROVIDER to your preferred provider
# 2. Set the corresponding API key
# 3. Remove the # from the lines you want to use
# 4. Save this file as .env or set environment variables
"""
    
    env_file = Path(".env.example")
    try:
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(env_content)
        print(f"✅ Environment configuration file created: {env_file}")
        print(f"📝 Please edit this file with your API keys and rename to .env")
        return True
    except Exception as e:
        print(f"❌ Error creating environment file: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Setting up Real AI Development Assistant")
    print("=" * 50)
    
    # Check Python version
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}"
    print(f"🐍 Python version: {python_version}")
    
    if sys.version_info < (3, 7):
        print("❌ Python 3.7+ is required")
        return
    
    # Packages to install
    packages = {
        "openai": "OpenAI GPT integration",
        "anthropic": "Anthropic Claude integration", 
        "google-generativeai": "Google AI integration"
    }
    
    print(f"\n📦 Installing AI packages...")
    installed_packages = []
    
    for package, description in packages.items():
        if check_package_installed(package.replace('-', '_')):
            print(f"✅ {package} already installed ({description})")
            installed_packages.append(package)
        else:
            if install_package(package):
                installed_packages.append(package)
    
    print(f"\n✅ Setup complete! Installed {len(installed_packages)} packages")
    
    # Create environment configuration
    print(f"\n⚙️ Setting up environment configuration...")
    if create_env_file():
        print(f"✅ Environment configuration ready")
    else:
        print(f"❌ Failed to create environment configuration")
    
    # Show next steps
    print(f"\n🎯 Next Steps:")
    print(f"1. Edit .env.example with your API key")
    print(f"2. Rename .env.example to .env")
    print(f"3. Run: python run_ai_assistant.bat")
    print(f"4. Choose your AI provider in the environment")
    
    print(f"\n📚 AI Provider Setup:")
    print(f"🔹 OpenAI: Get API key from https://platform.openai.com/")
    print(f"🔹 Anthropic: Get API key from https://console.anthropic.com/")
    print(f"🔹 Google AI: Get API key from https://makersuite.google.com/app/apikey")
    
    print(f"\n🎉 Your Real AI Development Assistant will be ready after configuration!")

if __name__ == "__main__":
    main()
