#!/usr/bin/env python3
"""
Integration Tests
Test component integration and system behavior
"""

import unittest
import sys
import os

class TestSystemIntegration(unittest.TestCase):
    """Test System Integration"""
    
    def test_component_integration(self):
        """Test all components work together"""
        # Test authentication + data processing
        from core_authentication import AuthenticationManager
        from core_data_processing import DataProcessor
        
        auth = AuthenticationManager()
        processor = DataProcessor()
        
        # Test workflow
        auth_result = auth.authenticate_user("test", "test")
        data_result = processor.ingest_data("test", {"test": "data"})
        
        self.assertTrue(auth_result)
        self.assertTrue(data_result)
    
    def test_ai_integration_workflow(self):
        """Test AI integration workflow"""
        from ai_integration_manager import AIIntegrationManager
        
        ai_manager = AIIntegrationManager()
        insights = ai_manager.get_ai_insights({})
        
        self.assertIsNotNone(insights)

if __name__ == "__main__":
    unittest.main()
