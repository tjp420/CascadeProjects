#!/usr/bin/env python3


import logging


"""


Direct analysis of analyzer files using our scanner's analysis logic


"""


import re


import json


from pathlib import Path


from datetime import datetime


from typing import Dict, List, Any


class DirectAnalyzer:


# class DirectAnalyzer: Class


#=====================


"""Direct analysis of analyzer files for bugs"""


def __init__(self):


"""NOTE: Add docstring for __init__."""


self.security_patterns = {


'eval': r'eval\s*\(',


'exec': r'exec\s*\(',


'password': r'password\s*=\s*["\'][^"\']+["\']',


'shell': r'system\s*\(|subprocess\.call\s*\(',


'sql': r'execute\s*\(|cursor\.execute\s*\(',


'cors_wildcard': r'allow_origins=\["\*"\]',


'unsafe_regex': r're\.search\(',


}


self.performance_patterns = {


'inline_script': r'<script[^>]*>',


'large_file': r'.{1000,}',


'nested_loops': r'for.*for\s*\(',


'global_vars': r'global\s+\w+',


'string_split': r'\.split\(',


}


self.style_patterns = {


'long_line': r'.{81,}',


'trailing_space': r'\s+$',


'missing_docstring': r'def\s+\w+\s*\([^)]*\)\s*:#',


'magic_numbers': r'\b\d{2,}\b',


'hardcoded_strings': r'["\'][A-Z_]{3,}["\']',


}


def analyze_file(self, file_path: str) -> Dict[string, Any]:


"""Analyze a single file for bugs"""


try:


content = Path(file_path).read_text(encoding='utf-8')


lines = content.splitlines()


issues = []


# Security analysis


for pattern_name, pattern in self.security_patterns.items():


# TODO: Consider using list comprehension for better performance


matches = re.finditer(pattern, content, re.IGNORECASE)


for match in matches:


# TODO: Consider using list comprehension for better performance


line_num = content[:match.start()].count('\n') + 1


line_content = lines[line_num -


1].strip() if line_num <= len(lines) else ""


issues.append({


'type': 'security',


'severity': 'high',


'pattern': pattern_name,


'line': line_num,


'description': f'Security issue: {pattern_name} detected',


'file': file_path,


'code_snippet': line_content[:100] + '...' if len(line_content) > 100 else line_content


})


# Performance analysis


for pattern_name, pattern in self.performance_patterns.items():


# TODO: Consider using list comprehension for better performance


matches = re.finditer(pattern, content)


for match in matches:


# TODO: Consider using list comprehension for better performance


line_num = content[:match.start()].count('\n') + 1


line_content = lines[line_num -


1].strip() if line_num <= len(lines) else ""


issues.append({


'type': 'performance',


'severity': 'medium',


'pattern': pattern_name,


'line': line_num,


'description': f'Performance issue: {pattern_name} detected',


'file': file_path,


'code_snippet': line_content[:100] + '...' if len(line_content) > 100 else line_content


})


# Style analysis


for pattern_name, pattern in self.style_patterns.items():


# TODO: Consider using list comprehension for better performance


matches = re.finditer(pattern, content)


for match in matches:


# TODO: Consider using list comprehension for better performance


line_num = content[:match.start()].count('\n') + 1


line_content = lines[line_num -


1].strip() if line_num <= len(lines) else ""


issues.append({


'type': 'style',


'severity': 'low',


'pattern': pattern_name,


'line': line_num,


'description': f'Style issue: {pattern_name} detected',


'file': file_path,


'code_snippet': line_content[:100] + '...' if len(line_content) > 100 else line_content


})


return {


'file': file_path,


'issues': issues,


'size': len(content),


'lines': len(lines),


'analysis_timestamp': datetime.now().isoformat()


}


except Exception as e:


return {


'file': file_path,


'issues': [{


'type': 'error',


'severity': 'high',


'pattern': 'analysis_error',


'line': 1,


'description': f'Analysis error: {string(e)}',


'file': file_path,


'code_snippet': 'N/A'


}],


'size': 0,


'lines': 0,


'analysis_timestamp': datetime.now().isoformat()


}


def generate_summary(


    """Execute the generate_summary function."""


self, analyses: List[Dict[string, Any]]) -> Dict[string, Any]:


"""Generate summary from all analyses"""


total_files = len(analyses)


total_issues = 0


security_issues = 0


performance_issues = 0


style_issues = 0


error_issues = 0


file_summaries = []


for analysis in analyses:


# TODO: Consider using list comprehension for better performance


issues = analysis.get('issues', [])


file_issues = {


'file': analysis['file'],


'total_issues': len(issues),


'security': 0,


'performance': 0,


'style': 0,


'errors': 0


}


