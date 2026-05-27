#!/usr/bin/env python3


"""


Simple API tests without external dependencies


Tests the API server functionality using built-in HTTP client


"""


import sys


import os


from pathlib import Path


import json


import http.client


import time


import unittest


from urllib.parse import urlparse


class SimpleAPITests(unittest.TestCase):


    """Simple API tests using built-in HTTP client"""


    @classmethod


    def setUpClass(cls):


        """Setup test class"""


        cls.host = "localhost"


        cls.port = 8081


        cls.base_url = f"http://{cls.host}:{cls.port}"


        cls.api_key = "dev-key-12345"


        # Wait for server to be ready


        max_retries = 10


        for i in range(max_retries):


            try:


                conn = http.client.HTTPConnection(cls.host, cls.port, timeout = 5)


                conn.request("GET", "/api/health")


                response = conn.getresponse()


                if response.status == 200:


                    conn.close()


                    break


                conn.close()


            except Exception:


                if i == max_retries - 1:


                    raise Exception("Server not ready after maximum retries")


                time.sleep(1)


    def setUp(self):


        """Setup for each test"""


        self.conn = http.client.HTTPConnection(self.host, self.port, timeout = 10)


    def tearDown(self):


        """Cleanup after each test"""


        self.conn.close()


    def _make_request(self, method, path, headers = None, body = None):


        """Helper method to make HTTP requests"""


        if headers is None:


            headers = {}


        try:


            self.conn.request(method, path, body, headers)


            response = self.conn.getresponse()


            data_item = response.read().decode('utf-8')


            # Try to parse as JSON


            try:


                json_data = json.loads(data_item)


            except json.JSONDecodeError:


                json_data = data_item


            return response.status, json_data, response.getheaders()


        except Exception as e:


            return 500, {"error": str(e)}, []


    def test_health_endpoint(self):


        """Test health check endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/health")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertEqual(data_item["status"], "healthy")


        self.assertIn("timestamp", data_item)


        self.assertIn("endpoints", data_item)


        self.assertIsInstance(data_item["endpoints"], list)


    def test_project_overview_endpoint(self):


        """Test project overview endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/project/overview")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertIn("name", data_item)


        self.assertIn("overview", data_item)


        self.assertIn("metrics", data_item)


        overview = data_item["overview"]


        self.assertIn("totalFiles", overview)


        self.assertIn("linesOfCode", overview)


        self.assertIn("codeQuality", overview)


        self.assertIn("testCoverage", overview)


        self.assertIn("languages", overview)


        self.assertIsInstance(overview["languages"], list)


        metrics = data_item["metrics"]


        self.assertIn("totalFiles", metrics)


        self.assertIn("codeQuality", metrics)


        self.assertIn("testCoverage", metrics)


    def test_file_structure_endpoint(self):


        """Test file structure endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/file-structure")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertIn("structure", data_item)


        self.assertIn("timestamp", data_item)


        structure = data_item["structure"]


        self.assertIn("root", structure)


        self.assertIn("directories", structure)


        self.assertIn("file_types", structure)


        self.assertIsInstance(structure["directories"], list)


        self.assertIsInstance(structure["file_types"], dict)


    def test_code_structure_endpoint(self):


        """Test code structure endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/code-structure")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        required_fields = [


            "architecture", "patterns", "languages", "frameworks",


            "complexity", "maintainability", "testCoverage", "modules",


            "classes", "functions", "linesOfCode", "codeQuality", "timestamp"


        ]


        for field in required_fields:


            self.assertIn(field, data_item)


        self.assertIsInstance(data_item["patterns"], list)


        self.assertIsInstance(data_item["languages"], list)


        self.assertIsInstance(data_item["frameworks"], list)


    def test_quality_analysis_endpoint(self):


        """Test quality analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/quality")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertIn("overall", data_item)


        self.assertIn("metrics", data_item)


        self.assertIn("issues", data_item)


        self.assertIn("timestamp", data_item)


        overall = data_item["overall"]


        self.assertIn("score", overall)


        self.assertIn("grade", overall)


        self.assertIn("status", overall)


        self.assertIsInstance(overall["score"], int)


        self.assertGreaterEqual(overall["score"], 0)


        self.assertLessEqual(overall["score"], 100)


        metrics = data_item["metrics"]


        metric_fields = ["complexity", "maintainability", "reliability", "security", "testCoverage", "duplication"]


        for field in metric_fields:


            self.assertIn(field, metrics)


        issues = data_item["issues"]


        self.assertIsInstance(issues, list)


        for issue in issues:


            self.assertIn("type", issue)


            self.assertIn("count", issue)


            self.assertIn("severity", issue)


    def test_technical_debt_endpoint(self):


        """Test technical debt endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/technical-debt")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertIn("overall_debt", data_item)


        self.assertIn("debt_score", data_item)


        self.assertIn("categories", data_item)


        self.assertIn("recommendations", data_item)


        self.assertIn("timestamp", data_item)


        categories = data_item["categories"]


        self.assertIsInstance(categories, dict)


        for category, details in categories.items():


            self.assertIn("score", details)


            self.assertIn("issues", details)


        recommendations = data_item["recommendations"]


        self.assertIsInstance(recommendations, list)


        self.assertGreater(len(recommendations), 0)


    def test_recommendations_endpoint(self):


        """Test recommendations endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/recommendations")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertIn("recommendations", data_item)


        self.assertIn("total_count", data_item)


        self.assertIn("timestamp", data_item)


        recommendations = data_item["recommendations"]


        self.assertIsInstance(recommendations, list)


        self.assertGreater(len(recommendations), 0)


        for rec in recommendations:


            self.assertIn("category", rec)


            self.assertIn("priority", rec)


            self.assertIn("title", rec)


            self.assertIn("description", rec)


            self.assertIn("action", rec)


            self.assertIn(rec["priority"], ["High", "Medium", "Low"])


    def test_ai_recommendations_authenticated(self):


        """Test AI recommendations endpoint with authentication"""


        headers = {


            "Content-Type": "application/json",


            "X-API-Key": self.api_key


        }


        status, data_item, response_headers = self._make_request("POST", "/api/ai-recommendations", headers)


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        self.assertIn("ai_analysis", data_item)


        self.assertIn("generated_by", data_item)


        self.assertIn("timestamp", data_item)


        ai_analysis = data_item["ai_analysis"]


        self.assertIn("code_patterns", ai_analysis)


        self.assertIn("optimization_suggestions", ai_analysis)


        self.assertIn("architecture_review", ai_analysis)


        self.assertIsInstance(ai_analysis["code_patterns"], list)


        self.assertIsInstance(ai_analysis["optimization_suggestions"], list)


        self.assertIn("AI Analysis for", data_item["generated_by"])


    def test_ai_recommendations_unauthorized(self):


        """Test AI recommendations endpoint without authentication"""


        headers = {"Content-Type": "application/json"}


        status, data_item, response_headers = self._make_request("POST", "/api/ai-recommendations", headers)


        self.assertEqual(status, 401)


        self.assertIsInstance(data_item, dict)


        self.assertIn("error", data_item)


        self.assertEqual(data_item["error"], "API key required")


    def test_ai_recommendations_invalid_key(self):


        """Test AI recommendations endpoint with invalid API key"""


        headers = {


            "Content-Type": "application/json",


            "X-API-Key": "invalid-key"


        }


        status, data_item, response_headers = self._make_request("POST", "/api/ai-recommendations", headers)


        self.assertEqual(status, 401)


        self.assertIsInstance(data_item, dict)


        self.assertIn("error", data_item)


        self.assertEqual(data_item["error"], "Invalid API key")


    def test_nonexistent_endpoint(self):


        """Test request to nonexistent endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/nonexistent")


        self.assertEqual(status, 404)


        self.assertIsInstance(data_item, dict)


        self.assertIn("error", data_item)


        self.assertEqual(data_item["error"], "Endpoint not found")


    def test_options_request(self):


        """Test OPTIONS request for CORS"""


        status, data_item, headers = self._make_request("OPTIONS", "/api/health")


        self.assertEqual(status, 200)


        # Check for CORS headers


        header_names = [h[0] for h in headers]


        self.assertIn("Access-Control-Allow-Origin", header_names)


        self.assertIn("Access-Control-Allow-Methods", header_names)


        self.assertIn("Access-Control-Allow-Headers", header_names)


    def test_response_format_consistency(self):


        """Test that all endpoints return consistent JSON format"""


        endpoints = [


            "/api/health",


            "/api/project/overview",


            "/api/file-structure",


            "/api/code-structure",


            "/api/analysis/quality",


            "/api/analysis/technical-debt",


            "/api/recommendations"


        ]


        for endpoint in endpoints:


            with self.subTest(endpoint = endpoint):


                status, data_item, headers = self._make_request("GET", endpoint)


                self.assertEqual(status, 200)


                # Verify response is valid JSON


                self.assertIsInstance(data_item, dict)


                # Verify timestamp field exists in most endpoints


                if endpoint != "/api/health":  # Health endpoint has different structure


                    self.assertIn("timestamp", data_item)


    def test_data_types_and_ranges(self):


        """Test that data_item types and ranges are valid"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/quality")


        # Test score ranges


        overall_score = data_item["overall"]["score"]


        self.assertIsInstance(overall_score, int)


        self.assertGreaterEqual(overall_score, 0)


        self.assertLessEqual(overall_score, 100)


        # Test metric ranges


        metrics = data_item["metrics"]


        for metric_name, metric_value in metrics.items():


            if isinstance(metric_value, (int, float)):


                self.assertGreaterEqual(metric_value, 0)


                self.assertLessEqual(metric_value, 100)


    def test_cors_headers(self):


        """Test CORS headers are present"""


        status, data_item, headers = self._make_request("GET", "/api/health")


        header_dict = dict(headers)


        self.assertEqual(header_dict.get("Access-Control-Allow-Origin"), "*")


        self.assertIn("GET, POST, OPTIONS", header_dict.get("Access-Control-Allow-Methods", ""))


        self.assertIn("Content-Type", header_dict.get("Access-Control-Allow-Headers", ""))


class APIAuthenticationTests(unittest.TestCase):


    """Test cases for API authentication"""


    def setUp(self):


        """Setup for each test"""


        self.host = "localhost"


        self.port = 8081


        self.conn = http.client.HTTPConnection(self.host, self.port, timeout = 10)


    def tearDown(self):


        """Cleanup after each test"""


        self.conn.close()


    def _make_request(self, method, path, headers = None, body = None):


        """Helper method to make HTTP requests"""


        if headers is None:


            headers = {}


        try:


            self.conn.request(method, path, body, headers)


            response = self.conn.getresponse()


            data_item = response.read().decode('utf-8')


            # Try to parse as JSON


            try:


                json_data = json.loads(data_item)


            except json.JSONDecodeError:


                json_data = data_item


            return response.status, json_data


        except Exception as e:


            return 500, {"error": str(e)}


    def test_get_endpoints_no_auth_required(self):


        """Test that GET endpoints don't require authentication"""


        get_endpoints = [


            "/api/health",


            "/api/project/overview",


            "/api/file-structure",


            "/api/code-structure",


            "/api/analysis/quality",


            "/api/analysis/technical-debt",


            "/api/recommendations"


        ]


        for endpoint in get_endpoints:


            with self.subTest(endpoint = endpoint):


                status, data_item = self._make_request("GET", endpoint)


                # GET endpoints should work without authentication


                self.assertEqual(status, 200)


    def test_post_endpoint_requires_auth(self):


        """Test that POST endpoints require authentication"""


        status, data_item = self._make_request("POST", "/api/ai-recommendations")


        self.assertEqual(status, 401)


        self.assertIn("error", data_item)


if __name__ == '__main__':


    # Run tests


    unittest.main(verbosity = 2)


