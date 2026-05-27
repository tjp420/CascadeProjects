#!/usr/bin/env python3
"""Test script to verify strategy classes are syntactically correct"""

import os
import mimetypes
from abc import ABC, abstractmethod
from typing import Dict, Optional, Any

# Mock classes needed for testing
class ProcessingTask:
    def __init__(self, task_id: str, file_path: str, operation: str, options: Dict[str, Any]):
        self.task_id = task_id
        self.file_path = file_path
        self.operation = operation
        self.options = options
        self.status = "pending"
        self.progress = 0.0
        self.result_data = None
        self.error = None

class FileCompressor:
    def compress_file(self, file_path: str, output_path: str, format: str) -> bool:
        return True
    
    def decompress_file(self, file_path: str, output_path: str) -> bool:
        return True
    
    def get_compression_ratio(self, original_size: int, compressed_size: int) -> float:
        if original_size == 0:
            return 1.0
        return compressed_size / original_size

class FileStreamer:
    pass

# Strategy classes
class OptimizationStrategy(ABC):
    """
    Abstract base class for file optimization strategies.
    
    This class defines the interface for different file processing strategies,
    allowing the FileProcessor to use different optimization algorithms
    interchangeably without modifying its core logic.
    """
    
    @abstractmethod
    def execute(self, task: 'ProcessingTask', compressor: 'FileCompressor', 
                streamer: 'FileStreamer') -> Dict[str, Any]:
        """
        Execute the optimization strategy on a given task.
        
        Args:
            task: The ProcessingTask containing file path and options
            compressor: FileCompressor instance for compression operations
            streamer: FileStreamer instance for streaming operations
            
        Returns:
            Dictionary containing the result of the operation
            
        Raises:
            Exception: If the operation fails
        """
        pass


class CompressionStrategy(OptimizationStrategy):
    """
    Strategy for compressing files using various formats (gzip, zip, tar).
    """
    
    def execute(self, task: 'ProcessingTask', compressor: 'FileCompressor', 
                streamer: 'FileStreamer') -> Dict[str, Any]:
        """
        Execute file compression operation.
        
        Args:
            task: ProcessingTask with compression options
            compressor: FileCompressor instance
            streamer: FileStreamer instance (unused in compression)
            
        Returns:
            Dict containing compression results including paths, sizes, and ratio
            
        Raises:
            Exception: If compression fails
        """
        file_path = task.file_path
        options = task.options
        output_path = options.get('output_path', f"{file_path}.compressed")
        format = options.get('format', 'gzip')
        
        # Get original size
        original_size = os.path.getsize(file_path)
        
        # Update progress
        task.progress = 0.1
        
        # Compress file
        success = compressor.compress_file(file_path, output_path, format)
        
        if not success:
            raise Exception("Compression failed")
        
        # Get compressed size
        compressed_size = os.path.getsize(output_path)
        compression_ratio = compressor.get_compression_ratio(original_size, compressed_size)
        
        task.progress = 1.0
        
        return {
            "original_path": file_path,
            "compressed_path": output_path,
            "original_size": original_size,
            "compressed_size": compressed_size,
            "compression_ratio": compression_ratio,
            "format": format
        }


class DecompressionStrategy(OptimizationStrategy):
    """
    Strategy for decompressing files from various formats (gzip, zip, tar).
    """
    
    def execute(self, task: 'ProcessingTask', compressor: 'FileCompressor', 
                streamer: 'FileStreamer') -> Dict[str, Any]:
        """
        Execute file decompression operation.
        
        Args:
            task: ProcessingTask with decompression options
            compressor: FileCompressor instance
            streamer: FileStreamer instance (unused in decompression)
            
        Returns:
            Dict containing decompression results including paths and size
            
        Raises:
            Exception: If decompression fails
        """
        file_path = task.file_path
        options = task.options
        output_path = options.get('output_path', f"{file_path}.decompressed")
        
        # Update progress
        task.progress = 0.1
        
        # Decompress file
        success = compressor.decompress_file(file_path, output_path)
        
        if not success:
            raise Exception("Decompression failed")
        
        task.progress = 1.0
        
        return {
            "compressed_path": file_path,
            "decompressed_path": output_path,
            "size": os.path.getsize(output_path)
        }


class OptimizationStrategyImpl(OptimizationStrategy):
    """
    Strategy for optimizing files for performance and size reduction.
    """
    
    def execute(self, task: 'ProcessingTask', compressor: 'FileCompressor', 
                streamer: 'FileStreamer') -> Dict[str, Any]:
        """
        Execute file optimization operation.
        
        Args:
            task: ProcessingTask with optimization options
            compressor: FileCompressor instance
            streamer: FileStreamer instance
            
        Returns:
            Dict containing optimization results
            
        Raises:
            Exception: If optimization fails
        """
        file_path = task.file_path
        options = task.options
        
        # Update progress
        task.progress = 0.1
        
        # Analyze file for optimization opportunities
        file_size = os.path.getsize(file_path)
        
        # Apply optimizations based on file type
        optimization_applied = []
        
        # Example: Compress if it's a text file
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type and mime_type.startswith('text/'):
            output_path = f"{file_path}.optimized"
            if compressor.compress_file(file_path, output_path, 'gzip'):
                optimization_applied.append('gzip_compression')
        
        task.progress = 0.8
        
        # Calculate optimization metrics
        optimized_size = os.path.getsize(file_path) if not optimization_applied else os.path.getsize(output_path)
        
        task.progress = 1.0
        
        return {
            "original_path": file_path,
            "optimized_path": output_path if optimization_applied else file_path,
            "original_size": file_size,
            "optimized_size": optimized_size,
            "optimizations_applied": optimization_applied,
            "mime_type": mime_type
        }


