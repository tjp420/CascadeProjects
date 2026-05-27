#!/usr/bin/env python3


"""


Working API tests that match the actual running server


Tests all available endpoints and improves test coverage


"""


import sys


import os


from pathlib import Path


import json


import http.client


import time


import unittest


from urllib.parse import urlparse


class WorkingAPITests(unittest.TestCase):


    """API tests that match the actual running server"""


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


        self.assertGreater(len(data_item["endpoints"]), 0)


    def test_project_overview_endpoint(self):


        """Test project overview endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/project/overview")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test all expected fields


        required_fields = [


            "totalFiles", "totalDirectories", "projectDepth", "linesOfCode",


            "codeQuality", "testCoverage", "technicalDebt", "maintainability",


            "healthScore", "developmentVelocity", "teamProductivity",


            "projectComplexity", "languages", "frameworks", "timestamp"


        ]


        for field in required_fields:


            self.assertIn(field, data_item)


        # Test data_item types


        self.assertIsInstance(data_item["totalFiles"], int)


        self.assertIsInstance(data_item["totalDirectories"], int)


        self.assertIsInstance(data_item["linesOfCode"], int)


        self.assertIsInstance(data_item["codeQuality"], int)


        self.assertIsInstance(data_item["testCoverage"], int)


        self.assertIsInstance(data_item["healthScore"], int)


        self.assertIsInstance(data_item["languages"], list)


        self.assertIsInstance(data_item["frameworks"], list)


        # Test ranges


        self.assertGreaterEqual(data_item["codeQuality"], 0)


        self.assertLessEqual(data_item["codeQuality"], 100)


        self.assertGreaterEqual(data_item["testCoverage"], 0)


        self.assertLessEqual(data_item["testCoverage"], 100)


        self.assertGreaterEqual(data_item["healthScore"], 0)


        self.assertLessEqual(data_item["healthScore"], 100)


    def test_analysis_file_structure_endpoint(self):


        """Test file structure analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/file-structure")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("structure", data_item)


        self.assertIn("timestamp", data_item)


        structure = data_item["structure"]


        self.assertIsInstance(structure, dict)


    def test_analysis_code_structure_endpoint(self):


        """Test code structure analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/code-structure")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("structure", data_item)


        self.assertIn("timestamp", data_item)


        structure = data_item["structure"]


        self.assertIsInstance(structure, dict)


    def test_analysis_quality_endpoint(self):


        """Test quality analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/quality")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("overall", data_item)


        self.assertIn("metrics", data_item)


        self.assertIn("timestamp", data_item)


        overall = data_item["overall"]


        self.assertIn("score", overall)


        self.assertIn("grade", overall)


        self.assertIsInstance(overall["score"], (int, float))


        self.assertGreaterEqual(overall["score"], 0)


        self.assertLessEqual(overall["score"], 100)


        metrics = data_item["metrics"]


        self.assertIsInstance(metrics, dict)


    def test_analysis_technical_debt_endpoint(self):


        """Test technical debt analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/technical-debt")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("overall", data_item)


        self.assertIn("categories", data_item)


        self.assertIn("metrics", data_item)


        self.assertIn("recommendations", data_item)


        self.assertIn("timestamp", data_item)


        overall = data_item["overall"]


        self.assertIn("score", overall)


        self.assertIsInstance(overall["score"], (int, float))


        categories = data_item["categories"]


        self.assertIsInstance(categories, dict)


        recommendations = data_item["recommendations"]


        self.assertIsInstance(recommendations, list)


        # Test recommendation structure


        for rec in recommendations:


            self.assertIn("priority", rec)


            self.assertIn("action", rec)


            self.assertIn("description", rec)


            self.assertIn(rec["priority"], ["high", "medium", "low"])


    def test_analysis_recommendations_endpoint(self):


        """Test recommendations analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/recommendations")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("recommendations", data_item)


        self.assertIn("timestamp", data_item)


        recommendations = data_item["recommendations"]


        self.assertIsInstance(recommendations, list)


    def test_test_coverage_endpoint(self):


        """Test test coverage endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/test-coverage")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("coverage", data_item)


        self.assertIn("timestamp", data_item)


        coverage = data_item["coverage"]


        self.assertIsInstance(coverage, dict)


    def test_nonexistent_endpoint(self):


        """Test request to nonexistent endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/nonexistent")


        self.assertEqual(status, 404)


        self.assertIsInstance(data_item, dict)


        self.assertIn("status", data_item)


        self.assertEqual(data_item["status"], "endpoint_not_found")


    def test_options_request(self):


        """Test OPTIONS request for CORS"""


        status, data_item, headers = self._make_request("OPTIONS", "/api/health")


        self.assertEqual(status, 200)


        # Check for CORS headers


        header_names = [h[0] for h in headers]


        self.assertIn("Access-Control-Allow-Origin", header_names)


    def test_all_endpoints_return_json(self):


        """Test that all endpoints return valid JSON"""


        endpoints = [


            "/api/health",


            "/api/project/overview",


            "/api/analysis/file-structure",


            "/api/analysis/code-structure",


            "/api/analysis/quality",


            "/api/analysis/technical-debt",


            "/api/analysis/recommendations",


            "/api/test-coverage"


        ]


        for endpoint in endpoints:


            with self.subTest(endpoint = endpoint):


                status, data_item, headers = self._make_request("GET", endpoint)


                self.assertEqual(status, 200)


                self.assertIsInstance(data_item, dict)


    def test_all_endpoints_have_timestamp(self):


        """Test that all endpoints have timestamp field"""


        endpoints = [


            "/api/project/overview",


            "/api/analysis/file-structure",


            "/api/analysis/code-structure",


            "/api/analysis/quality",


            "/api/analysis/technical-debt",


            "/api/analysis/recommendations",


            "/api/test-coverage"


        ]


        for endpoint in endpoints:


            with self.subTest(endpoint = endpoint):


                status, data_item, headers = self._make_request("GET", endpoint)


                self.assertEqual(status, 200)


                self.assertIn("timestamp", data_item)


    def test_data_consistency_across_endpoints(self):


        """Test data_item consistency across related endpoints"""


        # Get project overview


        status1, overview_data, _ = self._make_request("GET", "/api/project/overview")


        self.assertEqual(status1, 200)


        # Get technical debt


        status2, debt_data, _ = self._make_request("GET", "/api/analysis/technical-debt")


        self.assertEqual(status2, 200)


        # Get quality


        status3, quality_data, _ = self._make_request("GET", "/api/analysis/quality")


        self.assertEqual(status3, 200)


        # Test consistency of key metrics


        self.assertEqual(overview_data["codeQuality"], quality_data["overall"]["score"])


        self.assertEqual(overview_data["testCoverage"], 65)  # Expected value


    def test_endpoint_response_times(self):


        """Test that endpoints respond quickly"""


        endpoints = [


            "/api/health",


            "/api/project/overview",


            "/api/analysis/quality"


        ]


        for endpoint in endpoints:


            with self.subTest(endpoint = endpoint):


                start_time = time.time()


                status, data_item, headers = self._make_request("GET", endpoint)


                end_time = time.time()


                response_time = end_time - start_time


                self.assertEqual(status, 200)


                self.assertLess(response_time, 2.0, f"Endpoint {endpoint} took too long to respond")


    def test_error_handling(self):


        """Test error handling for invalid requests"""


        # Test invalid method


        status, data_item, headers = self._make_request("DELETE", "/api/health")


        self.assertIn(status, [405, 501])  # Method not allowed or not implemented


    def test_response_headers(self):


        """Test response headers"""


        status, data_item, headers = self._make_request("GET", "/api/health")


        self.assertEqual(status, 200)


        # Check for important headers


        header_dict = dict(headers)


        self.assertIn("content-type", header_dict)


        self.assertEqual(header_dict["content-type"], "application/json")


