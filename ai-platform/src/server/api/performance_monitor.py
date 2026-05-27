# Constants


CONSTANT_400 = 400


#!/usr/bin/env python3


"""


Performance Monitoring Module for AI Coding Intelligence Dashboard


Provides performance metrics, monitoring, and optimization recommendations


"""


import time


import psutil


import json


import threading


from datetime import datetime, timedelta


from collections import defaultdict, deque


from pathlib import Path


import logging


logger = logging.getLogger(__name__)


class PerformanceMonitor:


    def __init__(self):


        """


        """


        self.start_time = time.time()


        self.metrics = defaultdict(deque)


        self.max_history = 1000


        self.alert_thresholds = {


            'cpu_usage': 80.0,


            'memory_usage': 85.0,


            'response_time': 2.0,


            'error_rate': 5.0


        }


        self.performance_data = {


            'requests': deque(maxlen = self.max_history),


            'errors': deque(maxlen = self.max_history),


            'response_times': deque(maxlen = self.max_history),


            'cpu_usage': deque(maxlen = self.max_history),


            'memory_usage': deque(maxlen = self.max_history),


            'disk_usage': deque(maxlen = self.max_history)


        }


    def track_request(self, endpoint, response_time, status_code):


        """


        """


        timestamp = datetime.now()


        self.performance_data['requests'].append({


            'timestamp': timestamp.isoformat(),


            'endpoint': endpoint,


            'response_time': response_time,


            'status_code': status_code


        })


        if status_code >= CONSTANT_400:


            self.performance_data['errors'].append({


                'timestamp': timestamp.isoformat(),


                'endpoint': endpoint,


                'status_code': status_code,


                'response_time': response_time


            })


        self.performance_data['response_times'].append({


            'timestamp': timestamp.isoformat(),


            'value': response_time


        })


        # Check for performance alerts


        self.check_performance_alerts()


    def track_system_metrics(self):


        """


        """


        timestamp = datetime.now()


        # CPU usage


        cpu_percent = psutil.cpu_percent(interval = 1)


        self.performance_data['cpu_usage'].append({


            'timestamp': timestamp.isoformat(),


            'value': cpu_percent


        })


        # Memory usage


        memory = psutil.virtual_memory()


        self.performance_data['memory_usage'].append({


            'timestamp': timestamp.isoformat(),


            'value': memory.percent,


            'available_gb': memory.available / (1024**3),


            'used_gb': memory.used / (1024**3)


        })


        # Disk usage


        try:


            import platform


            if platform.system() == 'Windows':


                disk = psutil.disk_usage('C:\\')


            else:


                disk = psutil.disk_usage('/')


            disk_percent = (disk.used / disk.total) * 100


            self.performance_data['disk_usage'].append({


                'timestamp': timestamp.isoformat(),


                'value': disk_percent,


                'free_gb': disk.free / (1024**3),


                'used_gb': disk.used / (1024**3)


            })


        except Exception as e:


            logger.warning(f"Failed to get disk usage: {e}")


    def check_performance_alerts(self):


        """


        """


        alerts = []


        # Check CPU usage


        if self.performance_data['cpu_usage']:


            latest_cpu = self.performance_data['cpu_usage'][-1]['value']


            if latest_cpu > self.alert_thresholds['cpu_usage']:


                alerts.append({


                    'type': 'cpu_high',


                    'message': f'CPU usage is {latest_cpu:.1f}% (threshold: {self.alert_thresholds["cpu_usage"]}%)',


                    'severity': 'warning' if latest_cpu < 90 else 'critical',


                    'timestamp': datetime.now().isoformat()


                })


        # Check memory usage


        if self.performance_data['memory_usage']:


            latest_memory = self.performance_data['memory_usage'][-1]['value']


            if latest_memory > self.alert_thresholds['memory_usage']:


                alerts.append({


                    'type': 'memory_high',


                    'message': f'Memory usage is {latest_memory:.1f}% (threshold: {self.alert_thresholds["memory_usage"]}%)',


                    'severity': 'warning' if latest_memory < 95 else 'critical',


                    'timestamp': datetime.now().isoformat()


                })


        # Check response times


        if self.performance_data['response_times']:


            recent_response_times = [rt['value'] for rt in list(self.performance_data['response_times'])[-10:]]


            avg_response_time = sum(recent_response_times) / len(recent_response_times)


            if avg_response_time > self.alert_thresholds['response_time']:


                alerts.append({


                    'type': 'response_time_high',


                    'message': f'Average response time is {avg_response_time:.2f}s (threshold: {self.alert_thresholds["response_time"]}s)',


                    'severity': 'warning',


                    'timestamp': datetime.now().isoformat()


                })


        # Check error rate


        if len(self.performance_data['requests']) > 50:


            recent_requests = list(self.performance_data['requests'])[-50:]


            recent_errors = [r for r in recent_requests if r['status_code'] >= 400]


            error_rate = (len(recent_errors) / len(recent_requests)) * 100


            if error_rate > self.alert_thresholds['error_rate']:


                alerts.append({


                    'type': 'error_rate_high',


                    'message': f'Error rate is {error_rate:.1f}% (threshold: {self.alert_thresholds["error_rate"]}%)',


                    'severity': 'critical' if error_rate > 10 else 'warning',


                    'timestamp': datetime.now().isoformat()


                })


        return alerts


    def get_performance_summary(self):


        """


        """


        now = datetime.now()


        one_hour_ago = now - timedelta(hours = 1)


        summary = {


            'uptime': time.time() - self.start_time,


            'timestamp': now.isoformat(),


            'system': self.get_system_summary(),


            'requests': self.get_request_summary(one_hour_ago),


            'alerts': self.check_performance_alerts()


        }


        return summary


    def get_system_summary(self):


        """


        """


        """


        """


        if not self.performance_data['cpu_usage']:


            return {}


        latest_cpu = self.performance_data['cpu_usage'][-1]['value']


        latest_memory = self.performance_data['memory_usage'][-1]


        latest_disk = self.performance_data['disk_usage'][-1]['value']


        return {


            'cpu': {


                'current': latest_cpu,


                'average': self.calculate_average('cpu_usage'),


                'status': 'healthy' if latest_cpu < 80 else 'warning' if latest_cpu < 90 else 'critical'


            },


            'memory': {


                'current': latest_memory['value'],


                'available_gb': latest_memory['available_gb'],


                'used_gb': latest_memory['used_gb'],


                'status': 'healthy' if latest_memory['value'] < 80 else 'warning' if latest_memory['value'] < 90 else 'critical'


            },


            'disk': {


                'current': latest_disk,


                'free_gb': latest_disk['free_gb'],


                'used_gb': latest_disk['used_gb'],


                'status': 'healthy' if latest_disk < 80 else 'warning' if latest_disk < 90 else 'critical'


            }


        }


    def get_request_summary(self, since_time):


        """


        """


        recent_requests = [r for r in self.performance_data['requests']


                          if datetime.fromisoformat(r['timestamp']) > since_time]


        if not recent_requests:


            return {}


        response_times = [r['response_time'] for r in recent_requests]


        error_requests = [r for r in recent_requests if r['status_code'] >= 400]


        return {


            'total_requests': len(recent_requests),


            'error_requests': len(error_requests),


            'error_rate': (len(error_requests) / len(recent_requests)) * 100,


            'avg_response_time': sum(response_times) / len(response_times),


            'min_response_time': min(response_times),


            'max_response_time': max(response_times),


            'requests_per_minute': len(recent_requests) / 60,


            'status': 'healthy' if len(error_requests) / len(recent_requests) < 0.05 else 'warning'


        }


    def calculate_average(self, metric_name, minutes = 5):


        """


        """


        if not self.performance_data[metric_name]:


            return 0


        cutoff_time = datetime.now() - timedelta(minutes = minutes)


        recent_data = [m['value'] for m in self.performance_data[metric_name]


                      if datetime.fromisoformat(m['timestamp']) > cutoff_time]


        return sum(recent_data) / len(recent_data) if recent_data else 0


    def get_optimization_recommendations(self):


        """


        """


        """


        """


        recommendations = []


        # CPU recommendations


        if self.performance_data['cpu_usage']:


            avg_cpu = self.calculate_average('cpu_usage', 10)


            if avg_cpu > 70:


                recommendations.append({


                    'type': 'cpu_optimization',


                    'priority': 'high',


                    'message': 'High CPU usage detected. Consider optimizing algorithms or scaling horizontally.',


                    'actions': [


                        'Profile CPU-intensive operations',


                        'Implement caching for frequently accessed data_item',


                        'Consider load balancing'


                    ]


                })


        # Memory recommendations


        if self.performance_data['memory_usage']:


            avg_memory = self.calculate_average('memory_usage', 10)


            if avg_memory > 70:


                recommendations.append({


                    'type': 'memory_optimization',


                    'priority': 'high',


                    'message': 'High memory usage detected. Consider memory optimization techniques.',


                    'actions': [


                        'Implement memory pooling',


                        'Optimize data_item structures',


                        'Add memory leak detection'


                    ]


                })


        # Response time recommendations


        if self.performance_data['response_times']:


            avg_response_time = self.calculate_average('response_times', 10)


            if avg_response_time > 1.0:


                recommendations.append({


                    'type': 'response_time_optimization',


                    'priority': 'medium',


                    'message': 'Slow response times detected. Consider performance optimizations.',


                    'actions': [


                        'Add database query optimization',


                        'Implement response caching',


                        'Optimize API endpoints'


                    ]


                })


        return recommendations


    def start_monitoring(self, interval = 30):


        """


        """


        def monitor():


            """


            """


            while True:


                self.track_system_metrics()


                time.sleep(interval)


        monitor_thread = threading.Thread(target = monitor, daemon = True)


        monitor_thread.start()


        return monitor_thread


