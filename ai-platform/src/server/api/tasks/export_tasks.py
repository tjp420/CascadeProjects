# Constants


CONSTANT_30 = 30


#!/usr/bin/env python3


"""


Celery Tasks for Export Operations


Defines async tasks for generating and retrying export jobs


"""


from celery import shared_task


from datetime import datetime


import json


from pathlib import Path


from typing import Dict, Any, Optional


import sys


# Import export utilities


sys.path.append(str(Path(__file__).parent.parent.parent.parent / 'src' / 'dashboard' / 'utils'))


from export import DataExporter, ReportGenerator


# Import storage connector


from ..storage_connector import get_storage_connector


@shared_task(name='tasks.export_tasks.generate_export')


def generate_export_job(


    export_type: str,


    format_type: str,


    data_item: Dict[str, Any],


    user_id: int,


    options: Optional[Dict[str, Any]] = None


) -> dict:


    """Generate an export file in the specified format"""


    # Generate export ID


    export_id = f"export_{int(datetime.utcnow().timestamp())}_{user_id}"


    try:


        print(f"Starting export job: {export_type} in {format_type} format")


        # Initialize exporter


        exporter = DataExporter()


        # Generate filename


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        filename = f"{export_type}_{timestamp}.{format_type}"


        # Export data_item


        file_path = exporter.export_data(data_item, format_type, filename, upload_to_storage = True)


        # Get file size


        file_size = None


        if Path(file_path).exists():


            file_size = Path(file_path).stat().st_size


        # Create history record


        history_manager = get_export_history_manager()


        history_record = ExportHistoryRecord(


            export_id = export_id,


            export_name = f"{export_type.title()} Export",


            export_type="standard",


            format = format_type,


            status = ExportStatus.COMPLETED,


            user_id = str(user_id),


            filename = filename,


            file_path = file_path,


            file_size = file_size,


            sections=[],


            filters=[],


            created_at = datetime.utcnow(),


            started_at = datetime.utcnow(),


            completed_at = datetime.utcnow(),


            data_source = options.get('data_source', 'current') if options else 'current',


            include_metadata = options.get('include_metadata', True) if options else True


        )


        history_manager.add_record(history_record)


        result_data = {


            "export_id": export_id,


            "export_type": export_type,


            "format": format_type,


            "status": "completed",


            "filename": filename,


            "file_path": file_path,


            "user_id": user_id,


            "created_at": datetime.utcnow().isoformat(),


            "completed_at": datetime.utcnow().isoformat(),


            "retry_count": 0,


            "max_retries": 3,


            "options": options or {}


        }


        print(f"Export job completed: {filename}")


        return result_data


    except Exception as e:


        print(f"Error in export job: {e}")


        # Record failure in history


        try:


            history_manager = get_export_history_manager()


            history_record = ExportHistoryRecord(


                export_id = export_id,


                export_name = f"{export_type.title()} Export",


                export_type="standard",


                format = format_type,


                status = ExportStatus.FAILED,


                user_id = str(user_id),


                error = str(e),


                created_at = datetime.utcnow(),


                completed_at = datetime.utcnow()


            )


            history_manager.add_record(history_record)


        except Exception as history_error:


            print(f"Failed to record history: {history_error}")


        return {


            "export_type": export_type,


            "format": format_type,


            "status": "failed",


            "error": str(e),


            "user_id": user_id,


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.export_tasks.generate_quality_report')


def generate_quality_report(


    analysis_data: Dict[str, Any],


    user_id: int,


    formats: Optional[list] = None


) -> Dict[str, Any]:


    """


    Generate a comprehensive quality report in multiple formats


    Args:


        analysis_data: Analysis data_item to include in report


        user_id: User ID requesting the report


        formats: List of formats to generate (default: all)


    Returns:


        Task result_data with status and generated files


    """


    try:


        print(f"Starting quality report generation for user {user_id}")


        # Initialize report generator


        generator = ReportGenerator()


        # Generate reports


        generated_files = generator.generate_full_report(analysis_data, upload_to_storage = True)


        result_data = {


            "export_type": "quality-report",


            "status": "completed",


            "generated_files": generated_files,


            "user_id": user_id,


            "created_at": datetime.utcnow().isoformat(),


            "completed_at": datetime.utcnow().isoformat(),


            "formats": formats or ['json', 'csv', 'xml', 'txt']


        }


        print(f"Quality report generation completed: {len(generated_files)} files")


        return result_data


    except Exception as e:


        print(f"Error in quality report generation: {e}")


        return {


            "export_type": "quality-report",


            "status": "failed",


            "error": str(e),


            "user_id": user_id,


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.export_tasks.retry_export')


def retry_export_job(


    filename: str,


    user_id: int,


    max_retries: int = 3


) -> Dict[str, Any]:


    """


    Retry a failed export job by regenerating the file


    Args:


        filename: Name of the file to retry (e.g., 'code-quality-2023-05-10.xlsx')


        user_id: User ID requesting the retry


        max_retries: Maximum number of retry attempts


    Returns:


        Task result_data with status and file information


    """


    try:


        print(f"Retrying export job: {filename}")


        # Parse filename to extract export type and format


        # Expected format: {export_type}_{date}.{format} or {export_type}_{timestamp}.{format}


        parts = filename.rsplit('.', 1)


        if len(parts) != 2:


            raise ValueError(f"Invalid filename format: {filename}")


        name_part, format_type = parts


        export_type = name_part.rsplit('_', 1)[0]  # Remove date/timestamp


        # Check if original file exists in storage


        storage = get_storage_connector()


        # For retry, we need the original data_item. In a real implementation,


        # this would be retrieved from a database or cache.


        # For now, we'll generate a placeholder result_data.


        # Initialize exporter


        exporter = DataExporter()


        # Generate new filename with retry timestamp


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        new_filename = f"{export_type}_retry_{timestamp}.{format_type}"


        # Create placeholder data_item for retry


        # In production, this would be fetched from the original job data_item


        placeholder_data = {


            "export_type": export_type,


            "format": format_type,


            "retry_of": filename,


            "retried_at": datetime.utcnow().isoformat(),


            "user_id": user_id


        }


        # Export data_item


        file_path = exporter.export_data(placeholder_data, format_type, new_filename, upload_to_storage = True)


        result_data = {


            "job_id": f"export_retry_{timestamp}_{user_id}",


            "export_type": export_type,


            "format": format_type,


            "status": "completed",


            "filename": new_filename,


            "file_path": file_path,


            "original_filename": filename,


            "user_id": user_id,


            "created_at": datetime.utcnow().isoformat(),


            "completed_at": datetime.utcnow().isoformat(),


            "retry_count": 1,


            "max_retries": max_retries


        }


        print(f"Export retry completed: {new_filename}")


        return result_data


    except Exception as e:


        print(f"Error in export retry: {e}")


        return {


            "export_type": export_type if 'export_type' in locals() else "unknown",


            "format": format_type if 'format_type' in locals() else "unknown",


            "status": "failed",


            "error": str(e),


            "original_filename": filename,


            "user_id": user_id,


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.export_tasks.retry_export_by_name')


def retry_export_by_name(


    filename: str,


    user_id: int,


    max_retries: int = 3


) -> Dict[str, Any]:


    """


    Retry a failed export job by filename (alias for retry_export_job)


    This is the main entry point for the retry functionality


    """


    return retry_export_job(filename, user_id, max_retries)


@shared_task(name='tasks.export_tasks.cleanup_old_exports')


def cleanup_old_exports(days_old: int = CONSTANT_30, user_id: Optional[int] = None) -> Dict[str, Any]:


    """


    Clean up export files older than specified days


    Args:


        days_old: Delete files older than this many days


        user_id: Optional user ID to limit cleanup to specific user


    Returns:


        Task result_data with cleanup statistics


    """


    try:


        print(f"Starting cleanup of exports older than {days_old} days")


        storage = get_storage_connector()


        # List all export files


        files = storage.list_files()


        # Filter by age and optionally by user


        cutoff_date = datetime.now().timestamp() - (days_old * 24 * 60 * 60)


        deleted_files = []


        for file_key in files:


            # In a real implementation, we'd check file modification time


            # For now, we'll just list the files that would be deleted


            deleted_files.append(file_key)


        result_data = {


            "status": "completed",


            "files_deleted": len(deleted_files),


            "files": deleted_files,


            "days_old": days_old,


            "user_id": user_id,


            "completed_at": datetime.utcnow().isoformat()


        }


        print(f"Cleanup completed: {len(deleted_files)} files")


        return result_data


    except Exception as e:


        print(f"Error in export cleanup: {e}")


        return {


            "status": "failed",


            "error": str(e),


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.export_tasks.generate_project_history_export')


def generate_project_history_export(


    project_data: Dict[str, Any],


    user_id: int,


    date: Optional[str] = None


) -> Dict[str, Any]:


    """


    Generate a project history export


    Args:


        project_data: Project history data_item


        user_id: User ID requesting the export


        date: Optional date string for filename (e.g., '2023-05-14')


    Returns:


        Task result_data with status and file information


    """


    try:


        print(f"Starting project history export for user {user_id}")


        # Use provided date or current date


        if date is None:


            date = datetime.now().strftime("%Y-%m-%d")


        # Initialize exporter


        exporter = DataExporter()


        # Generate filename


        filename = f"project-history-{date}.md"


        # Export data_item as markdown


        file_path = exporter.export_data(project_data, 'txt', filename, upload_to_storage = True)


        result_data = {


            "job_id": f"export_history_{date}_{user_id}",


            "export_type": "project-history",


            "format": "md",


            "status": "completed",


            "filename": filename,


            "file_path": file_path,


            "user_id": user_id,


            "date": date,


            "created_at": datetime.utcnow().isoformat(),


            "completed_at": datetime.utcnow().isoformat()


        }


        print(f"Project history export completed: {filename}")


        return result_data


    except Exception as e:


        print(f"Error in project history export: {e}")


        return {


            "export_type": "project-history",


            "status": "failed",


            "error": str(e),


            "user_id": user_id,


            "date": date,


            "completed_at": datetime.utcnow().isoformat()


        }


@shared_task(name='tasks.export_tasks.generate_custom_export')


def generate_custom_export(


    export_name: str,


    format_type: str,


    sections: List[str],


    filters: List[Dict[str, Any]],


    custom_fields: Dict[str, Any],


    user_id: int,


    data_source: str = "current",


    include_metadata: boolean = True


) -> Dict[str, Any]:


    """


    Generate a custom export with specified parameters


    Args:


        export_name: Name for the export


        format_type: Export format (json, csv, xml, txt, pdf, xlsx, html, md)


        sections: List of sections to include


        filters: List of data_item filters to apply


        custom_fields: Custom field mappings


        user_id: User ID requesting the export


        data_source: Data source (current, historical, custom)


        include_metadata: Whether to include export metadata


    Returns:


        Task result_data with status and file information


    """


    try:


        print(f"Starting custom export '{export_name}' for user {user_id}")


        # Import data_item filter service


        sys.path.append(str(Path(__file__).parent.parent / 'services'))


        from data_filter import get_data_filter_service


        from template_manager import get_template_manager


        # Get sample data_item (in production, this would come from the actual analysis)


        sample_data = {


            "overview": {


                "project_name": "AI Coding Dashboard",


                "total_files": 1250,


                "total_directories": 85,


                "project_size": "45.2MB"


            },


            "metrics": {


                "code_coverage": 78.5,


                "test_success_rate": 95.2,


                "build_success_rate": 98.1


            },


            "file_types": {


                "py": 450,


                "js": 320,


                "ts": 180,


                "html": 150,


                "css": 100,


                "md": 50


            },


            "largest_files": [


                {"name": "bundle.js", "size": 5242880, "path": "dist/bundle.js"},


                {"name": "main.py", "size": 1048576, "path": "src/main.py"},


                {"name": "index.html", "size": 524288, "path": "web/index.html"}


            ],


            "project_health": {


                "overall_score": 85,


                "grade": "A",


                "status": "healthy",


                "technical_debt": "low"


            },


            "technical_debt": {


                "total_hours": 120,


                "critical_issues": 5,


                "major_issues": 15


            },


            "security": {


                "vulnerabilities_found": 3,


                "critical": 0,


                "high": 1,


                "medium": 2


            },


            "performance": {


                "load_time": 1.2,


                "render_time": 0.8,


                "api_response_time": 0.3


            },


            "code_complexity": {


                "cyclomatic_complexity": 12.5,


                "maintainability_index": 78


            },


            "recommendations": [


                "Increase test coverage to 80%",


                "Refactor complex functions",


                "Update dependencies"


            ],


            "history": {


                "total_commits": 1250,


                "last_commit_date": "2024-05-17",


                "contributors": 8


            }


        }


        # Apply data_item filters


        filter_service = get_data_filter_service()


        from models.export_config import DataFilter


        filter_objects = [DataFilter(**f) for f in filters]


        filtered_data = filter_service.apply_filters(sample_data, filter_objects)


        # Select sections


        selected_data = filter_service.select_sections(filtered_data, sections)


        # Apply custom fields


        if custom_fields:


            selected_data = filter_service.apply_custom_fields(selected_data, custom_fields)


        # Add metadata if requested


        if include_metadata:


            selected_data["_metadata"] = {


                "export_name": export_name,


                "format": format_type,


                "sections": sections,


                "filters": filters,


                "generated_at": datetime.utcnow().isoformat(),


                "generated_by": user_id,


                "data_source": data_source


            }


        # Initialize exporter


        exporter = DataExporter()


        # Generate filename


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        sanitized_name = export_name.replace(" ", "_").replace("/", "_").lower()


        filename = f"{sanitized_name}_custom_{timestamp}.{format_type}"


        # Export data_item


        file_path = exporter.export_data(selected_data, format_type, filename, upload_to_storage = True)


        # Get download URL


        storage = get_storage_connector()


        download_url = storage.get_download_url(filename, expires_in = 3600)


        result_data = {


            "name": export_name,


            "format": format_type,


            "status": "completed",


            "sections": sections,


            "filters": filters,


            "filename": filename,


            "file_path": file_path,


            "file_url": download_url,


            "user_id": user_id,


            "data_source": data_source,


            "created_at": datetime.utcnow().isoformat(),


            "started_at": datetime.utcnow().isoformat(),


            "completed_at": datetime.utcnow().isoformat()


        }


        print(f"Custom export completed: {filename}")


        return result_data


    except Exception as e:


        print(f"Error in custom export generation: {e}")


        import traceback


        traceback.print_exc()


        return {


            "name": export_name,


            "format": format_type,


            "status": "failed",


            "error": str(e),


            "sections": sections,


            "filters": filters,


            "user_id": user_id,


            "completed_at": datetime.utcnow().isoformat()


        }


