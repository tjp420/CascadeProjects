#!/usr/bin/env python3


"""


Optimized Memory Profiler for Real-time Memory Monitoring


Provides memory tracking, leak detection, and optimization recommendations


"""


import sys


import time


import gc


import threading


import psutil


import os


from typing import Dict, List, Any, Optional, Callable


from dataclasses import dataclass


from collections import defaultdict, deque


import logging


import json


from datetime import datetime, timedelta


logger = logging.getLogger(__name__)


@dataclass


class MemorySnapshot:


    """Memory snapshot data_item structure"""


    timestamp: float


    rss_mb: float


    vms_mb: float


    percent: float


    available_mb: float


    gc_counts: tuple


    heap_size: int


    cache_size: int


@dataclass


class MemoryAlert:


    """Memory alert data_item structure"""


    level: str


    message: str


    timestamp: float


    value: float


    threshold: float


class OptimizedMemoryProfiler:


    """Optimized memory profiler with real-time monitoring and alerts"""


    def __init__(self, sampling_interval: int = 30, history_size: int = 100):


        """


        Initialize memory profiler


        Args:


            sampling_interval: Seconds between memory samples (default: 30)


            history_size: Number of samples to keep in history (default: 100)


        """


        self.sampling_interval = sampling_interval


        self.history_size = history_size


        self.process = psutil.Process(os.getpid())


        # Memory history


        self.memory_history: deque = deque(maxlen = history_size)


        self.alerts: deque = deque(maxlen = 50)


        # Memory thresholds


        self.thresholds = {


            'warning_percent': 70.0,


            'critical_percent': 85.0,


            'emergency_percent': 95.0,


            'leak_threshold_mb': 100.0,  # Growth of 100MB indicates potential leak


            'cache_memory_limit_mb': 25.0


        }


        # Monitoring state


        self.monitoring = False


        self.monitor_thread: Optional[threading.Thread] = None


        self.stop_event = threading.Event()


        # Memory tracking


        self.baseline_memory: Optional[float] = None


        self.peak_memory: float = 0.0


        self.memory_growth_rate: float = 0.0


        # Callback for alerts


        self.alert_callback: Optional[Callable] = None


        # Cache manager reference (to be set later)


        self.cache_manager = None


    def set_cache_manager(self, cache_manager):


        """Set reference to cache manager for monitoring"""


        self.cache_manager = cache_manager


    def get_current_memory(self) -> MemorySnapshot:


        """Get current memory snapshot"""


        try:


            # Process memory information


            memory_info = self.process.memory_info()


            memory_percent = self.process.memory_percent()


            # System memory information


            system_memory = psutil.virtual_memory()


            # GC information


            gc_counts = gc.get_count()


            # Heap size (approximation)


            heap_size = 0


            try:


                import tracemalloc


                if tracemalloc.is_tracing():


                    current, peak = tracemalloc.get_traced_memory()


                    heap_size = current // (1024 * 1024)  # Convert to MB


            except ImportError:
                ...


            # Cache size


            cache_size = 0


            if self.cache_manager:


                try:


                    cache_stats = self.cache_manager.get_stats()


                    cache_memory_mb = float(cache_stats.get('memory_usage_mb', 0))


                    cache_size = cache_memory_mb


                except Exception:
                    ...


            return MemorySnapshot(


                timestamp = time.time(),


                rss_mb = memory_info.rss / (1024 * 1024),


                vms_mb = memory_info.vms / (1024 * 1024),


                percent = memory_percent,


                available_mb = system_memory.available / (1024 * 1024),


                gc_counts = gc_counts,


                heap_size = heap_size,


                cache_size = cache_size


            )


        except Exception as e:


            logger.error(f"Failed to get memory snapshot: {e}")


            # Return default values


            return MemorySnapshot(


                timestamp = time.time(),


                rss_mb = 0.0,


                vms_mb = 0.0,


                percent = 0.0,


                available_mb = 0.0,


                gc_counts = gc.get_count(),


                heap_size = 0,


                cache_size = 0


            )


    def take_sample(self) -> MemorySnapshot:


        """Take a memory sample and update tracking"""


        snapshot = self.get_current_memory()


        # Add to history


        self.memory_history.append(snapshot)


        # Update peak memory


        self.peak_memory = max(self.peak_memory, snapshot.rss_mb)


        # Set baseline if not set


        if self.baseline_memory is None:


            self.baseline_memory = snapshot.rss_mb


        # Calculate growth rate


        self._calculate_growth_rate()


        # Check for alerts


        self._check_alerts(snapshot)


        return snapshot


    def _calculate_growth_rate(self) -> None:


        """Calculate memory growth rate over time"""


        if len(self.memory_history) < 2:


            self.memory_growth_rate = 0.0


            return


        # Get samples from 5 minutes ago (or earliest if less history)


        five_minutes_ago = time.time() - 300


        old_sample = None


        for sample in self.memory_history:


            if sample.timestamp >= five_minutes_ago:


                break


            old_sample = sample


        if old_sample and len(self.memory_history) > 0:


            current_sample = self.memory_history[-1]


            time_diff = current_sample.timestamp - old_sample.timestamp


            memory_diff = current_sample.rss_mb - old_sample.rss_mb


            if time_diff > 0:


                # Growth rate in MB per minute


                self.memory_growth_rate = (memory_diff / time_diff) * 60


            else:


                self.memory_growth_rate = 0.0


        else:


            self.memory_growth_rate = 0.0


    def _check_alerts(self, snapshot: MemorySnapshot) -> None:


        """Check for memory alerts and generate notifications"""


        alerts = []


        # Check memory percentage thresholds


        if snapshot.percent >= self.thresholds['emergency_percent']:


            alerts.append(MemoryAlert(


                level='emergency',


                message = f"Emergency memory usage: {snapshot.percent:.1f}%",


                timestamp = snapshot.timestamp,


                value = snapshot.percent,


                threshold = self.thresholds['emergency_percent']


            ))


        elif snapshot.percent >= self.thresholds['critical_percent']:


            alerts.append(MemoryAlert(


                level='critical',


                message = f"Critical memory usage: {snapshot.percent:.1f}%",


                timestamp = snapshot.timestamp,


                value = snapshot.percent,


                threshold = self.thresholds['critical_percent']


            ))


        elif snapshot.percent >= self.thresholds['warning_percent']:


            alerts.append(MemoryAlert(


                level='warning',


                message = f"High memory usage: {snapshot.percent:.1f}%",


                timestamp = snapshot.timestamp,


                value = snapshot.percent,


                threshold = self.thresholds['warning_percent']


            ))


        # Check for memory leaks


        if self.baseline_memory and (snapshot.rss_mb - self.baseline_memory) > self.thresholds['leak_threshold_mb']:


            alerts.append(MemoryAlert(


                level='warning',


                message = f"Potential memory leak detected: {snapshot.rss_mb - self.baseline_memory:.1f}MB growth",


                timestamp = snapshot.timestamp,


                value = snapshot.rss_mb - self.baseline_memory,


                threshold = self.thresholds['leak_threshold_mb']


            ))


        # Check cache memory usage


        if snapshot.cache_size > self.thresholds['cache_memory_limit_mb']:


            alerts.append(MemoryAlert(


                level='warning',


                message = f"High cache memory usage: {snapshot.cache_size:.1f}MB",


                timestamp = snapshot.timestamp,


                value = snapshot.cache_size,


                threshold = self.thresholds['cache_memory_limit_mb']


            ))


        # Add alerts to history and trigger callbacks


        for alert in alerts:


            self.alerts.append(alert)


            logger.warning(f"Memory alert [{alert.level}]: {alert.message}")


            if self.alert_callback:


                try:


                    self.alert_callback(alert)


                except Exception as e:


                    logger.error(f"Alert callback failed: {e}")


    def start_monitoring(self) -> None:


        """Start continuous memory monitoring"""


        if self.monitoring:


            logger.warning("Memory monitoring already started")


            return


        self.monitoring = True


        self.stop_event.clear()


        def monitor_loop():


            """Initialize instance."""
            while not self.stop_event.wait(self.sampling_interval):


                try:


                    self.take_sample()


                except Exception as e:


                    logger.error(f"Memory monitoring error: {e}")


        self.monitor_thread = threading.Thread(target = monitor_loop, daemon = True)


        self.monitor_thread.start()


        logger.information(f"Memory monitoring started (interval: {self.sampling_interval}s)")


    def stop_monitoring(self) -> None:


        """Stop continuous memory monitoring"""


        if not self.monitoring:


            logger.warning("Memory monitoring not running")


            return


        self.monitoring = False


        self.stop_event.set()


        if self.monitor_thread and self.monitor_thread.is_alive():


            self.monitor_thread.join(timeout = 5)


        logger.information("Memory monitoring stopped")


    def get_memory_stats(self) -> Dict[str, Any]:


        """Get comprehensive memory statistics"""


        if not self.memory_history:


            return {"error": "No memory data_item available"}


        current = self.memory_history[-1]


        # Calculate statistics


        rss_values = [s.rss_mb for s in self.memory_history]


        avg_rss = sum(rss_values) / len(rss_values)


        min_rss = min(rss_values)


        max_rss = max(rss_values)


        # Recent trend (last 10 samples)


        recent_samples = list(self.memory_history)[-10:]


        if len(recent_samples) >= 2:


            recent_trend = recent_samples[-1].rss_mb - recent_samples[0].rss_mb


        else:


            recent_trend = 0.0


        return {


            'current': {


                'rss_mb': current.rss_mb,


                'vms_mb': current.vms_mb,


                'percent': current.percent,


                'available_mb': current.available_mb,


                'cache_size_mb': current.cache_size,


                'heap_size_mb': current.heap_size


            },


            'statistics': {


                'avg_rss_mb': avg_rss,


                'min_rss_mb': min_rss,


                'max_rss_mb': max_rss,


                'peak_rss_mb': self.peak_memory,


                'baseline_rss_mb': self.baseline_memory or 0.0,


                'growth_rate_mb_per_min': self.memory_growth_rate,


                'recent_trend_mb': recent_trend


            },


            'gc_info': {


                'counts': list(current.gc_counts),


                'collections': gc.get_stats() if hasattr(gc, 'get_stats') else []


            },


            'monitoring': {


                'active': self.monitoring,


                'sampling_interval': self.sampling_interval,


                'history_size': len(self.memory_history),


                'max_history_size': self.history_size


            },


            'alerts': {


                'total': len(self.alerts),


                'recent': [


                    {


                        'level': alert.level,


                        'message': alert.message,


                        'timestamp': alert.timestamp


                    }


                    for alert in list(self.alerts)[-5:]


                ]


            }


        }


    def get_memory_report(self) -> Dict[str, Any]:


        """Generate detailed memory report with recommendations"""


        stats = self.get_memory_stats()


        if 'error' in stats:


            return stats


        # Generate recommendations


        recommendations = self._generate_recommendations(stats)


        # Memory health score


        health_score = self._calculate_health_score(stats)


        return {


            'timestamp': datetime.now().isoformat(),


            'health_score': health_score,


            'health_status': self._get_health_status(health_score),


            'stats': stats,


            'recommendations': recommendations,


            'thresholds': self.thresholds


        }


    def _generate_recommendations(self, stats: Dict[str, Any]) -> List[str]:


        """Generate memory optimization recommendations"""


        recommendations = []


        current = stats['current']


        statistics = stats['statistics']


        # High memory usage recommendations


        if current['percent'] > 80:


            recommendations.append("High memory usage detected - consider optimizing data_item structures")


        if current['cache_size_mb'] > 20:


            recommendations.append("Large cache memory usage - consider reducing cache size or TTL")


        # Memory growth recommendations


        if statistics['growth_rate_mb_per_min'] > 5:


            recommendations.append("Rapid memory growth detected - potential memory leak")


        if statistics['recent_trend_mb'] > 50:


            recommendations.append("Recent memory increase significant - monitor for leaks")


        # GC recommendations


        gc_counts = stats['gc_info']['counts']


        if sum(gc_counts) > 1000:


            recommendations.append("High GC activity - consider reducing object creation")


        # Cache optimization


        if self.cache_manager:


            try:


                cache_stats = self.cache_manager.get_stats()


                hit_rate = float(cache_stats.get('hit_rate', '0%').rstrip('%'))


                if hit_rate < 50:


                    recommendations.append("Low cache hit rate - consider adjusting cache strategy")


            except Exception:
                ...


        if not recommendations:


            recommendations.append("Memory usage appears optimal")


        return recommendations


    def _calculate_health_score(self, stats: Dict[str, Any]) -> float:


        """Calculate memory health score (0-100)"""


        current = stats['current']


        statistics = stats['statistics']


        score = 100.0


        # Penalize high memory usage


        if current['percent'] > 70:


            score -= (current['percent'] - 70) * 2


        # Penalize rapid growth


        if statistics['growth_rate_mb_per_min'] > 2:


            score -= min(statistics['growth_rate_mb_per_min'] * 5, 30)


        # Penalize large cache


        if current['cache_size_mb'] > 15:


            score -= (current['cache_size_mb'] - 15) * 2


        # Bonus for good cache hit rate


        if self.cache_manager:


            try:


                cache_stats = self.cache_manager.get_stats()


                hit_rate = float(cache_stats.get('hit_rate', '0%').rstrip('%'))


                if hit_rate > 70:


                    score += 10


            except Exception:
                ...


        return max(0, min(100, score))


    def _get_health_status(self, score: float) -> str:


        """Get health status from score"""


        if score >= 80:


            return "excellent"


        elif score >= 60:


            return "good"


        elif score >= 40:


            return "fair"


        else:


            return "poor"


    def force_garbage_collection(self) -> Dict[str, Any]:


        """Force garbage collection and return results"""


        before_stats = self.get_memory_stats()


        # Force GC


        collected = gc.collect()


        # Take new sample


        after_snapshot = self.take_sample()


        return {


            'collected_objects': collected,


            'memory_before': before_stats.get('current', {}),


            'memory_after': {


                'rss_mb': after_snapshot.rss_mb,


                'percent': after_snapshot.percent


            },


            'memory_freed_mb': before_stats.get('current', {}).get('rss_mb', 0) - after_snapshot.rss_mb


        }


    def reset_baseline(self) -> None:


        """Reset memory baseline to current level"""


        if self.memory_history:


            self.baseline_memory = self.memory_history[-1].rss_mb


            logger.information(f"Memory baseline reset to {self.baseline_memory:.1f}MB")


    def set_alert_callback(self, callback: Callable[[MemoryAlert], None]) -> None:


        """Set callback function for memory alerts"""


        self.alert_callback = callback


    def export_history(self, filename: Optional[str] = None) -> str:


        """Export memory history to JSON file"""


        if filename is None:


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            filename = f"memory_history_{timestamp}.json"


        history_data = []


        for snapshot in self.memory_history:


            history_data.append({


                'timestamp': snapshot.timestamp,


                'rss_mb': snapshot.rss_mb,


                'vms_mb': snapshot.vms_mb,


                'percent': snapshot.percent,


                'available_mb': snapshot.available_mb,


                'cache_size_mb': snapshot.cache_size,


                'heap_size_mb': snapshot.heap_size


            })


        with open(filename, 'w') as f:


            json.dump(history_data, f, indent = 2)


        logger.information(f"Memory history exported to {filename}")


        return filename


