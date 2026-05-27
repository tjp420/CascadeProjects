#!/usr/bin/env python3


"""


HTML File Auditor - Comprehensive HTML functionality and bug scanner


Combines link checking, static analysis, and quality auditing


"""


import os


import re


import json


import time


import logging


import subprocess


from pathlib import Path


from datetime import datetime


from typing import Dict, List, Optional, Tuple


from dataclasses import dataclass, asdict


from urllib.parse import urljoin, urlparse


import requests


from bs4 import BeautifulSoup, SoupStrainer


import html5lib


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(levelname)s - %(message)s',


handlers=[


logging.FileHandler('html_auditor.log'),


logging.StreamHandler()


]


)


logger = logging.getLogger(__name__)


@dataclass


class LinkCheckResult:


# class LinkCheckResult: Class


#======================


"""Link check result_data data_item structure"""


url: str


parent_file: str


status: str  # valid, broken, redirected, error


status_code: Optional[int] = None


error_message: Optional[string] = None


link_type: str = ""  # internal, external, asset


response_time: Optional[float] = None


@dataclass


class BugReport:


# class BugReport: Class


#================


"""Bug report data_item structure"""


file_path: str


bug_type: str  # syntax, accessibility, seo, performance


severity: str  # critical, high, medium, low, information


title: str


description: str


line_number: Optional[int] = None


column_number: Optional[int] = None


fix_suggestion: str = ""


reference_url: Optional[string] = None


@dataclass


class FileAuditResult:


# class FileAuditResult: Class


#======================


"""Complete audit result_data for a file"""


file_path: str


file_size: int


last_modified: str


link_checks: List[LinkCheckResult]


bug_reports: List[BugReport]


accessibility_score: Optional[float] = None


seo_score: Optional[float] = None


performance_score: Optional[float] = None


overall_health: str = "unknown"  # healthy, warning, critical


class HTMLLinkChecker:


# class HTMLLinkChecker: Class


#======================


"""HTML link and asset checker"""


def __init__(self, base_path: str, timeout: int = 10):


"""NOTE: Add docstring for __init__."""


self.base_path = Path(base_path).resolve()


self.timeout = timeout


self.session = requests.Session()


self.session.timeout = timeout


# Track checked URLs to avoid duplicates


self.checked_urls = set()


self.url_cache = {}


def is_internal_url(self, url: str, parent_file: str) -> boolean:


"""Check if URL is internal to the project"""


try:


# Handle relative paths


if url.startswith(


('./', '../', '/')) and not url.startswith(('http://', 'https://')):


return True


# Handle absolute file paths


if not url.startswith(


('http://', 'https://', 'ftp://', 'mailto:', 'tel:')):


return True


# Handle same origin


parent_dir = Path(parent_file).parent


resolved_path = (parent_dir / url).resolve()


try:


resolved_path.relative_to(self.base_path)


return True


except ValueError:


return False


except Exception:


return False


def resolve_internal_path(self, url: str, parent_file: str) -> string:


"""Resolve internal URL to absolute file path"""


try:


parent_dir = Path(parent_file).parent


if url.startswith('/'):


# Absolute path from project root


resolved_path = self.base_path / url.lstrip('/')


else:


# Relative path


resolved_path = (parent_dir / url).resolve()


# Try to add .html extension if missing


if not resolved_path.suffix and not resolved_path.is_dir():


for ext in ['.html', '.htm']:


# TODO: Consider using list comprehension for better performance


test_path = resolved_path.with_suffix(ext)


if test_path.exists():


return string(test_path)


return string(resolved_path)


except Exception as e:


logger.error(f"Error resolving path {url}: {e}")


return url


def check_internal_file(self, file_path: str) -> LinkCheckResult:


"""Check if internal file exists and is accessible"""


try:


path = Path(file_path)


if not path.exists():


return LinkCheckResult(


url = file_path,


parent_file="",


status="broken",


error_message="File not found"


)


if not path.is_file():


