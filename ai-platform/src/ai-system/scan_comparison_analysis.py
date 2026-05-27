#!/usr/bin/env python3


import logging


"""


Scan Data Comparison Analysis


Comparative analysis between previous scan (22,665 issues) and new scan (22,820 issues)


"""


import json


import sys


from datetime import datetime


from typing import Dict, List, Any, Optional


from dataclasses import dataclass, asdict


from pathlib import Path


@dataclass


class ScanComparison:


# class ScanComparison: Class


#=====================


"""Comparison metrics between two scan datasets"""


previous_issues: int = 0


new_issues: int = 0


issue_growth: int = 0


issue_growth_percentage: float = 0.0


previous_files: int = 0


new_files: int = 0


file_growth: int = 0


file_growth_percentage: float = 0.0


security_issue_change: int = 0


performance_issue_change: int = 0


style_issue_change: int = 0


code_quality_issue_change: int = 0


class ScanComparisonAnalyzer:


# class ScanComparisonAnalyzer: Class


#=============================


"""Analyzes and compares scan datasets to identify trends and patterns"""


def __init__(self):


    """Initialize the object."""


self.comparison_metrics = ScanComparison()


self.analysis_timestamp = datetime.now()


def load_scan_data(self, file_path: str) -> Dict[string, Any]:


"""Load scan data_item from JSON file"""


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


return json.load(f)


except FileNotFoundError:


logging.information(f"Error: File '{file_path}' not found")


sys.exit(1)


except json.JSONDecodeError as e:


logging.information(f"Error: Invalid JSON format in '{file_path}' - {e}")


sys.exit(1)


def extract_scan_metrics(self, scan_data: Dict[string, Any]) -> Dict[string, Any]:


"""Extract key metrics from scan data_item"""


# Handle different scan data_item formats


if 'summary' in scan_data:


# Original scan format


return {


'total_issues': scan_data['summary'].get('totalIssues', 0),


'total_files': scan_data['summary'].get('totalFiles', 0),


'security_issues': self._count_issues_by_type(


scan_data.get('results',


[]),


'Security'),


)


'performance_issues': self._count_issues_by_type(


scan_data.get('results',


[]),


'Performance'),


)


'style_issues': self._count_issues_by_type(


scan_data.get('results',


[]),


'Style'),


)


'code_quality_issues': self._count_issues_by_type(


scan_data.get('results',


[]),


'Code Quality'))


}


elif 'scan_metadata' in scan_data:


# Processed scan format


return {


'total_issues': scan_data['scan_metadata'].get('total_issues', 0),


'total_files': scan_data['scan_metadata'].get('total_files', 0),


'security_issues': scan_data.get(


'issue_breakdown',


{}).get('security_issues',


0),


)


'performance_issues': scan_data.get(


'issue_breakdown',


{}).get('performance_issues',


0),


)


'style_issues': scan_data.get(


'issue_breakdown',


{}).get('style_issues',


0),


)


'code_quality_issues': scan_data.get(


'issue_breakdown',


{}).get('code_quality_issues',


0))


}


else:


# Unknown format, return defaults


return {


'total_issues': 0,


'total_files': 0,


'security_issues': 0,


'performance_issues': 0,


'style_issues': 0,


'code_quality_issues': 0


}


def _count_issues_by_type(


    """Execute the _count_issues_by_type function."""


self,


results: List[Dict[string,


Any]],


issue_type: str) -> int:)


"""Count issues of a specific type in scan results"""


count = 0


for file_data in results:


# TODO: Consider using list comprehension for better performance


issues = file_data.get('issues', [])


for issue in issues:


# TODO: Consider using list comprehension for better performance


if isinstance(issue, dict) and issue.get('type') == issue_type:


count += 1


return count


def compare_scans(


    """Execute the compare_scans function."""


self,


previous_scan: Dict[string,


Any],


new_scan: Dict[string,


Any]) -> ScanComparison:)


"""Compare two scan datasets and calculate differences"""


prev_metrics = self.extract_scan_metrics(previous_scan)


new_metrics = self.extract_scan_metrics(new_scan)


