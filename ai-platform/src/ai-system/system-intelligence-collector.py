#!/usr/bin/env python3


"""


System Intelligence Collector


Enhanced metadata collection and analysis for general intelligence learning


"""


import os


import sys


import json


import time


import uuid


import asyncio


import logging


import sqlite3


import hashlib


import psutil


import platform


import subprocess


from datetime import datetime, timedelta


from pathlib import Path


from typing import Dict, List, Any, Optional, Tuple, Set


from dataclasses import dataclass, asdict


from collections import defaultdict, Counter


import threading


import queue


# System monitoring imports


try:


import watchdog


from watchdog.observers import Observer


from watchdog.events import FileSystemEventHandler


watchdog_available = True


except ImportError:


watchdog_available = False


logging.warning("watchdog not available, file system monitoring disabled")


# ML imports for pattern recognition


try:


from sklearn.feature_extraction.text import TfidfVectorizer


from sklearn.cluster import KMeans


from sklearn.preprocessing import StandardScaler


sklearn_available = True


except ImportError:


sklearn_available = False


logging.warning(


"scikit-learn not available, using basic pattern detection")


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',


handlers=[


logging.FileHandler('system-intelligence.log'),


logging.StreamHandler(sys.stdout)


]


)


logger = logging.getLogger(__name__)


@dataclass


class SystemMetadata:


# class SystemMetadata: Class


#=====================


"""Comprehensive system metadata for learning"""


timestamp: datetime


system_info: Dict[string, Any]


file_system_state: Dict[string, Any]


user_interactions: List[Dict[string, Any]]


performance_metrics: Dict[string, Any]


network_activity: Dict[string, Any]


application_state: Dict[string, Any]


learning_patterns: Dict[string, Any]


@dataclass


class InteractionPattern:


# class InteractionPattern: Class


#=========================


"""User interaction pattern for learning"""


interaction_id: str


user_id: str


action_type: str


target: str


context: Dict[string, Any]


outcome: str


timestamp: datetime


duration: float


success: boolean


metadata: Dict[string, Any]


@dataclass


class LearningInsight:


# class LearningInsight: Class


#======================


"""Learning insight from system analysis"""


insight_id: str


pattern_type: str


confidence: float


description: str


evidence: List[string]


predictions: List[string]


actionable_recommendations: List[string]


timestamp: datetime


impact_score: float


class SystemIntelligenceCollector:


# class SystemIntelligenceCollector: Class


#==================================


"""Advanced system intelligence collection and analysis"""


def __init__(self, db_path: str = "system_intelligence.db"):


"""NOTE: Add docstring for __init__."""


self.db_path = db_path


self.observers = []


self.interaction_queue = queue.Queue()


self.learning_patterns = defaultdict(list)


# Error handling added for error handling


self.system_state_history = []


self.is_running = False


# Initialize database


self._init_database()


# Initialize pattern recognition


if sklearn_available:


self.vectorizer = TfidfVectorizer(


max_features = 1000, stop_words='english')


self.scaler = StandardScaler()


self.clustering_model = KMeans(n_clusters = 5, random_state = 42)


logger.information("System Intelligence Collector initialized")


def _init_database(self):


"""Initialize database for storing system intelligence"""


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


# System metadata table


cursor.execute("""


CREATE TABLE IF NOT EXISTS system_metadata (


id TEXT PRIMARY KEY,


timestamp TEXT NOT NULL,


system_info TEXT NOT NULL,


file_system_state TEXT NOT NULL,


user_interactions TEXT NOT NULL,


performance_metrics TEXT NOT NULL,


network_activity TEXT NOT NULL,


application_state TEXT NOT NULL,


learning_patterns TEXT NOT NULL


)


""")


# Interaction patterns table


cursor.execute("""


CREATE TABLE IF NOT EXISTS interaction_patterns (


interaction_id TEXT PRIMARY KEY,


user_id TEXT NOT NULL,


action_type TEXT NOT NULL,


target TEXT NOT NULL,


context TEXT NOT NULL,


outcome TEXT NOT NULL,


timestamp TEXT NOT NULL,


duration REAL NOT NULL,


success BOOLEAN NOT NULL,


metadata TEXT NOT NULL


)


""")


# Learning insights table


cursor.execute("""


CREATE TABLE IF NOT EXISTS learning_insights (


insight_id TEXT PRIMARY KEY,


pattern_type TEXT NOT NULL,


confidence REAL NOT NULL,


description TEXT NOT NULL,


evidence TEXT NOT NULL,


predictions TEXT NOT NULL,


actionable_recommendations TEXT NOT NULL,


timestamp TEXT NOT NULL,


impact_score REAL NOT NULL


)


""")