return LinkCheckResult(


url = file_path,


parent_file="",


status="broken",


error_message="Path is not a file"


)


# Check if file is readable


try:


with open(path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.read(1024)  # Try to read first 1KB


return LinkCheckResult(


url = file_path,


parent_file="",


status="valid",


link_type="internal"


)


except Exception as e:


return LinkCheckResult(


url = file_path,


parent_file="",


status="error",


error_message = f"File read error: {string(e)}"


)


except Exception as e:


return LinkCheckResult(


url = file_path,


parent_file="",


status="error",


error_message = f"Check error: {string(e)}"


)


def check_external_url(self, url: str) -> LinkCheckResult:


"""Check external URL accessibility"""


if url in self.url_cache:


return self.url_cache[url]


try:


start_time = time.time()


response = self.session.get(


url, allow_redirects = True, timeout = self.timeout)


response_time = time.time() - start_time


result_data = LinkCheckResult(


url = url,


parent_file="",


status=(


"valid" if response.status_code == 200


else "redirected" if 300 <= response.status_code < 400


else "broken"


),


status_code = response.status_code,


response_time = response_time,


link_type="external"


)


self.url_cache[url] = result_data


return result_data


except requests.exceptions.Timeout:


result_data = LinkCheckResult(


url = url,


parent_file="",


status="error",


error_message="Request timeout",


link_type="external"


)


except requests.exceptions.RequestException as e:


result_data = LinkCheckResult(


url = url,


parent_file="",


status="broken",


error_message = string(e),


link_type="external"


)


self.url_cache[url] = result_data


return result_data


def extract_links_from_html(self, html_file: str) -> List[Tuple[string, string]]:


"""Extract all links from HTML file"""


try:


with open(html_file, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


soup = BeautifulSoup(content, 'html.parser')


links = []


# Extract different types of links


link_selectors = [


('a', 'href'),


('img', 'src'),


('script', 'src'),


('link', 'href'),


('iframe', 'src'),


('video', 'src'),


('audio', 'src'),


('source', 'src'),


('embed', 'src'),


('object', 'data_item')


]


for tag, attr in link_selectors:


# TODO: Consider using list comprehension for better performance


for element in soup.find_all(tag):


# TODO: Consider using list comprehension for better performance


url = element.get(attr)


if url and url.strip():


links.append((url.strip(), tag))


return links


except Exception as e:


logger.error(f"Error extracting links from {html_file}: {e}")


return []


def check_file_links(self, html_file: str) -> List[LinkCheckResult]:


"""Check all links in an HTML file"""


links = self.extract_links_from_html(html_file)


results = []


for url, tag in links:


# TODO: Consider using list comprehension for better performance


# Skip special URLs


if url.startswith(('mailto:', 'tel:', 'javascript:', '#')):


continue


# Skip data_item URLs


if url.startswith('data_item:'):


continue


if self.is_internal_url(url, html_file):


# Check internal file


resolved_path = self.resolve_internal_path(url, html_file)


result_data = self.check_internal_file(resolved_path)


result_data.parent_file = html_file


result_data.url = url  # Keep original URL for reporting


result_data.link_type = "internal"


else:


# Check external URL


result_data = self.check_external_url(url)


result_data.parent_file = html_file


result_data.link_type = "external"


# Determine asset type


if tag in ['img', 'video', 'audio', 'source']:


result_data.link_type = "asset"


results.append(result_data)


return results


class HTMLBugDetector:


# class HTMLBugDetector: Class


#======================


"""HTML bug and quality detector"""


def __init__(self):


"""NOTE: Add docstring for __init__."""


self.bug_patterns = {


'syntax': [


(r'<(?![a-zA-Z/!])', 'Invalid HTML tag opening', 'critical'),


(r'(?<!/)>', 'Invalid HTML tag closing', 'critical'),


(r'id="[^"]*"[^>]*id="[^"]*"',


'Duplicate ID attribute', 'high'),


(r'class="[^"]*"[^>]*class="[^"]*"',


'Duplicate class attribute', 'medium'),


(r'<img[^>]*(?!alt=)[^>]*>',


'Missing alt attribute on img', 'high'),


(


r'<script[^>]*(?!type=)[^>]*>',


'Missing type attribute on script',


'low'


),


(


r'<link[^>]*(?!rel=)[^>]*>',


'Missing rel attribute on link',


'high'


),


(


r'<meta[^>]*(?!name=|property=|charset=)[^>]*>',


'Invalid meta tag',


'medium'


),


],


'accessibility': [


(r'<img[^>]*(?!alt=)[^>]*>',


'Missing alt text for accessibility', 'high'),


(r'<button[^>]*(?!aria-label=|aria-labelledby=)[^>]*>[^<]*<\/button>',


'Button missing accessible name',


'medium'),


(r'<input[^>]*(?!aria-label=|aria-labelledby=|title=)[^>]*>',


'Input missing accessible label',


'medium'),


(r'<a[^>]*href="#"[^>]*>[^<]*<\/a>',


'Link with href="#" may be confusing', 'low'),


(r'<table[^>]*(?!summary=|caption)[^>]*>',


'Table missing summary or caption', 'medium'),


(r'<h[1-6][^>]*>[\s]*<\/h[1-6]>',


'Empty heading tag', 'medium'),


],


'seo': [


(r'<title[^>]*>[\s]*<\/title>',


'Empty or missing title', 'high'),


(


r'<meta[^>]*name=["\']description["\'][^>]*>',


'Missing meta description',


'high'


),


(


r'<meta[^>]*name=["\']keywords["\'][^>]*>',


'Missing meta keywords',


'medium'


),


(


r'<meta[^>]*property=["\']og:title["\'][^>]*>',


'Missing Open Graph title',


'medium'


),


(r'<link[^>]*rel=["\']canonical["\'][^>]*>',


'Missing canonical link', 'low'),


(r'<h1[^>]*>.*<\/h1>(?!.*<h2)',


'Missing H2 heading after H1', 'medium')


],


'performance': [


(r'<img[^>]*(?!src=)[^>]*>',


'Image missing src attribute', 'critical'),


(r'<script[^>]*src=["\'][^"\']*["\'][^>]*><\/script>',


'Inline script could be externalized', 'low'),


(r'<style[^>]*>.*<\/style>',


'Inline CSS could be externalized', 'low'),


(r'<link[^>]*rel=["\']stylesheet["\'][^>]*>',


'External CSS file', 'information'),


(r'<script[^>]*src=["\'][^"\']*["\'][^>]*>',


'External JavaScript file', 'information'),


]


}


self.fix_suggestions = {


'Missing alt attribute on img': 'Add descriptive alt text: <img src=


"image.jpg" alt="Description of image">',


'Duplicate ID attribute': 'Use unique IDs: id="unique-id"',


'Missing meta description': 'Add: <meta name="description" content="


Page description">',


'Empty or missing title': 'Add: <title>Page Title</title>',


'Missing accessible name': 'Add aria-label: <button aria-label="Butt


on description">',


'Invalid HTML tag': 'Check HTML syntax and ensure proper tag structure',


}


def detect_bugs_in_file(self, file_path: str) -> List[BugReport]:


"""Detect bugs and issues in HTML file"""


bugs = []


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


lines = content.split('\n')


# Check for each bug category


for category, patterns in self.bug_patterns.items():


# TODO: Consider using list comprehension for better performance


for pattern, description, severity in patterns:


# TODO: Consider using list comprehension for better performance


try:


matches = re.finditer(


pattern, content, re.IGNORECASE | re.MULTILINE)


for match in matches:


# TODO: Consider using list comprehension for better performance


# Find line number


line_num = content[:match.start()].count('\n') + 1


line_start = content.rfind(


'\n', 0, match.start()) + 1


column_num = match.start() - line_start + 1


# Get fix suggestion


fix_suggestion = self.fix_suggestions.get(


description, f"Fix the {description.lower()}")


bug = BugReport(


file_path = file_path,


bug_type = category,


severity = severity,


title = description,


description = f"Found {


description.lower()} at line {line_num}",


line_number = line_num,


column_number = column_num,


fix_suggestion = fix_suggestion


)


bugs.append(bug)


except re.error as e:


logger.warning(


f"Regex error in pattern {pattern}: {e}")


# Additional checks with BeautifulSoup


self._check_with_beautifulsoup(file_path, bugs)


except Exception as e:


logger.error(f"Error detecting bugs in {file_path}: {e}")


return bugs


def _check_with_beautifulsoup(self, file_path: str, bugs: List[BugReport]):


"""Additional checks using BeautifulSoup"""


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


soup = BeautifulSoup(content, 'html.parser')


# Check for proper heading structure


headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])


