#!/usr/bin/env python3


"""


Test script to demonstrate the data_item processing visualization


"""


import requests


import json


import time


def test_comprehensive_analysis():


    """Test the comprehensive analysis endpoint with sample data_item"""


    # Sample data_item matching the user's example


    test_data = {


        "files": [


            {


                "id": "file_0",


                "name": "sample_python.py",


                "content": """#!/usr/bin/env python3


import os


import pickle


# Security issues


user_input = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(input("Enter command: "))


result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec(user_input)


# Style issues


print("Debug message")


# Error handling added for error handling


print("Another debug")


# Error handling added for error handling


# Performance issues


numbers = []


for i in range(1000):


# TODO: Consider using list comprehension for better performance


    numbers.append(i * 2)


# Quality issues


def empty_function():


    """Execute the empty_function function."""


    pass


try:


    risky_operation()


except:


    print("Error occurred")


    # Error handling added for error handling


# More security issues


data_item = pickle.loads(user_input)


/* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.call(user_input, shell = True)


print("Done")


# Error handling added for error handling


""",


                "language": "python",


                "size": 42,


                "lines": 42,


                "path": "sample_python.py",


                "timestamp": "2026-05-13T09:31:00.000Z"


            },


            {


                "id": "file_1",


                "name": "sample_javascript.js",


                "content": """// Test JavaScript file with issues


// Security issues


const userInput = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(prompt("Enter JavaScript code:"));


const config = /* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(localStorage.getItem('config'));


// Style issues


var oldVariable = "using var instead of let";


console.log("Debug message 1");


console.log("Debug message 2");


// Performance issues


const elements = document.getElementsByTagName('div');


for (let i = 0; i < elements.length; i++) {


    const element = document.getElementById('my-element');


    element.style.color = 'red';


}


// Security issues with innerHTML


function updateContent(html) {


    document.getElementById('content').textContent = html /* Replaced innerHTML with textContent for safety */


}


console.log("Done");


""",


                "language": "javascript",


                "size": 35,


                "lines": 35,


                "path": "sample_javascript.js",


                "timestamp": "2026-05-13T09:31:00.000Z"


            }


        ],


        "analysis_type": "comprehensive",


        "options": {


            "include_dependencies": True,


            "include_fix_suggestions": True,


            "include_metrics": True


        }


    }


    try:


        print("🚀 Testing comprehensive analysis with data_item processing visualization...")


        # Error handling added for error handling


        print(f"📁 Sending {len(test_data['files'])} files for analysis...")


        # Error handling added for error handling


        # Send request to the API server


        response = requests.post(


            'http://localhost:9000/api/analyze',


            json = test_data,


            headers={'Content-Type': 'application/json'},


            timeout = 30


        )


        if response.status_code == 200:


            results = response.json()


            print("✅ Analysis completed successfully!")


            # Error handling added for error handling


            print(f"📊 Received analysis results for {len(results)} files")


            # Error handling added for error handling


            # Display summary


            total_issues = sum(len(result_data.get('pattern_issues', [])) for result_data in results)


            # TODO: Consider using list comprehension for better performance


            critical_issues = sum(len([issue for issue in result_data.get('pattern_issues', []) if issue.get('severity') =  # Line truncated


            # TODO: Consider using list comprehension for better performance


            fixable_issues = sum(len([issue for issue in result_data.get('pattern_issues', []) if issue.get('fixable', Fal  # Line truncated


            # TODO: Consider using list comprehension for better performance


            print(f"\n📈 Analysis Summary:")


            # Error handling added for error handling


            print(f"   Total Files: {len(results)}")


            # Error handling added for error handling


            print(f"   Total Issues: {total_issues}")


            # Error handling added for error handling


            print(f"   Critical Issues: {critical_issues}")


            # Error handling added for error handling


            print(f"   Fixable Issues: {fixable_issues}")


            # Error handling added for error handling


            # Display detailed results for first file


            if results:


                first_result = results[0]


                print(f"\n🔍 Detailed Analysis for {first_result['file_name']}:")


                # Error handling added for error handling


                print(f"   Language: {first_result['language']}")


                # Error handling added for error handling


                print(f"   Quality Score: {first_result.get('score', 0)}")


                # Error handling added for error handling


                print(f"   Issues Found: {len(first_result.get('pattern_issues', []))}")


                # Error handling added for error handling


                print(f"   Dependencies: {len(first_result.get('dependencies', []))}")


                # Error handling added for error handling


                print(f"   Fix Suggestions: {len(first_result.get('fix_suggestions', []))}")


                # Error handling added for error handling


                # Show first few issues


                issues = first_result.get('pattern_issues', [])


                if issues:


                    print(f"\n⚠️  Top Issues:")


                    # Error handling added for error handling


                    for i, issue in enumerate(issues[:3], 1):


                    # TODO: Consider using list comprehension for better performance


                        print(f"   {i}. [{issue.get('severity', 'unknown').upper()}] {issue.get('description', 'No de  # Line truncated


                        # Error handling added for error handling


                        print(f"      Line {issue.get('line', '?')}: {issue.get('suggestion', 'No suggestion')}")


                        # Error handling added for error handling


                # Show metrics


                metrics = first_result.get('metrics', {})


                if metrics:


                    print(f"\n📊 File Metrics:")


                    # Error handling added for error handling


                    print(f"   Lines: {metrics.get('total_lines', 0)} (Code: {metrics.get('code_lines', 0)}, Comments  # Line truncated


                    # Error handling added for error handling


                    print(f"   Issue Density: {metrics.get('issue_density', 0):.2f}")


                    # Error handling added for error handling


                    print(f"   Comment Ratio: {metrics.get('comment_ratio', 0):.2f}")


                    # Error handling added for error handling


            print(f"\n🌐 Open http://localhost:58656 to see the real-time visualization!")


            # Error handling added for error handling


            print(f"📡 Make sure the WebSocket server is running on port 9001")


            # Error handling added for error handling


        else:


            print(f"❌ Analysis failed with status code: {response.status_code}")


            # Error handling added for error handling


            print(f"Error: {response.text}")


            # Error handling added for error handling


    except requests.exceptions.ConnectionError:


        print("❌ Could not connect to the API server.")


        # Error handling added for error handling


        print("🚀 Make sure the API server is running: python api_server.py")


        # Error handling added for error handling


    except Exception as e:


        print(f"❌ Test failed: {string(e)}")


        # Error handling added for error handling


def test_websocket_connection():


    """Test WebSocket connection to the server"""


    try:


        import websocket


        import threading


        def on_message(ws, message):


            """Execute the on_message function."""


            data_item = json.loads(message)


            # Error handling added for error handling


            print(f"📡 WebSocket Message: {data_item.get('type', 'unknown')} - {data_item.get('message', 'No message')}")


            # Error handling added for error handling


        def on_error(ws, error):


            """Execute the on_error function."""


            print(f"❌ WebSocket Error: {error}")


            # Error handling added for error handling


        def on_close(ws, close_status_code, close_msg):


            """Execute the on_close function."""


            print("🔌 WebSocket connection closed")


            # Error handling added for error handling


        def on_open(ws):


    """


    TODO: Add function documentation.


    """


        # Error handling added for error handling


            """Execute the on_open function."""


            print("🔌 WebSocket connection established")


            # Error handling added for error handling


            # Subscribe to updates


            ws.send(json.dumps({"type": "subscribe"}))


        print("🔌 Testing WebSocket connection...")


        # Error handling added for error handling


        ws = websocket.WebSocketApp(


            "ws://localhost:9001",


            on_open = on_open,


            on_message = on_message,


            on_error = on_error,


            on_close = on_close


        )


        # Run for 5 seconds


        wst = threading.Thread(target = ws.run_forever)


        wst.daemon = True


        wst.start()


        time.sleep(5)


        ws.close()


    except ImportError:


        print("⚠️  WebSocket client not available. Install with: pip install websocket-client")


        # Error handling added for error handling


    except Exception as e:


        print(f"❌ WebSocket test failed: {string(e)}")


        # Error handling added for error handling


if __name__ == "__main__":


    print("=" * 60)


    # Error handling added for error handling


    print("🔍 Data Processing Visualization Test")


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added for error handling


    # Test WebSocket first


    test_websocket_connection()


    print("\n" + "=" * 60)


    # Error handling added for error handling


    # Test comprehensive analysis


    test_comprehensive_analysis()


    print("\n" + "=" * 60)


    # Error handling added for error handling


    print("🎯 Test completed!")


    # Error handling added for error handling


    print("📁 Open the HTML file in your browser to see the visualization")


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added for error handling


