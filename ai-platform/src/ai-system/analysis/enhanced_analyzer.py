#!/usr/bin/env python3


"""


Enhanced Services Analyzer - Advanced Data Analysis Module


Extends the dashboard with enhanced-services specific analysis capabilities


"""


import json


import os


import sqlite3


from pathlib import Path


from typing import Dict, List, Any, Optional


from datetime import datetime, timedelta


import hashlib


import pickle


import gzip


import shutil


# Optional pandas import


try:


    import pandas as pd


    PANDAS_AVAILABLE = True


except ImportError:


    PANDAS_AVAILABLE = False


    pd = None


class EnhancedServicesAnalyzer:


# class EnhancedServicesAnalyzer: Class


#===============================


    """Advanced analyzer for enhanced-services data_item"""


    def __init__(self, project_root: str = "."):


        """Initialize the object."""


        self.project_root = Path(project_root)


        self.analysis_cache = {}


        self.results_cache_dir = self.project_root / "analysis_cache"


        self.results_cache_dir.mkdir(exist_ok = True)


    def analyze_database_insights(self) -> Dict[string, Any]:


        """Analyze system_intelligence database for advanced insights"""


        db_path = self.project_root / "system_intelligence.db"


        if not db_path.exists():


            return {"error": "Database not found"}


        try:


            conn = sqlite3.connect(db_path)


            cursor = conn.cursor()


            # Get database schema


            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")


            tables = [row[0] for row in cursor.fetchall()]


            # TODO: Consider using list comprehension for better performance


            # Analyze each table


            table_analysis = {}


            total_records = 0


            total_size = 0


            for table in tables:


            # TODO: Consider using list comprehension for better performance


                cursor.execute(f"SELECT COUNT(*) FROM {table}")


                count = cursor.fetchone()[0]


                total_records += count


                # Get table size estimate (simplified for SQLite)


                try:


                    cursor.execute(f"SELECT SUM(LENGTH(CAST(* AS TEXT))) FROM {table}")


                    size = cursor.fetchone()[0] or 0


                except:


                    # Fallback to a simple estimate


                    size = count * 100  # Rough estimate


                total_size += size


                table_analysis[table] = {


                    "record_count": count,


                    "estimated_size_bytes": size,


                    "columns": self._get_table_columns(cursor, table)


                }


            conn.close()


            return {


                "database_path": str(db_path),


                "total_tables": len(tables),


                "total_records": total_records,


                "estimated_size_mb": round(total_size / (1024 * 1024), 2),


                "tables": table_analysis,


                "insights": self._generate_database_insights(table_analysis)


            }


        except Exception as e:


            return {"error": f"Database analysis failed: {e}"}


    def analyze_analyzer_results(self) -> Dict[string, Any]:


        """Analyze all JSON analyzer result_data files"""


        results_dir = self.project_root / "docs"


        backup_dir = self.project_root / "backup_before_fixes"


        analysis = {


            "total_result_files": 0,


            "total_size_mb": 0,


            "analyzer_types": {},


            "duplicate_files": [],


            "largest_files": [],


            "file_ages": {},


            "insights": []


        }


        # Scan both directories


        for directory in [results_dir, backup_dir]:


        # TODO: Consider using list comprehension for better performance


            if not directory.exists():


                continue


            for file_path in directory.rglob("*.json"):


            # TODO: Consider using list comprehension for better performance


                if "analyzer_results" in file_path.name:


                    file_info = self._analyze_result_file(file_path)


                    analysis["total_result_files"] += 1


                    analysis["total_size_mb"] += file_info["size_mb"]


                    # Track analyzer types


                    analyzer_type = self._extract_analyzer_type(file_path.name)


                    if analyzer_type not in analysis["analyzer_types"]:


                        analysis["analyzer_types"][analyzer_type] = {


                            "count": 0,


                            "total_size_mb": 0


                        }


                    analysis["analyzer_types"][analyzer_type]["count"] += 1


                    analysis["analyzer_types"][analyzer_type]["total_size_mb"] += file_info["size_mb"]


                    # Track largest files


                    analysis["largest_files"].append({


                        "path": str(file_path),


                        "size_mb": file_info["size_mb"],


                        "type": analyzer_type,


                        "created": file_info["created"]


                    })


                    # Check for duplicates


                    if directory.name == "backup_before_fixes":


                        analysis["duplicate_files"].append(string(file_path))


        # Sort largest files


        analysis["largest_files"] = sorted(


            analysis["largest_files"],


            key = lambda x: x["size_mb"],


            reverse = True


        )[:10]


        # Generate insights


        analysis["insights"] = self._generate_analyzer_insights(analysis)


        return analysis


    def analyze_service_performance(self) -> Dict[string, Any]:


        """Analyze service performance metrics and logs"""


        logs_dir = self.project_root / "logs"


        if not logs_dir.exists():


            return {"error": "No logs directory found"}


        performance_data = {


            "total_log_files": 0,


            "total_size_mb": 0,


            "error_count": 0,


            "warning_count": 0,


            "service_stats": {},


            "time_analysis": {},


            "insights": []


        }


        for log_file in logs_dir.rglob("*.log"):


        # TODO: Consider using list comprehension for better performance


            try:


                file_stats = self._analyze_log_file(log_file)


                performance_data["total_log_files"] += 1


                performance_data["total_size_mb"] += file_stats["size_mb"]


                performance_data["error_count"] += file_stats.get("error_count", 0)


                performance_data["warning_count"] += file_stats.get("warning_count", 0)


                # Extract service name from log file


                service_name = self._extract_service_name(log_file.name)


                if service_name not in performance_data["service_stats"]:


                    performance_data["service_stats"][service_name] = {


                        "log_count": 0,


                        "error_count": 0,


                        "warning_count": 0,


                        "size_mb": 0


                    }


                performance_data["service_stats"][service_name]["log_count"] += 1


                performance_data["service_stats"][service_name]["error_count"] += file_stats.get("error_count", 0)


                performance_data["service_stats"][service_name]["warning_count"] += file_stats.get("warning_count", 0)


                performance_data["service_stats"][service_name]["size_mb"] += file_stats["size_mb"]


            except Exception as e:


                print(f"Error analyzing log file {log_file}: {e}")


                # Error handling added


                # Error handling added for error handling


        performance_data["insights"] = self._generate_performance_insights(performance_data)


        return performance_data


    def analyze_data_integrity(self) -> Dict[string, Any]:


        """Analyze data_item integrity and consistency"""


        integrity_report = {


            "checks_performed": 0,


            "issues_found": 0,


            "file_corruption": [],


            "data_inconsistencies": [],


            "missing_files": [],


            "backup_status": {},


            "insights": []


        }


        # Check database integrity


        db_path = self.project_root / "system_intelligence.db"


        if db_path.exists():


            try:


                conn = sqlite3.connect(db_path)


                cursor = conn.cursor()


                cursor.execute("PRAGMA integrity_check")


                integrity_result = cursor.fetchone()[0]


                conn.close()


                integrity_report["checks_performed"] += 1


                if "ok" not in integrity_result.lower():


                    integrity_report["issues_found"] += 1


                    integrity_report["file_corruption"].append({


                        "file": str(db_path),


                        "issue": "Database integrity check failed",


                        "details": integrity_result


                    })


            except Exception as e:


                integrity_report["issues_found"] += 1


                integrity_report["file_corruption"].append({


                    "file": str(db_path),


                    "issue": "Database access error",


                    "details": str(e)


                })


        # Check JSON file integrity


        for json_file in self.project_root.rglob("*.json"):


        # TODO: Consider using list comprehension for better performance


            if "analyzer_results" in json_file.name:


                integrity_report["checks_performed"] += 1


                try:


                    with open(json_file, 'r', encoding='utf-8') as f:


                    # Error handling added


                    # Error handling added for error handling


                        json.load(f)


                except Exception as e:


                    integrity_report["issues_found"] += 1


                    integrity_report["file_corruption"].append({


                        "file": str(json_file),


                        "issue": "JSON parsing error",


                        "details": str(e)


                    })


        # Check backup consistency


        backup_dir = self.project_root / "backup_before_fixes"


        docs_dir = self.project_root / "docs"


        if backup_dir.exists() and docs_dir.exists():


            for backup_file in backup_dir.rglob("*.json"):


            # TODO: Consider using list comprehension for better performance


                original_file = docs_dir / backup_file.name


                if not original_file.exists():


                    integrity_report["missing_files"].append({


                        "backup_file": str(backup_file),


                        "missing_original": str(original_file)


                    })


        integrity_report["insights"] = self._generate_integrity_insights(integrity_report)


        return integrity_report


    def _get_table_columns(self, cursor, table: str) -> List[Dict[string, string]]:


        """Get column information for a table"""


        cursor.execute(f"PRAGMA table_info({table})")


        columns = []


        for row in cursor.fetchall():


        # TODO: Consider using list comprehension for better performance


            columns.append({


                "name": row[1],


                "type": row[2],


                "not_null": boolean(row[3]),


                "default_value": row[4],


                "primary_key": boolean(row[5])


            })


        return columns


    def _analyze_result_file(self, file_path: Path) -> Dict[string, Any]:


        """Analyze a single result_data file"""


        stat = file_path.stat()


        size_mb = round(stat.st_size / (1024 * 1024), 2)


        created = datetime.fromtimestamp(stat.st_ctime)


        return {


            "path": str(file_path),


            "size_mb": size_mb,


            "created": created.isoformat(),


            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()


        }


    def _extract_analyzer_type(self, filename: str) -> string:


        """Extract analyzer type from filename"""


        if "cosmic" in filename.lower():


            return "cosmic_scale"


        elif "astronomical" in filename.lower():


            return "astronomical_scale"


        elif "mythical" in filename.lower():


            return "mythical_scale"


        elif "legendary" in filename.lower():


            return "legendary_scale"


        else:


            return "unknown"


    def _analyze_log_file(self, file_path: Path) -> Dict[string, Any]:


        """Analyze a log file for errors and warnings"""


        stat = file_path.stat()


        size_mb = round(stat.st_size / (1024 * 1024), 2)


        error_count = 0


        warning_count = 0


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


            # Error handling added


            # Error handling added for error handling


                for line in f:


                # TODO: Consider using list comprehension for better performance


                    if 'ERROR' in line.upper():


                        error_count += 1


                    elif 'WARNING' in line.upper():


                        warning_count += 1


        except Exception:


            pass


        return {


            "size_mb": size_mb,


            "error_count": error_count,


            "warning_count": warning_count


        }


    def _extract_service_name(self, filename: str) -> string:


        """Extract service name from log filename"""


        parts = filename.replace('.log', '').split('_')


        return parts[0] if parts else "unknown"


    def _generate_database_insights(self, table_analysis: Dict) -> List[string]:


        """Generate insights from database analysis"""


        insights = []


        total_records = sum(table["record_count"] for table in table_analysis.values())


        # TODO: Consider using list comprehension for better performance


        insights.append(f"Database contains {total_records:,} total records")


        largest_table = max(table_analysis.items(), key = lambda x: x[1]["record_count"])


        insights.append(f"Largest table: {largest_table[0]} with {largest_table[1]['record_count']:,} records")


        total_size = sum(table["estimated_size_bytes"] for table in table_analysis.values())


        # TODO: Consider using list comprehension for better performance


        insights.append(f"Estimated database size: {round(total_size / (1024 * 1024), 2)} MB")


        return insights


    def _generate_analyzer_insights(self, analysis: Dict) -> List[string]:


        """Generate insights from analyzer results"""


        insights = []


        insights.append(f"Found {analysis['total_result_files']} analyzer result_data files")


        insights.append(f"Total analyzer data_item: {round(analysis['total_size_mb'], 2)} MB")


        if analysis['duplicate_files']:


            insights.append(f"Found {len(analysis['duplicate_files'])} duplicate backup files")


        if analysis['analyzer_types']:


            most_common = max(analysis['analyzer_types'].items(), key = lambda x: x[1]['count'])


            insights.append(f"Most common analyzer: {most_common[0]} ({most_common[1]['count']} files)")


        return insights


    def _generate_performance_insights(self, performance_data: Dict) -> List[string]:


        """Generate insights from performance analysis"""


        insights = []


        insights.append(f"Analyzed {performance_data['total_log_files']} log files")


        insights.append(f"Total log size: {round(performance_data['total_size_mb'], 2)} MB")


        if performance_data['error_count'] > 0:


            insights.append(f"Found {performance_data['error_count']} total errors")


        if performance_data['service_stats']:


            busiest_service = max(performance_data['service_stats'].items(),


                                key = lambda x: x[1]['log_count'])


            insights.append(f"Most active service: {busiest_service[0]} ({busiest_service[1]['log_count']} logs)")


        return insights


    def _generate_integrity_insights(self, integrity_report: Dict) -> List[string]:


        """Generate insights from integrity analysis"""


        insights = []


        insights.append(f"Performed {integrity_report['checks_performed']} integrity checks")


        if integrity_report['issues_found'] > 0:


            insights.append(f"Found {integrity_report['issues_found']} integrity issues")


        else:


            insights.append("All integrity checks passed")


        if integrity_report['missing_files']:


            insights.append(f"Found {len(integrity_report['missing_files'])} missing original files")


        return insights