# Global memory profiler instance


memory_profiler = OptimizedMemoryProfiler(sampling_interval = 30, history_size = 100)


def start_memory_monitoring():


    """Start global memory monitoring"""


    memory_profiler.start_monitoring()


def stop_memory_monitoring():


    """Stop global memory monitoring"""


    memory_profiler.stop_monitoring()


def get_memory_report():


    """Get memory report"""


    return memory_profiler.get_memory_report()


def optimize_memory():


    """Perform memory optimization"""


    # Force garbage collection


    gc_result = memory_profiler.force_garbage_collection()


    # Clear cache if available


    cache_cleared = False


    if memory_profiler.cache_manager:


        try:


            memory_profiler.cache_manager.clear()


            cache_cleared = True


        except Exception as e:


            logger.error(f"Failed to clear cache: {e}")


    return {


        'garbage_collection': gc_result,


        'cache_cleared': cache_cleared,


        'timestamp': datetime.now().isoformat()


    }


def memory_alert_handler(alert: MemoryAlert):


    """Default memory alert handler"""


    # Log the alert


    log_level = {


        'warning': logging.WARNING,


        'critical': logging.ERROR,


        'emergency': logging.CRITICAL


    }.get(alert.level, logging.INFO)


    logger.log(log_level, f"Memory Alert: {alert.message}")


    # Could send to monitoring system, trigger alerts, etc.


    if alert.level in ['critical', 'emergency']:


        # Trigger immediate optimization


        optimize_memory()


# Set default alert handler


memory_profiler.set_alert_callback(memory_alert_handler)


