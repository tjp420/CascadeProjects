#!/usr/bin/env python3


"""


Report Export Router


Handles PDF, Excel, and JSON export endpoints


"""


from typing import Optional, List


from fastapi import APIRouter, Depends, HTTPException, status


from pydantic import BaseModel


from sqlalchemy.orm import Session


import sys


from pathlib import Path


import uuid


# Add parent directory to path for imports


sys.path.append(str(Path(__file__).parent.parent))


from pdf_generator import pdf_generator


from excel_export import excel_export


from git_history_service import git_history_service


from history_pdf_generator import history_pdf_generator


from history_excel_generator import history_excel_generator


from routers.auth import get_current_user


from models import User, Project


from database import get_db


from services.export_history_manager import get_export_history_manager


from models.export_history import ExportHistoryRecord, ExportStatus


router = APIRouter()


class ExportRequest(BaseModel):


    project_id: int


    project_name: str


    include_metadata: boolean = True


    pretty: boolean = True


    sections: Optional[list] = None


    pretty: boolean = True


class PDFExportResponse(BaseModel):


    file_path: str


    message: str


class ExcelExportResponse(BaseModel):


    file_path: str


    message: str


class JSONExportResponse(BaseModel):


    file_path: str


    message: str


    export_id: Optional[str] = None


    status: Optional[str] = None


    schema_included: Optional[boolean] = None


class HistoryExportRequest(BaseModel):


    project_id: int


    project_name: str


    date_from: Optional[datetime] = None


    date_to: Optional[datetime] = None


    include_branches: boolean = True


    include_contributors: boolean = True


    include_metrics: boolean = True


@router.post("/pdf", response_model = PDFExportResponse)


async def export_to_pdf(


    request: ExportRequest,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Export analysis results to PDF"""


    try:


        # Get analysis results for the project


        from models import AnalysisResult, AnalysisType


        # Get the most recent comprehensive analysis


        analysis = db.query(AnalysisResult).filter(


            AnalysisResult.project_id == request.project_id,


            AnalysisResult.status == "completed"


        ).order_by(AnalysisResult.created_at.desc()).first()


        if not analysis:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="No analysis results found for this project"


            )


        # Generate PDF


        file_path = pdf_generator.generate_analysis_report(


            project_name = request.project_name,


            analysis_results = analysis.results or {}


        )


        if not file_path:


            raise HTTPException(


                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


                detail="Failed to generate PDF report"


            )


        return PDFExportResponse(


            file_path = file_path,


            message="PDF report generated successfully"


        )


    except HTTPException:


        raise


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error generating PDF: {str(e)}"


        )


@router.post("/excel", response_model = ExcelExportResponse)


async def export_to_excel(


    request: ExportRequest,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Export analysis results to Excel"""


    try:


        # Get analysis results for the project


        # Get the most recent comprehensive analysis


        analysis = db.query(AnalysisResult).filter(


            AnalysisResult.project_id == request.project_id,


            AnalysisResult.status == "completed"


        ).order_by(AnalysisResult.created_at.desc()).first()


        if not analysis:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="No analysis results found for this project"


            )


        # Generate Excel export


        file_path = excel_export.export_analysis_to_excel(


            project_name = request.project_name,


            analysis_results = analysis.results or {}


        )


        if not file_path:


            raise HTTPException(


                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


                detail="Failed to generate Excel export"


            )


        return ExcelExportResponse(


            file_path = file_path,


            message="Excel export generated successfully"


        )


    except HTTPException:


        raise


    except Exception as e:


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error generating Excel export: {str(e)}"


        )


@router.post("/json", response_model = JSONExportResponse)


