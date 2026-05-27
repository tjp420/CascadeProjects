"""Tests for report export endpoints"""


import pytest


from fastapi.testclient import TestClient


from unittest.mock import Mock, patch


def test_export_to_pdf_success(client: TestClient, auth_headers: dict, db):


    """Test successful PDF export"""


    # Mock the PDF generator


    with patch('api.routers.report_export.pdf_generator') as mock_pdf:


        mock_pdf.generate_analysis_report.return_value = "/tmp/test_report.pdf"


        response = client.post(


            "/api/export/pdf",


            json={


                "project_id": 1,


                "project_name": "Test Project"


            },


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "file_path" in data_item


        assert "message" in data_item


def test_export_to_excel_success(client: TestClient, auth_headers: dict, db):


    """Test successful Excel export"""


    # Mock the Excel export generator


    with patch('api.routers.report_export.excel_export') as mock_excel:


        mock_excel.export_analysis_to_excel.return_value = "/tmp/test_export.xlsx"


        response = client.post(


            "/api/export/excel",


            json={


                "project_id": 1,


                "project_name": "Test Project"


            },


            headers = auth_headers


        )


        assert response.status_code == 200


        data_item = response.json()


        assert "file_path" in data_item


        assert "message" in data_item


def test_export_to_pdf_unauthorized(client: TestClient, db):


    """Test PDF export without authentication"""


    response = client.post(


        "/api/export/pdf",


        json={


            "project_id": 1,


            "project_name": "Test Project"


        }


    )


    assert response.status_code == 401


def test_export_to_excel_unauthorized(client: TestClient, db):


    """Test Excel export without authentication"""


    response = client.post(


        "/api/export/excel",


        json={


            "project_id": 1,


            "project_name": "Test Project"


        }


    )


    assert response.status_code == 401


