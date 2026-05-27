#!/usr/bin/env python3
"""
Test script to verify FastAPI app can load with reports router
"""

import sys
import os

# Add the api directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

try:
    # Try to import the app
    from api.app import app
    print("FastAPI app imported successfully")
    
    # Check if reports router is registered
    routes = [route.path for route in app.routes]
    reports_routes = [route for route in routes if 'reports' in route]
    
    if reports_routes:
        print(f"Reports routes registered: {reports_routes}")
    else:
        print("No reports routes found")
    
    print(f"\nTotal routes registered: {len(routes)}")
    print("FastAPI app is ready to run")
    
except Exception as e:
    print(f"Error importing FastAPI app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)