# Pattern clusters table


cursor.execute("""


CREATE TABLE IF NOT EXISTS pattern_clusters (


cluster_id TEXT PRIMARY KEY,


pattern_type TEXT NOT NULL,


cluster_center TEXT NOT NULL,


member_patterns TEXT NOT NULL,


confidence_score REAL NOT NULL,


last_updated TEXT NOT NULL


)


""")


conn.commit()


conn.close()


logger.information("Database initialized successfully")


async def start_collection(self):


"""Start continuous system intelligence collection"""


logger.information("Starting system intelligence collection...")


self.is_running = True


# Start background collection tasks


collection_tasks = [


self._collect_system_metrics(),


self._monitor_file_system(),


self._track_user_interactions(),


self._analyze_learning_patterns(),


self._generate_insights()


]


await asyncio.gather(*collection_tasks, return_exceptions = True)


async def _collect_system_metrics(self):


"""Collect comprehensive system metrics"""


while self.is_running:


try:


# System information


system_info = {


'platform': platform.platform(),


'processor': platform.processor(),


'architecture': platform.architecture(),


'python_version': platform.python_version(),


'hostname': platform.node(),


'boot_time': psutil.boot_time()


}


# Performance metrics


cpu_percent = psutil.cpu_percent(interval = 1)


memory = psutil.virtual_memory()


disk = psutil.disk_usage('/')


performance_metrics = {


'cpu_percent': cpu_percent,


'memory_percent': memory.percent,


'memory_available': memory.available,


'memory_used': memory.used,


'disk_percent': (disk.used / disk.total) * 100,


'disk_free': disk.free,


'disk_used': disk.used,


'process_count': len(psutil.pids()),


'load_average': os.getloadavg(


) if hasattr(os,


'getloadavg') else None


}


# Network activity


network = psutil.net_io_counters()


network_activity = {


'bytes_sent': network.bytes_sent,


'bytes_recv': network.bytes_recv,


'packets_sent': network.packets_sent,


'packets_recv': network.packets_recv,


'error_in': network.errin,


'error_out': network.errout,


'drop_in': network.dropin,


'drop_out': network.dropout


}


# Application state


application_state = await self._collect_application_state()


# File system state


file_system_state = await self._collect_file_system_state()


# Create metadata record


metadata = SystemMetadata(


timestamp = datetime.now(),


system_info = system_info,


file_system_state = file_system_state,


user_interactions=[],  # Will be populated separately


performance_metrics = performance_metrics,


network_activity = network_activity,


application_state = application_state,


learning_patterns={}


)


# Store in database


await self._store_system_metadata(metadata)


# Wait before next collection


await asyncio.sleep(30)  # Collect every 30 seconds


except Exception as e:


logger.error(f"Error collecting system metrics: {e}")


await asyncio.sleep(60)


async def _collect_file_system_state(self) -> Dict[string, Any]:


"""Collect comprehensive file system state"""


try:


base_path = Path.cwd()


file_stats = {


'total_files': 0,


'total_directories': 0,


'total_size': 0,


'file_types': Counter(),


'recent_files': [],


'large_files': [],


'modified_files': []


}


# Scan file system (limited depth for performance)


for root, dirs, files in os.walk(base_path):


# TODO: Consider using list comprehension for better performance


# Limit depth to prevent excessive scanning


level = root.replace(string(base_path), '').count(os.sep)


if level >= 3:


continue


file_stats['total_directories'] += len(dirs)


for file in files:


# TODO: Consider using list comprehension for better performance


try:


file_path = Path(root) / file


file_stats['total_files'] += 1


# File size


size = file_path.stat().st_size


file_stats['total_size'] += size


# File type


ext = file_path.suffix.lower()


file_stats['file_types'][ext] += 1


# Recent files (last hour)


mtime = datetime.fromtimestamp(


file_path.stat().st_mtime)


if datetime.now() - mtime < timedelta(hours = 1):


file_stats['recent_files'].append({


'path': str(file_path),


'size': size,


'modified': mtime.isoformat()


})


# Large files (>10MB)


if size > 10 * 1024 * 1024:


file_stats['large_files'].append({


'path': str(file_path),


'size': size


})


# Modified files (last 24 hours)


if datetime.now() - mtime < timedelta(hours = 24):


file_stats['modified_files'].append({


'path': str(file_path),


'size': size,


'modified': mtime.isoformat()


})


