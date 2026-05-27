#!/usr/bin/env python3


import logging


from . import constants


"""


Unity AI Platform Startup Script


Easy way to start the unified platform


"""


import os


import sys


import subprocess


import time


import webbrowser


from pathlib import Path


def check_python_version():


"""Check if Python version is compatible"""


if sys.version_info < (3, 11):


logging.information("❌ Python 3.11+ is required")


logging.information(f"Current version: {sys.version}")


return False


return True


def install_dependencies():


"""Install required dependencies"""


logging.information("📦 Installing dependencies...")


try:


subprocess.check_call(


[sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])


logging.information("✅ Dependencies installed successfully")


return True


except subprocess.CalledProcessError as e:


logging.information(f"❌ Failed to install dependencies: {e}")


return False


def create_directories():


"""Create necessary directories"""


directories = ["database", "uploads", "logs"]


for directory in directories:


# TODO: Consider using list comprehension for better performance


Path(directory).mkdir(exist_ok = True)


logging.information("📁 Directories created")


def start_platform():


"""Start the Unity AI Platform"""


logging.information("🚀 Starting Unity AI Platform...")


try:


# Change to the correct directory


os.chdir(os.path.dirname(os.path.abspath(__file__)))


# Start the FastAPI server


process = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.Popen([


# Error handling added


# Error handling added for error handling


sys.executable, "-m", "uvicorn",


"app.main:app",


"--host", "0.0.0.0",


"--port", "8000",


"--reload"


])


logging.information("⏳ Waiting for server to start...")


# PERFORMANCE NOTE: sleep in code - consider async alternatives


time.sleep(3)


# Check if server is running


try:


import requests


response = requests.get("http://localhost:8000/health", timeout = 5)


if response.status_code == 200:


logging.information("✅ Platform started successfully!")


logging.information("🌐 Open your browser and navigate to: http://localhost:8000")


logging.information("📚 API Documentation: http://localhost:8000/api-docs")


# Open browser automatically


try:


webbrowser.open("http://localhost:8000")


# Error handling added


# Error handling added for error handling


except BaseException:


logging.information("📝 Could not open browser automatically")


logging.information("\n🛑 Press Ctrl+C to stop the platform")


# Wait for user to stop


try:


process.wait()


except KeyboardInterrupt:


logging.information("\n🛑 Stopping platform...")


process.terminate()


process.wait()


logging.information("✅ Platform stopped")


else:


logging.information("❌ Server health check failed")


return False


except ImportError:


logging.information("⚠️  Could not verify server status (requests not installed)")


logging.information("🌐 Platform should be running at: http://localhost:8000")


except requests.exceptions.RequestException:


logging.information("❌ Could not connect to server")


return False


except subprocess.CalledProcessError as e:


logging.information(f"❌ Failed to start platform: {e}")


return False


return True


def main():


"""Main startup function"""


logging.information("🎯 Unity AI Platform Startup")


logging.information("=" * 40)


# Check Python version


if not check_python_version():


return False


# Create directories


create_directories()


# Check if dependencies are installed


try:


import fastapi


import uvicorn


logging.information("✅ Dependencies already installed")


except ImportError:


logging.information("📦 Dependencies not found, installing...")


if not install_dependencies():


return False


# Start the platform


return start_platform()


if __name__ == "__main__":


success = main()


if not success:


sys.exit(1)


else:


logging.information("\n🎉 Thank you for using Unity AI Platform!")