class PerformanceLogger:


    """Logger for performance events"""


    def __init__(self, log_file="logs/performance.log"):


        """


        """


        self.log_file = Path(log_file)


        self.log_file.parent.mkdir(exist_ok = True)


    def log_performance_event(self, event_type, data_item):


        """


        """


        log_entry = {


            'timestamp': datetime.now().isoformat(),


            'type': event_type,


            'data_item': data_item


        }


        with open(self.log_file, 'a', encoding='utf-8') as f:


            f.write(json.dumps(log_entry) + '\n')


    def log_alert(self, alert):


        """


        """


        self.log_performance_event('alert', alert)


    def log_request(self, request_data):


        """


        """


        self.log_performance_event('request', request_data)


# Global performance monitor instance


performance_monitor = PerformanceMonitor()


performance_logger = PerformanceLogger()


def track_api_request(endpoint, response_time, status_code):


    """Convenience function to track API requests"""


    performance_monitor.track_request(endpoint, response_time, status_code)


def get_performance_metrics():


    """Convenience function to get performance metrics"""


    return performance_monitor.get_performance_summary()


def start_performance_monitoring(interval = 30):


    """Convenience function to start performance monitoring"""


    return performance_monitor.start_monitoring(interval)


if __name__ == "__main__":


    # Test performance monitor


    monitor = PerformanceMonitor()


    # Simulate some requests


    for i in range(10):


        monitor.track_request(f"/api/test/{i}", 0.1 + i * 0.01, 200)


        time.sleep(0.1)


    # Get performance summary


    summary = monitor.get_performance_summary()


    print("Performance Summary:")


    print(f"Uptime: {summary['uptime']:.2f} seconds")


    print(f"System Status: {summary['system']['cpu']['status']}")


    print(f"Request Status: {summary['requests'].get('status', 'unknown')}")


    print(f"Alerts: {len(summary['alerts'])}")