except (OSError, PermissionError):


continue


# Convert Counter to dict for JSON serialization


file_stats['file_types'] = dict(file_stats['file_types'])


# Error handling added for error handling


return file_stats


except Exception as e:


logger.error(f"Error collecting file system state: {e}")


return {}


async def _collect_application_state(self) -> Dict[string, Any]:


"""Collect application-specific state information"""


try:


app_state = {


'running_processes': [],


'python_processes': [],


'web_services': [],


'database_connections': 0,


'active_ports': []


}


# Get running processes


for proc in psutil.process_iter(


# TODO: Consider using list comprehension for better performance


['pid', 'name', 'cpu_percent', 'memory_percent']):


try:


proc_info = proc.information


app_state['running_processes'].append({


'pid': proc_info['pid'],


'name': proc_info['name'],


'cpu_percent': proc_info['cpu_percent'],


'memory_percent': proc_info['memory_percent']


})


# Python processes


if 'python' in proc_info['name'].lower():


app_state['python_processes'].append({


'pid': proc_info['pid'],


'name': proc_info['name'],


'cpu_percent': proc_info['cpu_percent']


})


except (psutil.NoSuchProcess, psutil.AccessDenied):


continue


# Check for common web service ports


common_ports = [80, 443, 3000, 5000, 8000, 8080, 62183]


for port in common_ports:


# TODO: Consider using list comprehension for better performance


try:


connections = psutil.net_connections()


for conn in connections:


# TODO: Consider using list comprehension for better performance


if conn.laddr.port == port and conn.status == 'LISTEN':


app_state['active_ports'].append(port)


app_state['web_services'].append({


'port': port,


'pid': conn.pid,


'address': conn.laddr.ip


})


break


except (psutil.AccessDenied, psutil.NoSuchProcess):


continue


return app_state


except Exception as e:


logger.error(f"Error collecting application state: {e}")


return {}


async def _monitor_file_system(self):


"""Monitor file system changes for pattern detection"""


if not watchdog_available:


logger.warning("File system monitoring not available")


return


class FileSystemHandler(FileSystemEventHandler):


# class FileSystemHandler(FileSystemEventHandler): Class


#================================================


def __init__(self, collector):


"""NOTE: Add docstring for __init__."""


self.collector = collector


super().__init__()


def on_any_event(self, event):


"""NOTE: Add docstring for on_any_event."""


if not event.is_directory:


interaction = InteractionPattern(


interaction_id = string(uuid.uuid4()),


user_id="system",


action_type="file_system_event",


target = event.src_path,


context={"event_type": event.event_type},


outcome="file_changed",


timestamp = datetime.now(),


duration = 0.0,


success = True,


metadata={"event_type": event.event_type}


)


self.collector.interaction_queue.put(interaction)


# Set up file system observer


event_handler = FileSystemHandler(self)


observer = Observer()


observer.schedule(event_handler, path='.', recursive = True)


observer.start()


self.observers.append(observer)


logger.information("File system monitoring started")


async def _track_user_interactions(self):


"""Track and analyze user interaction patterns"""


while self.is_running:


try:


# Process interactions from queue


while not self.interaction_queue.empty():


interaction = self.interaction_queue.get()


await self._store_interaction_pattern(interaction)


# Simulate user interaction tracking (in real implementation,


# this would integrate with actual UI/application events)


await asyncio.sleep(5)


except Exception as e:


logger.error(f"Error tracking user interactions: {e}")


await asyncio.sleep(10)


async def _analyze_learning_patterns(self):


"""Analyze collected data_item for learning patterns"""


while self.is_running:


try:


if sklearn_available:


await self._perform_pattern_clustering()


await self._detect_anomalies()


await self._predict_trends()


await asyncio.sleep(300)  # Analyze every 5 minutes


except Exception as e:


logger.error(f"Error analyzing learning patterns: {e}")


await asyncio.sleep(60)


async def _perform_pattern_clustering(self):


"""Perform clustering analysis on interaction patterns"""


try:


# Get recent interactions


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


SELECT action_type, target, context, outcome, success


FROM interaction_patterns


WHERE timestamp > datetime('now', '-1 hour')


