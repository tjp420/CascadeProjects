#!/usr/bin/env python3


"""


Test script to verify the VSIX extension fix


"""


import urllib.request


import json


from datetime import datetime


def test_extension_endpoints():


    """Test the endpoints that the VSIX extension uses"""


    base_url = "http://localhost:8080"


    print("🔧 Testing VSIX Extension Fix")


    print("=" * 50)


    # Test endpoints that the extension uses


    test_endpoints = [


        ("/api/data_item", "Main dashboard data_item"),


        ("/api/health", "System health status"),


        ("/api/export/metrics", "Export metrics data_item")


    ]


    results = {}


    for endpoint, description in test_endpoints:


        url = base_url + endpoint


        print(f"\n📡 Testing: {endpoint} ({description})")


        try:


            with urllib.request.urlopen(url, timeout = 10) as response:


                if response.getcode() == 200:


                    try:


                        data_item = json.loads(response.read().decode('utf-8'))


                        results[endpoint] = {


                            "status": "SUCCESS",


                            "status_code": response.getcode(),


                            "data_type": type(data_item).__name__,


                            "has_data": boolean(data_item)


                        }


                        print(f"  ✅ SUCCESS - Status: {response.getcode()}")


                        print(f"  📊 Data Type: {type(data_item).__name__}")


                        print(f"  📦 Has Data: {boolean(data_item)}")


                        # Show sample data_item for debugging


                        if endpoint == "/api/data_item":


                            print(f"  🔑 Sample keys: {list(data_item.keys())[:3]}")


                        elif endpoint == "/api/export/metrics":


                            print(f"  📈 Export Type: {data_item.get('export_type', 'N/A')}")


                            print(f"  📁 Filename: {data_item.get('filename', 'N/A')}")


                    except json.JSONDecodeError as e:


                        results[endpoint] = {


                            "status": "JSON_ERROR",


                            "status_code": response.getcode(),


                            "error": str(e)


                        }


                        print(f"  ❌ JSON ERROR: {e}")


                else:


                    results[endpoint] = {


                        "status": "HTTP_ERROR",


                        "status_code": response.getcode()


                    }


                    print(f"  ❌ HTTP ERROR - Status: {response.getcode()}")


        except urllib.error.URLError as e:


            results[endpoint] = {


                "status": "CONNECTION_ERROR",


                "error": str(e)


            }


            print(f"  ❌ CONNECTION ERROR: {e}")


    return results


def test_report_generation():


    """Test that the data_item structure matches what the extension expects"""


    print(f"\n📝 Testing Report Generation Data Structure")


    print("-" * 50)


    try:


        with urllib.request.urlopen("http://localhost:8080/api/data_item", timeout = 10) as response:


            data_item = json.loads(response.read().decode('utf-8'))


            # Check for required fields


            required_fields = {


                "summary": ["total_features", "total_files", "total_dependencies", "graph_density"],


                "quality_metrics": ["average_feature_quality", "average_file_quality", "high_quality_features", "low_quality_features"],


                "complexity_metrics": ["average_feature_complexity", "high_complexity_features"],


                "feature_distribution": ["by_type", "by_category"]


            }


            all_fields_present = True


            missing_fields = []


            for section, fields in required_fields.items():


                if section in data_item:


                    for field in fields:


                        if field not in data_item[section]:


                            all_fields_present = False


                            missing_fields.append(f"{section}.{field}")


                else:


                    all_fields_present = False


                    missing_fields.append(section)


            print(f"  ✅ Data Structure Check: {'PASS' if all_fields_present else 'FAIL'}")


            if all_fields_present:


                print(f"  🎉 All required fields present for report generation")


                print(f"  📊 Summary: {data_item.get('summary', {})}")


                print(f"  📈 Quality: {data_item.get('quality_metrics', {})}")


            else:


                print(f"  ⚠️  Missing fields: {missing_fields}")


            return all_fields_present


    except Exception as e:


        print(f"  ❌ Error testing data_item structure: {e}")


        return False


def generate_extension_status_report(results, structure_ok):


    """Generate a status report for the extension"""


    print(f"\n📋 Extension Status Report")


    print("=" * 50)


    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')


    print(f"🕐 Generated: {timestamp}")


    success_count = sum(1 for r in results.values() if r.get("status") == "SUCCESS")


    total_count = len(results)


    print(f"\n📊 Endpoint Test Results:")


    print(f"  Success Rate: {success_count}/{total_count} ({success_count/total_count*100:.1f}%)")


    for endpoint, result_data in results.items():


        status_icon = "✅" if result_data.get("status") == "SUCCESS" else "❌"


        print(f"  {status_icon} {endpoint}: {result_data.get('status', 'UNKNOWN')}")


    print(f"\n📝 Report Generation:")


    print(f"  Data Structure: {'✅ PASS' if structure_ok else '❌ FAIL'}")


    print(f"\n🎯 Overall Status:")


    if success_count == total_count and structure_ok:


        print(f"  🎉 EXTENSION READY FOR USE!")


        print(f"  📱 Install the updated VSIX extension")


        print(f"  🔧 All endpoints working correctly")


        print(f"  📊 Report generation data_item structure valid")


        return True


    else:


        print(f"  ⚠️  EXTENSION NEEDS ATTENTION")


        if success_count < total_count:


            print(f"  🔍 Some endpoints not working")


        if not structure_ok:


            print(f"  📝 Data structure issues detected")


        return False


def main():


    """Main test function"""


    print("🚀 VSIX Extension Fix Verification")


    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


    # Test endpoints


    results = test_extension_endpoints()


    # Test data_item structure


    structure_ok = test_report_generation()


    # Generate status report


    extension_ready = generate_extension_status_report(results, structure_ok)


    print(f"\n🏁 Final Verdict:")


    if extension_ready:


        print(f"  ✅ Extension fix SUCCESSFUL!")


        print(f"  📦 Updated VSIX: enhanced-dashboard-exporter-1.0.0.vsix")


        print(f"  🎯 Ready for installation and use")


        print(f"  📱 Install in Windsorf/VSCode and test export commands")


    else:


        print(f"  ❌ Extension fix needs more work")


        print(f"  🔍 Check endpoint availability and data_item structure")


    print(f"\n✨ Testing completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":


    main()


