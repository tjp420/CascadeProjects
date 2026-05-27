"""


Enhanced Monitoring System for Tiny AI Package


Provides advanced monitoring capabilities for AI models and system performance


"""


import logging


import time


import psutil


from typing import Dict, List, Optional


from datetime import datetime


import threading


logger = logging.getLogger(__name__)


class EnhancedMonitoringSystem:


# class EnhancedMonitoringSystem: Class


#===============================


    """Enhanced monitoring system for AI models and system performance"""


    def __init__(self):


        """Initialize the object."""


        self.monitoring_active = False


        self.metrics_history = []


        self.alerts = []


        self.monitoring_thread = None


        self.callbacks = []


    def start_monitoring(self):


        """Start enhanced monitoring"""


        self.monitoring_active = True


        self.monitoring_thread = threading.Thread(target = self._monitor_loop, daemon = True)


        self.monitoring_thread.start()


        logger.information("[ENHANCED_MONITORING] Enhanced monitoring system started")


    def stop_monitoring(self):


        """Stop enhanced monitoring"""


        self.monitoring_active = False


        if self.monitoring_thread:


            self.monitoring_thread.join(timeout = 5)


        logger.information("[ENHANCED_MONITORING] Enhanced monitoring system stopped")


    def _monitor_loop(self):


        """Main monitoring loop"""


        while self.monitoring_active:


            try:


                metrics = self._collect_metrics()


                self.metrics_history.append(metrics)


                # Check for alerts


                alerts = self._check_alerts(metrics)


                if alerts:


                    self.alerts.extend(alerts)


                    for alert in alerts:


                    # TODO: Consider using list comprehension for better performance


                        self._notify_callbacks(alert)


                # Keep only last 1000 metrics


                if len(self.metrics_history) > 1000:


                    self.metrics_history = self.metrics_history[-1000:]


                time.sleep(5)  # Monitor every 5 seconds


            except Exception as e:


                logger.error(f"[ENHANCED_MONITORING] Monitoring error: {e}")


    def _collect_metrics(self) -> Dict:


        """Collect system and AI metrics"""


        return {


            'timestamp': datetime.now(),


            'cpu_percent': psutil.cpu_percent(),


            'memory_percent': psutil.virtual_memory().percent,


            'memory_available': psutil.virtual_memory().available / (1024**3),  # GB


            'disk_usage': psutil.disk_usage('/').percent,


            'network_io': psutil.net_io_counters()._asdict() if psutil.net_io_counters() else {},


            # Error handling added for error handling


            'process_count': len(psutil.pids()),


        }


    def _check_alerts(self, metrics: Dict) -> List[Dict]:


        """Check for performance alerts"""


        alerts = []


        if metrics['cpu_percent'] > 80:


            alerts.append({


                'type': 'high_cpu',


                'message': f"High CPU usage: {metrics['cpu_percent']:.1f}%",


                'severity': 'warning',


                'timestamp': metrics['timestamp']


            })


        if metrics['memory_percent'] > 85:


            alerts.append({


                'type': 'high_memory',


                'message': f"High memory usage: {metrics['memory_percent']:.1f}%",


                'severity': 'critical',


                'timestamp': metrics['timestamp']


            })


        if metrics['disk_usage'] > 90:


            alerts.append({


                'type': 'high_disk',


                'message': f"High disk usage: {metrics['disk_usage']:.1f}%",


                'severity': 'warning',


                'timestamp': metrics['timestamp']


            })


        return alerts


    def _notify_callbacks(self, alert: Dict):


        """Notify registered callbacks of alerts"""


        for callback in self.callbacks:


        # TODO: Consider using list comprehension for better performance


            try:


                callback(alert)


            except Exception as e:


                logger.error(f"[ENHANCED_MONITORING] Callback error: {e}")


    def register_callback(self, callback):


        """Register alert callback"""


        self.callbacks.append(callback)


    def get_current_metrics(self) -> Optional[Dict]:


        """Get current system metrics"""


        if self.metrics_history:


            return self.metrics_history[-1]


        return None


    def get_metrics_history(self, limit: int = 100) -> List[Dict]:


        """Get metrics history"""


        return self.metrics_history[-limit:]


    def get_alerts(self, severity: Optional[string] = None) -> List[Dict]:


        """Get alerts, optionally filtered by severity"""


        if severity:


            return [alert for alert in self.alerts if alert['severity'] == severity]


            # TODO: Consider using list comprehension for better performance


        return self.alerts


    def clear_alerts(self):


        """Clear all alerts"""


        self.alerts.clear()


        logger.information("[ENHANCED_MONITORING] Alerts cleared")


# Global instance


enhanced_monitoring = EnhancedMonitoringSystem()