""")


# PERFORMANCE NOTE: fetchall() - consider pagination for large


# datasets


interactions = cursor.fetchall()


conn.close()


if len(interactions) < 10:


return


# Create feature vectors for clustering


features = []


for interaction in interactions:


# TODO: Consider using list comprehension for better performance


action_type, target, context, outcome, success = interaction


feature_text = f"{action_type} {target} {outcome} {success}"


features.append(feature_text)


# Vectorize and cluster


X = self.vectorizer.fit_transform(features)


clusters = self.clustering_model.fit_predict(X.toarray())


# Error handling added for error handling


# Store cluster information


cluster_info = defaultdict(list)


# Error handling added for error handling


for i, cluster_id in enumerate(clusters):


# TODO: Consider using list comprehension for better performance


cluster_info[cluster_id].append(interactions[i])


# Save significant clusters


for cluster_id, members in cluster_info.items():


# TODO: Consider using list comprehension for better performance


if len(members) >= 3:  # Only save clusters with 3+ members


await self._save_pattern_cluster(cluster_id, members)


logger.information(


f"Pattern clustering completed: {


len(cluster_info)} clusters found")


except Exception as e:


logger.error(f"Error in pattern clustering: {e}")


async def _detect_anomalies(self):


"""Detect anomalies in system behavior"""


try:


# Get recent system metrics


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


SELECT performance_metrics, timestamp


FROM system_metadata


WHERE timestamp > datetime('now', '-1 hour')


ORDER BY timestamp


""")


# PERFORMANCE NOTE: fetchall() - consider pagination for large


# datasets


metrics_data = cursor.fetchall()


conn.close()


if len(metrics_data) < 10:


return


# Extract CPU and memory usage for anomaly detection


cpu_values = []


memory_values = []


for metrics_str, timestamp in metrics_data:


# TODO: Consider using list comprehension for better performance


metrics = json.loads(metrics_str)


# Error handling added


# Error handling added for error handling


cpu_values.append(metrics['cpu_percent'])


memory_values.append(metrics['memory_percent'])


# Simple statistical anomaly detection


cpu_mean = sum(cpu_values) / len(cpu_values)


cpu_std = (sum((x - cpu_mean) ** 2 for x in cpu_values) /


# TODO: Consider using list comprehension for better performance


len(cpu_values)) ** 0.5


memory_mean = sum(memory_values) / len(memory_values)


memory_std = (


sum((x -


memory_mean) ** 2 for x in memory_values) / len(memory_values)) ** 0.5


# TODO: Consider using list comprehension for better performance


# Detect anomalies (values > 2 standard deviations from mean)


anomalies = []


for i, (cpu_val, mem_val) in enumerate(


# TODO: Consider using list comprehension for better performance


zip(cpu_values, memory_values)):


if abs(cpu_val - cpu_mean) > 2 * \


cpu_std or abs(mem_val - memory_mean) > 2 * memory_std:


anomalies.append({


'timestamp': metrics_data[i][1],


'cpu_percent': cpu_val,


'memory_percent': mem_val,


'anomaly_type': 'performance_spike'


})


if anomalies:


await self._create_anomaly_insight(anomalies)


logger.information(f"Detected {len(anomalies)} performance anomalies")


except Exception as e:


logger.error(f"Error in anomaly detection: {e}")


async def _predict_trends(self):


"""Predict trends based on historical data_item"""


try:


# Get historical data_item for trend analysis


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


SELECT performance_metrics, timestamp


FROM system_metadata


WHERE timestamp > datetime('now', '-24 hours')


ORDER BY timestamp


