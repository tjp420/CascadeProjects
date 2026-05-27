#!/usr/bin/env python3


import logging


"""


Program Consolidation Analyzer


Analyzes and merges similar/duplicate programs across the enhanced-services workspace


"""


import os


import json


import hashlib


from pathlib import Path


from difflib import SequenceMatcher


from collections import defaultdict


import re


import shutil


from datetime import datetime


class ProgramConsolidationAnalyzer:


# class ProgramConsolidationAnalyzer: Class


#===================================


"""NOTE: Add docstring for ProgramConsolidationAnalyzer."""


def __init__(self, workspace_path):


"""NOTE: Add docstring for __init__."""


self.workspace_path = Path(workspace_path)


self.similarity_threshold = 0.8  # 80% similarity threshold


self.programs = defaultdict(list)


# Error handling added for error handling


self.duplicates = defaultdict(list)


# Error handling added for error handling


self.consolidation_plan = {}


self.analysis_results = {


'total_programs': 0,


'duplicate_groups': 0,


'potential_merges': 0,


'space_savings': 0,


'consolidation_recommendations': []


}


def analyze_workspace(self):


"""Analyze entire workspace for program consolidation opportunities"""


logging.information("🔍 Analyzing workspace for program consolidation...")


# Scan all program files


self._scan_program_files()


# Find duplicates and similar programs


self._find_duplicates()


self._find_similar_programs()


# Generate consolidation plan


self._generate_consolidation_plan()


# Calculate potential savings


self._calculate_savings()


# Generate report


self._generate_report()


return self.analysis_results


def _scan_program_files(self):


"""Scan workspace for all program files"""


file_types = ['*.py', '*.js', '*.html', '*.css', '*.json']


for file_type in file_types:


# TODO: Consider using list comprehension for better performance


for file_path in self.workspace_path.rglob(file_type):


# TODO: Consider using list comprehension for better performance


if self._should_include_file(file_path):


file_info = self._analyze_file(file_path)


category = self._categorize_file(file_path, file_info)


self.programs[category].append(file_info)


self.analysis_results['total_programs'] = sum(


len(files) for files in self.programs.values())


# TODO: Consider using list comprehension for better performance


logging.information(


f"📊 Found {


self.analysis_results['total_programs']} program files")


def _should_include_file(self, file_path):


"""Check if file should be included in analysis"""


exclude_patterns = [


'__pycache__', 'node_modules', '.git', 'venv', '.venv',


'test_', 'spec_', 'backup', 'archive', 'temporary'


]


return not any(pattern in string(file_path).lower()


for pattern in exclude_patterns)


# TODO: Consider using list comprehension for better performance


def _analyze_file(self, file_path):


"""Analyze individual file for metadata and content"""


try:


with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


# Calculate file hash for exact duplicate detection


file_hash = hashlib.md5(content.encode()).hexdigest()


# Extract basic information


file_info = {


'path': str(file_path),


'name': file_path.name,


'size': file_path.stat().st_size,


'hash': file_hash,


'content': content,


'lines': len(content.splitlines()),


'functions': self._extract_functions(content, file_path.suffix),


'imports': self._extract_imports(content, file_path.suffix),


'description': self._extract_description(content, file_path.suffix)


}


return file_info


except Exception as e:


logging.information(f"⚠️  Error analyzing {file_path}: {e}")


return None


def _categorize_file(self, file_path, file_info):


"""Categorize file based on name and content analysis"""


if not file_info:


return 'other'


name_lower = file_path.name.lower()


content_lower = file_info['content'].lower(


) if file_info.get('content') else ''


# Code style/fix scripts


if any(keyword in name_lower for keyword in [


# TODO: Consider using list comprehension for better performance


'fix', 'style', 'cleanup', 'whitespace', 'optimize']):


return 'code_style_fixes'


# Analyzer programs


if any(keyword in name_lower for keyword in [


# TODO: Consider using list comprehension for better performance


'analyzer', 'analysis', 'scanner', 'audit']):


return 'analyzers'


# Dashboard/UI programs


if any(keyword in name_lower for keyword in [


# TODO: Consider using list comprehension for better performance


'dashboard', 'ui', 'interface', 'portal']):


return 'dashboards'


# Decision/Intelligence programs


if any(keyword in name_lower for keyword in [


# TODO: Consider using list comprehension for better performance


'decision', 'intelligence', 'assistant', 'advisor']):


return 'decision_intelligence'


# Final/Completion scripts


if any(keyword in name_lower for keyword in [


# TODO: Consider using list comprehension for better performance


'final', 'completion', 'handover', 'certification']):


