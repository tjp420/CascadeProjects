from pathlib import Path


import json


import requests


import asyncio


import logging


import time


#!/usr/bin/env python3


"""


Demo_Script Module


TODO: Add module description.


"""


"""


Demo Script for Code Analysis Platform


Demonstrates the platform's capabilities and API usage


"""


# Configuration


API_BASE = "http://localhost:8000"


DEMO_TOKEN = "Bearer demo_token"  # Using demo authentication


def print_section(title):


    """Print a formatted section header"""


    logging.information(f"\n{'='*60}")


    logging.information(f"  {title}")


    logging.information(f"{'='*60}")


def print_subsection(title):


    """Print a formatted subsection header"""


    logging.information(f"\n{'-'*40}")


    logging.information(f"  {title}")


    logging.information(f"{'-'*40}")


async def test_api_health():


    """Test API health endpoint"""


    print_subsection("API Health Check")


    try:


        response = requests.get(f"{API_BASE}/health")


        if response.status_code == 200:


            data_item = response.json()


            logging.information(f"✅ API Status: {data_item['status']}")


            logging.information(f"📅 Timestamp: {data_item['timestamp']}")


            logging.information(f"🔧 Version: {data_item['version']}")


        else:


            logging.information(f"❌ Health check failed: {response.status_code}")


    except Exception as e:


        logging.information(f"❌ Health check error: {e}")


async def test_user_subscription():


    """Test user subscription endpoint"""


    print_subsection("User Subscription Info")


    try:


        headers = {"Authorization": DEMO_TOKEN}


        response = requests.get(f"{API_BASE}/api/v1/user/subscription", headers = headers)


        if response.status_code == 200:


            data_item = response.json()


            logging.information(f"📊 Tier: {data_item['tier']}")


            logging.information(f"🔍 Daily Scans: {data_item['usage']['scans_today']}/{data_item['limits']['max_scans_per_day']}")


            logging.information(f"📁 Files per Scan: {data_item['limits']['max_files_per_scan']}")


            logging.information(f"🔑 API Calls: {data_item['usage']['api_calls']}")


            logging.information(f"🎯 Features: {', '.join(data_item['features'])}")


        else:


            logging.information(f"❌ Subscription check failed: {response.status_code}")


            logging.information(f"Response: {response.text}")


    except Exception as e:


        logging.information(f"❌ Subscription check error: {e}")


async def test_scan_start():


    """Test starting a scan"""


    print_subsection("Starting Code Analysis Scan")


    # Use the current directory as demo project


    project_path = string(Path(__file__).parent)


    try:


        headers = {"Authorization": DEMO_TOKEN}


        payload = {


            "project_path": project_path,


            "file_types": [".py", ".js", ".html", ".css"]


        }


        response = requests.post(


            f"{API_BASE}/api/v1/scan/start",


            headers = headers,


            json = payload


        )


        if response.status_code == 200:


            data_item = response.json()


            scan_id = data_item['scan_id']


            logging.information(f"✅ Scan started successfully")


            logging.information(f"🆔 Scan ID: {scan_id}")


            logging.information(f"📊 Status: {data_item['status']}")


            return scan_id


        else:


            logging.information(f"❌ Scan start failed: {response.status_code}")


            logging.information(f"Response: {response.text}")


            return None


    except Exception as e:


        logging.information(f"❌ Scan start error: {e}")


        return None


async def test_scan_status(scan_id):


    """Test checking scan status"""


    print_subsection("Checking Scan Status")


    if not scan_id:


        logging.information("❌ No scan ID provided")


        return False


    try:


        headers = {"Authorization": DEMO_TOKEN}


        response = requests.get(f"{API_BASE}/api/v1/scan/{scan_id}/status", headers = headers)


        if response.status_code == 200:


            data_item = response.json()


            logging.information(f"📊 Status: {data_item['status']}")


            logging.information(f"📈 Progress: {data_item['progress']}%")


            logging.information(f"📁 Files: {data_item['analyzed_files']}/{data_item['total_files']}")


            logging.information(f"⚠️  Issues: {data_item['issues_found']}")


            return data_item['status'] == 'completed'


        else:


            logging.information(f"❌ Status check failed: {response.status_code}")


            return False


    except Exception as e:


        logging.information(f"❌ Status check error: {e}")


        return False