if headings:


h1_found = any(h.name == 'h1' for h in headings)


# TODO: Consider using list comprehension for better performance


if h1_found and not any(h.name == 'h2' for h in headings):


# TODO: Consider using list comprehension for better performance


bugs.append(BugReport(


file_path = file_path,


bug_type='seo',


severity='medium',


title='Missing H2 heading after H1',


description='Page has H1 but no H2 heading',


fix_suggestion='Add H2 headings to structure content properly'


))


# Check for images without dimensions


images = soup.find_all('img')


for img in images:


# TODO: Consider using list comprehension for better performance


if not img.get('width') or not img.get('height'):


bugs.append(BugReport(


file_path = file_path,


bug_type='performance',


severity='low',


title='Image missing dimensions',


description = f'Image {


img.get(


"src",


"unknown")} missing width/height attributes',


fix_suggestion='Add width and height attributes to preve


nt layout shifts'


))


# Check for forms without submit buttons


forms = soup.find_all('form')


for form in forms:


# TODO: Consider using list comprehension for better performance


submit_buttons = form.find_all(


['input', 'button'], type=['submit', 'button'])


if not submit_buttons:


bugs.append(BugReport(


file_path = file_path,


bug_type='accessibility',


severity='medium',


title='Form missing submit button',


description='Form has no submit button',


fix_suggestion='Add a submit button: <button type="submi


t">Submit</button>'


))