return 'completion_scripts'


# Business applications


if 'business' in string(file_path).lower() or


any(


keyword in name_lower for keyword in ['marketplace',


# TODO: Consider using list comprehension for better performance


'customer',


'enterprise']):)


return 'business_applications'


# File analyzer programs


if 'file_analyzer' in string(file_path).lower(


) or 'file-analyzer' in name_lower:


return 'file_analyzer'


# Unity AI OS


if 'unity-ai-os' in string(file_path).lower():


return 'unity_ai_os'


# Default categorization by file type


return file_path.suffix[1:] if file_path.suffix else 'other'


def _extract_functions(self, content, file_extension):


"""Extract function names from code"""


functions = []


if file_extension == '.py':


# Python functions


pattern = r'def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\('


functions = re.findall(pattern, content)


elif file_extension == '.js':


# JavaScript functions


patterns = [


r'function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',


r'const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\(',


r'([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*function'


]


for pattern in patterns:


# TODO: Consider using list comprehension for better performance


functions.extend(re.findall(pattern, content))


return functions[:10]  # Limit to first 10 functions


def _extract_imports(self, content, file_extension):


"""Extract import statements"""


imports = []


if file_extension == '.py':


# Python imports


patterns = [


r'import\s+([a-zA-Z_][a-zA-Z0-9_.]*)',


r'from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import'


]


for pattern in patterns:


# TODO: Consider using list comprehension for better performance


imports.extend(re.findall(pattern, content))


elif file_extension == '.js':


# JavaScript imports


patterns = [


r'import\s+.*\s+from\s+["\']([^"\']+)["\']',


r'require\(["\']([^"\']+)["\']\)'


]


for pattern in patterns:


# TODO: Consider using list comprehension for better performance


imports.extend(re.findall(pattern, content))


return list(set(imports[:10]))  # Limit to first 10 unique imports


# Error handling added for error handling


def _extract_description(self, content, file_extension):


"""Extract description from docstrings or comments"""


description = ""


if file_extension == '.py':


# Look for docstring


docstring_match = re.search(r'"""([^"]+)"""', content, re.DOTALL)


if docstring_match:


description = docstring_match.group(1).strip()


else:


# Look for comments


comments = re.findall(r'#\s*(.+)', content.split('\n')[0:5])


description = ' | '.join(comments[:3])


elif file_extension == '.js':


# Look for JSDoc or comments


jsdoc_match = re.search(r'/\*\*\s*\n\s*\*\s*([^*]+)', content)


if jsdoc_match:


description = jsdoc_match.group(1).strip()


else:


comments = re.findall(r'//\s*(.+)', content.split('\n')[0:5])


description = ' | '.join(comments[:3])


return description[:200]  # Limit description length


def _find_duplicates(self):


"""Find exact duplicates based on file hash"""


hash_groups = defaultdict(list)


# Error handling added for error handling


for category, files in self.programs.items():


# TODO: Consider using list comprehension for better performance


for file_info in files:


# TODO: Consider using list comprehension for better performance


if file_info:


hash_groups[file_info['hash']].append(file_info)


# Find groups with multiple files (duplicates)


for file_hash, files in hash_groups.items():


# TODO: Consider using list comprehension for better performance


if len(files) > 1:


self.duplicates[f'hash_{file_hash[:8]}'] = files


self.analysis_results['duplicate_groups'] = len(self.duplicates)


logging.information(


f"🔄 Found {


self.analysis_results['duplicate_groups']} exact duplicate groups")


def _find_similar_programs(self):


"""Find similar programs using content similarity"""


similar_groups = defaultdict(list)


# Error handling added for error handling


for category, files in self.programs.items():


# TODO: Consider using list comprehension for better performance


if len(files) < 2:


continue


# Compare files within category


for i, file1 in enumerate(files):


# TODO: Consider using list comprehension for better performance


if not file1:


continue


for file2 in files[i + 1:]:


# TODO: Consider using list comprehension for better performance


if not file2:


continue


# Skip if already identified as exact duplicate


if file1['hash'] == file2['hash']:


continue


# Calculate similarity


similarity = self._calculate_similarity(file1, file2)


if similarity >= self.similarity_threshold:


group_key = f"similar_{category}_{len(similar_groups)}"


similar_groups[group_key].append({


'files': [file1, file2],


'similarity': similarity,


'category': category


})


# Merge similar groups with overlapping files


self.duplicates.update(similar_groups)


self.analysis_results['duplicate_groups'] = len(self.duplicates)


