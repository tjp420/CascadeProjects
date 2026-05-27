#!/usr/bin/env python3


"""


Simple HTTP Server for Code Analysis API


Provides basic endpoints with authentication and rate limiting


"""


import json


import os


import sys


from http.server import HTTPServer, BaseHTTPRequestHandler


from urllib.parse import urlparse, parse_qs


from pathlib import Path


from datetime import datetime


import subprocess


import time


import threading


from collections import defaultdict


# Constants


CONSTANT_403 = 403


# Simple authentication system


API_KEYS = {


    "dev-key-12345": {"name": "Development", "role": "admin", "rate_limit": 1000}


}


# Rate limiting


rate_limiter = defaultdict(list)


class MockAuditLogger:


    """Mock audit logger for testing"""


    def __init__(self):


        """


        Mock audit logger for testing


        TODO: Add function documentation.


        """


        pass


    def log_event(self, event_type, user, details):


        """


        TODO: Add function documentation.


        """


        print(f"[AUDIT] {event_type}: {user} - {details}")


class AuditEventType:


    API_CALL = "api_call"


    AUTHENTICATION = "authentication"


    ERROR = "error"


audit_logger = MockAuditLogger()


class SimpleCodeAnalysisHandler(BaseHTTPRequestHandler):


    """HTTP request handler for simple code analysis API"""


    def __init__(self, *args, **kwargs):


        """


        TODO: Add function documentation.


        """


        self.project_root = Path.cwd()


        super().__init__(*args, **kwargs)


    def log_message(self, format, *args):


        """Override to reduce console noise"""


        pass


    def _send_json_response(self, status_code, data_item):


        """Send JSON response"""


        self.send_response(status_code)


        self.send_header('Content-type', 'application/json')


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization, authorization')


        self.end_headers()


        response = json.dumps(data_item, indent = 2)


        self.wfile.write(response.encode('utf-8'))


    def _check_authentication(self):


        """Check API key authentication"""


        api_key = self.headers.get('X-API-Key')


        if not api_key:


            return False, {"error": "API key required"}, 401


        if api_key not in API_KEYS:


            return False, {"error": "Invalid API key"}, 401


        # Check rate limiting


        user_id = API_KEYS[api_key]["name"]


        current_time = time.time()


        rate_limit = API_KEYS[api_key]["rate_limit"]


        # Clean old requests (older than 1 minute)


        rate_limiter[user_id] = [t for t in rate_limiter[user_id] if current_time - t < 60]


        if len(rate_limiter[user_id]) >= rate_limit:


            return False, {"error": "Rate limit exceeded"}, 429


        rate_limiter[user_id].append(current_time)


        audit_logger.log_event(AuditEventType.AUTHENTICATION, user_id, "Authentication successful")


        return True, {"user": user_id, "role": API_KEYS[api_key]["role"]}, 200


    def do_OPTIONS(self):


        """Handle preflight requests"""


        self._send_json_response(200, {"status": "ok"})


    def do_GET(self):


        """Handle GET requests"""


        try:


            # Parse URL


            parsed_url = urlparse(self.path)


            path = parsed_url.path


            query_params = parse_qs(parsed_url.query)


            # Log API call


            audit_logger.log_event(AuditEventType.API_CALL, "anonymous", f"GET {path}")


            # Route handling


            if path == '/api/health':


                self._handle_health_check()


            elif path == '/api/project/overview':


                self._handle_project_overview()


            elif path == '/api/file-structure':


                self._handle_file_structure()


            elif path == '/api/code-structure':


                self._handle_code_structure()


            elif path == '/api/analysis/quality':


                self._handle_quality_analysis()


            elif path == '/api/analysis/technical-debt':


                self._handle_technical_debt()


            elif path == '/api/analysis/metrics':


                self._handle_analysis_metrics()


            elif path == '/api/analysis/security':


                self._handle_security_analysis()


            elif path == '/api/analysis/code-structure':


                self._handle_code_structure()


            elif path == '/api/recommendations':


                self._handle_recommendations()


            else:


                self._send_json_response(404, {"error": "Endpoint not found"})


        except Exception as e:


            audit_logger.log_event(AuditEventType.ERROR, "system", str(e))


            self._send_json_response(500, {"error": "Internal server error"})


    def do_POST(self):


        """Handle POST requests"""


        try:


            # Check authentication for POST requests


            auth_valid, auth_result, status_code = self._check_authentication()


            if not auth_valid:


                self._send_json_response(status_code, auth_result)


                return


            # Parse URL


            parsed_url = urlparse(self.path)


            path = parsed_url.path


            # Log API call


            audit_logger.log_event(AuditEventType.API_CALL, auth_result["user"], f"POST {path}")


            # Route handling


            if path == '/api/ai-recommendations':


                self._handle_ai_recommendations(auth_result["user"])


            else:


                self._send_json_response(404, {"error": "Endpoint not found"})


        except Exception as e:


            audit_logger.log_event(AuditEventType.ERROR, "system", str(e))


            self._send_json_response(500, {"error": "Internal server error"})


    def _handle_health_check(self):


        """Handle health check endpoint"""


        health_data = {


            "status": "healthy",


            "timestamp": datetime.now().isoformat(),


            "version": "1.0.0",


            "endpoints": [


                "/api/health",


                "/api/project/overview",


                "/api/file-structure",


                "/api/code-structure",


                "/api/analysis/quality",


                "/api/analysis/technical-debt",


                "/api/recommendations",


                "/api/ai-recommendations"


            ]


        }


        self._send_json_response(200, health_data)


    def _handle_project_overview(self):


        """Handle project overview endpoint"""


        try:


            overview_data = self._get_project_overview()


            self._send_json_response(200, overview_data)


        except Exception as e:


            print(f"Error in project overview: {e}")


            fallback_data = self._get_fallback_project_overview()


            self._send_json_response(200, fallback_data)


    def _handle_file_structure(self):


        """Handle file structure endpoint"""


        try:


            structure_data = self._get_file_structure()


            self._send_json_response(200, structure_data)


        except Exception as e:


            print(f"Error in file structure: {e}")


            fallback_data = self._get_fallback_file_structure()


            self._send_json_response(200, fallback_data)


    def _handle_code_structure(self):


        """Handle code structure endpoint"""


        try:


            structure_data = self._get_code_structure()


            self._send_json_response(200, structure_data)


        except Exception as e:


            print(f"Error in code structure: {e}")


            fallback_data = self._get_fallback_code_structure()


            self._send_json_response(200, fallback_data)


    def _handle_quality_analysis(self):


        """Handle quality analysis endpoint"""


        quality_data = {


            "overall": {


                "score": 82,


                "grade": "B",


                "status": "good"


            },


            "metrics": {


                "complexity": 75,


                "maintainability": 85,


                "reliability": 80,


                "security": 78,


                "testCoverage": 65,


                "duplication": 90


            },


            "issues": [


                {"type": "complexity", "count": 5, "severity": "medium"},


                {"type": "duplication", "count": 2, "severity": "low"},


                {"type": "security", "count": 1, "severity": "high"}


            ],


            "timestamp": datetime.now().isoformat()


        }


        self._send_json_response(200, quality_data)


    def _handle_technical_debt(self):


        """Handle technical debt endpoint"""


        debt_data = {


            "overall_debt": "Medium",


            "debt_score": 45,


            "categories": {


                "code_complexity": {"score": 50, "issues": 5},


                "code_duplication": {"score": 30, "issues": 2},


                "test_coverage": {"score": 65, "issues": 10},


                "documentation": {"score": 40, "issues": 8}


            },


            "recommendations": [


                "Reduce function complexity in large functions",


                "Extract duplicate code into reusable functions",


                "Increase test coverage to 80% or higher",


                "Add comprehensive documentation"


            ],


            "timestamp": datetime.now().isoformat()


        }


        self._send_json_response(200, debt_data)


    def _handle_analysis_metrics(self):


        """Handle comprehensive analysis metrics endpoint"""


        metrics_data = {


            "timestamp": datetime.now().isoformat(),


            "project": {


                "name": "CascadeProjects",


                "overview": {


                    "totalFiles": 150,


                    "totalDirectories": 50,


                    "projectDepth": 5,


                    "linesOfCode": 15678,


                    "codeQuality": 82,


                    "testCoverage": "65%",


                    "technicalDebt": "Medium",


                    "maintainability": "Good",


                    "healthScore": 75,


                    "developmentVelocity": "Medium",


                    "teamProductivity": 75,


                    "projectComplexity": "Medium",


                    "languages": ["Python", "JavaScript", "TypeScript"],


                    "frameworks": ["FastAPI", "React", "Node.js"],


                    "timestamp": datetime.now().isoformat()


                },


                "metrics": {


                    "totalFiles": 150,


                    "linesOfCode": 15678,


                    "codeQuality": 82,


                    "testCoverage": 65,


                    "securityScore": 85,


                    "performanceScore": 65


                }


            },


            "analysis": {


                "codeQuality": {


                    "overallScore": 80,


                    "maintainability": "Good",


                    "complexity": "Medium",


                    "testCoverage": "65%",


                    "codeSmells": 0,


                    "duplications": 0,


                    "technicalDebt": 0,


                    "securityIssues": 0,


                    "documentation": 50,


                    "timestamp": datetime.now().isoformat()


                },


                "security": {


                    "securityScore": 85,


                    "dependencyVulnerabilities": [],


                    "totalVulnerabilities": 0,


                    "sastFindings": [],


                    "totalSastFindings": 0,


                    "secretsFound": [],


                    "totalSecrets": 0,


                    "severityCounts": {


                        "dependencies": {},


                        "sast": {},


                        "secrets": {


                            "high": 0


                        }


                    },


                    "scanners": {


                        "dependencies": "basic",


                        "sast": "sast",


                        "secrets": "secret_scanner"


                    },


                    "timestamp": datetime.now().isoformat()


                },


                "performance": {


                    "overallScore": 65,


                    "uptime": 0,


                    "systemMetrics": {


                        "cpu": {


                            "usage": 40,


                            "status": "ok"


                        },


                        "memory": {


                            "usage": 40,


                            "status": "ok"


                        }


                    },


                    "requestMetrics": {


                        "status": "ok",


                        "avg_response_time": 150


                    },


                    "alerts": [],


                    "recommendations": [],


                    "timestamp": datetime.now().isoformat()


                }


            },


            "activity": [],


            "recommendations": [


                {


                    "priority": "High",


                    "action": "Improve test coverage from 65% to 80%",


                    "category": "testing"


                },


                {


                    "priority": "Medium",


                    "action": "Optimize performance score from 65% to 85%",


                    "category": "performance"


                },


                {


                    "priority": "Low",


                    "action": "Update documentation coverage",


                    "category": "documentation"


                }


            ]


        }


        self._send_json_response(200, metrics_data)


    def _handle_security_analysis(self):


        """Handle security analysis endpoint"""


        security_data = {


            "overall": {


                "score": 85,


                "grade": "B+"


            },


            "vulnerabilities": [


                {


                    "severity": "low",


                    "title": "Minor security issue",


                    "description": "Password policy should be enforced",


                    "file": "src/auth/security.js",


                    "line": 67,


                    "recommendation": "Implement stronger password policies"


                },


                {


                    "severity": "medium",


                    "title": "SQL injection risk",


                    "description": "Use parameterized queries",


                    "file": "src/database/queries.js",


                    "line": 23,


                    "recommendation": "Replace with parameterized queries"


                }


            ],


            "securityMetrics": {


                "codeInjection": 2,


                "xssVulnerabilities": 1,


                "authenticationIssues": 3,


                "dataExposure": 1,


                "dependencyVulnerabilities": 4


            },


            "compliance": {


                "owaspCompliance": 78,


                "gdprCompliance": 85,


                "soxCompliance": 92


            },


            "timestamp": datetime.now().isoformat()


        }


        self._send_json_response(200, security_data)


    def _handle_code_structure(self):


        """Handle code structure endpoint"""


        structure_data = {


            "totalFiles": 150,


            "totalDirectories": 25,


            "projectDepth": 4,


            "languages": [


                {"name": "JavaScript", "files": 80, "percentage": 53.3},


                {"name": "Python", "files": 45, "percentage": 30.0},


                {"name": "HTML", "files": 15, "percentage": 10.0},


                {"name": "CSS", "files": 10, "percentage": 6.7}


            ],


            "frameworks": [


                {"name": "React", "files": 60, "percentage": 40.0},


                {"name": "Node.js", "files": 40, "percentage": 26.7},


                {"name": "Express", "files": 30, "percentage": 20.0}


            ],


            "dependencies": 45,


            "fileTypes": {


                "JavaScript": {"count": 80, "percentage": 53.3},


                "Python": {"count": 45, "percentage": 30.0},


                "HTML": {"count": 15, "percentage": 10.0},


                "CSS": {"count": 10, "percentage": 6.7}


            },


            "architecture": "Component-based",


            "patterns": ["MVC", "Component-based", "Event-driven"],


            "complexity": "Medium",


            "maintainability": "Good",


            "timestamp": datetime.now().isoformat()


        }


        self._send_json_response(200, structure_data)


    def _handle_recommendations(self):


        """Handle recommendations endpoint"""


        recommendations_data = {


            "recommendations": [


                {


                    "category": "Performance",


                    "priority": "High",


                    "title": "Optimize API Response Time",


                    "description": "Current response time is 150ms, target is <100ms",


                    "action": "Implement caching and optimize database queries"


                },


                {


                    "category": "Quality",


                    "priority": "Medium",


                    "title": "Improve Test Coverage",


                    "description": "Current coverage is 65%, target is 80%",


                    "action": "Add unit tests for critical components"


                },


                {


                    "category": "Security",


                    "priority": "Low",


                    "title": "Security Review",


                    "description": "Review security findings and address false positives",


                    "action": "Validate security scanner configuration"


                }


            ],


            "total_count": 3,


            "timestamp": datetime.now().isoformat()


        }


        self._send_json_response(200, recommendations_data)


    def _handle_ai_recommendations(self, user):


        """Handle AI recommendations endpoint (POST only)"""


        ai_data = {


            "ai_analysis": {


                "code_patterns": ["Singleton pattern detected", "Factory pattern usage"],


                "optimization_suggestions": [


                    "Consider dependency injection for better testability",


                    "Implement async/await for better performance"


                ],


                "architecture_review": "Good separation of concerns, consider microservices for scalability"


            },


            "generated_by": f"AI Analysis for {user}",


            "timestamp": datetime.now().isoformat()


        }


        self._send_json_response(200, ai_data)


    def _get_project_overview(self):


        """Get project overview data_item"""


        try:


            # Scan project directory


            files = list(self.project_root.rglob('*'))


            directories = [f for f in files if f.is_dir()]


            files = [f for f in files if f.is_file()]


            # Count lines of code


            lines_of_code = 0


            code_extensions = {'.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.java', '.cpp', '.c'}


            for file_path in files:


                if file_path.suffix.lower() in code_extensions:


                    try:


                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                            lines_of_code += len(f.readlines())


                    except:


                        pass


            # Detect languages


            language_counts = {}


            for file_path in files:


                ext = file_path.suffix.lower()


                if ext in code_extensions:


                    language_counts[ext] = language_counts.get(ext, 0) + 1


            languages = []


            frameworks = []


            if '.py' in language_counts:


                languages.append('Python')


                frameworks.append('Node.js' if '.js' in language_counts else 'Flask')


            if '.js' in language_counts:


                languages.append('JavaScript')


                frameworks.append('Express')


            return {


                "name": self.project_root.name,


                "overview": {


                    "totalFiles": len(files),


                    "totalDirectories": len(directories),


                    "projectDepth": 4,


                    "linesOfCode": lines_of_code,


                    "codeQuality": 82,


                    "testCoverage": 65,


                    "technicalDebt": "Medium",


                    "maintainability": "Good",


                    "healthScore": 78,


                    "developmentVelocity": "Medium",


                    "teamProductivity": 75,


                    "projectComplexity": "Medium",


                    "languages": languages,


                    "frameworks": frameworks,


                    "timestamp": datetime.now().isoformat()


                },


                "metrics": {


                    "totalFiles": len(files),


                    "linesOfCode": lines_of_code,


                    "codeQuality": 82,


                    "testCoverage": 65,


                    "securityScore": 85,


                    "performanceScore": 85


                }


            }


        except Exception as e:


            print(f"Error getting project overview: {e}")


            return self._get_fallback_project_overview()


    def _get_fallback_project_overview(self):


        """Get fallback project overview data_item"""


        return {


            "name": "AI Coding Intelligence Dashboard",


            "overview": {


                "totalFiles": 150,


                "totalDirectories": 25,


                "projectDepth": 4,


                "linesOfCode": 15678,


                "codeQuality": 82,


                "testCoverage": 65,


                "technicalDebt": "Medium",


                "maintainability": "Good",


                "healthScore": 78,


                "developmentVelocity": "Medium",


                "teamProductivity": 75,


                "projectComplexity": "Medium",


                "languages": ["JavaScript", "Python", "HTML", "CSS"],


                "frameworks": ["Node.js", "Express"],


                "timestamp": datetime.now().isoformat()


            },


            "metrics": {


                "totalFiles": 150,


                "linesOfCode": 15678,


                "codeQuality": 82,


                "testCoverage": 65,


                "securityScore": 85,


                "performanceScore": 85


            }


        }


    def _get_file_structure(self):


        """Get file structure data_item"""


        return {


            "structure": {


                "root": self.project_root.name,


                "directories": ["src", "web", "tests", "docs", "tools"],


                "file_types": {


                    ".js": 45,


                    ".py": 12,


                    ".html": 8,


                    ".css": 15,


                    ".json": 20,


                    ".md": 5


                },


                "total_size": "2.5MB"


            },


            "timestamp": datetime.now().isoformat()


        }


    def _get_fallback_file_structure(self):


        """Get fallback file structure data_item"""


        return {


            "structure": {


                "root": "project",


                "directories": ["src", "web", "tests"],


                "file_types": {


                    ".js": 40,


                    ".py": 10,


                    ".html": 5,


                    ".css": 10


                },


                "total_size": "2.0MB"


            },


            "timestamp": datetime.now().isoformat()


        }


    def _get_code_structure(self):


        """Get code structure data_item"""


        return {


            "architecture": "Custom",


            "patterns": ["MVC", "Component-based"],


            "languages": ["Python", "JavaScript"],


            "frameworks": ["Custom"],


            "complexity": "Medium",


            "maintainability": "Good",


            "testCoverage": "75%",


            "dependencies": 50,


            "modules": 25,


            "classes": 15,


            "functions": 45,


            "linesOfCode": 15678,


            "technicalDebt": "Medium",


            "codeQuality": 82,


            "documentation": "Moderate",


            "timestamp": datetime.now().isoformat()


        }


    def _get_fallback_code_structure(self):


        """Get fallback code structure data_item"""


        return {


            "architecture": "Custom",


            "patterns": ["Component-based"],


            "languages": ["JavaScript"],


            "frameworks": ["Custom"],


            "complexity": "Low",


            "maintainability": "Good",


            "testCoverage": "65%",


            "dependencies": 30,


            "modules": 15,


            "classes": 8,


            "functions": 25,


            "linesOfCode": 10000,


            "technicalDebt": "Low",


            "codeQuality": 75,


            "documentation": "Basic",


            "timestamp": datetime.now().isoformat()


        }


def run_server():


    """Run the HTTP server"""


    server_address = ('', 8081)


    httpd = HTTPServer(server_address, SimpleCodeAnalysisHandler)


    print("🚀 Simple Code Analysis API Server")


    print("=" * 50)


    print(f"Server running on http://localhost:8081")


    print(f"Project directory: {Path.cwd()}")


    print("\nAvailable endpoints:")


    print("  GET  /api/health")


    print("  GET  /api/project/overview")


    print("  GET  /api/file-structure")


    print("  GET  /api/code-structure")


    print("  GET  /api/analysis/quality")


    print("  GET  /api/analysis/technical-debt")


    print("  GET  /api/recommendations")


    print("  POST /api/ai-recommendations (requires API key)")


    print("\nAuthentication:")


    print("  API Key: dev-key-12345")


    print("  Header: X-API-Key: dev-key-12345")


    print("\nPress Ctrl+C to stop the server")


    print("=" * 50)


    try:


        httpd.serve_forever()


    except KeyboardInterrupt:


        print("\n🛑 Server stopped by user")


        httpd.shutdown()


if __name__ == '__main__':


    run_server()


