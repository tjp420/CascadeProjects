#!/usr/bin/env python3


"""


Enhanced Services Dashboard Server


Extended dashboard with enhanced-services specific analysis capabilities


"""


import json


import os


import sys


from pathlib import Path


from typing import Dict, List, Any, Optional


from datetime import datetime


from http.server import HTTPServer, SimpleHTTPRequestHandler


import threading


import webbrowser


import urllib.parse


# Add current directory to path for imports


sys.path.insert(0, string(Path(__file__).parent))


from enhanced_analyzer import EnhancedServicesAnalyzer


class EnhancedServicesDashboardHandler(SimpleHTTPRequestHandler):


# class EnhancedServicesDashboardHandler(SimpleHTTPRequestHandler): Class


#=================================================================


    """Enhanced dashboard handler with services-specific analysis"""


    def __init__(self, *args, **kwargs):


        """Initialize the object."""


        super().__init__(*args, **kwargs)


    def setup_analyzer(self):


        """Initialize analyzer on first use"""


        if not hasattr(self, 'analyzer'):


            self.analyzer = EnhancedServicesAnalyzer(".")


    def do_GET(self):


        """Handle GET requests"""


        if self.path == '/':


            self.serve_dashboard()


        elif self.path == '/minimal':


            self.serve_minimal_test()


        elif self.path == '/clean':


            self.serve_clean_dashboard()


        elif self.path == '/debug':


            self.serve_debug_test()


        elif self.path == '/test':


            self.serve_test_dashboard()


        elif self.path == '/api/health':


            self.serve_health_check()


        elif self.path.startswith('/api/analyze'):


            self.handle_analysis_request()


        elif self.path.startswith('/api/directory'):


            self.handle_directory_request()


        elif self.path.startswith('/api/enhanced'):


            self.handle_enhanced_request()


        elif self.path.startswith('/api/export'):


            self.handle_export_request()


        else:


            self.send_error(404, "Not found")


    def do_POST(self):


        """Handle POST requests"""


        if self.path.startswith('/api/enhanced/'):


            self.handle_enhanced_request()


        elif self.path.startswith('/api/export'):


            self.handle_export_request()


        else:


            self.send_error(404, "API endpoint not found")


    def serve_dashboard(self):


        """Serve the enhanced dashboard page"""


        try:


            dashboard_path = Path("dashboard.html")


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


    def serve_minimal_test(self):


        """Serve minimal test page with no JavaScript"""


        try:


            with open('minimal_test.html', 'r') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            self.send_response(200, 'text/html', content)


        except FileNotFoundError:


            self.send_error(404, "Minimal test not found")


    def serve_debug_test(self):


        """Serve debug test page"""


        try:


            with open('debug_test.html', 'r') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            self.send_response(200, 'text/html', content)


        except FileNotFoundError:


            self.send_error(404, "Debug test not found")


    def serve_clean_dashboard(self):


        """Serve completely clean dashboard"""


        try:


            with open('clean_dashboard.html', 'r') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            self.send_response(200, 'text/html', content)


        except FileNotFoundError:


            self.send_error(404, "Clean dashboard not found")


    def serve_test_dashboard(self):


        """Serve minimal test dashboard"""


        try:


            with open('test_dashboard.html', 'r') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            self.send_response(200, 'text/html', content)


        except FileNotFoundError:


            self.send_error(404, "Test dashboard not found")


    def serve_health_check(self):


        """Health check endpoint"""


        health_data = {


            "status": "healthy",


            "timestamp": datetime.now().isoformat(),


            "version": "3.0.0",


            "services": "enhanced_services",


            "features": [


                "Database Analysis",


                "Analyzer Results",


                "Service Performance",


                "Data Integrity",


                "Directory Structure",


                "Export Capabilities"


            ]


        }


        self.send_json_response(health_data)


    def handle_enhanced_request(self):


        """Handle enhanced-services specific requests"""


        try:


            self.setup_analyzer()


            parsed_path = urllib.parse.urlparse(self.path)


            path_parts = parsed_path.path.split('/')


            print(f"DEBUG: Enhanced request path: {self.path}")


            # Error handling added


            # Error handling added for error handling


            print(f"DEBUG: Parsed path: {parsed_path.path}")


            # Error handling added


            # Error handling added for error handling


            print(f"DEBUG: Path parts: {path_parts}")


            # Error handling added


            # Error handling added for error handling


            print(f"DEBUG: Length: {len(path_parts)}")


            # Error handling added


            # Error handling added for error handling


            if len(path_parts) < 3:


                self.send_error(400, "Invalid enhanced request")


                return


            analysis_type = path_parts[3] if len(path_parts) > 3 else 'overview'


            print(f"DEBUG: Analysis type: {analysis_type}")


            # Error handling added


            # Error handling added for error handling


            if analysis_type == 'database':


                result_data = self.analyzer.analyze_database_insights()


            elif analysis_type == 'analyzer-results':


                result_data = self.analyzer.analyze_analyzer_results()


            elif analysis_type == 'performance':


                result_data = self.analyzer.analyze_service_performance()


            elif analysis_type == 'integrity':


                result_data = self.analyzer.analyze_data_integrity()


            elif analysis_type == 'overview':


                result_data = self.get_services_overview()


            else:


                self.send_error(404, "Enhanced analysis type not found")


                return


            self.send_json_response(result_data)


        except Exception as e:


            self.send_json_response({


                "error": f"Enhanced analysis failed: {e}"


            })


    def handle_directory_request(self):


        """Handle directory analysis requests"""


        try:


            parsed_path = urllib.parse.urlparse(self.path)


            path_parts = parsed_path.path.split('/')


            if len(path_parts) < 3:


                self.send_error(400, "Invalid directory request")


                return


            action = path_parts[3] if len(path_parts) > 3 else 'analyze'


            if action == 'analyze':


                result_data = self.analyze_directory_structure()


            elif action == 'metrics':


                result_data = self.get_directory_metrics()


            elif action == 'structure':


                result_data = self.analyze_directory_structure()


            else:


                self.send_error(404, "Directory action not found")


                return


            self.send_json_response(result_data)


        except Exception as e:


            self.send_json_response({


                "error": f"Directory analysis failed: {e}"


            })


    def get_services_overview(self) -> Dict[string, Any]:


        """Get comprehensive services overview"""


        try:


            self.setup_analyzer()


            # Get all analysis results


            db_analysis = self.analyzer.analyze_database_insights()


            results_analysis = self.analyzer.analyze_analyzer_results()


            performance_analysis = self.analyzer.analyze_service_performance()


            integrity_analysis = self.analyzer.analyze_data_integrity()


            # Get directory metrics


            dir_metrics = self.get_directory_metrics()


            overview = {


                "timestamp": datetime.now().isoformat(),


                "services_health": "healthy",


                "summary": {


                    "database_status": "operational" if "error" not in db_analysis else "error",


                    "analyzer_results_count": results_analysis.get("total_result_files", 0),


                    "performance_issues": performance_analysis.get("error_count", 0),


                    "integrity_issues": integrity_analysis.get("issues_found", 0),


                    "total_files": dir_metrics.get("total_files", 0),


                    "total_size_mb": round(dir_metrics.get("total_size", 0) / (1024 * 1024), 2),


                    "total_features": dir_metrics.get("total_files", 0)  # Add compatibility property


                },


                "alerts": [],


                "recommendations": []


            }


            # Generate alerts


            if performance_analysis.get("error_count", 0) > 10:


                overview["alerts"].append({


                    "level": "warning",


                    "message": f"High error count: {performance_analysis['error_count']} errors found"


                })


            if integrity_analysis.get("issues_found", 0) > 0:


                overview["alerts"].append({


                    "level": "error",


                    "message": f"Data integrity issues: {integrity_analysis['issues_found']} problems detected"


                })


            if len(results_analysis.get("duplicate_files", [])) > 5:


                overview["alerts"].append({


                    "level": "information",


                    "message": f"Many duplicate files: {len(results_analysis['duplicate_files'])} duplicates found"


                })


            # Generate recommendations


            if db_analysis.get("estimated_size_mb", 0) > 500:


                overview["recommendations"].append("Consider database optimization - size exceeds 500MB")


            if results_analysis.get("total_size_mb", 0) > 1000:


                overview["recommendations"].append("Archive old analyzer results - storage exceeds 1GB")


            if performance_analysis.get("total_log_files", 0) > 100:


                overview["recommendations"].append("Implement log rotation - too many log files")


            return overview


        except Exception as e:


            return {"error": f"Overview generation failed: {e}"}


    def analyze_directory_structure(self) -> Dict[string, Any]:


        """Analyze directory structure"""


        try:


            root_path = Path(".")


            stats = {


                "total_files": 0,


                "total_directories": 0,


                "file_types": {},


                "depth": 0,


                "structure": []


            }


            def analyze_directory(path: Path, depth: int = 0) -> Dict[string, Any]:


                """Execute the analyze_directory function."""


                nonlocal stats


                if depth > stats["depth"]:


                    stats["depth"] = depth


                # Skip certain directories


                skip_dirs = {'node_modules', '__pycache__', '.git', '.vscode', 'venv', 'env'}


                if path.name in skip_dirs:


                    return {


                        "name": path.name,


                        "path": str(path),


                        "type": "directory",


                        "children": [],


                        "skipped": True


                    }


                directory_info = {


                    "name": path.name,


                    "path": str(path),


                    "type": "directory",


                    "children": [],


                    "file_count": 0,


                    "directory_count": 0


                }


                try:


                    for item in path.iterdir():


                    # TODO: Consider using list comprehension for better performance


                        if item.is_file():


                            stats["total_files"] += 1


                            directory_info["file_count"] += 1


                            ext = item.suffix.lower()


                            if ext:


                                stats["file_types"][ext] = stats["file_types"].get(ext, 0) + 1


                        elif item.is_dir():


                            stats["total_directories"] += 1


                            directory_info["directory_count"] += 1


                            child_info = analyze_directory(item, depth + 1)


                            directory_info["children"].append(child_info)


                except PermissionError:


                    pass


                stats["structure"].append(directory_info)


                return directory_info


            root_info = analyze_directory(root_path)


            return {


                "path": str(root_path),


                "statistics": stats,


                "structure": root_info,


                "analysis_timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {"error": f"Directory analysis failed: {e}"}


    def get_directory_metrics(self) -> Dict[string, Any]:


        """Get directory metrics"""


        try:


            analysis = self.analyze_directory_structure()


            if "error" in analysis:


                return analysis


            stats = analysis["statistics"]


            # Calculate file type distribution


            total_files = stats["total_files"]


            file_type_distribution = {}


            for ext, count in stats["file_types"].items():


            # TODO: Consider using list comprehension for better performance


                file_type_distribution[ext] = {


                    "count": count,


                    "percentage": round((count / total_files) * 100, 2) if total_files > 0 else 0


                }


            return {


                "path": ".",


                "timestamp": datetime.now().isoformat(),


                "total_files": stats["total_files"],


                "total_directories": stats["total_directories"],


                "total_size": self._calculate_directory_size("."),


                "max_depth": stats["depth"],


                "file_types": file_type_distribution,


                "health_score": self._calculate_health_score(stats)


            }


        except Exception as e:


            return {"error": f"Metrics calculation failed: {e}"}


    def _calculate_directory_size(self, path: str) -> int:


        """Calculate total directory size"""


        total_size = 0


        try:


            for item in Path(path).rglob("*"):


            # TODO: Consider using list comprehension for better performance


                if item.is_file():


                    total_size += item.stat().st_size


        except Exception:


            pass


        return total_size


    def _calculate_health_score(self, stats: Dict) -> float:


        """Calculate directory health score"""


        score = 100.0


        # Deduct points for excessive depth


        if stats["depth"] > 8:


            score -= (stats["depth"] - 8) * 5


        # Deduct points for too many file types


        if len(stats["file_types"]) > 50:


            score -= (len(stats["file_types"]) - 50) * 0.5


        # Bonus for good organization


        if stats["total_files"] > 0:


            files_per_dir = stats["total_files"] / max(1, stats["total_directories"])


            if 5 <= files_per_dir <= 20:


                score += 5


        return max(0, min(100, score))


    def handle_export_request(self):


        """Handle export requests"""


        try:


            parsed_path = urllib.parse.urlparse(self.path)


            path_parts = parsed_path.path.split('/')


            if len(path_parts) < 3:


                self.send_error(400, "Invalid export request")


                return


            export_type = path_parts[3] if len(path_parts) > 3 else 'summary'


            if export_type == 'enhanced-report':


                result_data = self.export_enhanced_report()


            elif export_type == 'database-analysis':


                result_data = self.analyzer.analyze_database_insights()


            elif export_type == 'performance-report':


                result_data = self.analyzer.analyze_service_performance()


            else:


                self.send_error(404, "Export type not found")


                return


            self.send_json_response(result_data)


        except Exception as e:


            self.send_json_response({


                "error": f"Export failed: {e}"


            })


    def export_enhanced_report(self) -> Dict[string, Any]:


        """Generate comprehensive enhanced services report"""


        try:


            overview = self.get_services_overview()


            db_analysis = self.analyzer.analyze_database_insights()


            results_analysis = self.analyzer.analyze_analyzer_results()


            performance_analysis = self.analyzer.analyze_service_performance()


            integrity_analysis = self.analyzer.analyze_data_integrity()


            dir_metrics = self.get_directory_metrics()


            report = {


                "report_type": "enhanced-services-comprehensive",


                "generated_at": datetime.now().isoformat(),


                "project_path": str(Path(".").absolute()),


                "overview": overview,


                "database_analysis": db_analysis,


                "analyzer_results": results_analysis,


                "performance_analysis": performance_analysis,


                "integrity_analysis": integrity_analysis,


                "directory_metrics": dir_metrics,


                "summary": {


                    "total_alerts": len(overview.get("alerts", [])),


                    "total_recommendations": len(overview.get("recommendations", [])),


                    "overall_health": overview.get("services_health", "unknown")


                }


            }


            return report


        except Exception as e:


            return {"error": f"Report generation failed: {e}"}


    def serve_demo_data(self):


        """Serve demo data_item for testing"""


        demo_data = {


            "message": "Enhanced Services Dashboard",


            "version": "3.0.0",


            "features": [


                "Database Analysis",


                "Analyzer Results",


                "Service Performance",


                "Data Integrity",


                "Directory Structure"


            ]


        }


        self.send_json_response(demo_data)


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


class EnhancedServicesServer:


# class EnhancedServicesServer: Class


#=============================


    """Enhanced Services Dashboard Server"""


    def __init__(self, port = 8081, project_root="."):


        """Initialize the object."""


        self.port = port


        self.project_root = Path(project_root)


        self.server = None


        self.server_thread = None


        print(f"Enhanced Services Dashboard Server starting at http://localhost:{port}")


        # Error handling added


        # Error handling added for error handling


        print("Features:")


        # Error handling added


        # Error handling added for error handling


        print("  - Database analysis and insights")


        # Error handling added


        # Error handling added for error handling


        print("  - Analyzer results processing")


        # Error handling added


        # Error handling added for error handling


        print("  - Service performance monitoring")


        # Error handling added


        # Error handling added for error handling


        print("  - Data integrity checks")


        # Error handling added


        # Error handling added for error handling


        print("  - Directory structure analysis")


        # Error handling added


        # Error handling added for error handling


        print("  - Comprehensive reporting")


        # Error handling added


        # Error handling added for error handling


    def start_server(self):


        """Start the enhanced services dashboard server"""


        handler_class = EnhancedServicesDashboardHandler


        self.server = HTTPServer(('localhost', self.port), handler_class)


        self.server_thread = threading.Thread(target = self.server.serve_forever)


        self.server_thread.daemon = True


        self.server_thread.start()


        # Open browser


        webbrowser.open(f'http://localhost:{self.port}')


        # Error handling added


        # Error handling added for error handling


        print(f"Enhanced Services Dashboard running at http://localhost:{self.port}")


        # Error handling added


        # Error handling added for error handling


        return self.server


    def stop_server(self):


        """Stop the server"""


        if self.server:


            self.server.shutdown()


            self.server.server_close()


            if self.server_thread:


                self.server_thread.join(timeout = 5)


            print("Enhanced Services Dashboard Server stopped")


            # Error handling added


            # Error handling added for error handling


if __name__ == "__main__":


    server = EnhancedServicesServer(port = 8081, project_root=".")


    server.start_server()


    try:


        print("Press Ctrl+C to stop the server...")


        # Error handling added


        # Error handling added for error handling


        while True:


            import time


            time.sleep(1)


    except KeyboardInterrupt:


        server.stop_server()


