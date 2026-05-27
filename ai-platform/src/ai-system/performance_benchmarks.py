#!/usr/bin/env python3
"""
Performance Benchmarks
Test system performance and establish baselines
"""

import time
import psutil
import sys
import os

class PerformanceBenchmark:
    """Performance testing framework"""
    
    def __init__(self):
        self.results = {}
    
    def benchmark_authentication(self):
        """Benchmark authentication performance"""
        from core_authentication import AuthenticationManager
        
        auth = AuthenticationManager()
        
        # Test authentication speed
        start_time = time.time()
        for i in range(100):
            auth.authenticate_user(f"user_{i}", "password")
        end_time = time.time()
        
        auth_time = (end_time - start_time) / 100
        self.results['authentication'] = {
            'avg_time': auth_time,
            'requests_per_second': 1 / auth_time
        }
        
        return self.results['authentication']
    
    def benchmark_data_processing(self):
        """Benchmark data processing performance"""
        from core_data_processing import DataProcessor
        
        processor = DataProcessor()
        
        # Test data processing speed
        test_data = {"test": "data" * 100}
        start_time = time.time()
        for i in range(50):
            processor.process_data(test_data)
        end_time = time.time()
        
        processing_time = (end_time - start_time) / 50
        self.results['data_processing'] = {
            'avg_time': processing_time,
            'operations_per_second': 1 / processing_time
        }
        
        return self.results['data_processing']
    
    def benchmark_memory_usage(self):
        """Benchmark memory usage"""
        process = psutil.Process()
        memory_info = process.memory_info()
        
        self.results['memory'] = {
            'rss_mb': memory_info.rss / 1024 / 1024,
            'vms_mb': memory_info.vms / 1024 / 1024
        }
        
        return self.results['memory']
    
    def run_all_benchmarks(self):
        """Run all performance benchmarks"""
        print("🚀 Running Performance Benchmarks...")
        
        self.benchmark_authentication()
        self.benchmark_data_processing()
        self.benchmark_memory_usage()
        
        print("📊 Performance Results:")
        for metric, result in self.results.items():
            print(f"  {metric}: {result}")
        
        return self.results

if __name__ == "__main__":
    benchmark = PerformanceBenchmark()
    results = benchmark.run_all_benchmarks()
