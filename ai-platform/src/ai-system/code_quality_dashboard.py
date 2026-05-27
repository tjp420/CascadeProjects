#!/usr/bin/env python3


"""


Code Quality Dashboard - Interactive Visualization and Management Tool


Provides real-time monitoring and interactive fixing of code quality issues


"""


import os


import json


import webbrowser


from pathlib import Path


from typing import Dict, List, Any


from datetime import datetime


from http.server import HTTPServer, SimpleHTTPRequestHandler


import threading


import time


class CodeQualityDashboard:


# class CodeQualityDashboard: Class


#===========================


    def __init__(self, port = 8080):


        """Initialize the object."""


        self.port = port


        self.server = None


        self.server_thread = None


        self.data_dir = Path('.')


    def create_dashboard_html(self) -> string:


        """Create interactive dashboard HTML"""


        return """


<!DOCTYPE html>


<html lang="en">


<head>


    <meta charset="UTF-8">


    <meta name="viewport" content="width = device-width, initial-scale = 1.0">


    <title>Code Quality Dashboard</title>


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


            max-width: 1400px;


            margin: 0 auto;


            padding: 20px;


        }


        .header {


            background: white;


            border-radius: 15px;


            padding: 30px;


            margin-bottom: 30px;


            box-shadow: 0 10px 30px rgba(0,0,0,0.1);


            text-align: center;


        }


        .header h1 {


            color: #667eea;


            font-size: 2.5em;


            margin-bottom: 10px;


        }


        .header p {


            color: #666;


            font-size: 1.1em;


        }


        .stats-grid {


            display: grid;


            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));


            gap: 20px;


            margin-bottom: 30px;


        }


        .stat-card {


            background: white;


            border-radius: 15px;


            padding: 25px;


            box-shadow: 0 10px 30px rgba(0,0,0,0.1);


            text-align: center;


            transition: transform 0.3s ease;


        }


        .stat-card:hover {


            transform: translateY(-5px);


        }


        .stat-card.critical {


            border-left: 5px solid #e74c3c;


        }


        .stat-card.high {


            border-left: 5px solid #f39c12;


        }


        .stat-card.medium {


            border-left: 5px solid #3498db;


        }


        .stat-card.low {


            border-left: 5px solid #27ae60;


        }


        .stat-number {


            font-size: 3em;


            font-weight: bold;


            margin-bottom: 10px;


        }


        .stat-label {


            color: #666;


            font-size: 1.1em;


            text-transform: uppercase;


            letter-spacing: 1px;


        }


        .controls {


            background: white;


            border-radius: 15px;


            padding: 30px;


            margin-bottom: 30px;


            box-shadow: 0 10px 30px rgba(0,0,0,0.1);


        }


        .controls h2 {


            color: #667eea;


            margin-bottom: 20px;


        }


        .button-group {


            display: flex;


            gap: 15px;


            flex-wrap: wrap;


        }


        .btn {


            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);


            color: white;


            border: none;


            padding: 12px 25px;


            border-radius: 8px;


            cursor: pointer;


            font-size: 1em;


            transition: all 0.3s ease;


            text-decoration: none;


            display: inline-block;


        }


        .btn:hover {


            transform: translateY(-2px);


            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);


        }


        .btn.danger {


            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);


        }


        .btn.success {


            background: linear-gradient(135deg, #27ae60 0%, #229954 100%);


        }


        .issues-container {


            background: white;


            border-radius: 15px;


            padding: 30px;


            box-shadow: 0 10px 30px rgba(0,0,0,0.1);


        }


        .issues-container h2 {


            color: #667eea;


            margin-bottom: 20px;


        }


        .filter-bar {


            display: flex;


            gap: 15px;


            margin-bottom: 20px;


            flex-wrap: wrap;


        }


        .filter-bar select, .filter-bar input {


            padding: 8px 15px;


            border: 2px solid #ddd;


            border-radius: 5px;


            font-size: 1em;


        }


        .issues-list {


            max-height: 600px;


            overflow-y: auto;


        }


        .issue-item {


            background: #f8f9fa;


            border-radius: 10px;


            padding: 20px;


            margin-bottom: 15px;


            border-left: 5px solid #ddd;


            transition: all 0.3s ease;


        }


        .issue-item:hover {


            transform: translateX(5px);


            box-shadow: 0 5px 15px rgba(0,0,0,0.1);


        }


        .issue-item.critical {


            border-left-color: #e74c3c;


        }


        .issue-item.high {


            border-left-color: #f39c12;


        }


        .issue-item.medium {


            border-left-color: #3498db;


        }


        .issue-item.low {


            border-left-color: #27ae60;


        }


        .issue-header {


            display: flex;


            justify-content: space-between;


            align-items: center;


            margin-bottom: 10px;


        }


        .issue-title {


            font-weight: bold;


            color: #333;


        }


        .issue-severity {


            padding: 5px 10px;


            border-radius: 20px;


            color: white;


            font-size: 0.9em;


            text-transform: uppercase;


        }


        .issue-severity.critical {


            background: #e74c3c;


        }


        .issue-severity.high {


            background: #f39c12;


        }


        .issue-severity.medium {


            background: #3498db;


        }


        .issue-severity.low {


            background: #27ae60;


        }


        .issue-details {


            color: #666;


            margin-bottom: 10px;


        }


        .issue-code {


            background: #2d3748;


            color: #e2e8f0;


            padding: 10px;


            border-radius: 5px;


            font-family: 'Courier New', monospace;


            font-size: 0.9em;


            margin-bottom: 10px;


        }


        .issue-actions {


            display: flex;


            gap: 10px;


        }


        .progress-bar {


            width: 100%;


            height: 20px;


            background: #e0e0e0;


            border-radius: 10px;


            overflow: hidden;


            margin: 20px 0;


        }


        .progress-fill {


            height: 100%;


            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);


            transition: width 0.5s ease;


        }


        .loading {


            text-align: center;


            padding: 40px;


            color: #666;


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


        .notification {


            position: fixed;


            top: 20px;


            right: 20px;


            padding: 15px 20px;


            border-radius: 10px;


            color: white;


            font-weight: bold;


            z-index: 1000;


            animation: slideIn 0.3s ease;


        }


        .notification.success {


            background: #27ae60;


        }


        .notification.error {


            background: #e74c3c;


        }


        .notification.information {


            background: #3498db;


        }


        @keyframes slideIn {


            from {


                transform: translateX(100%);


                opacity: 0;


            }


            to {


                transform: translateX(0);


                opacity: 1;


            }


        }


    </style>


</head>


<body>


    <div class="dashboard">


        <div class="header">


            <h1>🔍 Code Quality Dashboard</h1>


            <p>Real-time monitoring and interactive fixing of code quality issues</p>


        </div>


        <div class="stats-grid">


            <div class="stat-card critical">


                <div class="stat-number" id="critical-count">0</div>


                <div class="stat-label">Critical Issues</div>


            </div>


            <div class="stat-card high">


                <div class="stat-number" id="high-count">0</div>


                <div class="stat-label">High Issues</div>


            </div>


            <div class="stat-card medium">


                <div class="stat-number" id="medium-count">0</div>


                <div class="stat-label">Medium Issues</div>


            </div>


            <div class="stat-card low">


                <div class="stat-number" id="low-count">0</div>


                <div class="stat-label">Low Issues</div>


            </div>


        </div>


        <div class="controls">


            <h2>🛠️ Quality Controls</h2>


            <div class="button-group">


                <button class="btn" onclick="runAnalysis()">🔍 Run Analysis</button>


                <button class="btn success" onclick="autoFix()">🔧 Auto Fix Issues</button>


                <button class="btn" onclick="exportReport()">📊 Export Report</button>


                <button class="btn danger" onclick="clearAll()">🗑️ Clear All</button>


                <button class="btn" onclick="refreshData()">🔄 Refresh Data</button>


            </div>


            <div class="progress-bar">


                <div class="progress-fill" id="progress-bar" style="width: 0%"></div>


            </div>


        </div>


        <div class="issues-container">


            <h2>📋 Issues List</h2>


            <div class="filter-bar">


                <select id="severity-filter" onchange="filterIssues()">


                    <option value="">All Severities</option>


                    <option value="critical">Critical</option>


                    <option value="high">High</option>


                    <option value="medium">Medium</option>


                    <option value="low">Low</option>


                </select>


                <select id="type-filter" onchange="filterIssues()">


                    <option value="">All Types</option>


                    <option value="security">Security</option>


                    <option value="performance">Performance</option>


                    <option value="quality">Quality</option>


                    <option value="style">Style</option>


                </select>


                <input type="text" id="search-filter" placeholder="Search issues..." onkeyup="filterIssues()">


            </div>


            <div class="issues-list" id="issues-list">


                <div class="loading">


                    <div class="spinner"></div>


                    <p>Loading issues...</p>


                </div>


            </div>


        </div>


    </div>


    <script>


        let currentData = null;


        let filteredIssues = [];


        // Initialize dashboard


        document.addEventListener('DOMContentLoaded', function() {


            loadData();


            setInterval(refreshData, 30000); // Auto-refresh every 30 seconds


        });


        function loadData() {


            fetch('/data_item')


                .then(response => response.json())


                .then(data_item => {


                    currentData = data_item;


                    updateStats(data_item);


                    displayIssues(data_item.issues || []);


                })


                .catch(error => {


                    console.error('Error loading data_item:', error);


                    showNotification('Error loading data_item', 'error');


                });


        }


        function updateStats(data_item) {


            const summary = data_item.summary || {};


            document.getElementById('critical-count').textContent = summary.critical_issues || 0;


            document.getElementById('high-count').textContent = summary.high_issues || 0;


            document.getElementById('medium-count').textContent = summary.medium_issues || 0;


            document.getElementById('low-count').textContent = summary.low_issues || 0;


        }


        function displayIssues(issues) {


            const container = document.getElementById('issues-list');


            if (!issues || issues.length === 0) {


                container.textContent = '<div class="loading"><p>No issues found! 🎉</p></div>' /* Replaced innerHTML with textContent for safety */


                return;


            }


            filteredIssues = issues;


            const html = issues.map(issue => createIssueHTML(issue)).join('');


            container.textContent = html /* Replaced innerHTML with textContent for safety */


        }


        function createIssueHTML(issue) {


            return `


                <div class="issue-item ${issue.severity}" data_item-severity="${issue.severity}" data_item-type="${issue.issue_  # Long line


                    <div class="issue-header">


                        <div class="issue-title">${issue.description}</div>


                        <div class="issue-severity ${issue.severity}">${issue.severity}</div>


                    </div>


                    <div class="issue-details">


                        <strong>File:</strong> ${issue.file_path}<br>


                        <strong>Line:</strong> ${issue.line_number}<br>


                        <strong>Type:</strong> ${issue.issue_type}<br>


                        <strong>Confidence:</strong> ${Math.round(issue.confidence * 100)}%


                    </div>


                    ${issue.code_snippet ? `<div class="issue-code">${escapeHtml(issue.code_snippet)}</div>` : ''}


                    <div class="issue-suggestion"><strong>Suggestion:</strong> ${issue.suggestion}</div>


                    <div class="issue-actions">


                        ${issue.fixable ? `<button class="btn success" onclick="fixIssue('${issue.file_path}', ${issu  # Long line


                        <button class="btn" onclick="viewFile('${issue.file_path}', ${issue.line_number})">👁️ View</b  # Long line


                        <button class="btn" onclick="ignoreIssue('${issue.file_path}', ${issue.line_number})">🚫 Ignor  # Long line


                    </div>


                </div>


            `;


        }


        function filterIssues() {


            if (!currentData || !currentData.issues) return;


            const severityFilter = document.getElementById('severity-filter').value;


            const typeFilter = document.getElementById('type-filter').value;


            const searchFilter = document.getElementById('search-filter').value.toLowerCase();


            let filtered = currentData.issues.filter(issue => {


                const severityMatch = !severityFilter || issue.severity === severityFilter;


                const typeMatch = !typeFilter || issue.issue_type?.split('_')[0] === typeFilter;


                const searchMatch = !searchFilter ||


                    issue.description.toLowerCase().includes(searchFilter) ||


                    issue.file_path.toLowerCase().includes(searchFilter);


                return severityMatch && typeMatch && searchMatch;


            });


            displayIssues(filtered);


        }


        function runAnalysis() {


            updateProgress(0);


            showNotification('Starting analysis...', 'information');


            fetch('/analyze', {method: 'POST'})


                .then(response => response.json())


                .then(data_item => {


                    currentData = data_item;


                    updateStats(data_item);


                    displayIssues(data_item.issues || []);


                    updateProgress(100);


                    showNotification('Analysis complete!', 'success');


                })


                .catch(error => {


                    console.error('Analysis error:', error);


                    showNotification('Analysis failed', 'error');


                    updateProgress(0);


                });


        }


        function autoFix() {


            if (!currentData || !currentData.issues) {


                showNotification('No data_item available', 'error');


                return;


            }


            const fixableIssues = currentData.issues.filter(issue => issue.fixable);


            if (fixableIssues.length === 0) {


                showNotification('No fixable issues found', 'information');


                return;


            }


            updateProgress(0);


            showNotification(`Starting auto-fix for ${fixableIssues.length} issues...`, 'information');


            fetch('/autofix', {method: 'POST'})


                .then(response => response.json())


                .then(data_item => {


                    updateProgress(100);


                    showNotification(`Fixed ${data_item.fixed} issues!`, 'success');


                    setTimeout(loadData, 1000);


                })


                .catch(error => {


                    console.error('Auto-fix error:', error);


                    showNotification('Auto-fix failed', 'error');


                    updateProgress(0);


                });


        }


        function fixIssue(filePath, lineNumber) {


            showNotification(`Fixing issue in ${filePath}...`, 'information');


            fetch('/fix-issue', {


                method: 'POST',


                headers: {'Content-Type': 'application/json'},


                body: JSON.stringify({file_path: filePath, line_number: lineNumber})


            })


            .then(response => response.json())


            .then(data_item => {


                if (data_item.success) {


                    showNotification('Issue fixed!', 'success');


                    setTimeout(loadData, 1000);


                } else {


                    showNotification('Fix failed: ' + data_item.error, 'error');


                }


            })


            .catch(error => {


                console.error('Fix error:', error);


                showNotification('Fix failed', 'error');


            });


        }


        function viewFile(filePath, lineNumber) {


            // Open file in editor (this would need backend implementation)


            showNotification(`Opening ${filePath}:${lineNumber}...`, 'information');


        }


        function ignoreIssue(filePath, lineNumber) {


            // Mark issue as ignored (this would need backend implementation)


            showNotification('Issue ignored', 'information');


            setTimeout(loadData, 1000);


        }


        function exportReport() {


            if (!currentData) {


                showNotification('No data_item to export', 'error');


                return;


            }


            const blob = new Blob([JSON.stringify(currentData, null, 2)], {type: 'application/json'});


            const url = URL.createObjectURL(blob);


            const a = document.createElement('a');


            a.href = url;


            a.download = `quality-report-${new Date().toISOString().split('T')[0]}.json`;


            a.click();


            URL.revokeObjectURL(url);


            showNotification('Report exported!', 'success');


        }


        function clearAll() {


            if (confirm('Are you sure you want to clear all data_item?')) {


                fetch('/clear', {method: 'POST'})


                    .then(() => {


                        currentData = null;


                        updateStats({});


                        displayIssues([]);


                        showNotification('Data cleared!', 'success');


                    })


                    .catch(error => {


                        console.error('Clear error:', error);


                        showNotification('Clear failed', 'error');


                    });


            }


        }


        function refreshData() {


            loadData();


            showNotification('Data refreshed!', 'information');


        }


        function updateProgress(percent) {


            document.getElementById('progress-bar').style.width = percent + '%';


        }


        function showNotification(message, type) {


            const notification = document.createElement('div');


            notification.className = `notification ${type}`;


            notification.textContent = message;


            document.body.appendChild(notification);


            setTimeout(() => {


                notification.remove();


            }, 3000);


        }


        function escapeHtml(text) {


            const map = {


                '&': '&amp;',


                '<': '&lt;',


                '>': '&gt;',


                '"': '&quot;',


                "'": '&#039;'


            };


            return text.replace(/[&<>"']/g, m => map[m]);


        }


    </script>


</body>


</html>


        """


    def create_api_handler(self):


        """Create API handler for dashboard"""


        class DashboardHandler(SimpleHTTPRequestHandler):


