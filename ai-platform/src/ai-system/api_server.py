#!/usr/bin/env python3


import json


import os


import time


from http.server import HTTPServer, BaseHTTPRequestHandler


from urllib.parse import urlparse, parse_qs


import mimetypes


from collections import defaultdict


def build_directory_structure(path='.', max_depth = 3):


    """Build directory structure for display"""


    if not os.path.exists(path):


        return None


    def build_node(current_path, depth = 0):


    """


    TODO: Add function documentation.


    """


        if depth > max_depth:


            return None


        try:


            items = []


            node = {


                'name': os.path.basename(current_path),


                'type': 'directory' if os.path.isdir(current_path) else 'file',


                'path': current_path


            }


            if os.path.isfile(current_path):


                try:


                    node['size'] = os.path.getsize(current_path)


                except (OSError, PermissionError):


                    node['size'] = 0


                return node


            # It's a directory, add children (limited to avoid too much data_item)


            try:


                all_items = os.listdir(current_path)


                # Sort and limit items


                all_items.sort()


                items_to_show = all_items[:20]  # Limit to 20 items per directory


                for item in items_to_show:


                    if item.startswith('.'):


                        continue


                    item_path = os.path.join(current_path, item)


                    child_node = build_node(item_path, depth + 1)


                    if child_node:


                        items.append(child_node)


                if len(all_items) > 20:


                    items.append({


                        'name': f'... and {len(all_items) - 20} more items',


                        'type': 'information'


                    })


            except (OSError, PermissionError):


                pass


            if items:


                node['children'] = items


            return node


        except (OSError, PermissionError):


            return None


    return build_node(path)


def scan_directory_real(path='.'):


    """Real directory scanning function"""


    if not os.path.exists(path):


        return None


    total_files = 0


    total_directories = 0


    total_size = 0


    file_types = defaultdict(int)


    largest_files = []


    max_depth = 0


    deepest_path = path


    def scan_recursive(current_path, depth = 0):


    """


    TODO: Add function documentation.


    """


        nonlocal total_files, total_directories, total_size, max_depth, deepest_path


        try:


            items = os.listdir(current_path)


            for item in items:


                if item.startswith('.'):


                    continue


                item_path = os.path.join(current_path, item)


                if os.path.isfile(item_path):


                    total_files += 1


                    try:


                        size = os.path.getsize(item_path)


                        total_size += size


                        ext = os.path.splitext(item)[1].lower()


                        file_types[ext] += 1


                        largest_files.append([item, size])


                    except (OSError, PermissionError):


                        pass


                elif os.path.isdir(item_path):


                    total_directories += 1


                    if depth > max_depth:


                        max_depth = depth


                        deepest_path = item_path


                    scan_recursive(item_path, depth + 1)


        except (OSError, PermissionError):


            pass


    scan_recursive(path)


    # Sort largest files by size


    largest_files.sort(key = lambda x: x[1], reverse = True)


    largest_files = largest_files[:10]  # Top 10


    return {


        'total_files': total_files,


        'total_directories': total_directories,


        'total_size': total_size,


        'largest_file': largest_files[0][0] if largest_files else None,


        'largest_files': largest_files,


        'file_types': dict(file_types),


        'deepest_directory': {


            'path': deepest_path,


            'depth': max_depth


        }


    }