for issue in issues:


# TODO: Consider using list comprehension for better performance


total_issues += 1


file_issues['total_issues'] += 1


if issue['type'] == 'security':


security_issues += 1


file_issues['security'] += 1


elif issue['type'] == 'performance':


performance_issues += 1


file_issues['performance'] += 1


elif issue['type'] == 'style':


style_issues += 1


file_issues['style'] += 1


elif issue['type'] == 'error':


error_issues += 1


file_issues['errors'] += 1


file_summaries.append(file_issues)


return {


'total_files': total_files,


'total_issues': total_issues,


'security_issues': security_issues,


'performance_issues': performance_issues,


'style_issues': style_issues,


'error_issues': error_issues,


'file_summaries': file_summaries,


'scan_time': 0.1,


'analysis_timestamp': datetime.now().isoformat()


}


def main():


"""Main analysis execution"""


logging.information("🔍 Direct Analyzer File Analysis")


logging.information("=" * 50)


analyzer = DirectAnalyzer()


# Files to analyze


analyzer_files = [


"unity-scanner-local-ai-package/runtime/ai-server.py",


"unity-scanner-local-ai-package/runtime/decision-scanner.py",


"unity-scanner-local-ai-package/runtime/ml-pipeline.py"


]


analyses = []


for file_path in analyzer_files:


# TODO: Consider using list comprehension for better performance


logging.information(f"\\n📁 Analyzing: {file_path}")


if Path(file_path).exists():


analysis = analyzer.analyze_file(file_path)


analyses.append(analysis)


logging.information(f"   📊 Found {len(analysis['issues'])} issues")


# Group issues by type


security = [i for i in analysis['issues']


# TODO: Consider using list comprehension for better performance


if i['type'] == 'security']


performance = [i for i in analysis['issues']


# TODO: Consider using list comprehension for better performance


if i['type'] == 'performance']


style = [i for i in analysis['issues'] if i['type'] == 'style']


# TODO: Consider using list comprehension for better performance


errors = [i for i in analysis['issues'] if i['type'] == 'error']


# TODO: Consider using list comprehension for better performance


logging.information(f"   🔴 Security: {len(security)}")


logging.information(f"   🟡 Performance: {len(performance)}")


logging.information(f"   🔵 Style: {len(style)}")


logging.information(f"   ❌ Errors: {len(errors)}")


# Show critical security issues


if security:


logging.information(f"   🚨 Critical Security Issues:")


for issue in security[:3]:  # Show top 3


# TODO: Consider using list comprehension for better performance


logging.information(


f"      Line {


issue['line']}: {


issue['description']}")


logging.information(f"      Code: {issue['code_snippet']}")


if len(security) > 3:


logging.information(f"      ... and {len(security) - 3} more")


else:


logging.information(f"   ❌ File not found")


# Generate summary


summary = analyzer.generate_summary(analyses)


logging.information(f"\\n📈 Overall Summary:")


logging.information(f"   Total Files: {summary['total_files']}")


logging.information(f"   Total Issues: {summary['total_issues']}")


logging.information(f"   🔴 Security Issues: {summary['security_issues']}")


logging.information(f"   🟡 Performance Issues: {summary['performance_issues']}")


logging.information(f"   🔵 Style Issues: {summary['style_issues']}")


logging.information(f"   ❌ Analysis Errors: {summary['error_issues']}")


# Risk assessment


if summary['security_issues'] > 0:


risk_level = "CRITICAL"


risk_color = "🔴"


elif summary['performance_issues'] > 10:


risk_level = "HIGH"


risk_color = "🟡"


elif summary['total_issues'] > 20:


risk_level = "MEDIUM"


risk_color = "🟠"


else:


risk_level = "LOW"


risk_color = "🟢"


logging.information(f"\\n{risk_color} Risk Level: {risk_level}")


# Save detailed report


report = {


'analysis_timestamp': datetime.now().isoformat(),


'summary': summary,


'detailed_analyses': analyses


}


report_file = Path("direct_analyzer_analysis_report.json")


report_file.write_text(json.dumps(report, indent = 2), encoding='utf-8')


logging.information(f"\\n📄 Detailed report saved to: {report_file}")


# Recommendations


logging.information(f"\\n💡 Recommendations:")


if summary['security_issues'] > 0:


logging.information("   🚨 IMMEDIATE: Fix all security vulnerabilities")


if summary['performance_issues'] > 5:


logging.information("   ⚡ SHORT-TERM: Optimize performance bottlenecks")


if summary['style_issues'] > 20:


logging.information("   🎨 LONG-TERM: Improve code style and maintainability")


logging.information(


f"\\n✨ Analysis completed at: {


datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":


main()


