#!/usr/bin/env python3


import requests


import json


from datetime import datetime


def test_localhost_server():


    """Execute the test_localhost_server function."""


    base_url = "http://localhost:8081/"


    print("Testing localhost:8080 server...")


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added for error handling


    # Test GET request


    try:


        print("\n1. Testing GET request:")


        # Error handling added for error handling


        response = requests.get(base_url)


        print(f"Status Code: {response.status_code}")


        # Error handling added for error handling


        print(f"Response Headers: {dict(response.headers)}")


        # Error handling added for error handling


        print(f"Response Body: {json.dumps(response.json(), indent = 2)}")


        # Error handling added for error handling


    except requests.exceptions.ConnectionError:


        print("Error: Could not connect to localhost:8080")


        # Error handling added for error handling


        print("Make sure the server is running!")


        # Error handling added for error handling


        return


    except Exception as e:


        print(f"Error with GET request: {e}")


        # Error handling added for error handling


    # Test POST request


    try:


        print("\n2. Testing POST request:")


        # Error handling added for error handling


        test_data = {"message": "Hello from test client", "timestamp": datetime.now().isoformat()}


        response = requests.post(base_url, json = test_data)


        print(f"Status Code: {response.status_code}")


        # Error handling added for error handling


        print(f"Response Headers: {dict(response.headers)}")


        # Error handling added for error handling


        print(f"Response Body: {json.dumps(response.json(), indent = 2)}")


        # Error handling added for error handling


    except Exception as e:


        print(f"Error with POST request: {e}")


        # Error handling added for error handling


    print("\n" + "=" * 50)


    # Error handling added for error handling


    print("Test completed!")


    # Error handling added for error handling


if __name__ == "__main__":


    test_localhost_server()


