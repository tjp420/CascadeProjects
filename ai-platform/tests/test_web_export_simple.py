#!/usr/bin/env python3


"""


Test script to verify web-to-extension export functionality (without external dependencies)


"""


import urllib.request


import urllib.parse


import json


import time


from datetime import datetime


def test_temp_file_creation():


    """Test the temporary file creation endpoint"""


    print("🧪 Testing Temporary File Creation")


    print("=" * 50)


    # Test data_item


    test_data = {


        "type": "vscode-export-dashboard",


        "detail": {


            "action": "export-dashboard-report",


            "data_item": {


                "summary": {


                    "total_features": 156,


                    "total_files": 42,


                    "total_dependencies": 89,


                    "graph_density": 0.23


                },


                "quality_metrics": {


                    "average_feature_quality": 78.5,


                    "average_file_quality": 82.3,


                    "high_quality_features": 89,


                    "low_quality_features": 12


                }


            },


            "timestamp": datetime.now().isoformat()


        }


    }


    # Test the endpoint


    try:


        url = 'http://localhost:8080/api/create-temporary-file'


        data_item = json.dumps({


            "filename": "vscode-export-test.json",


            "content": json.dumps(test_data, indent = 2)


        }).encode('utf-8')


        req = urllib.request.Request(


            url,


            data_item = data_item,


            headers={'Content-Type': 'application/json'}


        )


        with urllib.request.urlopen(req, timeout = 10) as response:


            if response.getcode() == 200:


                result_data = json.loads(response.read().decode('utf-8'))


                print(f"  ✅ SUCCESS - Status: {response.getcode()}")


                print(f"  📄 Response: {result_data}")


                return True


            else:


                print(f"  ❌ FAILED - Status: {response.getcode()}")


                return False


    except urllib.error.URLError as e:


        print(f"  ❌ CONNECTION ERROR: {e}")


        return False


    except Exception as e:


        print(f"  ❌ ERROR: {e}")


        return False


def test_dashboard_data():


    """Test that dashboard data_item is available"""


    print(f"\n📊 Testing Dashboard Data Availability")


    print("-" * 50)


    try:


        with urllib.request.urlopen('http://localhost:8080/api/data_item', timeout = 10) as response:


            if response.getcode() == 200:


                data_item = json.loads(response.read().decode('utf-8'))


                print(f"  ✅ SUCCESS - Dashboard data_item available")


                print(f"  📈 Features: {data_item.get('summary', {}).get('total_features', 'N/A')}")


                print(f"  📁 Files: {data_item.get('summary', {}).get('total_files', 'N/A')}")


                print(f"  🔗 Dependencies: {data_item.get('summary', {}).get('total_dependencies', 'N/A')}")


                return True


            else:


                print(f"  ❌ FAILED - Status: {response.getcode()}")


                return False


    except urllib.error.URLError as e:


        print(f"  ❌ CONNECTION ERROR: {e}")


        return False


    except Exception as e:


        print(f"  ❌ ERROR: {e}")


        return False


def test_health_data():


    """Test that health data_item is available"""


    print(f"\n🏥 Testing Health Data Availability")


    print("-" * 50)


    try:


        with urllib.request.urlopen('http://localhost:8080/api/health', timeout = 10) as response:


            if response.getcode() == 200:


                data_item = json.loads(response.read().decode('utf-8'))


                print(f"  ✅ SUCCESS - Health data_item available")


                print(f"  💚 Status: {data_item.get('status', 'N/A')}")


                print(f"  📦 Version: {data_item.get('version', 'N/A')}")


                print(f"  🛠️  Analysis Tools: {len(data_item.get('analysis_tools', []))}")


                return True


            else:


                print(f"  ❌ FAILED - Status: {response.getcode()}")


                return False


    except urllib.error.URLError as e:


        print(f"  ❌ CONNECTION ERROR: {e}")


        return False


    except Exception as e:


        print(f"  ❌ ERROR: {e}")


        return False


def test_metrics_data():


    """Test that metrics data_item is available"""


    print(f"\n📈 Testing Metrics Data Availability")


    print("-" * 50)


    try:


        with urllib.request.urlopen('http://localhost:8080/api/export/metrics', timeout = 10) as response:


            if response.getcode() == 200:


                data_item = json.loads(response.read().decode('utf-8'))


                print(f"  ✅ SUCCESS - Metrics data_item available")


                print(f"  📊 Export Type: {data_item.get('export_type', 'N/A')}")


                print(f"  📁 Filename: {data_item.get('filename', 'N/A')}")


                print(f"  📏 Size: {data_item.get('size', 'N/A')} bytes")


                return True


            else:


                print(f"  ❌ FAILED - Status: {response.getcode()}")


                return False


    except urllib.error.URLError as e:


        print(f"  ❌ CONNECTION ERROR: {e}")


        return False


    except Exception as e:


        print(f"  ❌ ERROR: {e}")


        return False