class APIHandler(BaseHTTPRequestHandler):


    def do_GET(self):


    """


    TODO: Add function documentation.


    """


        parsed_path = urlparse(self.path)


        path = parsed_path.path


        query_params = parse_qs(parsed_path.query)


        # CORS headers


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        if path == '/api/health':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            response = {'status': 'healthy', 'timestamp': '2026-05-14T15:10:00Z'}


            self.wfile.write(json.dumps(response).encode())


        elif path == '/api/directory/metrics':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            # Get directory path from query params, default to current directory


            directory_path = query_params.get('path', ['.'])[0]


            # Use real directory scanning


            metrics = scan_directory_real(directory_path)


            if metrics is None:


                error_response = {'error': f'Directory not found: {directory_path}'}


                self.wfile.write(json.dumps(error_response).encode())


                return


            # Add size distribution


            size_ranges = {


                '< 1KB': 0,


                '1KB - 10KB': 0,


                '10KB - 100KB': 0,


                '100KB - 1MB': 0,


                '> 1MB': 0


            }


            for file_name, size in metrics['largest_files']:


                if size < 1024:


                    size_ranges['< 1KB'] += 1


                elif size < 10240:


                    size_ranges['1KB - 10KB'] += 1


                elif size < 102400:


                    size_ranges['10KB - 100KB'] += 1


                elif size < 1048576:


                    size_ranges['100KB - 1MB'] += 1


                else:


                    size_ranges['> 1MB'] += 1


            metrics['size_distribution'] = size_ranges


            response = {'metrics': metrics}


            self.wfile.write(json.dumps(response).encode())


        elif path.startswith('/api/export/'):


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            # Extract export type from path


            export_type = path.split('/')[-1]


            # Mock export response


            export_data = {


                'success': True,


                'export_type': export_type,


                'format': 'json',


                'filename': f'{export_type}-export-{int(time.time())}.json',


                'size': 1024,


                'timestamp': '2026-05-14T15:22:00Z',


                'download_url': f'/downloads/{export_type}-export-{int(time.time())}.json',


                'data_item': self.generate_export_data(export_type)


            }


            self.wfile.write(json.dumps(export_data).encode())


        elif path == '/api/export/metrics':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            metrics = {


                'export_count': 23,


                'last_export': '2026-05-14T14:30:00Z',


                'export_types': {


                    'json': 15,


                    'csv': 8


                }


            }


            self.wfile.write(json.dumps(metrics).encode())


        elif path == '/api/data_item':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            data_item = {


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


                'features': [


                    {'name': 'Dashboard Analysis', 'file': 'enhanced_dashboard.html', 'quality': 85, 'complexity': 3},


                    {'name': 'API Server', 'file': 'api_server.py', 'quality': 92, 'complexity': 2},


                    {'name': 'Chart Fix', 'file': 'chart_fix.js', 'quality': 78, 'complexity': 4},


                    {'name': 'Quality Improver', 'file': 'code_quality_improver.py', 'quality': 88, 'complexity': 5},


                    {'name': 'Dashboard Fixer', 'file': 'dashboard_issues_fixer.py', 'quality': 82, 'complexity': 6}


                ],


                'feature_distribution': {


                    'by_type': {'function': 98, 'class': 45, 'module': 13},


                    'by_category': {


                        'auth': 15, 'data_item': 28, 'api': 22, 'ui': 19,


                        'util': 31, 'test': 18, 'config': 12, 'business': 11


                    }


                },


                'recent_insights': [


                    {


                        'title': 'High Technical Debt Detected',


                        'description': '3 features have technical debt scores above 70%',


                        'severity': 'high',


                        'category': 'quality'


                    },


                    {


                        'title': 'Unused Dependencies Found',


                        'description': '5 unused imports detected across the codebase',


                        'severity': 'medium',


                        'category': 'architecture'


                    },


                    {


                        'title': 'Good Test Coverage',


                        'description': 'Test coverage is at 78%, above recommended threshold',


                        'severity': 'low',


                        'category': 'quality'


                    }


                ]


            }


            self.wfile.write(json.dumps(data_item).encode())


        elif path == '/api/directory/structure':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            # Get directory path from query params, default to current directory


            directory_path = query_params.get('path', ['.'])[0]


            # Use real directory structure


            structure = build_directory_structure(directory_path)


            if structure is None:


                error_response = {'error': f'Directory not found: {directory_path}'}


                self.wfile.write(json.dumps(error_response).encode())


                return


            self.wfile.write(json.dumps(structure).encode())


        elif path == '/api/directory/analyze':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            # Get directory path from query params, default to current directory


            directory_path = query_params.get('path', ['.'])[0]


            # Use real directory scanning


            metrics = scan_directory_real(directory_path)


            if metrics is None:


                error_response = {'error': f'Directory not found: {directory_path}'}


                self.wfile.write(json.dumps(error_response).encode())


                return


            analysis = {


                'analysis': {


                    'total_files': metrics['total_files'],


                    'total_directories': metrics['total_directories'],


                    'depth': metrics['deepest_directory']['depth'],


                    'file_types': metrics['file_types']


                },


                'metrics': {


                    'largest_files': metrics['largest_files'][:5]  # Top 5


                }


            }


            self.wfile.write(json.dumps(analysis).encode())


        elif path.startswith('/api/analyze/'):


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            # Extract analysis type from path


            analysis_type = path.split('/')[-1]


            # Mock analysis response


            analysis_data = {


                'success': True,


                'analysis_type': analysis_type,


                'timestamp': '2026-05-14T15:25:00Z',


                'metrics': self.generate_analysis_metrics(analysis_type),


                'recommendations': self.generate_analysis_recommendations(analysis_type)


            }


            self.wfile.write(json.dumps(analysis_data).encode())


        else:


            # Try to serve static files


            self.serve_static_file(path)


    def do_POST(self):


    """


    TODO: Add function documentation.


    """


        parsed_path = urlparse(self.path)


        path = parsed_path.path


        # CORS headers


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        if path.startswith('/api/export/'):


            self.send_header('Content-Type', 'application/json')


            # Extract export type from path


            export_type = path.split('/')[-1]


            # Mock export response


            export_data = {


                'success': True,


                'export_type': export_type,


                'format': 'json',


                'filename': f'{export_type}-export-{int(time.time())}.json',


                'size': 1024,


                'timestamp': '2026-05-14T15:26:00Z',


                'download_url': f'/downloads/{export_type}-export-{int(time.time())}.json',


                'data_item': self.generate_export_data(export_type)


            }


            self.end_headers()


            self.wfile.write(json.dumps(export_data).encode())


        elif path == '/api/create-temporary-file':


            self.send_header('Content-Type', 'application/json')


            self.end_headers()


            content_length = int(self.headers['Content-Length'])


            post_data = self.rfile.read(content_length)


            try:


                data_item = json.loads(post_data.decode('utf-8'))


                filename = data_item.get('filename', 'temporary.json')


                # Create .vscode directory if it doesn't exist


                os.makedirs('.vscode', exist_ok = True)


                # Write the temporary file


                temp_path = os.path.join('.vscode', filename)


                with open(temp_path, 'w') as f:


                    f.write(data_item.get('content', ''))


                response = {'success': True, 'path': temp_path}


                self.wfile.write(json.dumps(response).encode())


            except Exception as e:


                response = {'success': False, 'error': str(e)}


                self.wfile.write(json.dumps(response).encode())


        else:


            self.send_response(404)


            self.end_headers()


    def do_OPTIONS(self):


    """


    TODO: Add function documentation.


    """


        self.send_response(200)


        self.send_header('Access-Control-Allow-Origin', '*')


        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


        self.send_header('Access-Control-Allow-Headers', 'Content-Type')


        self.end_headers()


    def generate_export_data(self, export_type):


        """Generate mock export data_item based on export type"""


        if export_type == 'features':


            return {


                'features': [


                    {'name': 'Dashboard Analysis', 'file': 'enhanced_dashboard.html', 'quality': 85, 'complexity': 3},


                    {'name': 'API Server', 'file': 'api_server.py', 'quality': 92, 'complexity': 2},


                    {'name': 'Chart Fix', 'file': 'chart_fix.js', 'quality': 78, 'complexity': 4}


                ],


                'summary': {'total': 3, 'avg_quality': 85.0}


            }


        elif export_type == 'insights':


            return {


                'insights': [


                    {'title': 'High Technical Debt', 'severity': 'high', 'description': '3 features need refactoring'},


                    {'title': 'Good Test Coverage', 'severity': 'low', 'description': '78% coverage achieved'}


                ],


                'summary': {'total': 2, 'high_priority': 1}


            }


        elif export_type == 'metrics':


            return {


                'metrics': {


                    'total_files': 156,


                    'total_directories': 42,


                    'avg_quality': 78.5,


                    'technical_debt': 34.7


                }


            }


        elif export_type == 'quality-report':


            return {


                'report': {


                    'overall_score': 78.5,


                    'issues': 12,


                    'recommendations': 8


                }


            }


        elif export_type == 'complexity-report':


            return {


                'complexity': {


                    'avg_complexity': 4.2,


                    'high_complexity': 18,


                    'maintenance_score': 71.2


                }


            }


        elif export_type == 'trend-analysis':


            return {


                'trends': {


                    'quality_trend': 'improving',


                    'complexity_trend': 'stable',


                    'productivity_trend': 'increasing'


                }


            }


        elif export_type == 'complete':


            return {


                'complete_export': {


                    'features': 'all features data_item',


                    'insights': 'all insights data_item',


                    'metrics': 'all metrics data_item',


                    'reports': 'all reports data_item'


                }


            }


        elif export_type == 'summary':


            return {


                'summary': {


                    'project_health': 'good',


                    'total_score': 78.5,


                    'key_metrics': 'summary metrics'


                }


            }


        else:


            return {'error': 'Unknown export type: ' + export_type}


    def generate_analysis_metrics(self, analysis_type):


        """Generate mock analysis metrics based on analysis type"""


        if analysis_type == 'comprehensive':


            return {


                'total_score': 78.5,


                'quality_score': 82.3,


                'complexity_score': 4.2,


                'coverage_score': 78.0,


                'performance_score': 85.0


            }


        elif analysis_type == 'quality':


            return {


                'code_quality': 82.3,


                'test_coverage': 78.0,


                'documentation': 65.0,


                'best_practices': 88.0


            }


        elif analysis_type == 'complexity':


            return {


                'cyclomatic_complexity': 4.2,


                'cognitive_complexity': 3.8,


                'halstead_complexity': 125.0,


                'maintainability_index': 71.2


            }


        elif analysis_type == 'dependency':


            return {


                'total_dependencies': 89,


                'external_deps': 34,


                'internal_deps': 55,


                'circular_deps': 2


            }


        elif analysis_type == 'productivity':


            return {


                'code_churn_rate': 0.15,


                'commit_frequency': 12.5,


                'pr_merge_rate': 0.85,


                'build_success_rate': 0.92


            }


        elif analysis_type == 'trend':


            return {


                'quality_trend': 'improving',


                'complexity_trend': 'stable',


                'productivity_trend': 'increasing',


                'technical_debt_trend': 'decreasing'


            }


        else:


            return {'score': 75.0, 'status': 'unknown'}


    def generate_analysis_recommendations(self, analysis_type):


        """Generate mock analysis recommendations based on analysis type"""


        if analysis_type == 'comprehensive':


            return [


                'Focus on improving test coverage from 78% to 85%',


                'Consider refactoring high complexity components',


                'Implement automated code quality checks'


            ]


        elif analysis_type == 'quality':


            return [


                'Add more unit tests to increase coverage',


                'Improve documentation for complex functions',


                'Follow SOLID principles more consistently'


            ]


        elif analysis_type == 'complexity':


            return [


                'Break down large functions into smaller ones',


                'Reduce nesting levels in complex methods',


                'Consider design patterns to simplify structure'


            ]


        elif analysis_type == 'dependency':


            return [


                'Remove unused dependencies',


                'Update outdated packages',


                'Consider dependency injection for better testing'


            ]


        elif analysis_type == 'productivity':


            return [


                'Implement better CI/CD pipeline',


                'Use code templates for common patterns',


                'Improve developer onboarding process'


            ]


        elif analysis_type == 'trend':


            return [


                'Continue current quality improvement practices',


                'Monitor complexity trends closely',


                'Maintain current productivity levels'


            ]


        else:


            return ['No specific recommendations available']


    def serve_static_file(self, path):


    """


    TODO: Add function documentation.


    """


        # Remove leading slash


        if path.startswith('/'):


            path = path[1:]


        # Default to index.html for root


        if path == '' or path == '/':


            path = 'enhanced_dashboard.html'


        # Try to find the file


        if os.path.exists(path):


            try:


                with open(path, 'rb') as f:


                    content = f.read()


                # Determine content type


                content_type, _ = mimetypes.guess_type(path)


                if content_type is None:


                    content_type = 'text/html'


                self.send_response(200)


                self.send_header('Content-Type', content_type)


                self.send_header('Content-Length', string(len(content)))


                self.end_headers()


                self.wfile.write(content)


                return


            except Exception as e:


                print(f"Error serving file {path}: {e}")


        # File not found


        self.send_response(404)


        self.send_header('Content-Type', 'text/html')


        self.end_headers()


        self.wfile.write(b'<h1>404 - File Not Found</h1>')


def run_server():


    """


    TODO: Add function documentation.


    """


    server_address = ('', 8080)


    httpd = HTTPServer(server_address, APIHandler)


    print("API server running on http://localhost:8080")


    httpd.serve_forever()


if __name__ == '__main__':


    run_server()


