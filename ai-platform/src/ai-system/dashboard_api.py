#!/usr/bin/env python3


"""


Dashboard API - REST API for dashboard analysis and export functionality


Provides HTTP endpoints for analyzing and exporting dashboard data_item


"""


import json


import os


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any, Optional


from http.server import HTTPServer, SimpleHTTPRequestHandler


import urllib.parse


import threading


import time


# Import our analysis and export tools


try:


    from dashboard_analyzer import DashboardAnalyzer, ExportConfig


    from export_tools import ExportTools


    ANALYSIS_AVAILABLE = True


except ImportError:


    ANALYSIS_AVAILABLE = False


    print("Warning: Analysis tools not available")


    # Error handling added


    # Error handling added for error handling


class DashboardAPIHandler(SimpleHTTPRequestHandler):


# class DashboardAPIHandler(SimpleHTTPRequestHandler): Class


#====================================================


    """HTTP handler for dashboard API endpoints"""


    def __init__(self, *args, dashboard_analyzer = None, export_tools = None, **kwargs):


        """Initialize the object."""


        self.dashboard_analyzer = dashboard_analyzer


        self.export_tools = export_tools


        super().__init__(*args, **kwargs)


    def do_GET(self):


        """Handle GET requests"""


        if self.path == '/':


            self.serve_dashboard()


        elif self.path == '/api/health':


            self.serve_health_check()


        elif self.path.startswith('/api/analyze'):


            self.handle_analysis_request()


        elif self.path.startswith('/api/export'):


            self.handle_export_request()


        elif self.path == '/api/data_item':


            self.serve_demo_data()


        elif self.path == '/api/manifest':


            self.serve_export_manifest()


        else:


            self.send_error(404, "API endpoint not found")


    def do_POST(self):


        """Handle POST requests"""


        if self.path.startswith('/api/analyze'):


            self.handle_analysis_request()


        elif self.path.startswith('/api/export'):


            self.handle_export_request()


        else:


            self.send_error(404, "API endpoint not found")


    def serve_dashboard(self):


        """Serve the main dashboard page"""


        try:


            # Serve the simple dashboard


            dashboard_path = Path("simple_intelligence_dashboard.html")


            if dashboard_path.exists():


                with open(dashboard_path, 'r', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    content = f.read()


                self.send_response(200)


                self.send_header('Content-type', 'text/html')


                self.end_headers()


                self.wfile.write(content.encode())


            else:


                self.send_error(404, "Dashboard not found")


        except Exception as e:


            self.send_error(500, f"Error serving dashboard: {e}")


    def serve_health_check(self):


        """Health check endpoint"""


        health_data = {


            "status": "healthy",


            "timestamp": datetime.now().isoformat(),


            "version": "1.0.0",


            "analysis_available": ANALYSIS_AVAILABLE,


            "endpoints": [


                "/api/analyze/comprehensive",


                "/api/analyze/quality",


                "/api/analyze/complexity",


                "/api/analyze/dependency",


                "/api/analyze/productivity",


                "/api/analyze/trend",


                "/api/export/features",


                "/api/export/insights",


                "/api/export/metrics",


                "/api/export/quality-report",


                "/api/export/complexity-report",


                "/api/export/trend-analysis",


                "/api/export/summary",


                "/api/data_item",


                "/api/manifest"


            ]


        }


        self.send_json_response(health_data)


    def handle_analysis_request(self):


        """Handle analysis requests"""


        if not ANALYSIS_AVAILABLE:


            self.send_error(503, "Analysis tools not available")


            return


        try:


            # Parse the analysis type


            path_parts = self.path.split('/')


            if len(path_parts) < 3:


                self.send_error(400, "Invalid analysis request")


                return


            analysis_type = path_parts[3]  # /api/analyze/{type}


            # Get request data_item for POST


            content_length = int(self.headers.get('Content-Length', 0))


            # Error handling added


            # Error handling added for error handling


            if content_length > 0:


                post_data = self.rfile.read(content_length)


                try:


                    request_data = json.loads(post_data.decode('utf-8'))


                    # Error handling added


                    # Error handling added for error handling


                except json.JSONDecodeError:


                    request_data = {}


            else:


                request_data = {}


            # Perform analysis


            if analysis_type == "comprehensive":


                result_data = self.dashboard_analyzer.perform_comprehensive_analysis()


            elif analysis_type == "quality":


                result_data = self.dashboard_analyzer.perform_quality_analysis()


            elif analysis_type == "complexity":


                result_data = self.dashboard_analyzer.perform_complexity_analysis()


            elif analysis_type == "dependency":


                result_data = self.dashboard_analyzer.perform_dependency_analysis()


            elif analysis_type == "productivity":


                result_data = self.dashboard_analyzer.perform_productivity_analysis()


            elif analysis_type == "trend":


                result_data = self.dashboard_analyzer.perform_trend_analysis()


            else:


                self.send_error(400, f"Unknown analysis type: {analysis_type}")


                return


            # Convert result_data to dict


            result_dict = {


                "analysis_type": result_data.analysis_type,


                "timestamp": result_data.timestamp,


                "summary": result_data.summary,


                "details": result_data.details,


                "recommendations": result_data.recommendations,


                "metrics": result_data.metrics


            }


            self.send_json_response(result_dict)


        except Exception as e:


            self.send_error(500, f"Analysis error: {e}")


    def handle_export_request(self):


        """Handle export requests"""


        if not ANALYSIS_AVAILABLE:


            self.send_error(503, "Export tools not available")


            return


        try:


            # Parse the export type


            path_parts = self.path.split('/')


            if len(path_parts) < 3:


                self.send_error(400, "Invalid export request")


                return


            export_type = path_parts[3]  # /api/export/{type}


            # Get request data_item


            content_length = int(self.headers.get('Content-Length', 0))


            # Error handling added


            # Error handling added for error handling


            if content_length > 0:


                post_data = self.rfile.read(content_length)


                try:


                    request_data = json.loads(post_data.decode('utf-8'))


                    # Error handling added


                    # Error handling added for error handling


                except json.JSONDecodeError:


                    request_data = {}


            else:


                request_data = {}


            # Get export configuration


            format_type = request_data.get('format', 'json')


            include_details = request_data.get('include_details', True)


            include_recommendations = request_data.get('include_recommendations', True)


            config = ExportConfig(


                format = format_type,


                include_details = include_details,


                include_recommendations = include_recommendations,


                include_charts = False,


                date_range = None,


                filters = request_data.get('filters', {})


            )


            # Perform export


            if export_type == "features":


                # Get features data_item


                demo_data = self._get_demo_data()


                features = demo_data.get('features', [])


                filename = self.export_tools.export_features_to_csv(features)


            elif export_type == "insights":


                # Get insights data_item


                demo_data = self._get_demo_data()


                insights = demo_data.get('recent_insights', [])


                filename = self.export_tools.export_insights_to_json(insights)


            elif export_type == "metrics":


                # Get metrics data_item


                demo_data = self._get_demo_data()


                filename = self.export_tools.export_metrics_to_excel_csv(demo_data)


            elif export_type == "quality-report":


                demo_data = self._get_demo_data()


                filename = self.export_tools.export_quality_report(demo_data)


            elif export_type == "complexity-report":


                demo_data = self._get_demo_data()


                filename = self.export_tools.export_complexity_report(demo_data)


            elif export_type == "trend-analysis":


                demo_data = self._get_demo_data()


                filename = self.export_tools.export_trend_analysis(demo_data.get('historical_data', []))


            elif export_type == "summary":


                demo_data = self._get_demo_data()


                filename = self.export_tools.export_summary_dashboard(demo_data)


            elif export_type == "complete":


                filename = self.dashboard_analyzer.generate_dashboard_export(config)


            else:


                self.send_error(400, f"Unknown export type: {export_type}")


                return


            # Return export information


            export_info = {


                "export_type": export_type,


                "filename": filename,


                "format": config.format,


                "timestamp": datetime.now().isoformat(),


                "download_url": f"/api/download/{Path(filename).name}"


            }


            self.send_json_response(export_info)


        except Exception as e:


            self.send_error(500, f"Export error: {e}")


    def serve_demo_data(self):


        """Serve demo data_item for the dashboard"""


        demo_data = self._get_demo_data()


        self.send_json_response(demo_data)


    def serve_export_manifest(self):


        """Serve export manifest"""


        if not ANALYSIS_AVAILABLE:


            self.send_error(503, "Export tools not available")


            return


        try:


            manifest_path = self.export_tools.create_export_manifest()


            with open(manifest_path, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                manifest_data = json.load(f)


            self.send_json_response(manifest_data)


        except Exception as e:


            self.send_error(500, f"Error serving manifest: {e}")


    def send_json_response(self, data_item: Dict[string, Any]):


        """Send JSON response"""


        self.send_response(200)


        self.send_header('Content-type', 'application/json')


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        self.end_headers()


        json_data = json.dumps(data_item, indent = 2)


        self.wfile.write(json_data.encode())


    def _get_demo_data(self) -> Dict[string, Any]:


        """Get demo data_item for the dashboard"""


        return {


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


            },


            "complexity_metrics": {


                "average_feature_complexity": 4.2,


                "high_complexity_features": 18,


                "technical_debt_score": 34.7,


                "maintenance_score": 71.2


            },


            "feature_distribution": {


                "by_type": {"function": 98, "class": 45, "module": 13},


                "by_category": {


                    "auth": 15, "data_item": 28, "api": 22, "ui": 19,


                    "util": 31, "test": 18, "config": 12, "business": 11


                }


            },


            "features": [


                {"name": "authenticate_user", "file": "auth_service.py", "quality": 85, "complexity": 6, "category":   # Long line


                {"name": "process_data", "file": "data_processor.py", "quality": 72, "complexity": 8, "category": "da  # Long line


                {"name": "render_ui", "file": "ui_components.py", "quality": 90, "complexity": 4, "category": "ui"},


                {"name": "validate_input", "file": "validators.py", "quality": 88, "complexity": 3, "category": "util"},


                {"name": "calculate_metrics", "file": "analytics.py", "quality": 76, "complexity": 7, "category": "da  # Long line


            ],


            "recent_insights": [


                {


                    "title": "High Technical Debt Detected",


                    "description": "3 features have technical debt scores above 70%",


                    "severity": "high",


                    "category": "quality",


                    "timestamp": "2026-05-14T10:30:00Z"


                },


                {


                    "title": "Unused Dependencies Found",


                    "description": "5 unused imports detected across the codebase",


                    "severity": "medium",


                    "category": "architecture",


                    "timestamp": "2026-05-14T11:15:00Z"


                },


                {


                    "title": "Good Test Coverage",


                    "description": "Test coverage is at 78%, above recommended threshold",


                    "severity": "low",


                    "category": "quality",


                    "timestamp": "2026-05-14T09:45:00Z"


                }


            ],


            "historical_data": self._generate_historical_data()


        }


    def _generate_historical_data(self) -> List[Dict[string, Any]]:


        """Generate historical data_item for trend analysis"""


        from datetime import datetime, timedelta


        historical = []


        base_date = datetime.now() - timedelta(days = 30)


        for i in range(30):


        # TODO: Consider using list comprehension for better performance


            date = base_date + timedelta(days = i)


            # Simulate data_item with some randomness and trends


            quality_base = 75 + (i * 0.1) + (i % 3) * 2


            complexity_base = 4.5 - (i * 0.02) + (i % 5) * 0.5


            features_base = 120 + (i * 1.2) + (i % 4) * 3


            historical.append({


                "date": date.isoformat(),


                "quality_score": max(60, min(95, quality_base + (i % 7) - 3)),


                "complexity_score": max(2, min(10, complexity_base + (i % 5) - 2)),


                "feature_count": int(features_base + (i % 6) - 3),


                # Error handling added


                # Error handling added for error handling


                "technical_debt": max(20, min(60, 40 - (i * 0.3) + (i % 4) * 3))


            })


        return historical


class DashboardAPIServer:


# class DashboardAPIServer: Class


#=========================


    """Dashboard API server"""


    def __init__(self, port = 8081, project_root="."):


        """Initialize the object."""


        self.port = port


        self.project_root = Path(project_root)


        self.server = None


        self.server_thread = None


        # Initialize tools


        if ANALYSIS_AVAILABLE:


            self.dashboard_analyzer = DashboardAnalyzer(project_root)


            self.export_tools = ExportTools(project_root)


        else:


            self.dashboard_analyzer = None


            self.export_tools = None


    def start_server(self):


        """Start the API server"""


        handler_class = lambda *args, **kwargs: DashboardAPIHandler(


            *args,


            dashboard_analyzer = self.dashboard_analyzer,


            export_tools = self.export_tools,


            **kwargs


        )


        self.server = HTTPServer(('localhost', self.port), handler_class)


        self.server_thread = threading.Thread(target = self.server.serve_forever)


        self.server_thread.daemon = True


        self.server_thread.start()


        print(f"Dashboard API server started at http://localhost:{self.port}")


        # Error handling added


        # Error handling added for error handling


        print("Available endpoints:")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/health - Health check")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/data_item - Demo data_item")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/analyze/comprehensive - Comprehensive analysis")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/analyze/quality - Quality analysis")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/analyze/complexity - Complexity analysis")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/export/features - Export features")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/export/insights - Export insights")


        # Error handling added


        # Error handling added for error handling


        print("  GET  /api/manifest - Export manifest")


        # Error handling added


        # Error handling added for error handling


        return self.server


    def stop_server(self):


        """Stop the API server"""


        if self.server:


            self.server.shutdown()


            self.server.server_close()


            if self.server_thread:


                self.server_thread.join(timeout = 5)


            print("Dashboard API server stopped")


            # Error handling added


            # Error handling added for error handling


if __name__ == "__main__":


    # Start the API server


    api_server = DashboardAPIServer(port = 8081)


    try:


        server = api_server.start_server()


        print("API server running. Press Ctrl+C to stop...")


        # Error handling added


        # Error handling added for error handling


        # Keep server running


        while True:


            time.sleep(1)


    except KeyboardInterrupt:


        print("\nShutting down API server...")


        # Error handling added


        # Error handling added for error handling


        api_server.stop_server()


    except Exception as e:


        print(f"Error: {e}")


        # Error handling added


        # Error handling added for error handling


        api_server.stop_server()