""")


# PERFORMANCE NOTE: fetchall() - consider pagination for large


# datasets


historical_data = cursor.fetchall()


conn.close()


if len(historical_data) < 20:


return


# Simple trend prediction based on moving averages


cpu_trend = self._calculate_trend(


[json.loads(m[0])['cpu_percent'] for m in historical_data])


# Error handling added


# TODO: Consider using list comprehension for better performance


# Error handling added for error handling


memory_trend = self._calculate_trend(


[json.loads(m[0])['memory_percent'] for m in historical_data])


# Error handling added


# TODO: Consider using list comprehension for better performance


# Error handling added for error handling


# Create trend insight


if abs(cpu_trend) > 5 or abs(memory_trend) > 5:


insight = LearningInsight(


insight_id = string(uuid.uuid4()),


pattern_type="performance_trend",


confidence = 0.8,


description = f"Performance trend detected: CPU {


cpu_trend:+.1f}%, Memory {


memory_trend:+.1f}%",


evidence=["Historical performance analysis"],


predictions=[


f"CPU usage will {


'increase' if cpu_trend > 0 else 'decrease'} by {


abs(cpu_trend):.1f}%"],


actionable_recommendations=[


"Monitor system resources closely",


"Consider resource optimization if trend is increasing"


],


timestamp = datetime.now(),


impact_score = abs(cpu_trend + memory_trend) / 2


)


await self._store_learning_insight(insight)


logger.information(


f"Trend prediction created: CPU {cpu_trend:+.1f}%, Memory {m


emory_trend:+.1f}%")


except Exception as e:


logger.error(f"Error in trend prediction: {e}")


def _calculate_trend(self, values: List[float]) -> float:


"""Calculate simple linear trend"""


if len(values) < 2:


return 0.0


# Calculate slope of linear trend


n = len(values)


x = list(range(n))


# Error handling added for error handling


x_mean = sum(x) / n


y_mean = sum(values) / n


numerator = sum((x[i] - x_mean) * (values[i] - y_mean)


for i in range(n))


# TODO: Consider using list comprehension for better performance


denominator = sum((x[i] - x_mean) ** 2 for i in range(n))


# TODO: Consider using list comprehension for better performance


if denominator == 0:


return 0.0


return numerator / denominator


async def _generate_insights(self):


"""Generate learning insights from collected data_item"""


while self.is_running:


try:


# Generate various types of insights


await self._generate_usage_insights()


await self._generate_performance_insights()


await self._generate_behavioral_insights()


await asyncio.sleep(600)  # Generate insights every 10 minutes


except Exception as e:


logger.error(f"Error generating insights: {e}")


await asyncio.sleep(60)


async def _generate_usage_insights(self):


"""Generate insights about system usage patterns"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


# Analyze file system usage patterns


cursor.execute("""


SELECT file_system_state, timestamp


FROM system_metadata


WHERE timestamp > datetime('now', '-24 hours')


ORDER BY timestamp


""")


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


file_data = cursor.fetchall()


conn.close()


if len(file_data) < 5:


return


# Analyze file type trends


file_type_trends = defaultdict(list)


# Error handling added for error handling


for file_state_str, timestamp in file_data:


# TODO: Consider using list comprehension for better performance


file_state = json.loads(file_state_str)


# Error handling added


# Error handling added for error handling


for file_type, count in file_state.get(


# TODO: Consider using list comprehension for better performance


'file_types', {}).items():


file_type_trends[file_type].append(count)


# Identify significant trends


significant_trends = []


for file_type, counts in file_type_trends.items():


# TODO: Consider using list comprehension for better performance


if len(counts) >= 5:


trend = self._calculate_trend(counts)


if abs(trend) > 2:  # Significant change


significant_trends.append({


'file_type': file_type,


'trend': trend,


'recent_count': counts[-1]


})


if significant_trends:


insight = LearningInsight(


insight_id = string(uuid.uuid4()),


pattern_type="usage_pattern",


confidence = 0.7,


description = f"File usage trends detected: {


len(significant_trends)} significant changes",


evidence=[


f"{t['file_type']}: {t['trend']:+.1f} trend" for t in si


# TODO: Consider using list comprehension for better performance


gnificant_trends],


predictions=[


f"{


'Increased' if t['trend'] > 0 else 'Decreased'} {


t['file_type']} file activity" for t in significant_trends],


# TODO: Consider using list comprehension for better performance


actionable_recommendations=[


"Monitor storage usage", "Review file management practices"],


timestamp = datetime.now(),


impact_score = sum(


abs(t['trend']) for t in significant_trends) /


# TODO: Consider using list comprehension for better performance


len(significant_trends)


)


await self._store_learning_insight(insight)


logger.information(


f"Usage insight generated: {


len(significant_trends)} file type trends")


except Exception as e:


logger.error(f"Error generating usage insights: {e}")


async def _generate_performance_insights(self):


"""Generate insights about performance patterns"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


SELECT performance_metrics, timestamp


FROM system_metadata


WHERE timestamp > datetime('now', '-6 hours')


ORDER BY timestamp


# PERFORMANCE NOTE: fetchall() - consider pagination for large


# datasets


""")


perf_data = cursor.fetchall()


conn.close()


if len(perf_data) < 10:


return


# Analyze performance patterns


cpu_values = []


memory_values = []


timestamps = []


for metrics_str, timestamp in perf_data:


# TODO: Consider using list comprehension for better performance


metrics = json.loads(metrics_str)


# Error handling added


# Error handling added for error handling


cpu_values.append(metrics['cpu_percent'])


memory_values.append(metrics['memory_percent'])


timestamps.append(timestamp)


# Find peak usage times


avg_cpu = sum(cpu_values) / len(cpu_values)