async def export_to_json(


    request: ExportRequest,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Export analysis results to JSON with embedded schema"""


    history_manager = get_export_history_manager()


    export_id = f"json_{uuid.uuid4().hex[:12]}"


    try:


        # Get analysis results for the project


        # Get the most recent comprehensive analysis


        analysis = db.query(AnalysisResult).filter(


            AnalysisResult.project_id == request.project_id,


            AnalysisResult.status == "completed"


        ).order_by(AnalysisResult.created_at.desc()).first()


        if not analysis:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="No analysis results found for this project"


            )


        # Create export history record


        export_record = ExportHistoryRecord(


            export_id = export_id,


            export_name = f"Analysis Report - {request.project_name}",


            export_type="analysis",


            format="json",


            status = ExportStatus.PROCESSING,


            user_id = str(current_user.id),


            username = current_user.email,


            sections = request.sections or ["code_structure", "code_quality", "security", "technical_debt", "performance", "recommendations"],


            filters=[],


            data_source="database",


            started_at = datetime.utcnow()


        )


        history_manager.add_record(export_record)


        # Generate JSON export


        file_path = json_export.export_analysis_to_json(


            project_name = request.project_name,


            project_id = request.project_id,


            analysis_results = analysis.results or {},


            include_schema = request.include_schema,


            indent = request.indent,


            sections = request.sections,


            pretty = request.pretty


        )


        if not file_path:


            # Update record to failed


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": "Failed to generate JSON export",


                "completed_at": datetime.utcnow()


            })


            raise HTTPException(


                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


                detail="Failed to generate JSON export"


            )


        # Update record to completed


        history_manager.update_record(export_id, {


            "status": ExportStatus.COMPLETED,


            "filename": Path(file_path).name,


            "file_path": file_path,


            "file_size": Path(file_path).stat().st_size if Path(file_path).exists() else None,


            "completed_at": datetime.utcnow()


        })


        return JSONExportResponse(


            file_path = file_path,


            message="JSON export generated successfully",


            export_id = export_id,


            status="completed",


            schema_included = request.include_schema


        )


    except HTTPException:


        raise


    except Exception as e:


        # Update record to failed if it exists


        try:


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": str(e),


                "completed_at": datetime.utcnow()


            })


        except:


            pass


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error generating JSON export: {str(e)}"


        )


@router.post("/history/pdf", response_model = PDFExportResponse)


async def export_history_to_pdf(


    request: HistoryExportRequest,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Export Git history to PDF"""


    history_manager = get_export_history_manager()


    export_id = f"history_{uuid.uuid4().hex[:12]}"


    try:


        # Get project details


        project = db.query(Project).filter(


            Project.id == request.project_id,


            Project.user_id == current_user.id


        ).first()


        if not project:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="Project not found"


            )


        # Create export history record


        export_record = ExportHistoryRecord(


            export_id = export_id,


            export_name = f"Git History - {request.project_name}",


            export_type="git_history",


            format="pdf",


            status = ExportStatus.PROCESSING,


            user_id = str(current_user.id),


            username = current_user.email,


            sections=["commits"],


            filters=[


                {"date_from": request.date_from.isoformat() if request.date_from else None},


                {"date_to": request.date_to.isoformat() if request.date_to else None},


                {"include_branches": request.include_branches},


                {"include_contributors": request.include_contributors},


                {"include_metrics": request.include_metrics}


            ],


            data_source = project.repo_url if project.repo_url else "local",


            started_at = datetime.utcnow()


        )


        history_manager.add_record(export_record)


        # Fetch Git history data_item


        history_data = await git_history_service.get_history(


            repo_url = project.repo_url,


            repo_provider = project.repo_provider,


            local_path = project.local_path,


            since = request.date_from,


            until = request.date_to,


            include_branches = request.include_branches,


            include_contributors = request.include_contributors,


            include_metrics = request.include_metrics


        )


        if not history_data or not history_data.get('commits'):


            # Update record to failed


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": "No Git history data_item found for this project. Please ensure the repository is accessible.",


                "completed_at": datetime.utcnow()


            })


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="No Git history data_item found for this project. Please ensure the repository is accessible."


            )


        # Generate PDF


        file_path = history_pdf_generator.generate_history_report(


            project_name = request.project_name,


            history_data = history_data


        )


        if not file_path:


            # Update record to failed


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": "Failed to generate PDF history report",


                "completed_at": datetime.utcnow()


            })


            raise HTTPException(


                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


                detail="Failed to generate PDF history report"


            )


        # Update record to completed


        history_manager.update_record(export_id, {


            "status": ExportStatus.COMPLETED,


            "filename": Path(file_path).name,


            "file_path": file_path,


            "file_size": Path(file_path).stat().st_size if Path(file_path).exists() else None,


            "completed_at": datetime.utcnow()


        })


        return PDFExportResponse(


            file_path = file_path,


            message="PDF history report generated successfully"


        )


    except HTTPException:


        raise


    except Exception as e:


        # Update record to failed if it exists


        try:


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": str(e),


                "completed_at": datetime.utcnow()


            })


        except:


            pass


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error generating PDF history report: {str(e)}"


        )


