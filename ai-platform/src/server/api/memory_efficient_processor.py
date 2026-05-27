#!/usr/bin/env python3

"""
Memory-Efficient Data Processing Module

Provides utilities for processing large datasets with minimal memory usage:
- Generator-based processing for large files
- Chunked data processing
- Memory profiling and optimization
- Streaming data processing
- Lazy evaluation techniques
"""

import gc
import logging
from typing import Any, Iterator, List, Dict, Callable, Optional, Union
from functools import wraps
import sys
import tracemalloc

logger = logging.getLogger(__name__)


class MemoryProfiler:
    """Context manager for profiling memory usage of code blocks"""
    
    def __init__(self, description: str = "Memory Profile"):
        self.description = description
        self.snapshot_before = None
        self.snapshot_after = None
        
    def __enter__(self):
        tracemalloc.start()
        self.snapshot_before = tracemalloc.take_snapshot()
        logger.info(f"Memory profiling started: {self.description}")
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.snapshot_after = tracemalloc.take_snapshot()
        tracemalloc.stop()
        
        if self.snapshot_before and self.snapshot_after:
            top_stats = self.snapshot_after.compare_to(self.snapshot_before, 'lineno')
            
            total_diff = sum(stat.size_diff for stat in top_stats)
            total_diff_mb = total_diff / (1024 * 1024)
            
            logger.info(f"Memory profiling completed: {self.description}")
            logger.info(f"Total memory change: {total_diff_mb:.2f} MB")
            
            # Log top 5 memory allocations
            for index, stat in enumerate(top_stats[:5], 1):
                logger.info(f"  {index}. {stat}")
                
        return False


def chunked_iterator(data: List[Any], chunk_size: int = 1000) -> Iterator[List[Any]]:
    """
    Split large list into chunks for memory-efficient processing
    
    Args:
        data: Large list to process
        chunk_size: Size of each chunk
        
    Yields:
        Chunks of the original data
    """
    for i in range(0, len(data), chunk_size):
        yield data[i:i + chunk_size]
        # Optional: Force garbage collection after each chunk
        if i % (chunk_size * 10) == 0:
            gc.collect()


def process_in_chunks(
    data: List[Any],
    process_func: Callable[[List[Any]], Any],
    chunk_size: int = 1000,
    combine_func: Optional[Callable[[List[Any]], Any]] = None
) -> Any:
    """
    Process large dataset in chunks to reduce memory usage
    
    Args:
        data: Large dataset to process
        process_func: Function to process each chunk
        chunk_size: Size of each chunk
        combine_func: Optional function to combine chunk results
        
    Returns:
        Processed results (combined if combine_func provided, otherwise list of chunk results)
    """
    results = []
    
    for chunk in chunked_iterator(data, chunk_size):
        chunk_result = process_func(chunk)
        results.append(chunk_result)
        
        # Force garbage collection periodically
        gc.collect()
    
    if combine_func:
        return combine_func(results)
    return results


def lazy_file_reader(file_path: str, chunk_size: int = 8192) -> Iterator[str]:
    """
    Read large files in chunks to minimize memory usage
    
    Args:
        file_path: Path to file to read
        chunk_size: Size of each chunk in bytes
        
    Yields:
        Chunks of file content
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        while True:
            chunk = file.read(chunk_size)
            if not chunk:
                break
            yield chunk


def stream_json_objects(file_path: str) -> Iterator[Dict[str, Any]]:
    """
    Stream JSON objects from a file (one JSON object per line)
    
    Args:
        file_path: Path to JSON lines file
        
    Yields:
        Parsed JSON objects
    """
    import json
    
    for line in lazy_file_reader(file_path):
        try:
            yield json.loads(line.strip())
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON line: {e}")
            continue


def memory_efficient_map(
    data: Iterator[Any],
    map_func: Callable[[Any], Any],
    batch_size: int = 1000
) -> Iterator[Any]:
    """
    Memory-efficient map operation using generators
    
    Args:
        data: Iterator of data to process
        map_func: Function to apply to each item
        batch_size: Number of items to process before yielding
        
    Yields:
        Mapped results
    """
    batch = []
    for item in data:
        batch.append(map_func(item))
        if len(batch) >= batch_size:
            yield from batch
            batch = []
            gc.collect()
    
    # Yield remaining items
    if batch:
        yield from batch


def memory_efficient_filter(
    data: Iterator[Any],
    filter_func: Callable[[Any], bool],
    batch_size: int = 1000
) -> Iterator[Any]:
    """
    Memory-efficient filter operation using generators
    
    Args:
        data: Iterator of data to filter
        filter_func: Function to determine if item should be included
        batch_size: Number of items to process before yielding
        
    Yields:
        Filtered results
    """
    batch = []
    for item in data:
        if filter_func(item):
            batch.append(item)
            if len(batch) >= batch_size:
                yield from batch
                batch = []
                gc.collect()
    
    # Yield remaining items
    if batch:
        yield from batch


def optimize_memory_usage(func: Callable) -> Callable:
    """
    Decorator to optimize memory usage of functions
    
    - Forces garbage collection before and after function execution
    - Profiles memory usage if logging level is DEBUG
    - Catches and logs memory-related errors
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Force garbage collection before execution
        gc.collect()
        
        # Profile memory if debug logging is enabled
        if logger.isEnabledFor(logging.DEBUG):
            with MemoryProfiler(f"Function: {func.__name__}"):
                try:
                    result = func(*args, **kwargs)
                except MemoryError as e:
                    logger.error(f"Memory error in {func.__name__}: {e}")
                    raise
        else:
            try:
                result = func(*args, **kwargs)
            except MemoryError as e:
                logger.error(f"Memory error in {func.__name__}: {e}")
                raise
        
        # Force garbage collection after execution
        gc.collect()
        
        return result
    
    return wrapper


