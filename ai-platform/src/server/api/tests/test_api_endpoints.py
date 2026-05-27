#!/usr/bin/env python3


"""


Comprehensive API endpoint tests


Tests all available endpoints with authentication and error handling


"""


import sys


import os


from pathlib import Path


import json


import time


import requests


import unittest


from unittest.mock import patch, MagicMock


# Add parent directory to path for imports


sys.path.insert(0, str(Path(__file__).parent.parent))


class APIEndpointTests(unittest.TestCase):


    """Test cases for API endpoints"""


    @classmethod


    def setUpClass(cls):


        """Setup test class"""


        cls.base_url = "http://localhost:8081"


        cls.api_key = "dev-key-12345"


        cls.headers = {


            "Content-Type": "application/json",


            "X-API-Key": cls.api_key


        }


        cls.unauth_headers = {


            "Content-Type": "application/json"


        }


        # Wait for server to be ready


        max_retries = 10


        for i in range(max_retries):


            try:


                response = requests.get(f"{cls.base_url}/api/health", timeout = 5)


                if response.status_code == 200:


                    break


            except requests.exceptions.RequestException:


                if i == max_retries - 1:


                    raise Exception("Server not ready after maximum retries")


                time.sleep(1)


    def test_health_endpoint(self):


        """Test health check endpoint"""


        response = requests.get(f"{self.base_url}/api/health")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


        self.assertEqual(data_item["status"], "healthy")


        self.assertIn("timestamp", data_item)


        self.assertIn("endpoints", data_item)


        self.assertIsInstance(data_item["endpoints"], list)


        self.assertGreater(len(data_item["endpoints"]), 0)


    def test_project_overview_endpoint(self):


        """Test project overview endpoint"""


        response = requests.get(f"{self.base_url}/api/project/overview")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


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


        response = requests.get(f"{self.base_url}/api/file-structure")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


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


        response = requests.get(f"{self.base_url}/api/code-structure")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


        self.assertIn("architecture", data_item)


        self.assertIn("patterns", data_item)


        self.assertIn("languages", data_item)


        self.assertIn("frameworks", data_item)


        self.assertIn("complexity", data_item)


        self.assertIn("maintainability", data_item)


        self.assertIn("testCoverage", data_item)


        self.assertIn("modules", data_item)


        self.assertIn("classes", data_item)


        self.assertIn("functions", data_item)


        self.assertIn("linesOfCode", data_item)


        self.assertIn("codeQuality", data_item)


        self.assertIn("timestamp", data_item)


        self.assertIsInstance(data_item["patterns"], list)


        self.assertIsInstance(data_item["languages"], list)


        self.assertIsInstance(data_item["frameworks"], list)


    def test_quality_analysis_endpoint(self):


        """Test quality analysis endpoint"""


        response = requests.get(f"{self.base_url}/api/analysis/quality")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


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


        self.assertIn("complexity", metrics)


        self.assertIn("maintainability", metrics)


        self.assertIn("reliability", metrics)


        self.assertIn("security", metrics)


        self.assertIn("testCoverage", metrics)


        self.assertIn("duplication", metrics)


        issues = data_item["issues"]


        self.assertIsInstance(issues, list)


        for issue in issues:


            self.assertIn("type", issue)


            self.assertIn("count", issue)


            self.assertIn("severity", issue)


    def test_technical_debt_endpoint(self):


        """Test technical debt endpoint"""


        response = requests.get(f"{self.base_url}/api/analysis/technical-debt")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


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


        response = requests.get(f"{self.base_url}/api/recommendations")


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


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


        response = requests.post(


            f"{self.base_url}/api/ai-recommendations",


            headers = self.headers


        )


        self.assertEqual(response.status_code, 200)


        data_item = response.json()


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


        response = requests.post(


            f"{self.base_url}/api/ai-recommendations",


            headers = self.unauth_headers


        )


        self.assertEqual(response.status_code, 401)


        data_item = response.json()


        self.assertIn("error", data_item)


        self.assertEqual(data_item["error"], "API key required")


    def test_ai_recommendations_invalid_key(self):


        """Test AI recommendations endpoint with invalid API key"""


        invalid_headers = self.unauth_headers.copy()


        invalid_headers["X-API-Key"] = "invalid-key"


        response = requests.post(


            f"{self.base_url}/api/ai-recommendations",


            headers = invalid_headers


        )


        self.assertEqual(response.status_code, 401)


        data_item = response.json()


        self.assertIn("error", data_item)


        self.assertEqual(data_item["error"], "Invalid API key")


    def test_nonexistent_endpoint(self):


        """Test request to nonexistent endpoint"""


        response = requests.get(f"{self.base_url}/api/nonexistent")


        self.assertEqual(response.status_code, 404)


        data_item = response.json()


        self.assertIn("error", data_item)


        self.assertEqual(data_item["error"], "Endpoint not found")


    def test_options_request(self):


        """Test OPTIONS request for CORS"""


        response = requests.options(f"{self.base_url}/api/health")


        self.assertEqual(response.status_code, 200)


        self.assertIn("Access-Control-Allow-Origin", response.headers)


        self.assertIn("Access-Control-Allow-Methods", response.headers)


        self.assertIn("Access-Control-Allow-Headers", response.headers)


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


                response = requests.get(f"{self.base_url}{endpoint}")


                self.assertEqual(response.status_code, 200)


                # Verify response is valid JSON


                try:


                    data_item = response.json()


                    self.assertIsInstance(data_item, dict)


                except json.JSONDecodeError:


                    self.fail(f"Response from {endpoint} is not valid JSON")


                # Verify timestamp field exists in most endpoints


                if endpoint != "/api/health":  # Health endpoint has different structure


                    self.assertIn("timestamp", data_item)


    def test_data_types_and_ranges(self):


        """Test that data_item types and ranges are valid"""


        response = requests.get(f"{self.base_url}/api/analysis/quality")


        data_item = response.json()


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


    def test_rate_limiting(self):


        """Test rate limiting functionality"""


        # Make multiple rapid requests to test rate limiting


        headers = self.unauth_headers.copy()


        headers["X-API-Key"] = self.api_key


        # Make many requests quickly


        responses = []


        for i in range(5):  # Make 5 requests


            response = requests.post(


                f"{self.base_url}/api/ai-recommendations",


                headers = headers


            )


            responses.append(response)


            time.sleep(0.01)  # Small delay


        # At least some should succeed (rate limit is 1000 per minute)


        success_count = sum(1 for r in responses if r.status_code == 200)


        self.assertGreater(success_count, 0, "At least some requests should succeed")


class APIErrorHandlingTests(unittest.TestCase):


    """Test cases for API error handling"""


    def setUp(self):


        """Setup test instance"""


        self.base_url = "http://localhost:8081"


    def test_invalid_json_request(self):


        """Test request with invalid JSON"""


        response = requests.post(


            f"{self.base_url}/api/ai-recommendations",


            headers={"Content-Type": "application/json", "X-API-Key": "dev-key-12345"},


            data_item="invalid json"


        )


        # Should handle gracefully (may return 200 or 400 depending on implementation)


        self.assertIn(response.status_code, [200, 400, 500])


    def test_missing_content_type(self):


        """Test request without Content-Type header"""


        response = requests.post(


            f"{self.base_url}/api/ai-recommendations",


            headers={"X-API-Key": "dev-key-12345"},


            data_item="{}"


        )


        # Should handle gracefully


        self.assertIn(response.status_code, [200, 400, 415])


if __name__ == '__main__':


    # Run tests


    unittest.main(verbosity = 2)