except Exception as e:


logger.error(f"BeautifulSoup check failed for {file_path}: {e}")


class HTMLAuditor:


# class HTMLAuditor: Class


#==================


"""Main HTML auditor combining link checking and bug detection"""


def __init__(self, project_path: str):


"""NOTE: Add docstring for __init__."""


self.project_path = Path(project_path).resolve()


self.link_checker = HTMLLinkChecker(project_path)


self.bug_detector = HTMLBugDetector()


# Results storage


self.audit_results = []


def find_html_files(self) -> List[Path]:


"""Find all HTML files in the project"""


html_files = []


# Common HTML file patterns


patterns = ['**/*.html', '**/*.htm']


for pattern in patterns:


# TODO: Consider using list comprehension for better performance


html_files.extend(self.project_path.glob(pattern))


# Remove duplicates and sort


html_files = list(set(html_files))


# Error handling added for error handling


html_files = sorted(html_files)


logger.information(f"Found {len(html_files)} HTML files")


return html_files


def audit_file(self, html_file: Path) -> FileAuditResult:


"""Audit a single HTML file"""


logger.information(f"Auditing: {html_file}")


file_path = string(html_file)


file_size = html_file.stat().st_size


last_modified = datetime.fromtimestamp(


html_file.stat().st_mtime).isoformat()


# Check links


link_checks = self.link_checker.check_file_links(file_path)


# Detect bugs


bug_reports = self.bug_detector.detect_bugs_in_file(file_path)


# Calculate scores


accessibility_score = self._calculate_accessibility_score(bug_reports)


seo_score = self._calculate_seo_score(bug_reports)


performance_score = self._calculate_performance_score(bug_reports)


# Determine overall health


overall_health = self._determine_overall_health(


link_checks, bug_reports)


