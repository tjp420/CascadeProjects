#!/usr/bin/env python3


"""


Tests for JSON Export Module


Tests the JSON export functionality including schema validation, parameter handling, and export history tracking


"""


import pytest


import json


import sys


from pathlib import Path


from datetime import datetime


from unittest.mock import Mock, patch, MagicMock


# Add parent directory to path for imports


sys.path.append(str(Path(__file__).parent.parent))


from json_export import JSONExportGenerator


class TestJSONExportGenerator:


    """Test cases for JSONExportGenerator class"""


    @pytest.fixture


    def generator(self):


        """Create a JSONExportGenerator instance"""


        return JSONExportGenerator()


    @pytest.fixture


    def sample_analysis_results(self):


        """Sample analysis results for testing"""


        return {


            "code_structure": {


                "totalFiles": 150,


                "totalLines": 15678,


                "languages": ["python", "javascript", "typescript"],


                "architecture": "Microservices",


                "patterns": ["Singleton", "Factory"],


                "complexity": 45.5,


                "files": [


                    {"name": "main.py", "lines": 500, "language": "python"},


                    {"name": "app.js", "lines": 300, "language": "javascript"}


                ]


            },


            "code_quality": {


                "codeQuality": 82,


                "testCoverage": 65,


                "documentation": 30,


                "duplication": 5,


                "maintainability": 78,


                "security_issues": 12


            },


            "securityScore": 85,


            "totalVulnerabilities": 8,


            "criticalIssues": 0,


            "highSeverityIssues": 2,


            "mediumSeverityIssues": 4,


            "lowSeverityIssues": 2,


            "dependencyVulnerabilities": [


                {"title": "CVE-2024-1234", "severity": "high", "package": "requests", "id": "CVE-2024-1234"}


            ],


            "totalHours": 120,


            "level": "medium",


            "estimatedCost": 15000.00,


            "priority": "high",


            "codeSmells": {


                "long_methods": [{"file": "main.py", "line": 50}],


                "duplicate_code": [{"file": "utils.py", "line": 20}]


            },


            "overallScore": 65,


            "uptime": 86400,


            "systemMetrics": {


                "cpu": {


                    "current": 45.5,


                    "average": 42.0,


                    "status": "healthy"


                },


                "memory": {


                    "current": 60.0,


                    "available_gb": 8.0,


                    "used_gb": 12.0,


                    "status": "warning"


                }


            },


            "recommendations": [


                {


                    "priority": "high",


                    "type": "security",


                    "message": "Update dependencies to fix vulnerabilities",


                    "action": "Run: pip install --upgrade requests"


                },


                {


                    "priority": "medium",


                    "type": "quality",


                    "message": "Increase test coverage",


                    "action": "Add unit tests for critical functions"


                }


            ]


        }


    def test_generator_initialization(self, generator):


        """Test generator initializes with correct versions"""


        assert generator.export_version == "1.0"


        assert generator.schema_version == "1.0"


    def test_export_to_json_with_all_parameters(self, generator, sample_analysis_results, tmp_path):


        """Test export with all parameters"""


        output_path = tmp_path / "test_export.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path),


            include_schema = True,


            indent = 2,


            sections = None,


            pretty = True


        )


        assert result_data is not None


        assert Path(result_data).exists()


        # Verify file content


        with open(result_data, 'r', encoding='utf-8') as f:


            data_item = json.load(f)


        assert "metadata" in data_item


        assert "schema" in data_item


        assert "data_item" in data_item


        assert data_item["metadata"]["project_name"] == "Test Project"


        assert data_item["metadata"]["project_id"] == 123


    def test_export_to_json_without_schema(self, generator, sample_analysis_results, tmp_path):


        """Test export without embedded schema"""


        output_path = tmp_path / "test_no_schema.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path),


            include_schema = False


        )


        assert result_data is not None


        with open(result_data, 'r', encoding='utf-8') as f:


            data_item = json.load(f)


        assert "metadata" in data_item


        assert "schema" not in data_item


        assert "data_item" in data_item


    def test_export_to_json_with_section_filtering(self, generator, sample_analysis_results, tmp_path):


        """Test export with specific sections only"""


        output_path = tmp_path / "test_filtered.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path),


            sections=["code_structure", "security"]


        )


        assert result_data is not None


        with open(result_data, 'r', encoding='utf-8') as f:


            data_item = json.load(f)


        assert "code_structure" in data_item["data_item"]


        assert "security" in data_item["data_item"]


        assert "code_quality" not in data_item["data_item"]


        assert "technical_debt" not in data_item["data_item"]


    def test_export_to_json_with_custom_indent(self, generator, sample_analysis_results, tmp_path):


        """Test export with custom indent"""


        output_path = tmp_path / "test_indent.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path),


            indent = 4


        )


        assert result_data is not None


        # Read file and check indentation


        with open(result_data, 'r', encoding='utf-8') as f:


            content = f.read()


        # Should have 4-space indentation


        assert "    " in content


    def test_export_to_json_compact_mode(self, generator, sample_analysis_results, tmp_path):


        """Test export in compact mode (no pretty printing)"""


        output_path = tmp_path / "test_compact.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path),


            pretty = False


        )


        assert result_data is not None


        # Read file and check it's compact


        with open(result_data, 'r', encoding='utf-8') as f:


            content = f.read()


        # Should not have newlines and indentation


        assert "\n" not in content or content.count("\n") < 5


    def test_build_metadata(self, generator):


        """Test metadata building"""


        metadata = generator._build_metadata("Test Project", 123)


        assert metadata["project_name"] == "Test Project"


        assert metadata["project_id"] == 123


        assert metadata["export_version"] == "1.0"


        assert metadata["schema_version"] == "1.0"


        assert "generated_at" in metadata


        assert "Z" in metadata["generated_at"]  # UTC indicator


    def test_build_json_schema(self, generator):


        """Test JSON schema generation"""


        schema = generator._build_json_schema()


        assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"


        assert schema["$id"] == "https://api.example.com/schemas/analysis-export.json"


        assert "metadata" in schema["properties"]


        assert "data_item" in schema["properties"]


        assert schema["type"] == "object"


        assert "metadata" in schema["required"]


        assert "data_item" in schema["required"]


    def test_schema_has_descriptions_and_examples(self, generator):


        """Test schema includes descriptions and examples"""


        schema = generator._build_json_schema()


        # Check metadata has descriptions


        assert schema["properties"]["metadata"]["description"]


        # Check a field has description and example


        project_name = schema["properties"]["metadata"]["properties"]["project_name"]


        assert project_name["description"]


        assert project_name["example"]


        # Check validation rules


        assert project_name["minLength"] == 1


    def test_schema_validation_rules(self, generator):


        """Test schema has proper validation rules"""


        schema = generator._build_json_schema()


        # Check numeric constraints


        total_files = schema["properties"]["data_item"]["properties"]["code_structure"]["properties"]["total_files"]


        assert total_files["type"] == "integer"


        assert total_files["minimum"] == 0


        # Check enum constraints


        severity = schema["properties"]["data_item"]["properties"]["security"]["properties"]["dependency_vulnerabilities"]["items"]["properties"]["severity"]


        assert "enum" in severity


        assert "critical" in severity["enum"]


    def test_build_data_section_all_sections(self, generator, sample_analysis_results):


        """Test data_item section building with all sections"""


        data_item = generator._build_data_section(sample_analysis_results)


        assert "code_structure" in data_item


        assert "code_quality" in data_item


        assert "security" in data_item


        assert "technical_debt" in data_item


        assert "performance" in data_item


        assert "recommendations" in data_item


    def test_build_data_section_filtered(self, generator, sample_analysis_results):


        """Test data_item section building with section filtering"""


        data_item = generator._build_data_section(sample_analysis_results, ["code_structure", "security"])


        assert "code_structure" in data_item


        assert "security" in data_item


        assert "code_quality" not in data_item


        assert "technical_debt" not in data_item


    def test_build_data_section_missing_optional_sections(self, generator):


        """Test data_item section building when optional sections are missing"""


        incomplete_results = {


            "securityScore": 85,


            "totalVulnerabilities": 8


        }


        data_item = generator._build_data_section(incomplete_results)


        assert "security" in data_item


        assert "code_structure" not in data_item


        assert "code_quality" not in data_item


    def test_export_creates_directory_if_not_exists(self, generator, sample_analysis_results, tmp_path):


        """Test export creates output directory if it doesn't exist"""


        output_path = tmp_path / "subdir" / "nested" / "test.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path)


        )


        assert result_data is not None


        assert Path(result_data).exists()


        assert Path(result_data).parent.exists()


    def test_export_returns_none_on_error(self, generator, tmp_path):


        """Test export returns None on error"""


        # Use invalid output path (e.g., permission denied simulation)


        output_path = "/root/protected/test.json"  # Likely to fail


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results={},


            output_path = output_path


        )


        # Should return None on error


        assert result_data is None


    def test_json_output_is_valid_utf8(self, generator, sample_analysis_results, tmp_path):


        """Test exported JSON is valid UTF-8"""


        output_path = tmp_path / "test_utf8.json"


        result_data = generator.export_analysis_to_json(


            project_name="Test Project",


            project_id = 123,


            analysis_results = sample_analysis_results,


            output_path = str(output_path)


        )


        assert result_data is not None


        # Try to read as UTF-8


        with open(result_data, 'r', encoding='utf-8') as f:


            data_item = json.load(f)


        assert data_item is not None