def get_memory_usage() -> Dict[str, float]:
    """
    Get current memory usage statistics
    
    Returns:
        Dictionary with memory usage in MB
    """
    import psutil
    import os
    
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    
    return {
        'rss_mb': mem_info.rss / (1024 * 1024),
        'vms_mb': mem_info.vms / (1024 * 1024),
        'percent': process.memory_percent(),
        'available_mb': psutil.virtual_memory().available / (1024 * 1024)
    }


def log_memory_usage(description: str = "Memory Usage") -> None:
    """Log current memory usage statistics"""
    mem_stats = get_memory_usage()
    logger.info(
        f"{description}: "
        f"RSS: {mem_stats['rss_mb']:.2f} MB, "
        f"VMS: {mem_stats['vms_mb']:.2f} MB, "
        f"Percent: {mem_stats['percent']:.2f}%, "
        f"Available: {mem_stats['available_mb']:.2f} MB"
    )


def memory_efficient_sort(
    data: List[Any],
    key_func: Optional[Callable[[Any], Any]] = None,
    chunk_size: int = 10000
) -> List[Any]:
    """
    Memory-efficient sorting for large datasets using external sorting approach
    
    Args:
        data: Large list to sort
        key_func: Optional function to extract sort key
        chunk_size: Size of chunks for processing
        
    Returns:
        Sorted list
    """
    import heapq
    
    # If data is small enough, use regular sort
    if len(data) < chunk_size:
        return sorted(data, key=key_func)
    
    # Process in chunks using heap merge
    chunks = []
    for chunk in chunked_iterator(data, chunk_size):
        sorted_chunk = sorted(chunk, key=key_func)
        chunks.append(iter(sorted_chunk))
        gc.collect()
    
    # Merge sorted chunks using heapq
    if key_func:
        return list(heapq.merge(*chunks, key=key_func))
    return list(heapq.merge(*chunks))


def reduce_memory_footprint(obj: Any) -> Any:
    """
    Reduce memory footprint of Python objects
    
    - Converts floats to smallest possible dtype
    - Converts strings to more efficient representations
    - Removes unnecessary object attributes
    
    Args:
        obj: Object to optimize
        
    Returns:
        Memory-optimized version of the object
    """
    import pandas as pd
    import numpy as np
    
    if isinstance(obj, pd.DataFrame):
        # Optimize DataFrame memory usage
        for col in obj.columns:
            col_type = obj[col].dtype
            
            if col_type == 'object':
                # Try to convert to categorical if unique values < 50% of total
                unique_count = obj[col].nunique()
                if unique_count / len(obj[col]) < 0.5:
                    obj[col] = obj[col].astype('category')
            elif col_type == 'float64':
                # Try to downcast to float32
                obj[col] = obj[col].astype('float32')
            elif col_type == 'int64':
                # Try to downcast to smallest integer type
                obj[col] = pd.to_numeric(obj[col], downcast='integer')
        
        return obj
    
    elif isinstance(obj, dict):
        # Optimize dictionary
        return {k: reduce_memory_footprint(v) for k, v in obj.items()}
    
    elif isinstance(obj, list):
        # Optimize list
        return [reduce_memory_footprint(item) for item in obj]
    
    return obj


class MemoryEfficientDataFrame:
    """
    Wrapper for pandas DataFrame with memory-efficient operations
    
    Automatically applies memory optimization and provides chunked processing
    """
    
    def __init__(self, df, chunk_size: int = 10000):
        self.df = reduce_memory_footprint(df)
        self.chunk_size = chunk_size
        
    def process_chunks(self, process_func: Callable) -> Any:
        """Process DataFrame in chunks"""
        results = []
        for i in range(0, len(self.df), self.chunk_size):
            chunk = self.df.iloc[i:i + self.chunk_size]
            results.append(process_func(chunk))
            gc.collect()
        return results
    
    def get_memory_usage(self) -> Dict[str, float]:
        """Get DataFrame memory usage"""
        mem_usage = self.df.memory_usage(deep=True)
        return {
            'total_mb': mem_usage.sum() / (1024 * 1024),
            'per_column_mb': {col: usage / (1024 * 1024) 
                             for col, usage in mem_usage.items()}
        }