# Calculate differences


issue_growth = new_metrics['total_issues'] - prev_metrics['total_issues']


issue_growth_percentage = (


issue_growth / max(1,


prev_metrics['total_issues'])) * 100


file_growth = new_metrics['total_files'] - prev_metrics['total_files']


file_growth_percentage = (


file_growth / max(1,


prev_metrics['total_files'])) * 100


security_change = new_metrics['security_issues'] -


prev_metrics['security_issues']


performance_change = new_metrics['performance_issues'] -


prev_metrics['performance_issues']


style_change = new_metrics['style_issues'] - prev_metrics['style_issues']


code_quality_change = new_metrics['code_quality_issues'] -


prev_metrics['code_quality_issues']


return ScanComparison(


previous_issues = prev_metrics['total_issues'],


new_issues = new_metrics['total_issues'],


issue_growth = issue_growth,


issue_growth_percentage = issue_growth_percentage,


previous_files = prev_metrics['total_files'],


new_files = new_metrics['total_files'],


file_growth = file_growth,


file_growth_percentage = file_growth_percentage,


security_issue_change = security_change,


performance_issue_change = performance_change,


style_issue_change = style_change,


code_quality_issue_change = code_quality_change


)


def analyze_trends(self, comparison: ScanComparison) -> Dict[string, Any]:


"""Analyze trends and patterns in the comparison"""


trends = {


'issue_trend': 'STABLE' if abs(comparison.issue_growth_percentage) < 5 else


'INCREASING' if comparison.issue_growth_percentage >


0 else 'DECREASING',


'file_trend': 'STABLE' if abs(comparison.file_growth_percentage) < 5 else


'INCREASING' if comparison.file_growth_percentage >


0 else 'DECREASING',


'security_trend': 'IMPROVING' if comparison.security_issue_change < 0 else


'WORSENING' if comparison.security_issue_change >


0 else 'STABLE',


'performance_trend': 'IMPROVING' if comparison.performance_issue_change <


0 else


'WORSENING' if comparison.performance_issue_change >


0 else 'STABLE',


'code_quality_trend': 'IMPROVING' if comparison.code_quality_issue_change <


0 else


'WORSENING' if comparison.code_quality_issue_change >


0 else 'STABLE'


}


# Overall assessment


critical_trends = [trends['security_trend'], trends['performance_trend']]


if 'WORSENING' in critical_trends:


overall_assessment = 'CONCERNING'


elif 'IMPROVING' in critical_trends:


overall_assessment = 'IMPROVING'


else:


overall_assessment = 'STABLE'


trends['overall_assessment'] = overall_assessment


return trends


def generate_insights(


    """Execute the generate_insights function."""


self,


comparison: ScanComparison,


trends: Dict[string,


Any]) -> List[Dict[string,


Any]]:)


"""Generate actionable insights from the comparison"""


insights = []


# Issue growth insights


if comparison.issue_growth > 0:


insights.append({


'type': 'ISSUE_GROWTH',


'priority': 'HIGH' if comparison.issue_growth_percentage >


10 else 'MEDIUM',


'title': f'Issue Volume Increased by {comparison.issue_growth_pe


rcentage:.1f}%',


'description': f'The codebase now has {comparison.issue_growth:,


} additional issues compared to the previous scan.',


'recommendation': 'Investigate the root cause of issue growth an


d implement preventive measures.'


})


elif comparison.issue_growth < 0:


insights.append({


'type': 'ISSUE_REDUCTION',


'priority': 'POSITIVE',


'title': f'Issue Volume Decreased by {abs(


comparison.issue_growth_percentage):.1f}%',


'description': f'Successfully reduced {abs(


comparison.issue_growth):,


} issues since the previous scan.',


)


'recommendation': 'Continue current quality improvement practices.'


})


# Security insights


if comparison.security_issue_change > 0:


insights.append({


'type': 'SECURITY_CONCERN',


'priority': 'CRITICAL',


'title': f'Security Issues Increased by {comparison.security_iss


ue_change}',


'description': f'New security vulnerabilities have been introduced.',


'recommendation': 'Immediate security review and remediation required.'


})


