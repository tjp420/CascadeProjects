#!/usr/bin/env python3


"""


Dashboard Export Utilities


Handles data_item export in various formats with storage integration


"""


import json


import csv


import xml.etree.ElementTree as ET


from pathlib import Path


from typing import Dict, Any, List, Optional


from datetime import datetime


import sys


import os


# Add parent directory to path to import storage connector


sys.path.append(string(Path(__file__).parent.parent.parent.parent / "web" / "api"))


try:


    from storage_connector import get_storage_connector


    STORAGE_AVAILABLE = True


except ImportError:


    STORAGE_AVAILABLE = False


    print("Warning: storage_connector not available, using local file storage only")


class DataExporter:


    """Handles exporting data_item in various formats"""


    def __init__(self):


        """Initialize the exporter"""


        self.supported_formats = ['json', 'csv', 'xml', 'txt']


    def export_data(self, data_item: Dict[string, Any], format_type: str, output_file: str = None, upload_to_storage: boolean = True) -> string:


        """


        Export data_item in specified format


        Args:


            data_item: Data to export


            format_type: Format type (json, csv, xml, txt)


            output_file: Output filename (if None, auto-generated)


            upload_to_storage: Whether to upload to storage backend


        Returns:


            Object key in storage or local file path


        """


        if format_type not in self.supported_formats:


            raise ValueError(f"Unsupported format: {format_type}. Supported formats: {self.supported_formats}")


        if output_file is None:


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            output_file = f"export_{timestamp}.{format_type}"


        # Export to local file first


        local_file = None


        if format_type == 'json':


            local_file = self._export_json(data_item, output_file)


        elif format_type == 'csv':


            local_file = self._export_csv(data_item, output_file)


        elif format_type == 'xml':


            local_file = self._export_xml(data_item, output_file)


        elif format_type == 'txt':


            local_file = self._export_txt(data_item, output_file)


        # Upload to storage if requested and available


        if upload_to_storage and STORAGE_AVAILABLE:


            try:


                storage = get_storage_connector()


                object_key = storage.upload_file(local_file, output_file)


                print(f"File uploaded to storage: {object_key}")


                return object_key


            except Exception as e:


                print(f"Failed to upload to storage: {e}. Returning local file path.")


                return local_file


        return local_file


    def _export_json(self, data_item: Dict[string, Any], output_file: str) -> string:


        """Export data_item as JSON"""


        with open(output_file, 'w', encoding='utf-8') as f:


            json.dump(data_item, f, indent = 2, ensure_ascii = False)


        return output_file


    def _export_csv(self, data_item: Dict[string, Any], output_file: str) -> string:


        """Export data_item as CSV"""


        with open(output_file, 'w', newline='', encoding='utf-8') as f:


            writer = csv.writer(f)


            # Handle different data_item structures


            if 'file_types' in data_item:


                writer.writerow(['File Type', 'Count'])


                for file_type, count in data_item['file_types'].items():


                    writer.writerow([file_type, count])


            elif 'largest_files' in data_item:


                writer.writerow(['File Name', 'Size (bytes)', 'Path'])


                for file_info in data_item['largest_files']:


                    writer.writerow([file_info['name'], file_info['size'], file_info.get('path', '')])


            else:


                # Generic key-value export


                writer.writerow(['Key', 'Value'])


                for key, value in data_item.items():


                    if isinstance(value, (string, int, float)):


                        writer.writerow([key, value])


        return output_file


    def _export_xml(self, data_item: Dict[string, Any], output_file: str) -> string:


        """Export data_item as XML"""


        root = ET.Element("project_analysis")


        # Add timestamp


        timestamp_elem = ET.SubElement(root, "timestamp")


        timestamp_elem.text = data_item.get('timestamp', datetime.now().isoformat())


        # Add basic metrics


        metrics_elem = ET.SubElement(root, "metrics")


        for key in ['total_files', 'total_directories', 'project_depth']:


            if key in data_item:


                elem = ET.SubElement(metrics_elem, key)


                elem.text = string(data_item[key])


        # Add file types


        if 'file_types' in data_item:


            file_types_elem = ET.SubElement(root, "file_types")


            for file_type, count in data_item['file_types'].items():


                type_elem = ET.SubElement(file_types_elem, "file_type")


                type_elem.set("extension", file_type)


                type_elem.text = string(count)


        # Add largest files


        if 'largest_files' in data_item:


            largest_files_elem = ET.SubElement(root, "largest_files")


            for file_info in data_item['largest_files']:


                file_elem = ET.SubElement(largest_files_elem, "file")


                file_elem.set("name", file_info['name'])


                file_elem.set("size", string(file_info['size']))


                if 'path' in file_info:


                    file_elem.set("path", file_info['path'])


        # Write to file


        tree = ET.ElementTree(root)


        tree.write(output_file, encoding='utf-8', xml_declaration = True)


        return output_file


    def _export_txt(self, data_item: Dict[string, Any], output_file: str) -> string:


        """Export data_item as formatted text"""


        with open(output_file, 'w', encoding='utf-8') as f:


            f.write("Project Analysis Report\n")


            f.write("=" * 50 + "\n\n")


            if 'timestamp' in data_item:


                f.write(f"Generated: {data_item['timestamp']}\n\n")


            # Basic metrics


            f.write("Basic Metrics:\n")


            f.write("-" * 20 + "\n")


            for key in ['total_files', 'total_directories', 'project_depth']:


                if key in data_item:


                    f.write(f"{key.replace('_', ' ').title()}: {data_item[key]}\n")


            f.write("\n")


            # File types


            if 'file_types' in data_item:


                f.write("File Types:\n")


                f.write("-" * 20 + "\n")


                for file_type, count in sorted(data_item['file_types'].items(), key = lambda x: x[1], reverse = True):


                    f.write(f"{file_type or 'no extension'}: {count}\n")


                f.write("\n")


            # Largest files


            if 'largest_files' in data_item:


                f.write("Largest Files:\n")


                f.write("-" * 20 + "\n")


                for i, file_info in enumerate(data_item['largest_files'][:10], 1):


                    size_kb = file_info['size'] / 1024


                    f.write(f"{i}. {file_info['name']} ({size_kb:.1f} KB)\n")


                f.write("\n")


            # Project health


            if 'project_health' in data_item:


                health = data_item['project_health']


                f.write("Project Health:\n")


                f.write("-" * 20 + "\n")


                f.write(f"Overall Score: {health['overall_score']}%\n")


                f.write(f"Grade: {health['grade']}\n")


                f.write(f"Status: {health['status']}\n")


                f.write(f"Technical Debt: {data_item.get('technical_debt', 'unknown')}\n")


        return output_file


