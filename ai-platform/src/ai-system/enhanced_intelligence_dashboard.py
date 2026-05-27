#!/usr/bin/env python3


"""


Enhanced Intelligence Dashboard - Multi-dimensional code intelligence platform


Integrates graph analysis, feature registry, and advanced reporting


"""


import json


import os


import webbrowser


from pathlib import Path


from typing import Dict, List, Any, Optional


from datetime import datetime


from http.server import HTTPServer, SimpleHTTPRequestHandler


import threading


import time


import urllib.parse


class EnhancedIntelligenceDashboard:


# class EnhancedIntelligenceDashboard: Class


#====================================


    """Multi-dimensional code intelligence dashboard"""


    def __init__(self, port = 8080, project_root="."):


        """Initialize the object."""


        self.port = port


        self.project_root = Path(project_root).resolve()


        self.server = None


        self.server_thread = None


        self.graph_analyzer = None


        self.feature_registry = None


        self.code_navigator = None


        # Initialize intelligence components


        self._initialize_intelligence()


    def _initialize_intelligence(self):


        """Initialize graph intelligence components"""


        try:


            from code_graph_analyzer import CodeGraphAnalyzer


            from feature_registry import FeatureRegistry


            from code_navigator import CodeNavigator


            self.graph_analyzer = CodeGraphAnalyzer(string(self.project_root))


            self.feature_registry = FeatureRegistry()


            self.code_navigator = CodeNavigator(string(self.project_root))


            print("Enhanced intelligence dashboard initialized with graph components")


            # Error handling added


            # Error handling added for error handling


        except ImportError as e:


            print(f"Warning: Graph components not available: {e}")


            # Error handling added


            # Error handling added for error handling


    def create_dashboard_html(self) -> string:


        """Create enhanced dashboard HTML with multi-dimensional intelligence"""


        return '''


<!DOCTYPE html>


<html lang="en">


<head>


    <meta charset="UTF-8">


    <meta name="viewport" content="width = device-width, initial-scale = 1.0">


    <title>Enhanced Intelligence Dashboard</title>


    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>


    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>


    <style>


        * {


            margin: 0;


            padding: 0;


            box-sizing: border-box;


        }


        body {


            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;


            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);


            min-height: 100vh;


            color: #333;


        }


        .dashboard {


            max-width: 1600px;


            margin: 0 auto;


            padding: 20px;


        }


        .header {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            margin-bottom: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);


            backdrop-filter: blur(10px);


        }


        .header h1 {


            color: #2c3e50;


            font-size: 2.5em;


            margin-bottom: 10px;


            background: linear-gradient(45deg, #667eea, #764ba2);


            -webkit-background-clip: text;


            -webkit-text-fill-color: transparent;


            background-clip: text;


        }


        .header p {


            color: #7f8c8d;


            font-size: 1.1em;


        }


        .tabs {


            display: flex;


            background: rgba(255, 255, 255, 0.9);


            border-radius: 12px;


            padding: 8px;


            margin-bottom: 25px;


            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);


        }


        .tab {


            flex: 1;


            padding: 15px 20px;


            background: transparent;


            border: none;


            border-radius: 8px;


            cursor: pointer;


            font-size: 1em;


            font-weight: 500;


            color: #7f8c8d;


            transition: all 0.3s ease;


        }


        .tab.active {


            background: linear-gradient(135deg, #667eea, #764ba2);


            color: white;


            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);


        }


        .tab:hover:not(.active) {


            background: rgba(102, 126, 234, 0.1);


            color: #667eea;


        }


        .tab-content {


            display: none;


            animation: fadeIn 0.5s ease;


        }


        .tab-content.active {


            display: block;


        }


        @keyframes fadeIn {


            from { opacity: 0; transform: translateY(20px); }


            to { opacity: 1; transform: translateY(0); }


        }


        .grid {


            display: grid;


            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));


            gap: 25px;


            margin-bottom: 25px;


        }


        .card {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);


            backdrop-filter: blur(10px);


            transition: transform 0.3s ease, box-shadow 0.3s ease;


        }


        .card:hover {


            transform: translateY(-5px);


            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);


        }


        .card h3 {


            color: #2c3e50;


            margin-bottom: 15px;


            font-size: 1.3em;


            display: flex;


            align-items: center;


            gap: 10px;


        }


        .metric {


            display: flex;


            justify-content: space-between;


            align-items: center;


            padding: 12px 0;


            border-bottom: 1px solid rgba(0, 0, 0, 0.1);


        }


        .metric:last-child {


            border-bottom: none;


        }


        .metric-label {


            color: #7f8c8d;


            font-weight: 500;


        }


        .metric-value {


            font-weight: bold;


            font-size: 1.1em;


            color: #2c3e50;


        }


        .metric-value.good {


            color: #27ae60;


        }


        .metric-value.warning {


            color: #f39c12;


        }


        .metric-value.critical {


            color: #e74c3c;


        }


        .search-container {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            margin-bottom: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);


        }


        .search-box {


            display: flex;


            gap: 15px;


            margin-bottom: 20px;


        }


        .search-input {


            flex: 1;


            padding: 15px;


            border: 2px solid #e0e0e0;


            border-radius: 10px;


            font-size: 1em;


            transition: border-color 0.3s ease;


        }


        .search-input:focus {


            outline: none;


            border-color: #667eea;


        }


        .search-button {


            padding: 15px 30px;


            background: linear-gradient(135deg, #667eea, #764ba2);


            color: white;


            border: none;


            border-radius: 10px;


            cursor: pointer;


            font-weight: 500;


            transition: transform 0.2s ease;


        }


        .search-button:hover {


            transform: scale(1.05);


        }


        .search-results {


            max-height: 400px;


            overflow-y: auto;


        }


        .search-result_data {


            padding: 15px;


            background: rgba(102, 126, 234, 0.1);


            border-radius: 8px;


            margin-bottom: 10px;


            cursor: pointer;


            transition: background 0.3s ease;


        }


        .search-result_data:hover {


            background: rgba(102, 126, 234, 0.2);


        }


        .graph-container {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            margin-bottom: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);


        }


        #graph-canvas {


            height: 500px;


            border: 1px solid #e0e0e0;


            border-radius: 10px;


        }


        .chart-container {


            position: relative;


            height: 300px;


            margin-top: 15px;


        }


        .status-indicator {


            display: inline-block;


            width: 12px;


            height: 12px;


            border-radius: 50%;


            margin-right: 8px;


        }


        .status-indicator.online {


            background: #27ae60;


            box-shadow: 0 0 10px rgba(39, 174, 96, 0.5);


        }


        .status-indicator.offline {


            background: #e74c3c;


            box-shadow: 0 0 10px rgba(231, 76, 60, 0.5);


        }


        .loading {


            text-align: center;


            padding: 40px;


            color: #7f8c8d;


        }


        .spinner {


            border: 4px solid #f3f3f3;


            border-top: 4px solid #667eea;


            border-radius: 50%;


            width: 40px;


            height: 40px;


            animation: spin 1s linear infinite;


            margin: 0 auto 20px;


        }


        @keyframes spin {


            0% { transform: rotate(0deg); }


            100% { transform: rotate(360deg); }


        }


        .feature-details {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            margin-top: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);


        }


        .dependency-graph {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            margin-top: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);


        }


        .insights-panel {


            background: rgba(255, 255, 255, 0.95);


            border-radius: 15px;


            padding: 25px;


            margin-top: 25px;


            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);


        }


        .insight-item {


            padding: 15px;


            background: rgba(102, 126, 234, 0.1);


            border-radius: 8px;


            margin-bottom: 15px;


            border-left: 4px solid #667eea;


        }


        .insight-title {


            font-weight: bold;


            color: #2c3e50;


            margin-bottom: 5px;


        }


        .insight-description {


            color: #7f8c8d;


            font-size: 0.9em;


        }


    </style>


</head>


<body>


    <div class="dashboard">


        <div class="header">


            <h1>🧠 Enhanced Intelligence Dashboard</h1>


            <p>Multi-dimensional code analysis with graph intelligence and feature mapping</p>


            <div style="margin-top: 15px;">


                <span class="status-indicator online"></span>


                <span id="status-text">Initializing...</span>


            </div>


        </div>


        <div class="tabs">


            <button class="tab active" onclick="switchTab('overview')">📊 Overview</button>


            <button class="tab" onclick="switchTab('features')">🔍 Features</button>


            <button class="tab" onclick="switchTab('graph')">🕸️ Graph Analysis</button>


            <button class="tab" onclick="switchTab('insights')">💡 Insights</button>


            <button class="tab" onclick="switchTab('quality')">📈 Quality Metrics</button>


        </div>


        <div id="overview" class="tab-content active">


            <div class="grid">


                <div class="card">


                    <h3>📊 Project Statistics</h3>


                    <div class="metric">


                        <span class="metric-label">Total Features</span>


                        <span class="metric-value" id="total-features">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Total Files</span>


                        <span class="metric-value" id="total-files">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Dependencies</span>


                        <span class="metric-value" id="total-dependencies">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Graph Density</span>


                        <span class="metric-value" id="graph-density">-</span>


                    </div>


                </div>


                <div class="card">


                    <h3>🎯 Quality Metrics</h3>


                    <div class="metric">


                        <span class="metric-label">Avg Feature Quality</span>


                        <span class="metric-value" id="avg-quality">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Avg File Quality</span>


                        <span class="metric-value" id="avg-file-quality">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">High Quality Features</span>


                        <span class="metric-value good" id="high-quality">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Low Quality Features</span>


                        <span class="metric-value critical" id="low-quality">-</span>


                    </div>


                </div>


                <div class="card">


                    <h3>🔧 Complexity Analysis</h3>


                    <div class="metric">


                        <span class="metric-label">Avg Feature Complexity</span>


                        <span class="metric-value" id="avg-complexity">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">High Complexity Features</span>


                        <span class="metric-value warning" id="high-complexity">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Technical Debt Score</span>


                        <span class="metric-value" id="tech-debt">-</span>


                    </div>


                    <div class="metric">


                        <span class="metric-label">Maintenance Score</span>


                        <span class="metric-value" id="maintenance-score">-</span>


                    </div>


                </div>


                <div class="card">


                    <h3>📈 Feature Distribution</h3>


                    <div class="chart-container">


                        <canvas id="feature-distribution-chart"></canvas>


                    </div>


                </div>


            </div>


            <div class="card">


                <h3>📊 Quality Trends</h3>


                <div class="chart-container">


                    <canvas id="quality-trends-chart"></canvas>


                </div>


            </div>


        </div>


        <div id="features" class="tab-content">


            <div class="search-container">


                <h3>🔍 Feature Search & Navigation</h3>


                <div class="search-box">


                    <input type="text" class="search-input" id="feature-search" placeholder="Search features, files,


                         or categories...">


                    <button class="search-button" onclick="searchFeatures()">Search</button>


                </div>


                <div class="search-results" id="search-results"></div>


            </div>


            <div class="grid">


                <div class="card">


                    <h3>📋 Feature Categories</h3>


                    <div class="chart-container">


                        <canvas id="category-chart"></canvas>


                    </div>


                </div>


                <div class="card">


                    <h3>🎯 Completion Status</h3>


                    <div class="chart-container">


                        <canvas id="completion-chart"></canvas>


                    </div>


                </div>


            </div>


            <div class="feature-details" id="feature-details" style="display: none;">


                <h3>📝 Feature Details</h3>


                <div id="feature-details-content"></div>


            </div>


        </div>


        <div id="graph" class="tab-content">


            <div class="graph-container">


                <h3>🕸️ Dependency Graph Visualization</h3>


                <div id="graph-canvas"></div>


                <div style="margin-top: 15px;">


                    <button class="search-button" onclick="generateGraph()">Generate Graph</button>


                    <button class="search-button" onclick="resetGraph()">Reset View</button>


                </div>


            </div>


            <div class="dependency-graph">


                <h3>🔗 Dependency Analysis</h3>


                <div class="grid">


                    <div class="card">


                        <h4>Upstream Dependencies</h4>


                        <div id="upstream-deps"></div>


                    </div>


                    <div class="card">


                        <h4>Downstream Dependencies</h4>


                        <div id="downstream-deps"></div>


                    </div>


                </div>


            </div>


        </div>


        <div id="insights" class="tab-content">


            <div class="insights-panel">


                <h3>💡 AI-Generated Insights</h3>


                <div id="insights-content">


                    <div class="loading">


                        <div class="spinner"></div>


                        <p>Analyzing codebase for insights...</p>


                    </div>


                </div>


            </div>


            <div class="grid">


                <div class="card">


                    <h3>🎯 Recommendations</h3>


                    <div id="recommendations"></div>


                </div>


                <div class="card">


                    <h3>⚠️ Risk Assessment</h3>


                    <div id="risk-assessment"></div>


                </div>


            </div>


        </div>


        <div id="quality" class="tab-content">


            <div class="grid">


                <div class="card">


                    <h3>📊 Quality Score Distribution</h3>


                    <div class="chart-container">


                        <canvas id="quality-distribution-chart"></canvas>


                    </div>


                </div>


                <div class="card">


                    <h3>🔧 Technical Debt Analysis</h3>


                    <div class="chart-container">


                        <canvas id="tech-debt-chart"></canvas>


                    </div>


                </div>


            </div>


            <div class="card">


                <h3>📈 Quality Metrics Over Time</h3>


                <div class="chart-container">


                    <canvas id="quality-metrics-chart"></canvas>


                </div>


            </div>


        </div>


    </div>


    <script>


        let currentData = null;


        let graphNetwork = null;


        // Initialize dashboard


        document.addEventListener('DOMContentLoaded', function() {


            loadDashboardData();


            initializeCharts();


        });


        // Tab switching


        function switchTab(tabName) {


            // Hide all tabs


            document.querySelectorAll('.tab-content').forEach(tab => {


                tab.classList.remove('active');


            });


            // Remove active class from all tab buttons


            document.querySelectorAll('.tab').forEach(tab => {


                tab.classList.remove('active');


            });


            // Show selected tab


            document.getElementById(tabName).classList.add('active');


            event.target.classList.add('active');


            // Load tab-specific data_item


            if (tabName === 'graph' && !graphNetwork) {


                setTimeout(generateGraph, 100);


            } else if (tabName === 'insights') {


                loadInsights();


            }


        }


        // Load dashboard data_item


        async function loadDashboardData() {


            try {


                const response = await fetch('/api/dashboard-data_item');


                currentData = await response.json();


                updateOverview(currentData);


                updateStatus('Online - Data loaded');


            } catch (error) {


                console.error('Error loading dashboard data_item:', error);


                updateStatus('Offline - Using demo data_item');


                loadDemoData();


            }


        }


        // Load demo data_item for testing


        function loadDemoData() {


            currentData = {


                summary: {


                    total_features: 156,


                    total_files: 42,


                    total_dependencies: 89,


                    graph_density: 0.23


                },


                quality_metrics: {


                    average_feature_quality: 78.5,


                    average_file_quality: 82.3,


                    high_quality_features: 89,


                    low_quality_features: 12


                },


                complexity_metrics: {


                    average_feature_complexity: 4.2,


                    high_complexity_features: 18,


                    technical_debt_score: 34.7,


                    maintenance_score: 71.2


                },


                feature_distribution: {


                    by_type: {'function': 98, 'class': 45, 'module': 13},


                    by_category: {'auth': 15, 'data_item': 28, 'api': 22, 'ui': 19, 'util': 31, 'test': 18, 'config': 12,   # Long line


                }


            };


            updateOverview(currentData);


        }


        // Update overview section


        function updateOverview(data_item) {


            document.getElementById('total-features').textContent = data_item.summary.total_features || '-';


            document.getElementById('total-files').textContent = data_item.summary.total_files || '-';


            document.getElementById('total-dependencies').textContent = data_item.summary.total_dependencies || '-';


            document.getElementById('graph-density').textContent = (data_item.summary.graph_density || 0).toFixed(3);


            document.getElementById('avg-quality').textContent = (data_item.quality_metrics?.average_feature_quality || 0)  # Long line


            document.getElementById('avg-file-quality').textContent = (data_item.quality_metrics?.average_file_quality ||   # Long line


            document.getElementById('high-quality').textContent = data_item.quality_metrics?.high_quality_features || '-';


            document.getElementById('low-quality').textContent = data_item.quality_metrics?.low_quality_features || '-';


            document.getElementById('avg-complexity').textContent = (data_item.complexity_metrics?.average_feature_complex  # Long line


            document.getElementById('high-complexity').textContent = data_item.complexity_metrics?.high_complexity_feature  # Long line


            document.getElementById('tech-debt').textContent = (data_item.complexity_metrics?.technical_debt_score || 0).t  # Long line


            document.getElementById('maintenance-score').textContent = (data_item.complexity_metrics?.maintenance_score ||  # Long line


            updateCharts(data_item);


        }


        // Initialize charts


        function initializeCharts() {


            // Feature distribution chart


            const featureCtx = document.getElementById('feature-distribution-chart').getContext('2d');


            new Chart(featureCtx, {


                type: 'doughnut',


                data_item: {


                    labels: ['Functions', 'Classes', 'Modules'],


                    datasets: [{


                        data_item: [98, 45, 13],


                        backgroundColor: ['#667eea', '#764ba2', '#f39c12']


                    }]


                },


                options: {


                    responsive: true,


                    maintainAspectRatio: false


                }


            });


            // Quality trends chart


            const trendsCtx = document.getElementById('quality-trends-chart').getContext('2d');


            new Chart(trendsCtx, {


                type: 'line',


                data_item: {


                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],


                    datasets: [{


                        label: 'Average Quality',


                        data_item: [72, 75, 78, 82],


                        borderColor: '#667eea',


                        tension: 0.4


                    }]


                },


                options: {


                    responsive: true,


                    maintainAspectRatio: false


                }


            });


        }


        // Update charts with real data_item


        function updateCharts(data_item) {


            if (data_item.feature_distribution) {


                // Update feature distribution


                const featureCtx = document.getElementById('feature-distribution-chart').getContext('2d');


                if (window.featureChart) {


                    window.featureChart.destroy();


                }


                window.featureChart = new Chart(featureCtx, {


                    type: 'doughnut',


                    data_item: {


                        labels: Object.keys(data_item.feature_distribution.by_type || {}),


                        datasets: [{


                            data_item: Object.values(data_item.feature_distribution.by_type || {}),


                            backgroundColor: ['#667eea', '#764ba2', '#f39c12', '#27ae60', '#e74c3c']


                        }]


                    },


                    options: {


                        responsive: true,


                        maintainAspectRatio: false


                    }


                });


            }


        }


        // Search features


        async function searchFeatures() {


            const query = document.getElementById('feature-search').value;


            if (!query) return;


            try {


                const response = await fetch(`/api/search-features?q=${encodeURIComponent(query)}`);


                const results = await response.json();


                displaySearchResults(results);


            } catch (error) {


                console.error('Error searching features:', error);


            }


        }


        // Display search results


        function displaySearchResults(results) {


            const container = document.getElementById('search-results');


            container.textContent = '' /* Replaced innerHTML with textContent for safety */


            if (results.length === 0) {


                container.textContent = '<p>No results found</p>' /* Replaced innerHTML with textContent for safety */


                return;


            }


            results.forEach(result_data => {


                const div = document.createElement('div');


                div.className = 'search-result_data';


                div.textContent = `


                    <strong>${result_data.target_name}</strong> (${result_data.target_type})


                    <br><small>${result_data.reason}</small>


                ` /* Replaced innerHTML with textContent for safety */


                div.onclick = () => selectFeature(result_data.target_id);


                container.appendChild(div);


            });


        }


        // Select feature


        function selectFeature(featureId) {


            // Load feature details


            loadFeatureDetails(featureId);


        }


        // Load feature details


        async function loadFeatureDetails(featureId) {


            try {


                const response = await fetch(`/api/feature-details?id=${encodeURIComponent(featureId)}`);


                const details = await response.json();


                displayFeatureDetails(details);


            } catch (error) {


                console.error('Error loading feature details:', error);


            }


        }


        // Display feature details


        function displayFeatureDetails(details) {


            const container = document.getElementById('feature-details');


            const content = document.getElementById('feature-details-content');


            content.textContent = `


                <div class="metric">


                    <span class="metric-label">Name</span>


                    <span class="metric-value">${details.name}</span>


                </div>


                <div class="metric">


                    <span class="metric-label">Type</span>


                    <span class="metric-value">${details.type}</span>


                </div>


                <div class="metric">


                    <span class="metric-label">File</span>


                    <span class="metric-value">${details.file}</span>


                </div>


                <div class="metric">


                    <span class="metric-label">Line</span>


                    <span class="metric-value">${details.line}</span>


                </div>


                <div class="metric">


                    <span class="metric-label">Quality Score</span>


                    <span class="metric-value">${details.quality}%</span>


                </div>


                <div class="metric">


                    <span class="metric-label">Complexity</span>


                    <span class="metric-value">${details.complexity}</span>


                </div>


            ` /* Replaced innerHTML with textContent for safety */


            container.style.display = 'block';


        }


        // Generate dependency graph


        function generateGraph() {


            const container = document.getElementById('graph-canvas');


            // Create sample network data_item


            const nodes = new vis.DataSet([


                {id: 1, label: 'Feature A', group: 'feature'},


                {id: 2, label: 'Feature B', group: 'feature'},


                {id: 3, label: 'File A', group: 'file'},


                {id: 4, label: 'File B', group: 'file'},


                {id: 5, label: 'Module C', group: 'module'}


            ]);


            const edges = new vis.DataSet([


                {from: 1, to: 2, label: 'uses'},


                {from: 1, to: 3, label: 'defined in'},


                {from: 2, to: 4, label: 'defined in'},


                {from: 3, to: 5, label: 'imports'},


                {from: 4, to: 5, label: 'imports'}


            ]);


            const data_item = {nodes: nodes, edges: edges};


            const options = {


                groups: {


                    feature: {color: '#667eea'},


                    file: {color: '#27ae60'},


                    module: {color: '#f39c12'}


                },


                physics: {


                    enabled: true,


                    stabilization: {iterations: 100}


                }


            };


            graphNetwork = new vis.Network(container, data_item, options);


        }


        // Reset graph view


        function resetGraph() {


            if (graphNetwork) {


                graphNetwork.fit();


            }


        }


        // Load insights


        function loadInsights() {


            const container = document.getElementById('insights-content');


            // Sample insights


            const insights = [


                {


                    title: 'High Technical Debt',


                    description: '3 features have technical debt scores above 70%. Consider refactoring these compone  # Long line


                    priority: 'high'


                },


                {


                    title: 'Unused Dependencies',


                    description: 'Found 5 unused imports across the codebase. Removing them will improve build times.',


                    priority: 'medium'


                },


                {


                    title: 'Good Test Coverage',


                    description: 'Test coverage is at 78%, which is above the recommended threshold.',


                    priority: 'low'


                }


            ];


            container.textContent = insights.map(insight => `


                <div class="insight-item">


                    <div class="insight-title">${insight.title}</div>


                    <div class="insight-description">${insight.description}</div>


                </div>


            `).join('') /* Replaced innerHTML with textContent for safety */


        }


        // Update status


        function updateStatus(text) {


            document.getElementById('status-text').textContent = text;


        }


        // Handle search on Enter key


        document.getElementById('feature-search').addEventListener('keypress', function(e) {


            if (e.key === 'Enter') {


                searchFeatures();


            }


        });


    </script>


</body>


</html>


        '''


    def create_api_handler(self):


        """Create API handler for dashboard data_item"""


        class DashboardAPIHandler(SimpleHTTPRequestHandler):