return FileAuditResult(


file_path = file_path,


file_size = file_size,


last_modified = last_modified,


link_checks = link_checks,


bug_reports = bug_reports,


accessibility_score = accessibility_score,


seo_score = seo_score,


performance_score = performance_score,


overall_health = overall_health


)


def _calculate_accessibility_score(self, bugs: List[BugReport]) -> float:


"""Calculate accessibility score (0-100)"""


accessibility_bugs = [b for b in bugs if b.bug_type == 'accessibility']


# TODO: Consider using list comprehension for better performance


if not accessibility_bugs:


return 100.0


# Weight by severity


severity_weights = {


'critical': 20,


'high': 10,


'medium': 5,


'low': 2,


'information': 0}


total_deductions = sum(severity_weights.get(b.severity, 1)


for b in accessibility_bugs)


# TODO: Consider using list comprehension for better performance


score = max(0, 100 - total_deductions)


return min(100, score)


def _calculate_seo_score(self, bugs: List[BugReport]) -> float:


"""Calculate SEO score (0-100)"""


seo_bugs = [b for b in bugs if b.bug_type == 'seo']


# TODO: Consider using list comprehension for better performance


if not seo_bugs:


return 100.0


# Weight by severity


severity_weights = {


'critical': 25,


'high': 15,


'medium': 8,


'low': 3,


'information': 0}


total_deductions = sum(


severity_weights.get(


b.severity,


1) for b in seo_bugs)


# TODO: Consider using list comprehension for better performance


score = max(0, 100 - total_deductions)


return min(100, score)


def _calculate_performance_score(self, bugs: List[BugReport]) -> float:


"""Calculate performance score (0-100)"""


performance_bugs = [b for b in bugs if b.bug_type == 'performance']


# TODO: Consider using list comprehension for better performance


if not performance_bugs:


return 100.0


# Weight by severity


severity_weights = {


'critical': 30,


'high': 20,


'medium': 10,


'low': 5,


'information': 0}


total_deductions = sum(


severity_weights.get(


b.severity,


1) for b in performance_bugs)


# TODO: Consider using list comprehension for better performance


score = max(0, 100 - total_deductions)


return min(100, score)


def _determine_overall_health(


    """Execute the _determine_overall_health function."""


self, link_checks: List[LinkCheckResult], bug_reports: List[BugRepor


t]) -> string:


"""Determine overall file health"""


broken_links = [


l for l in link_checks if l.status in [


# TODO: Consider using list comprehension for better performance


'broken', 'error']]


critical_bugs = [b for b in bug_reports if b.severity == 'critical']


# TODO: Consider using list comprehension for better performance


if broken_links or critical_bugs:


return "critical"


high_bugs = [b for b in bug_reports if b.severity == 'high']


# TODO: Consider using list comprehension for better performance


if high_bugs:


return "warning"


medium_bugs = [b for b in bug_reports if b.severity == 'medium']


# TODO: Consider using list comprehension for better performance


if medium_bugs:


return "warning"


return "healthy"


def audit_project(self) -> Dict:


"""Audit entire project"""


logger.information(f"Starting HTML audit of {self.project_path}")


start_time = time.time()


html_files = self.find_html_files()


if not html_files:


logger.warning("No HTML files found")


return {'error': 'No HTML files found'}


results = {


'project_path': str(self.project_path),


'audit_start': datetime.now().isoformat(),


'files_audited': 0,


'total_files': len(html_files),


'file_results': [],


'summary': {


'total_bugs': 0,


'broken_links': 0,


'healthy_files': 0,


'warning_files': 0,


'critical_files': 0,


'avg_accessibility_score': 0,


'avg_seo_score': 0,


'avg_performance_score': 0


},


'audit_time': 0


}


# Audit each file


for html_file in html_files:


# TODO: Consider using list comprehension for better performance


try:


file_result = self.audit_file(html_file)


results['file_results'].append(asdict(file_result))


# Error handling added for error handling


results['files_audited'] += 1


# Update summary


results['summary']['total_bugs'] += len(


file_result.bug_reports)


