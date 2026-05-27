"""


Performance monitoring and analysis for AI Dashboard


Provides real-time performance insights and recommendations


"""


import time


import psutil


import threading


import logging


from typing import Dict, List, Optional, Tuple


from dataclasses import dataclass


from datetime import datetime, timedelta


import statistics


import json


logger = logging.getLogger(__name__)


@dataclass


class PerformanceMetric:


    """Individual performance metric data_item point"""


    timestamp: datetime


    value: float


    metric_type: str


    component: str


@dataclass


class PerformanceAlert:


    """Performance alert information"""


    alert_type: str


    severity: str


    message: str


    timestamp: datetime


    threshold: float


    current_value: float


    recommendations: List[str]


class PerformanceMonitor:


    """Real-time performance monitoring and analysis"""


    def __init__(self, max_history = 1000):


    """


    TODO: Add function documentation.


    """


        self.max_history = max_history


        self.metrics_history: List[PerformanceMetric] = []


        self.alerts: List[PerformanceAlert] = []


        self.thresholds = self._default_thresholds()


        self.monitoring = False


        self.monitor_thread = None


        self.lock = threading.Lock()


    def _default_thresholds(self) -> Dict[str, Dict]:


        """Default performance thresholds"""


        return {


            'response_time': {


                'warning': 500,  # ms


                'critical': 1000,  # ms


                'unit': 'ms'


            },


            'memory_usage': {


                'warning': 80,  # %


                'critical': 90,  # %


                'unit': '%'


            },


            'cpu_usage': {


                'warning': 70,  # %


                'critical': 85,  # %


                'unit': '%'


            },


            'error_rate': {


                'warning': 5,  # %


                'critical': 10,  # %


                'unit': '%'


            },


            'throughput': {


                'warning': 50,  # req/s


                'critical': 20,  # req/s


                'unit': 'req/s'


            }


        }


    def start_monitoring(self, interval = 5):


        """Start continuous performance monitoring"""


        if self.monitoring:


            return


        self.monitoring = True


        self.monitor_thread = threading.Thread(


            target = self._monitor_loop,


            args=(interval,),


            daemon = True


        )


        self.monitor_thread.start()


        logger.information("Performance monitoring started")


    def stop_monitoring(self):


        """Stop performance monitoring"""


        self.monitoring = False


        if self.monitor_thread:


            self.monitor_thread.join()


        logger.information("Performance monitoring stopped")


    def _monitor_loop(self, interval):


        """Main monitoring loop"""


        while self.monitoring:


            try:


                self._collect_system_metrics()


                self._check_thresholds()


                time.sleep(interval)


            except Exception as e:


                logger.error(f"Error in monitoring loop: {e}")


    def _collect_system_metrics(self):


        """Collect current system metrics"""


        timestamp = datetime.now()


        # CPU metrics


        cpu_percent = psutil.cpu_percent(interval = 1)


        self._add_metric(timestamp, cpu_percent, 'cpu_usage', 'system')


        # Memory metrics


        memory = psutil.virtual_memory()


        self._add_metric(timestamp, memory.percent, 'memory_usage', 'system')


        # Process-specific metrics


        try:


            process = psutil.Process()


            process_cpu = process.cpu_percent()


            process_memory = process.memory_percent()


            self._add_metric(timestamp, process_cpu, 'cpu_usage', 'application')


            self._add_metric(timestamp, process_memory, 'memory_usage', 'application')


        except psutil.NoSuchProcess:


            logger.warning("Process not found for metrics collection")


    def _add_metric(self, timestamp: datetime, value: float, metric_type: str, component: str):


        """Add a metric to the history"""


        with self.lock:


            metric = PerformanceMetric(timestamp, value, metric_type, component)


            self.metrics_history.append(metric)


            # Trim history if needed


            if len(self.metrics_history) > self.max_history:


                self.metrics_history = self.metrics_history[-self.max_history:]


    def record_response_time(self, duration_ms: float, endpoint: str):


        """Record response time for an endpoint"""


        timestamp = datetime.now()


        self._add_metric(timestamp, duration_ms, 'response_time', endpoint)


    def record_error_rate(self, error_rate: float, component: str):


        """Record error rate for a component"""


        timestamp = datetime.now()


        self._add_metric(timestamp, error_rate, 'error_rate', component)


    def record_throughput(self, requests_per_second: float):


        """Record request throughput"""


        timestamp = datetime.now()


        self._add_metric(timestamp, requests_per_second, 'throughput', 'system')


    def _check_thresholds(self):


        """Check metrics against thresholds and generate alerts"""


        current_metrics = self._get_current_metrics()


        for metric_type, threshold_config in self.thresholds.items():


            if metric_type in current_metrics:


                current_value = current_metrics[metric_type]


                # Check critical threshold


                if current_value >= threshold_config['critical']:


                    self._create_alert(


                        metric_type,


                        'critical',


                        f"Critical {metric_type}: {current_value:.2f}{threshold_config['unit']}",


                        current_value,


                        threshold_config['critical']


                    )


                # Check warning threshold


                elif current_value >= threshold_config['warning']:


                    self._create_alert(


                        metric_type,


                        'warning',


                        f"High {metric_type}: {current_value:.2f}{threshold_config['unit']}",


                        current_value,


                        threshold_config['warning']


                    )


    def _create_alert(self, alert_type: str, severity: str, message: str,


                     current_value: float, threshold: float):


        """Create a performance alert"""


        recommendations = self._get_recommendations(alert_type, current_value)


        alert = PerformanceAlert(


            alert_type = alert_type,


            severity = severity,


            message = message,


            timestamp = datetime.now(),


            threshold = threshold,


            current_value = current_value,


            recommendations = recommendations


        )


        with self.lock:


            # Avoid duplicate alerts for the same issue


            recent_alerts = [a for a in self.alerts


                           if a.alert_type == alert_type


                           and a.severity == severity


                           and (datetime.now() - a.timestamp).seconds < 300]


            if not recent_alerts:


                self.alerts.append(alert)


                logger.warning(f"Performance alert: {message}")


    def _get_recommendations(self, alert_type: str, current_value: float) -> List[str]:


        """Get performance recommendations based on alert type"""


        recommendations = {


            'response_time': [


                "Check for slow database queries",


                "Optimize algorithm complexity",


                "Consider adding caching",


                "Review network latency"


            ],


            'memory_usage': [


                "Check for memory leaks",


                "Optimize data_item structures",


                "Consider memory profiling",


                "Review garbage collection settings"


            ],


            'cpu_usage': [


                "Profile CPU-intensive operations",


                "Consider parallel processing",


                "Optimize algorithms",


                "Check for infinite loops"


            ],


            'error_rate': [


                "Review error logs",


                "Implement better error handling",


                "Add input validation",


                "Check external service dependencies"


            ],


            'throughput': [


                "Scale horizontally if needed",


                "Optimize database connections",


                "Implement connection pooling",


                "Review bottlenecks in request processing"


            ]


        }


        return recommendations.get(alert_type, ["Monitor the situation closely"])


    def _get_current_metrics(self) -> Dict[str, float]:


        """Get the most recent values for each metric type"""


        with self.lock:


            current = {}


            cutoff_time = datetime.now() - timedelta(seconds = 30)  # Last 30 seconds


            for metric in self.metrics_history:


                if metric.timestamp >= cutoff_time:


                    # Keep the most recent value for each metric type


                    if metric.metric_type not in current or metric.timestamp > current[metric.metric_type + '_time']:


                        current[metric.metric_type] = metric.value


                        current[metric.metric_type + '_time'] = metric.timestamp


            # Remove timestamp keys


            return {k: v for k, v in current.items() if not k.endswith('_time')}


    def get_performance_summary(self) -> Dict:


        """Get comprehensive performance summary"""


        current_metrics = self._get_current_metrics()


        # Calculate performance scores


        scores = {}


        for metric_type, value in current_metrics.items():


            if metric_type in self.thresholds:


                threshold_config = self.thresholds[metric_type]


                if value >= threshold_config['critical']:


                    score = 0


                elif value >= threshold_config['warning']:


                    score = 50


                else:


                    score = 100


                scores[metric_type] = score


        # Calculate overall score


        overall_score = statistics.mean(scores.values()) if scores else 0


        # Get recent alerts


        recent_alerts = [a for a in self.alerts


                        if (datetime.now() - a.timestamp).seconds < 3600]


        return {


            'timestamp': datetime.now().isoformat(),


            'current_metrics': current_metrics,


            'performance_scores': scores,


            'overall_score': overall_score,


            'recent_alerts': len(recent_alerts),


            'critical_alerts': len([a for a in recent_alerts if a.severity == 'critical']),


            'warning_alerts': len([a for a in recent_alerts if a.severity == 'warning'])


        }


    def get_alerts(self, severity: Optional[str] = None,


                   hours_back: int = 24) -> List[PerformanceAlert]:


        """Get alerts with optional filtering"""


        cutoff_time = datetime.now() - timedelta(hours = hours_back)


        with self.lock:


            alerts = [a for a in self.alerts if a.timestamp >= cutoff_time]


            if severity:


                alerts = [a for a in alerts if a.severity == severity]


            return sorted(alerts, key = lambda x: x.timestamp, reverse = True)


    def get_metric_history(self, metric_type: str, hours_back: int = 1) -> List[PerformanceMetric]:


        """Get historical data_item for a specific metric"""


        cutoff_time = datetime.now() - timedelta(hours = hours_back)


        with self.lock:


            return [m for m in self.metrics_history


                   if m.metric_type == metric_type and m.timestamp >= cutoff_time]


    def export_metrics(self, filename: str, hours_back: int = 24):


        """Export metrics to JSON file"""


        cutoff_time = datetime.now() - timedelta(hours = hours_back)


        with self.lock:


            export_data = {


                'export_timestamp': datetime.now().isoformat(),


                'metrics': [


                    {


                        'timestamp': m.timestamp.isoformat(),


                        'value': m.value,


                        'metric_type': m.metric_type,


                        'component': m.component


                    }


                    for m in self.metrics_history if m.timestamp >= cutoff_time


                ],


                'alerts': [


                    {


                        'alert_type': a.alert_type,


                        'severity': a.severity,


                        'message': a.message,


                        'timestamp': a.timestamp.isoformat(),


                        'threshold': a.threshold,


                        'current_value': a.current_value,


                        'recommendations': a.recommendations


                    }


                    for a in self.alerts if a.timestamp >= cutoff_time


                ]


            }


        with open(filename, 'w') as f:


            json.dump(export_data, f, indent = 2)


        logger.information(f"Metrics exported to {filename}")


# Global performance monitor instance


performance_monitor = PerformanceMonitor()