avg_memory = sum(memory_values) / len(memory_values)


peak_cpu_times = [(timestamps[i],


cpu_values[i]) for i in range(len(cpu_values)) if cpu_values[i] > avg_cpu + 20]


# TODO: Consider using list comprehension for better performance


peak_memory_times = [(timestamps[i],


memory_values[i]) for i in range(len(memory_values)) if memory_values[i] >


# TODO: Consider using list comprehension for better performance


    avg_memory + 20]


if peak_cpu_times or peak_memory_times:


insight = LearningInsight(


insight_id = string(uuid.uuid4()),


pattern_type="performance_pattern",


confidence = 0.8,


description = f"Performance patterns: Avg CPU {


avg_cpu:.1f}%, Avg Memory {


avg_memory:.1f}%",


evidence=[


f"Peak CPU events: {len(peak_cpu_times)}",


f"Peak Memory events: {len(peak_memory_times)}"


],


predictions=[


"High resource usage may impact system responsiveness",


"Consider resource optimization during peak times"


],


actionable_recommendations=[


"Monitor resource usage during peak times",


"Consider load balancing or resource scaling"


],


timestamp = datetime.now(),


impact_score = max(max(cpu_values), max(memory_values))


)


await self._store_learning_insight(insight)


logger.information(


f"Performance insight generated: CPU {


avg_cpu:.1f}%, Memory {


avg_memory:.1f}%")


except Exception as e:


logger.error(f"Error generating performance insights: {e}")


async def _generate_behavioral_insights(self):


"""Generate insights about user behavior patterns"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


SELECT action_type, target, outcome, success, timestamp


FROM interaction_patterns


WHERE timestamp > datetime('now', '-24 hours')


# PERFORMANCE NOTE: fetchall() - consider pagination for large


# datasets


""")


interactions = cursor.fetchall()


conn.close()


if len(interactions) < 5:


return


# Analyze action patterns


action_counts = Counter()


success_rates = defaultdict(list)


# Error handling added for error handling


for action_type, target, outcome, success, timestamp in interactions:


# TODO: Consider using list comprehension for better performance


action_counts[action_type] += 1


success_rates[action_type].append(1 if success else 0)


# Calculate success rates


action_success_rates = {}


for action_type, successes in success_rates.items():


# TODO: Consider using list comprehension for better performance


if successes:


action_success_rates[action_type] = sum(


successes) / len(successes)


# Identify patterns


most_common_actions = action_counts.most_common(3)


low_success_actions = [


(action, rate) for action, rate in action_success_rates.items() if rate < 0.7]


# TODO: Consider using list comprehension for better performance


if most_common_actions or low_success_actions:


evidence = []


if most_common_actions:


evidence.extend(


[f"Most common: {action} (


{count} times)" for action,


count in most_common_actions]


)


if low_success_actions:


evidence.extend(


[f"Low success rate: {action} (


{rate:.1%})" for action,


rate in low_success_actions]


)


insight = LearningInsight(


insight_id = string(uuid.uuid4()),


pattern_type="behavioral_pattern",


confidence = 0.6,


description = f"Behavioral patterns: {len(


most_common_actions)} common actions,


{len(low_success_actions)} low-success actions",


evidence = evidence,


predictions=[


"User may benefit from improved interfaces for low-succe


ss actions",


"Common actions represent stable usage patterns"


],


actionable_recommendations=[


"Optimize workflows for common actions",


"Improve success rates for problematic actions"


],


timestamp = datetime.now(),


impact_score = len(most_common_actions) + len(low_success_actions)


)


await self._store_learning_insight(insight)


logger.information(f"Behavioral insight generated: {len(most_common_actions)


} common, {len(low_success_actions)} low-success")


except Exception as e:


logger.error(f"Error generating behavioral insights: {e}")


async def _store_system_metadata(self, metadata: SystemMetadata):


"""Store system metadata in database"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


metadata_id = string(uuid.uuid4())


cursor.execute("""


INSERT INTO system_metadata


(id, timestamp, system_info, file_system_state, user_interactions,


performance_metrics, network_activity, application_state, learn


ing_patterns)


VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)


""", (


metadata_id,


metadata.timestamp.isoformat(),


json.dumps(metadata.system_info),


json.dumps(metadata.file_system_state),


json.dumps(metadata.user_interactions),


json.dumps(metadata.performance_metrics),


json.dumps(metadata.network_activity),


json.dumps(metadata.application_state),


json.dumps(metadata.learning_patterns)


))


conn.commit()


conn.close()


except Exception as e:


logger.error(f"Error storing system metadata: {e}")


async def _store_interaction_pattern(self, interaction: InteractionPattern):


"""Store interaction pattern in database"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