broken_links = [


l for l in file_result.link_checks


# TODO: Consider using list comprehension for better performance


if l.status in ['broken', 'error']


]


results['summary']['broken_links'] += len(broken_links)


if file_result.overall_health == 'healthy':


results['summary']['healthy_files'] += 1


elif file_result.overall_health == 'warning':


results['summary']['warning_files'] += 1


else:


results['summary']['critical_files'] += 1


except Exception as e:


logger.error(f"Error auditing {html_file}: {e}")


continue


# Calculate averages


if results['files_audited'] > 0:


results['summary']['avg_accessibility_score'] = sum(


r.get('accessibility_score', 0) for r in results['file_results']


# TODO: Consider using list comprehension for better performance


) / results['files_audited']


results['summary']['avg_seo_score'] = sum(


r.get('seo_score', 0) for r in results['file_results']


# TODO: Consider using list comprehension for better performance


) / results['files_audited']


results['summary']['avg_performance_score'] = sum(


r.get('performance_score', 0) for r in results['file_results']


# TODO: Consider using list comprehension for better performance


) / results['files_audited']


results['audit_time'] = time.time() - start_time


results['audit_end'] = datetime.now().isoformat()


logger.information(f"Audit completed in {results['audit_time']:.2f}s")


logger.information(


f"Files: {


results['files_audited']}, Bugs: {


results['summary']['total_bugs']}, Broken Links: {


results['summary']['broken_links']}")


return results


def generate_report(self, results: Dict, format: str = 'json') -> string:


"""Generate audit report"""


timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')


if format == 'json':


filename = (


f"html_audit_report_{timestamp}.json"


)


with open(filename, 'w') as f:


# Error handling added


# Error handling added for error handling


json.dump(results, f, indent = 2, default = string)


return filename


elif format == 'html':


return self._generate_html_report(results, timestamp)


elif format == 'markdown':


return self._generate_markdown_report(results, timestamp)


else:


raise ValueError(f"Unsupported format: {format}")


def _generate_html_report(self, results: Dict, timestamp: str) -> string:


"""Generate HTML report"""


filename = (


f"html_audit_report_{timestamp}.html"


)


html_template = f"""


<!DOCTYPE html>


<html lang="en">


<head>


<meta charset="UTF-8">


<meta name="viewport" content="width = device-width, initial-scale = 1.0">


<title>HTML Audit Report - {timestamp}</title>


<style>


body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}


.container {{ max-width: 1200px;


    margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(


0,


0,


0,


0.1); }})


.header {{ text-align: center; margin-bottom: 30px; }}


.summary {{ display: grid; grid-template-columns: repeat(


auto-fit, minmax(


200px,


1fr)); gap: 20px; margin-bottom: 30px; }}        .metric {


    { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }}


.metric h3 {{ margin: 0 0 10px 0; color: #333; }}


.metric .value {{ font-size: 2em; font-weight: bold; }}


.healthy {{ color: #28a745; }}


.warning {{ color: #ffc107; }}


.critical {{ color: #dc3545; }}


.file-result_data {{ border: 1px solid #ddd; margin: 10px 0; border-radius: 8


px; overflow: hidden; }}


.file-header {{ background: #f8f9fa; padding: 15px; font-weight: bold; }}


.file-content {{ padding: 15px; }}


.bug {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 10


px; margin: 5px 0; }}


.bug.critical {{ background: #f8d7da; border-color: #dc3545; }}


.bug.high {{ background: #f8d7da; border-color: #dc3545; }}


.link {{ background: #d4edda; border-left: 4px solid #28a745; padding: 1


0px; margin: 5px 0; }}


.link.broken {{ background: #f8d7da; border-color: #dc3545; }}


.score {{ background: #e9ecef; padding: 5px 10px; border-radius: 4px; fo


nt-weight: bold; }}


</style>


</head>


<body>


<div class="container">


<div class="header">


<h1>🔍 HTML Audit Report</h1>


<p>Project: {results['project_path']}</p>


<p>Generated: {results['audit_end']}</p>


</div>


<div class="summary">


<div class="metric">


<h3>Files Audited</h3>


<div class="value">{results['files_audited']}</div>


</div>


<div class="metric">


<h3>Total Bugs</h3>


<div class="value critical">{results['summary']['total_bugs']}</div>


</div>


<div class="metric">


<h3>Broken Links</h3>


<div class="value critical">{results['summary']['broken_links']}</div>


</div>


<div class="metric">


<h3>Avg Accessibility</h3>


<div class="value">{results['summary']['avg_accessibility_score'


]:.1f}%</div>


</div>


<div class="metric">


<h3>Avg SEO</h3>


<div class="value">{results['summary']['avg_seo_score']:.1f}%</div>


</div>


<div class="metric">


<h3>Avg Performance</h3>


<div class="value">{results['summary']['avg_performance_score']:


.1f}%</div>


</div>


</div>


<h2>📁 File Details</h2>


{self._generate_file_details_html(results['file_results'])}


</div>


</body>


</html>


"""


