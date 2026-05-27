#!/usr/bin/env python3
"""
Roadmap Alert System

Automated monitoring and alerting for roadmap deadlines, progress, and risks.
Integrates with the dashboard alert system for comprehensive monitoring.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from enhanced_database import get_enhanced_db
from enhanced_models import RoadmapDB, MilestoneDB, RoadmapRiskDB
import logging
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RoadmapAlertMonitor:
    """Monitor roadmaps for deadline and progress alerts"""
    
    def __init__(self):
        self.alert_thresholds = {
            "deadline_warning_days": 7,
            "deadline_critical_days": 3,
            "progress_warning_threshold": 80,
            "progress_critical_threshold": 60,
            "high_risk_threshold": 3
        }
    
    def check_all_roadmaps(self, db: Session):
        """Check all active roadmaps for alerts"""
        alerts = []
        
        roadmaps = db.query(RoadmapDB).filter(RoadmapDB.status == "active").all()
        
        for roadmap in roadmaps:
            roadmap_alerts = self.check_roadmap(roadmap, db)
            alerts.extend(roadmap_alerts)
        
        return alerts
    
    def check_roadmap(self, roadmap: RoadmapDB, db: Session) -> list:
        """Check a single roadmap for alerts"""
        alerts = []
        
        # Check progress alerts
        progress_alerts = self.check_progress_alerts(roadmap)
        alerts.extend(progress_alerts)
        
        # Check deadline alerts
        deadline_alerts = self.check_deadline_alerts(roadmap, db)
        alerts.extend(deadline_alerts)
        
        # Check risk alerts
        risk_alerts = self.check_risk_alerts(roadmap, db)
        alerts.extend(risk_alerts)
        
        return alerts
    
    def check_progress_alerts(self, roadmap: RoadmapDB) -> list:
        """Check if roadmap progress is behind schedule"""
        alerts = []
        
        if roadmap.status != "active":
            return alerts
        
        expected_progress = self._calculate_expected_progress(roadmap)
        actual_progress = roadmap.progress_percentage
        
        if actual_progress < self.alert_thresholds["progress_critical_threshold"]:
            alerts.append({
                "type": "progress_critical",
                "severity": "critical",
                "roadmap_id": roadmap.id,
                "quarter": roadmap.quarter,
                "message": f"{roadmap.quarter} {roadmap.year} progress critically behind schedule: {actual_progress}% vs expected {expected_progress:.1f}%",
                "recommendation": "Immediate intervention required. Consider reallocating resources or adjusting scope."
            })
        elif actual_progress < self.alert_thresholds["progress_warning_threshold"]:
            alerts.append({
                "type": "progress_warning",
                "severity": "warning",
                "roadmap_id": roadmap.id,
                "quarter": roadmap.quarter,
                "message": f"{roadmap.quarter} {roadmap.year} progress behind schedule: {actual_progress}% vs expected {expected_progress:.1f}%",
                "recommendation": "Review milestone progress and consider acceleration strategies."
            })
        
        return alerts
    
    def check_deadline_alerts(self, roadmap: RoadmapDB, db: Session) -> list:
        """Check for upcoming milestone deadlines"""
        alerts = []
        
        milestones = db.query(MilestoneDB).filter(
            MilestoneDB.roadmap_id == roadmap.id,
            MilestoneDB.status.in_(["planned", "in_progress"])
        ).all()
        
        for milestone in milestones:
            days_until_deadline = (milestone.target_date - datetime.utcnow()).days
            
            if days_until_deadline <= self.alert_thresholds["deadline_critical_days"]:
                alerts.append({
                    "type": "deadline_critical",
                    "severity": "critical",
                    "roadmap_id": roadmap.id,
                    "milestone_id": milestone.id,
                    "milestone_name": milestone.name,
                    "days_until_deadline": days_until_deadline,
                    "target_date": milestone.target_date.isoformat(),
                    "message": f"Critical: Milestone '{milestone.name}' deadline in {days_until_deadline} days",
                    "recommendation": "Immediate action required. Assess completion status and resource needs."
                })
            elif days_until_deadline <= self.alert_thresholds["deadline_warning_days"]:
                alerts.append({
                    "type": "deadline_warning",
                    "severity": "warning",
                    "roadmap_id": roadmap.id,
                    "milestone_id": milestone.id,
                    "milestone_name": milestone.name,
                    "days_until_deadline": days_until_deadline,
                    "target_date": milestone.target_date.isoformat(),
                    "message": f"Warning: Milestone '{milestone.name}' deadline in {days_until_deadline} days",
                    "recommendation": "Review progress and ensure adequate resources for completion."
                })
        
        return alerts
    
    def check_risk_alerts(self, roadmap: RoadmapDB, db: Session) -> list:
        """Check for high-priority risks"""
        alerts = []
        
        risks = db.query(RoadmapRiskDB).filter(
            RoadmapRiskDB.roadmap_id == roadmap.id,
            RoadmapRiskDB.status.in_(["open", "mitigating"])
        ).all()
        
        high_risks = [r for r in risks if r.priority == "high"]
        
        if len(high_risks) >= self.alert_thresholds["high_risk_threshold"]:
            alerts.append({
                "type": "high_risk_count",
                "severity": "warning",
                "roadmap_id": roadmap.id,
                "quarter": roadmap.quarter,
                "high_risk_count": len(high_risks),
                "message": f"{len(high_risks)} high-priority risks in {roadmap.quarter} {roadmap.year}",
                "recommendation": "Prioritize risk mitigation and assign dedicated resources."
            })
        
        # Check for overdue risk resolutions
        overdue_risks = [r for r in risks if r.target_resolution_date and r.target_resolution_date < datetime.utcnow()]
        if overdue_risks:
            alerts.append({
                "type": "overdue_risks",
                "severity": "warning",
                "roadmap_id": roadmap.id,
                "quarter": roadmap.quarter,
                "overdue_count": len(overdue_risks),
                "message": f"{len(overdue_risks)} risks have passed their target resolution date",
                "recommendation": "Review overdue risks and update mitigation strategies."
            })
        
        return alerts
    
    def _calculate_expected_progress(self, roadmap: RoadmapDB) -> float:
        """Calculate expected progress based on timeline"""
        if roadmap.status != "active":
            return 0
        
        total_days = (roadmap.end_date - roadmap.start_date).days
        elapsed_days = (datetime.utcnow() - roadmap.start_date).days
        
        if total_days <= 0:
            return 0
        
        return min(100, (elapsed_days / total_days) * 100)

def run_roadmap_alert_check():
    """Run roadmap alert check and return results"""
    try:
        db_gen = get_enhanced_db()
        db = next(db_gen)
        
        try:
            monitor = RoadmapAlertMonitor()
            alerts = monitor.check_all_roadmaps(db)
            
            logger.info(f"Roadmap alert check completed. Found {len(alerts)} alerts.")
            
            for alert in alerts:
                logger.info(f"Alert: {alert['type']} - {alert['message']}")
            
            return alerts
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error running roadmap alert check: {e}")
        return []

def get_roadmap_alert_summary(db: Session) -> dict:
    """Get summary of current roadmap alerts"""
    monitor = RoadmapAlertMonitor()
    alerts = monitor.check_all_roadmaps(db)
    
    summary = {
        "total_alerts": len(alerts),
        "by_severity": {
            "critical": len([a for a in alerts if a["severity"] == "critical"]),
            "warning": len([a for a in alerts if a["severity"] == "warning"]),
            "info": len([a for a in alerts if a["severity"] == "info"])
        },
        "by_type": {},
        "recent_alerts": alerts[:10]  # Most recent 10 alerts
    }
    
    # Group by type
    for alert in alerts:
        alert_type = alert["type"]
        if alert_type not in summary["by_type"]:
            summary["by_type"][alert_type] = 0
        summary["by_type"][alert_type] += 1
    
    return summary

if __name__ == "__main__":
    # Run alert check
    alerts = run_roadmap_alert_check()
    
    if alerts:
        print(f"\n🚨 Found {len(alerts)} roadmap alerts:")
        for alert in alerts:
            severity_icon = "🔴" if alert["severity"] == "critical" else "🟡"
            print(f"{severity_icon} {alert['type']}: {alert['message']}")
    else:
        print("\n✅ No roadmap alerts detected.")