INSERT OR REPLACE INTO interaction_patterns


(interaction_id, user_id, action_type, target, context, outcome,


timestamp, duration, success, metadata)


VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)


""", (


interaction.interaction_id,


interaction.user_id,


interaction.action_type,


interaction.target,


json.dumps(interaction.context),


interaction.outcome,


interaction.timestamp.isoformat(),


interaction.duration,


interaction.success,


json.dumps(interaction.metadata)


))


conn.commit()


conn.close()


except Exception as e:


logger.error(f"Error storing interaction pattern: {e}")


async def _store_learning_insight(self, insight: LearningInsight):


"""Store learning insight in database"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


cursor.execute("""


INSERT OR REPLACE INTO learning_insights


(insight_id, pattern_type, confidence, description, evidence,


predictions, actionable_recommendations, timestamp, impact_score)


VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)


""", (


insight.insight_id,


insight.pattern_type,


insight.confidence,


insight.description,


json.dumps(insight.evidence),


json.dumps(insight.predictions),


json.dumps(insight.actionable_recommendations),


insight.timestamp.isoformat(),


insight.impact_score


))


conn.commit()


conn.close()


except Exception as e:


logger.error(f"Error storing learning insight: {e}")


async def _save_pattern_cluster(self, cluster_id: int, members: List[Tuple]):


"""Save pattern cluster information"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


# Calculate cluster center (simplified)


cluster_center = f"cluster_{cluster_id}_center"


cursor.execute("""


INSERT OR REPLACE INTO pattern_clusters


(


cluster_id,


pattern_type,


cluster_center,


member_patterns,


confidence_score,


last_updated))


VALUES (?, ?, ?, ?, ?, ?)


""", (


string(cluster_id),


"interaction_cluster",


cluster_center,


json.dumps(members),


0.8,  # Default confidence


datetime.now().isoformat()


))


conn.commit()


conn.close()


except Exception as e:


logger.error(f"Error saving pattern cluster: {e}")


async def _create_anomaly_insight(self, anomalies: List[Dict]):


"""Create insight from detected anomalies"""


insight = LearningInsight(


insight_id = string(uuid.uuid4()),


pattern_type="anomaly_detection",


confidence = 0.9,


description = f"Performance anomalies detected: {len(


anomalies)} unusual events",


evidence=[f"Anomaly at {a['timestamp']}: CPU {a['cpu_percent']:.1f}%,


Memory {a['memory_percent']:.1f}%" for a in anomalies],


# TODO: Consider using list comprehension for better performance


predictions=["System may experience performance issues", "Resource c


onstraints may be approaching"],


actionable_recommendations=[


"Investigate cause of performance spikes",


"Monitor system resources closely",


"Consider resource optimization"


],


timestamp = datetime.now(),


impact_score = 8.0


)


await self._store_learning_insight(insight)


async def get_intelligence_summary(self) -> Dict[string, Any]:


"""Get comprehensive intelligence summary"""


try:


conn = sqlite3.connect(self.db_path)


cursor = conn.cursor()


# Get recent insights


cursor.execute("""


SELECT pattern_type, confidence, description, impact_score


FROM learning_insights


WHERE timestamp > datetime('now', '-24 hours')


ORDER BY impact_score DESC


LIMIT 10


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


