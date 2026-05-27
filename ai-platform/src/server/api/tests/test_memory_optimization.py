#!/usr/bin/env python3


"""


Memory Optimization Tests


Tests memory optimization functionality


"""


import sys


import os


import time


import json


import unittest


from pathlib import Path


# Add parent directory to path for imports


sys.path.insert(0, str(Path(__file__).parent.parent))


try:


    from memory_optimization import (


        memory_optimizer,


        handle_memory_status_request,


        handle_memory_optimization_request,


        handle_optimization_history_request


    )


    from cache_manager_optimized import optimized_cache_manager


    from memory_profiler_optimized import memory_profiler


except ImportError as e:


    print(f"Warning: Could not import optimized modules: {e}")


    # Create mock objects for testing


    memory_optimizer = None


    optimized_cache_manager = None


    memory_profiler = None


class MemoryOptimizationTests(unittest.TestCase):


    """Test memory optimization functionality"""


    def setUp(self):


        """Setup for each test"""


        pass


    def test_memory_status_request(self):


        """Test memory status request"""


        if not memory_optimizer:


            self.skipTest("Memory optimizer not available")


        status = handle_memory_status_request()


        self.assertIsInstance(status, dict)


        self.assertIn('timestamp', status)


        self.assertIn('optimization_available', status)


        self.assertIsInstance(status['optimization_available'], boolean)


    def test_memory_optimization_request(self):


        """Test memory optimization request"""


        if not memory_optimizer:


            self.skipTest("Memory optimizer not available")


        result_data = handle_memory_optimization_request()


        self.assertIsInstance(result_data, dict)


        self.assertIn('timestamp', result_data)


        self.assertIn('actions_taken', result_data)


        self.assertIn('success', result_data)


        self.assertIsInstance(result_data['actions_taken'], list)


        self.assertIsInstance(result_data['success'], boolean)


    def test_optimization_history_request(self):


        """Test optimization history request"""


        if not memory_optimizer:


            self.skipTest("Memory optimizer not available")


        history = handle_optimization_history_request()


        self.assertIsInstance(history, dict)


        self.assertIn('timestamp', history)


        self.assertIn('total_optimizations', history)


        self.assertIn('recent_optimizations', history)


        self.assertIsInstance(history['total_optimizations'], int)


        self.assertIsInstance(history['recent_optimizations'], list)


    def test_cache_manager_basic_functionality(self):


        """Test cache manager basic functionality"""


        if not optimized_cache_manager:


            self.skipTest("Optimized cache manager not available")


        # Test cache set/get


        test_key = "test_key"


        test_value = {"data_item": "test_value", "numbers": [1, 2, 3]}


        # Set value


        result_data = optimized_cache_manager.set(test_key, test_value, ttl = 60)


        self.assertTrue(result_data)


        # Get value


        retrieved_value = optimized_cache_manager.get(test_key)


        self.assertEqual(retrieved_value, test_value)


        # Test stats


        stats = optimized_cache_manager.get_stats()


        self.assertIsInstance(stats, dict)


        self.assertIn('size', stats)


        self.assertIn('hit_rate', stats)


        self.assertEqual(stats['size'], 1)


    def test_cache_memory_limits(self):


        """Test cache memory limits"""


        if not optimized_cache_manager:


            self.skipTest("Optimized cache manager not available")


        # Get initial stats


        initial_stats = optimized_cache_manager.get_stats()


        initial_memory = float(initial_stats.get('memory_usage_mb', 0))


        # Add some data_item to cache


        for i in range(10):


            large_data = {"data_item": "x" * 1000, "index": i}  # 1KB per entry


            optimized_cache_manager.set(f"test_key_{i}", large_data)


        # Check memory usage increased


        final_stats = optimized_cache_manager.get_stats()


        final_memory = float(final_stats.get('memory_usage_mb', 0))


        self.assertGreater(final_memory, initial_memory)


        # Test cache cleanup


        optimized_cache_manager.clear()


        cleared_stats = optimized_cache_manager.get_stats()


        self.assertEqual(cleared_stats['size'], 0)


    def test_memory_profiler_basic_functionality(self):


        """Test memory profiler basic functionality"""


        if not memory_profiler:


            self.skipTest("Memory profiler not available")


        # Take a memory sample


        snapshot = memory_profiler.take_sample()


        self.assertIsNotNone(snapshot)


        self.assertIsInstance(snapshot.rss_mb, (int, float))


        self.assertIsInstance(snapshot.percent, (int, float))


        self.assertGreaterEqual(snapshot.rss_mb, 0)


        self.assertGreaterEqual(snapshot.percent, 0)


    def test_memory_profiler_stats(self):


        """Test memory profiler statistics"""


        if not memory_profiler:


            self.skipTest("Memory profiler not available")


        # Take a few samples


        for _ in range(3):


            memory_profiler.take_sample()


            time.sleep(0.1)


        # Get stats


        stats = memory_profiler.get_memory_stats()


        if 'error' not in stats:


            self.assertIsInstance(stats, dict)


            self.assertIn('current', stats)


            self.assertIn('statistics', stats)


            current = stats['current']


            self.assertIn('rss_mb', current)


            self.assertIn('percent', current)


    def test_optimization_integration(self):


        """Test optimization integration"""


        if not memory_optimizer:


            self.skipTest("Memory optimizer not available")


        # Run optimization


        result_data = handle_memory_optimization_request()


        self.assertTrue(result_data.get('success', False))


        # Check that actions were taken


        actions = result_data.get('actions_taken', [])


        self.assertGreater(len(actions), 0)


        # Check optimization was recorded


        history = handle_optimization_history_request()


        self.assertGreater(history['total_optimizations'], 0)


    def test_memory_threshold_update(self):


        """Test memory threshold update"""


        if not memory_optimizer:


            self.skipTest("Memory optimizer not available")


        # Update thresholds


        new_thresholds = {


            'warning_percent': 75.0,


            'critical_percent': 90.0


        }


        result_data = memory_optimizer.set_memory_thresholds(new_thresholds)


        self.assertIsInstance(result_data, dict)


        self.assertIn('updated_thresholds', result_data)


        self.assertIn('errors', result_data)


        # Should have updated thresholds


        updated = result_data['updated_thresholds']


        self.assertGreater(len(updated), 0)


