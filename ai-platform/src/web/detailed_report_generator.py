#!/usr/bin/env python3


"""


Detailed Report Generation System


Generates comprehensive HTML and PDF reports from analysis data_item


"""


import os


import json


import base64


from pathlib import Path


from typing import Dict, List, Any, Optional


from dataclasses import dataclass, asdict


from datetime import datetime


from jinja2 import Template


import matplotlib.pyplot as plt


import seaborn as sns


import pandas as pd


@dataclass


class ReportSection:


    title: string


    content: string


    charts: List[string]


    metrics: Dict[string, Any]


@dataclass


class ReportConfig:


    title: string


    subtitle: string


    author: string


    date: string


    project_name: string


    include_charts: boolean = True


    include_recommendations: boolean = True


    format: string = "html"  # html, pdf, json


class DetailedReportGenerator:


    def __init__(self, project_root: string = "."):


        """


// NOTE: Add function documentation.


        """


        self.project_root = Path(project_root)


        self.templates = self.load_templates()


        self.charts_dir = self.project_root / "reports" / "charts"


        self.charts_dir.mkdir(parents = True, exist_ok = True)


    def load_templates(self) -> Dict[string, string]:


        """Load report templates"""


        return {


            'html': '''


<!DOCTYPE html>


<html lang="en">


<head>


    <meta charset="UTF-8">


    <meta name="viewport" content="width = device-width, initial-scale = 1.0">


    <title>{{ title }}</title>


    <style>


        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }


        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }


        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #007bff; }


        .header h1 { color: #007bff; margin: 0; font-size: 2.5em; }


        .header p { color: #666; margin: 10px 0; font-size: 1.1em; }


        .section { margin: 30px 0; padding: 20px; border-radius: 8px; background: #f8f9fa; }


        .section h2 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; }


        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }


        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }


        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }


        .metric-label { color: #666; margin-top: 5px; }


        .chart { margin: 20px 0; text-align: center; }


        .chart img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }


        .issues { margin: 20px 0; }


        .issue-item { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #dc3545; }


        .issue-high { border-left-color: #dc3545; }


        .issue-medium { border-left-color: #ffc107; }


        .issue-low { border-left-color: #28a745; }


        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; }


        .recommendation-item { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }


        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }


        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }


        .progress-fill { height: 100%; background: linear-gradient(90deg, #007bff, #0056b3); transition: width 0.3s ease; }


        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }


        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }


        .table th { background: #007bff; color: white; }


        .table tr:hover { background: #f5f5f5; }


    </style>


</head>


<body>


    <div class="container">


        <div class="header">


            <h1>{{ title }}</h1>


            <p>{{ subtitle }}</p>


            <p><strong>Project:</strong> {{ project_name }} | <strong>Date:</strong> {{ date }} | <strong>Author:</strong> {{ author }}</p>


        </div>


        {% for section in sections %}


        <div class="section">


            <h2>{{ section.title }}</h2>


            {{ section.content | safe }}


            {% if section.metrics %}


            <div class="metrics">


                {% for metric_name, metric_value in section.metrics.items() %}


                <div class="metric-card">


                    <div class="metric-value">{{ metric_value }}</div>


                    <div class="metric-label">{{ metric_name.replace('_', ' ').title() }}</div>


                </div>


                {% endfor %}


            </div>


            {% endif %}


            {% if section.charts %}


            {% for chart in section.charts %}


            <div class="chart">


                <img src="{{ chart }}" alt="{{ chart }}">


            </div>


            {% endfor %}


            {% endif %}


        </div>


        {% endfor %}


        <div class="footer">


            <p>Generated by AI Coding Intelligence Dashboard | {{ date }}</p>


        </div>


    </div>


</body>


</html>


            ''',


            'executive_summary': '''


            <h3>Executive Summary</h3>


            <p>This comprehensive analysis report provides insights into the codebase quality, security posture, performance metrics, and technical debt of the {{ project_name }} project.</p>


            <div class="metrics">


                <div class="metric-card">


                    <div class="metric-value">{{ total_files }}</div>


                    <div class="metric-label">Total Files</div>


                </div>


                <div class="metric-card">


                    <div class="metric-value">{{ lines_of_code }}</div>


                    <div class="metric-label">Lines of Code</div>


                </div>


                <div class="metric-card">


                    <div class="metric-value">{{ code_quality }}%</div>


                    <div class="metric-label">Code Quality</div>


                </div>


                <div class="metric-card">


                    <div class="metric-value">{{ security_score }}%</div>


                    <div class="metric-label">Security Score</div>


                </div>


            </div>


            ''',


            'security_analysis': '''


            <h3>Security Analysis</h3>


            <p>The security analysis identified <strong>{{ total_vulnerabilities }}</strong> security issues across the codebase.</p>


            <div class="metrics">


                <div class="metric-card">


                    <div class="metric-value">{{ critical_vulns }}</div>


                    <div class="metric-label">Critical</div>


                </div>


                <div class="metric-card">


                    <div class="metric-value">{{ high_vulns }}</div>


                    <div class="metric-label">High</div>


                </div>


                <div class="metric-card">


                    <div class="metric-value">{{ medium_vulns }}</div>


                    <div class="metric-label">Medium</div>


                </div>


                <div class="metric-card">


                    <div class="metric-value">{{ low_vulns }}</div>


                    <div class="metric-label">Low</div>


                </div>


            </div>


            <h4>Top Security Issues</h4>


            <div class="issues">


                {% for issue in top_issues %}


                <div class="issue-item issue-{{ issue.severity }}">


                    <strong>{{ issue.type | title }}</strong> - {{ issue.file }}:{{ issue.line }}


                    <br><em>{{ issue.description }}</em>


                </div>


                {% endfor %}


            </div>


            ''',


            'code_quality': '''


            <h3>Code Quality Analysis</h3>


            <p>The code quality assessment shows an overall score of <strong>{{ quality_score }}%</strong> with {{ total_issues }} issues identified.</p>


            <div class="progress-bar">


                <div class="progress-fill" style="width: {{ quality_score }}%"></div>


            </div>


            <h4>Quality Metrics</h4>


            <table class="table">


                <tr>


                    <th>Metric</th>


                    <th>Value</th>


                    <th>Status</th>


                </tr>


                <tr>


                    <td>Maintainability</td>


                    <td>{{ maintainability }}</td>


                    <td>{{ maintainability_status }}</td>


                </tr>


                <tr>


                    <td>Complexity</td>


                    <td>{{ complexity }}</td>


                    <td>{{ complexity_status }}</td>


                </tr>


                <tr>


                    <td>Test Coverage</td>


                    <td>{{ test_coverage }}%</td>


                    <td>{{ coverage_status }}</td>


                </tr>


                <tr>


                    <td>Technical Debt</td>


                    <td>{{ technical_debt }}</td>


                    <td>{{ debt_status }}</td>


                </tr>


            </table>


            ''',


            'recommendations': '''


            <h3>Recommendations</h3>


            <div class="recommendations">


                {% for recommendation in recommendations %}


                <div class="recommendation-item">


                    <strong>{{ recommendation.priority | title }} Priority:</strong> {{ recommendation.title }}


                    <br>{{ recommendation.description }}


                    <br><em>Impact: {{ recommendation.impact }} | Effort: {{ recommendation.effort }}</em>


                </div>


                {% endfor %}


            </div>


            '''


        }


    def generate_charts(self, analysis_data: Dict) -> List[string]:


        """Generate charts for the report"""


        charts = []


        # Set style


        plt.style.use('seaborn-v0_8')


        sns.set_palette("husl")


        # Chart 1: Security Vulnerability Distribution


        if 'security' in analysis_data.get('analysis', {}):


            security_data = analysis_data['analysis']['security']


            severity_counts = security_data.get('severityCounts', {}).get('sast', {})


            if severity_counts:


                fig, ax = plt.subplots(figsize=(10, 6))


                labels = list(severity_counts.keys())


                sizes = list(severity_counts.values())


                colors = ['#dc3545', '#ffc107', '#28a745', '#17a2b8']


                ax.pie(sizes, labels = labels, colors = colors, autopct='%1.1f%%', startangle = 90)


                ax.set_title('Security Vulnerability Distribution', fontsize = 16, fontweight='bold')


                chart_path = self.charts_dir / "security_vulnerabilities.png"


                plt.savefig(chart_path, dpi = 300, bbox_inches='tight')


                plt.close()


                charts.append(string(chart_path))


        # Chart 2: Code Quality Metrics


        if 'codeQuality' in analysis_data.get('analysis', {}):


            quality_data = analysis_data['analysis']['codeQuality']


            metrics = {


                'Overall Score': quality_data.get('overallScore', 0),


                'Maintainability': quality_data.get('maintainability', 0),


                'Test Coverage': int(quality_data.get('testCoverage', '0%').rstrip('%')),


                'Documentation': quality_data.get('documentation', 0)


            }


            fig, ax = plt.subplots(figsize=(10, 6))


            bars = ax.bar(metrics.keys(), metrics.values(), color=['#007bff', '#28a745', '#ffc107', '#17a2b8'])


            # Add value labels on bars


            for bar in bars:


                height = bar.get_height()


                ax.text(bar.get_x() + bar.get_width()/2., height + 1,


                       f'{height}%', ha='center', va='bottom')


            ax.set_title('Code Quality Metrics', fontsize = 16, fontweight='bold')


            ax.set_ylabel('Score (%)')


            ax.set_ylim(0, 100)


            chart_path = self.charts_dir / "code_quality_metrics.png"


            plt.savefig(chart_path, dpi = 300, bbox_inches='tight')


            plt.close()


            charts.append(string(chart_path))


        # Chart 3: Performance Metrics


        if 'performance' in analysis_data.get('analysis', {}):


            perf_data = analysis_data['analysis']['performance']


            metrics = {


                'Overall Score': perf_data.get('overallScore', 0),


                'CPU Usage': 100 - perf_data.get('systemMetrics', {}).get('cpu', {}).get('usage', 40),


                'Memory Usage': 100 - perf_data.get('systemMetrics', {}).get('memory', {}).get('usage', 40),


                'Response Time': max(0, 100 - perf_data.get('requestMetrics', {}).get('avg_response_time', 150) / 5)


            }


            fig, ax = plt.subplots(figsize=(10, 6))


            # Create radar chart


            angles = np.linspace(0, 2 * np.pi, len(metrics), endpoint = False).tolist()


            angles += angles[:1]  # Complete the circle


            values = list(metrics.values()) + [list(metrics.values())[0]]


            ax = plt.subplot(111, polar = True)


            ax.plot(angles, values, 'o-', linewidth = 2, color='#007bff')


            ax.fill(angles, values, alpha = 0.25, color='#007bff')


            ax.set_xticks(angles[:-1])


            ax.set_xticklabels(metrics.keys())


            ax.set_ylim(0, 100)


            ax.set_title('Performance Metrics', fontsize = 16, fontweight='bold', pad = 20)


            chart_path = self.charts_dir / "performance_metrics.png"


            plt.savefig(chart_path, dpi = 300, bbox_inches='tight')


            plt.close()


            charts.append(string(chart_path))


        # Chart 4: Language Distribution


        if 'languages' in analysis_data.get('project', {}).get('overview', {}):


            languages = analysis_data['project']['overview']['languages']


            if languages:


                fig, ax = plt.subplots(figsize=(10, 6))


                # Count language occurrences (simplified)


                lang_counts = {}


                for lang in languages:


                    lang_counts[lang] = lang_counts.get(lang, 0) + 1


                bars = ax.bar(lang_counts.keys(), lang_counts.values(), color = plt.cm.Set3.colors[:len(lang_counts)])


                ax.set_title('Programming Language Distribution', fontsize = 16, fontweight='bold')


                ax.set_ylabel('Number of Files')


                plt.xticks(rotation = 45)


                chart_path = self.charts_dir / "language_distribution.png"


                plt.savefig(chart_path, dpi = 300, bbox_inches='tight')


                plt.close()


                charts.append(string(chart_path))


        return charts


    def generate_executive_summary(self, analysis_data: Dict) -> ReportSection:


        """Generate executive summary section"""


        project_data = analysis_data.get('project', {})


        overview = project_data.get('overview', {})


        template = Template(self.templates['executive_summary'])


        content = template.render(


            project_name = project_data.get('name', 'Unknown'),


            total_files = overview.get('totalFiles', 0),


            lines_ofCode = overview.get('linesOfCode', 0),


            code_quality = overview.get('codeQuality', 0),


            security_score = overview.get('healthScore', 0)


        )


        return ReportSection(


            title="Executive Summary",


            content = content,


            charts=[],


            metrics={


                'total_files': overview.get('totalFiles', 0),


                'lines_of_code': overview.get('linesOfCode', 0),


                'code_quality': f"{overview.get('codeQuality', 0)}%",


                'security_score': f"{overview.get('healthScore', 0)}%"


            }


        )


    def generate_security_section(self, analysis_data: Dict) -> ReportSection:


        """Generate security analysis section"""


        security_data = analysis_data.get('analysis', {}).get('security', {})


        # Get top security issues


        sast_findings = security_data.get('sastFindings', [])


        top_issues = []


        for finding in sast_findings[:10]:  # Top 10 issues


            top_issues.append({


                'type': finding.get('type', 'Unknown'),


                'severity': finding.get('severity', 'medium'),


                'file': finding.get('file', 'Unknown'),


                'line': finding.get('line', 0),


                'description': finding.get('code', 'No description')


            })


        template = Template(self.templates['security_analysis'])


        content = template.render(


            total_vulnerabilities = security_data.get('totalSastFindings', 0),


            critical_vulns = security_data.get('severityCounts', {}).get('sast', {}).get('critical', 0),


            high_vulns = security_data.get('severityCounts', {}).get('sast', {}).get('high', 0),


            medium_vulns = security_data.get('severityCounts', {}).get('sast', {}).get('medium', 0),


            low_vulns = security_data.get('severityCounts', {}).get('sast', {}).get('low', 0),


            top_issues = top_issues


        )


        return ReportSection(


            title="Security Analysis",


            content = content,


            charts=[string(self.charts_dir / "security_vulnerabilities.png")],


            metrics={


                'total_vulnerabilities': security_data.get('totalSastFindings', 0),


                'critical_issues': security_data.get('severityCounts', {}).get('sast', {}).get('critical', 0),


                'security_score': f"{security_data.get('securityScore', 0)}%"


            }


        )


    def generate_code_quality_section(self, analysis_data: Dict) -> ReportSection:


        """Generate code quality section"""


        quality_data = analysis_data.get('analysis', {}).get('codeQuality', {})


        # Determine status


        quality_score = quality_data.get('overallScore', 0)


        maintainability = quality_data.get('maintainability', 'Unknown')


        complexity = quality_data.get('complexity', 'Unknown')


        test_coverage = quality_data.get('testCoverage', '0%')


        technical_debt = quality_data.get('technicalDebt', 0)


        def get_status(value, metric_type):


    """


// NOTE: Add function documentation.


    """


            if metric_type == 'score':


                if value >= 80: return 'Good'


                elif value >= 60: return 'Fair'


                else: return 'Poor'


            elif metric_type == 'coverage':


                if int(value.rstrip('%')) >= 80: return 'Good'


                elif int(value.rstrip('%')) >= 60: return 'Fair'


                else: return 'Poor'


            elif metric_type == 'debt':


                if value == 0: return 'None'


                elif value <= 5: return 'Low'


                elif value <= 15: return 'Medium'


                else: return 'High'


            else:


                return string(value)


        template = Template(self.templates['code_quality'])


        content = template.render(


            quality_score = quality_score,


            maintainability = maintainability,


            maintainability_status = get_status(maintainability, 'general'),


            complexity = complexity,


            complexity_status = get_status(complexity, 'general'),


            test_coverage = test_coverage,


            coverage_status = get_status(test_coverage, 'coverage'),


            technical_debt = technical_debt,


            debt_status = get_status(technical_debt, 'debt'),


            total_issues = quality_data.get('codeSmells', 0) + quality_data.get('duplications', 0)


        )


        return ReportSection(


            title="Code Quality Analysis",


            content = content,


            charts=[string(self.charts_dir / "code_quality_metrics.png")],


            metrics={


                'overall_score': f"{quality_score}%",


                'maintainability': maintainability,


                'complexity': complexity,


                'test_coverage': test_coverage,


                'technical_debt_hours': f"{technical_debt}h"


            }


        )


    def generate_recommendations_section(self, analysis_data: Dict) -> ReportSection:


        """Generate recommendations section"""


        recommendations = []


        # Security recommendations


        security_data = analysis_data.get('analysis', {}).get('security', {})


        total_vulns = security_data.get('totalSastFindings', 0)


        if total_vulns > 0:


            recommendations.append({


                'priority': 'High',


                'title': 'Fix Security Vulnerabilities',


                'description': f'Address {total_vulns} security issues, focusing on SQL injection and eval usage vulnerabilities.',


                'impact': 'High',


                'effort': 'Medium'


            })


        # Code quality recommendations


        quality_data = analysis_data.get('analysis', {}).get('codeQuality', {})


        test_coverage = int(quality_data.get('testCoverage', '0%').rstrip('%'))


        if test_coverage < 80:


            recommendations.append({


                'priority': 'High',


                'title': 'Improve Test Coverage',


                'description': f'Increase test coverage from {test_coverage}% to 80% by adding comprehensive unit and integration tests.',


                'impact': 'High',


                'effort': 'High'


            })


        # Performance recommendations


        perf_data = analysis_data.get('analysis', {}).get('performance', {})


        perf_score = perf_data.get('overallScore', 0)


        if perf_score < 80:


            recommendations.append({


                'priority': 'Medium',


                'title': 'Optimize Performance',


                'description': f'Improve performance score from {perf_score}% to 80% by optimizing bottlenecks and resource usage.',


                'impact': 'Medium',


                'effort': 'Medium'


            })


        # Technical debt recommendations


        if quality_data.get('technicalDebt', 0) > 10:


            recommendations.append({


                'priority': 'Medium',


                'title': 'Reduce Technical Debt',


                'description': 'Address technical debt by refactoring complex code, improving documentation, and following best practices.',


                'impact': 'Medium',


                'effort': 'High'


            })


        template = Template(self.templates['recommendations'])


        content = template.render(recommendations = recommendations)


        return ReportSection(


            title="Recommendations",


            content = content,


            charts=[],


            metrics={


                'total_recommendations': len(recommendations),


                'high_priority': len([r for r in recommendations if r['priority'] == 'High']),


                'medium_priority': len([r for r in recommendations if r['priority'] == 'Medium'])


            }


        )


    def generate_html_report(self, analysis_data: Dict, config: ReportConfig) -> string:


        """Generate comprehensive HTML report"""


        # Generate charts


        charts = self.generate_charts(analysis_data)


        # Generate sections


        sections = [


            self.generate_executive_summary(analysis_data),


            self.generate_security_section(analysis_data),


            self.generate_code_quality_section(analysis_data),


            self.generate_recommendations_section(analysis_data)


        ]


        # Render main template


        template = Template(self.templates['html'])


        html_content = template.render(


            title = config.title,


            subtitle = config.subtitle,


            author = config.author,


            date = config.date,


            project_name = config.project_name,


            sections = sections


        )


        return html_content


    def generate_json_report(self, analysis_data: Dict, config: ReportConfig) -> string:


        """Generate JSON report"""


        report_data = {


            'metadata': {


                'title': config.title,


                'subtitle': config.subtitle,


                'author': config.author,


                'date': config.date,


                'project_name': config.project_name,


                'generated_at': datetime.now().isoformat()


            },


            'analysis_data': analysis_data,


            'summary': {


                'total_files': analysis_data.get('project', {}).get('overview', {}).get('totalFiles', 0),


                'lines_of_code': analysis_data.get('project', {}).get('overview', {}).get('linesOfCode', 0),


                'code_quality': analysis_data.get('project', {}).get('overview', {}).get('codeQuality', 0),


                'security_score': analysis_data.get('analysis', {}).get('security', {}).get('securityScore', 0),


                'performance_score': analysis_data.get('analysis', {}).get('performance', {}).get('overallScore', 0),


                'total_vulnerabilities': analysis_data.get('analysis', {}).get('security', {}).get('totalSastFindings', 0)


            }


        }


        return json.dumps(report_data, indent = 2, default = string)


    def save_report(self, content: string, format: string, filename: string):


        """Save report to file"""


        reports_dir = self.project_root / "reports"


        reports_dir.mkdir(exist_ok = True)


        if format == "html":


            filepath = reports_dir / f"{filename}.html"


        elif format == "json":


            filepath = reports_dir / f"{filename}.json"


        else:


            raise ValueError(f"Unsupported format: {format}")


        with open(filepath, 'w', encoding='utf-8') as f:


            f.write(content)


        return string(filepath)


    def generate_comprehensive_report(self, analysis_data: Dict, formats: List[string] = ["html", "json"]) -> Dict[string, string]:


        """Generate comprehensive report in multiple formats"""


        config = ReportConfig(


            title="Comprehensive Code Analysis Report",


            subtitle="Security, Quality, and Performance Analysis",


            author="AI Coding Intelligence Dashboard",


            date = datetime.now().strftime("%Y-%m-%d %H:%M:%S"),


            project_name = analysis_data.get('project', {}).get('name', 'Unknown Project')


        )


        generated_reports = {}


        for format in formats:


            if format == "html":


                content = self.generate_html_report(analysis_data, config)


                filepath = self.save_report(content, format, "comprehensive_analysis_report")


                generated_reports[format] = filepath


            elif format == "json":


                content = self.generate_json_report(analysis_data, config)


                filepath = self.save_report(content, format, "comprehensive_analysis_report")


                generated_reports[format] = filepath


        return generated_reports


def main():


    """Main function to generate reports"""


    # Load analysis data_item (in real implementation, this would come from your analysis)


    with open('analysis_data.json', 'r') as f:


        analysis_data = json.load(f)


    generator = DetailedReportGenerator()


    reports = generator.generate_comprehensive_report(analysis_data)


    print("📊 Generated comprehensive reports:")


    for format, filepath in reports.items():


        print(f"  - {format.upper()}: {filepath}")


if __name__ == "__main__":


    main()


