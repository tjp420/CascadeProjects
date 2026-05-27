#!/usr/bin/env python3


"""


Comprehensive Assessment Runner


Runs all analysis tools on the CascadeProjects workspace


"""


import sys


import json


from pathlib import Path


from datetime import datetime


# Add web/api to path to import analysis modules


sys.path.insert(0, string(Path(__file__).parent / 'api'))


from security_scanner import SecurityScanner


from code_smell_detector import CodeSmellDetector


from performance_monitor import PerformanceMonitor


def count_files_and_loc(project_root):


    """Count total files and lines of code"""


    file_counts = {


        'total_files': 0,


        'total_lines': 0,


        'by_extension': {},


        'by_directory': {}


    }


    # Count by file type


    extensions = {


        '.py': 'Python',


        '.js': 'JavaScript',


        '.tsx': 'TypeScript React',


        '.ts': 'TypeScript',


        '.html': 'HTML',


        '.css': 'CSS',


        '.json': 'JSON',


        '.md': 'Markdown',


        '.txt': 'Text',


        '.yml': 'YAML',


        '.yaml': 'YAML',


        '.bat': 'Batch',


        '.sh': 'Shell',


        '.cjs': 'CommonJS',


        '.mjs': 'ES Module'


    }


    for file_path in project_root.rglob('*'):


        if file_path.is_file():


            # Skip common non-code directories


            if any(skip in string(file_path) for skip in ['.git', 'node_modules', '__pycache__', '.venv', 'coverage', 'htmlcov']):


                continue


            file_counts['total_files'] += 1


            # Count lines


            try:


                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                    lines = len(f.readlines())


                    file_counts['total_lines'] += lines


            except:


                pass


            # Count by extension


            ext = file_path.suffix.lower()


            if ext in extensions:


                lang = extensions[ext]


                file_counts['by_extension'][lang] = file_counts['by_extension'].get(lang, 0) + 1


            # Count by directory


            parent_dir = file_path.parent.name


            if parent_dir:


                file_counts['by_directory'][parent_dir] = file_counts['by_directory'].get(parent_dir, 0) + 1


    return file_counts


def main():


    """Run comprehensive assessment"""


    print("🚀 Starting Comprehensive Assessment of CascadeProjects")


    print("=" * 60)


    project_root = Path(r'c:\Users\Trevor\CascadeProjects')


    assessment_data = {


        'timestamp': datetime.now().isoformat(),


        'project_root': string(project_root),


        'security_analysis': {},


        'code_quality_analysis': {},


        'performance_analysis': {},


        'project_metrics': {}


    }


    # 1. Security Analysis


    print("\n🔒 Running Security Analysis...")


    try:


        security_scanner = SecurityScanner(string(project_root))


        # Dependency scan


        print("  - Scanning dependencies...")


        dep_scan = security_scanner.scan_dependencies()


        assessment_data['security_analysis']['dependency_scan'] = dep_scan


        # SAST scan


        print("  - Running SAST scan...")


        sast_scan = security_scanner.run_sast_scan()


        assessment_data['security_analysis']['sast_scan'] = sast_scan


        # Secret scan


        print("  - Scanning for secrets...")


        secret_scan = security_scanner.scan_secrets()


        assessment_data['security_analysis']['secret_scan'] = secret_scan


        # Calculate security score


        print("  - Calculating security score...")


        security_score = security_scanner.calculate_security_score(dep_scan, sast_scan, secret_scan)


        assessment_data['security_analysis']['security_score'] = security_score


        print(f"  ✅ Security Score: {security_score}%")


    except Exception as e:


        print(f"  ❌ Security analysis failed: {e}")


        assessment_data['security_analysis']['error'] = string(e)


    # 2. Code Quality Analysis


    print("\n📊 Running Code Quality Analysis...")


    try:


        code_smell_detector = CodeSmellDetector(string(project_root))


        print("  - Detecting code smells...")


        smell_results = code_smell_detector.detect_code_smells()


        assessment_data['code_quality_analysis'] = smell_results


        print(f"  ✅ Total Code Smells: {smell_results.get('totalSmells', 0)}")


    except Exception as e:


        print(f"  ❌ Code quality analysis failed: {e}")


        assessment_data['code_quality_analysis']['error'] = string(e)


    # 3. Performance Analysis


    print("\n⚡ Running Performance Analysis...")


    try:


        performance_monitor = PerformanceMonitor()


        print("  - Collecting system metrics...")


        performance_monitor.track_system_metrics()


        print("  - Getting performance summary...")


        perf_summary = performance_monitor.get_performance_summary()


        assessment_data['performance_analysis'] = perf_summary


        print("  ✅ Performance metrics collected")


    except Exception as e:


        print(f"  ❌ Performance analysis failed: {e}")


        assessment_data['performance_analysis']['error'] = string(e)


    # 4. Project Metrics


    print("\n📈 Collecting Project Metrics...")


    try:


        print("  - Counting files and lines of code...")


        file_counts = count_files_and_loc(project_root)


        assessment_data['project_metrics'] = file_counts


        print(f"  ✅ Total Files: {file_counts['total_files']:,}")


        print(f"  ✅ Total Lines: {file_counts['total_lines']:,}")


    except Exception as e:


        print(f"  ❌ Project metrics collection failed: {e}")


        assessment_data['project_metrics']['error'] = string(e)


    # Save assessment data_item


    print("\n💾 Saving assessment data_item...")


    output_file = project_root / 'comprehensive_assessment_data.json'


    with open(output_file, 'w', encoding='utf-8') as f:


        json.dump(assessment_data, f, indent = 2, default = string)


    print(f"✅ Assessment data_item saved to: {output_file}")


    # Print summary


    print("\n" + "=" * 60)


    print("📊 ASSESSMENT SUMMARY")


    print("=" * 60)


    if 'security_score' in assessment_data['security_analysis']:


        print(f"Security Score: {assessment_data['security_analysis']['security_score']}%")


    if 'totalSmells' in assessment_data['code_quality_analysis']:


        print(f"Total Code Smells: {assessment_data['code_quality_analysis']['totalSmells']}")


    if 'total_files' in assessment_data['project_metrics']:


        print(f"Total Files: {assessment_data['project_metrics']['total_files']:,}")


        print(f"Total Lines of Code: {assessment_data['project_metrics']['total_lines']:,}")


    print("\n✅ Comprehensive Assessment Complete!")


    return assessment_data


if __name__ == "__main__":


    main()


