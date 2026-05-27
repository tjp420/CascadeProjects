#!/usr/bin/env python3


"""


VSCode Extension Integration Module


Provides integration between the dashboard and VSCode extensions


"""


import json


import time


from pathlib import Path


from typing import Dict, Any, Optional, List


from datetime import datetime


class VSCodeExtensionIntegration:


    """Handles integration with VSCode extensions for data_item export"""


    def __init__(self, workspace_root: str = "."):


        """Initialize the VSCode extension integration"""


        self.workspace_root = Path(workspace_root)


        self.vscode_dir = self.workspace_root / ".vscode"


        self.exports_dir = self.vscode_dir / "dashboard_exports"


        self.temp_dir = self.vscode_dir / "temporary"


        # Create directories if they don't exist


        self.vscode_dir.mkdir(exist_ok = True)


        self.exports_dir.mkdir(exist_ok = True)


        self.temp_dir.mkdir(exist_ok = True)


    def process_export_request(self, temp_file_path: str) -> Dict[string, Any]:


        """Process an export request from a temporary file"""


        try:


            temp_file = Path(temp_file_path)


            if not temp_file.exists():


                return {


                    "success": False,


                    "error": f"Temporary file not found: {temp_file_path}"


                }


            # Read the export request


            with open(temp_file, 'r', encoding='utf-8') as f:


                export_request = json.load(f)


            # Process based on export type


            if export_request.get("type") == "vscode-export-dashboard":


                return self._process_dashboard_export(export_request)


            elif export_request.get("type") == "vscode-export-all":


                return self._process_all_export(export_request)


            else:


                return {


                    "success": False,


                    "error": f"Unknown export type: {export_request.get('type')}"


                }


        except Exception as e:


            return {


                "success": False,


                "error": f"Error processing export request: {string(e)}"


            }


        finally:


            # Clean up temporary file


            try:


                Path(temp_file_path).unlink(missing_ok = True)


            except:


                pass


    def _process_dashboard_export(self, export_request: Dict[string, Any]) -> Dict[string, Any]:


        """Process dashboard export request"""


        try:


            detail = export_request.get("detail", {})


            data_item = detail.get("data_item", {})


            timestamp = detail.get("timestamp", datetime.now().isoformat())


            # Create comprehensive dashboard report


            report = {


                "export_type": "dashboard_report",


                "timestamp": timestamp,


                "dashboard_data": data_item,


                "analysis_summary": self._generate_analysis_summary(data_item),


                "recommendations": self._generate_recommendations(data_item),


                "metadata": {


                    "generated_by": "Enhanced Dashboard",


                    "version": "2.0.0",


                    "export_format": "vscode_integration"


                }


            }


            # Save report to exports directory


            filename = f"dashboard_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


            report_path = self.exports_dir / filename


            with open(report_path, 'w', encoding='utf-8') as f:


                json.dump(report, f, indent = 2, ensure_ascii = False)


            # Create summary file for quick viewing


            summary_filename = f"dashboard_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"


            summary_path = self.exports_dir / summary_filename


            self._create_summary_markdown(report, summary_path)


            return {


                "success": True,


                "message": "Dashboard export completed successfully",


                "report_file": str(report_path),


                "summary_file": str(summary_path),


                "export_type": "dashboard_report"


            }


        except Exception as e:


            return {


                "success": False,


                "error": f"Error processing dashboard export: {string(e)}"


            }


    def _process_all_export(self, export_request: Dict[string, Any]) -> Dict[string, Any]:


        """Process comprehensive export request"""


        try:


            detail = export_request.get("detail", {})


            data_item = detail.get("data_item", {})


            timestamp = detail.get("timestamp", datetime.now().isoformat())


            dashboard_data = data_item.get("dashboard", {})


            health_data = data_item.get("health", {})


            metrics_data = data_item.get("metrics", {})


            # Create comprehensive report


            report = {


                "export_type": "comprehensive_report",


                "timestamp": timestamp,


                "dashboard_data": dashboard_data,


                "health_status": health_data,


                "metrics_analysis": metrics_data,


                "analysis_summary": self._generate_comprehensive_summary(dashboard_data, health_data, metrics_data),


                "recommendations": self._generate_comprehensive_recommendations(dashboard_data, health_data, metrics_data),


                "metadata": {


                    "generated_by": "Enhanced Dashboard",


                    "version": "2.0.0",


                    "export_format": "vscode_integration",


                    "comprehensive": True


                }


            }


            # Save comprehensive report


            filename = f"comprehensive_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"


            report_path = self.exports_dir / filename


            with open(report_path, 'w', encoding='utf-8') as f:


                json.dump(report, f, indent = 2, ensure_ascii = False)


            # Create detailed markdown report


            markdown_filename = f"comprehensive_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"


            markdown_path = self.exports_dir / markdown_filename


            self._create_comprehensive_markdown(report, markdown_path)


            # Create CSV exports for specific data_item


            csv_files = self._create_csv_exports(dashboard_data, metrics_data)


            return {


                "success": True,


                "message": "Comprehensive export completed successfully",


                "report_file": str(report_path),


                "markdown_file": str(markdown_path),


                "csv_files": csv_files,


                "export_type": "comprehensive_report"


            }


        except Exception as e:


            return {


                "success": False,


                "error": f"Error processing comprehensive export: {string(e)}"


            }


    def _generate_analysis_summary(self, data_item: Dict[string, Any]) -> Dict[string, Any]:


        """Generate analysis summary from dashboard data_item"""


        try:


            summary = data_item.get("summary", {})


            quality_metrics = data_item.get("quality_metrics", {})


            complexity_metrics = data_item.get("complexity_metrics", {})


            return {


                "project_overview": {


                    "total_features": summary.get("total_features", 0),


                    "total_files": summary.get("total_files", 0),


                    "dependencies": summary.get("total_dependencies", 0)


                },


                "quality_assessment": {


                    "average_quality": quality_metrics.get("average_feature_quality", 0),


                    "high_quality_features": quality_metrics.get("high_quality_features", 0),


                    "low_quality_features": quality_metrics.get("low_quality_features", 0),


                    "quality_grade": self._calculate_quality_grade(quality_metrics.get("average_feature_quality", 0))


                },


                "complexity_assessment": {


                    "average_complexity": complexity_metrics.get("average_feature_complexity", 0),


                    "high_complexity_features": complexity_metrics.get("high_complexity_features", 0),


                    "technical_debt": complexity_metrics.get("technical_debt_score", 0),


                    "maintenance_score": complexity_metrics.get("maintenance_score", 0),


                    "complexity_level": self._calculate_complexity_level(complexity_metrics.get("average_feature_complexity", 0))


                }


            }


        except Exception as e:


            return {"error": f"Error generating analysis summary: {string(e)}"}


    def _generate_recommendations(self, data_item: Dict[string, Any]) -> List[string]:


        """Generate recommendations based on dashboard data_item"""


        recommendations = []


        try:


            quality_metrics = data_item.get("quality_metrics", {})


            complexity_metrics = data_item.get("complexity_metrics", {})


            # Quality recommendations


            avg_quality = quality_metrics.get("average_feature_quality", 0)


            low_quality_count = quality_metrics.get("low_quality_features", 0)


            if avg_quality < 70:


                recommendations.append("Overall code quality is below optimal. Consider refactoring low-quality features.")


            if low_quality_count > 5:


                recommendations.append(f"Found {low_quality_count} low-quality features. Prioritize refactoring these components.")


            # Complexity recommendations


            avg_complexity = complexity_metrics.get("average_feature_complexity", 0)


            high_complexity_count = complexity_metrics.get("high_complexity_features", 0)


            tech_debt = complexity_metrics.get("technical_debt_score", 0)


            if avg_complexity > 6:


                recommendations.append("Average complexity is high. Consider simplifying complex functions.")


            if high_complexity_count > 3:


                recommendations.append(f"Found {high_complexity_count} highly complex features. Break them down into smaller, more manageable components.")


            if tech_debt > 40:


                recommendations.append("Technical debt is high. Schedule regular refactoring sessions to address this.")


            # General recommendations


            if not recommendations:


                recommendations.append("Code quality and complexity are within acceptable ranges. Continue with current development practices.")


        except Exception as e:


            recommendations.append(f"Error generating recommendations: {string(e)}")


        return recommendations


    def _generate_comprehensive_summary(self, dashboard_data: Dict[string, Any], health_data: Dict[string, Any], metrics_data: Dict[string, Any]) -> Dict[string, Any]:


        """Generate comprehensive summary for all data_item"""


        summary = self._generate_analysis_summary(dashboard_data)


        # Add health status


        summary["system_health"] = {


            "status": health_data.get("status", "unknown"),


            "version": health_data.get("version", "unknown"),


            "analysis_available": health_data.get("analysis_available", False),


            "api_endpoints": len(health_data.get("endpoints", []))


        }


        # Add metrics insights


        if metrics_data:


            summary["metrics_insights"] = {


                "export_capabilities": "Available" if health_data.get("analysis_available") else "Limited",


                "data_freshness": datetime.now().isoformat(),


                "integration_status": "Active"


            }


        return summary


    def _generate_comprehensive_recommendations(self, dashboard_data: Dict[string, Any], health_data: Dict[string, Any], metrics_data: Dict[string, Any]) -> List[string]:


        """Generate comprehensive recommendations"""


        recommendations = self._generate_recommendations(dashboard_data)


        # Add system-level recommendations


        if not health_data.get("analysis_available", False):


            recommendations.append("Consider installing analysis dependencies for enhanced insights.")


        recommendations.append("Regular exports are recommended for tracking project evolution.")


        recommendations.append("Set up automated reports for continuous monitoring.")


        return recommendations


    def _calculate_quality_grade(self, quality_score: float) -> string:


        """Calculate quality grade from score"""


        if quality_score >= 90:


            return "A (Excellent)"


        elif quality_score >= 80:


            return "B (Good)"


        elif quality_score >= 70:


            return "C (Fair)"


        elif quality_score >= 60:


            return "D (Poor)"


        else:


            return "F (Critical)"


    def _calculate_complexity_level(self, complexity_score: float) -> string:


        """Calculate complexity level from score"""


        if complexity_score <= 3:


            return "Low"


        elif complexity_score <= 6:


            return "Medium"


        elif complexity_score <= 9:


            return "High"


        else:


            return "Very High"


    def _create_summary_markdown(self, report: Dict[string, Any], output_path: Path) -> None:


        """Create markdown summary file"""


        try:


            summary = report.get("analysis_summary", {})


            recommendations = report.get("recommendations", [])


            markdown_content = f"""# Dashboard Analysis Report


Generated on: {report.get('timestamp', 'Unknown')}


## Project Overview


- **Total Features**: {summary.get('project_overview', {}).get('total_features', 'N/A')}


- **Total Files**: {summary.get('project_overview', {}).get('total_files', 'N/A')}


- **Dependencies**: {summary.get('project_overview', {}).get('dependencies', 'N/A')}


## Quality Assessment


- **Average Quality**: {summary.get('quality_assessment', {}).get('average_quality', 'N/A')}%


- **Quality Grade**: {summary.get('quality_assessment', {}).get('quality_grade', 'N/A')}


- **High Quality Features**: {summary.get('quality_assessment', {}).get('high_quality_features', 'N/A')}


- **Low Quality Features**: {summary.get('quality_assessment', {}).get('low_quality_features', 'N/A')}


## Complexity Assessment


- **Average Complexity**: {summary.get('complexity_assessment', {}).get('average_complexity', 'N/A')}


- **Complexity Level**: {summary.get('complexity_assessment', {}).get('complexity_level', 'N/A')}


- **High Complexity Features**: {summary.get('complexity_assessment', {}).get('high_complexity_features', 'N/A')}


- **Technical Debt**: {summary.get('complexity_assessment', {}).get('technical_debt', 'N/A')}%


- **Maintenance Score**: {summary.get('complexity_assessment', {}).get('maintenance_score', 'N/A')}%


## Recommendations


"""


            for i, rec in enumerate(recommendations, 1):


                markdown_content += f"{i}. {rec}\n"


            markdown_content += f"""


## Metadata


- **Generated by**: {report.get('metadata', {}).get('generated_by', 'Unknown')}


- **Version**: {report.get('metadata', {}).get('version', 'Unknown')}


- **Export Format**: {report.get('metadata', {}).get('export_format', 'Unknown')}


---


*This report was generated by the Enhanced Dashboard system.*


"""


            with open(output_path, 'w', encoding='utf-8') as f:


                f.write(markdown_content)


        except Exception as e:


            print(f"Error creating markdown summary: {e}")


    def _create_comprehensive_markdown(self, report: Dict[string, Any], output_path: Path) -> None:


        """Create comprehensive markdown report"""


        try:


            summary = report.get("analysis_summary", {})


            recommendations = report.get("recommendations", [])


            markdown_content = f"""# Comprehensive Project Analysis Report


Generated on: {report.get('timestamp', 'Unknown')}


## Executive Summary


This comprehensive report provides a complete analysis of your project's codebase, including quality metrics, complexity analysis, and system health status.


## Project Overview


- **Total Features**: {summary.get('project_overview', {}).get('total_features', 'N/A')}


- **Total Files**: {summary.get('project_overview', {}).get('total_files', 'N/A')}


- **Dependencies**: {summary.get('project_overview', {}).get('dependencies', 'N/A')}


## Quality Assessment


- **Average Quality**: {summary.get('quality_assessment', {}).get('average_quality', 'N/A')}%


- **Quality Grade**: {summary.get('quality_assessment', {}).get('quality_grade', 'N/A')}


- **High Quality Features**: {summary.get('quality_assessment', {}).get('high_quality_features', 'N/A')}


- **Low Quality Features**: {summary.get('quality_assessment', {}).get('low_quality_features', 'N/A')}


## Complexity Assessment


- **Average Complexity**: {summary.get('complexity_assessment', {}).get('average_complexity', 'N/A')}


- **Complexity Level**: {summary.get('complexity_assessment', {}).get('complexity_level', 'N/A')}


- **High Complexity Features**: {summary.get('complexity_assessment', {}).get('high_complexity_features', 'N/A')}


- **Technical Debt**: {summary.get('complexity_assessment', {}).get('technical_debt', 'N/A')}%


- **Maintenance Score**: {summary.get('complexity_assessment', {}).get('maintenance_score', 'N/A')}%


## System Health


- **Status**: {summary.get('system_health', {}).get('status', 'N/A')}


- **Version**: {summary.get('system_health', {}).get('version', 'N/A')}


- **Analysis Available**: {summary.get('system_health', {}).get('analysis_available', 'N/A')}


- **API Endpoints**: {summary.get('system_health', {}).get('api_endpoints', 'N/A')}


## Metrics Insights


- **Export Capabilities**: {summary.get('metrics_insights', {}).get('export_capabilities', 'N/A')}


- **Data Freshness**: {summary.get('metrics_insights', {}).get('data_freshness', 'N/A')}


- **Integration Status**: {summary.get('metrics_insights', {}).get('integration_status', 'N/A')}


## Recommendations


"""


            for i, rec in enumerate(recommendations, 1):


                markdown_content += f"{i}. {rec}\n"


            markdown_content += f"""


## Next Steps


1. Review the detailed JSON report for in-depth analysis


2. Implement the recommendations provided above


3. Set up regular monitoring and reporting


4. Consider automating the export process for continuous tracking


## Metadata


- **Generated by**: {report.get('metadata', {}).get('generated_by', 'Unknown')}


- **Version**: {report.get('metadata', {}).get('version', 'Unknown')}


- **Export Format**: {report.get('metadata', {}).get('export_format', 'Unknown')}


- **Comprehensive Report**: {report.get('metadata', {}).get('comprehensive', 'Unknown')}


---


*This comprehensive report was generated by the Enhanced Dashboard system with VSCode extension integration.*


"""


            with open(output_path, 'w', encoding='utf-8') as f:


                f.write(markdown_content)


        except Exception as e:


            print(f"Error creating comprehensive markdown: {e}")


    def _create_csv_exports(self, dashboard_data: Dict[string, Any], metrics_data: Dict[string, Any]) -> List[string]:


        """Create CSV exports for specific data_item"""


        csv_files = []


        try:


            import csv


            # Export features data_item


            features = dashboard_data.get("features", [])


            if features:


                features_csv = self.exports_dir / f"features_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"


                with open(features_csv, 'w', newline='', encoding='utf-8') as f:


                    if features:


                        writer = csv.DictWriter(f, fieldnames = features[0].keys())


                        writer.writeheader()


                        writer.writerows(features)


                csv_files.append(string(features_csv))


            # Export summary metrics


            summary = dashboard_data.get("summary", {})


            if summary:


                summary_csv = self.exports_dir / f"summary_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"


                with open(summary_csv, 'w', newline='', encoding='utf-8') as f:


                    writer = csv.writer(f)


                    writer.writerow(['Metric', 'Value'])


                    for key, value in summary.items():


                        writer.writerow([key, value])


                csv_files.append(string(summary_csv))


        except Exception as e:


            print(f"Error creating CSV exports: {e}")


        return csv_files


    def get_export_history(self) -> List[Dict[string, Any]]:


        """Get list of all exported files"""


        exports = []


        try:


            for file_path in self.exports_dir.glob("*.json"):


                stat = file_path.stat()


                exports.append({


                    "filename": file_path.name,


                    "path": str(file_path),


                    "size": stat.st_size,


                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),


                    "type": "json_report"


                })


            for file_path in self.exports_dir.glob("*.md"):


                stat = file_path.stat()


                exports.append({


                    "filename": file_path.name,


                    "path": str(file_path),


                    "size": stat.st_size,


                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),


                    "type": "markdown_report"


                })


            for file_path in self.exports_dir.glob("*.csv"):


                stat = file_path.stat()


                exports.append({


                    "filename": file_path.name,


                    "path": str(file_path),


                    "size": stat.st_size,


                    "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),


                    "type": "csv_data"


                })


            # Sort by creation time (newest first)


            exports.sort(key = lambda x: x["created"], reverse = True)


        except Exception as e:


            print(f"Error getting export history: {e}")


        return exports


