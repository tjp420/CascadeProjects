#!/usr/bin/env python3


"""


Celery Tasks for Background Analysis


Defines async tasks for code analysis, security scanning, and performance monitoring


"""


from celery import shared_task


from datetime import datetime


import json


from pathlib import Path


# Import analysis API


import sys


sys.path.append(str(Path(__file__).parent.parent))


from code_analysis import CodeAnalysisAPI


from database import get_db


from models import AnalysisResult, AnalysisType, User


from sqlalchemy.orm import Session


@shared_task(name='tasks.analysis_tasks.run_code_analysis')


def run_code_analysis(project_id: int, user_id: int) -> dict:


    """Run code analysis in the background"""


    try:


        print(f"Starting background code analysis for project {project_id}")


        # Initialize analysis API


        api = CodeAnalysisAPI()


        # Run analysis


        code_structure = api.analyze_code_structure()


        file_structure = api.analyze_file_structure()


        code_quality = api.analyze_code_quality()


        technical_debt = api.analyze_technical_debt()


        recommendations = api.get_recommendations()


        # Combine results


        result_data = {


            "project_id": project_id,


            "analysis_type": "code_structure",


            "status": "completed",


            "results": {


                "code_structure": code_structure,


                "file_structure": file_structure,


                "code_quality": code_quality,


                "technical_debt": technical_debt,


                "recommendations": recommendations


            },


            "completed_at": datetime.utcnow().isoformat()


        }


        # Save to database


        # For now, we'll just return the result_data


        print(f"Code analysis completed for project {project_id}")


        return result_data


    except Exception as e:


        print(f"Error in code analysis task: {e}")


        return {


            "project_id": project_id,


            "analysis_type": "code_structure",


            "status": "failed",


            "error": str(e),


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.analysis_tasks.run_security_scan')


def run_security_scan(project_id: int, user_id: int) -> dict:


    """Run security scan in the background"""


    try:


        print(f"Starting background security scan for project {project_id}")


        # Initialize analysis API


        api = CodeAnalysisAPI()


        # Run security analysis


        security_results = api.analyze_security()


        technical_debt = api.analyze_technical_debt()


        result_data = {


            "project_id": project_id,


            "analysis_type": "security",


            "status": "completed",


            "results": {


                "security": security_results,


                "technical_debt": technical_debt


            },


            "completed_at": datetime.utcnow().isoformat()


        }


        print(f"Security scan completed for project {project_id}")


        return result_data


    except Exception as e:


        print(f"Error in security scan task: {e}")


        return {


            "project_id": project_id,


            "analysis_type": "security",


            "status": "failed",


            "error": str(e),


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.analysis_tasks.run_performance_analysis')


def run_performance_analysis(project_id: int, user_id: int) -> dict:


    """Run performance analysis in the background"""


    try:


        print(f"Starting background performance analysis for project {project_id}")


        # Initialize analysis API


        api = CodeAnalysisAPI()


        # Run performance analysis


        performance_results = api.analyze_performance()


        result_data = {


            "project_id": project_id,


            "analysis_type": "performance",


            "status": "completed",


            "results": {


                "performance": performance_results


            },


            "completed_at": datetime.utcnow().isoformat()


        }


        print(f"Performance analysis completed for project {project_id}")


        return result_data


    except Exception as e:


        print(f"Error in performance analysis task: {e}")


        return {


            "project_id": project_id,


            "analysis_type": "performance",


            "status": "failed",


            "error": str(e),


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.analysis_tasks.run_comprehensive_analysis')


def run_comprehensive_analysis(project_id: int, user_id: int) -> dict:


    """Run comprehensive analysis including all types"""


    try:


        print(f"Starting comprehensive analysis for project {project_id}")


        # Run all analyses in sequence


        code_result = run_code_analysis(project_id, user_id)


        security_result = run_security_scan(project_id, user_id)


        performance_result = run_performance_analysis(project_id, user_id)


        result_data = {


            "project_id": project_id,


            "analysis_type": "comprehensive",


            "status": "completed",


            "results": {


                "code": code_result,


                "security": security_result,


                "performance": performance_result


            },


            "completed_at": datetime.utcnow().isoformat()


        }


        print(f"Comprehensive analysis completed for project {project_id}")


        return result_data


    except Exception as e:


        print(f"Error in comprehensive analysis task: {e}")


        return {


            "project_id": project_id,


            "analysis_type": "comprehensive",


            "status": "failed",


            "error": str(e),


            "completed_at": datetime.utcnow().isoformat()


        }