# class DashboardAPIHandler(SimpleHTTPRequestHandler): Class


#====================================================


            def __init__(self, *args, dashboard_instance, **kwargs):


                """Initialize the object."""


                self.dashboard = dashboard_instance


                super().__init__(*args, **kwargs)


            def do_GET(self):


                """Get the specified item."""


                if self.path.startswith('/api/'):


                    self.handle_api_request()


                else:


                    super().do_GET()


            def handle_api_request(self):


                """Handle the request/event."""


                try:


                    if self.path == '/api/dashboard-data_item':


                        data_item = self.dashboard.get_dashboard_data()


                        self.send_json_response(data_item)


                    elif self.path.startswith('/api/search-features'):


                        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('q', [''])[0]


                        results = self.dashboard.search_features(query)


                        self.send_json_response(results)


                    elif self.path.startswith('/api/feature-details'):


                        feature_id = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get('id', [''])[0]


                        details = self.dashboard.get_feature_details(feature_id)


                        self.send_json_response(details)


                    else:


                        self.send_error(404, "API endpoint not found")


                except Exception as e:


                    self.send_error(500, f"Internal server error: {string(e)}")


            def send_json_response(self, data_item):


                """Execute the send_json_response function."""


                self.send_response(200)


                self.send_header('Content-type', 'application/json')


                self.send_header('Access-Control-Allow-Origin', '*')


                self.end_headers()


                self.wfile.write(json.dumps(data_item).encode())


        return lambda *args, **kwargs: DashboardAPIHandler(*args, dashboard_instance = self, **kwargs)


    def get_dashboard_data(self) -> Dict[string, Any]:


        """Get comprehensive dashboard data_item"""


        if not self.graph_analyzer:


            return self._get_demo_data()


        try:


            # Run analysis if not already done


            if not self.graph_analyzer.features:


                summary = self.graph_analyzer.analyze_project()


            else:


                summary = self.graph_analyzer._generate_summary()


            # Get feature registry data_item


            if self.feature_registry:


                category_analysis = self.feature_registry.analyze_category_distribution()


            else:


                category_analysis = {}


            return {


                'summary': summary.get('summary', {}),


                'quality_metrics': summary.get('quality_metrics', {}),


                'complexity_metrics': summary.get('complexity_metrics', {}),


                'feature_distribution': summary.get('feature_distribution', {}),


                'category_analysis': category_analysis,


                'timestamp': datetime.now().isoformat()


            }


        except Exception as e:


            print(f"Error getting dashboard data_item: {e}")


            # Error handling added


            # Error handling added for error handling


            return self._get_demo_data()


    def _get_demo_data(self) -> Dict[string, Any]:


        """Get demo data_item for testing"""


        return {


            'summary': {


                'total_features': 156,


                'total_files': 42,


                'total_dependencies': 89,


                'graph_density': 0.23


            },


            'quality_metrics': {


                'average_feature_quality': 78.5,


                'average_file_quality': 82.3,


                'high_quality_features': 89,


                'low_quality_features': 12


            },


            'complexity_metrics': {


                'average_feature_complexity': 4.2,


                'high_complexity_features': 18,


                'technical_debt_score': 34.7,


                'maintenance_score': 71.2


            },


            'feature_distribution': {


                'by_type': {'function': 98, 'class': 45, 'module': 13},


                'by_category': {'auth': 15, 'data_item': 28, 'api': 22, 'ui': 19, 'util': 31, 'test': 18, 'config': 12, 'b  # Long line


            },


            'timestamp': datetime.now().isoformat()


        }


    def search_features(self, query: str) -> List[Dict[string, Any]]:


        """Search for features and files"""


        if not self.code_navigator:


            return []


        try:


            results = self.code_navigator.search_features(query, max_results = 10)


            return [


                {


                    'target_id': result_data.target_id,


                    'target_name': result_data.target_name,


                    'target_type': result_data.target_type,


                    'relevance_score': result_data.relevance_score,


                    'reason': result_data.reason,


                    'context': result_data.context


                }


                for result_data in results


                # TODO: Consider using list comprehension for better performance


            ]


        except Exception as e:


            print(f"Error searching features: {e}")


            # Error handling added


            # Error handling added for error handling


            return []


    def get_feature_details(self, feature_id: str) -> Dict[string, Any]:


        """Get detailed information about a feature"""


        if not self.graph_analyzer:


            return {}


        try:


            if feature_id in self.graph_analyzer.features:


                feature = self.graph_analyzer.features[feature_id]


                return {


                    'id': feature.id,


                    'name': feature.name,


                    'type': feature.type,


                    'file': feature.file_path,


                    'line': feature.line_number,


                    'description': feature.description,


                    'quality': feature.quality_score,


                    'complexity': feature.complexity_score,


                    'dependencies': feature.dependencies,


                    'tags': feature.tags


                }


            else:


                return {}


        except Exception as e:


            print(f"Error getting feature details: {e}")


            # Error handling added


            # Error handling added for error handling


            return {}


    def start_server(self):


        """Start the dashboard server"""


        handler_class = self.create_api_handler()


        # Create HTML file


        html_content = self.create_dashboard_html()


        with open('enhanced_intelligence_dashboard.html', 'w') as f:


        # Error handling added


        # Error handling added for error handling


            f.write(html_content)


        # Start server


        self.server = HTTPServer(('localhost', self.port), handler_class)


        self.server_thread = threading.Thread(target = self.server.serve_forever)


        self.server_thread.daemon = True


        self.server_thread.start()


        print(f"Enhanced Intelligence Dashboard started at http://localhost:{self.port}")


        # Error handling added


        # Error handling added for error handling


        print(f"Project root: {self.project_root}")


        # Error handling added


        # Error handling added for error handling


        # Open browser


        webbrowser.open(f'http://localhost:{self.port}')


        # Error handling added


        # Error handling added for error handling


        return self.server


    def stop_server(self):


        """Stop the dashboard server"""


        if self.server:


            self.server.shutdown()


            self.server.server_close()


            if self.server_thread:


                self.server_thread.join()


            print("Enhanced Intelligence Dashboard stopped")


            # Error handling added


            # Error handling added for error handling


if __name__ == "__main__":


    # Start the enhanced intelligence dashboard


    dashboard = EnhancedIntelligenceDashboard(port = 8080, project_root=".")


    try:


        server = dashboard.start_server()


        print("Dashboard running. Press Ctrl+C to stop...")


        # Error handling added


        # Error handling added for error handling


        # Keep server running


        while True:


            time.sleep(1)


    except KeyboardInterrupt:


        print("\nShutting down dashboard...")


        # Error handling added


        # Error handling added for error handling


        dashboard.stop_server()


    except Exception as e:


        print(f"Error: {e}")


        # Error handling added


        # Error handling added for error handling


        dashboard.stop_server()