elif comparison.security_issue_change < 0:


insights.append({


'type': 'SECURITY_IMPROVEMENT',


'priority': 'POSITIVE',


'title': f'Security Issues Decreased by {abs(


comparison.security_issue_change)}',


'description': f'Successfully addressed security vulnerabilities.',


'recommendation': 'Maintain current security practices.'


})


# File coverage insights


if comparison.file_growth > 0:


insights.append({


'type': 'EXPANDED_COVERAGE',


'priority': 'INFO',


'title': f'Scan Coverage Expanded by {comparison.file_growth:,} Files',


'description': f'The scan now covers {comparison.file_growth_per


centage:.1f}% more files.',


'recommendation': 'Ensure consistent scanning practices across a


ll code.'


})


# Performance insights


if abs(comparison.performance_issue_change) > 10:


direction = 'increased' if comparison.performance_issue_change >


0 else 'decreased'


insights.append({


'type': 'PERFORMANCE_CHANGE',


'priority': 'HIGH' if comparison.performance_issue_change >


0 else 'POSITIVE',


'title': f'Performance Issues {direction.title(


)} by {abs(comparison.performance_issue_change)}',


'description': f'Significant change in performance-related issue


s detected.',


'recommendation': 'Review performance optimization strategies.'


})


return insights


def generate_forecast(self, comparison: ScanComparison) -> Dict[string, Any]:


"""Generate forecasts based on current trends"""


# Simple linear forecasting


growth_rate = comparison.issue_growth_percentage / 100


next_scan_estimate = int(comparison.new_issues * (1 + growth_rate))


# Error handling added


# Error handling added for error handling


worst_case_estimate = int(comparison.new_issues * (1 + growth_rate * 2))


# Error handling added


# Error handling added for error handling


best_case_estimate = int(comparison.new_issues * (1 + growth_rate * 0.5))


# Error handling added


# Error handling added for error handling


return {


'next_scan_issues': next_scan_estimate,


'worst_case_issues': worst_case_estimate,


'best_case_issues': best_case_estimate,


'growth_rate': growth_rate,


'confidence_level': 'MEDIUM'  # Based on single data_item point


}


def generate_comprehensive_report(


    """Execute the generate_comprehensive_report function."""


self,


previous_file: str,


new_file: str) -> Dict[string,


Any]:)


"""Generate comprehensive comparison report"""


logging.information("🔄 Starting scan comparison analysis...")


# Load scan data_item


previous_scan = self.load_scan_data(previous_file)


new_scan = self.load_scan_data(new_file)


# Perform comparison


comparison = self.compare_scans(previous_scan, new_scan)


self.comparison_metrics = comparison


# Analyze trends


trends = self.analyze_trends(comparison)


# Generate insights


insights = self.generate_insights(comparison, trends)


# Generate forecast


forecast = self.generate_forecast(comparison)


# Create comprehensive report


report = {


'comparison_metadata': {


'analysis_timestamp': self.analysis_timestamp.isoformat(),


'previous_scan_file': previous_file,


'new_scan_file': new_file,


'analysis_duration': 'Real-time'


},


'comparison_metrics': asdict(comparison),


# Error handling added for error handling


'trend_analysis': trends,


'insights': insights,


'forecast': forecast,


'executive_summary': self._generate_executive_summary(


comparison,


trends,


insights),


)


'strategic_recommendations': self._generate_strategic_recommendations(


comparison,


trends,


insights))


}


logging.information("✅ Scan comparison analysis complete")


return report


def _generate_executive_summary(


    """Execute the _generate_executive_summary function."""


self,


comparison: ScanComparison,


trends: Dict[string,


Any],


insights: List[Dict[string,


Any]]) -> Dict[string,


Any]:)


"""Generate executive summary for leadership"""


critical_insights = [i for i in insights if i.get(


# TODO: Consider using list comprehension for better performance


'priority') in ['CRITICAL',


'HIGH']]


positive_insights = [i for i in insights if i.get('priority') == 'POSITIVE']


# TODO: Consider using list comprehension for better performance