class TestJSONExportIntegration:


    """Integration tests for JSON export with report_export router"""


    @pytest.fixture


    def mock_db(self):


        """Mock database session"""


        return Mock()


    @pytest.fixture


    def mock_user(self):


        """Mock user object"""


        user = Mock()


        user.id = 1


        user.email = "test@example.com"


        return user


    def test_export_request_model_validation(self):


        """Test ExportRequest model accepts new parameters"""


        from routers.report_export import ExportRequest


        # Test with all parameters


        request = ExportRequest(


            project_id = 123,


            project_name="Test Project",


            include_schema = True,


            indent = 4,


            sections=["code_structure", "security"],


            pretty = True


        )


        assert request.project_id == 123


        assert request.include_schema == True


        assert request.indent == 4


        assert request.sections == ["code_structure", "security"]


        assert request.pretty == True


    def test_export_request_model_defaults(self):


        """Test ExportRequest model has correct defaults"""


        # Test with minimal parameters


        request = ExportRequest(


            project_id = 123,


            project_name="Test Project"


        )


        assert request.include_schema == True


        assert request.indent == 2


        assert request.sections is None


        assert request.pretty == True


    def test_json_export_response_model(self):


        """Test JSONExportResponse model accepts new fields"""


        from routers.report_export import JSONExportResponse


        response = JSONExportResponse(


            file_path="/reports/test.json",


            message="Export successful",


            export_id="json_abc123",


            status="completed",


            schema_included = True


        )


        assert response.file_path == "/reports/test.json"


        assert response.export_id == "json_abc123"


        assert response.status == "completed"


        assert response.schema_included == True


if __name__ == "__main__":


    pytest.main([__file__, "-v"])


