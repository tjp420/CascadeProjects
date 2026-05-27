#!/usr/bin/env python3

"""
Enhanced Performance Monitoring Module

Extends the base performance monitoring with advanced features:
- Real-time performance dashboards
- Predictive performance analysis
- Automated performance regression detection
- Performance trend analysis
- Resource utilization forecasting
- Anomaly detection in performance metrics
"""

import time
import psutil
import json
import threading
import statistics
from datetime import datetime, timedelta
from collections import defaultdict, deque
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
import logging

logger = logging.getLogger(__name__)


class EnhancedPerformanceMonitor:
    """Enhanced performance monitoring with advanced analytics"""
    
    def __init__(self, history_size: int = 1000, anomaly_threshold: float = 2.0):
        """
        Initialize enhanced performance monitor
        
        Args:
            history_size: Maximum number of data points to keep
            anomaly_threshold: Standard deviations for anomaly detection
        """
        self.history_size = history_size
        self.anomaly_threshold = anomaly_threshold
        
        # Performance data storage
        self.metrics = defaultdict(lambda: deque(maxlen=history_size))
        
        # Baseline metrics for anomaly detection
        self.baselines = {}
        self.baseline_window = 100  # Number of points to establish baseline
        
        # Performance trends
        self.trends = defaultdict(dict)
        
        # Alert history
        self.alert_history = deque(maxlen=100)
        
        # Performance regression detection
        self.regression_threshold = 0.15  # 15% degradation threshold
        
        # Callbacks for alerts
        self.alert_callbacks = []
        
    def record_metric(self, metric_name: str, value: float, metadata: Optional[Dict] = None):
        """
        Record a performance metric with enhanced tracking
        
        Args:
            metric_name: Name of the metric
            value: Metric value
            metadata: Optional metadata about the measurement
        """
        timestamp = datetime.now()
        
        metric_data = {
            'timestamp': timestamp.isoformat(),
            'value': value,
            'metadata': metadata or {}
        }
        
        self.metrics[metric_name].append(metric_data)
        
        # Update baseline if we have enough data
        self._update_baseline(metric_name)
        
        # Check for anomalies
        self._detect_anomalies(metric_name, value, timestamp)
        
        # Update trend analysis
        self._update_trends(metric_name)
        
        # Check for performance regression
        self._detect_regression(metric_name, value)
        
    def _update_baseline(self, metric_name: str):
        """Update baseline statistics for anomaly detection"""
        metric_data = list(self.metrics[metric_name])
        
        if len(metric_data) >= self.baseline_window:
            recent_values = [m['value'] for m in metric_data[-self.baseline_window:]]
            
            self.baselines[metric_name] = {
                'mean': statistics.mean(recent_values),
                'stddev': statistics.stdev(recent_values) if len(recent_values) > 1 else 0,
                'median': statistics.median(recent_values),
                'min': min(recent_values),
                'max': max(recent_values),
                'updated': datetime.now().isoformat()
            }
    
    def _detect_anomalies(self, metric_name: str, value: float, timestamp: datetime):
        """Detect anomalies using statistical analysis"""
        if metric_name not in self.baselines:
            return
        
        baseline = self.baselines[metric_name]
        if baseline['stddev'] == 0:
            return
        
        z_score = abs(value - baseline['mean']) / baseline['stddev']
        
        if z_score > self.anomaly_threshold:
            alert = {
                'type': 'anomaly',
                'metric': metric_name,
                'value': value,
                'expected': baseline['mean'],
                'z_score': z_score,
                'timestamp': timestamp.isoformat(),
                'severity': 'high' if z_score > 3 else 'medium'
            }
            
            self.alert_history.append(alert)
            logger.warning(f"Performance anomaly detected: {alert}")
            
            # Trigger alert callbacks
            for callback in self.alert_callbacks:
                try:
                    callback(alert)
                except Exception as e:
                    logger.error(f"Alert callback failed: {e}")
    
    def _update_trends(self, metric_name: str):
        """Update trend analysis for metrics"""
        metric_data = list(self.metrics[metric_name])
        
        if len(metric_data) < 10:
            return
        
        # Calculate short-term and long-term trends
        recent_values = [m['value'] for m in metric_data[-10:]]
        older_values = [m['value'] for m in metric_data[-50:-10]] if len(metric_data) >= 50 else recent_values
        
        if recent_values and older_values:
            recent_avg = statistics.mean(recent_values)
            older_avg = statistics.mean(older_values)
            
            trend_direction = 'improving' if recent_avg < older_avg else 'degrading'
            trend_magnitude = abs((recent_avg - older_avg) / older_avg) * 100 if older_avg != 0 else 0
            
            self.trends[metric_name] = {
                'direction': trend_direction,
                'magnitude': trend_magnitude,
                'recent_avg': recent_avg,
                'older_avg': older_avg,
                'updated': datetime.now().isoformat()
            }
    
    def _detect_regression(self, metric_name: str, current_value: float):
        """Detect performance regression compared to baseline"""
        if metric_name not in self.baselines:
            return
        
        baseline = self.baselines[metric_name]
        
        # For metrics where lower is better (response time, memory usage)
        if 'time' in metric_name.lower() or 'memory' in metric_name.lower():
            if current_value > baseline['mean'] * (1 + self.regression_threshold):
                alert = {
                    'type': 'regression',
                    'metric': metric_name,
                    'current': current_value,
                    'baseline': baseline['mean'],
                    'degradation': ((current_value - baseline['mean']) / baseline['mean']) * 100,
                    'timestamp': datetime.now().isoformat(),
                    'severity': 'critical'
                }
                
                self.alert_history.append(alert)
                logger.error(f"Performance regression detected: {alert}")
        
        # For metrics where higher is better (throughput, success rate)
        else:
            if current_value < baseline['mean'] * (1 - self.regression_threshold):
                alert = {
                    'type': 'regression',
                    'metric': metric_name,
                    'current': current_value,
                    'baseline': baseline['mean'],
                    'degradation': ((baseline['mean'] - current_value) / baseline['mean']) * 100,
                    'timestamp': datetime.now().isoformat(),
                    'severity': 'critical'
                }
                
                self.alert_history.append(alert)
                logger.error(f"Performance regression detected: {alert}")
    
    def add_alert_callback(self, callback: Callable[[Dict], None]):
        """Add callback function for performance alerts"""
        self.alert_callbacks.append(callback)
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        summary = {
            'timestamp': datetime.now().isoformat(),
            'metrics': {},
            'baselines': self.baselines,
            'trends': dict(self.trends),
            'recent_alerts': list(self.alert_history)[-10:],
            'total_alerts': len(self.alert_history)
        }
        
        # Add metric summaries
        for metric_name, data in self.metrics.items():
            if len(data) > 0:
                values = [m['value'] for m in data]
                summary['metrics'][metric_name] = {
                    'current': values[-1],
                    'average': statistics.mean(values),
                    'min': min(values),
                    'max': max(values),
                    'count': len(values),
                    'trend': self.trends.get(metric_name, {}).get('direction', 'unknown')
                }
        
        return summary
    
    def predict_performance(self, metric_name: str, horizon_minutes: int = 30) -> Dict[str, Any]:
        """
        Predict performance metrics using simple linear regression
        
        Args:
            metric_name: Name of metric to predict
            horizon_minutes: Time horizon for prediction in minutes
            
        Returns:
            Prediction data with confidence intervals
        """
        if metric_name not in self.metrics or len(self.metrics[metric_name]) < 10:
            return {'error': 'Insufficient data for prediction'}
        
        data = list(self.metrics[metric_name])
        values = [m['value'] for m in data]
        timestamps = [datetime.fromisoformat(m['timestamp']) for m in data]
        
        # Simple linear regression
        n = len(values)
        x = range(n)
        
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(xi ** 2 for xi in x)
        
        # Calculate slope and intercept
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
        intercept = (sum_y - slope * sum_x) / n
        
        # Predict future value
        future_steps = int(horizon_minutes / 5)  # Assuming 5-minute intervals
        predicted_value = slope * (n + future_steps) + intercept
        
        # Calculate confidence interval (simplified)
        residuals = [values[i] - (slope * i + intercept) for i in range(n)]
        std_error = statistics.stdev(residuals) if len(residuals) > 1 else 0
        
        return {
            'metric': metric_name,
            'current_value': values[-1],
            'predicted_value': predicted_value,
            'change_percent': ((predicted_value - values[-1]) / values[-1]) * 100 if values[-1] != 0 else 0,
            'confidence_interval': {
                'lower': predicted_value - 1.96 * std_error,
                'upper': predicted_value + 1.96 * std_error
            },
            'horizon_minutes': horizon_minutes,
            'trend': 'improving' if slope < 0 else 'degrading',
            'timestamp': datetime.now().isoformat()
        }
    
    def get_resource_forecast(self, minutes_ahead: int = 60) -> Dict[str, Any]:
        """
        Forecast resource usage based on current trends
        
        Args:
            minutes_ahead: Time horizon for forecast
            
        Returns:
            Resource usage forecast
        """
        forecast = {
            'timestamp': datetime.now().isoformat(),
            'horizon_minutes': minutes_ahead,
            'resources': {}
        }
        
        # Get current resource usage
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        
        # Simple forecasting based on current trends
        forecast['resources']['cpu'] = {
            'current': cpu_percent,
            'predicted': cpu_percent,  # Could be enhanced with trend analysis
            'trend': 'stable'
        }
        
        forecast['resources']['memory'] = {
            'current': memory.percent,
            'predicted': memory.percent,
            'available_gb': memory.available / (1024**3),
            'trend': 'stable'
        }
        
        return forecast
    
    def export_metrics(self, file_path: str) -> None:
        """Export metrics to JSON file for analysis"""
        data = {
            'export_timestamp': datetime.now().isoformat(),
            'metrics': {k: list(v) for k, v in self.metrics.items()},
            'baselines': self.baselines,
            'trends': dict(self.trends),
            'alert_history': list(self.alert_history)
        }
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"Metrics exported to {file_path}")
    
    def clear_old_metrics(self, older_than_hours: int = 24) -> int:
        """
        Clear metrics older than specified time
        
        Args:
            older_than_hours: Remove metrics older than this many hours
            
        Returns:
            Number of metrics cleared
        """
        cutoff_time = datetime.now() - timedelta(hours=older_than_hours)
        cleared_count = 0
        
        for metric_name in list(self.metrics.keys()):
            original_length = len(self.metrics[metric_name])
            
            # Filter out old metrics
            filtered = deque(
                [m for m in self.metrics[metric_name] 
                 if datetime.fromisoformat(m['timestamp']) > cutoff_time],
                maxlen=self.history_size
            )
            
            self.metrics[metric_name] = filtered
            cleared_count += original_length - len(filtered)
        
        logger.info(f"Cleared {cleared_count} old metric entries")
        return cleared_count