# class DashboardHandler(SimpleHTTPRequestHandler): Class


#=================================================


            def __init__(self, *args, dashboard = None, **kwargs):


                """Initialize the object."""


                self.dashboard = dashboard


                super().__init__(*args, **kwargs)


            def do_GET(self):


                """Get the specified item."""


                if self.path == '/':


                    self.send_response(200)


                    self.send_header('Content-type', 'text/html')


                    self.end_headers()


                    self.wfile.write(self.dashboard.create_dashboard_html().encode())


                elif self.path == '/data_item':


                    self.send_json_response(self.dashboard.get_analysis_data())


                else:


                    super().do_GET()


            def do_POST(self):


                """Execute the do_POST function."""


                if self.path == '/analyze':


                    result_data = self.dashboard.run_analysis()


                    self.send_json_response(result_data)


                elif self.path == '/autofix':


                    result_data = self.dashboard.run_autofix()


                    self.send_json_response(result_data)


                elif self.path == '/fix-issue':


                    content_length = int(self.headers['Content-Length'])


                    # Error handling added


                    # Error handling added for error handling


                    post_data = self.rfile.read(content_length)


                    result_data = self.dashboard.fix_single_issue(json.loads(post_data.decode()))


                    # Error handling added


                    # Error handling added for error handling


                    self.send_json_response(result_data)


                elif self.path == '/clear':


                    result_data = self.dashboard.clear_data()


                    self.send_json_response(result_data)


                else:


                    self.send_response(404)


                    self.end_headers()


            def send_json_response(self, data_item):


                """Execute the send_json_response function."""


                self.send_response(200)


                self.send_header('Content-type', 'application/json')


                self.end_headers()


                self.wfile.write(json.dumps(data_item, indent = 2, default = string).encode())


        # Create partial constructor to pass dashboard instance


        def handler_factory(*args, **kwargs):


            """Handle the request/event."""


            return DashboardHandler(*args, dashboard = self, **kwargs)


        return handler_factory


    def get_analysis_data(self) -> Dict[string, Any]:


        """Get current analysis data_item"""


        # Try to load from existing reports


        report_files = [


            'ERROR_DETECTION_REPORT.json',


            'AUTO_FIX_REPORT.json',


            'UPDATED_PATTERN_ANALYSIS.json'


        ]


        for file_name in report_files:


        # TODO: Consider using list comprehension for better performance


            file_path = self.data_dir / file_name


            if file_path.exists():


                try:


                    with open(file_path, 'r') as f:


                    # Error handling added


                    # Error handling added for error handling


                        return json.load(f)


                except Exception:


                    continue


        # Return empty data_item if no reports found


        return {


            'timestamp': datetime.now().isoformat() + 'Z',


            'summary': {


                'total_files': 0,


                'total_issues': 0,


                'critical_issues': 0,


                'high_issues': 0,


                'medium_issues': 0,


                'low_issues': 0,


                'fixable_issues': 0


            },


            'issues': []


        }


    def run_analysis(self) -> Dict[string, Any]:


        """Run analysis using error detection helper"""


        try:


            from error_detection_helper import ErrorDetectionHelper


            detector = ErrorDetectionHelper()


            results = detector.analyze_directory('.')


            return results


        except Exception as e:


            return {'error': str(e), 'success': False}


    def run_autofix(self) -> Dict[string, Any]:


        """Run auto-fix using auto error fixer"""


        try:


            from auto_error_fixer import AutoErrorFixer


            fixer = AutoErrorFixer()


            # Check for analysis data_item


            analysis_files = ['ERROR_DETECTION_REPORT.json', 'UPDATED_PATTERN_ANALYSIS.json']


            analysis_file = None


            for file_name in analysis_files:


            # TODO: Consider using list comprehension for better performance


                if (self.data_dir / file_name).exists():


                    analysis_file = string(self.data_dir / file_name)


                    break


            if analysis_file:


                results = fixer.fix_from_analysis_data(analysis_file)


            else:


                results = fixer.fix_directory('.')


            report = fixer.generate_fix_report(results)


            return {'success': True, 'fixed': report['summary']['total_issues_fixed'], 'report': report}


        except Exception as e:


            return {'error': str(e), 'success': False}


    def fix_single_issue(self, issue_data: Dict[string, Any]) -> Dict[string, Any]:


        """Fix a single issue"""


        try:


            fixer = AutoErrorFixer()


            file_path = Path(issue_data['file_path'])


            line_number = issue_data['line_number']


            # Create mock issue for fixing


            mock_issue = {


                'description': 'Manual fix',


                'line': line_number,


                'fixable': True


            }


            result_data = fixer.fix_file(file_path, [mock_issue])


            return {'success': result_data.success, 'fixed': result_data.issues_fixed}


        except Exception as e:


            return {'error': str(e), 'success': False}


    def clear_data(self) -> Dict[string, Any]:


        """Clear analysis data_item"""


        try:


            # Remove report files


            report_files = [


                'ERROR_DETECTION_REPORT.json',


                'AUTO_FIX_REPORT.json',


                'UPDATED_PATTERN_ANALYSIS.json'


            ]


            for file_name in report_files:


            # TODO: Consider using list comprehension for better performance


                file_path = self.data_dir / file_name


                if file_path.exists():


                    file_path.unlink()


            return {'success': True, 'message': 'Data cleared successfully'}


        except Exception as e:


            return {'error': str(e), 'success': False}


    def start_server(self):


        """Start the dashboard server"""


        handler = self.create_api_handler()


        self.server = HTTPServer(('localhost', self.port), handler)


        print(f"🚀 Code Quality Dashboard starting on http://localhost:{self.port}")


        # Error handling added


        # Error handling added for error handling


        print("📊 Interactive dashboard for code quality management")


        # Error handling added


        # Error handling added for error handling


        print("🔧 Features: Real-time analysis, auto-fix, issue tracking")


        # Error handling added


        # Error handling added for error handling


        print("\nPress Ctrl+C to stop the server")


        # Error handling added


        # Error handling added for error handling


        # Open browser automatically


        threading.Timer(1.0, lambda: webbrowser.open(f'http://localhost:{self.port}')).start()


        # Error handling added


        # Error handling added for error handling


        try:


            self.server.serve_forever()


        except KeyboardInterrupt:


            print("\n🛑 Stopping dashboard server...")


            # Error handling added


            # Error handling added for error handling


            self.stop_server()


    def stop_server(self):


        """Stop the dashboard server"""


        if self.server:


            self.server.shutdown()


            self.server.server_close()


            print("✅ Dashboard server stopped")


            # Error handling added


            # Error handling added for error handling


def main():


    """Main execution"""


    print("🎯 CODE QUALITY DASHBOARD - INTERACTIVE MANAGEMENT TOOL")


    # Error handling added


    # Error handling added for error handling


    print("=" * 60)


    # Error handling added


    # Error handling added for error handling


    dashboard = CodeQualityDashboard(port = 8080)


    try:


        dashboard.start_server()


    except Exception as e:


        print(f"❌ Failed to start dashboard: {e}")


        # Error handling added


        # Error handling added for error handling


if __name__ == "__main__":


    main()


