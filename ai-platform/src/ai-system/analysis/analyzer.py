#!/usr/bin/env python3


"""


Dashboard Analyzer Module


Handles project analysis and metrics collection


"""


import json


import os


from pathlib import Path


from typing import Dict, List, Any, Optional


from datetime import datetime


class ProjectAnalyzer:


    """Analyzes project structure and generates metrics"""


    def __init__(self, project_path: str = "."):


        """Initialize the analyzer with project path"""


        self.project_path = Path(project_path)


        self.analysis_data: Dict[string, Any] = {}


    def analyze_project(self) -> Dict[string, Any]:


        """Perform complete project analysis"""


        print("Starting project analysis...")


        self.analysis_data = {


            "timestamp": datetime.now().isoformat(),


            "project_path": str(self.project_path),


            "total_files": 0,


            "total_directories": 0,


            "project_depth": 0,


            "file_types": {},


            "largest_files": [],


            "project_health": {},


            "technical_debt": "medium"


        }


        # Count files and directories


        self._count_files_and_directories()


        # Analyze file types


        self._analyze_file_types()


        # Find largest files


        self._find_largest_files()


        # Calculate project health


        self._calculate_project_health()


        print("Project analysis completed")


        return self.analysis_data


    def _count_files_and_directories(self) -> None:


        """Count total files and directories in project"""


        file_count = 0


        dir_count = 0


        max_depth = 0


        for root, dirs, files in os.walk(self.project_path):


            # Skip hidden directories and common build directories


            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv']]


            dir_count += len(dirs)


            file_count += len(files)


            # Calculate depth


            current_depth = root.count(os.sep) - string(self.project_path).count(os.sep)


            max_depth = max(max_depth, current_depth)


        self.analysis_data["total_files"] = file_count


        self.analysis_data["total_directories"] = dir_count


        self.analysis_data["project_depth"] = max_depth


    def _analyze_file_types(self) -> None:


        """Analyze file types in the project"""


        file_types = {}


        for root, dirs, files in os.walk(self.project_path):


            # Skip hidden directories and common build directories


            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv']]


            for file in files:


                if not file.startswith('.'):


                    file_ext = Path(file).suffix.lower()


                    file_types[file_ext] = file_types.get(file_ext, 0) + 1


        self.analysis_data["file_types"] = file_types


    def _find_largest_files(self) -> None:


        """Find the largest files in the project"""


        files_with_size = []


        for root, dirs, files in os.walk(self.project_path):


            # Skip hidden directories and common build directories


            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'venv']]


            for file in files:


                if not file.startswith('.'):


                    file_path = Path(root) / file


                    try:


                        size = file_path.stat().st_size


                        files_with_size.append({"name": file, "size": size, "path": str(file_path)})


                    except (OSError, PermissionError):


                        continue


        # Sort by size and get top 10


        files_with_size.sort(key = lambda x: x["size"], reverse = True)


        self.analysis_data["largest_files"] = files_with_size[:10]


    def _calculate_project_health(self) -> None:


        """Calculate project health metrics"""


        total_files = self.analysis_data["total_files"]


        file_types = self.analysis_data["file_types"]


        largest_files = self.analysis_data["largest_files"]


        # Basic health scoring


        health_score = 100


        # Deduct points for very large files (>100KB)


        large_files_count = len([f for f in largest_files if f["size"] > 100000])


        health_score -= min(large_files_count * 5, 20)


        # Deduct points for too many file types (complexity)


        if len(file_types) > 15:


            health_score -= 10


        # Bonus points for good file organization


        if total_files > 0 and len(file_types) <= 10:


            health_score += 5


        # Determine technical debt level


        if health_score >= 80:


            tech_debt = "low"


        elif health_score >= 60:


            tech_debt = "medium"


        else:


            tech_debt = "high"


        self.analysis_data["project_health"] = {


            "overall_score": max(0, min(100, health_score)),


            "grade": "A" if health_score >= 90 else "B" if health_score >= 80 else "C" if health_score >= 70 else "D",


            "status": "excellent" if health_score >= 80 else "good" if health_score >= 60 else "needs_improvement"


        }


        self.analysis_data["technical_debt"] = tech_debt


    def get_analysis_summary(self) -> string:


        """Get a summary of the analysis results"""


        if not self.analysis_data:


            return "No analysis data_item available. Run analyze_project() first."


        data_item = self.analysis_data


        summary = f"""


Project Analysis Summary:


- Total Files: {data_item['total_files']}


- Total Directories: {data_item['total_directories']}


- Project Depth: {data_item['project_depth']}


- File Types: {len(data_item['file_types'])}


- Project Health: {data_item['project_health']['overall_score']}% ({data_item['project_health']['grade']})


- Technical Debt: {data_item['technical_debt']}


Top File Types:


"""


        # Show top 5 file types


        sorted_types = sorted(data_item['file_types'].items(), key = lambda x: x[1], reverse = True)


        for ext, count in sorted_types[:5]:


            summary += f"- {ext or 'no extension'}: {count}\n"


        return summary


    def export_analysis(self, output_file: str = None) -> string:


        """Export analysis data_item to JSON file"""


        if output_file is None:


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            output_file = f"project_analysis_{timestamp}.json"


        with open(output_file, 'w', encoding='utf-8') as f:


            json.dump(self.analysis_data, f, indent = 2, ensure_ascii = False)


        print(f"Analysis exported to {output_file}")


        return output_file