# Global enhanced performance monitor instance
enhanced_monitor = EnhancedPerformanceMonitor()


def monitor_function_performance(func_name: Optional[str] = None):
    """
    Decorator to monitor function performance with enhanced tracking
    
    Args:
        func_name: Optional custom name for the function
        
    Usage:
        @monitor_function_performance()
        def my_function():
            ...
    """
    def decorator(func: Callable) -> Callable:
        name = func_name or func.__name__
        
        def wrapper(*args, **kwargs):
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss
            
            try:
                result = func(*args, **kwargs)
                success = True
                error = None
            except Exception as e:
                result = None
                success = False
                error = str(e)
                raise
            finally:
                end_time = time.time()
                end_memory = psutil.Process().memory_info().rss
                
                # Record execution time
                execution_time = (end_time - start_time) * 1000  # Convert to ms
                enhanced_monitor.record_metric(
                    f"function.{name}.execution_time",
                    execution_time,
                    {'success': success, 'error': error}
                )
                
                # Record memory usage
                memory_delta = (end_memory - start_memory) / (1024 * 1024)  # Convert to MB
                enhanced_monitor.record_metric(
                    f"function.{name}.memory_delta",
                    memory_delta,
                    {'success': success}
                )
            
            return result
        
        return wrapper
    return decorator


def get_performance_dashboard_data() -> Dict[str, Any]:
    """Get data for performance dashboard visualization"""
    return enhanced_monitor.get_performance_summary()


def setup_performance_alerting(callback: Callable[[Dict], None]) -> None:
    """Setup callback for performance alerts"""
    enhanced_monitor.add_alert_callback(callback)