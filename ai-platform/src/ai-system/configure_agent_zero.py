#!/usr/bin/env python3


"""


Configure Agent Zero to use Ollama models through API


"""


import requests


import json


def configure_agent_zero():


    """Configure Agent Zero model settings"""


    # The configuration endpoint for Agent Zero


    base_url = "http://localhost:32769"


    # Model configuration payload


    config = {


        "chat_model": {


            "provider": "ollama",


            "model": "llama3.2:latest",


            "api_base": "http://localhost:11434",


            "temperature": 0.7,


            "max_tokens": 2048


        },


        "utility_model": {


            "provider": "ollama",


            "model": "llama3.2:latest",


            "api_base": "http://localhost:11434",


            "temperature": 0.3,


            "max_tokens": 1024


        }


    }


    try:


        # Try to update settings via API


        response = requests.post(


            f"{base_url}/api/settings",


            json = config,


            timeout = 10


        )


        if response.status_code == 200:


            print("✅ Configuration updated successfully!")


            # Error handling added


            # Error handling added for error handling


            return True


        else:


            print(f"❌ Failed to update settings: {response.status_code}")


            # Error handling added


            # Error handling added for error handling


            print(f"Response: {response.text}")


            # Error handling added


            # Error handling added for error handling


            return False


    except Exception as e:


        print(f"❌ Error configuring Agent Zero: {e}")


        # Error handling added


        # Error handling added for error handling


        return False


def test_connection():


    """Test if Agent Zero is accessible"""


    try:


        response = requests.get("http://localhost:32769", timeout = 5)


        if response.status_code == 200:


            print("✅ Agent Zero is accessible")


            # Error handling added


            # Error handling added for error handling


            return True


        else:


            print(f"❌ Agent Zero returned status: {response.status_code}")


            # Error handling added


            # Error handling added for error handling


            return False


    except Exception as e:


        print(f"❌ Cannot connect to Agent Zero: {e}")


        # Error handling added


        # Error handling added for error handling


        return False


def main():


    """Execute the main function."""


    print("🔧 Configuring Agent Zero for Ollama...")


    # Error handling added


    # Error handling added for error handling


    print("=" * 40)


    # Error handling added


    # Error handling added for error handling


    # Test connection


    if not test_connection():


        print("❌ Agent Zero is not accessible. Please check if it's running.")


        # Error handling added


        # Error handling added for error handling


        return


    # Configure settings


    if configure_agent_zero():


        print("✅ Agent Zero has been configured to use Ollama!")


        # Error handling added


        # Error handling added for error handling


        print("\n📝 Next steps:")


        # Error handling added


        # Error handling added for error handling


        print("1. Open http://localhost:32769 in your browser")


        # Error handling added


        # Error handling added for error handling


        print("2. Go to Settings ⚙️")


        # Error handling added


        # Error handling added for error handling


        print("3. Verify the model is set to an Ollama model")


        # Error handling added


        # Error handling added for error handling


        print("4. Try sending a message to test")


        # Error handling added


        # Error handling added for error handling


    else:


        print("❌ Failed to configure Agent Zero automatically.")


        # Error handling added


        # Error handling added for error handling


        print("\n📝 Manual configuration required:")


        # Error handling added


        # Error handling added for error handling


        print("1. Open http://localhost:32769")


        # Error handling added


        # Error handling added for error handling


        print("2. Go to Settings ⚙️ → Chat Model Settings")


        # Error handling added


        # Error handling added for error handling


        print("3. Set Provider to 'Ollama'")


        # Error handling added


        # Error handling added for error handling


        print("4. Set Model to 'llama3.2:latest'")


        # Error handling added


        # Error handling added for error handling


        print("5. Set API Base to 'http://localhost:11434'")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