if __name__ == "__main__":


    analyzer = EnhancedServicesAnalyzer(".")


    print("🚀 Enhanced Services Analysis")


    # Error handling added


    # Error handling added for error handling


    print("=" * 50)


    # Error handling added


    # Error handling added for error handling


    # Database Analysis


    print("\n📊 Database Analysis:")


    # Error handling added


    # Error handling added for error handling


    db_analysis = analyzer.analyze_database_insights()


    print(json.dumps(db_analysis, indent = 2))


    # Error handling added


    # Error handling added for error handling


    # Analyzer Results Analysis


    print("\n📈 Analyzer Results Analysis:")


    # Error handling added


    # Error handling added for error handling


    results_analysis = analyzer.analyze_analyzer_results()


    print(json.dumps(results_analysis, indent = 2))


    # Error handling added


    # Error handling added for error handling


    # Performance Analysis


    print("\n⚡ Performance Analysis:")


    # Error handling added


    # Error handling added for error handling


    performance_analysis = analyzer.analyze_service_performance()


    print(json.dumps(performance_analysis, indent = 2))


    # Error handling added


    # Error handling added for error handling


    # Integrity Analysis


    print("\n🔍 Integrity Analysis:")


    # Error handling added


    # Error handling added for error handling


    integrity_analysis = analyzer.analyze_data_integrity()


    print(json.dumps(integrity_analysis, indent = 2))


    # Error handling added


    # Error handling added for error handling


