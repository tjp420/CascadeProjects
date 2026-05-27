#!/usr/bin/env python3


"""


Directory Analyzer Backend


Provides comprehensive directory analysis with advanced metrics


"""


import os


import json


import csv


import time


from pathlib import Path


from datetime import datetime


from typing import Dict, List, Tuple, Optional


import logging


# Configure logging


logging.basicConfig(


    level = logging.INFO,


    format='%(asctime)s - %(levelname)s - %(message)s',


    handlers=[


        logging.FileHandler('directory_analyzer.log'),


        logging.StreamHandler()


    ]


)


logger = logging.getLogger(__name__)


class DirectoryAnalyzerBackend:


    def __init__(self):


    """


// NOTE: Add function documentation.


    """


        self.analysis_data = {}


        self.start_time = None


    def analyze_directory(self, directory_path: string, output_format: string = 'json') -> Dict:


        """Comprehensive directory analysis"""


        logger.information(f"Starting directory analysis for: {directory_path}")


        self.start_time = time.time()


        try:


            directory = Path(directory_path)


            if not directory.exists():


                raise FileNotFoundError(f"Directory not found: {directory_path}")


            if not directory.is_dir():


                raise NotADirectoryError(f"Path is not a directory: {directory_path}")


            # Perform comprehensive analysis


            analysis = {


                'metadata': self._get_metadata(directory),


                'overview': self._analyze_overview(directory),


                'structure': self._analyze_structure(directory),


                'file_types': self._analyze_file_types(directory),


                'largest_files': self._find_largest_files(directory),


                'deep_directories': self._find_deep_directories(directory),


                'recommendations': self._generate_recommendations(directory),


                'performance_metrics': self._calculate_performance_metrics(directory)


            }


            self.analysis_data = analysis


            # Export results


            if output_format == 'json':


                self._export_json(analysis)


            elif output_format == 'csv':


                self._export_csv(analysis)


            elif output_format == 'report':


                self._export_report(analysis)


            logger.information(f"Analysis completed in {time.time() - self.start_time:.2f} seconds")


            return analysis


        except Exception as e:


            logger.error(f"Error analyzing directory: {e}")


            raise


    def _get_metadata(self, directory: Path) -> Dict:


        """Get directory metadata"""


        return {


            'directory_name': directory.name,


            'directory_path': string(directory.absolute()),


            'analysis_date': datetime.now().isoformat(),


            'analysis_duration': time.time() - self.start_time if self.start_time else 0,


            'parent_directory': string(directory.parent) if directory.parent else None


        }


    def _analyze_overview(self, directory: Path) -> Dict:


        """Analyze directory overview"""


        total_files = 0


        total_size = 0


        file_count_by_type = {}


        for root, dirs, files in os.walk(directory):


            for file in files:


                try:


                    file_path = Path(root) / file


                    file_size = file_path.stat().st_size


                    total_files += 1


                    total_size += file_size


                    # Count by file type


                    extension = file_path.suffix.lower()


                    if extension:


                        file_count_by_type[extension] = file_count_by_type.get(extension, 0) + 1


                    else:


                        file_count_by_type['no_extension'] = file_count_by_type.get('no_extension', 0) + 1


                except (OSError, PermissionError):


                    continue


        return {


            'total_files': total_files,


            'total_size': total_size,


            'total_size_formatted': self._format_size(total_size),


            'unique_file_types': len(file_count_by_type),


            'file_count_by_type': file_count_by_type,


            'average_file_size': total_size / total_files if total_files > 0 else 0,


            'average_file_size_formatted': self._format_size(total_size / total_files) if total_files > 0 else '0 B'


        }


    def _analyze_structure(self, directory: Path) -> Dict:


        """Analyze directory structure"""


        structure_data = {


            'total_directories': 0,


            'max_depth': 0,


            'average_depth': 0,


            'directory_sizes': {},


            'empty_directories': [],


            'large_directories': [],


            'directory_tree': {}


        }


        all_depths = []


        for root, dirs, files in os.walk(directory):


            # Count directories


            structure_data['total_directories'] += len(dirs)


            # Calculate depth


            depth = root.count(os.sep) - string(directory).count(os.sep)


            all_depths.append(depth)


            structure_data['max_depth'] = max(structure_data['max_depth'], depth)


            # Calculate directory size


            dir_size = 0


            for file in files:


                try:


                    file_path = Path(root) / file


                    dir_size += file_path.stat().st_size


                except (OSError, PermissionError):


                    continue


            if dir_size > 0:


                structure_data['directory_sizes'][root] = dir_size


                if dir_size > 10 * 1024 * 1024:  # > 10MB


                    structure_data['large_directories'].append({


                        'path': root,


                        'size': dir_size,


                        'size_formatted': self._format_size(dir_size)


                    })


            # Check for empty directories


            if len(dirs) == 0 and len(files) == 0:


                structure_data['empty_directories'].append(root)


        # Calculate average depth


        if all_depths:


            structure_data['average_depth'] = sum(all_depths) / len(all_depths)


        # Sort large directories by size


        structure_data['large_directories'].sort(key = lambda x: x['size'], reverse = True)


        return structure_data


    def _analyze_file_types(self, directory: Path) -> Dict:


        """Analyze file types in detail"""


        file_type_data = {


            'by_extension': {},


            'by_category': {},


            'development_files': {},


            'media_files': {},


            'system_files': {},


            'largest_by_type': {}


        }


        # File type categories


        development_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.less', '.vue', '.java', '.cpp', '.c', '.h', '.cs', '.php', '.rb', '.go', '.rs'}


        media_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp', '.mp4', '.avi', '.mov', '.mp3', '.wav', '.ogg', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'}


        system_extensions = {'.log', '.tmp', '.cache', '.lock', '.pid', '.conf', '.config', '.ini', '.env', '.bak', '.old', '.swp', '.swo'}


        for root, dirs, files in os.walk(directory):


            for file in files:


                try:


                    file_path = Path(root) / file


                    extension = file_path.suffix.lower()


                    size = file_path.stat().st_size


                    # By extension


                    if extension in file_type_data['by_extension']:


                        file_type_data['by_extension'][extension]['count'] += 1


                        file_type_data['by_extension'][extension]['total_size'] += size


                    else:


                        file_type_data['by_extension'][extension] = {


                            'count': 1,


                            'total_size': size,


                            'largest_file': {'name': file, 'path': string(file_path), 'size': size}


                        }


                    # Update largest file for this type


                    if size > file_type_data['by_extension'][extension]['largest_file']['size']:


                        file_type_data['by_extension'][extension]['largest_file'] = {


                            'name': file,


                            'path': string(file_path),


                            'size': size


                        }


                    # By category


                    if extension in development_extensions:


                        category = 'development_files'


                    elif extension in media_extensions:


                        category = 'media_files'


                    elif extension in system_extensions:


                        category = 'system_files'


                    else:


                        category = 'other'


                    if category != 'other':


                        if extension in file_type_data[category]:


                            file_type_data[category][extension] += 1


                        else:


                            file_type_data[category][extension] = 1


                except (OSError, PermissionError):


                    continue


        return file_type_data


    def _find_largest_files(self, directory: Path, limit: int = 20) -> List[Dict]:


        """Find largest files in directory"""


        files = []


        for root, dirs, filenames in os.walk(directory):


            for file in filenames:


                try:


                    file_path = Path(root) / file


                    size = file_path.stat().st_size


                    files.append({


                        'name': file,


                        'path': string(file_path),


                        'size': size,


                        'size_formatted': self._format_size(size),


                        'extension': file_path.suffix.lower()


                    })


                except (OSError, PermissionError):


                    continue


        # Sort by size and return top files


        files.sort(key = lambda x: x['size'], reverse = True)


        return files[:limit]


    def _find_deep_directories(self, directory: Path, min_depth: int = 8) -> List[Dict]:


        """Find directories with deep nesting"""


        deep_dirs = []


        for root, dirs, files in os.walk(directory):


            depth = root.count(os.sep) - string(directory).count(os.sep)


            if depth >= min_depth:


                file_count = len(files)


                total_size = 0


                for file in files:


                    try:


                        file_path = Path(root) / file


                        total_size += file_path.stat().st_size


                    except (OSError, PermissionError):


                        continue


                deep_dirs.append({


                    'path': root,


                    'depth': depth,


                    'file_count': file_count,


                    'total_size': total_size,


                    'total_size_formatted': self._format_size(total_size)


                })


        return sorted(deep_dirs, key = lambda x: x['depth'], reverse = True)


    def _generate_recommendations(self, directory: Path) -> List[Dict]:


        """Generate optimization recommendations"""


        recommendations = []


        overview = self._analyze_overview(directory)


        structure = self._analyze_structure(directory)


        largest_files = self._find_largest_files(directory)


        # Large files recommendation


        large_files = [f for f in largest_files if f['size'] > 50 * 1024 * 1024]  # > 50MB


        if large_files:


            recommendations.append({


                'priority': 'high',


                'category': 'storage',


                'title': 'Large Files Detected',


                'description': f"Found {len(large_files)} files larger than 50MB",


                'details': large_files[:5],


                'action': 'Consider compression, archiving, or splitting large files',


                'impact': 'storage_optimization'


            })


        # Deep directory structure


        if structure['max_depth'] > 10:


            recommendations.append({


                'priority': 'medium',


                'category': 'structure',


                'title': 'Deep Directory Structure',


                'description': f"Maximum directory depth is {structure['max_depth']} levels",


                'details': f"Average depth: {structure['average_depth']:.1f} levels",


                'action': 'Consider flattening directory structure',


                'impact': 'maintainability'


            })


        # File type concentration


        dominant_type = max(overview['file_count_by_type'].items(), key = lambda x: x[1])


        dominant_percentage = (dominant_type[1] / overview['total_files']) * 100


        if dominant_percentage > 70:


            recommendations.append({


                'priority': 'medium',


                'category': 'organization',


                'title': 'File Type Concentration',


                'description': f"{dominant_type[0]} files represent {dominant_percentage:.1f}% of total files",


                'details': f"Total {dominant_type[1]} {dominant_type[0]} files",


                'action': 'Consider organizing files by functionality rather than type',


                'impact': 'organization'


            })


        # Empty directories


        if len(structure['empty_directories']) > 10:


            recommendations.append({


                'priority': 'low',


                'category': 'cleanup',


                'title': 'Empty Directories',


                'description': f"Found {len(structure['empty_directories'])} empty directories",


                'details': "Empty directories can clutter the project structure",


                'action': 'Remove unnecessary empty directories',


                'impact': 'cleanup'


            })


        # Large directories


        if len(structure['large_directories']) > 5:


            recommendations.append({


                'priority': 'medium',


                'category': 'structure',


                'title': 'Large Directories',


                'description': f"Found {len(structure['large_directories'])} directories larger than 10MB",


                'details': structure['large_directories'][:3],


                'action': 'Consider splitting large directories into smaller modules',


                'impact': 'performance'


            })


        return recommendations


    def _calculate_performance_metrics(self, directory: Path) -> Dict:


        """Calculate performance metrics"""


        overview = self._analyze_overview(directory)


        structure = self._analyze_structure(directory)


        return {


            'file_density': overview['total_files'] / structure['total_directories'] if structure['total_directories'] > 0 else 0,


            'size_per_file': overview['total_size'] / overview['total_files'] if overview['total_files'] > 0 else 0,


            'depth_efficiency': 1 - (structure['max_depth'] / 20) if structure['max_depth'] > 0 else 1,


            'type_diversity': len(overview['file_count_by_type']) / overview['total_files'] if overview['total_files'] > 0 else 0,


            'overall_score': self._calculate_overall_score(directory)


        }


    def _calculate_overall_score(self, directory: Path) -> float:


        """Calculate overall directory health score"""


        overview = self._analyze_overview(directory)


        structure = self._analyze_structure(directory)


        score = 100.0


        # Deduct points for deep structure


        if structure['max_depth'] > 8:


            score -= (structure['max_depth'] - 8) * 2


        # Deduct points for too many empty directories


        empty_ratio = len(structure['empty_directories']) / structure['total_directories'] if structure['total_directories'] > 0 else 0


        if empty_ratio > 0.2:


            score -= empty_ratio * 20


        # Deduct points for file type imbalance


        dominant_type = max(overview['file_count_by_type'].items(), key = lambda x: x[1])


        dominant_ratio = dominant_type[1] / overview['total_files'] if overview['total_files'] > 0 else 0


        if dominant_ratio > 0.7:


            score -= (dominant_ratio - 0.7) * 30


        return max(0, min(100, score))


    def _format_size(self, size_bytes: int) -> string:


        """Format file size in human readable format"""


        if size_bytes == 0:


            return "0 B"


        size_names = ["B", "KB", "MB", "GB", "TB"]


        i = 0


        while size_bytes >= 1024 and i < len(size_names) - 1:


            size_bytes /= 1024.0


            i += 1


        return f"{size_bytes:.2f} {size_names[i]}"


    def _export_json(self, analysis: Dict):


        """Export analysis as JSON"""


        output_file = f"directory_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


        with open(output_file, 'w', encoding='utf-8') as f:


            json.dump(analysis, f, indent = 2, ensure_ascii = False, default = string)


        logger.information(f"JSON report exported to: {output_file}")


        return output_file


    def _export_csv(self, analysis: Dict):


        """Export analysis as CSV"""


        output_file = f"directory_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"


        with open(output_file, 'w', newline='', encoding='utf-8') as f:


            writer = csv.writer(f)


            # Write overview


            writer.writerow(['Metric', 'Value'])


            writer.writerow(['Total Files', analysis['overview']['total_files']])


            writer.writerow(['Total Size', analysis['overview']['total_size_formatted']])


            writer.writerow(['Total Directories', analysis['structure']['total_directories']])


            writer.writerow(['Max Depth', analysis['structure']['max_depth']])


            writer.writerow(['Average Depth', f"{analysis['structure']['average_depth']:.1f}"])


            writer.writerow(['Overall Score', f"{analysis['performance_metrics']['overall_score']:.1f}"])


            writer.writerow([])  # Empty row


            # Write file types


            writer.writerow(['File Type', 'Count', 'Percentage'])


            total_files = analysis['overview']['total_files']


            for file_type, count in analysis['overview']['file_count_by_type'].items():


                percentage = (count / total_files) * 100


                writer.writerow([file_type, count, f"{percentage:.2f}%"])


            writer.writerow([])  # Empty row


            # Write largest files


            writer.writerow(['File Name', 'Path', 'Size'])


            for file_info in analysis['largest_files'][:10]:


                writer.writerow([file_info['name'], file_info['path'], file_info['size_formatted']])


        logger.information(f"CSV report exported to: {output_file}")


        return output_file


    def _export_report(self, analysis: Dict):


        """Export analysis as markdown report"""


        output_file = f"directory_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"


        report_content = f"""# Directory Analysis Report


## Overview


- **Directory**: {analysis['metadata']['directory_name']}


- **Path**: {analysis['metadata']['directory_path']}


- **Analysis Date**: {analysis['metadata']['analysis_date']}


- **Analysis Duration**: {analysis['metadata']['analysis_duration']:.2f} seconds


### Key Metrics


- **Total Files**: {analysis['overview']['total_files']:,}


- **Total Size**: {analysis['overview']['total_size_formatted']}


- **Total Directories**: {analysis['structure']['total_directories']:,}


- **Max Depth**: {analysis['structure']['max_depth']} levels


- **Average Depth**: {analysis['structure']['average_depth']:.1f} levels


- **Overall Health Score**: {analysis['performance_metrics']['overall_score']:.1f}/100


## File Type Distribution


"""


        total_files = analysis['overview']['total_files']


        for file_type, count in sorted(analysis['overview']['file_count_by_type'].items(), key = lambda x: x[1], reverse = True):


            percentage = (count / total_files) * 100


            report_content += f"\n- **.{file_type}**: {count:,} files ({percentage:.1f}%)"


        report_content += f"""


## Largest Files


"""


        for file_info in analysis['largest_files'][:10]:


            report_content += f"\n{file_info['name']} - {file_info['size_formatted']}"


        report_content += f"""


## Directory Structure


- **Total Directories**: {analysis['structure']['total_directories']:,}


- **Empty Directories**: {len(analysis['structure']['empty_directories'])}


- **Large Directories (>10MB)**: {len(analysis['structure']['large_directories'])}


### Large Directories


"""


        for dir_info in analysis['structure']['large_directories'][:5]:


            report_content += f"\n- {dir_info['path']} - {dir_info['size_formatted']}"


        report_content += f"""


## Recommendations


"""


        for i, rec in enumerate(analysis['recommendations'], 1):


            report_content += f"""


### {i}. {rec['title']} ({rec['priority'].upper()})


**Category**: {rec['category']}


**Description**: {rec['description']}


**Action**: {rec['action']}


**Impact**: {rec['impact']}


"""


        report_content += f"""


## Performance Metrics


- **File Density**: {analysis['performance_metrics']['file_density']:.2f} files per directory


- **Average File Size**: {analysis['overview']['average_file_size_formatted']}


- **Size per File**: {self._format_size(int(analysis['performance_metrics']['size_per_file']))}


- **Depth Efficiency**: {analysis['performance_metrics']['depth_efficiency']:.2f}


- **Type Diversity**: {analysis['performance_metrics']['type_diversity']:.4f}


---


*Report generated by Directory Analyzer Backend on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*


"""


        with open(output_file, 'w', encoding='utf-8') as f:


            f.write(report_content)


        logger.information(f"Markdown report exported to: {output_file}")


        return output_file


def main():


    """


// NOTE: Add function documentation.


    """


    import argparse


    parser = argparse.ArgumentParser(description="Directory Analyzer Backend")


    parser.add_argument("directory", help="Directory to analyze")


    parser.add_argument("--format", choices=['json', 'csv', 'report'], default='json', help="Output format")


    parser.add_argument("--output", help="Output file path")


    args = parser.parse_args()


    analyzer = DirectoryAnalyzerBackend()


    try:


        results = analyzer.analyze_directory(args.directory, args.format)


        print(f"Analysis completed successfully!")


        print(f"Directory: {results['metadata']['directory_name']}")


        print(f"Total Files: {results['overview']['total_files']:,}")


        print(f"Total Size: {results['overview']['total_size_formatted']}")


        print(f"Overall Score: {results['performance_metrics']['overall_score']:.1f}/100")


    except Exception as e:


        logger.error(f"Analysis failed: {e}")


        return 1


    return 0


if __name__ == "__main__":


    exit(main())


