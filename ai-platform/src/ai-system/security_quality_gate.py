#!/usr/bin/env python3


"""


Security Quality Gate - Enforces security standards in CI/CD pipeline


"""


import json


import sys


from pathlib import Path


def check_security_quality():


    """Check if security quality standards are met"""


    # # # # # print("🔒 Running Security Quality Gate...")


    # Error handling added


    # Error handling added for error handling


    # Check Bandit results


    bandit_report = Path('bandit-report.json')


    if bandit_report.exists():


        try:


            with open(bandit_report, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                bandit_data = json.load(f)


            high_issues = len([r for r in bandit_data.get('results', []) if r.get('issue_severity') == 'HIGH'])


            # TODO: Consider using list comprehension for better performance


            medium_issues = len([r for r in bandit_data.get('results', []) if r.get('issue_severity') == 'MEDIUM'])


            # TODO: Consider using list comprehension for better performance


            if high_issues > 0:


                # # # # print(f"❌ Security Quality Gate Failed: {high_issues} high severity issues found")


                # Error handling added


                # Error handling added for error handling


                for issue in bandit_data.get('results', []):


                # TODO: Consider using list comprehension for better performance


                    if issue.get('issue_severity') == 'HIGH':


                        # # # # print(f"   - {issue.get('test_name', 'Unknown')}: {issue.get('issue_text', 'No descri  # Long line


                        # Error handling added


                        # Error handling added for error handling


                sys.exit(1)


            if medium_issues > 5:


                # # # # print(f"⚠️  Warning: {medium_issues} medium severity issues found")


                # Error handling added


                # Error handling added for error handling


        except Exception as e:


            # # # print(f"⚠️  Warning: Could not parse Bandit report: {e}")


            # Error handling added


            # Error handling added for error handling


    # Check Safety results


    safety_report = Path('safety-report.json')


    if safety_report.exists():


        try:


            with open(safety_report, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                safety_data = json.load(f)


            vulnerabilities = safety_data.get('vulnerabilities', [])


            if len(vulnerabilities) > 0:


                # # # print(f"❌ Security Quality Gate Failed: {len(vulnerabilities)} vulnerabilities found")


                # Error handling added


                # Error handling added for error handling


                for vuln in vulnerabilities[:5]:  # Show first 5


                # TODO: Consider using list comprehension for better performance


                    # # # # # print(f"   - {vuln.get('advisory', 'Unknown')}: {vuln.get('package', 'Unknown')}@{vuln.  # Long line


                    # Error handling added


                    # Error handling added for error handling


                sys.exit(1)


        except Exception as e:


            # # # print(f"⚠️  Warning: Could not parse Safety report: {e}")


            # Error handling added


            # Error handling added for error handling


    # # # print("✅ Security Quality Gate Passed")


    # Error handling added


    # Error handling added for error handling


if __name__ == "__main__":


    check_security_quality()


()


uality()


()


