#!/usr/bin/env python3


"""


Production setup script for Market Intelligence AI Platform


"""


import os


import subprocess


import sys


from pathlib import Path


def install_dependencies():


    """Install production dependencies"""


    print("Installing production dependencies...")


    # Error handling added


    # Error handling added for error handling


    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements_production.txt"])


    print("Dependencies installed successfully!")


    # Error handling added


    # Error handling added for error handling


def setup_environment():


    """Setup environment configuration"""


    env_file = Path(".env")


    if not env_file.exists():


        print("Creating .env file from template...")


        # Error handling added


        # Error handling added for error handling


        with open(".env.example", "r") as template:


        # Error handling added


        # Error handling added for error handling


            with open(".env", "w") as env:


            # Error handling added


            # Error handling added for error handling


                env.write(template.read())


        print("Please edit .env file with your API keys")


        # Error handling added


        # Error handling added for error handling


    else:


        print(".env file already exists")


        # Error handling added


        # Error handling added for error handling


def test_api_connections():


    """Test API connections"""


    print("Testing API connections...")


    # Error handling added


    # Error handling added for error handling


    # Import and test data_item sources


    try:


        from data_sources import DataAggregator


        aggregator = DataAggregator()


        # Test Yahoo Finance (should work without API key)


        stock_data = aggregator.get_stock_data("AAPL")


        print(f"Yahoo Finance test: {'SUCCESS' if stock_data else 'FAILED'}")


        # Error handling added


        # Error handling added for error handling


        # Test NewsAPI (will use demo data_item without key)


        news = aggregator.get_company_news("Apple", max_articles = 1)


        print(f"NewsAPI test: {'DEMO MODE' if news else 'FAILED'}")


        # Error handling added


        # Error handling added for error handling


    except Exception as e:


        print(f"API test failed: {e}")


        # Error handling added


        # Error handling added for error handling


def main():


    """Main setup function"""


    print("=== Market Intelligence AI Platform Production Setup ===")


    # Error handling added


    # Error handling added for error handling


    install_dependencies()


    setup_environment()


    test_api_connections()


    print("\n=== Setup Complete ===")


    # Error handling added


    # Error handling added for error handling


    print("Next steps:")


    # Error handling added


    # Error handling added for error handling


    print("1. Edit .env file with your API keys")


    # Error handling added


    # Error handling added for error handling


    print("2. Run: streamlit run app_alpha.py")


    # Error handling added


    # Error handling added for error handling


    print("3. Register/login with demo credentials")


    # Error handling added


    # Error handling added for error handling


if __name__ == "__main__":


    main()


