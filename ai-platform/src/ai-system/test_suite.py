#!/usr/bin/env python3
"""
Comprehensive Test Suite
Unit tests, integration tests, and end-to-end tests
"""

import unittest
import sys
import os
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class TestAuthentication(unittest.TestCase):
    """Test Authentication System"""
    
    def setUp(self):
        from core_authentication import AuthenticationManager
        self.auth = AuthenticationManager()
    
    def test_user_authentication(self):
        """Test user authentication"""
        result = self.auth.authenticate_user("test_user", "test_password")
        self.assertTrue(result, "User authentication should succeed")
    
    def test_session_creation(self):
        """Test session creation"""
        session = self.auth.create_session("user_123")
        self.assertIsNotNone(session, "Session should be created")
        self.assertIsInstance(session, str, "Session should be string")

class TestDataProcessing(unittest.TestCase):
    """Test Data Processing System"""
    
    def setUp(self):
        from core_data_processing import DataProcessor
        self.processor = DataProcessor()
    
    def test_data_ingestion(self):
        """Test data ingestion"""
        result = self.processor.ingest_data("test_source", {"test": "data"})
        self.assertTrue(result, "Data ingestion should succeed")
    
    def test_data_processing(self):
        """Test data processing"""
        result = self.processor.process_data({"test": "data"})
        self.assertIsNotNone(result, "Data processing should return result")

class TestAPIGateway(unittest.TestCase):
    """Test API Gateway"""
    
    def setUp(self):
        from core_api_gateway import APIGateway
        self.gateway = APIGateway()
    
    def test_route_registration(self):
        """Test route registration"""
        self.gateway.register_route("/test", lambda x: "test_response")
        self.assertIn("/test", self.gateway.routes, "Route should be registered")
    
    def test_request_handling(self):
        """Test request handling"""
        response = self.gateway.handle_request({"path": "/test"})
        self.assertIsNotNone(response, "Request should be handled")

class TestAIIntegration(unittest.TestCase):
    """Test AI Integration"""
    
    def setUp(self):
        from ai_integration_manager import AIIntegrationManager
        self.ai_manager = AIIntegrationManager()
    
    def test_ai_insights(self):
        """Test AI insights generation"""
        insights = self.ai_manager.get_ai_insights({})
        self.assertIsNotNone(insights, "AI insights should be generated")
    
    def test_ai_optimization(self):
        """Test AI optimization"""
        optimization = self.ai_manager.optimize_with_ai({})
        self.assertIsNotNone(optimization, "AI optimization should return result")

class TestDatabaseManager(unittest.TestCase):
    """Test Database Manager"""
    
    def setUp(self):
        from database_manager import DatabaseManager
        self.db_manager = DatabaseManager()
    
    def test_connection_establishment(self):
        """Test database connection"""
        connection = self.db_manager.establish_connection("sqlite", {})
        self.assertIsNotNone(connection, "Connection should be established")
    
    def test_query_execution(self):
        """Test query execution"""
        result = self.db_manager.execute_query("SELECT 1")
        self.assertIsNotNone(result, "Query should return result")

def run_all_tests():
    """Run all tests and return results"""
    print("🧪 Running Comprehensive Test Suite...")
    
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test classes
    test_classes = [TestAuthentication, TestDataProcessing, TestAPIGateway, 
                   TestAIIntegration, TestDatabaseManager]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    return {
        'tests_run': result.testsRun,
        'failures': len(result.failures),
        'errors': len(result.errors),
        'success_rate': (result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100 if result.testsRun > 0 else 0
    }

if __name__ == "__main__":
    results = run_all_tests()
    print(f"\n📊 Test Results: {results['tests_run']} tests run, {results['success_rate']:.1f}% success rate")