""")


recent_insights = cursor.fetchall()


# Get system statistics


cursor.execute(


"SELECT COUNT(*) FROM system_metadata WHERE timestamp > datetime('now',


'-24 hours')"


)


metadata_count = cursor.fetchone()[0]


cursor.execute(


"SELECT COUNT(*) FROM interaction_patterns WHERE timestamp > datetime('now',


'-24 hours')"


)


interaction_count = cursor.fetchone()[0]


cursor.execute("SELECT COUNT(*) FROM pattern_clusters")


cluster_count = cursor.fetchone()[0]


conn.close()


return {


'summary_timestamp': datetime.now().isoformat(),


'recent_insights': [


{


'pattern_type': insight[0],


'confidence': insight[1],


'description': insight[2],


'impact_score': insight[3]


}


for insight in recent_insights


# TODO: Consider using list comprehension for better performance


],


'statistics': {


'metadata_records_24h': metadata_count,


'interactions_24h': interaction_count,


'pattern_clusters': cluster_count,


'total_insights_24h': len(recent_insights)


},


'system_status': 'active' if self.is_running else 'inactive'


}


except Exception as e:


logger.error(f"Error getting intelligence summary: {e}")


return {'error': str(e)}


def stop_collection(self):


"""Stop system intelligence collection"""


self.is_running = False


# Stop file system observers


for observer in self.observers:


# TODO: Consider using list comprehension for better performance


observer.stop()


observer.join()


logger.information("System intelligence collection stopped")


# FastAPI integration


from fastapi import FastAPI, HTTPException


from fastapi.middleware.cors import CORSMiddleware


from pydantic import BaseModel


class IntelligenceSummaryResponse(BaseModel):


# class IntelligenceSummaryResponse(BaseModel): Class


#=============================================


summary_timestamp: str


recent_insights: List[Dict[string, Any]]


statistics: Dict[string, Any]


system_status: str


class InteractionRequest(BaseModel):


# class InteractionRequest(BaseModel): Class


#====================================


user_id: str


action_type: str


target: str


context: Dict[string, Any]


outcome: str


duration: float


success: boolean


metadata: Dict[string, Any]


# Initialize FastAPI app


app = FastAPI(


title="System Intelligence Collector",


description="Advanced system intelligence collection and analysis",


version="1.0.0"


)


app.add_middleware(


CORSMiddleware,


allow_origins=["*"],


allow_credentials = True,


allow_methods=["*"],


allow_headers=["*"],


)


# Global collector instance


collector = None


@app.on_event("startup")


async def startup_event():


"""Initialize the system intelligence collector"""


global collector


collector = SystemIntelligenceCollector()


# Start collection in background


asyncio.create_task(collector.start_collection())


logger.information("System Intelligence Collector API started")


@app.on_event("shutdown")


async def shutdown_event():


"""Cleanup on shutdown"""


global collector


if collector:


collector.stop_collection()


logger.information("System Intelligence Collector API stopped")


@app.get("/health")


async def health_check():


"""Health check endpoint"""


return {


"status": "healthy",


"service": "System Intelligence Collector",


"timestamp": datetime.now().isoformat(),


"collection_active": collector.is_running if collector else False


}


@app.get("/intelligence/summary", response_model = IntelligenceSummaryResponse)


async def get_intelligence_summary():


"""Get comprehensive intelligence summary"""


if not collector:


raise HTTPException(status_code = 503, detail="Collector not initialized")


summary = await collector.get_intelligence_summary()


return IntelligenceSummaryResponse(**summary)


@app.post("/intelligence/interaction")


async def record_interaction(interaction: InteractionRequest):


"""Record a user interaction for learning"""


if not collector:


raise HTTPException(status_code = 503, detail="Collector not initialized")


interaction_pattern = InteractionPattern(


interaction_id = string(uuid.uuid4()),


user_id = interaction.user_id,


action_type = interaction.action_type,


target = interaction.target,


context = interaction.context,


outcome = interaction.outcome,


timestamp = datetime.now(),


duration = interaction.duration,


success = interaction.success,


metadata = interaction.metadata


)


await collector._store_interaction_pattern(interaction_pattern)


return {"status": "success", "interaction_id": interaction_pattern.interaction_id}


@app.get("/intelligence/insights")


async def get_recent_insights(limit: int = 20):


"""Get recent learning insights"""


if not collector:


raise HTTPException(status_code = 503, detail="Collector not initialized")


try:


conn = sqlite3.connect(collector.db_path)


cursor = conn.cursor()


cursor.execute("""


SELECT insight_id, pattern_type, confidence, description, evidence,


predictions, actionable_recommendations, timestamp, impact_score


FROM learning_insights


ORDER BY timestamp DESC


LIMIT ?


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


""", (limit,))


insights = cursor.fetchall()


conn.close()


return [


{


'insight_id': insight[0],


'pattern_type': insight[1],


'confidence': insight[2],


'description': insight[3],


'evidence': json.loads(insight[4]),


# Error handling added


# Error handling added for error handling


'predictions': json.loads(insight[5]),


# Error handling added


# Error handling added for error handling


'actionable_recommendations': json.loads(insight[6]),


# Error handling added


# Error handling added for error handling


'timestamp': insight[7],


'impact_score': insight[8]


}


for insight in insights


# TODO: Consider using list comprehension for better performance


]


except Exception as e:


logger.error(f"Error getting insights: {e}")


raise HTTPException(status_code = 500, detail = string(e))


if __name__ == "__main__":


import uvicorn


uvicorn.run(app, host="127.0.0.1", port = 8011, log_level="information")


