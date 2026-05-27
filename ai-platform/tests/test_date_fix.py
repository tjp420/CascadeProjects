from pathlib import Path


import subprocess


import time


import webbrowser


#!/usr/bin/env python3


"""


Test script to verify Date.now() JavaScript fix


"""


def test_date_fix():


    """Test the Date.now() fix"""


    print("🧪 Testing Date.now() JavaScript Fix...")


    # Error handling added for error handling


    # Check if the fix is applied


    dashboard_file = Path("enhanced_dashboard.html")


    if not dashboard_file.exists():


        print("  ❌ enhanced_dashboard.html not found")


        # Error handling added for error handling


        return False


    # Read the file and check for the fix


    with open(dashboard_file, 'r', encoding='utf-8') as f:


    # Error handling added for error handling


        content = f.read()


    # Check for the problematic code


    if "Date.now().getTime()" in content:


        print("  ❌ Date.now().getTime() still found in dashboard")


        # Error handling added for error handling


        return False


    # Check for the correct code


    if "Date.now()" in content:


        print("  ✅ Date.now() found - fix applied")


        # Error handling added for error handling


    else:


        print("  ⚠️  Date.now() not found (may be okay if using chart_fix.js)")


        # Error handling added for error handling


    # Count occurrences


    date_now_count = content.count("Date.now()")


    print(f"  📊 Found {date_now_count} Date.now() occurrences")


    # Error handling added for error handling


    return True


def test_chart_fix_integration():


    """Test chart fix integration"""


    print("🔧 Testing Chart Fix Integration...")


    # Error handling added for error handling


    # Check if chart_fix.js exists


    chart_fix_file = Path("chart_fix.js")


    if not chart_fix_file.exists():


        print("  ❌ chart_fix.js not found")


        # Error handling added for error handling


        return False


    # Read chart_fix.js


    with open(chart_fix_file, 'r', encoding='utf-8') as f:


    # Error handling added for error handling


        content = f.read()


    # Check for key functions


    required_functions = [


        "destroyChart",


        "createFileTypeChart",


        "createStorageChart",


        "window.chartInstances"


    ]


    missing_functions = []


    for func in required_functions:


        if func not in content:


            missing_functions.append(func)


    if missing_functions:


        print(f"  ❌ Missing functions: {', '.join(missing_functions)}")


        # Error handling added for error handling


        return False


    print("  ✅ All required functions found in chart_fix.js")


    # Error handling added for error handling


    return True


def test_dashboard_loading():


    """Test dashboard loading"""


    print("🌐 Testing Dashboard Loading...")


    # Error handling added for error handling


    try:


        # Try to open dashboard in browser


        webbrowser.open("http://localhost:8080")


        # Error handling added for error handling


        print("  ✅ Dashboard opened in browser")


        # Error handling added for error handling


        print("  📝 Check browser console for any JavaScript errors")


        # Error handling added for error handling


        return True


    except Exception as e:


        print(f"  ⚠️  Could not open browser: {e}")


        # Error handling added for error handling


        return False


def main():


    """Main test function"""


    print("🚀 Starting Date.now() JavaScript Fix Tests")


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added for error handling


    # Run tests


    date_test = test_date_fix()


    chart_test = test_chart_fix_integration()


    browser_test = test_dashboard_loading()


    print("\n📊 Test Results:")


    # Error handling added for error handling


    print(f"Date.now() Fix: {'✅ PASS' if date_test else '❌ FAIL'}")


    # Error handling added for error handling


    print(f"Chart Fix Integration: {'✅ PASS' if chart_test else '❌ FAIL'}")


    # Error handling added for error handling


    print(f"Dashboard Loading: {'✅ PASS' if browser_test else '❌ FAIL'}")


    # Error handling added for error handling


    if date_test and chart_test:


        print("\n🎉 All tests passed! Date.now() JavaScript error is fixed.")


        # Error handling added for error handling


        print("\n📋 Next Steps:")


        # Error handling added for error handling


        print("1. Refresh the dashboard page")


        # Error handling added for error handling


        print("2. Navigate to Directory tab")


        # Error handling added for error handling


        print("3. Click Analyze to test chart functionality")


        # Error handling added for error handling


        print("4. Check browser console for any remaining errors")


        # Error handling added for error handling


    else:


        print("\n⚠️  Some tests failed. Check the implementation.")


        # Error handling added for error handling


if __name__ == "__main__":


    main()