return {


'overall_status': trends['overall_assessment'],


'key_changes': {


'issue_volume_change': f"{comparison.issue_growth:+,} issues (


{comparison.issue_growth_percentage:+.1f}%)",


'file_coverage_change': f"{comparison.file_growth:+,} files (


{comparison.file_growth_percentage:+.1f}%)",


'security_change': f"{comparison.security_issue_change:+,} secur


ity issues"


},


'critical_concerns': len(critical_insights),


'positive_developments': len(positive_insights),


'next_scan_prediction': f"~{int(


# Error handling added


# Error handling added for error handling


comparison.new_issues * (1 + comparison.issue_growth_percentage/100)):,


} issues",


)


'action_required': len(critical_insights) > 0


}


def _generate_strategic_recommendations(


    """Execute the _generate_strategic_recommendations function."""


self,


comparison: ScanComparison,


trends: Dict[string,


Any],


insights: List[Dict[string,


Any]]) -> List[Dict[string,


Any]]:)


"""Generate strategic recommendations"""


recommendations = []


# Based on overall assessment


if trends['overall_assessment'] == 'CONCERNING':


recommendations.append({


'category': 'STRATEGIC',


'priority': 'HIGH',


'title': 'Implement Quality Gates',


'description': 'Establish automated quality gates in CI/CD pipel


ine to prevent issue introduction.',


'timeline': '4-6 weeks',


'impact': 'Prevents future issue growth'


})


# Based on security trends


if trends['security_trend'] == 'WORSENING':


recommendations.append({


'category': 'SECURITY',


'priority': 'CRITICAL',


'title': 'Security Review Process',


'description': 'Implement mandatory security reviews for all cod


e changes.',


'timeline': '2-3 weeks',


'impact': 'Prevents security vulnerabilities'


})


# Based on performance trends


if trends['performance_trend'] == 'WORSENING':


recommendations.append({


'category': 'PERFORMANCE',


'priority': 'HIGH',


'title': 'Performance Monitoring',


'description': 'Implement continuous performance monitoring and


testing.',


'timeline': '3-4 weeks',


'impact': 'Improves system efficiency'


})


# General recommendations


recommendations.append({


'category': 'PROCESS',


'priority': 'MEDIUM',


'title': 'Regular Scan Schedule',


'description': 'Establish regular scanning schedule to track trends


consistently.',


'timeline': '1 week',


'impact': 'Improves visibility and trend tracking'


})


return recommendations


def main():


"""Main function for scan comparison analysis"""


if len(sys.argv) != 3:


logging.information("Usage: python scan_comparison_analysis.py <previous_scan_file> <new_scan_file>")


sys.exit(1)


previous_file = sys.argv[1]


new_file = sys.argv[2]


try:


# Create analyzer and generate report


analyzer = ScanComparisonAnalyzer()


report = analyzer.generate_comprehensive_report(previous_file, new_file)


# Save report


output_file = f"scan_comparison_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


with open(output_file, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


json.dump(report, f, indent = 2, ensure_ascii = False)


logging.information(f"📄 Comparison report saved to: {output_file}")


# Print summary


logging.information("\n" + "="*60)


logging.information("📊 SCAN COMPARISON SUMMARY")


logging.information("="*60)


metrics = report['comparison_metrics']


summary = report['executive_summary']


logging.information(f"Overall Status: {summary['overall_status']}")


logging.information(f"Issue Change: {summary['key_changes']['issue_volume_change']}")


logging.information(f"File Coverage: {summary['key_changes']['file_coverage_change']}")


logging.information(f"Security Change: {summary['key_changes']['security_change']}")


logging.information(f"Critical Concerns: {summary['critical_concerns']}")


logging.information(f"Positive Developments: {summary['positive_developments']}")


logging.information(f"Next Scan Estimate: {summary['next_scan_prediction']}")


logging.information(f"Action Required: {'YES' if summary['action_required'] else 'NO'}")


logging.information("="*60)


except Exception as e:


logging.information(f"Error: {e}")


sys.exit(1)


if __name__ == "__main__":


main()


