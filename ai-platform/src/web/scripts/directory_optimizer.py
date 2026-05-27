#!/usr/bin/env python3


"""


Directory Structure Optimization Utility


Analyzes and optimizes directory structure to manage complexity


"""


import os


// NOTE: Consider using dependency injection for this import


import shutil


// NOTE: Consider using dependency injection for this import


from pathlib import Path


from datetime import datetime


from typing import Dict, List, Tuple, Optional


import logging


// NOTE: Consider using dependency injection for this import


# Configure logging


logging.basicConfig(


    level = logging.INFO,


    format='%(asctime)s - %(levelname)s - %(message)s',


    handlers=[


        logging.FileHandler('directory_optimization.log'),


        logging.StreamHandler()


    ]


)


logger = logging.getLogger(__name__)


class DirectoryOptimizer:


    def __init__(self, target_directory: string):


    """


// NOTE: Add function documentation.


    """


// NOTE: Consider extracting this 59-line function into smaller methods


        self.target_dir = Path(target_directory)


        self.analysis = {}


        self.optimization_plan = {}


        self.changes_made = []


    def analyze_directory_structure(self) -> Dict:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Analyze current directory structure"""


        logger.information(f"Analyzing directory structure for: {self.target_dir}")


        analysis = {


            'timestamp': datetime.now().isoformat(),


            'total_directories': 0,


            'total_files': 0,


            'max_depth': 0,


            'avg_depth': 0,


            'deep_directories': [],


            'empty_directories': [],


            'large_directories': [],


            'duplicate_structures': [],


            'complexity_metrics': {},


            'recommendations': []


        }


        # Collect directory data_item


        dir_data = []


        total_files = 0


        for dir_path in self.target_dir.rglob('*'):


            if dir_path.is_dir():


                # Calculate depth


                depth = len(dir_path.relative_to(self.target_dir).parts)


                # Calculate directory stats


                file_count = 0


                total_size = 0


                subdirs = 0


                for item in dir_path.iterdir():


                    if item.is_file():


                        file_count += 1


                        total_files += 1


                        try:


                            total_size += item.stat().st_size


                        except:


                            pass


                    elif item.is_dir():


                        subdirs += 1


                dir_info = {


                    'path': string(dir_path),


                    'depth': depth,


                    'file_count': file_count,


                    'subdir_count': subdirs,


                    'total_size': total_size,


                    'parent': string(dir_path.parent)


                }


                dir_data.append(dir_info)


        analysis['total_files'] = total_files


        analysis['total_directories'] = len(dir_data)


        if dir_data:


            # Calculate depth metrics


            depths = [d['depth'] for d in dir_data]


            analysis['max_depth'] = max(depths)


            analysis['avg_depth'] = sum(depths) / len(depths)


            # Find problematic directories


            analysis['deep_directories'] = [


                d for d in dir_data if d['depth'] > 8


            ]


            analysis['empty_directories'] = [


                d for d in dir_data if d['file_count'] == 0 and d['subdir_count'] == 0


            ]


            analysis['large_directories'] = [


                d for d in dir_data if d['file_count'] > 100 or d['subdir_count'] > 20


            ]


            # Calculate complexity metrics


            analysis['complexity_metrics'] = self._calculate_complexity_metrics(dir_data)


            # Find duplicate structures


            analysis['duplicate_structures'] = self._find_duplicate_structures(dir_data)


            # Generate recommendations


            analysis['recommendations'] = self._generate_structure_recommendations(analysis)


        self.analysis = analysis


        return analysis


    def _calculate_complexity_metrics(self, dir_data: List[Dict]) -> Dict:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Calculate directory structure complexity metrics"""


        metrics = {


            'complexity_score': 0,


            'branching_factor': 0,


            'depth_variance': 0,


            'size_variance': 0,


            'organization_score': 0


        }


        if not dir_data:


            return metrics


        # Calculate branching factor (avg subdirectories per directory)


        total_subdirs = sum(d['subdir_count'] for d in dir_data)


        non_empty_dirs = [d for d in dir_data if d['subdir_count'] > 0]


        if non_empty_dirs:


            metrics['branching_factor'] = total_subdirs / len(non_empty_dirs)


        # Calculate depth variance


        depths = [d['depth'] for d in dir_data]


        avg_depth = sum(depths) / len(depths)


        metrics['depth_variance'] = sum((d - avg_depth) ** 2 for d in depths) / len(depths)


        # Calculate size variance


        file_counts = [d['file_count'] for d in dir_data]


        avg_files = sum(file_counts) / len(file_counts)


        metrics['size_variance'] = sum((f - avg_files) ** 2 for f in file_counts) / len(file_counts)


        # Calculate overall complexity score (0-100, higher is more complex)


        complexity_score = 0


        complexity_score += min(50, metrics['branching_factor'] * 10)  # Branching


        complexity_score += min(30, metrics['depth_variance'] / 100)     # Depth variance


        complexity_score += min(20, metrics['size_variance'] / 1000)      # Size variance


        metrics['complexity_score'] = min(100, complexity_score)


        # Calculate organization score (0-100, higher is better organized)


        org_score = 100


        max_depth = max(d['depth'] for d in dir_data) if dir_data else 0


        empty_dirs = [d for d in dir_data if d['file_count'] == 0 and d['subdir_count'] == 0]


        deep_dirs = [d for d in dir_data if d['depth'] > 8]


        duplicate_structures = self._find_duplicate_structures(dir_data)


        org_score -= min(30, max_depth * 3)  # Penalize deep structures


        org_score -= min(20, len(empty_dirs) * 2)  # Penalize empty dirs


        org_score -= min(20, len(deep_dirs) * 3)    # Penalize deep dirs


        org_score -= min(30, len(duplicate_structures) * 5)  # Penalize duplicates


        metrics['organization_score'] = max(0, org_score)


        return metrics


    def _find_duplicate_structures(self, dir_data: List[Dict]) -> List[Dict]:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Find duplicate directory structures"""


        duplicates = []


        # Group directories by structure patterns


        structure_patterns = {}


        for dir_info in dir_data:


            # Create structure signature based on file/subdir counts


            signature = f"files:{dir_info['file_count']}_subdirs:{dir_info['subdir_count']}"


            if signature not in structure_patterns:


                structure_patterns[signature] = []


            structure_patterns[signature].append(dir_info)


        # Find patterns with multiple occurrences


        for signature, dirs in structure_patterns.items():


            if len(dirs) > 2:  # More than 2 directories with same pattern


                duplicates.append({


                    'pattern': signature,


                    'count': len(dirs),


                    'directories': [d['path'] for d in dirs[:5]]  # Show first 5


                })


        return duplicates


    def _generate_structure_recommendations(self, analysis: Dict) -> List[Dict]:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Generate directory structure optimization recommendations"""


        recommendations = []


        # Deep directories recommendation


        if analysis['max_depth'] > 10:


            recommendations.append({


                'priority': 'high',


                'category': 'depth',


                'title': 'Reduce Directory Depth',


                'description': f'Maximum depth of {analysis["max_depth"]} levels is too complex',


                'actions': [


                    'Flatten directory structure to <8 levels',


                    'Consolidate related directories',


                    'Use logical grouping principles'


                ],


                'impact': 'Improved maintainability and navigation'


            })


        # Empty directories recommendation


        if len(analysis['empty_directories']) > 10:


            recommendations.append({


                'priority': 'medium',


                'category': 'cleanup',


                'title': 'Remove Empty Directories',


                'description': f'Found {len(analysis["empty_directories"])} empty directories',


                'actions': [


                    'Remove truly empty directories',


                    'Add placeholder files or README if needed',


                    'Consolidate related empty directories'


                ],


                'impact': 'Cleaner structure and reduced confusion'


            })


        # Large directories recommendation


        if len(analysis['large_directories']) > 5:


            recommendations.append({


                'priority': 'medium',


                'category': 'organization',


                'title': 'Reorganize Large Directories',


                'description': f'Found {len(analysis["large_directories"])} directories with many items',


                'actions': [


                    'Split large directories into logical subdirectories',


                    'Use categorization by function or type',


                    'Implement consistent naming conventions'


                ],


                'impact': 'Better organization and easier file management'


            })


        # Duplicate structures recommendation


        if len(analysis['duplicate_structures']) > 3:


            recommendations.append({


                'priority': 'low',


                'category': 'consolidation',


                'title': 'Consolidate Duplicate Structures',


                'description': f'Found {len(analysis["duplicate_structures"])} duplicate structure patterns',


                'actions': [


                    'Merge similar directories',


                    'Create shared parent directories',


                    'Standardize directory patterns'


                ],


                'impact': 'Reduced complexity and better consistency'


            })


        # Organization score recommendation


        org_score = analysis['complexity_metrics']['organization_score']


        if org_score < 50:


            recommendations.append({


                'priority': 'high',


                'category': 'restructuring',


                'title': 'Improve Organization Score',


                'description': f'Current organization score: {org_score:.1f}/100',


                'actions': [


                    'Implement consistent directory naming',


                    'Create logical grouping hierarchy',


                    'Add documentation for directory purposes'


                ],


                'impact': 'Significantly improved maintainability'


            })


        return recommendations


    def create_optimization_plan(self) -> Dict:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Create comprehensive optimization plan"""


        plan = {


            'created_at': datetime.now().isoformat(),


            'target_directory': string(self.target_dir),


            'current_analysis': self.analysis,


            'optimization_phases': self._create_optimization_phases(),


            'estimated_impact': self._estimate_optimization_impact(),


            'risk_assessment': self._assess_risks(),


            'success_criteria': self._define_success_criteria()


        }


        self.optimization_plan = plan


        return plan


    def _create_optimization_phases(self) -> List[Dict]:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Create phased optimization plan"""


        phases = []


        # Phase 1: Assessment and Quick Wins


        phases.append({


            'phase': 1,


            'name': 'Assessment & Quick Wins',


            'duration_days': 7,


            'tasks': [


                'Complete directory structure analysis',


                'Remove empty directories',


                'Fix obvious naming inconsistencies',


                'Add directory documentation'


            ],


            'expected_outcome': 'Cleaner structure with minimal risk',


            'risk_level': 'low'


        })


        # Phase 2: Structure Reorganization


        phases.append({


            'phase': 2,


            'name': 'Structure Reorganization',


            'duration_days': 14,


            'tasks': [


                'Flatten deep directory structures',


                'Consolidate similar directories',


                'Reorganize large directories',


                'Update internal references'


            ],


            'expected_outcome': 'Improved organization and navigation',


            'risk_level': 'medium'


        })


        # Phase 3: Standardization


        phases.append({


            'phase': 3,


            'name': 'Standardization & Documentation',


            'duration_days': 7,


            'tasks': [


                'Implement consistent naming conventions',


                'Create directory structure documentation',


                'Set up maintenance procedures',


                'Train team on new structure'


            ],


            'expected_outcome': 'Consistent and maintainable structure',


            'risk_level': 'low'


        })


        return phases


    def _estimate_optimization_impact(self) -> Dict:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Estimate the impact of optimization"""


        current = self.analysis


        impact = {


            'complexity_reduction': 0,


            'maintainability_improvement': 0,


            'navigation_speed_improvement': 0,


            'storage_efficiency': 0


        }


        # Estimate complexity reduction


        current_complexity = current['complexity_metrics']['complexity_score']


        if current_complexity > 60:


            impact['complexity_reduction'] = min(40, current_complexity - 40)


        # Estimate maintainability improvement


        current_org_score = current['complexity_metrics']['organization_score']


        if current_org_score < 60:


            impact['maintainability_improvement'] = min(50, 80 - current_org_score)


        # Estimate navigation speed improvement


        if current['max_depth'] > 8:


            depth_reduction = min(current['max_depth'] - 8, 5)


            impact['navigation_speed_improvement'] = depth_reduction * 10  # 10% per level reduced


        # Estimate storage efficiency (from removing empty dirs)


        empty_dirs = len(current['empty_directories'])


        if empty_dirs > 0:


            impact['storage_efficiency'] = min(10, empty_dirs * 0.5)  # 0.5% per empty dir removed


        return impact


    def _assess_risks(self) -> Dict:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Assess risks associated with optimization"""


        risks = {


            'breaking_changes': 'medium',


            'reference_updates': 'medium',


            'team_adoption': 'low',


            'rollback_complexity': 'low',


            'mitigation_strategies': []


        }


        # Add specific mitigation strategies


        strategies = [


            'Create backup before making changes',


            'Update references systematically',


            'Provide clear documentation',


            'Implement changes incrementally',


            'Test thoroughly after each phase'


        ]


        risks['mitigation_strategies'] = strategies


        return risks


    def _define_success_criteria(self) -> List[Dict]:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Define success criteria for optimization"""


        criteria = [


            {


                'metric': 'Directory Depth',


                'target': 'Maximum depth < 8 levels',


                'measurement': 'Directory structure analysis',


                'timeline': 'End of Phase 2'


            },


            {


                'metric': 'Organization Score',


                'target': 'Score > 70/100',


                'measurement': 'Complexity metrics analysis',


                'timeline': 'End of Phase 3'


            },


            {


                'metric': 'Empty Directories',


                'target': '< 5 empty directories',


                'measurement': 'Directory scan',


                'timeline': 'End of Phase 1'


            },


            {


                'metric': 'Team Satisfaction',


                'target': '> 80% positive feedback',


                'measurement': 'Team survey',


                'timeline': 'End of Phase 3'


            }


        ]


        return criteria


    def generate_optimization_report(self) -> string:


// NOTE: Consider extracting this 59-line function into smaller methods


        """Generate comprehensive optimization report"""


        report = []


        report.append("=" * 80)


        report.append("DIRECTORY STRUCTURE OPTIMIZATION REPORT")


        report.append("=" * 80)


        report.append(f"Target Directory: {self.target_dir}")


        report.append(f"Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


        report.append("")


        # Current Structure Overview


        current = self.analysis


        report.append("CURRENT STRUCTURE OVERVIEW")


        report.append("-" * 40)


        report.append(f"Total Directories: {current['total_directories']:,}")


        report.append(f"Total Files: {current['total_files']:,}")


        report.append(f"Maximum Depth: {current['max_depth']} levels")


        report.append(f"Average Depth: {current['avg_depth']:.1f} levels")


        report.append("")


        # Complexity Metrics


        metrics = current['complexity_metrics']


        report.append("COMPLEXITY METRICS")


        report.append("-" * 40)


        report.append(f"Complexity Score: {metrics['complexity_score']:.1f}/100")


        report.append(f"Organization Score: {metrics['organization_score']:.1f}/100")


        report.append(f"Branching Factor: {metrics['branching_factor']:.2f}")


        report.append("")


        # Issues Found


        report.append("ISSUES IDENTIFIED")


        report.append("-" * 40)


        report.append(f"Deep Directories (>8 levels): {len(current['deep_directories'])}")


        report.append(f"Empty Directories: {len(current['empty_directories'])}")


        report.append(f"Large Directories: {len(current['large_directories'])}")


        report.append(f"Duplicate Structures: {len(current['duplicate_structures'])}")


        report.append("")


        # Top Issues


        if current['deep_directories']:


            report.append("DEEPEST DIRECTORIES")


            report.append("-" * 40)


            deepest = sorted(current['deep_directories'], key = lambda x: x['depth'], reverse = True)[:5]


            for dir_info in deepest:


                rel_path = Path(dir_info['path']).relative_to(self.target_dir)


                report.append(f"  {rel_path}: {dir_info['depth']} levels")


            report.append("")


        if current['large_directories']:


            report.append("LARGEST DIRECTORIES")


            report.append("-" * 40)


            largest = sorted(current['large_directories'], key = lambda x: x['file_count'], reverse = True)[:5]


            for dir_info in largest:


                rel_path = Path(dir_info['path']).relative_to(self.target_dir)


                report.append(f"  {rel_path}: {dir_info['file_count']} files, {dir_info['subdir_count']} subdirs")


            report.append("")


        # Recommendations


        report.append("OPTIMIZATION RECOMMENDATIONS")


        report.append("-" * 40)


        for i, rec in enumerate(current['recommendations'], 1):


            report.append(f"{i}. [{rec['priority'].upper()}] {rec['title']}")


            report.append(f"   {rec['description']}")


            report.append(f"   Impact: {rec['impact']}")


            report.append("")


        # Optimization Plan


        plan = self.create_optimization_plan()


        report.append("OPTIMIZATION PLAN")


        report.append("-" * 40)


        report.append(f"Phases: {len(plan['optimization_phases'])}")


        report.append(f"Total Duration: {sum(p['duration_days'] for p in plan['optimization_phases'])} days")


        report.append("")


        for phase in plan['optimization_phases']:


            report.append(f"Phase {phase['phase']}: {phase['name']}")


            report.append(f"  Duration: {phase['duration_days']} days")


            report.append(f"  Risk Level: {phase['risk_level']}")


            report.append(f"  Expected: {phase['expected_outcome']}")


            report.append("")


        # Expected Impact


        impact = plan['estimated_impact']


        report.append("EXPECTED IMPACT")


        report.append("-" * 40)


        report.append(f"Complexity Reduction: {impact['complexity_reduction']:.1f}%")


        report.append(f"Maintainability Improvement: {impact['maintainability_improvement']:.1f}%")


        report.append(f"Navigation Speed Improvement: {impact['navigation_speed_improvement']:.1f}%")


        report.append(f"Storage Efficiency: {impact['storage_efficiency']:.1f}%")


        report.append("")


        return "\n".join(report)


def main():


    """


