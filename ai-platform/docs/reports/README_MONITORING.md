# Performance Monitoring Setup Guide

This guide provides comprehensive instructions for setting up and using the performance monitoring infrastructure for the AI Dashboard.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Python 3.8+ with pip
- Sufficient system resources (2GB RAM minimum)

### Installation Steps

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start Monitoring Stack**
   ```bash
   cd monitoring
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Verify Services**
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (admin/admin123)
   - AlertManager: http://localhost:9093

## 📊 Monitoring Components

### Prometheus Metrics Collection
- **Response Time**: HTTP request duration tracking
- **Throughput**: Requests per second monitoring
- **Memory Usage**: Application and system memory
- **CPU Usage**: Process and system CPU utilization
- **Error Rate**: HTTP error tracking and classification
- **Business Metrics**: Analysis operations and cache performance

### Grafana Dashboard
- Real-time performance visualization
- Historical trend analysis
- Alert status overview
- System health indicators

### AlertManager
- Configurable alert thresholds
- Email and webhook notifications
- Alert grouping and silencing
- Escalation policies

## 🔧 Configuration

### Prometheus Configuration (`monitoring/prometheus.yml`)
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'ai-dashboard-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

### Alert Rules (`monitoring/alert_rules.yml`)
Key alerts configured:
- **High Response Time**: > 1s (95th percentile)
- **High Error Rate**: > 10% errors
- **High Memory Usage**: > 1GB
- **High CPU Usage**: > 80%
- **Low Throughput**: < 10 req/s
- **Service Down**: Service unavailable

### Application Integration

#### Basic Setup
```python
from src.metrics.prometheus_metrics import metrics, monitor_http_request
from src.metrics.performance_monitor import performance_monitor

# Start monitoring
metrics.start_metrics_server(3000)
performance_monitor.start_monitoring(interval=5)

# Use decorators for automatic monitoring
@monitor_http_request
def handle_request(method, endpoint, **kwargs):
    # Your request handling logic
    pass
```

#### Advanced Integration
```python
from src.app.performance_instrumented_app import PerformanceInstrumentedApp

config = {
    'app_name': 'ai-dashboard',
    'port': 3000,
    'metrics_port': 3000
}

app = PerformanceInstrumentedApp(config)

# Handle requests with automatic monitoring
result = app.handle_request('GET', '/api/analysis', analysis_type='quality')
```

## 📈 Metrics Available

### HTTP Metrics
- `http_requests_total`: Total HTTP requests by method, endpoint, status
- `http_request_duration_seconds`: Request duration histogram

### Application Metrics
- `processing_time_seconds`: Operation processing time
- `analysis_operations_total`: Code analysis operations
- `active_connections`: Current active connections

### System Metrics
- `process_resident_memory_bytes`: Memory usage
- `process_cpu_seconds_total`: CPU time
- `node_memory_MemAvailable_bytes`: Available system memory
- `node_cpu_seconds_total`: System CPU time

### Error Metrics
- `error_count_total`: Error count by type and component
- `cache_hits_total`: Cache hit count
- `cache_misses_total`: Cache miss count

## 🚨 Alert Management

### Viewing Alerts
1. Open Grafana: http://localhost:3001
2. Navigate to Alerting → Alert List
3. Filter by severity and state

### Alert Configuration
Edit `monitoring/alert_rules.yml` to customize thresholds:
```yaml
- alert: HighResponseTime
  expr: http_request_duration_seconds{quantile="0.95"} > 1
  for: 2m
  labels:
    severity: warning
```

### Notification Setup
Configure email/webhook in `monitoring/alertmanager.yml`:
```yaml
receivers:
  - name: 'web.hook'
    email_configs:
      - to: 'admin@yourcompany.com'
```

## 🔍 Performance Analysis

### Real-time Monitoring
```python
# Get current performance summary
summary = performance_monitor.get_performance_summary()
print(f"Overall Score: {summary['overall_score']}%")

# Get recent alerts
alerts = performance_monitor.get_alerts(severity='critical', hours_back=1)
```

### Historical Analysis
```python
# Get metric history
response_times = performance_monitor.get_metric_history('response_time', hours_back=24)

# Export metrics for analysis
performance_monitor.export_metrics('performance_data.json')
```

### Load Testing
```python
# Simulate application load
app.simulate_load(requests_per_second=50, duration_seconds=60)
```

## 🛠️ Troubleshooting

### Common Issues

#### Metrics Not Showing
1. Verify application is exposing metrics on port 3000
2. Check Prometheus configuration
3. Review Prometheus logs: `docker-compose logs prometheus`

#### Grafana Dashboard Not Loading
1. Ensure Prometheus datasource is configured
2. Check Grafana logs: `docker-compose logs grafana`
3. Verify dashboard JSON format

#### High Memory Usage
1. Check metric retention settings
2. Review application memory usage
3. Consider increasing system resources

#### Alerts Not Firing
1. Verify alert rule syntax
2. Check AlertManager configuration
3. Review Prometheus evaluation logs

### Health Checks

#### Service Status
```bash
# Check all services
docker-compose ps

# Check service logs
docker-compose logs prometheus
docker-compose logs grafana
docker-compose logs alertmanager
```

#### Metrics Endpoint
```bash
# Test Prometheus metrics
curl http://localhost:3000/metrics

# Test Prometheus health
curl http://localhost:9090/-/healthy

# Test Grafana health
curl http://localhost:3001/api/health
```

## 📚 Best Practices

### Performance Optimization
1. **Metric Cardinality**: Avoid high cardinality labels
2. **Scraping Interval**: Balance between freshness and load
3. **Retention Period**: Configure appropriate data retention
4. **Alert Thresholds**: Set realistic thresholds based on baselines

### Security Considerations
1. **Network Access**: Restrict access to monitoring endpoints
2. **Authentication**: Configure Grafana authentication
3. **Firewall Rules**: Limit external access to monitoring ports
4. **Data Privacy**: Avoid logging sensitive information

### Maintenance
1. **Regular Updates**: Keep monitoring stack updated
2. **Backup Configs**: Version control configuration files
3. **Log Rotation**: Configure log rotation for containers
4. **Capacity Planning**: Monitor storage usage for metrics

## 🔄 Scaling Considerations

### High Traffic Applications
- Increase Prometheus storage
- Use remote write for long-term storage
- Implement metric federation
- Consider Thanos or Cortex for scaling

### Multi-Environment Setup
- Environment-specific configurations
- Centralized alerting
- Cross-environment dashboards
- Consistent metric naming

## 📞 Support

For issues and questions:
1. Check this documentation
2. Review service logs
3. Consult Prometheus and Grafana documentation
4. Create an issue in the project repository

---

**Note**: This monitoring setup provides comprehensive performance insights. Adjust configurations based on your specific requirements and environment constraints.