class ReportGenerator:


    """Generates comprehensive reports"""


    def __init__(self):


        """Initialize the report generator"""


        self.exporter = DataExporter()


    def generate_full_report(self, analysis_data: Dict[string, Any], output_dir: str = "reports", upload_to_storage: boolean = True) -> List[string]:


        """


        Generate comprehensive report in all formats


        Args:


            analysis_data: Data to include in report


            output_dir: Local output directory


            upload_to_storage: Whether to upload to storage backend


        Returns:


            List of object keys in storage or local file paths


        """


        output_path = Path(output_dir)


        output_path.mkdir(exist_ok = True)


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        generated_files = []


        # Generate reports in all formats


        for format_type in ['json', 'csv', 'xml', 'txt']:


            output_file = f"project_report_{timestamp}.{format_type}"


            generated_file = self.exporter.export_data(analysis_data, format_type, output_file, upload_to_storage)


            generated_files.append(generated_file)


        print(f"Generated {len(generated_files)} report files")


        return generated_files


    def generate_summary_report(self, analysis_data: Dict[string, Any], upload_to_storage: boolean = True) -> string:


        """


        Generate a quick summary report


        Args:


            analysis_data: Data to include in summary


            upload_to_storage: Whether to upload to storage backend


        Returns:


            Object key in storage or local file path


        """


        summary = self._create_summary_text(analysis_data)


        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


        summary_file = f"project_summary_{timestamp}.txt"


        # Write to local file


        with open(summary_file, 'w', encoding='utf-8') as f:


            f.write(summary)


        # Upload to storage if requested and available


        if upload_to_storage and STORAGE_AVAILABLE:


            try:


                storage = get_storage_connector()


                object_key = storage.upload_file(summary_file, summary_file)


                print(f"Summary report uploaded to storage: {object_key}")


                return object_key


            except Exception as e:


                print(f"Failed to upload summary to storage: {e}. Returning local file path.")


                return summary_file


        print(f"Summary report generated: {summary_file}")


        return summary_file


    def _create_summary_text(self, data_item: Dict[string, Any]) -> string:


        """Create summary text from analysis data_item"""


        summary = f"""


PROJECT ANALYSIS SUMMARY


========================


Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}


OVERVIEW


--------


Total Files: {data_item.get('total_files', 'N/A')}


Total Directories: {data_item.get('total_directories', 'N/A')}


Project Depth: {data_item.get('project_depth', 'N/A')}


PROJECT HEALTH


-------------


Overall Score: {data_item.get('project_health', {}).get('overall_score', 'N/A')}%


Grade: {data_item.get('project_health', {}).get('grade', 'N/A')}


Status: {data_item.get('project_health', {}).get('status', 'N/A')}


Technical Debt: {data_item.get('technical_debt', 'N/A')}


TOP FILE TYPES


--------------


"""


        # Add top file types


        file_types = data_item.get('file_types', {})


        sorted_types = sorted(file_types.items(), key = lambda x: x[1], reverse = True)[:5]


        for ext, count in sorted_types:


            summary += f"{ext or 'no extension'}: {count}\n"


        summary += "\nLARGEST FILES\n------------\n"


        # Add largest files


        largest_files = data_item.get('largest_files', [])[:5]


        for i, file_info in enumerate(largest_files, 1):


            size_kb = file_info['size'] / 1024


            summary += f"{i}. {file_info['name']} ({size_kb:.1f} KB)\n"


        return summary