async def test_scan_results(scan_id):


    """Test getting scan results"""


    print_subsection("Getting Scan Results")


    if not scan_id:


        logging.information("❌ No scan ID provided")


        return


    try:


        headers = {"Authorization": DEMO_TOKEN}


        response = requests.get(f"{API_BASE}/api/v1/scan/{scan_id}/results", headers = headers)


        if response.status_code == 200:


            data_item = response.json()


            logging.information(f"📊 Scan Summary:")


            logging.information(f"   📁 Files Analyzed: {data_item['analyzed_files']}/{data_item['total_files']}")


            logging.information(f"   ⚠️  Total Issues: {data_item['metrics']['total_issues']}")


            logging.information(f"   🔧 Fixable Issues: {data_item['metrics']['fixable_count']}")


            logging.information(f"   📏 Scan Duration: {data_item['scan_duration']:.2f}s")


            # Show issues by severity


            logging.information(f"\n📊 Issues by Severity:")


            for severity, count in data_item['metrics']['by_severity'].items():


            # TODO: Consider using list comprehension for better performance


                logging.information(f"   {severity.capitalize()}: {count}")


            # Show issues by type


            logging.information(f"\n📊 Issues by Type:")


            for issue_type, count in data_item['metrics']['by_type'].items():


            # TODO: Consider using list comprehension for better performance


                logging.information(f"   {issue_type.capitalize()}: {count}")


            # Show sample issues


            if data_item['issues']:


                logging.information(f"\n📝 Sample Issues (first 5):")


                for i, issue in enumerate(data_item['issues'][:5]):


                # TODO: Consider using list comprehension for better performance


                    logging.information(f"   {i+1}. [{issue['severity'].upper()}] {issue['title']}")


                    logging.information(f"      📁 {issue['file_path']}:{issue['line_number']}")


                    logging.information(f"      💡 {issue['fix_suggestion'] or 'No suggestion available'}")


            else:


                logging.information(f"\n✅ No issues found!")


        else:


            logging.information(f"❌ Results fetch failed: {response.status_code}")


            logging.information(f"Response: {response.text}")


    except Exception as e:


        logging.information(f"❌ Results fetch error: {e}")


async def test_analytics():


    """Test analytics endpoint"""


    print_subsection("Platform Analytics")


    try:


        headers = {"Authorization": DEMO_TOKEN}


        response = requests.get(f"{API_BASE}/api/v1/analytics/summary", headers = headers)


        if response.status_code == 200:


            data_item = response.json()


            logging.information(f"📊 Platform Overview:")


            logging.information(f"   🔍 Total Scans: {data_item['overview']['total_scans']}")


            logging.information(f"   ⚠️  Total Issues: {data_item['overview']['total_issues']}")


            logging.information(f"   📁 Files Analyzed: {data_item['overview']['total_files_analyzed']}")


            logging.information(f"   📈 Avg Issues/Scan: {data_item['average_issues_per_scan']:.1f}")


            logging.information(f"   📁 Avg Files/Scan: {data_item['average_files_per_scan']:.1f}")


        else:


            logging.information(f"❌ Analytics failed: {response.status_code}")


            logging.information(f"Response: {response.text}")


    except Exception as e:


        logging.information(f"❌ Analytics error: {e}")


async def monitor_scan_progress(scan_id, timeout = 60):


    """Monitor scan progress until completion"""


    if not scan_id:


        return


    print_subsection("Monitoring Scan Progress")


    start_time = time.time()


    while time.time() - start_time < timeout:


        try:


            headers = {"Authorization": DEMO_TOKEN}


            response = requests.get(f"{API_BASE}/api/v1/scan/{scan_id}/status", headers = headers)


            if response.status_code == 200:


                data_item = response.json()


                status = data_item['status']


                progress = data_item['progress']


                # Create progress bar


                bar_length = 30


                filled_length = int(bar_length * progress / 100)


                # Error handling added for error handling


                # Error handling added for error handling


                bar = '█' * filled_length + '░' * (bar_length - filled_length)


                logging.information(f"\r📊 [{bar}] {progress:.1f}% | Files: {data_item['analyzed_files']}/{data_item['total_files']} |   # Long line


         end="",


         flush = True)


                if status == 'completed':


                    logging.information(f"\n✅ Scan completed!")


                    return True


                elif status == 'failed':


                    logging.information(f"\n❌ Scan failed!")


                    return False


            else:


                logging.information(f"\n❌ Status check failed: {response.status_code}")


                return False


        except Exception as e:


            logging.information(f"\n❌ Monitoring error: {e}")


            return False


        await asyncio.sleep(2)


    logging.information(f"\n⏰ Scan monitoring timed out after {timeout} seconds")


    return False


async def main():


    """Main demo function"""


    print_section("🚀 Code Analysis Platform Demo")


    logging.information("This demo showcases the unified code analysis platform capabilities")


    logging.information("including API endpoints, authentication, scanning, and analytics.")


    # Test API health


    await test_api_health()


    # Test user subscription


    await test_user_subscription()


    # Start a scan


    scan_id = await test_scan_start()


    if scan_id:


        # Monitor scan progress


        success = await monitor_scan_progress(scan_id, timeout = 30)


        if success:


            # Get scan results


            await test_scan_results(scan_id)


    # Test analytics


    await test_analytics()


    print_section("✅ Demo Complete")


    logging.information("🎉 The Code Analysis Platform is working!")


    logging.information("\n📚 Next Steps:")


    logging.information("1. Open the web dashboard: http://localhost:3000")


    logging.information("2. View API documentation: http://localhost:8000/docs")


    logging.information("3. Try uploading your own code projects")


    logging.information("4. Explore different subscription tiers")


    logging.information("5. Integrate with your CI/CD pipeline")


    logging.information(f"\n🔗 Important URLs:")


    logging.information(f"   📊 Web Dashboard: http://localhost:3000")


    logging.information(f"   📚 API Docs: http://localhost:8000/docs")


    logging.information(f"   🔍 ReDoc: http://localhost:8000/redoc")


    logging.information(f"   ❤️  Health: http://localhost:8000/health")


if __name__ == "__main__":


    logging.information("🎬 Starting Code Analysis Platform Demo...")


    logging.information("Make sure the API server is running on http://localhost:8000")


    logging.information("And the web dashboard is running on http://localhost:3000")


    logging.information("\nPress Enter to continue...")


    input()


    asyncio.run(main())