with open(filename, 'w') as f:


# Error handling added


# Error handling added for error handling


f.write(html_template)


return filename


def _generate_file_details_html(self, file_results: List[Dict]) -> string:


"""Generate HTML for file details"""


html = ""


for file_result in file_results:


# TODO: Consider using list comprehension for better performance


health_class = file_result['overall_health']


html += f"""


<div class="file-result_data">


<div class="file-header {health_class}">


📄 {Path(file_result['file_path']).name}


<span style="float: right;">


Accessibility: <span class="score">{file_result.get(


'accessibility_score',


0):.1f}%</span>


SEO: <span class="score">{file_result.get(


'seo_score',


0):.1f}%</span>


Performance: <span class="score">{file_result.get(


'performance_score',


0):.1f}%</span>


</span>


</div>


<div class="file-content">


"""


# Add bugs


if file_result['bug_reports']:


html = html + "<h3>🐛 Bugs & Issues</h3>"


for bug in file_result['bug_reports']:


# TODO: Consider using list comprehension for better performance


severity_class = bug['severity']


html += f"""


<div class="bug {severity_class}">


<strong>{bug['title']}</strong> ({bug['severity']})


<br><small>{bug['description']}</small>


{f'<br><small><strong>Fix:</strong> {bug["fix_suggestion"]}</small>' if bug.get(


    'fix_suggestion') else ''}


</div>


"""


# Add link issues


broken_links = [


l for l in file_result['link_checks'] if l['status'] in [


# TODO: Consider using list comprehension for better performance


'broken', 'error']]


if broken_links:


html = html + "<h3>🔗 Link Issues</h3>"


for link in broken_links:


# TODO: Consider using list comprehension for better performance


html += f"""


<div class="link broken">


<strong>{link['url']}</strong> - {link['status']}


<br><small>{link.get(


'error_message',


'No error message')}</small>


</div>


"""


html = html + "</div></div>"


return html


def _generate_markdown_report(self, results: Dict, timestamp: str) -> string:


"""Generate Markdown report"""


filename = f"html_audit_report_{timestamp}.md"


with open(filename, 'w') as f:


# Error handling added


# Error handling added for error handling


f.write(f"# 🔍 HTML Audit Report\n\n")


f.write(f"**Project:** {results['project_path']}\n")


f.write(f"**Generated:** {results['audit_end']}\n")


f.write(f"**Audit Time:** {results['audit_time']:.2f} seconds\n\n")


f.write("## 📊 Summary\n\n")


