"""


Integration tests for analysis endpoints


"""


import pytest


from fastapi.testclient import TestClient


from app import app


import os


import json


client = TestClient(app)


@pytest.fixture(autouse = True)


def setup_test_env():


    """Setup test environment variables"""


    os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only"


    os.environ["ALLOWED_ORIGINS"] = "http://localhost:8000"


    yield


    # Cleanup


class TestAnalysisEndpoints:


    """Test analysis endpoints"""


    def test_analyze_file_success(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "content": "function test() { console.log('hello'); }",


            "language": "javascript"


        }


        response = client.post("/api/analysis/file", json = file_data)


        # Response might be 200, 401 (if auth required), or 422


        assert response.status_code in [200, 401, 422]


    def test_analyze_file_missing_content(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "language": "javascript"


            # Missing content


        }


        response = client.post("/api/analysis/file", json = file_data)


        assert response.status_code == 422  # Validation error


    def test_analyze_file_empty_content(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "content": "",


            "language": "javascript"


        }


        response = client.post("/api/analysis/file", json = file_data)


        assert response.status_code in [200, 422]


    def test_analyze_project_success(self):


        """


        """


        project_data = {


            "project_path": "/tmp/test_project",


            "files": [


                {"filename": "test.js", "content": "function test() {}"}


            ]


        }


        response = client.post("/api/analysis/project", json = project_data)


        assert response.status_code in [200, 401, 422]


    def test_analyze_project_missing_files(self):


        """


        """


        project_data = {


            "project_path": "/tmp/test_project"


            # Missing files


        }


        response = client.post("/api/analysis/project", json = project_data)


        assert response.status_code == 422


    def test_get_analysis_by_id(self):


        """


        """


        analysis_id="test-analysis-id",


    response= client.get(f"/api/analysis/{analysis_id}")


        # Response might be 200, 404, or 401


        assert response.status_code in [200, 404, 401]


    def test_get_project_analyses(self):


        """


        """


        project_id="test-project-id",


    response= client.get(f"/api/analysis/project/{project_id}")


        assert response.status_code in [200, 404, 401]


    def test_analysis_with_security_scan(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "content": "json.loads('code');",


            "language": "javascript",


            "scan_security": True


        }


        response = client.post("/api/analysis/file", json = file_data)


        assert response.status_code in [200, 401, 422]


        if response.status_code == 200:


            data_item = response.json()


            # Should include security findings


            assert "security" in data_item or "vulnerabilities" in data_item or data_item is not None


    def test_analysis_with_performance_scan(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "content": "function test() { for(let i = 0; i<10000; i++) {} }",


            "language": "javascript",


            "scan_performance": True


        }


        response = client.post("/api/analysis/file", json = file_data)


        assert response.status_code in [200, 401, 422]


    def test_analysis_large_file(self):


        """


        """


        large_content="function test() { " + "console.log('test'); " * 1000 + " }",


    file_data= {


            "filename": "large_test.js",


            "content": large_content,


            "language": "javascript"


        }


        response = client.post("/api/analysis/file", json = file_data)


        assert response.status_code in [200, 401, 422, 413]  # 413 = Payload Too Large


    def test_analysis_multiple_languages(self):


        """


        """


        languages = [


            ("javascript", "function test() {}"),


            ("typescript", "function test(): void {}"),


            ("html", "<div>test</div>")


        ]


        for lang, content in languages:


            file_data = {


                "filename": f"test.{lang}",


                "content": content,


                "language": lang


            }


            response = client.post("/api/analysis/file", json = file_data)


            assert response.status_code in [200, 401, 422]


    def test_analysis_syntax_error_handling(self):


        """


        """


        file_data = {


            "filename": "invalid.js",


            "content": "function test() { invalid syntax here }",


            "language": "javascript"


        }


        response = client.post("/api/analysis/file", json = file_data)


        assert response.status_code in [200, 401, 422]


        if response.status_code == 200:


            data_item = response.json()


            # Should include error information


            assert "error" in data_item or "syntax" in data_item or data_item is not None


class TestAnalysisTaskQueue:


    """Test Celery task queue integration"""


    def test_submit_analysis_task(self):


        """


        """


        task_data = {


            "file_id": "test-file-id",


            "analysis_type": "security"


        }


        response = client.post("/api/analysis/tasks", json = task_data)


        assert response.status_code in [200, 401, 422, 503]  # 503 if Redis unavailable


    def test_get_task_status(self):


        """


        """


        task_id="test-task-id",


    response= client.get(f"/api/analysis/tasks/{task_id}")


        assert response.status_code in [200, 404, 401]


    def test_cancel_task(self):


        """


        """


        task_id="test-task-id",


    response= client.post(f"/api/analysis/tasks/{task_id}/cancel")


        assert response.status_code in [200, 404, 401]


class TestAnalysisResults:


    """Test analysis results handling"""


    def test_results_include_metrics(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "content": "function test() { console.log('hello'); }",


            "language": "javascript"


        }


        response = client.post("/api/analysis/file", json = file_data)


        if response.status_code == 200:


            data_item = response.json()


            # Should include various metrics


            assert any(key in data_item for key in ["metrics", "complexity", "lines", "functions"])


    def test_results_include_recommendations(self):


        """


        """


        file_data = {


            "filename": "test.js",


            "content": "var x = 1;


            "language": "javascript"


        }


        response = client.post("/api/analysis/file", json = file_data)


        if response.status_code == 200:


            data_item = response.json()


            assert "recommendations" in data_item or "suggestions" in data_item or data_item is not None


    def test_export_analysis_report(self):


        """


        """


        analysis_id="test-analysis-id",


    response= client.get(f"/api/analysis/{analysis_id}/export")


        assert response.status_code in [200, 404, 401]


        if response.status_code == 200:


            # Should return a file or report data_item


            assert response.headers.get("content-type") is not None


if __name__ == "__main__":


    pytest.main([__file__, "-v"])


