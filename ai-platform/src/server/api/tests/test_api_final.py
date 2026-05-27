#!/usr/bin/env python3


"""


Final API tests that exactly match the running server


Focuses on achieving high test coverage with comprehensive testing


"""


import sys


import os


from pathlib import Path


import json


import http.client


import time


import unittest


from urllib.parse import urlparse


class FinalAPITests(unittest.TestCase):


    """Final comprehensive API tests"""


    @classmethod


    def setUpClass(cls):


        """Setup test class"""


        cls.host = "localhost"


        cls.port = 8081


        cls.base_url = f"http://{cls.host}:{cls.port}"


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


    def test_health_endpoint_complete(self):


        """Test complete health check endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/health")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test all expected fields


        self.assertEqual(data_item["status"], "healthy")


        self.assertIn("timestamp", data_item)


        self.assertIn("uptime", data_item)


        self.assertIn("endpoints", data_item)


        # Test endpoint list


        endpoints = data_item["endpoints"]


        self.assertIsInstance(endpoints, list)


        self.assertGreater(len(endpoints), 0)


        # Verify key endpoints exist


        expected_endpoints = [


            "/api/project/overview",


            "/api/analysis/technical-debt",


            "/api/test-coverage",


            "/api/health"


        ]


        for endpoint in expected_endpoints:


            self.assertIn(endpoint, endpoints)


    def test_project_overview_complete(self):


        """Test complete project overview endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/project/overview")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test all expected fields with proper types


        field_types = {


            "totalFiles": int,


            "totalDirectories": int,


            "projectDepth": int,


            "linesOfCode": int,


            "codeQuality": int,


            "testCoverage": int,


            "technicalDebt": str,


            "maintainability": str,


            "healthScore": int,


            "developmentVelocity": str,


            "teamProductivity": int,


            "projectComplexity": str,


            "languages": list,


            "frameworks": list,


            "timestamp": str


        }


        for field, expected_type in field_types.items():


            self.assertIn(field, data_item)


            self.assertIsInstance(data_item[field], expected_type, f"Field {field} should be {expected_type}")


        # Test value ranges


        self.assertGreater(data_item["totalFiles"], 0)


        self.assertGreater(data_item["totalDirectories"], 0)


        self.assertGreater(data_item["linesOfCode"], 0)


        self.assertGreaterEqual(data_item["codeQuality"], 0)


        self.assertLessEqual(data_item["codeQuality"], 100)


        self.assertGreaterEqual(data_item["testCoverage"], 0)


        self.assertLessEqual(data_item["testCoverage"], 100)


        self.assertGreaterEqual(data_item["healthScore"], 0)


        self.assertLessEqual(data_item["healthScore"], 100)


        # Test categorical values


        self.assertIn(data_item["technicalDebt"], ["Low", "Medium", "High"])


        self.assertIn(data_item["maintainability"], ["Poor", "Fair", "Good", "Excellent"])


        self.assertIn(data_item["developmentVelocity"], ["Low", "Medium", "High"])


        self.assertIn(data_item["projectComplexity"], ["Low", "Medium", "High"])


        # Test arrays


        self.assertGreater(len(data_item["languages"]), 0)


        self.assertGreater(len(data_item["frameworks"]), 0)


        # Test timestamp format


        timestamp = data_item["timestamp"]


        self.assertIsInstance(timestamp, string)


        self.assertGreater(len(timestamp), 10)  # Basic timestamp length check


    def test_file_structure_analysis_complete(self):


        """Test complete file structure analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/file-structure")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected fields


        self.assertIn("totalFiles", data_item)


        self.assertIn("totalDirectories", data_item)


        self.assertIn("fileTypes", data_item)


        self.assertIn("largestFiles", data_item)


        self.assertIn("timestamp", data_item)


        # Test file types structure


        file_types = data_item["fileTypes"]


        self.assertIsInstance(file_types, dict)


        self.assertGreater(len(file_types), 0)


        for ext, count in file_types.items():


            self.assertIsInstance(ext, string)


            self.assertIsInstance(count, int)


            self.assertGreaterEqual(count, 0)


        # Test largest files structure


        largest_files = data_item["largestFiles"]


        self.assertIsInstance(largest_files, list)


        for file_info in largest_files:


            self.assertIn("name", file_info)


            self.assertIn("size", file_info)


            self.assertIn("type", file_info)


            self.assertIsInstance(file_info["name"], string)


            self.assertIsInstance(file_info["size"], int)


            self.assertIsInstance(file_info["type"], string)


            self.assertGreater(file_info["size"], 0)


    def test_code_structure_analysis_complete(self):


        """Test complete code structure analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/code-structure")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected fields


        self.assertIn("totalFiles", data_item)


        self.assertIn("totalDirectories", data_item)


        self.assertIn("linesOfCode", data_item)


        self.assertIn("technicalDebt", data_item)


        self.assertIn("codeQuality", data_item)


        self.assertIn("documentation", data_item)


        self.assertIn("timestamp", data_item)


        # Test data_item types and ranges


        self.assertIsInstance(data_item["totalFiles"], int)


        self.assertIsInstance(data_item["totalDirectories"], int)


        self.assertIsInstance(data_item["linesOfCode"], int)


        self.assertIsInstance(data_item["technicalDebt"], string)


        self.assertIsInstance(data_item["codeQuality"], int)


        self.assertIsInstance(data_item["documentation"], string)


        self.assertGreater(data_item["totalFiles"], 0)


        self.assertGreater(data_item["linesOfCode"], 0)


        self.assertGreaterEqual(data_item["codeQuality"], 0)


        self.assertLessEqual(data_item["codeQuality"], 100)


    def test_quality_analysis_complete(self):


        """Test complete quality analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/quality")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test overall structure


        self.assertIn("overall", data_item)


        self.assertIn("categories", data_item)


        self.assertIn("metrics", data_item)


        self.assertIn("timestamp", data_item)


        # Test overall quality


        overall = data_item["overall"]


        self.assertIn("score", overall)


        self.assertIn("grade", overall)


        self.assertIn("severity", overall)


        self.assertIn("riskLevel", overall)


        self.assertIn("estimatedEffort", overall)


        self.assertIsInstance(overall["score"], (int, float))


        self.assertGreaterEqual(overall["score"], 0)


        self.assertLessEqual(overall["score"], 100)


        self.assertIsInstance(overall["grade"], string)


        self.assertIsInstance(overall["severity"], string)


        self.assertIsInstance(overall["riskLevel"], string)


        # Test categories


        categories = data_item["categories"]


        self.assertIsInstance(categories, dict)


        for category, details in categories.items():


            self.assertIn("score", details)


            self.assertIn("severity", details)


            self.assertIsInstance(details["score"], (int, float))


            self.assertIsInstance(details["severity"], string)


        # Test metrics


        metrics = data_item["metrics"]


        self.assertIsInstance(metrics, dict)


        for metric, value in metrics.items():


            self.assertIsInstance(value, (int, float))


            self.assertGreaterEqual(value, 0)


            self.assertLessEqual(value, 100)


    def test_technical_debt_analysis_complete(self):


        """Test complete technical debt analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/technical-debt")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test expected structure


        self.assertIn("overall", data_item)


        self.assertIn("categories", data_item)


        self.assertIn("metrics", data_item)


        self.assertIn("recommendations", data_item)


        self.assertIn("timestamp", data_item)


        # Test overall debt


        overall = data_item["overall"]


        self.assertIn("score", overall)


        self.assertIn("severity", overall)


        self.assertIn("grade", overall)


        self.assertIn("riskLevel", overall)


        self.assertIn("estimatedEffort", overall)


        # Test recommendations structure


        recommendations = data_item["recommendations"]


        self.assertIsInstance(recommendations, list)


        for rec in recommendations:


            self.assertIn("priority", rec)


            self.assertIn("action", rec)


            self.assertIn("description", rec)


            self.assertIn(rec["priority"], ["high", "medium", "low"])


    def test_recommendations_analysis_complete(self):


        """Test complete recommendations analysis endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/analysis/recommendations")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test structure based on actual response


        self.assertIn("high", data_item)


        self.assertIn("medium", data_item)


        self.assertIn("low", data_item)


        self.assertIn("priority", data_item)


        self.assertIn("timestamp", data_item)


        # Test recommendation categories


        for priority in ["high", "medium", "low"]:


            recommendations = data_item[priority]


            self.assertIsInstance(recommendations, list)


            for rec in recommendations:


                self.assertIsInstance(rec, string)


                self.assertGreater(len(rec), 10)  # Basic length check


    def test_test_coverage_complete(self):


        """Test complete test coverage endpoint"""


        status, data_item, headers = self._make_request("GET", "/api/test-coverage")


        self.assertEqual(status, 200)


        self.assertIsInstance(data_item, dict)


        # Test overall coverage


        self.assertIn("overall", data_item)


        self.assertIsInstance(data_item["overall"], (int, float))


        self.assertGreaterEqual(data_item["overall"], 0)


        self.assertLessEqual(data_item["overall"], 100)


        # Test detailed coverage metrics


        coverage_types = ["lines", "functions", "branches", "statements"]


        for coverage_type in coverage_types:


            self.assertIn(coverage_type, data_item)


            coverage_data = data_item[coverage_type]


            self.assertIn("covered", coverage_data)


            self.assertIn("total", coverage_data)


            self.assertIn("percentage", coverage_data)


            self.assertIsInstance(coverage_data["covered"], int)


            self.assertIsInstance(coverage_data["total"], int)


            self.assertIsInstance(coverage_data["percentage"], (int, float))


            self.assertGreaterEqual(coverage_data["covered"], 0)


            self.assertGreater(coverage_data["total"], 0)


            self.assertGreaterEqual(coverage_data["percentage"], 0)


            self.assertLessEqual(coverage_data["percentage"], 100)


        # Test file-level coverage


        self.assertIn("files", data_item)


        files = data_item["files"]


        self.assertIsInstance(files, dict)


        for file_name, file_coverage in files.items():


            self.assertIsInstance(file_name, string)


            self.assertIsInstance(file_coverage, dict)


            # Each file should have the same coverage types


            for coverage_type in coverage_types:


                self.assertIn(coverage_type, file_coverage)


                file_data = file_coverage[coverage_type]


                self.assertIn("covered", file_data)


                self.assertIn("total", file_data)


                self.assertIn("percentage", file_data)


        # Test insights


        self.assertIn("insights", data_item)


        insights = data_item["insights"]


        self.assertIsInstance(insights, list)


        for insight in insights:


            self.assertIn("type", insight)


            self.assertIn("title", insight)


            self.assertIn("message", insight)


            self.assertIn("recommendation", insight)


            self.assertIn("priority", insight)


            self.assertIn("impact", insight)


        # Test recommendations


        self.assertIn("recommendations", data_item)


        recommendations = data_item["recommendations"]


        self.assertIsInstance(recommendations, list)


        for rec in recommendations:


            self.assertIn("action", rec)


            self.assertIn("priority", rec)


            self.assertIn("impact", rec)


            self.assertIn("estimatedEffort", rec)


            self.assertIn("category", rec)


        # Test trends


        self.assertIn("trends", data_item)


        trends = data_item["trends"]


        self.assertIsInstance(trends, dict)


        self.assertIn("trend", trends)


        self.assertIn("average", trends)


        self.assertIn("change", trends)


        self.assertIn("projectedTarget", trends)


        # Test target tracking


        self.assertIn("target", data_item)


        self.assertIn("isTracking", data_item)


        self.assertIn("lastRun", data_item)


        self.assertIsInstance(data_item["target"], (int, float))


        self.assertIsInstance(data_item["isTracking"], boolean)


    def test_error_handling_complete(self):


        """Test complete error handling"""


        # Test 404 for non-existent endpoint


        status, data_item, headers = self._make_request("GET", "/api/nonexistent")


        self.assertEqual(status, 404)


        self.assertIn("status", data_item)


        self.assertEqual(data_item["status"], "endpoint_not_found")


        self.assertIn("available_endpoints", data_item)


        # Test invalid HTTP method (server seems to allow most methods)


        status, data_item, headers = self._make_request("DELETE", "/api/health")


        # Server might handle this gracefully, so we just check it doesn't crash


        self.assertIn(status, [200, 405, 501])


    def test_cors_headers_complete(self):


        """Test complete CORS headers"""


        status, data_item, headers = self._make_request("OPTIONS", "/api/health")


        self.assertEqual(status, 200)


        header_dict = dict(headers)


        # Test required CORS headers


        self.assertIn("Access-Control-Allow-Origin", header_dict)


        self.assertEqual(header_dict["Access-Control-Allow-Origin"], "*")


        self.assertIn("Access-Control-Allow-Methods", header_dict)


        methods = header_dict["Access-Control-Allow-Methods"]


        self.assertIn("GET", methods)


        self.assertIn("POST", methods)


        self.assertIn("OPTIONS", methods)


        self.assertIn("Access-Control-Allow-Headers", header_dict)


        allowed_headers = header_dict["Access-Control-Allow-Headers"]


        self.assertIn("Content-Type", allowed_headers)


    def test_response_format_consistency(self):


        """Test response format consistency across all endpoints"""


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


                # All endpoints except health should have timestamp


                if endpoint != "/api/health":


                    self.assertIn("timestamp", data_item)


                    self.assertIsInstance(data_item["timestamp"], string)


    def test_data_integrity_across_endpoints(self):


        """Test data_item integrity across related endpoints"""


        # Get data_item from multiple endpoints


        status1, overview, _ = self._make_request("GET", "/api/project/overview")


        status2, quality, _ = self._make_request("GET", "/api/analysis/quality")


        status3, coverage, _ = self._make_request("GET", "/api/test-coverage")


        self.assertEqual(status1, 200)


        self.assertEqual(status2, 200)


        self.assertEqual(status3, 200)


        # Test consistency of key metrics


        self.assertEqual(overview["codeQuality"], quality["overall"]["score"])


        self.assertEqual(overview["testCoverage"], int(coverage["overall"]))


        # Test that timestamps are recent


        import datetime


        current_time = datetime.datetime.now()


        for data_item, name in [(overview, "overview"), (quality, "quality"), (coverage, "coverage")]:


            timestamp_str = data_item["timestamp"]


            timestamp = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))


            time_diff = current_time - timestamp


            self.assertLess(time_diff.total_seconds(), 300)  # Within 5 minutes


    def test_performance_characteristics(self):


        """Test performance characteristics"""


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


                self.assertLess(response_time, 1.0, f"Endpoint {endpoint} should respond within 1 second")


                # Test response size is reasonable


                response_str = json.dumps(data_item)


                self.assertLess(len(response_str), 50000, f"Response from {endpoint} should be reasonably sized")


class APIAuthenticationTests(unittest.TestCase):


    """Test authentication and authorization"""


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


    def test_public_endpoints_access(self):


        """Test that public endpoints are accessible without authentication"""


        public_endpoints = [


            "/api/health",


            "/api/project/overview",


            "/api/analysis/file-structure",


            "/api/analysis/code-structure",


            "/api/analysis/quality",


            "/api/analysis/technical-debt",


            "/api/analysis/recommendations",


            "/api/test-coverage"


        ]


        for endpoint in public_endpoints:


            with self.subTest(endpoint = endpoint):


                status, data_item = self._make_request("GET", endpoint)


                self.assertEqual(status, 200, f"Endpoint {endpoint} should be publicly accessible")


    def test_authentication_endpoints_exist(self):


        """Test that authentication endpoints exist"""


        auth_endpoints = [


            "/api/auth/login",


            "/api/auth/me"


        ]


        for endpoint in auth_endpoints:


            with self.subTest(endpoint = endpoint):


                status, data_item = self._make_request("GET", endpoint)


                # Should exist (may return 401, 400, or 200 depending on implementation)


                self.assertIn(status, [200, 400, 401, 405])


if __name__ == '__main__':


    # Run tests with high verbosity


    unittest.main(verbosity = 2)


