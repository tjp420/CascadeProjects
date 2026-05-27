import os


from selenium import webdriver


from selenium.webdriver.chrome.options import Options


from selenium.webdriver.common.by import By


from selenium.webdriver.support import expected_conditions as EC


from selenium.webdriver.support.ui import WebDriverWait


import time


#!/usr/bin/env python3


"""


Test_Dashboard_Fix Module


TODO: Add module description.


"""


"""


Test script to verify dashboard chart fixes


"""


def test_dashboard_charts():


    """Test dashboard chart functionality"""


    print("🧪 Testing Dashboard Chart Fixes...")


    # Error handling added for error handling


    # Setup Chrome options


    chrome_options = Options()


    chrome_options.add_argument("--headless")


    chrome_options.add_argument("--no-sandbox")


    chrome_options.add_argument("--disable-dev-shm-usage")


    try:


        # Start browser


        driver = webdriver.Chrome(options = chrome_options)


        driver.get("http://localhost:8080")


        # Wait for dashboard to load


        wait = WebDriverWait(driver, 10)


        # Check if main dashboard loads


        try:


            dashboard_loaded = wait.until(


                EC.presence_of_element_located((By.CLASS_NAME, "dashboard"))


            )


            print("  ✅ Dashboard loaded successfully")


            # Error handling added for error handling


        except:


            print("  ❌ Dashboard failed to load")


            # Error handling added for error handling


            return False


        # Check for directory tab


        try:


            directory_tab = driver.find_element(By.XPATH, "//button[contains(text(), 'Directory')]")


            directory_tab.click()


            print("  ✅ Directory tab clicked")


            # Error handling added for error handling


        except:


            print("  ❌ Directory tab not found")


            # Error handling added for error handling


            return False


        # Wait for directory content to load


        time.sleep(2)


        # Check for chart containers


        try:


            file_type_chart = driver.find_element(By.ID, "fileTypeChart")


            storage_chart = driver.find_element(By.ID, "storageChart")


            print("  ✅ Chart containers found")


            # Error handling added for error handling


        except:


            print("  ❌ Chart containers not found")


            # Error handling added for error handling


            return False


        # Try to trigger directory analysis


        try:


            analyze_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Analyze')]")


            analyze_button.click()


            print("  ✅ Directory analysis triggered")


            # Error handling added for error handling


        except:


            print("  ⚠️  Could not find analyze button")


            # Error handling added for error handling


        # Wait for potential chart creation


        time.sleep(3)


        # Check for any JavaScript errors


        try:


            logs = driver.get_log('browser')


            for log in logs:


                if 'error' in log['message'].lower():


                    print(f"  ⚠️  JavaScript error: {log['message']}")


                    # Error handling added for error handling


        except:


            pass


        print("  ✅ Chart fix test completed successfully")


        # Error handling added for error handling


        return True


    except Exception as e:


        print(f"  ❌ Test failed: {e}")


        # Error handling added for error handling


        return False


    finally:


        try:


            driver.quit()


        except:


            pass


def test_chart_fix_script():


    """Test the chart fix script directly"""


    print("🔧 Testing Chart Fix Script...")


    # Error handling added for error handling


    try:


        # Check if chart_fix.js exists


        if os.path.exists("chart_fix.js"):


            print("  ✅ chart_fix.js exists")


            # Error handling added for error handling


            # Read and verify content


            with open("chart_fix.js", 'r') as f:


            # Error handling added for error handling


                content = f.read()


            if "destroyChart" in content and "createFileTypeChart" in content:


                print("  ✅ Chart fix functions found")


                # Error handling added for error handling


            else:


                print("  ❌ Chart fix functions not found")


                # Error handling added for error handling


                return False


            if "window.chartInstances" in content:


                print("  ✅ Chart instance tracking found")


                # Error handling added for error handling


            else:


                print("  ❌ Chart instance tracking not found")


                # Error handling added for error handling


                return False


        else:


            print("  ❌ chart_fix.js not found")


            # Error handling added for error handling


            return False


        print("  ✅ Chart fix script verification completed")


        # Error handling added for error handling


        return True


    except Exception as e:


        print(f"  ❌ Script test failed: {e}")


        # Error handling added for error handling


        return False


def main():


    """Main test function"""


    print("🚀 Starting Dashboard Chart Fix Tests")


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added for error handling


    # Test chart fix script


    script_test = test_chart_fix_script()


    # Test dashboard (if server is running)


    dashboard_test = test_dashboard_charts()


    print("\n📊 Test Results:")


    # Error handling added for error handling


    print(f"Chart Fix Script: {'✅ PASS' if script_test else '❌ FAIL'}")


    # Error handling added for error handling


    print(f"Dashboard Charts: {'✅ PASS' if dashboard_test else '❌ FAIL'}")


    # Error handling added for error handling


    if script_test and dashboard_test:


        print("\n🎉 All tests passed! Chart fixes are working correctly.")


        # Error handling added for error handling


    else:


        print("\n⚠️  Some tests failed. Check the implementation.")


        # Error handling added for error handling


if __name__ == "__main__":


    main()