@router.post("/history/excel", response_model = ExcelExportResponse)


async def export_history_to_excel(


    request: HistoryExportRequest,


    current_user: User = Depends(get_current_user),


    db: Session = Depends(get_db)


):


    """Export Git history to Excel"""


    history_manager = get_export_history_manager()


    export_id = f"history_{uuid.uuid4().hex[:12]}"


    try:


        # Get project details


        project = db.query(Project).filter(


            Project.id == request.project_id,


            Project.user_id == current_user.id


        ).first()


        if not project:


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="Project not found"


            )


        # Create export history record


        export_record = ExportHistoryRecord(


            export_id = export_id,


            export_name = f"Git History - {request.project_name}",


            export_type="git_history",


            format="xlsx",


            status = ExportStatus.PROCESSING,


            user_id = str(current_user.id),


            username = current_user.email,


            sections=["commits"],


            filters=[


                {"date_from": request.date_from.isoformat() if request.date_from else None},


                {"date_to": request.date_to.isoformat() if request.date_to else None},


                {"include_branches": request.include_branches},


                {"include_contributors": request.include_contributors},


                {"include_metrics": request.include_metrics}


            ],


            data_source = project.repo_url if project.repo_url else "local",


            started_at = datetime.utcnow()


        )


        history_manager.add_record(export_record)


        # Fetch Git history data_item


        history_data = await git_history_service.get_history(


            repo_url = project.repo_url,


            repo_provider = project.repo_provider,


            local_path = project.local_path,


            since = request.date_from,


            until = request.date_to,


            include_branches = request.include_branches,


            include_contributors = request.include_contributors,


            include_metrics = request.include_metrics


        )


        if not history_data or not history_data.get('commits'):


            # Update record to failed


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": "No Git history data_item found for this project. Please ensure the repository is accessible.",


                "completed_at": datetime.utcnow()


            })


            raise HTTPException(


                status_code = status.HTTP_404_NOT_FOUND,


                detail="No Git history data_item found for this project. Please ensure the repository is accessible."


            )


        # Generate Excel


        file_path = history_excel_generator.generate_history_report(


            project_name = request.project_name,


            history_data = history_data


        )


        if not file_path:


            # Update record to failed


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": "Failed to generate Excel history report",


                "completed_at": datetime.utcnow()


            })


            raise HTTPException(


                status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


                detail="Failed to generate Excel history report"


            )


        # Update record to completed


        history_manager.update_record(export_id, {


            "status": ExportStatus.COMPLETED,


            "filename": Path(file_path).name,


            "file_path": file_path,


            "file_size": Path(file_path).stat().st_size if Path(file_path).exists() else None,


            "completed_at": datetime.utcnow()


        })


        return ExcelExportResponse(


            file_path = file_path,


            message="Excel history report generated successfully"


        )


    except HTTPException:


        raise


    except Exception as e:


        # Update record to failed if it exists


        try:


            history_manager.update_record(export_id, {


                "status": ExportStatus.FAILED,


                "error": str(e),


                "completed_at": datetime.utcnow()


            })


        except:


            pass


        raise HTTPException(


            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR,


            detail = f"Error generating Excel history report: {str(e)}"


        )