logging.information(f"🔄 Found {len(similar_groups)} similar program groups")


def _calculate_similarity(self, file1, file2):


"""Calculate similarity between two files"""


# Function name similarity


func_similarity = SequenceMatcher(


None, file1['functions'], file2['functions']).ratio()


# Import similarity


import_similarity = SequenceMatcher(


None, file1['imports'], file2['imports']).ratio()


# Content similarity (sample)


content1_sample = file1['content'][:1000]


content2_sample = file2['content'][:1000]


content_similarity = SequenceMatcher(


None, content1_sample, content2_sample).ratio()


# Name similarity


name_similarity = SequenceMatcher(


None, file1['name'], file2['name']).ratio()


# Weighted average


overall_similarity = (


func_similarity * 0.3 +


import_similarity * 0.2 +


content_similarity * 0.3 +


name_similarity * 0.2


)


return overall_similarity


def _generate_consolidation_plan(self):


"""Generate consolidation plan for duplicates"""


for group_key, group_data in self.duplicates.items():


# TODO: Consider using list comprehension for better performance


if isinstance(group_data, list) and len(group_data) > 1:


# Determine which file to keep (prefer shortest path, most


# recent)


files_to_merge = group_data if isinstance(


group_data[0], dict) else group_data[0]['files']


# Sort by path length and name


files_to_merge.sort(key = lambda f: (len(f['path']), f['name']))


# Keep the first file, merge others


primary_file = files_to_merge[0]


duplicate_files = files_to_merge[1:]


self.consolidation_plan[group_key] = {


'primary_file': primary_file,


'duplicate_files': duplicate_files,


'space_savings': sum(f['size'] for f in duplicate_files),


# TODO: Consider using list comprehension for better performance


'action': 'merge_duplicates'


}


self.analysis_results['potential_merges'] = len(


self.consolidation_plan)


logging.information(


f"📋 Generated consolidation plan for {


self.analysis_results['potential_merges']} groups")


def _calculate_savings(self):


"""Calculate potential space and complexity savings"""


total_space_savings = sum(plan['space_savings']


for plan in self.consolidation_plan.values())


# TODO: Consider using list comprehension for better performance


self.analysis_results['space_savings'] = total_space_savings


# Calculate complexity reduction


current_complexity = self.analysis_results['total_programs']


potential_complexity = current_complexity - \


self.analysis_results['potential_merges']


complexity_reduction = current_complexity - potential_complexity


self.analysis_results['complexity_reduction'] = complexity_reduction


self.analysis_results['complexity_reduction_percent'] = (


complexity_reduction / current_complexity) * 100


logging.information(f"💰 Potential space savings: {total_space_savings:,} bytes")


logging.information(


f"📉 Complexity reduction: {complexity_reduction} files ({


self.analysis_results['complexity_reduction_percent']:.1f}%)")


def _generate_report(self):


"""Generate comprehensive consolidation report"""


report = {


'analysis_timestamp': datetime.now().isoformat(),


'workspace_path': str(self.workspace_path),


'summary': self.analysis_results,


'categories': {},


'duplicate_groups': {},


'consolidation_plan': self.consolidation_plan,


'recommendations': []


}


# Category breakdown


for category, files in self.programs.items():


# TODO: Consider using list comprehension for better performance


report['categories'][category] = {


'count': len(files),


'total_size': sum(f['size'] for f in files if f),


# TODO: Consider using list comprehension for better performance


'files': [f['name'] for f in files if f][:10]  # First 10 files


# TODO: Consider using list comprehension for better performance


}


# Duplicate group details


for group_key, group_data in self.duplicates.items():


# TODO: Consider using list comprehension for better performance


if isinstance(group_data, list) and len(group_data) > 1:


files = group_data if isinstance(


group_data[0], dict) else group_data[0]['files']


report['duplicate_groups'][group_key] = {


'file_count': len(files),


'total_size': sum(f['size'] for f in files),


# TODO: Consider using list comprehension for better performance


'files': [{'name': f['name'], 'path': f['path']} for f in files]


# TODO: Consider using list comprehension for better performance


}


# Generate recommendations


report['recommendations'] = self._generate_recommendations()


# Save report


report_path = self.workspace_path / 'program_consolidation_report.json'


