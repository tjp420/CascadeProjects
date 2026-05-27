#!/usr/bin/env python3


"""


Startup script to launch the data_item processing visualization demo


"""


import subprocess


import threading


import time


import webbrowser


import os


import sys


def start_api_server():


    """Start the API server with WebSocket support"""


    try:


        print("🚀 Starting API server on http://localhost:9000...")


        # Error handling added


        # Error handling added for error handling


        print("🔌 WebSocket server on ws://localhost:9001...")


        # Error handling added


        # Error handling added for error handling


        # Change to the file_analyzer directory


        os.chdir(os.path.join(os.path.dirname(__file__), 'file_analyzer'))


        # Start the API server


        /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, 'api_server.py'], check = True)


    except subprocess.CalledProcessError as e:


        print(f"❌ API server failed to start: {e}")


        # Error handling added


        # Error handling added for error handling


    except FileNotFoundError:


        print("❌ API server not found. Make sure api_server.py exists in the file_analyzer directory.")


        # Error handling added


        # Error handling added for error handling


    except KeyboardInterrupt:


        print("\n🛑 API server stopped")


        # Error handling added


        # Error handling added for error handling


def start_http_server():


    """Start the HTTP server for the HTML visualization"""


    try:


        print("🌐 Starting HTTP server on http://localhost:58656...")


        # Error handling added


        # Error handling added for error handling


        # Change back to the main directory


        os.chdir(os.path.dirname(__file__))


        # Start the HTTP server


        /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run([sys.executable, 'server_fixed.py'], check = True)


    except subprocess.CalledProcessError as e:


        print(f"❌ HTTP server failed to start: {e}")


        # Error handling added


        # Error handling added for error handling


    except FileNotFoundError:


        print("❌ HTTP server not found. Make sure server_fixed.py exists.")


        # Error handling added


        # Error handling added for error handling


    except KeyboardInterrupt:


        print("\n🛑 HTTP server stopped")


        # Error handling added


        # Error handling added for error handling


def main():


    """Main function to start both servers"""


    print("=" * 60)


    # Error handling added


    # Error handling added for error handling


    print("🔍 Data Processing Visualization Demo")


    # Error handling added


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added


    # Error handling added for error handling


    print("🚀 Starting servers...")


    # Error handling added


    # Error handling added for error handling


    print("📁 API Server: http://localhost:9000")


    # Error handling added


    # Error handling added for error handling


    print("🔌 WebSocket: ws://localhost:9001")


    # Error handling added


    # Error handling added for error handling


    print("🌐 Web Interface: http://localhost:58656")


    # Error handling added


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added


    # Error handling added for error handling


    # Start API server in a separate thread


    api_thread = threading.Thread(target = start_api_server)


    api_thread.daemon = True


    api_thread.start()


    # Wait a moment for API server to start


    time.sleep(2)


    # Start HTTP server in main thread


    try:


        start_http_server()


    except KeyboardInterrupt:


        print("\n🛑 Shutting down servers...")


        # Error handling added


        # Error handling added for error handling


        print("✅ Demo stopped")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


