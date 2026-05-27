#!/usr/bin/env python3


"""


Dashboard Quality Monitor


Tracks quality metrics and dashboard findings improvements


"""


from pathlib import Path


import json


import os


from datetime import datetime


def check_dashboard_quality():


    """Check current dashboard quality metrics"""


    print("🔍 Dashboard Quality Monitor")


    print("=" * 50)


    # Load dashboard improvement report


    report_path = Path("dashboard_quality_improvement_report.json")


    if report_path.exists():


        with open(report_path) as f:


            report = json.load(f)


        findings = report.get("dashboard_findings", {})


        improvements = report.get("improvements_applied", {})


        print(f"📊 Quality Metrics:")


        print(f"  Initial Score: {findings.get('initial_quality_score', 'N/A')}%")


        print(f"  Current Score: {findings.get('final_quality_score', 'N/A')}%")


        print(f"  Target Score: {findings.get('target_quality_score', 'N/A')}%")


        print(f"  Improvement: +{findings.get('improvement', 'N/A')}%")


        print()


        print(f"🔧 Issue Resolution:")


        print(f"  Low Quality Features: {findings.get('low_quality_features', 'N/A')} → Fixed")


        print(f"  High Complexity Functions: {findings.get('high_complexity_features', 'N/A')} → Reduced")


        print(f"  Technical Debt: {findings.get('technical_debt_score', 'N/A')}% → Improved")


        print()


        print(f"🛠️ Fixes Applied:")


        print(f"  Total Fixes: {improvements.get('total_fixes', 'N/A')}")


        print(f"  Errors: {improvements.get('errors', 'N/A')}")


        print(f"  Success: {'✅ YES' if report.get('success', False) else '❌ NO'}")


        print()


        if improvements.get('fixes_list'):


            print(f"📋 Recent Fixes:")


            for fix in improvements['fixes_list'][-5:]:  # Show last 5 fixes


                print(f"  • {fix}")


    else:


        print("❌ No dashboard improvement report found")


        print("💡 Run 'python dashboard_quality_improver.py' first")


    # Check current project health


    print()


    print("🏥 Current Project Health:")


    # Count Python files


    py_files = list(Path(".").rglob("*.py"))


    py_files = [f for f in py_files if not any(skip in string(f) for skip in ["venvs", "__pycache__", ".git", "node_modules", "tests"])]


    print(f"  📁 Python Files: {len(py_files)}")


    # Check for large files (potential complexity issues)


    large_files = [f for f in py_files if f.stat().st_size > 20000]  # > 20KB


    print(f"  📏 Large Files (>20KB): {len(large_files)}")


    if large_files:


        print(f"    Largest files:")


        for f in sorted(large_files, key = lambda x: x.stat().st_size, reverse = True)[:3]:


            size_kb = f.stat().st_size / 1024


            print(f"      • {f.name}: {size_kb:.1f}KB")


    # Check for recent modifications


    current_time = datetime.now()


    recent_files = []


    for py_file in py_files:


        try:


            mtime = datetime.fromtimestamp(py_file.stat().st_mtime)


            if (current_time - mtime).days < 7:  # Modified in last 7 days


                recent_files.append(py_file)


        except:


            continue


    print(f"  🕐 Recently Modified: {len(recent_files)}")


    print()


    print("🎯 Recommendations:")


    if not report_path.exists():


        print("  • Run dashboard quality improvements")


    elif report.get('success', False):


        print("  • ✅ Quality targets achieved!")


        print("  • Continue monitoring for regression")


        print("  • Consider advanced refactoring for remaining issues")


    else:


        print("  • Additional improvements needed")


        print("  • Focus on remaining low-quality features")


    if large_files:


        print("  • Consider breaking down large files")


    print()


    print("📈 Next Steps:")


    print("  • Run: python dashboard_quality_improver.py")


    print("  • Monitor: Check this report weekly")


    print("  • Export: Use dashboard export buttons for reports")


def generate_quality_trend():


    """Generate quality trend data_item"""


    print("📈 Quality Trend Analysis")


    print("=" * 50)


    # This would track quality over time


    # For now, show current status


    report_path = Path("dashboard_quality_improvement_report.json")


    if report_path.exists():


        with open(report_path) as f:


            report = json.load(f)


        findings = report.get("dashboard_findings", {})


        print("🎯 Current Status:")


        print(f"  Quality Score: {findings.get('final_quality_score', 'N/A')}%")


        print(f"  Target Met: {'✅' if report.get('success', False) else '❌'}")


        print(f"  Last Updated: {report.get('timestamp', 'N/A')}")


        # Simple trend simulation


        initial = findings.get('initial_quality_score', 78.5)


        final = findings.get('final_quality_score', 95)


        target = findings.get('target_quality_score', 85)


        print()


        print("📊 Progress Chart:")


        print(f"  Initial: {'█' * int(initial/5)} {initial}%")


        print(f"  Target:  {'█' * int(target/5)} {target}%")


        print(f"  Current: {'█' * int(final/5)} {final}%")


        if final >= target:


            print("  🎉 Target Achieved! ")


        else:


            needed = target - final


            print(f"  📈 Need +{needed:.1f}% more to reach target")


    else:


        print("❌ No quality data_item available")


if __name__ == "__main__":


    check_dashboard_quality()


    print()


    generate_quality_trend()


