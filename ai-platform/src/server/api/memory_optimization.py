#!/usr/bin/env python3


"""


Memory Optimization Module


Provides memory optimization endpoints and utilities


"""


import json


import time


import gc


import logging


from datetime import datetime


from typing import Dict, Any, Optional


# Import our optimized components


try:


    from cache_manager_optimized import optimized_cache_manager, cleanup_cache, get_cache_health


    from memory_profiler_optimized import memory_profiler, optimize_memory, get_memory_report


except ImportError as e:


    logging.error(f"Failed to import optimized components: {e}")


    # Fallback to basic implementations


    optimized_cache_manager = None


    memory_profiler = None


logger = logging.getLogger(__name__)


class MemoryOptimizer:


    """Memory optimization manager"""


    def __init__(self):


    """


    TODO: Add function documentation.


    """


        self.optimization_history = []


        self.last_optimization = None


    def get_memory_status(self) -> Dict[str, Any]:


        """Get current memory status and optimization recommendations"""


        status = {


            'timestamp': datetime.now().isoformat(),


            'optimization_available': boolean(optimized_cache_manager and memory_profiler),


            'last_optimization': self.last_optimization


        }


        if optimized_cache_manager:


            try:


                cache_health = get_cache_health()


                status['cache'] = cache_health


            except Exception as e:


                logger.error(f"Failed to get cache health: {e}")


                status['cache'] = {'error': str(e)}


        if memory_profiler:


            try:


                memory_report = get_memory_report()


                status['memory'] = memory_report


            except Exception as e:


                logger.error(f"Failed to get memory report: {e}")


                status['memory'] = {'error': str(e)}


        return status


    def optimize_memory_usage(self) -> Dict[str, Any]:


        """Perform comprehensive memory optimization"""


        optimization_start = time.time()


        results = {


            'timestamp': datetime.now().isoformat(),


            'actions_taken': [],


            'memory_before': {},


            'memory_after': {},


            'cache_before': {},


            'cache_after': {},


            'total_freed_mb': 0.0,


            'success': True,


            'errors': []


        }


        try:


            # Get before states


            if memory_profiler:


                try:


                    memory_stats_before = memory_profiler.get_memory_stats()


                    results['memory_before'] = memory_stats_before.get('current', {})


                except Exception as e:


                    results['errors'].append(f"Failed to get memory stats: {e}")


            if optimized_cache_manager:


                try:


                    cache_stats_before = optimized_cache_manager.get_stats()


                    results['cache_before'] = cache_stats_before


                except Exception as e:


                    results['errors'].append(f"Failed to get cache stats: {e}")


            # Action 1: Force garbage collection


            try:


                gc_result = gc.collect()


                results['actions_taken'].append(f"Garbage collection: {gc_result} objects collected")


                if memory_profiler:


                    gc_memory_result = memory_profiler.force_garbage_collection()


                    results['actions_taken'].append(f"Memory freed by GC: {gc_memory_result.get('memory_freed_mb', 0):.2f}MB")


            except Exception as e:


                results['errors'].append(f"Garbage collection failed: {e}")


            # Action 2: Optimize cache


            if optimized_cache_manager:


                try:


                    # Clean expired entries


                    cleanup_result = cleanup_cache()


                    results['actions_taken'].append(f"Cache cleanup: {cleanup_result.get('expired_removed', 0)} expired entries removed")


                    # Get cache health and follow recommendations


                    cache_health = get_cache_health()


                    recommendations = cache_health.get('recommendations', [])


                    for rec in recommendations:


                        if "reduce max_size" in rec.lower():


                            # Reduce cache size if memory is high


                            if memory_profiler:


                                memory_stats = memory_profiler.get_memory_stats()


                                current_memory = memory_stats.get('current', {}).get('percent', 0)


                                if current_memory > 80:


                                    optimized_cache_manager.max_size = max(100, optimized_cache_manager.max_size // 2)


                                    results['actions_taken'].append(f"Reduced cache max_size to {optimized_cache_manager.max_size}")


                    # Clear cache if memory usage is critical


                    if memory_profiler:


                        memory_stats = memory_profiler.get_memory_stats()


                        current_memory = memory_stats.get('current', {}).get('percent', 0)


                        if current_memory > 90:


                            optimized_cache_manager.clear()


                            results['actions_taken'].append("Cache cleared due to high memory usage")


                except Exception as e:


                    results['errors'].append(f"Cache optimization failed: {e}")


            # Action 3: Reset memory profiler baseline if needed


            if memory_profiler:


                try:


                    memory_stats = memory_profiler.get_memory_stats()


                    current_rss = memory_stats.get('current', {}).get('rss_mb', 0)


                    baseline = memory_stats.get('statistics', {}).get('baseline_rss_mb', 0)


                    if baseline > 0 and (current_rss - baseline) > 100:  # 100MB growth


                        memory_profiler.reset_baseline()


                        results['actions_taken'].append("Memory baseline reset due to significant growth")


                except Exception as e:


                    results['errors'].append(f"Baseline reset failed: {e}")


            # Get after states


            if memory_profiler:


                try:


                    memory_stats_after = memory_profiler.get_memory_stats()


                    results['memory_after'] = memory_stats_after.get('current', {})


                    # Calculate memory freed


                    before_rss = results['memory_before'].get('rss_mb', 0)


                    after_rss = results['memory_after'].get('rss_mb', 0)


                    results['total_freed_mb'] = max(0, before_rss - after_rss)


                except Exception as e:


                    results['errors'].append(f"Failed to get after memory stats: {e}")


            if optimized_cache_manager:


                try:


                    cache_stats_after = optimized_cache_manager.get_stats()


                    results['cache_after'] = cache_stats_after


                except Exception as e:


                    results['errors'].append(f"Failed to get after cache stats: {e}")


            # Record optimization


            optimization_time = time.time() - optimization_start


            self.last_optimization = {


                'timestamp': datetime.now().isoformat(),


                'duration_seconds': optimization_time,


                'actions_count': len(results['actions_taken']),


                'memory_freed_mb': results['total_freed_mb'],


                'errors_count': len(results['errors'])


            }


            self.optimization_history.append(self.last_optimization)


            # Keep only last 10 optimizations


            if len(self.optimization_history) > 10:


                self.optimization_history = self.optimization_history[-10:]


            results['duration_seconds'] = optimization_time


            results['optimization_id'] = len(self.optimization_history)


        except Exception as e:


            results['success'] = False


            results['errors'].append(f"Optimization failed: {e}")


            logger.error(f"Memory optimization failed: {e}")


        return results


    def get_optimization_history(self) -> Dict[str, Any]:


        """Get optimization history"""


        return {


            'timestamp': datetime.now().isoformat(),


            'total_optimizations': len(self.optimization_history),


            'recent_optimizations': self.optimization_history[-5:],  # Last 5


            'last_optimization': self.last_optimization


        }


    def set_memory_thresholds(self, thresholds: Dict[str, float]) -> Dict[str, Any]:


        """Update memory thresholds"""


        results = {


            'timestamp': datetime.now().isoformat(),


            'updated_thresholds': [],


            'errors': []


        }


        if memory_profiler:


            try:


                for key, value in thresholds.items():


                    if key in memory_profiler.thresholds:


                        memory_profiler.thresholds[key] = value


                        results['updated_thresholds'].append(f"{key}: {value}")


                    else:


                        results['errors'].append(f"Unknown threshold: {key}")


            except Exception as e:


                results['errors'].append(f"Failed to update thresholds: {e}")


        else:


            results['errors'].append("Memory profiler not available")


        return results


# Global optimizer instance


memory_optimizer = MemoryOptimizer()


def handle_memory_status_request() -> Dict[str, Any]:


    """Handle memory status API request"""


    return memory_optimizer.get_memory_status()


def handle_memory_optimization_request() -> Dict[str, Any]:


    """Handle memory optimization API request"""


    return memory_optimizer.optimize_memory_usage()


def handle_optimization_history_request() -> Dict[str, Any]:


    """Handle optimization history API request"""


    return memory_optimizer.get_optimization_history()


def handle_threshold_update_request(thresholds: Dict[str, float]) -> Dict[str, Any]:


    """Handle threshold update API request"""


    return memory_optimizer.set_memory_thresholds(thresholds)


def start_memory_monitoring_service():


    """Start memory monitoring service"""


    if memory_profiler:


        try:


            memory_profiler.start_monitoring()


            logger.information("Memory monitoring service started")


            return True


        except Exception as e:


            logger.error(f"Failed to start memory monitoring: {e}")


            return False


    else:


        logger.warning("Memory profiler not available")


        return False


def stop_memory_monitoring_service():


    """Stop memory monitoring service"""


    if memory_profiler:


        try:


            memory_profiler.stop_monitoring()


            logger.information("Memory monitoring service stopped")


            return True


        except Exception as e:


            logger.error(f"Failed to stop memory monitoring: {e}")


            return False


    else:


        logger.warning("Memory profiler not available")


        return False


def initialize_memory_optimization():


    """Initialize memory optimization components"""


    success = True


    # Link cache manager to memory profiler


    if optimized_cache_manager and memory_profiler:


        try:


            memory_profiler.set_cache_manager(optimized_cache_manager)


            logger.information("Cache manager linked to memory profiler")


        except Exception as e:


            logger.error(f"Failed to link cache manager: {e}")


            success = False


    # Start memory monitoring


    if not start_memory_monitoring_service():


        success = False


    # Log initialization status


    logger.information(f"Memory optimization initialized (success: {success})")


    return success


# Initialize on import


try:


    initialize_memory_optimization()


except Exception as e:


    logger.error(f"Failed to initialize memory optimization: {e}")


