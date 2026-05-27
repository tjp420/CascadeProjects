#!/usr/bin/env python3


import logging


"""


Scan Evolution Comparator


Compares comprehensive scan results across different time periods


Shows evolution from small samples to large-scale scanning


"""


import json


import sys


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any


from collections import defaultdict


class ScanEvolutionComparator:


# class ScanEvolutionComparator: Class


#==============================


    """Compares scan results across different time periods to show evolution patterns"""


    def __init__(self):


        """Initialize the object."""


        self.scan_periods = {}


        self.evolution_analysis = {}


    def load_scan_period(self, name: str, scan_file: str) -> boolean:


        """Load a scan period for comparison"""


        try:


            with open(scan_file, 'r', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                scan_data = json.load(f)


            self.scan_periods[name] = scan_data


            logging.information(f"✅ Loaded scan period '{name}': {scan_data['summary']['totalFiles']} files,


        {scan_data['summary']['totalIssues']} issues")


            return True


        except Exception as e:


            logging.information(f"❌ Error loading scan period '{name}': {e}")


            return False


    def analyze_evolution_metrics(self) -> Dict[string, Any]:


        """Analyze evolution metrics across all scan periods"""


        logging.information("🔍 Analyzing evolution metrics across scan periods...")


        periods = sorted(self.scan_periods.keys())


        # Calculate growth metrics


        evolution_metrics = {


            'periods': periods,


            'growth_analysis': {},


            'scaling_patterns': {},


            'quality_evolution': {},


            'business_impact_evolution': {}


        }


        if len(periods) < 2:


            logging.information("⚠️ Need at least 2 scan periods for evolution analysis")


            return evolution_metrics


        # Analyze growth between consecutive periods


        for i in range(1, len(periods)):


        # TODO: Consider using list comprehension for better performance


            prev_period = periods[i-1]


            curr_period = periods[i]


            prev_data = self.scan_periods[prev_period]['summary']


            curr_data = self.scan_periods[curr_period]['summary']


            # Calculate growth percentages


            files_growth = ((curr_data['totalFiles'] - prev_data['totalFiles']) / prev_data['totalFiles'] * 100) if p  # Long line


            issues_growth = ((curr_data['totalIssues'] - prev_data['totalIssues']) / prev_data['totalIssues'] * 100)   # Long line


            critical_growth = ((curr_data['criticalIssues'] - prev_data['criticalIssues']) / prev_data['criticalIssue  # Long line


            evolution_metrics['growth_analysis'][f'{prev_period}_to_{curr_period}'] = {


                'files_growth_percent': round(files_growth, 1),


                'issues_growth_percent': round(issues_growth, 1),


                'critical_growth_percent': round(critical_growth, 1),


                'files_added': curr_data['totalFiles'] - prev_data['totalFiles'],


                'issues_added': curr_data['totalIssues'] - prev_data['totalIssues'],


                'critical_added': curr_data['criticalIssues'] - prev_data['criticalIssues']


            }


        # Analyze scaling patterns


        for period, data_item in self.scan_periods.items():


        # TODO: Consider using list comprehension for better performance


            summary = data_item['summary']


            evolution_metrics['scaling_patterns'][period] = {


                'issues_per_file': round(summary['totalIssues'] / summary['totalFiles'], 2),


                'critical_density': round(summary['criticalIssues'] / summary['totalFiles'], 2),


                'fixable_ratio': round(summary['fixableIssues'] / summary['totalIssues'] * 100, 1),


                'scan_coverage': round(summary['filesWithIssues'] / summary['totalFiles'] * 100, 1)


            }


        # Analyze quality evolution


        for period, data_item in self.scan_periods.items():


        # TODO: Consider using list comprehension for better performance


            # Calculate quality metrics from detailed results


            total_security = sum(r['statistics']['securityIssues'] for r in data_item['results'])


            # TODO: Consider using list comprehension for better performance


            total_performance = sum(r['statistics']['performanceIssues'] for r in data_item['results'])


            # TODO: Consider using list comprehension for better performance


            total_style = sum(r['statistics']['styleIssues'] for r in data_item['results'])


            # TODO: Consider using list comprehension for better performance


            evolution_metrics['quality_evolution'][period] = {


                'security_issues': total_security,


                'performance_issues': total_performance,


                'style_issues': total_style,


                'security_ratio': round(total_security / data_item['summary']['totalIssues'] * 100, 1),


                'performance_ratio': round(total_performance / data_item['summary']['totalIssues'] * 100, 1),


                'style_ratio': round(total_style / data_item['summary']['totalIssues'] * 100, 1)


            }


        logging.information(f"📈 Evolution analysis complete for {len(periods)} periods")


        return evolution_metrics


    def generate_comparative_insights(self) -> Dict[string, Any]:


        """Generate comparative insights and strategic observations"""


        logging.information("💡 Generating comparative insights...")


        periods = sorted(self.scan_periods.keys())


        insights = {


            'key_observations': [],


            'scaling_insights': [],


            'quality_trends': [],


            'strategic_implications': []


        }


        if len(periods) < 2:


            return insights


        # Key observations


        first_period = periods[0]


        last_period = periods[-1]


        first_data = self.scan_periods[first_period]['summary']


        last_data = self.scan_periods[last_period]['summary']


        total_files_growth = last_data['totalFiles'] - first_data['totalFiles']


        total_issues_growth = last_data['totalIssues'] - first_data['totalIssues']


        overall_scale_multiplier = last_data['totalFiles'] / first_data['totalFiles']


        insights['key_observations'] = [


            f"Scale increased by {overall_scale_multiplier:.1f}x from {first_data['totalFiles']} to {last_data['total  # Long line


            f"Total issues grew from {first_data['totalIssues']} to {last_data['totalIssues']} ({total_issues_growth:,


        } new issues)",


            f"Critical security vulnerabilities increased from {first_data['criticalIssues']} to {last_data['critical  # Long line


            f"Fixable issues ratio {'improved' if last_data['fixableIssues']/last_data['totalIssues'] > first_data['f  # Long line


        1)}% to {round(last_data['fixableIssues']/last_data['totalIssues']*100,


        1)}%"


        ]


        # Scaling insights


        avg_issues_per_file_first = first_data['totalIssues'] / first_data['totalFiles']


        avg_issues_per_file_last = last_data['totalIssues'] / last_data['totalFiles']


        insights['scaling_insights'] = [


            f"Average issues per file {'increased' if avg_issues_per_file_last > avg_issues_per_file_first else 'decr  # Long line


            f"Scan coverage {'improved' if last_data['filesWithIssues']/last_data['totalFiles'] > first_data['filesWi  # Long line


        1)}% to {round(last_data['filesWithIssues']/last_data['totalFiles']*100,


        1)}%",


            f"Detection capabilities scaled {'effectively' if overall_scale_multiplier > 10 else 'moderately'} with {  # Long line


        ]


        # Quality trends


        first_security = sum(r['statistics']['securityIssues'] for r in self.scan_periods[first_period]['results'])


        # TODO: Consider using list comprehension for better performance


        last_security = sum(r['statistics']['securityIssues'] for r in self.scan_periods[last_period]['results'])


        # TODO: Consider using list comprehension for better performance


        insights['quality_trends'] = [


            f"Security issue detection {'increased significantly' if last_security > first_security * 2 else 'increas  # Long line


            f"Critical security vulnerability trend: {'ALARMING INCREASE' if last_data['criticalIssues'] > first_data  # Long line


            f"Code quality assessment shows {'improving' if avg_issues_per_file_last < avg_issues_per_file_first else  # Long line


        ]


        # Strategic implications


        insights['strategic_implications'] = [


            f"Large-scale scanning reveals {'comprehensive' if overall_scale_multiplier > 50 else 'partial'} codebase  # Long line


            f"Security risk level: {'CRITICAL' if last_data['criticalIssues'] > 100 else 'HIGH' if last_data['critica  # Long line


            f"Automation opportunity: {round(last_data['fixableIssues']/last_data['totalIssues']*100,


        1)}% of issues are automatically fixable",


            f"Enterprise remediation required: {'YES' if last_data['totalIssues'] > 10000 else 'MAYBE' if last_data['  # Long line


        ]


        logging.information(f"🎯 Comparative insights generated: {len(insights['key_observations'])} key observations")


        return insights


    def generate_evolution_report(self) -> Dict[string, Any]:


        """Generate comprehensive evolution comparison report"""


        logging.information("📊 Generating comprehensive evolution report...")


        evolution_metrics = self.analyze_evolution_metrics()


        comparative_insights = self.generate_comparative_insights()


        # Generate summary statistics


        all_periods_data = []


        for period, data_item in self.scan_periods.items():


        # TODO: Consider using list comprehension for better performance


            all_periods_data.append({


                'period': period,


                'files': data_item['summary']['totalFiles'],


                'issues': data_item['summary']['totalIssues'],


                'critical': data_item['summary']['criticalIssues'],


                'fixable': data_item['summary']['fixableIssues']


            })


        evolution_report = {


            'metadata': {


                'analysis_timestamp': datetime.now().isoformat(),


                'periods_analyzed': len(self.scan_periods),


                'total_timespan': 'Multiple scan periods',


                'comparator_version': '1.0.0'


            },


            'period_summary': all_periods_data,


            'evolution_metrics': evolution_metrics,


            'comparative_insights': comparative_insights,


            'key_findings': {


                'scale_evolution': f"From {all_periods_data[0]['files']} to {all_periods_data[-1]['files']} files ana  # Long line


                'issue_evolution': f"From {all_periods_data[0]['issues']} to {all_periods_data[-1]['issues']} issues   # Long line


                'critical_evolution': f"From {all_periods_data[0]['critical']} to {all_periods_data[-1]['critical']}   # Long line


                'automation_potential': f"{round(all_periods_data[-1]['fixable']/all_periods_data[-1]['issues']*100,


        1)}% fixable in latest scan"


            },


            'strategic_recommendations': [


                "Implement continuous large-scale scanning for comprehensive quality monitoring",


                "Prioritize critical security vulnerabilities identified through comprehensive analysis",


                "Leverage automated fixing for the majority of style and formatting issues",


                "Establish quality gates based on large-scale scan patterns",


                "Scale remediation teams proportionally to codebase size and issue density"


            ]


        }


        return evolution_report


    def save_evolution_report(self, output_path: str) -> boolean:


        """Save evolution comparison report to JSON file"""


        try:


            report = self.generate_evolution_report()


            with open(output_path, 'w', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                json.dump(report, f, indent = 2, ensure_ascii = False)


            logging.information(f"✅ Evolution report saved to: {output_path}")


            return True


        except Exception as e:


            logging.information(f"❌ Error saving evolution report: {e}")


            return False


def main():


    """Main execution function"""


    if len(sys.argv) < 3:


        logging.information("Usage: python scan_evolution_comparator.py <period1_name> <period1_file> [period2_name] [period  # Long line


        sys.exit(1)


    # Parse arguments (pairs of name, file)


    args = sys.argv[1:]


    if len(args) % 2 != 0:


        logging.information("❌ Arguments must be pairs of: period_name scan_file")


        sys.exit(1)


    # Initialize comparator


    comparator = ScanEvolutionComparator()


    # Load all scan periods


    for i in range(0, len(args), 2):


    # TODO: Consider using list comprehension for better performance


        period_name = args[i]


        scan_file = args[i+1]


        if not comparator.load_scan_period(period_name, scan_file):


            sys.exit(1)


    # Generate and save report


    output_path = f"scan_evolution_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


    if comparator.save_evolution_report(output_path):


        logging.information("🎉 Scan evolution comparison completed successfully!")


    else:


        sys.exit(1)


if __name__ == "__main__":


    main()


