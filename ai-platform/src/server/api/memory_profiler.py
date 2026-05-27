#!/usr/bin/env python3


"""


Memory Profiler for Python Applications


Provides memory usage tracking and optimization suggestions


"""


import gc


import psutil


import logging


import time


from typing import Dict, List, Any, Optional


from functools import wraps


import sys


logger = logging.getLogger(__name__)


class MemoryProfiler:


    """Memory usage profiler for monitoring and optimization"""


    def __init__(self, enable_tracking: boolean = True):


        """


        Initialize memory profiler


        Args:


            enable_tracking: Whether to enable automatic memory tracking


        """


        self.enable_tracking = enable_tracking


        self.process = psutil.Process()


        self.baseline_memory = self.get_memory_usage()


        self.peak_memory = self.baseline_memory


        self.memory_history: List[Dict[str, Any]] = []


    def get_memory_usage(self) -> Dict[str, float]:


        """


        Get current memory usage statistics


        Returns:


            Dictionary with memory metrics in MB


        """


        try:


            memory_info = self.process.memory_info()


            return {


                'rss': memory_info.rss / 1024 / 1024,  # Resident Set Size


                'vms': memory_info.vms / 1024 / 1024,  # Virtual Memory Size


                'percent': self.process.memory_percent(),


                'available': psutil.virtual_memory().available / 1024 / 1024


            }


        except Exception as e:


            logger.error(f"Error getting memory usage: {e}")


            return {'rss': 0, 'vms': 0, 'percent': 0, 'available': 0}


    def track_memory(self, label: str = "") -> None:


        """


        Record current memory usage with a label


        Args:


            label: Label for this memory snapshot


        """


        if not self.enable_tracking:


            return


        current_memory = self.get_memory_usage()


        self.peak_memory = max(self.peak_memory, current_memory['rss'])


        snapshot = {


            'timestamp': time.time(),


            'label': label,


            'memory': current_memory,


            'delta': current_memory['rss'] - self.baseline_memory['rss']


        }


        self.memory_history.append(snapshot)


        logger.debug(f"Memory [{label}]: {current_memory['rss']:.2f}MB RSS, "


                    f"Delta: {snapshot['delta']:.2f}MB")


    def get_memory_report(self) -> Dict[str, Any]:


        """


        Generate memory usage report


        Returns:


            Dictionary with memory statistics and optimization suggestions


        """


        current_memory = self.get_memory_usage()


        memory_increase = current_memory['rss'] - self.baseline_memory['rss']


        # Calculate memory growth rate


        if len(self.memory_history) > 1:


            first_snapshot = self.memory_history[0]


            last_snapshot = self.memory_history[-1]


            time_elapsed = last_snapshot['timestamp'] - first_snapshot['timestamp']


            if time_elapsed > 0:


                growth_rate = (last_snapshot['memory']['rss'] - first_snapshot['memory']['rss']) / time_elapsed


            else:


                growth_rate = 0


        else:


            growth_rate = 0


        # Generate optimization suggestions


        suggestions = self._generate_optimization_suggestions(current_memory, memory_increase)


        return {


            'baseline_mb': self.baseline_memory['rss'],


            'current_mb': current_memory['rss'],


            'peak_mb': self.peak_memory,


            'increase_mb': memory_increase,


            'increase_percent': (memory_increase / self.baseline_memory['rss'] * 100) if self.baseline_memory['rss'] > 0 else 0,


            'growth_rate_mb_per_sec': growth_rate,


            'available_mb': current_memory['available'],


            'memory_percent': current_memory['percent'],


            'suggestions': suggestions,


            'snapshot_count': len(self.memory_history)


        }


    def _generate_optimization_suggestions(self, current_memory: Dict[str, float],


                                          memory_increase: float) -> List[str]:


        """Generate memory optimization suggestions based on current state"""


        suggestions = []


        if current_memory['percent'] > 80:


            suggestions.append("High memory usage detected (>80%). Consider implementing memory limits.")


        if memory_increase > 100:  # Increased by more than 100MB


            suggestions.append("Significant memory growth detected. Review for memory leaks.")


        if current_memory['vms'] > current_memory['rss'] * 2:


            suggestions.append("High virtual memory usage. Check for memory fragmentation.")


        # Check for garbage collection opportunities


        collected = gc.collect()


        if collected > 1000:


            suggestions.append(f"Garbage collection freed {collected} objects. Consider more frequent GC.")


        return suggestions


    def force_garbage_collection(self) -> int:


        """


        Force Python garbage collection


        Returns:


            Number of objects collected


        """


        before_memory = self.get_memory_usage()


        collected = gc.collect()


        after_memory = self.get_memory_usage()


        freed_memory = before_memory['rss'] - after_memory['rss']


        logger.information(f"Garbage collection: {collected} objects freed, "


                   f"{freed_memory:.2f}MB released")


        return collected


    def clear_history(self) -> None:


        """Clear memory tracking history"""


        self.memory_history.clear()


        self.baseline_memory = self.get_memory_usage()


        self.peak_memory = self.baseline_memory


        logger.information("Memory tracking history cleared")


# Global memory profiler instance


memory_profiler = MemoryProfiler(enable_tracking = True)


def profile_memory(label: str = ""):


    """


    Decorator to profile memory usage of a function


    Args:


        label: Label for the memory profile


    """


    def decorator(func):


    """


    TODO: Add function documentation.


    """


        @wraps(func)


        def wrapper(*args, **kwargs):


    """


    TODO: Add function documentation.


    """


            memory_profiler.track_memory(f"{label or func.__name__}_start")


            result_data = func(*args, **kwargs)


            memory_profiler.track_memory(f"{label or func.__name__}_end")


            return result_data


        return wrapper


    return decorator


def get_memory_report() -> Dict[str, Any]:


    """Get current memory report"""


    return memory_profiler.get_memory_report()


def optimize_memory() -> Dict[str, Any]:


    """


    Perform memory optimization actions


    Returns:


        Dictionary with optimization results


    """


    before_memory = memory_profiler.get_memory_usage()


    # Force garbage collection


    collected = memory_profiler.force_garbage_collection()


    after_memory = memory_profiler.get_memory_usage()


    freed_memory = before_memory['rss'] - after_memory['rss']


    return {


        'objects_collected': collected,


        'memory_freed_mb': freed_memory,


        'before_memory_mb': before_memory['rss'],


        'after_memory_mb': after_memory['rss']


    }


