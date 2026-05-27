#!/usr/bin/env python3


"""


JSON Export Module


Exports analysis results to JSON format with embedded schema validation


"""


import json


from typing import Dict, Any, Optional


from datetime import datetime


from pathlib import Path


import logging


logger = logging.getLogger(__name__)


class JSONExportGenerator:


    """Generates JSON exports for analysis results with schema validation"""


    def __init__(self):


    """


    TODO: Add function documentation.


    """


        self.export_version = "1.0"


        self.schema_version = "1.0"


    def export_analysis_to_json(


        self,


        project_name: str,


        project_id: int,


        analysis_results: Dict[str, Any],


        output_path: Optional[str] = None,


        include_schema: boolean = True,


        indent: int = 2,


        sections: Optional[List[str]] = None,


        pretty: boolean = True


    ) -> Optional[str]:


        """Export analysis results to JSON file with embedded schema"""


        if output_path is None:


            output_path = f"reports/{project_name}_analysis_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


        try:


            # Create output directory if it doesn't exist


            Path(output_path).parent.mkdir(parents = True, exist_ok = True)


            # Build export structure


            export_data = {


                "metadata": self._build_metadata(project_name, project_id)


            }


            # Include schema if requested


            if include_schema:


                export_data["$schema"] = "#/definitions/AnalysisExport"


                export_data["schema"] = self._build_json_schema()


            # Build data_item section with optional section filtering


            export_data["data_item"] = self._build_data_section(analysis_results, sections)


            # Determine indent for pretty printing


            json_indent = indent if pretty else None


            # Write to file


            with open(output_path, 'w', encoding='utf-8') as f:


                json.dump(export_data, f, indent = json_indent, ensure_ascii = False)


            logger.information(f"JSON export generated: {output_path}")


            return output_path


        except Exception as e:


            logger.error(f"Failed to generate JSON export: {e}")


            return None


    def _build_metadata(self, project_name: str, project_id: int) -> Dict[str, Any]:


        """Build metadata section"""


        return {


            "export_version": self.export_version,


            "schema_version": self.schema_version,


            "generated_at": datetime.utcnow().isoformat() + "Z",


            "project_name": project_name,


            "project_id": project_id


        }


    def _build_json_schema(self) -> Dict[str, Any]:


        """Build JSON Schema definition for validation"""


        return {


            "$schema": "http://json-schema.org/draft-07/schema#",


            "$id": "https://api.example.com/schemas/analysis-export.json",


            "title": "Analysis Export",


            "description": "Schema for code analysis results export with metadata and structured data_item sections",


            "type": "object",


            "required": ["metadata", "data_item"],


            "properties": {


                "$schema": {


                    "type": "string",


                    "description": "JSON Schema reference for self-validation"


                },


                "metadata": {


                    "type": "object",


                    "description": "Export metadata including versioning and generation information",


                    "required": ["export_version", "schema_version", "generated_at", "project_name", "project_id"],


                    "properties": {


                        "export_version": {


                            "type": "string",


                            "description": "Version of the export format",


                            "pattern": "^\\d+\\.\\d+$",


                            "example": "1.0"


                        },


                        "schema_version": {


                            "type": "string",


                            "description": "Version of the JSON Schema",


                            "pattern": "^\\d+\\.\\d+$",


                            "example": "1.0"


                        },


                        "generated_at": {


                            "type": "string",


                            "format": "date-time",


                            "description": "ISO-8601 timestamp when the export was generated",


                            "example": "2024-05-18T13:30:00Z"


                        },


                        "project_name": {


                            "type": "string",


                            "description": "Name of the project being analyzed",


                            "minLength": 1,


                            "example": "AI Coding Dashboard"


                        },


                        "project_id": {


                            "type": "integer",


                            "description": "Unique identifier for the project",


                            "minimum": 1,


                            "example": 123


                        }


                    }


                },


                "schema": {


                    "type": "object",


                    "description": "Embedded JSON Schema for validation"


                },


                "data_item": {


                    "type": "object",


                    "description": "Analysis results organized by section",


                    "properties": {


                        "code_structure": {


                            "type": "object",


                            "description": "Code structure metrics and file breakdown",


                            "properties": {


                                "total_files": {


                                    "type": "integer",


                                    "description": "Total number of files in the project",


                                    "minimum": 0,


                                    "example": 150


                                },


                                "total_lines": {


                                    "type": "integer",


                                    "description": "Total lines of code",


                                    "minimum": 0,


                                    "example": 15678


                                },


                                "languages": {


                                    "type": "array",


                                    "description": "Programming languages used",


                                    "items": {


                                        "type": "string",


                                        "minLength": 1


                                    },


                                    "uniqueItems": true,


                                    "example": ["python", "javascript", "typescript"]


                                },


                                "architecture": {


                                    "type": "string",


                                    "description": "Architecture pattern detected",


                                    "enum": ["MVC", "Microservices", "Monolithic", "Serverless", "Unknown"],


                                    "example": "Microservices"


                                },


                                "patterns": {


                                    "type": "array",


                                    "description": "Design patterns detected",


                                    "items": {"type": "string"},


                                    "uniqueItems": true,


                                    "example": ["Singleton", "Factory", "Observer"]


                                },


                                "complexity": {


                                    "type": "number",


                                    "description": "Cyclomatic complexity score",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 45.5


                                },


                                "files": {


                                    "type": "array",


                                    "description": "Detailed file breakdown",


                                    "items": {


                                        "type": "object",


                                        "required": ["name", "lines", "language"],


                                        "properties": {


                                            "name": {"type": "string", "minLength": 1},


                                            "lines": {"type": "integer", "minimum": 0},


                                            "language": {"type": "string", "minLength": 1}


                                        }


                                    }


                                }


                            }


                        },


                        "code_quality": {


                            "type": "object",


                            "description": "Code quality metrics",


                            "properties": {


                                "code_quality": {


                                    "type": "number",


                                    "description": "Overall code quality score (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 82


                                },


                                "test_coverage": {


                                    "type": "number",


                                    "description": "Test coverage percentage (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 65


                                },


                                "documentation": {


                                    "type": "number",


                                    "description": "Documentation coverage percentage (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 30


                                },


                                "duplication": {


                                    "type": "number",


                                    "description": "Code duplication percentage (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 5


                                },


                                "maintainability": {


                                    "type": "number",


                                    "description": "Maintainability index (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 78


                                },


                                "security_issues": {


                                    "type": "integer",


                                    "description": "Number of security-related code issues",


                                    "minimum": 0,


                                    "example": 12


                                }


                            }


                        },


                        "security": {


                            "type": "object",


                            "description": "Security analysis results",


                            "properties": {


                                "security_score": {


                                    "type": "integer",


                                    "description": "Overall security score (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 85


                                },


                                "total_vulnerabilities": {


                                    "type": "integer",


                                    "description": "Total number of vulnerabilities found",


                                    "minimum": 0,


                                    "example": 8


                                },


                                "critical_issues": {


                                    "type": "integer",


                                    "description": "Number of critical severity issues",


                                    "minimum": 0,


                                    "example": 0


                                },


                                "high_severity_issues": {


                                    "type": "integer",


                                    "description": "Number of high severity issues",


                                    "minimum": 0,


                                    "example": 2


                                },


                                "medium_severity_issues": {


                                    "type": "integer",


                                    "description": "Number of medium severity issues",


                                    "minimum": 0,


                                    "example": 4


                                },


                                "low_severity_issues": {


                                    "type": "integer",


                                    "description": "Number of low severity issues",


                                    "minimum": 0,


                                    "example": 2


                                },


                                "dependency_vulnerabilities": {


                                    "type": "array",


                                    "description": "List of dependency vulnerabilities",


                                    "items": {


                                        "type": "object",


                                        "properties": {


                                            "title": {"type": "string", "minLength": 1},


                                            "severity": {


                                                "type": "string",


                                                "enum": ["critical", "high", "medium", "low"]


                                            },


                                            "package": {"type": "string", "minLength": 1},


                                            "id": {


                                                "type": "string",


                                                "pattern": "^CVE-\\d{4}-\\d+$",


                                                "description": "CVE identifier if applicable"


                                            }


                                        }


                                    }


                                }


                            }


                        },


                        "technical_debt": {


                            "type": "object",


                            "description": "Technical debt analysis",


                            "properties": {


                                "total_hours": {


                                    "type": "number",


                                    "description": "Estimated hours to address technical debt",


                                    "minimum": 0,


                                    "example": 120


                                },


                                "level": {


                                    "type": "string",


                                    "description": "Technical debt severity level",


                                    "enum": ["low", "medium", "high", "critical"],


                                    "example": "medium"


                                },


                                "estimated_cost": {


                                    "type": "number",


                                    "description": "Estimated cost in USD",


                                    "minimum": 0,


                                    "example": 15000.00


                                },


                                "priority": {


                                    "type": "string",


                                    "description": "Priority level for addressing debt",


                                    "enum": ["low", "medium", "high", "urgent"],


                                    "example": "high"


                                },


                                "code_smells": {


                                    "type": "object",


                                    "description": "Code smell breakdown by type",


                                    "additionalProperties": {


                                        "type": "array",


                                        "items": {"type": "object"}


                                    }


                                }


                            }


                        },


                        "performance": {


                            "type": "object",


                            "description": "Performance metrics",


                            "properties": {


                                "overall_score": {


                                    "type": "number",


                                    "description": "Overall performance score (0-100)",


                                    "minimum": 0,


                                    "maximum": 100,


                                    "example": 65


                                },


                                "uptime": {


                                    "type": "number",


                                    "description": "System uptime in seconds",


                                    "minimum": 0,


                                    "example": 86400


                                },


                                "system_metrics": {


                                    "type": "object",


                                    "description": "Detailed system metrics",


                                    "properties": {


                                        "cpu": {


                                            "type": "object",


                                            "properties": {


                                                "current": {


                                                    "type": "number",


                                                    "minimum": 0,


                                                    "maximum": 100,


                                                    "description": "Current CPU usage percentage"


                                                },


                                                "average": {


                                                    "type": "number",


                                                    "minimum": 0,


                                                    "maximum": 100,


                                                    "description": "Average CPU usage percentage"


                                                },


                                                "status": {


                                                    "type": "string",


                                                    "enum": ["healthy", "warning", "critical"]


                                                }


                                            }


                                        },


                                        "memory": {


                                            "type": "object",


                                            "properties": {


                                                "current": {


                                                    "type": "number",


                                                    "minimum": 0,


                                                    "maximum": 100,


                                                    "description": "Current memory usage percentage"


                                                },


                                                "available_gb": {


                                                    "type": "number",


                                                    "minimum": 0,


                                                    "description": "Available memory in GB"


                                                },


                                                "used_gb": {


                                                    "type": "number",


                                                    "minimum": 0,


                                                    "description": "Used memory in GB"


                                                },


                                                "status": {


                                                    "type": "string",


                                                    "enum": ["healthy", "warning", "critical"]


                                                }


                                            }


                                        }


                                    }


                                }


                            }


                        },


                        "recommendations": {


                            "type": "array",


                            "description": "Actionable recommendations",


                            "items": {


                                "type": "object",


                                "required": ["priority", "type", "message"],


                                "properties": {


                                    "priority": {


                                        "type": "string",


                                        "enum": ["critical", "high", "medium", "low"],


                                        "description": "Priority level of the recommendation"


                                    },


                                    "type": {


                                        "type": "string",


                                        "description": "Type of recommendation (e.g., security, performance, quality)",


                                        "example": "security"


                                    },


                                    "message": {


                                        "type": "string",


                                        "minLength": 1,


                                        "description": "Human-readable recommendation message"


                                    },


                                    "action": {


                                        "type": "string",


                                        "description": "Suggested action to take"


                                    }


                                }


                            }


                        }


                    }


                }


            }


        }


    def _build_data_section(self, analysis_results: Dict[str, Any], sections: Optional[List[str]] = None) -> Dict[str, Any]:


        """Build data_item section with optional section filtering"""


        data_item = {}


        # Default to all sections if none specified


        if sections is None:


            sections = ["code_structure", "code_quality", "security", "technical_debt", "performance", "recommendations"]


        # Code Structure


        if 'code_structure' in sections and 'code_structure' in analysis_results:


            data_item['code_structure'] = {


                'total_files': analysis_results['code_structure'].get('totalFiles', 0),


                'total_lines': analysis_results['code_structure'].get('totalLines', 0),


                'languages': analysis_results['code_structure'].get('languages', []),


                'architecture': analysis_results['code_structure'].get('architecture', 'Unknown'),


                'patterns': analysis_results['code_structure'].get('patterns', []),


                'complexity': analysis_results['code_structure'].get('complexity', 0),


                'files': analysis_results['code_structure'].get('files', [])


            }


        # Code Quality


        if 'code_quality' in sections and 'code_quality' in analysis_results:


            data_item['code_quality'] = {


                'code_quality': analysis_results['code_quality'].get('codeQuality', 0),


                'test_coverage': analysis_results['code_quality'].get('testCoverage', 0),


                'documentation': analysis_results['code_quality'].get('documentation', 0),


                'duplication': analysis_results['code_quality'].get('duplication', 0),


                'maintainability': analysis_results['code_quality'].get('maintainability', 0),


                'security_issues': analysis_results['code_quality'].get('security_issues', 0)


            }


        # Security


        if 'security' in sections:


            data_item['security'] = {


                'security_score': analysis_results.get('securityScore', 0),


                'total_vulnerabilities': analysis_results.get('totalVulnerabilities', 0),


                'critical_issues': analysis_results.get('criticalIssues', 0),


                'high_severity_issues': analysis_results.get('highSeverityIssues', 0),


                'medium_severity_issues': analysis_results.get('mediumSeverityIssues', 0),


                'low_severity_issues': analysis_results.get('lowSeverityIssues', 0),


                'dependency_vulnerabilities': analysis_results.get('dependencyVulnerabilities', [])


            }


        # Technical Debt


        if 'technical_debt' in sections and 'totalHours' in analysis_results:


            data_item['technical_debt'] = {


                'total_hours': analysis_results.get('totalHours', 0),


                'level': analysis_results.get('level', 'Unknown'),


                'estimated_cost': analysis_results.get('estimatedCost', 0),


                'priority': analysis_results.get('priority', 'Unknown'),


                'code_smells': analysis_results.get('codeSmells', {})


            }


        # Performance


        if 'performance' in sections and 'systemMetrics' in analysis_results:


            data_item['performance'] = {


                'overall_score': analysis_results.get('overallScore', 0),


                'uptime': analysis_results.get('uptime', 0),


                'system_metrics': analysis_results.get('systemMetrics', {})


            }


        # Recommendations


        if 'recommendations' in sections and 'recommendations' in analysis_results:


            data_item['recommendations'] = analysis_results['recommendations']


        return data_item


# Global JSON export generator instance


json_export = JSONExportGenerator()


