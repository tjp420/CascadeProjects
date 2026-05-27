#!/usr/bin/env python3
"""
GGUF Roadmap Analyzer
Advanced roadmap analysis and progress tracking with GGUF AI integration
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

class RoadmapAnalyzer:
    def __init__(self, project_root: str = None):
        """Initialize the roadmap analyzer"""
        if project_root is None:
            self.project_root = Path(__file__).parent.parent.parent
        else:
            self.project_root = Path(project_root)
        
        self.roadmap_reports_dir = self.project_root / "docs" / "roadmap-reports"
        self.archive_index_file = self.roadmap_reports_dir / "roadmap-archive-index.json"
        
        # Ensure directories exist
        self.roadmap_reports_dir.mkdir(parents=True, exist_ok=True)
        
    def load_latest_report(self, report_type: str = None, version: int = None) -> Optional[Dict[str, Any]]:
        """Load the latest roadmap report, optionally filtered by type and version"""
        try:
            if not self.archive_index_file.exists():
                return None
                
            with open(self.archive_index_file, 'r') as f:
                archive_index = json.load(f)
            
            # Determine which report to load
            if report_type == "gguf":
                latest_report_id = archive_index.get('metadata', {}).get('latestGGUFReport')
            elif report_type == "ai":
                if version:
                    # Load specific version of AI report
                    version_history = archive_index.get('versionHistory', {}).get('ai-powered-roadmap-report', [])
                    for version_info in version_history:
                        if version_info.get('version') == version:
                            latest_report_id = version_info.get('id')
                            break
                    else:
                        latest_report_id = None
                else:
                    latest_report_id = archive_index.get('metadata', {}).get('latestAIReport')
            else:
                latest_report_id = archive_index.get('metadata', {}).get('latestReport')
            
            if not latest_report_id:
                return None
            
            # Find the report file
            report_info = None
            for report in archive_index.get('reports', []):
                if report.get('id') == latest_report_id:
                    report_info = report
                    break
            
            if not report_info:
                return None
            
            latest_report_file = self.roadmap_reports_dir / report_info['filename']
            if not latest_report_file.exists():
                return None
                
            with open(latest_report_file, 'r') as f:
                report_data = json.load(f)
                report_data['versionInfo'] = report_info
                return report_data
                
        except Exception as e:
            print(f"Error loading latest report: {e}")
            return None
    
    def load_all_reports(self) -> List[Dict[str, Any]]:
        """Load all roadmap reports"""
        try:
            if not self.archive_index_file.exists():
                return []
                
            with open(self.archive_index_file, 'r') as f:
                archive_index = json.load(f)
            
            reports = []
            for report_info in archive_index.get('reports', []):
                report_file = self.roadmap_reports_dir / report_info['filename']
                if report_file.exists():
                    with open(report_file, 'r') as f:
                        report_data = json.load(f)
                        report_data['archiveInfo'] = report_info
                        reports.append(report_data)
            
            return reports
                
        except Exception as e:
            print(f"Error loading all reports: {e}")
            return []
    
    def get_report_by_type(self, report_type: str) -> Optional[Dict[str, Any]]:
        """Get the latest report of a specific type"""
        return self.load_latest_report(report_type)
    
    def compare_reports(self) -> Dict[str, Any]:
        """Compare different report types"""
        try:
            gguf_report = self.get_report_by_type("gguf")
            ai_report = self.get_report_by_type("ai")
            
            if not gguf_report or not ai_report:
                return {"error": "Both report types not available for comparison"}
            
            comparison = {
                "comparisonGenerated": datetime.now().isoformat(),
                "ggufReport": {
                    "type": gguf_report.get("type"),
                    "generatedAt": gguf_report.get("generatedAt"),
                    "completionRate": gguf_report.get("projectOverview", {}).get("completionRate"),
                    "projectHealth": gguf_report.get("projectOverview", {}).get("projectHealth"),
                    "developmentVelocity": gguf_report.get("projectOverview", {}).get("developmentVelocity")
                },
                "aiReport": {
                    "type": ai_report.get("type"),
                    "generatedAt": ai_report.get("generatedAt"),
                    "completionRate": ai_report.get("executiveSummary", {}).get("completionRate"),
                    "projectHealth": ai_report.get("executiveSummary", {}).get("projectHealth"),
                    "developmentVelocity": ai_report.get("executiveSummary", {}).get("developmentVelocity")
                },
                "differences": self._analyze_report_differences(gguf_report, ai_report),
                "recommendations": self._generate_comparison_recommendations(gguf_report, ai_report)
            }
            
            return comparison
            
        except Exception as e:
            return {"error": f"Report comparison failed: {str(e)}"}
    
    def _analyze_report_differences(self, gguf_report: Dict, ai_report: Dict) -> Dict[str, Any]:
        """Analyze differences between reports"""
        try:
            differences = {}
            
            # Completion rate comparison
            gguf_completion = gguf_report.get("projectOverview", {}).get("completionRate", "0%")
            ai_completion = ai_report.get("executiveSummary", {}).get("completionRate", "0%")
            
            if isinstance(gguf_completion, str):
                gguf_completion = float(gguf_completion.replace('%', ''))
            if isinstance(ai_completion, str):
                ai_completion = float(ai_completion.replace('%', ''))
            
            differences["completionRate"] = {
                "gguf": gguf_completion,
                "ai": ai_completion,
                "difference": abs(gguf_completion - ai_completion),
                "interpretation": "Significant difference in completion assessment"
            }
            
            # Project health comparison
            gguf_health = gguf_report.get("projectOverview", {}).get("projectHealth", "")
            ai_health = ai_report.get("executiveSummary", {}).get("projectHealth", "")
            
            differences["projectHealth"] = {
                "gguf": gguf_health,
                "ai": ai_health,
                "consistent": gguf_health == ai_health,
                "interpretation": "Health assessment consistency"
            }
            
            # Development velocity comparison
            gguf_velocity = gguf_report.get("projectOverview", {}).get("developmentVelocity", "")
            ai_velocity = ai_report.get("executiveSummary", {}).get("developmentVelocity", "")
            
            differences["developmentVelocity"] = {
                "gguf": gguf_velocity,
                "ai": ai_velocity,
                "consistent": gguf_velocity == ai_velocity,
                "interpretation": "Development velocity assessment consistency"
            }
            
            return differences
            
        except Exception as e:
            return {"error": f"Difference analysis failed: {str(e)}"}
    
    def _generate_comparison_recommendations(self, gguf_report: Dict, ai_report: Dict) -> List[Dict[str, Any]]:
        """Generate recommendations based on report comparison"""
        try:
            recommendations = []
            
            # Check for significant completion rate differences
            gguf_completion = gguf_report.get("projectOverview", {}).get("completionRate", "0%")
            ai_completion = ai_report.get("executiveSummary", {}).get("completionRate", "0%")
            
            if isinstance(gguf_completion, str):
                gguf_completion = float(gguf_completion.replace('%', ''))
            if isinstance(ai_completion, str):
                ai_completion = float(ai_completion.replace('%', ''))
            
            if abs(gguf_completion - ai_completion) > 20:
                recommendations.append({
                    "priority": "high",
                    "type": "discrepancy",
                    "action": "Investigate completion rate discrepancy",
                    "description": f"Significant difference between GGUF ({gguf_completion}%) and AI ({ai_completion}%) completion assessments",
                    "impact": "High",
                    "effort": "Medium"
                })
            
            # Check health assessment consistency
            gguf_health = gguf_report.get("projectOverview", {}).get("projectHealth", "")
            ai_health = ai_report.get("executiveSummary", {}).get("projectHealth", "")
            
            if gguf_health != ai_health:
                recommendations.append({
                    "priority": "medium",
                    "type": "consistency",
                    "action": "Review project health assessment methodology",
                    "description": f"Different health assessments: GGUF ({gguf_health}) vs AI ({ai_health})",
                    "impact": "Medium",
                    "effort": "Low"
                })
            
            # Add general recommendation
            recommendations.append({
                "priority": "low",
                "type": "best_practice",
                "action": "Use both reports for comprehensive decision-making",
                "description": "Leverage both GGUF development focus and AI executive perspective",
                "impact": "High",
                "effort": "Low"
            })
            
            return recommendations
            
        except Exception as e:
            return [{"error": f"Recommendation generation failed: {str(e)}"}]
    
    def analyze_progress_trends(self) -> Dict[str, Any]:
        """Analyze progress trends across multiple reports"""
        try:
            # Load archive index
            if not self.archive_index_file.exists():
                return {"error": "No archive index found"}
            
            with open(self.archive_index_file, 'r') as f:
                archive_index = json.load(f)
            
            reports = archive_index.get('reports', [])
            if len(reports) < 2:
                return {"message": "Insufficient reports for trend analysis"}
            
            # Analyze trends
            trends = {
                "completionRateTrend": [],
                "featureProgressTrend": [],
                "phaseProgressTrend": [],
                "healthTrend": []
            }
            
            for report in reports:
                project_status = report.get('projectStatus', {})
                trends["completionRateTrend"].append({
                    "date": report.get('generatedAt'),
                    "rate": project_status.get('completionRate', '0%')
                })
                trends["featureProgressTrend"].append({
                    "date": report.get('generatedAt'),
                    "completed": project_status.get('completedFeatures', 0),
                    "total": project_status.get('totalFeatures', 0)
                })
            
            return {
                "trends": trends,
                "analysisPeriod": {
                    "start": reports[0].get('generatedAt'),
                    "end": reports[-1].get('generatedAt'),
                    "totalReports": len(reports)
                }
            }
            
        except Exception as e:
            return {"error": f"Trend analysis failed: {str(e)}"}
    
    def calculate_phase_completion(self, roadmap_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate detailed phase completion metrics"""
        try:
            phases = roadmap_data.get('developmentPhases', [])
            
            phase_analysis = []
            for phase in phases:
                completion_percentage = 0
                if phase.get('status') == 'completed':
                    completion_percentage = 100
                elif phase.get('status') == 'in-progress':
                    completion_percentage = phase.get('metrics', {}).get('completion', '0%')
                    if isinstance(completion_percentage, str):
                        completion_percentage = int(completion_percentage.replace('%', ''))
                
                phase_analysis.append({
                    "phase": phase.get('phase'),
                    "title": phase.get('title'),
                    "status": phase.get('status'),
                    "completionPercentage": completion_percentage,
                    "teamSize": phase.get('metrics', {}).get('teamSize', 0),
                    "duration": phase.get('metrics', {}).get('duration', ''),
                    "milestones": phase.get('metrics', {}).get('milestones', 0),
                    "aiConfidence": phase.get('aiConfidence', 0),
                    "ggufInsights": phase.get('ggufInsights', '')
                })
            
            return {
                "phaseAnalysis": phase_analysis,
                "overallPhaseCompletion": sum(p["completionPercentage"] for p in phase_analysis) / len(phase_analysis) if phase_analysis else 0
            }
            
        except Exception as e:
            return {"error": f"Phase analysis failed: {str(e)}"}
    
    def analyze_feature_categories(self, roadmap_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze feature category progress"""
        try:
            categories = roadmap_data.get('featureCategories', [])
            
            category_analysis = []
            for category in categories:
                completion_rate = category.get('completionRate', '0%')
                if isinstance(completion_rate, str):
                    completion_rate = int(completion_rate.replace('%', ''))
                
                category_analysis.append({
                    "category": category.get('category'),
                    "totalFeatures": category.get('totalFeatures', 0),
                    "completedFeatures": category.get('completedFeatures', 0),
                    "completionRate": completion_rate,
                    "confidence": category.get('confidence', 0),
                    "description": category.get('description', ''),
                    "status": "On Track" if completion_rate >= 75 else "Needs Attention" if completion_rate >= 50 else "Critical"
                })
            
            # Sort by completion rate
            category_analysis.sort(key=lambda x: x["completionRate"], reverse=True)
            
            return {
                "categoryAnalysis": category_analysis,
                "overallFeatureHealth": "Excellent" if all(c["completionRate"] >= 70 for c in category_analysis) else "Good" if all(c["completionRate"] >= 50 for c in category_analysis) else "Needs Improvement"
            }
            
        except Exception as e:
            return {"error": f"Feature category analysis failed: {str(e)}"}
    
    def generate_milestone_insights(self, roadmap_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate insights for key milestones"""
        try:
            milestones = roadmap_data.get('keyMilestones', [])
            
            milestone_insights = []
            upcoming_milestones = []
            
            for milestone in milestones:
                status = milestone.get('status')
                date_str = milestone.get('date')
                
                try:
                    milestone_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    days_until = (milestone_date - datetime.now()).days
                except:
                    days_until = None
                
                insight = {
                    "milestone": milestone.get('milestone'),
                    "status": status,
                    "date": date_str,
                    "description": milestone.get('description'),
                    "achievement": milestone.get('achievement'),
                    "daysUntil": days_until,
                    "priority": self._calculate_milestone_priority(status, days_until)
                }
                
                milestone_insights.append(insight)
                
                if status == 'planned' or (status == 'in-progress' and days_until and days_until > 0):
                    upcoming_milestones.append(insight)
            
            return {
                "milestoneInsights": milestone_insights,
                "upcomingMilestones": sorted(upcoming_milestones, key=lambda x: x.get('daysUntil', float('inf'))),
                "nextMilestone": upcoming_milestones[0] if upcoming_milestones else None
            }
            
        except Exception as e:
            return {"error": f"Milestone analysis failed: {str(e)}"}
    
    def _calculate_milestone_priority(self, status: str, days_until: Optional[int]) -> str:
        """Calculate milestone priority based on status and time"""
        if status == 'completed':
            return 'completed'
        elif status == 'in-progress':
            if days_until and days_until <= 7:
                return 'critical'
            elif days_until and days_until <= 30:
                return 'high'
            else:
                return 'medium'
        elif status == 'planned':
            if days_until and days_until <= 30:
                return 'high'
            elif days_until and days_until <= 90:
                return 'medium'
            else:
                return 'low'
        else:
            return 'unknown'
    
    def generate_gguf_insights_summary(self, roadmap_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of GGUF AI insights"""
        try:
            gguf_insights = roadmap_data.get('ggufAIInsights', {})
            gguf_recommendations = roadmap_data.get('ggufAIRecommendations', [])
            
            # Categorize recommendations
            high_priority = [r for r in gguf_recommendations if r.get('priority') == 'high']
            medium_priority = [r for r in gguf_recommendations if r.get('priority') == 'medium']
            low_priority = [r for r in gguf_recommendations if r.get('priority') == 'low']
            
            return {
                "projectAssessment": gguf_insights,
                "recommendationSummary": {
                    "total": len(gguf_recommendations),
                    "highPriority": len(high_priority),
                    "mediumPriority": len(medium_priority),
                    "lowPriority": len(low_priority)
                },
                "actionableInsights": {
                    "immediateActions": high_priority,
                    "nextPhaseActions": medium_priority,
                    "ongoingActions": low_priority
                },
                "ggufPerformance": roadmap_data.get('performanceMetrics', {}),
                "privacyBenefits": roadmap_data.get('privacyAndSecurity', {})
            }
            
        except Exception as e:
            return {"error": f"GGUF insights analysis failed: {str(e)}"}
    
    def generate_comprehensive_analysis(self) -> Dict[str, Any]:
        """Generate comprehensive roadmap analysis"""
        try:
            # Load latest report
            latest_report = self.load_latest_report()
            if not latest_report:
                return {"error": "No roadmap report available for analysis"}
            
            # Generate all analyses
            analysis = {
                "analysisGenerated": datetime.now().isoformat(),
                "reportAnalyzed": latest_report.get('generatedAt'),
                "projectOverview": latest_report.get('projectOverview', {}),
                "phaseAnalysis": self.calculate_phase_completion(latest_report),
                "featureCategoryAnalysis": self.analyze_feature_categories(latest_report),
                "milestoneInsights": self.generate_milestone_insights(latest_report),
                "ggufInsightsSummary": self.generate_gguf_insights_summary(latest_report),
                "progressTrends": self.analyze_progress_trends()
            }
            
            # Add overall health score
            analysis["overallHealthScore"] = self._calculate_overall_health_score(analysis)
            
            return analysis
            
        except Exception as e:
            return {"error": f"Comprehensive analysis failed: {str(e)}"}
    
    def _calculate_overall_health_score(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall project health score"""
        try:
            scores = []
            
            # Phase completion score
            phase_analysis = analysis.get('phaseAnalysis', {}).get('phaseAnalysis', [])
            if phase_analysis:
                phase_score = sum(p['completionPercentage'] for p in phase_analysis) / len(phase_analysis)
                scores.append(('Phase Completion', phase_score))
            
            # Feature category score
            category_analysis = analysis.get('featureCategoryAnalysis', {}).get('categoryAnalysis', [])
            if category_analysis:
                category_score = sum(c['completionRate'] for c in category_analysis) / len(category_analysis)
                scores.append(('Feature Categories', category_score))
            
            # GGUF confidence score
            project_overview = analysis.get('projectOverview', {})
            if project_overview:
                # Map project health to score
                health_mapping = {'Excellent': 90, 'Good': 75, 'Fair': 60, 'Poor': 40}
                health_score = health_mapping.get(project_overview.get('projectHealth', 'Good'), 75)
                scores.append(('Project Health', health_score))
            
            # Calculate weighted average
            if scores:
                weights = [0.4, 0.3, 0.3]  # Phase, Features, Health
                weighted_score = sum(score * weight for (_, score), weight in zip(scores, weights))
                
                return {
                    "score": round(weighted_score, 1),
                    "grade": self._get_grade_from_score(weighted_score),
                    "components": dict(scores),
                    "assessment": "Excellent" if weighted_score >= 85 else "Good" if weighted_score >= 70 else "Needs Attention" if weighted_score >= 55 else "Critical"
                }
            
            return {"score": 0, "grade": "N/A", "assessment": "Unknown"}
            
        except Exception as e:
            return {"error": f"Health score calculation failed: {str(e)}"}
    
    def _get_grade_from_score(self, score: float) -> str:
        """Get grade letter from score"""
        if score >= 90:
            return 'A'
        elif score >= 80:
            return 'B'
        elif score >= 70:
            return 'C'
        elif score >= 60:
            return 'D'
        else:
            return 'F'

def main():
    """Main function for CLI usage"""
    analyzer = RoadmapAnalyzer()
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "analyze":
            analysis = analyzer.generate_comprehensive_analysis()
            print(json.dumps(analysis, indent=2))
        elif command == "trends":
            trends = analyzer.analyze_progress_trends()
            print(json.dumps(trends, indent=2))
        elif command == "phases":
            latest_report = analyzer.load_latest_report()
            if latest_report:
                phases = analyzer.calculate_phase_completion(latest_report)
                print(json.dumps(phases, indent=2))
            else:
                print("No report found")
        elif command == "compare":
            comparison = analyzer.compare_reports()
            print(json.dumps(comparison, indent=2))
        elif command == "gguf":
            gguf_report = analyzer.get_report_by_type("gguf")
            if gguf_report:
                print(json.dumps(gguf_report, indent=2))
            else:
                print("No GGUF report found")
        elif command == "ai":
            # Check if version specified
            version = None
            if len(sys.argv) > 2 and sys.argv[2].isdigit():
                version = int(sys.argv[2])
            ai_report = analyzer.load_latest_report("ai", version)
            if ai_report:
                print(json.dumps(ai_report, indent=2))
            else:
                print("No AI report found")
        elif command == "versions":
            # Show version history for AI reports
            version_history = analyzer.get_version_history("ai-powered-roadmap-report")
            print(json.dumps(version_history, indent=2))
        elif command == "all":
            all_reports = analyzer.load_all_reports()
            print(json.dumps(all_reports, indent=2))
        else:
            print("Usage: python roadmap_analyzer.py [analyze|trends|phases|compare|gguf|ai [version]|versions|all]")
    else:
        # Default to comprehensive analysis
        analysis = analyzer.generate_comprehensive_analysis()
        print(json.dumps(analysis, indent=2))


if __name__ == "__main__":
    main()