class AnalysisStrategy(OptimizationStrategy):
    """
    Strategy for analyzing files to determine optimization opportunities.
    """
    
    def execute(self, task: 'ProcessingTask', compressor: 'FileCompressor', 
                streamer: 'FileStreamer') -> Dict[str, Any]:
        """
        Execute file analysis operation.
        
        Args:
            task: ProcessingTask with analysis options
            compressor: FileCompressor instance
            streamer: FileStreamer instance
            
        Returns:
            Dict containing analysis results including file info and recommendations
            
        Raises:
            Exception: If analysis fails
        """
        file_path = task.file_path
        
        # Update progress
        task.progress = 0.1
        
        # Get file information
        file_size = os.path.getsize(file_path)
        mime_type, _ = mimetypes.guess_type(file_path)
        
        task.progress = 0.5
        
        # Analyze optimization opportunities
        recommendations = []
        
        if file_size > 10 * 1024 * 1024:  # > 10MB
            recommendations.append({
                "type": "compression",
                "reason": "Large file size",
                "potential_savings": "30-50%"
            })
        
        if mime_type and mime_type.startswith('text/'):
            recommendations.append({
                "type": "gzip_compression",
                "reason": "Text file compressible",
                "potential_savings": "60-80%"
            })
        
        task.progress = 1.0
        
        return {
            "file_path": file_path,
            "file_size": file_size,
            "mime_type": mime_type,
            "recommendations": recommendations,
            "optimization_potential": len(recommendations) > 0
        }


class StrategyContext:
    """
    Context class that manages and executes optimization strategies.
    
    This class maintains a registry of available strategies and delegates
    task execution to the appropriate strategy based on the operation type.
    """
    
    def __init__(self):
        """
        Initialize the strategy context with default strategies.
        """
        self._strategies: Dict[str, OptimizationStrategy] = {
            'compress': CompressionStrategy(),
            'decompress': DecompressionStrategy(),
            'optimize': OptimizationStrategyImpl(),
            'analyze': AnalysisStrategy()
        }
    
    def register_strategy(self, operation: str, strategy: OptimizationStrategy) -> None:
        """
        Register a new strategy for a specific operation type.
        
        Args:
            operation: The operation type (e.g., 'compress', 'optimize')
            strategy: The strategy instance to register
        """
        self._strategies[operation] = strategy
    
    def get_strategy(self, operation: str) -> Optional[OptimizationStrategy]:
        """
        Get the strategy for a specific operation type.
        
        Args:
            operation: The operation type
            
        Returns:
            The strategy instance if found, None otherwise
        """
        return self._strategies.get(operation)
    
    def execute_strategy(self, task: 'ProcessingTask', compressor: 'FileCompressor', 
                        streamer: 'FileStreamer') -> Dict[str, Any]:
        """
        Execute the appropriate strategy for a given task.
        
        Args:
            task: The ProcessingTask to execute
            compressor: FileCompressor instance
            streamer: FileStreamer instance
            
        Returns:
            Dictionary containing the result of the operation
            
        Raises:
            ValueError: If no strategy is registered for the operation type
            Exception: If the strategy execution fails
        """
        strategy = self.get_strategy(task.operation)
        
        if strategy is None:
            raise ValueError(f"No strategy registered for operation: {task.operation}")
        
        return strategy.execute(task, compressor, streamer)


# Test the strategy pattern
if __name__ == "__main__":
    print("Testing Strategy Pattern Implementation...")
    
    # Create context
    context = StrategyContext()
    
    # Test strategy registration
    print("[PASS] Strategy context initialized with default strategies")
    
    # Test get_strategy
    compress_strategy = context.get_strategy('compress')
    assert compress_strategy is not None
    print("[PASS] Can retrieve compression strategy")
    
    decompress_strategy = context.get_strategy('decompress')
    assert decompress_strategy is not None
    print("[PASS] Can retrieve decompression strategy")
    
    optimize_strategy = context.get_strategy('optimize')
    assert optimize_strategy is not None
    print("[PASS] Can retrieve optimization strategy")
    
    analyze_strategy = context.get_strategy('analyze')
    assert analyze_strategy is not None
    print("[PASS] Can retrieve analysis strategy")
    
    # Test custom strategy registration
    class CustomStrategy(OptimizationStrategy):
        def execute(self, task, compressor, streamer):
            return {"custom": True}
    
    context.register_strategy('custom', CustomStrategy())
    custom_strategy = context.get_strategy('custom')
    assert custom_strategy is not None
    print("[PASS] Can register and retrieve custom strategy")
    
    # Test that abstract class cannot be instantiated
    try:
        OptimizationStrategy()
        print("[FAIL] Should not be able to instantiate abstract class")
    except TypeError:
        print("[PASS] Abstract class cannot be instantiated")
    
    print("\nAll strategy pattern tests passed!")