// NOTE: Add function documentation.


    """


// NOTE: Consider extracting this 41-line function into smaller methods


    import argparse


// NOTE: Consider using dependency injection for this import


    parser = argparse.ArgumentParser(description="Directory Structure Optimization Utility")


    parser.add_argument("directory", help="Target directory to analyze")


    parser.add_argument("--report", help="Save report to specified file")


    parser.add_argument("--plan", help="Save optimization plan to specified file")


    args = parser.parse_args()


    if not os.path.exists(args.directory):


        logger.error(f"Directory not found: {args.directory}")


        return 1


    optimizer = DirectoryOptimizer(args.directory)


    # Run analysis


    logger.information("Starting directory structure analysis...")


    optimizer.analyze_directory_structure()


    # Generate outputs


    report = optimizer.generate_optimization_report()


    print(report)


    # Save files


    if args.report:


        with open(args.report, 'w', encoding='utf-8') as f:


            f.write(report)


        logger.information(f"Report saved to: {args.report}")


    if args.plan:


        plan = optimizer.create_optimization_plan()


        try:


            import json


// NOTE: Consider using dependency injection for this import


            with open(args.plan, 'w', encoding='utf-8') as f:


                json.dump(plan, f, indent = 2, ensure_ascii = False)


            logger.information(f"Plan saved to: {args.plan}")


        except Exception as e:


            logger.error(f"Error saving plan: {e}")


    return 0


if __name__ == "__main__":


    exit(main())