class APIIntegrationTests(unittest.TestCase):


    """Integration tests for API workflows"""


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


    def test_complete_analysis_workflow(self):


        """Test complete analysis workflow"""


        # Step 1: Get project overview


        status, overview, _ = self._make_request("GET", "/api/project/overview")


        self.assertEqual(status, 200)


        # Step 2: Get quality analysis


        status, quality, _ = self._make_request("GET", "/api/analysis/quality")


        self.assertEqual(status, 200)


        # Step 3: Get technical debt


        status, debt, _ = self._make_request("GET", "/api/analysis/technical-debt")


        self.assertEqual(status, 200)


        # Step 4: Get recommendations


        status, recommendations, _ = self._make_request("GET", "/api/analysis/recommendations")


        self.assertEqual(status, 200)


        # Verify data_item consistency


        self.assertEqual(overview["codeQuality"], quality["overall"]["score"])


        self.assertIsInstance(recommendations["recommendations"], list)


        self.assertGreater(len(recommendations["recommendations"]), 0)


    def test_health_check_before_analysis(self):


        """Test health check before running analysis"""


        # Check health


        status, health, _ = self._make_request("GET", "/api/health")


        self.assertEqual(status, 200)


        self.assertEqual(health["status"], "healthy")


        # Run analysis


        status, analysis, _ = self._make_request("GET", "/api/project/overview")


        self.assertEqual(status, 200)


        # Verify server is still healthy


        status, health_after, _ = self._make_request("GET", "/api/health")


        self.assertEqual(status, 200)


        self.assertEqual(health_after["status"], "healthy")


if __name__ == '__main__':


    # Run tests


    unittest.main(verbosity = 2)