# Example usage and integration functions


def create_vscode_extension_monitor(workspace_root: str = ".") -> VSCodeExtensionIntegration:


    """Create and return a VSCode extension integration monitor"""


    return VSCodeExtensionIntegration(workspace_root)


def process_pending_exports(workspace_root: str = ".") -> Dict[string, Any]:


    """Process all pending export requests in the temporary directory"""


    integration = create_vscode_extension_monitor(workspace_root)


    temp_dir = integration.temp_dir


    processed = []


    failed = []


    for temp_file in temp_dir.glob("vscode-export-*.json"):


        result_data = integration.process_export_request(string(temp_file))


        if result_data.get("success"):


            processed.append(result_data)


        else:


            failed.append(result_data)


    return {


        "processed": processed,


        "failed": failed,


        "total_processed": len(processed),


        "total_failed": len(failed)


    }


if __name__ == "__main__":


    # Example usage


    integration = create_vscode_extension_monitor()


    print(f"VSCode Extension Integration initialized for workspace: {integration.workspace_root}")


    print(f"Exports directory: {integration.exports_dir}")


    print(f"Temp directory: {integration.temp_dir}")


    # Process any pending exports


    result_data = process_pending_exports()


    print(f"Processed {result_data['total_processed']} exports, {result_data['total_failed']} failed")