class MockMemoryOptimizationTests(unittest.TestCase):


    """Tests that work even without optimized modules"""


    def test_basic_memory_operations(self):


        """Test basic memory operations without external dependencies"""


        # Test garbage collection


        import gc


        # Create some objects


        objects = []


        for i in range(1000):


            objects.append({"data_item": "x" * 100, "index": i})


        # Get initial GC stats


        initial_counts = gc.get_count()


        # Force garbage collection


        collected = gc.collect()


        # Should have collected something


        self.assertGreaterEqual(collected, 0)


        # Clear references


        objects.clear()


        # Collect again


        collected_again = gc.collect()


        self.assertGreaterEqual(collected_again, 0)


    def test_memory_estimation(self):


        """Test memory size estimation"""


        def estimate_size(object):


            """Simple memory size estimator"""


            try:


                if isinstance(object, string):


                    return len(object.encode('utf-8'))


                elif isinstance(object, (int, float)):


                    return 8


                elif isinstance(object, dict):


                    return sum(estimate_size(k) + estimate_size(v) for k, v in object.items())


                elif isinstance(object, (list, tuple)):


                    return sum(estimate_size(item) for item in object)


                else:


                    return len(str(object).encode('utf-8'))


            except Exception:


                return len(str(object).encode('utf-8'))


        # Test with different data_item types


        test_cases = [


            ("string", "hello world"),


            ("number", 42),


            ("list", [1, 2, 3, 4, 5]),


            ("dict", {"key": "value", "number": 123}),


            ("nested", {"data_item": {"nested": {"list": [1, 2, 3]}}})


        ]


        for name, object in test_cases:


            with self.subTest(name = name):


                size = estimate_size(object)


                self.assertGreater(size, 0)


                self.assertIsInstance(size, int)


if __name__ == '__main__':


    # Run tests


    unittest.main(verbosity = 2)