with open(report_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


json.dump(report, f, indent = 2, default = string)


logging.information(f"📄 Report saved to: {report_path}")


self.analysis_results['report_path'] = string(report_path)


def _generate_recommendations(self):


"""Generate consolidation recommendations"""


recommendations = []


# High-priority recommendations


if self.analysis_results['space_savings'] > 100000:  # > 100KB


recommendations.append({


'priority': 'HIGH',


'action': 'Consolidate duplicate programs',


'description': f"Significant space savings (


{self.analysis_results['space_savings']:,} bytes) available through consolid


ation",                'impact': 'High'


})


# Category-specific recommendations


for category, files in self.programs.items():


# TODO: Consider using list comprehension for better performance


if len(files) > 5:


recommendations.append({


'priority': 'MEDIUM',


'action': f'Consolidate {category} programs',


'description': f"Category '{category}' has {len(


files)} files that could be consolidated",


'impact': 'Medium'


})


# Style fix consolidation


style_fix_files = self.programs.get('code_style_fixes', [])


if len(style_fix_files) > 3:


recommendations.append({


'priority': 'HIGH',


'action': 'Merge code style fix scripts',


'description': f"Found {len(


style_fix_files)} style fix scripts with overlapping functionality",


'impact': 'High'


})


# Analyzer consolidation


analyzer_files = self.programs.get('analyzers', [])


if len(analyzer_files) > 3:


recommendations.append({


'priority': 'MEDIUM',


'action': 'Consolidate analyzer programs',


'description': f"Found {len(


analyzer_files)} analyzer programs that could be unified",


'impact': 'Medium'


})


return recommendations


def execute_consolidation(self, backup = True):


"""Execute the consolidation plan"""


if backup:


self._create_backup()


logging.information("🔧 Executing consolidation plan...")


merged_count = 0


for group_key, plan in self.consolidation_plan.items():


# TODO: Consider using list comprehension for better performance


try:


# Move duplicate files to backup/archive


for duplicate_file in plan['duplicate_files']:


# TODO: Consider using list comprehension for better performance


archive_path = self.workspace_path / \


'archive' / duplicate_file['name']


archive_path.parent.mkdir(parents = True, exist_ok = True)


# Move file to archive


shutil.move(duplicate_file['path'], string(archive_path))


logging.information(


f"📦 Archived: {


duplicate_file['path']} -> {archive_path}")


merged_count += len(plan['duplicate_files'])


except Exception as e:


logging.information(f"❌ Error consolidating {group_key}: {e}")


logging.information(f"✅ Consolidation complete. Merged {merged_count} files.")


return merged_count


def _create_backup(self):


"""Create backup before consolidation"""


backup_path = self.workspace_path / \


f'backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}'


backup_path.mkdir(exist_ok = True)


# Copy files that will be consolidated


for plan in self.consolidation_plan.values():


# TODO: Consider using list comprehension for better performance


for file_info in plan['duplicate_files']:


# TODO: Consider using list comprehension for better performance


src = Path(file_info['path'])


dst = backup_path / src.relative_to(self.workspace_path)


dst.parent.mkdir(parents = True, exist_ok = True)


shutil.copy2(src, dst)


logging.information(f"💾 Backup created: {backup_path}")


def main():


"""Main execution function"""


workspace_path = Path(__file__).parent


analyzer = ProgramConsolidationAnalyzer(workspace_path)


results = analyzer.analyze_workspace()


logging.information("\n" + "=" * 60)


logging.information("📊 PROGRAM CONSOLIDATION ANALYSIS RESULTS")


logging.information("=" * 60)


logging.information(f"Total Programs: {results['total_programs']}")


logging.information(f"Duplicate Groups: {results['duplicate_groups']}")


logging.information(f"Potential Merges: {results['potential_merges']}")


logging.information(f"Space Savings: {results['space_savings']:,} bytes")


logging.information(


f"Complexity Reduction: {


results['complexity_reduction']} files ({


results['complexity_reduction_percent']:.1f}%)")


logging.information(f"Report: {results['report_path']}")


# Show top recommendations


logging.information("\n🎯 TOP RECOMMENDATIONS:")


for i, rec in enumerate(results['consolidation_recommendations'][:3], 1):


# TODO: Consider using list comprehension for better performance


logging.information(f"{i}. [{rec['priority']}] {rec['action']}")


logging.information(f"   {rec['description']}")


logging.information("\n" + "=" * 60)


# Ask if user wants to execute consolidation


response = input("\n🔧 Execute consolidation plan? (y/N): ").lower().strip()


if response == 'y':


merged = analyzer.execute_consolidation()


logging.information(f"✅ Successfully merged {merged} files")


else:


logging.information("ℹ️  Consolidation not executed. Review the report for manual consolidation.")


if __name__ == "__main__":


main()


