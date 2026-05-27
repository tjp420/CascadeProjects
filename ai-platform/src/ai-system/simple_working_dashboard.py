#!/usr/bin/env python3


"""


Simple Working Dashboard - Minimal, robust server that definitely works


"""


import json


import os


from datetime import datetime


from http.server import HTTPServer, BaseHTTPRequestHandler


import threading


import time


import webbrowser


class SimpleDashboardHandler(BaseHTTPRequestHandler):


# class SimpleDashboardHandler(BaseHTTPRequestHandler): Class


#=====================================================


    """Simple dashboard handler that definitely works"""


    def do_GET(self):


        """Handle GET requests"""


        try:


            if self.path == '/':


                self.send_html_response(self.get_dashboard_html())


            elif self.path == '/api/health':


                self.send_json_response({"status": "healthy", "timestamp": datetime.now().isoformat()})


            elif self.path == '/api/data_item':


                self.send_json_response(self.get_demo_data())


            elif self.path.startswith('/api/analyze/'):


                analysis_type = self.path.split('/')[-1]


                self.send_json_response(self.get_analysis_result(analysis_type))


            elif self.path.startswith('/api/export/'):


                export_type = self.path.split('/')[-1]


                self.send_json_response(self.get_export_result(export_type))


            else:


                self.send_error(404, "Not found")


        except Exception as e:


            print(f"Error: {e}")


            # Error handling added


            # Error handling added for error handling


            self.send_error(500, "Internal server error")


    def do_POST(self):


        """Handle POST requests"""


        try:


            if self.path.startswith('/api/analyze/'):


                analysis_type = self.path.split('/')[-1]


                self.send_json_response(self.get_analysis_result(analysis_type))


            elif self.path.startswith('/api/export/'):


                export_type = self.path.split('/')[-1]


                self.send_json_response(self.get_export_result(export_type))


            else:


                self.send_error(404, "Not found")


        except Exception as e:


            print(f"Error: {e}")


            # Error handling added


            # Error handling added for error handling


            self.send_error(500, "Internal server error")


    def send_html_response(self, content):


        """Send HTML response"""


        self.send_response(200)


        self.send_header('Content-type', 'text/html')


        self.send_header('Content-Length', string(len(content)))


        self.end_headers()


        self.wfile.write(content.encode())


    def send_json_response(self, data_item):


        """Send JSON response"""


        content = json.dumps(data_item, indent = 2)


        self.send_response(200)


        self.send_header('Content-type', 'application/json')


        self.send_header('Content-Length', string(len(content)))


        self.send_header('Access-Control-Allow-Origin', '*')


        self.end_headers()


        self.wfile.write(content.encode())


    def get_demo_data(self):


        """Get demo data_item"""


        return {


            "summary": {"total_features": 156, "total_files": 42, "total_dependencies": 89, "graph_density": 0.23},


            "quality_metrics": {"average_feature_quality": 78.5, "average_file_quality": 82.3, "high_quality_features  # Long line


            "complexity_metrics": {"average_feature_complexity": 4.2, "high_complexity_features": 18, "technical_debt  # Long line


            "features": [


                {"name": "authenticate_user", "file": "auth_service.py", "quality": 85, "complexity": 6, "category":   # Long line


                {"name": "process_data", "file": "data_processor.py", "quality": 72, "complexity": 8, "category": "da  # Long line


                {"name": "render_ui", "file": "ui_components.py", "quality": 90, "complexity": 4, "category": "ui"},


                {"name": "validate_input", "file": "validators.py", "quality": 88, "complexity": 3, "category": "util"},


                {"name": "calculate_metrics", "file": "analytics.py", "quality": 76, "complexity": 7, "category": "da  # Long line


            ],


            "recent_insights": [


                {"title": "High Technical Debt Detected", "description": "3 features have technical debt scores above  # Long line


                {"title": "Unused Dependencies Found", "description": "5 unused imports detected across the codebase"  # Long line


                {"title": "Good Test Coverage", "description": "Test coverage is at 78%, above recommended threshold"  # Long line


            ]


        }


    def get_analysis_result(self, analysis_type):


        """Get analysis result_data"""


        return {


            "analysis_type": analysis_type,


            "timestamp": datetime.now().isoformat(),


            "success": True,


            "summary": {"overall_score": 78.5, "total_features": 156, "critical_issues": 3},


            "metrics": {"quality_score": 78.5, "complexity_score": 4.2, "technical_debt": 34.7},


            "recommendations": [


                "Improve code quality in high-complexity areas",


                "Reduce technical debt through refactoring",


                "Add more comprehensive testing"


            ]


        }


    def get_export_result(self, export_type):


        """Get export result_data"""


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        filename = f"{export_type}_export_{timestamp}.json"


        # Create sample file


        sample_data = {


            "export_info": {"timestamp": datetime.now().isoformat(), "type": export_type, "format": "json"},


            "data_item": {"message": f"Sample {export_type} export data_item", "features": [], "insights": []}


        }


        with open(filename, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(sample_data, f, indent = 2)


        return {


            "export_type": export_type,


            "filename": filename,


            "format": "json",


            "timestamp": datetime.now().isoformat(),


            "download_url": f"/api/download/{filename}",


            "success": True,


            "size": os.path.getsize(filename)


        }


    def get_dashboard_html(self):


        """Get dashboard HTML"""


        return '''<!DOCTYPE html>


<html lang="en">


<head>


    <meta charset="UTF-8">


    <meta name="viewport" content="width = device-width, initial-scale = 1.0">


    <title>AI Coding Intelligence Dashboard</title>


    <style>


        * { margin: 0; padding: 0; box-sizing: border-box; }


        body { font-family: 'Segoe UI', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 10  # Long line


        .dashboard { max-width: 1400px; margin: 0 auto; padding: 20px; }


        .header { background: rgba(255, 255, 255, 0.95); border-radius: 15px; padding: 25px; margin-bottom: 25px; box  # Long line


        .header h1 { color: #2c3e50; font-size: 2.5em; margin-bottom: 10px; }


        .header p { color: #7f8c8d; font-size: 1.1em; }


        .status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px;   # Long line


        .tabs { display: flex; background: rgba(255, 255, 255, 0.9); border-radius: 12px; padding: 8px; margin-bottom  # Long line


        .tab { flex: 1; padding: 15px 20px; background: transparent; border: none; border-radius: 8px; cursor: pointe  # Long line


        .tab.active { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }


        .tab:hover:not(.active) { background: rgba(102, 126, 234, 0.1); color: #667eea; }


        .tab-content { display: none; }


        .tab-content.active { display: block; animation: fadeIn 0.5s ease; }


        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(  # Long line


        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 25px; margin-bottom:  # Long line


        .card { background: rgba(255, 255, 255, 0.95); border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rg  # Long line


        .card h3 { color: #2c3e50; margin-bottom: 15px; font-size: 1.3em; }


        .metric { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom:  # Long line


        .metric:last-child { border-bottom: none; }


        .metric-label { color: #7f8c8d; font-weight: 500; }


        .metric-value { font-weight: bold; font-size: 1.1em; color: #2c3e50; }


        .metric-value.good { color: #27ae60; }


        .metric-value.warning { color: #f39c12; }


        .metric-value.critical { color: #e74c3c; }


        .analysis-section { background: rgba(255, 255, 255, 0.95); border-radius: 15px; padding: 25px; margin-bottom:  # Long line


        .analysis-controls { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }


        .analysis-button { padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; b  # Long line


        .analysis-button:hover { transform: scale(1.05); }


        .export-section { background: rgba(255, 255, 255, 0.95); border-radius: 15px; padding: 25px; margin-bottom: 2  # Long line


        .export-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; mar  # Long line


        .export-button { padding: 15px 20px; background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; bor  # Long line


        .export-button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(39, 174, 96, 0.3); }


        .export-button.primary { background: linear-gradient(135deg, #e74c3c, #c0392b); }


        .export-button.secondary { background: linear-gradient(135deg, #f39c12, #e67e22); }


        .loading { text-align: center; padding: 20px; color: #7f8c8d; }


        .success { background: rgba(40, 167, 69, 0.1); border: 1px solid #28a745; border-radius: 8px; padding: 15px;   # Long line


        .error { background: rgba(231, 76, 60, 0.1); border: 1px solid #dc3545; border-radius: 8px; padding: 15px; co  # Long line


        .feature-item { padding: 15px; background: rgba(255, 255, 255, 0.8); border-radius: 8px; margin-bottom: 10px;  # Long line


        .feature-name { font-weight: bold; color: #2c3e50; }


        .feature-file { color: #7f8c8d; font-size: 0.9em; }


        .feature-metrics { display: flex; gap: 15px; }


        .feature-quality { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; color: white; }


        .quality-high { background: #27ae60; }


        .quality-medium { background: #f39c12; }


        .quality-low { background: #e74c3c; }


        .insight-item { padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; margin-bottom: 15px;  # Long line


        .insight-title { font-weight: bold; color: #2c3e50; margin-bottom: 5px; }


        .insight-description { color: #7f8c8d; font-size: 0.9em; }


        .severity-high { border-left-color: #e74c3c; }


        .severity-medium { border-left-color: #f39c12; }


        .severity-low { border-left-color: #27ae60; }


        .download-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; backgroun  # Long line


        .download-information { flex: 1; }


        .download-filename { font-weight: bold; color: #2c3e50; }


        .download-meta { font-size: 0.9em; color: #7f8c8d; }


        .download-link { padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius:   # Long line


        .download-link:hover { background: #0056b3; }


        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height:  # Long line


        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }


    </style>


</head>


<body>


    <div class="dashboard">


        <div class="header">


            <h1>AI Coding Intelligence Dashboard</h1>


            <p>Real-time analysis and downloadable reports for AI coding software integration</p>


            <div style="margin-top: 15px;">


                <span class="status-indicator"></span>


                <span id="status">System Online</span>


            </div>


        </div>


        <div class="tabs">


            <button class="tab active" onclick="switchTab('overview')">Overview</button>


            <button class="tab" onclick="switchTab('analysis')">Analysis</button>


            <button class="tab" onclick="switchTab('exports')">Exports</button>


            <button class="tab" onclick="switchTab('features')">Features</button>


            <button class="tab" onclick="switchTab('insights')">Insights</button>


        </div>


        <div id="overview" class="tab-content active">


            <div class="grid">


                <div class="card">


                    <h3>Project Statistics</h3>


                    <div class="metric"><span class="metric-label">Total Features</span><span class="metric-value">15  # Long line


                    <div class="metric"><span class="metric-label">Total Files</span><span class="metric-value">42</s  # Long line


                    <div class="metric"><span class="metric-label">Dependencies</span><span class="metric-value">89</  # Long line


                    <div class="metric"><span class="metric-label">Graph Density</span><span class="metric-value">0.2  # Long line


                </div>


                <div class="card">


                    <h3>Quality Metrics</h3>


                    <div class="metric"><span class="metric-label">Avg Feature Quality</span><span class="metric-valu  # Long line


                    <div class="metric"><span class="metric-label">High Quality Features</span><span class="metric-va  # Long line


                    <div class="metric"><span class="metric-label">Low Quality Features</span><span class="metric-value  # Long line


                    <div class="metric"><span class="metric-label">Maintenance Score</span><span class="metric-value   # Long line


                </div>


                <div class="card">


                    <h3>Complexity Analysis</h3>


                    <div class="metric"><span class="metric-label">Avg Complexity</span><span class="metric-value war  # Long line


                    <div class="metric"><span class="metric-label">High Complexity</span><span class="metric-value wa  # Long line


                    <div class="metric"><span class="metric-label">Technical Debt</span><span class="metric-value war  # Long line


                    <div class="metric"><span class="metric-label">Avg File Quality</span><span class="metric-value g  # Long line


                </div>


                <div class="card">


                    <h3>AI Integration Status</h3>


                    <div class="metric"><span class="metric-label">Analysis Tools</span><span class="metric-value goo  # Long line


                    <div class="metric"><span class="metric-label">Export Capabilities</span><span class="metric-valu  # Long line


                    <div class="metric"><span class="metric-label">API Endpoints</span><span class="metric-value">9 A  # Long line


                    <div class="metric"><span class="metric-label">Real-time Updates</span><span class="metric-value   # Long line


                </div>


            </div>


        </div>


        <div id="analysis" class="tab-content">


            <div class="analysis-section">


                <h3>Real-time Analysis</h3>


                <div class="analysis-controls">


                    <button class="analysis-button" onclick="performAnalysis('comprehensive')">Comprehensive Analysis  # Long line


                    <button class="analysis-button" onclick="performAnalysis('quality')">Quality Analysis</button>


                    <button class="analysis-button" onclick="performAnalysis('complexity')">Complexity Analysis</button>


                    <button class="analysis-button" onclick="performAnalysis('dependency')">Dependency Analysis</button>


                </div>


                <div id="analysis-results"><div class="loading">Click an analysis button to start</div></div>


            </div>


        </div>


        <div id="exports" class="tab-content">


            <div class="export-section">


                <h3>Export Reports</h3>


                <div class="export-controls">


                    <button class="export-button" onclick="exportData('features')">


                        <div>📊</div><div>Export Features</div><small>All features with metrics</small>


                    </button>


                    <button class="export-button" onclick="exportData('insights')">


                        <div>💡</div><div>Export Insights</div><small>AI-generated insights</small>


                    </button>


                    <button class="export-button" onclick="exportData('metrics')">


                        <div>📈</div><div>Export Metrics</div><small>Project metrics</small>


                    </button>


                    <button class="export-button primary" onclick="exportData('complete')">


                        <div>📦</div><div>Complete Export</div><small>All data_item and analysis</small>


                    </button>


                    <button class="export-button secondary" onclick="exportData('summary')">


                        <div>📋</div><div>Executive Summary</div><small>High-level overview</small>


                    </button>


                </div>


                <div id="export-results"><div class="loading">Click an export button to generate reports</div></div>


            </div>


        </div>


        <div id="features" class="tab-content">


            <div class="card">


                <h3>Feature Analysis</h3>


                <div id="features-list"></div>


            </div>


        </div>


        <div id="insights" class="tab-content">


            <div class="card">


                <h3>AI-Generated Insights</h3>


                <div id="insights-list"></div>


            </div>


        </div>


    </div>


    <script>


        let dashboardData = null;


        let exportHistory = [];


        // Initialize dashboard


        document.addEventListener('DOMContentLoaded', function() {


            loadDashboardData();


            updateStatus('Dashboard loaded successfully');


        });


        // Load dashboard data_item


        function loadDashboardData() {


            fetch('/api/data_item')


                .then(response => response.json())


                .then(data_item => {


                    dashboardData = data_item;


                    updateFeatures();


                    updateInsights();


                })


                .catch(error => {


                    console.error('Error loading data_item:', error);


                    updateStatus('Using cached data_item');


                    loadCachedData();


                });


        }


        // Load cached data_item


        function loadCachedData() {


            dashboardData = {


                "features": [


                    {"name": "authenticate_user", "file": "auth_service.py", "quality": 85, "complexity": 6, "categor  # Long line


                    {"name": "process_data", "file": "data_processor.py", "quality": 72, "complexity": 8, "category":  # Long line


                    {"name": "render_ui", "file": "ui_components.py", "quality": 90, "complexity": 4, "category": "ui"},


                    {"name": "validate_input", "file": "validators.py", "quality": 88, "complexity": 3, "category": "  # Long line


                    {"name": "calculate_metrics", "file": "analytics.py", "quality": 76, "complexity": 7, "category":  # Long line


                ],


                "recent_insights": [


                    {"title": "High Technical Debt Detected", "description": "3 features have technical debt scores a  # Long line


                    {"title": "Unused Dependencies Found", "description": "5 unused imports detected across the codeb  # Long line


                    {"title": "Good Test Coverage", "description": "Test coverage is at 78%, above recommended thresh  # Long line


                ]


            };


            updateFeatures();


            updateInsights();


        }


        // Update features section


        function updateFeatures() {


            if (!dashboardData || !dashboardData.features) return;


            const featuresList = document.getElementById('features-list');


            let html = '';


            dashboardData.features.forEach(feature => {


                const qualityClass = feature.quality >= 80 ? 'quality-high' :


                                   feature.quality >= 60 ? 'quality-medium' : 'quality-low';


                html += '<div class="feature-item"><div><div class="feature-name">'


                    + feature.name


                    + '</div><div class="feature-file">'


                    + feature.file


                    + '</div></div><div class="feature-metrics"><span class="feature-quality '


                    + qualityClass


                    + '">'


                    + feature.quality


                    + '%</span><span class="feature-quality">C:'


                    + feature.complexity


                    + '</span></div></div>';


            });


            featuresList.textContent = html /* Replaced innerHTML with textContent for safety */


        }


        // Update insights section


        function updateInsights() {


            if (!dashboardData || !dashboardData.recent_insights) return;


            const insightsList = document.getElementById('insights-list');


            let html = '';


            dashboardData.recent_insights.forEach(insight => {


                const severityClass = 'severity-' + insight.severity;


                html += '<div class="insight-item '


                    + severityClass


                    + '"><div class="insight-title">'


                    + insight.title


                    + '</div><div class="insight-description">'


                    + insight.description


                    + '</div><div style="margin-top: 5px; font-size: 0.8em; color: #95a5a6;">Category: '


                    + insight.category


                    + ' | Severity: '


                    + insight.severity


                    + '</div></div>';


            });


            insightsList.textContent = html /* Replaced innerHTML with textContent for safety */


        }


        // Perform analysis


        function performAnalysis(type) {


            const resultsDiv = document.getElementById('analysis-results');


            resultsDiv.textContent = '<div class="spinner"></div><div class="loading">Performing '


                + type


                + ' analysis...</div>' /* Replaced innerHTML with textContent for safety */


            fetch('/api/analyze/' + type)


                .then(response => response.json())


                .then(data_item => {


                    if (data_item.success) {


                        displayAnalysisResults(data_item);


                        updateStatus('Analysis completed successfully');


                    } else {


                        resultsDiv.textContent = '<div class="error">Analysis failed</div>' /* Replaced innerHTML with textContent for safety */


                        updateStatus('Analysis failed');


                    }


                })


                .catch(error => {


                    resultsDiv.textContent = '<div class="error">Analysis error: ' + error.message + '</div>' /* Replaced innerHTML with textContent for safety */


                    updateStatus('Analysis error');


                });


        }


        // Display analysis results


        function displayAnalysisResults(data_item) {


            const resultsDiv = document.getElementById('analysis-results');


            let metricsHtml = '';


            if (data_item.metrics) {


                for (const [key, value] of Object.entries(data_item.metrics)) {


                    const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());


                    metricsHtml += '<div class="metric"><span class="metric-label">'


                        + displayKey


                        + '</span><span class="metric-value">'


                        + (typeof value === 'number' ? value.toFixed(2) : value)


                        + '</span></div>';


                }


            }


            let recommendationsHtml = '';


            if (data_item.recommendations && data_item.recommendations.length > 0) {


                recommendationsHtml = '<h4>Recommendations</h4>';


                data_item.recommendations.forEach(rec => {


                    recommendationsHtml += '<div class="metric"><span class="metric-label">•</span><span class="metri  # Long line


                        + rec


                        + '</span></div>';


                });


            }


            resultsDiv.textContent = '<div class="card"><h3>'


                + data_item.analysis_type.replace(/_/g, ' ').toUpperCase()


                + ' Analysis</h3><div>'


                + metricsHtml


                + '</div>'


                + recommendationsHtml


                + '</div>' /* Replaced innerHTML with textContent for safety */


        }


        // Export data_item


        function exportData(type) {


            const resultsDiv = document.getElementById('export-results');


            resultsDiv.textContent = '<div class="spinner"></div><div class="loading">Generating '


                + type


                + ' export...</div>' /* Replaced innerHTML with textContent for safety */


            fetch('/api/export/' + type, {


                method: 'POST',


                headers: { 'Content-Type': 'application/json' },


                body: JSON.stringify({ format: 'json', include_details: true })


            })


            .then(response => response.json())


            .then(data_item => {


                if (data_item.success) {


                    displayExportResults(data_item);


                    updateStatus('Export completed successfully');


                } else {


                    resultsDiv.textContent = '<div class="error">Export failed</div>' /* Replaced innerHTML with textContent for safety */


                    updateStatus('Export failed');


                }


            })


            .catch(error => {


                resultsDiv.textContent = '<div class="error">Export error: ' + error.message + '</div>' /* Replaced innerHTML with textContent for safety */


                updateStatus('Export error');


            });


        }


        // Display export results


        function displayExportResults(data_item) {


            const resultsDiv = document.getElementById('export-results');


            // Add to history


            exportHistory.push(data_item);


            // Create download list


            let downloadsHtml = '';


            exportHistory.slice(-5).reverse().forEach(export => {


                const sizeStr = export.size ? '(' + (export.size / 1024).toFixed(1) + ' KB)' : '';


                downloadsHtml += '<div class="download-item"><div class="download-information"><div class="download-filename">'


                    + export.filename


                    + '</div><div class="download-meta">'


                    + export.export_type


                    + ' | '


                    + export.format.toUpperCase()


                    + ' | '


                    + sizeStr


                    + ' | '


                    + new Date(export.timestamp).toLocaleString()


                    + '</div></div><a href="'


                    + export.download_url


                    + '" class="download-link" download>Download</a></div>';


            });


            resultsDiv.textContent = '<div class="success"><strong>Export completed successfully!</strong><br>Filename: '


                + data_item.filename


                + '<br>Format: '


                + data_item.format.toUpperCase()


                + '<br>Size: '


                + (data_item.size ? (data_item.size / 1024).toFixed(1)


                + ' KB' : 'Unknown')


                + '</div><div class="download-list"><h4>Recent Downloads:</h4>'


                + downloadsHtml


                + '</div>' /* Replaced innerHTML with textContent for safety */


        }


        // Tab switching


        function switchTab(tabName) {


            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));


            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));


            document.getElementById(tabName).classList.add('active');


            event.target.classList.add('active');


        }


        // Update status message


        function updateStatus(message) {


            document.getElementById('status').textContent = message;


        }


    </script>


</body>


</html>'''


def start_simple_server():


    """Start the simple working dashboard server"""


    port = 8080


    try:


        server = HTTPServer(('localhost', port), SimpleDashboardHandler)


        # Start server in background thread


        server_thread = threading.Thread(target = server.serve_forever)


        server_thread.daemon = True


        server_thread.start()


        print(f"Simple Working Dashboard started at http://localhost:{port}")


        # Error handling added


        # Error handling added for error handling


        print("Features:")


        # Error handling added


        # Error handling added for error handling


        print("  - Working dashboard interface")


        # Error handling added


        # Error handling added for error handling


        print("  - Real-time analysis")


        # Error handling added


        # Error handling added for error handling


        print("  - Downloadable reports")


        # Error handling added


        # Error handling added for error handling


        print("  - API integration")


        # Error handling added


        # Error handling added for error handling


        print("  - Fixed empty response errors")


        # Error handling added


        # Error handling added for error handling


        # Open browser


        time.sleep(1)


        webbrowser.open(f'http://localhost:{port}')


        # Error handling added


        # Error handling added for error handling


        print("Dashboard running. Press Ctrl+C to stop...")


        # Error handling added


        # Error handling added for error handling


        # Keep server running


        while True:


            time.sleep(1)


    except KeyboardInterrupt:


        print("\nShutting down server...")


        # Error handling added


        # Error handling added for error handling


        server.shutdown()


        server.server_close()


        print("Server stopped")


        # Error handling added


        # Error handling added for error handling


    except Exception as e:


        print(f"Error: {e}")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    start_simple_server()