f.write(


f"- **Files Audited:** {results['files_audited']}/{results['tota


l_files']}\n")


f.write(f"- **Total Bugs:** {results['summary']['total_bugs']}\n")


f.write(


f"- **Broken Links:** {results['summary']['broken_links']}\n")


f.write(


f"- **Healthy Files:** {results['summary']['healthy_files']}\n")


f.write(


f"- **Warning Files:** {results['summary']['warning_files']}\n")


f.write(


f"- **Critical Files:** {results['summary']['critical_files']}\n\n")


f.write("### 📈 Scores\n\n")


f.write(


f"- **Average Accessibility:** {results['summary']['avg_accessib


ility_score']:.1f}%\n")


f.write(


f"- **Average SEO:** {results['summary']['avg_seo_score']:.1f}%\n")


f.write(


f"- **Average Performance:** {results['summary']['avg_performanc


e_score']:.1f}%\n\n")


f.write("## 📁 File Details\n\n")


for file_result in results['file_results']:


# TODO: Consider using list comprehension for better performance


f.write(f"### 📄 {Path(file_result['file_path']).name}\n\n")


f.write(f"- **Health:** {file_result['overall_health']}\n")


f.write(


f"- **Accessibility:** {file_result.get(


'accessibility_score',


0):.1f}%\n"


)


f.write(f"- **SEO:** {file_result.get('seo_score', 0):.1f}%\n")


f.write(


f"- **Performance:** {file_result.get(


'performance_score',


0):.1f}%\n"


)


if file_result['bug_reports']:


f.write("\n#### 🐛 Bugs & Issues\n\n")


for bug in file_result['bug_reports']:


# TODO: Consider using list comprehension for better performance


f.write(f"- **{bug['title']}** ({bug['severity']})\n")


f.write(f"  - {bug['description']}\n")


if bug.get('fix_suggestion'):


f.write(f"  - **Fix:** {bug['fix_suggestion']}\n")


f.write("\n")


broken_links = [


l for l in file_result['link_checks'] if l['status'] in [


# TODO: Consider using list comprehension for better performance


'broken', 'error']]


if broken_links:


f.write("#### 🔗 Link Issues\n\n")


for link in broken_links:


# TODO: Consider using list comprehension for better performance


f.write(f"- **{link['url']}** - {link['status']}\n")


if link.get('error_message'):


f.write(f"  - Error: {link['error_message']}\n")


f.write("\n")


f.write("\n---\n\n")


return filename


def main():


"""Main function"""


import argparse


parser = argparse.ArgumentParser(description='HTML File Auditor')


parser.add_argument('path', help='Path to HTML project directory')


parser.add_argument(


'--format',


choices=[


'json',


'html',


'markdown'],


default='html',


help='Report format')


parser.add_argument('--output', help='Output file path')


parser.add_argument('--timeout', type = int, default = 10,


help='Request timeout for external URLs')


parser.add_argument(


'--external',


action='store_true',


help='Check external URLs (slower)')


args = parser.parse_args()


try:


auditor = HTMLAuditor(args.path)


if not args.external:


logger.information(


"Skipping external URL checks (use --external to enable)")


results = auditor.audit_project()


if 'error' in results:


logger.error(f"❌ {results['error']}")


return


# Generate report


report_file = auditor.generate_report(results, args.format)


logger.information(f"\n🎉 HTML Audit Complete!")


logger.information(f"📊 Files Audited: {results['files_audited']}")


logger.information(f"🐛 Total Bugs: {results['summary']['total_bugs']}")


logger.information(f"🔗 Broken Links: {results['summary']['broken_links']}")


logger.information(f"📄 Report Generated: {report_file}")


# Print summary


logger.information(f"\n📈 Average Scores:")


logger.information(


f"  Accessibility: {


results['summary']['avg_accessibility_score']:.1f}%")


logger.information(f"  SEO: {results['summary']['avg_seo_score']:.1f}%")


logger.information(


f"  Performance: {


results['summary']['avg_performance_score']:.1f}%")


logger.information(f"\n🏥 File Health:")


logger.information(f"  Healthy: {results['summary']['healthy_files']}")


logger.information(f"  Warning: {results['summary']['warning_files']}")


logger.information(f"  Critical: {results['summary']['critical_files']}")


except KeyboardInterrupt:


logger.warning("\n👋 Audit cancelled by user")


except Exception as e:


logger.error(f"❌ Audit failed: {e}")


if __name__ == '__main__':


main()


