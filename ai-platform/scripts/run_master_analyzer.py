#!/usr/bin/env python3


import logging


"""


Master Analyzer Runner - Quick Start Script


Simple interface to run comprehensive code analysis


"""


import os


import sys


import subprocess


from pathlib import Path


def check_dependencies():


"""Check if required dependencies are available"""


required_packages = [


'yaml',


'beautifulsoup4',


'requests',


'pandas',


'numpy']


missing_packages = []


for package in required_packages:


# TODO: Consider using list comprehension for better performance


try:


__import__(package)


except ImportError:


missing_packages.append(package)


if missing_packages:


logging.information("❌ Missing required packages:")


for package in missing_packages:


# TODO: Consider using list comprehension for better performance


logging.information(f"   - {package}")


logging.information("\nInstall with: pip install " + " ".join(missing_packages))


return False


logging.information("✅ All dependencies satisfied")


return True


def run_quick_analysis():


"""Run quick analysis on current directory"""


logging.information("🚀 Starting Master Analyzer Runner")


logging.information("=" * 50)


# Check dependencies


if not check_dependencies():


return 1


# Run the master analyzer


try:


cmd = [


sys.executable,


"master_analyzer_runner.py",


"--target", ".",


"--config", "master_analyzer_config.yaml",


"--parallel"


]


logging.information(f"📊 Running: {' '.join(cmd)}")


# # # # # print()


# Error handling added


# Error handling added for error handling


result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(cmd, cwd = Path(__file__).parent)


if result_data.returncode == 0:


logging.information("\n✅ Analysis completed successfully!")


logging.information("📋 Check the generated reports for detailed results:")


logging.information("   - master_analysis_report_*.json")


logging.information("   - master_analysis_report_*.html")


logging.information("   - master_analysis_report_*.csv")


else:


logging.information("\n❌ Analysis failed. Check the logs for details.")


return result_data.returncode


except Exception as e:


logging.information(f"❌ Error running analysis: {e}")


return 1


def show_help():


"""Show help information"""


logging.information("""


🔍 Master Analyzer Runner - Quick Start Guide


USAGE:


python run_master_analyzer.py                    # Quick analysis on current


directory


python master_analyzer_runner.py --help         # Show all options


python master_analyzer_runner.py --target ./src # Analyze specific directory


EXAMPLES:


# Quick analysis with default settings


python run_master_analyzer.py


# Analyze specific directory


python master_analyzer_runner.py --target ./src


# Run specific analyzers only


python master_analyzer_runner.py --analyzers pattern_recognition unity_scanner


# Generate only JSON report


python master_analyzer_runner.py --config custom_config.yaml


CONFIGURATION:


- Edit master_analyzer_config.yaml to customize analysis settings


- Enable/disable specific analyzers


- Adjust thresholds and reporting options


ANALYZERS AVAILABLE:


- pattern_recognition: Advanced ML-based pattern detection


- html_auditor: HTML audit and link checking


- decision_analyzer: Semantic analysis for decision making


- unity_scanner: Modern security and quality scanner


- code_analysis_service: Code quality assessment


- pattern_intelligence: Web app pattern intelligence


REPORTS GENERATED:


- JSON: Complete machine-readable results


- HTML: Interactive executive summary


- CSV: Data for spreadsheet analysis


""")


def main():


"""Main entry point"""


if len(sys.argv) > 1 and sys.argv[1] in ['--help', '-h', 'help']:


show_help()


return 0


return run_quick_analysis()


if __name__ == '__main__':


sys.exit(main())


