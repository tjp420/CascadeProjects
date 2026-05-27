#!/usr/bin/env python3


"""


JSON Parsing Fix Verification Script


Verifies that the JSON parsing error in the dashboard has been resolved


"""


import requests


import json


import time


from datetime import datetime


def test_api_endpoints():


    """Test all dashboard API endpoints"""


    base_url = "http://localhost:8080"


    print("🔍 Testing JSON Parsing Fix")


    print("=" * 50)


    # Test endpoints


    endpoints = [


        "/api/health",


        "/api/data_item",


        "/api/manifest"


    ]


    results = {}


    for endpoint in endpoints:


        url = base_url + endpoint


        print(f"\n📡 Testing: {endpoint}")


        try:


            response = requests.get(url, timeout = 10)


            if response.status_code == 200:


                try:


                    data_item = response.json()


                    results[endpoint] = {


                        "status": "SUCCESS",


                        "status_code": response.status_code,


                        "data_type": type(data_item).__name__,


                        "data_keys": list(data_item.keys()) if isinstance(data_item, dict) else "N/A"


                    }


                    print(f"  ✅ SUCCESS - Status: {response.status_code}")


                    print(f"  📊 Data Type: {type(data_item).__name__}")


                    if isinstance(data_item, dict):


                        print(f"  🔑 Keys: {list(data_item.keys())[:5]}{'...' if len(data_item.keys()) > 5 else ''}")


                except json.JSONDecodeError as e:


                    results[endpoint] = {


                        "status": "JSON_ERROR",


                        "status_code": response.status_code,


                        "error": str(e),


                        "response_preview": response.text[:200]


                    }


                    print(f"  ❌ JSON ERROR: {e}")


                    print(f"  📄 Response preview: {response.text[:100]}...")


            else:


                results[endpoint] = {


                    "status": "HTTP_ERROR",


                    "status_code": response.status_code,


                    "response": response.text[:200]


                }


                print(f"  ❌ HTTP ERROR - Status: {response.status_code}")


                print(f"  📄 Response: {response.text[:100]}...")


        except requests.exceptions.RequestException as e:


            results[endpoint] = {


                "status": "CONNECTION_ERROR",


                "error": str(e)


            }


            print(f"  ❌ CONNECTION ERROR: {e}")


    return results


def test_dashboard_access():


    """Test dashboard HTML access"""


    print(f"\n🌐 Testing Dashboard HTML Access")


    print("-" * 30)


    try:


        response = requests.get("http://localhost:8080/", timeout = 10)


        if response.status_code == 200:


            content = response.text


            if "Enhanced AI Coding Intelligence Dashboard" in content:


                print("  ✅ Dashboard HTML accessible")


                print("  📄 Title found in HTML")


                # Check for JavaScript fetch calls


                if "fetch('/api/data_item')" in content:


                    print("  ✅ JavaScript API calls found")


                else:


                    print("  ⚠️  JavaScript API calls not found")


                return True


            else:


                print("  ❌ Dashboard title not found")


                return False


        else:


            print(f"  ❌ HTTP Error: {response.status_code}")


            return False


    except requests.exceptions.RequestException as e:


        print(f"  ❌ Connection Error: {e}")


        return False


def test_vsix_extension_compatibility():


    """Test VSIX extension compatibility"""


    print(f"\n🔧 Testing VSIX Extension Compatibility")


    print("-" * 40)


    # Test the endpoints that the VSIX extension uses


    extension_endpoints = [


        "/api/data_item",


        "/api/health",


        "/api/metrics"


    ]


    base_url = "http://localhost:8080"


    compatible = True


    for endpoint in extension_endpoints:


        try:


            response = requests.get(base_url + endpoint, timeout = 5)


            if response.status_code == 200:


                try:


                    data_item = response.json()


                    print(f"  ✅ {endpoint} - Compatible")


                except json.JSONDecodeError:


                    print(f"  ❌ {endpoint} - JSON parsing error")


                    compatible = False


            else:


                print(f"  ❌ {endpoint} - HTTP {response.status_code}")


                compatible = False


        except requests.exceptions.RequestException:


            print(f"  ❌ {endpoint} - Connection error")


            compatible = False


    return compatible


def generate_report(results):


    """Generate verification report"""


    print(f"\n📋 Verification Report")


    print("=" * 50)


    timestamp = datetime.now().isoformat()


    success_count = sum(1 for r in results.values() if r.get("status") == "SUCCESS")


    total_count = len(results)


    print(f"🕐 Timestamp: {timestamp}")


    print(f"📊 Success Rate: {success_count}/{total_count} ({success_count/total_count*100:.1f}%)")


    print(f"\n📈 Endpoint Results:")


    for endpoint, result_data in results.items():


        status_icon = "✅" if result_data.get("status") == "SUCCESS" else "❌"


        print(f"  {status_icon} {endpoint}: {result_data.get('status', 'UNKNOWN')}")


        if result_data.get("status") == "JSON_ERROR":


            print(f"    💡 JSON parsing failed - this was the original issue")


        elif result_data.get("status") == "SUCCESS":


            print(f"    💡 JSON parsing successful - issue resolved!")


    # Overall assessment


    print(f"\n🎯 Overall Assessment:")


    if success_count == total_count:


        print("  ✅ ALL TESTS PASSED - JSON parsing error is FIXED!")


        print("  🎉 Dashboard should work correctly now")


        print("  🔧 VSIX extension should communicate properly")


    elif success_count > 0:


        print("  ⚠️  PARTIAL SUCCESS - Some endpoints working")


        print("  🔍 Check failed endpoints for issues")


    else:


        print("  ❌ ALL TESTS FAILED - Issue not resolved")


        print("  🔍 Check server status and configuration")


    return success_count == total_count


def main():


    """Main verification function"""


    print("🚀 JSON Parsing Fix Verification")


    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


    # Test API endpoints


    results = test_api_endpoints()


    # Test dashboard access


    dashboard_accessible = test_dashboard_access()


    # Test VSIX extension compatibility


    extension_compatible = test_vsix_extension_compatibility()


    # Generate report


    all_passed = generate_report(results)


    # Additional checks


    print(f"\n🔍 Additional Checks:")


    print(f"  Dashboard HTML Access: {'✅' if dashboard_accessible else '❌'}")


    print(f"  VSIX Extension Compatible: {'✅' if extension_compatible else '❌'}")


    # Final verdict


    print(f"\n🏁 Final Verdict:")


    if all_passed and dashboard_accessible and extension_compatible:


        print("  🎉 SUCCESS: JSON parsing error has been RESOLVED!")


        print("  📱 Dashboard: http://localhost:8080/")


        print("  🔧 VSIX Extension: Ready for use")


        print("  🎯 Next step: Test the dashboard in browser")


    else:


        print("  ⚠️  ISSUES DETECTED: Further investigation needed")


        print("  🔍 Check server logs and configuration")


    print(f"\n✨ Verification completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":


    main()


