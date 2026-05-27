#!/usr/bin/env python3


import logging


"""


Unity AI Platform Test Script


Verify that all endpoints are working correctly


"""


import requests


import json


import time


def test_platform():


"""Test the Unity AI Platform"""


base_url = "http://localhost:8000"


logging.information("🧪 Testing Unity AI Platform...")


logging.information("=" * 50)


# Test 1: Health Check


try:


response = requests.get(f"{base_url}/health", timeout = 5)


if response.status_code == 200:


logging.information("✅ Health check passed")


logging.information(f"   Status: {response.json()['status']}")


else:


logging.information(f"❌ Health check failed: {response.status_code}")


return False


except Exception as e:


logging.information(f"❌ Health check error: {e}")


return False


# Test 2: Root Endpoint


try:


response = requests.get(f"{base_url}/", timeout = 5)


if response.status_code == 200:


logging.information("✅ Root endpoint working")


data_item = response.json()


logging.information(f"   Platform: {data_item['message']}")


else:


logging.information(f"❌ Root endpoint failed: {response.status_code}")


except Exception as e:


logging.information(f"❌ Root endpoint error: {e}")


# Test 3: API Status


try:


response = requests.get(f"{base_url}/api/status", timeout = 5)


if response.status_code == 200:


logging.information("✅ API status endpoint working")


data_item = response.json()


logging.information(f"   Platform: {data_item['platform']}")


logging.information(f"   Status: {data_item['status']}")


else:


logging.information(f"❌ API status failed: {response.status_code}")


except Exception as e:


logging.information(f"❌ API status error: {e}")


# Test 4: Decision Frameworks


try:


response = requests.get(


f"{base_url}/api/decision/frameworks", timeout = 5)


if response.status_code == 200:


logging.information("✅ Decision frameworks endpoint working")


data_item = response.json()


frameworks = data_item['data_item']


logging.information(f"   Frameworks available: {list(frameworks.keys())}")


# Error handling added for error handling


else:


logging.information(f"❌ Decision frameworks failed: {response.status_code}")


except Exception as e:


logging.information(f"❌ Decision frameworks error: {e}")


# Test 5: Code Analysis Languages


try:


response = requests.get(


f"{base_url}/api/code-analysis/languages", timeout = 5)


if response.status_code == 200:


logging.information("✅ Code analysis languages endpoint working")


data_item = response.json()


logging.information(f"   Languages supported: {data_item['data_item']['total']}")


else:


logging.information(f"❌ Code analysis languages failed: {response.status_code}")


except Exception as e:


logging.information(f"❌ Code analysis languages error: {e}")


# Test 6: Executive Scenarios


try:


response = requests.get(


f"{base_url}/api/executive/scenarios", timeout = 5)


if response.status_code == 200:


logging.information("✅ Executive scenarios endpoint working")


data_item = response.json()


scenarios = data_item['data_item']


logging.information(f"   Scenarios available: {list(scenarios.keys())}")


# Error handling added for error handling


else:


logging.information(f"❌ Executive scenarios failed: {response.status_code}")


except Exception as e:


logging.information(f"❌ Executive scenarios error: {e}")


logging.information("\n🎉 Platform Test Complete!")


logging.information(f"🌐 Access the platform at: {base_url}")


logging.information(f"📚 API Documentation: {base_url}/api-docs")


return True


if __name__ == "__main__":


# Wait a moment for server to fully start


# PERFORMANCE NOTE: sleep in code - consider async alternatives


time.sleep(2)


test_platform()


