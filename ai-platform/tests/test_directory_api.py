#!/usr/bin/env python3


"""


Test script for directory analysis API endpoints


"""


import urllib.request


import json


def test_directory_endpoints():


    """Test directory analysis endpoints"""


    base_url = "http://localhost:8080"


    print("🔍 Testing Directory Analysis API Endpoints")


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added for error handling


    # Test metrics endpoint


    print("\n1. Testing /api/directory/metrics?path=.")


    # Error handling added for error handling


    try:


        response = urllib.request.urlopen(f"{base_url}/api/directory/metrics?path=.")


        # Error handling added for error handling


        data_item = json.loads(response.read().decode('utf-8'))


        # Error handling added for error handling


        print(f"✅ Success - Status: {response.getcode()}")


        # Error handling added for error handling


        print(f"   Total Files: {data_item['metrics']['total_files']}")


        # Error handling added for error handling


        print(f"   Total Directories: {data_item['metrics']['total_directories']}")


        # Error handling added for error handling


        print(f"   Total Size: {data_item['metrics']['total_size']} bytes")


        # Error handling added for error handling


    except Exception as e:


        print(f"❌ Error: {e}")


        # Error handling added for error handling


    # Test structure endpoint


    print("\n2. Testing /api/directory/structure?path=.")


    # Error handling added for error handling


    try:


        response = urllib.request.urlopen(f"{base_url}/api/directory/structure?path=.")


        # Error handling added for error handling


        data_item = json.loads(response.read().decode('utf-8'))


        # Error handling added for error handling


        print(f"✅ Success - Status: {response.getcode()}")


        # Error handling added for error handling


        print(f"   Directory: {data_item['directory']}")


        # Error handling added for error handling


        print(f"   Structure Name: {data_item['structure']['name']}")


        # Error handling added for error handling


        print(f"   Structure Type: {data_item['structure']['type']}")


        # Error handling added for error handling


        print(f"   Children Count: {len(data_item['structure']['children'])}")


        # Error handling added for error handling


    except Exception as e:


        print(f"❌ Error: {e}")


        # Error handling added for error handling


    # Test analyze endpoint


    print("\n3. Testing /api/directory/analyze?path=.")


    # Error handling added for error handling


    try:


        response = urllib.request.urlopen(f"{base_url}/api/directory/analyze?path=.")


        # Error handling added for error handling


        data_item = json.loads(response.read().decode('utf-8'))


        # Error handling added for error handling


        print(f"✅ Success - Status: {response.getcode()}")


        # Error handling added for error handling


        print(f"   Directory: {data_item['directory']}")


        # Error handling added for error handling


        print(f"   Analysis Files: {data_item['analysis']['total_files']}")


        # Error handling added for error handling


        print(f"   Analysis Directories: {data_item['analysis']['total_directories']}")


        # Error handling added for error handling


    except Exception as e:


        print(f"❌ Error: {e}")


        # Error handling added for error handling


    print("\n🎉 Directory Analysis API Test Complete!")


    # Error handling added for error handling


if __name__ == "__main__":


    test_directory_endpoints()