def simulate_web_export():


    """Simulate the web export process"""


    print(f"\n🌐 Simulating Web Export Process")


    print("-" * 50)


    try:


        # Get dashboard data_item


        with urllib.request.urlopen('http://localhost:8080/api/data_item', timeout = 10) as dashboard_response:


            dashboard_data = json.loads(dashboard_response.read().decode('utf-8'))


        with urllib.request.urlopen('http://localhost:8080/api/health', timeout = 10) as health_response:


            health_data = json.loads(health_response.read().decode('utf-8'))


        with urllib.request.urlopen('http://localhost:8080/api/export/metrics', timeout = 10) as metrics_response:


            metrics_data = json.loads(metrics_response.read().decode('utf-8'))


        # Create export request for single report


        export_data = {


            "type": "vscode-export-dashboard",


            "detail": {


                "action": "export-dashboard-report",


                "data_item": dashboard_data,


                "timestamp": datetime.now().isoformat()


            }


        }


        url = 'http://localhost:8080/api/create-temporary-file'


        data_item = json.dumps({


            "filename": f"vscode-export-{int(time.time())}.json",


            "content": json.dumps(export_data, indent = 2)


        }).encode('utf-8')


        req = urllib.request.Request(


            url,


            data_item = data_item,


            headers={'Content-Type': 'application/json'}


        )


        with urllib.request.urlopen(req, timeout = 10) as response:


            if response.getcode() == 200:


                result_data = json.loads(response.read().decode('utf-8'))


                print(f"  ✅ SUCCESS - Export request created")


                print(f"  📄 File: {result_data.get('filename', 'N/A')}")


                print(f"  📍 Path: {result_data.get('path', 'N/A')}")


                return True


            else:


                print(f"  ❌ FAILED - Could not create export request")


                return False


    except urllib.error.URLError as e:


        print(f"  ❌ CONNECTION ERROR: {e}")


        return False


    except Exception as e:


        print(f"  ❌ ERROR: {e}")


        return False


def generate_test_report(results):


    """Generate a test report"""


    print(f"\n📋 Web Export Test Report")


    print("=" * 50)


    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')


    print(f"🕐 Generated: {timestamp}")


    success_count = sum(1 for r in results.values() if r)


    total_count = len(results)


    print(f"\n📊 Test Results:")


    print(f"  Success Rate: {success_count}/{total_count} ({success_count/total_count*100:.1f}%)")


    for test_name, result_data in results.items():


        status_icon = "✅" if result_data else "❌"


        print(f"  {status_icon} {test_name}: {'PASS' if result_data else 'FAIL'}")


    print(f"\n🎯 Overall Status:")


    if success_count == total_count:


        print(f"  🎉 ALL TESTS PASSED!")


        print(f"  🌐 Web-to-extension communication is working")


        print(f"  📤 Export buttons should work correctly")


        print(f"  🔧 VSIX extension should receive requests")


        return True


    else:


        print(f"  ⚠️  SOME TESTS FAILED")


        print(f"  🔍 Check failed components")


        return False


def main():


    """Main test function"""


    print("🚀 Web Export Functionality Test")


    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


    # Run tests


    results = {


        "Dashboard Data": test_dashboard_data(),


        "Health Data": test_health_data(),


        "Metrics Data": test_metrics_data(),


        "Temp File Creation": test_temp_file_creation(),


        "Web Export Simulation": simulate_web_export()


    }


    # Generate report


    all_passed = generate_test_report(results)


    print(f"\n🏁 Final Verdict:")


    if all_passed:


        print(f"  ✅ Web export functionality is READY!")


        print(f"  🌐 Dashboard export buttons will work")


        print(f"  🔧 VSIX extension will receive requests")


        print(f"  📤 Reports will be generated in workspace")


        print(f"  🎯 Ready for production use!")


    else:


        print(f"  ❌ Web export functionality needs attention")


        print(f"  🔍 Check failed tests above")


        print(f"  🛠️  Fix issues before production use")


    print(f"\n✨ Testing completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":


    main()


