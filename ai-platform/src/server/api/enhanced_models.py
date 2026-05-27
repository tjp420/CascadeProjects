#!/usr/bin/env python3
"""
Database Models for AI Coding Intelligence Dashboard

SQLAlchemy models matching mock data structures for real data integration
"""

from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, JSON, Float, Numeric
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

# ============================================================================
# REPORT MODELS
# ============================================================================

class ReportDB(Base):
    """Report data model matching reports.js structure"""
    __tablename__ = "reports"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)
    type = Column(String(50), nullable=False, index=True)  # performance, quality, security, resources
    category = Column(String(50), nullable=False)  # analytics, development, compliance, operations
    last_generated = Column(DateTime, default=datetime.utcnow)
    format = Column(String(20), nullable=False)  # pdf, excel, json
    size = Column(Integer, default=0)  # Size in bytes
    schedule = Column(String(20))  # daily, weekly, monthly
    status = Column(String(20), default='ready')  # ready, processing, failed
    
    # Enhanced fields from v2.0.0
    version = Column(String(20), default='1.0.0')
    validation_status = Column(String(20), default='pending')  # valid, invalid, pending
    template_source = Column(String(100))  # createPerformanceReportTemplate, etc.
    data_version = Column(String(20), default='1.0.0')
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ReportMetadataDB(Base):
    """Report metadata model"""
    __tablename__ = "report_metadata"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), nullable=False, index=True)  # Foreign key to reports
    size = Column(Integer, default=0)
    schedule = Column(String(20))
    last_generated = Column(DateTime)
    version = Column(String(20), default='1.0.0')
    validation_status = Column(String(20), default='pending')
    template_source = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ReportDataDB(Base):
    """Report data content model"""
    __tablename__ = "report_data"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), nullable=False, index=True)
    data_type = Column(String(50))  # summary, metrics, recommendations
    
    # JSON data storage for flexible report content
    content = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================================
# MOCK DATA DATASET MODELS
# ============================================================================

class MockDatasetDB(Base):
    """Mock dataset model matching mock-data.js structure"""
    __tablename__ = "mock_datasets"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    type = Column(String(50))  # Sales, Analytics, Financial, etc.
    size = Column(String(20))  # '2.5GB', '1.8GB', etc.
    records = Column(Integer, default=0)
    columns = Column(Integer, default=0)
    last_generated = Column(DateTime)
    description = Column(Text)
    
    # Enhanced fields
    version = Column(String(20), default='1.0.0')
    validation_status = Column(String(20), default='pending')
    uses_template = Column(Boolean, default=False)
    template_used = Column(String(100))
    
    # JSON storage for schema and tags
    schema = Column(JSON)  # Array of column names
    tags = Column(JSON)  # Array of tags
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MockAnalysisResultDB(Base):
    """Mock analysis results model"""
    __tablename__ = "mock_analysis_results"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), nullable=False, index=True)
    result_type = Column(String(50))  # statistical, behavioral, predictive
    status = Column(String(20), default='completed')
    score = Column(Float)
    insights = Column(Integer, default=0)
    
    # JSON storage for flexible results
    content = Column(JSON)
    metrics = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MockGeneratorDB(Base):
    """Mock generator configuration model"""
    __tablename__ = "mock_generators"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    type = Column(String(50))
    target_records = Column(Integer, default=0)
    status = Column(String(20), default='active')
    
    # JSON storage for configuration
    config = Column(JSON)
    parameters = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================================
# ROADMAP MODELS (Enhanced)
# ============================================================================

class MilestoneDB(Base):
    """Enhanced milestone model with additional fields"""
    __tablename__ = "roadmap_milestones"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    date = Column(DateTime, nullable=False)
    priority = Column(String(10), nullable=False)  # high, medium, low
    status = Column(String(20), nullable=False)  # planned, in-progress, completed, delayed
    team = Column(String(100), nullable=False)
    progress = Column(Integer, default=0)
    
    # JSON fields for flexible data
    dependencies = Column(JSON)  # Array of milestone IDs
    tags = Column(JSON)  # Array of tags
    
    # Enhanced fields
    version = Column(String(20), default='1.0.0')
    validation_status = Column(String(20), default='pending')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TimelineSettingsDB(Base):
    """Enhanced timeline settings model"""
    __tablename__ = "roadmap_settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    view = Column(String(20), default='months')  # months, quarters, years, gantt
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    show_milestones = Column(Boolean, default=True)
    show_dependencies = Column(Boolean, default=False)
    show_progress = Column(Boolean, default=True)
    show_teams = Column(Boolean, default=True)
    theme = Column(String(20), default='default')  # default, dark, light
    auto_save = Column(Boolean, default=True)
    notifications = Column(Boolean, default=True)
    
    # Enhanced fields
    version = Column(String(20), default='1.0.0')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================================
# TEAM DATA MODELS
# ============================================================================

class TeamMemberDB(Base):
    """Team member model matching team.js structure"""
    __tablename__ = "team_members"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    status = Column(String(20), default='active')  # active, inactive, on-leave
    department = Column(String(50))
    
    # Enhanced performance tracking
    join_date = Column(DateTime)
    avatar = Column(String(200))
    permissions = Column(JSON)  # Array of permissions
    last_active = Column(DateTime)
    
    # Performance metrics
    performance_productivity = Column(Integer, default=0)
    performance_quality = Column(Integer, default=0)
    performance_collaboration = Column(Integer, default=0)
    
    # Validation and versioning
    version = Column(String(20), default='1.0.0')
    validation_status = Column(String(20), default='pending')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================================
# SYSTEM METRICS MODELS
# ============================================================================

class SystemMetricDB(Base):
    """System metrics model for real-time monitoring"""
    __tablename__ = "system_metrics"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_type = Column(String(50), nullable=False, index=True)  # cpu, memory, disk, network
    metric_name = Column(String(100), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(20))  # %, MB, GB, Mbps
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Metadata
    source = Column(String(50))  # system, application, external
    status = Column(String(20), default='active')
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================================
# DATA VALIDATION MODELS
# ============================================================================

class DataValidationDB(Base):
    """Data validation tracking model"""
    __tablename__ = "data_validations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    data_source = Column(String(100), nullable=False, index=True)  # reports, team, roadmap
    data_id = Column(String(36), nullable=False, index=True)
    validation_type = Column(String(50))  # schema, quality, completeness
    status = Column(String(20), default='pending')  # valid, invalid, pending
    
    # Validation results
    errors = Column(JSON)  # Array of error messages
    warnings = Column(JSON)  # Array of warnings
    score = Column(Float)  # Validation score 0-100
    
    # Metadata
    validated_at = Column(DateTime, default=datetime.utcnow)
    validator_version = Column(String(20), default='1.0.0')
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================================
# VERSION CONTROL MODELS
# ============================================================================

class DataVersionDB(Base):
    """Data version control model"""
    __tablename__ = "data_versions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    data_source = Column(String(100), nullable=False, index=True)
    data_id = Column(String(36), nullable=False, index=True)
    version = Column(String(20), nullable=False)
    
    # Version metadata
    changes = Column(JSON)  # Array of change descriptions
    changed_by = Column(String(100))  # User or system that made changes
    change_reason = Column(Text)
    
    # Snapshot data
    snapshot = Column(JSON)  # Complete data snapshot at this version
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# ============================================================================
# REPORT HISTORY AND SCHEDULING MODELS
# ============================================================================

class ReportHistoryDB(Base):
    """Report history model for tracking changes and versions"""
    __tablename__ = "report_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    change_type = Column(String(20), nullable=False)  # created, updated, deleted, regenerated
    change_description = Column(Text)
    
    # Snapshot of report data at this point in time
    snapshot_data = Column(JSON)
    
    # Change metadata
    changed_by = Column(String(100))  # User or system that made the change
    change_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class ReportScheduleDB(Base):
    """Report scheduling model for automated report generation"""
    __tablename__ = "report_schedules"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), nullable=False, index=True)
    schedule_type = Column(String(20), nullable=False)  # daily, weekly, monthly, custom
    schedule_config = Column(JSON)  # Cron-like configuration
    
    # Schedule timing
    next_run = Column(DateTime, nullable=False, index=True)
    last_run = Column(DateTime)
    last_run_status = Column(String(20))  # success, failed, skipped
    
    # Schedule status
    is_active = Column(Boolean, default=True)
    is_paused = Column(Boolean, default=False)
    
    # Retry configuration
    max_retries = Column(Integer, default=3)
    retry_count = Column(Integer, default=0)
    
    # Notification settings
    notify_on_success = Column(Boolean, default=False)
    notify_on_failure = Column(Boolean, default=True)
    notification_recipients = Column(JSON)  # Array of email addresses
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ScheduleRunHistoryDB(Base):
    """Schedule run history for tracking execution"""
    __tablename__ = "schedule_run_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schedule_id = Column(String(36), nullable=False, index=True)
    report_id = Column(String(36), nullable=False)
    
    # Execution details
    run_time = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String(20), nullable=False)  # success, failed, skipped, running
    duration_seconds = Column(Integer)
    
    # Results
    generated_report_id = Column(String(36))
    error_message = Column(Text)
    output_data = Column(JSON)
    
    # Performance metrics
    records_processed = Column(Integer, default=0)
    memory_used_mb = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================================
# DASHBOARD METRICS MODELS
# ============================================================================

class DashboardMetricDB(Base):
    """Dashboard metrics model for storing current dashboard data"""
    __tablename__ = "dashboard_metrics"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_name = Column(String(100), nullable=False, unique=True, index=True)
    metric_value = Column(Float, nullable=False)
    metric_type = Column(String(50), nullable=False)  # percentage, count, time, status
    category = Column(String(50), nullable=False)  # quality, security, performance, backup
    
    # Trend data
    previous_value = Column(Float)
    change_value = Column(Float)
    change_percentage = Column(Float)
    trend_direction = Column(String(10))  # up, down, stable
    
    # Metadata
    description = Column(Text)
    unit = Column(String(20))  # %, issues, files, seconds, etc.
    threshold_warning = Column(Float)
    threshold_critical = Column(Float)
    
    # JSON storage for additional data
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MetricHistoryDB(Base):
    """Historical metric tracking for trend analysis"""
    __tablename__ = "metric_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_name = Column(String(100), nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    metric_type = Column(String(50), nullable=False)
    
    # Contextual data
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    context = Column(JSON)  # Additional context like build info, environment
    
    # Comparison data
    previous_value = Column(Float)
    change_value = Column(Float)
    change_percentage = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class BackupSystemStatusDB(Base):
    """Backup system status model"""
    __tablename__ = "backup_system_status"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Status indicators
    backup_api_connected = Column(Boolean, default=False)
    realtime_updates_active = Column(Boolean, default=False)
    total_backups = Column(Integer, default=0)
    
    # Last backup information
    last_backup_time = Column(DateTime)
    last_backup_status = Column(String(20))  # success, failed, in_progress
    last_backup_size = Column(Integer)  # Size in bytes
    last_backup_duration = Column(Integer)  # Duration in seconds
    
    # Next backup scheduling
    next_backup_time = Column(DateTime)
    backup_schedule = Column(String(50))  # daily, weekly, etc.
    
    # System health
    system_health = Column(String(20))  # healthy, warning, critical
    last_health_check = Column(DateTime, default=datetime.utcnow)
    
    # Additional metadata
    backup_location = Column(String(200))
    retention_policy = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MetricAlertDB(Base):
    """Metric alert configuration and tracking"""
    __tablename__ = "metric_alerts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_name = Column(String(100), nullable=False, index=True)
    
    # Alert configuration
    alert_type = Column(String(20), nullable=False)  # threshold, trend, anomaly
    condition = Column(String(20), nullable=False)  # above, below, equals, changes_by
    threshold_value = Column(Float)
    
    # Alert status
    is_active = Column(Boolean, default=True)
    last_triggered = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    
    # Notification settings
    notify_on_trigger = Column(Boolean, default=True)
    notification_channels = Column(JSON)  # Array of channels: email, slack, etc.
    notification_recipients = Column(JSON)  # Array of recipient identifiers
    
    # Alert metadata
    severity = Column(String(20))  # info, warning, critical
    description = Column(Text)
    cooldown_period_minutes = Column(Integer, default=60)  # Minimum time between alerts
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DashboardSnapshotDB(Base):
    """Complete dashboard snapshot for historical analysis"""
    __tablename__ = "dashboard_snapshots"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    snapshot_time = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Complete dashboard state as JSON
    metrics_data = Column(JSON)  # All current metrics
    backup_status = Column(JSON)  # Backup system status
    system_health = Column(String(20))
    
    # Context information
    context = Column(JSON)  # Environment, version, etc.
    
    # Snapshot metadata
    created_by = Column(String(100))  # System or user that created snapshot
    snapshot_type = Column(String(20))  # scheduled, manual, alert_triggered
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================================
# ROADMAP TRACKING MODELS
# ============================================================================

class RoadmapDB(Base):
    """Quarterly roadmap model for project planning"""
    __tablename__ = "roadmaps"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quarter = Column(String(10), nullable=False)  # Q1 2024, Q2 2024, etc.
    year = Column(Integer, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    
    # Status and progress
    status = Column(String(20), default="planned")  # planned, active, completed, delayed
    progress_percentage = Column(Integer, default=0)
    total_milestones = Column(Integer, default=0)
    completed_milestones = Column(Integer, default=0)
    
    # Risk tracking
    total_risks = Column(Integer, default=0)
    high_priority_risks = Column(Integer, default=0)
    medium_priority_risks = Column(Integer, default=0)
    low_priority_risks = Column(Integer, default=0)
    
    # Timeline metadata
    remaining_days = Column(Integer)
    on_track = Column(Boolean, default=True)
    
    # JSON storage for flexible data
    meta_data = Column(JSON)
    summary = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MilestoneDB(Base):
    """Milestone model for tracking deliverables"""
    __tablename__ = "milestones"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    roadmap_id = Column(String(36), nullable=False, index=True)
    
    # Milestone details
    name = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(String(10), nullable=False)  # high, medium, low
    status = Column(String(20), default="planned")  # planned, in_progress, completed, delayed, blocked
    
    # Timeline
    target_date = Column(DateTime, nullable=False)
    completed_date = Column(DateTime)
    estimated_hours = Column(Integer)
    actual_hours = Column(Integer)
    
    # Progress tracking
    progress_percentage = Column(Integer, default=0)
    assignee = Column(String(100))
    team = Column(String(100))
    
    # Dependencies
    dependencies = Column(JSON)  # Array of milestone IDs
    blocked_by = Column(JSON)  # Array of blocking milestone IDs
    
    # Risk assessment
    risk_level = Column(String(10))  # high, medium, low
    risk_factors = Column(JSON)  # Array of risk descriptions
    
    # JSON storage for additional data
    meta_data = Column(JSON)
    tags = Column(JSON)  # Array of tags
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RoadmapRiskDB(Base):
    """Risk tracking model for roadmap management"""
    __tablename__ = "roadmap_risks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    roadmap_id = Column(String(36), nullable=False, index=True)
    milestone_id = Column(String(36), index=True)  # Optional - linked to specific milestone
    
    # Risk details
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(50))  # technical, resource, timeline, external
    priority = Column(String(10), nullable=False)  # high, medium, low
    
    # Risk assessment
    probability = Column(String(10))  # high, medium, low
    impact = Column(String(10))  # high, medium, low
    risk_score = Column(Integer)  # Calculated score (1-9)
    
    # Status and mitigation
    status = Column(String(20), default="open")  # open, mitigating, resolved, closed
    mitigation_strategy = Column(Text)
    mitigation_progress = Column(Integer, default=0)
    owner = Column(String(100))
    
    # Timeline
    identified_date = Column(DateTime, default=datetime.utcnow)
    target_resolution_date = Column(DateTime)
    actual_resolution_date = Column(DateTime)
    
    # Impact tracking
    milestones_affected = Column(JSON)  # Array of milestone IDs
    estimated_delay_days = Column(Integer)
    actual_delay_days = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RoadmapDependencyDB(Base):
    """Dependency tracking model for milestones"""
    __tablename__ = "roadmap_dependencies"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    roadmap_id = Column(String(36), nullable=False, index=True)
    
    # Dependency relationship
    predecessor_id = Column(String(36), nullable=False, index=True)  # Milestone that must complete first
    successor_id = Column(String(36), nullable=False, index=True)  # Milestone that depends on predecessor
    dependency_type = Column(String(20))  # finish_to_start, start_to_start, finish_to_finish
    
    # Status
    status = Column(String(20), default="active")  # active, satisfied, broken, bypassed
    
    # Constraint details
    lag_days = Column(Integer, default=0)
    is_critical = Column(Boolean, default=False)
    
    # Impact assessment
    impact_description = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RoadmapProgressDB(Base):
    """Historical progress tracking for roadmaps"""
    __tablename__ = "roadmap_progress_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    roadmap_id = Column(String(36), nullable=False, index=True)
    milestone_id = Column(String(36), index=True)  # Optional - specific milestone tracking
    
    # Progress snapshot
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    progress_percentage = Column(Integer)
    completed_milestones = Column(Integer)
    total_milestones = Column(Integer)
    
    # Context
    context = Column(JSON)  # Additional context like team availability, external factors
    
    # Comparison data
    previous_progress = Column(Integer)
    progress_change = Column(Integer)
    days_since_last_update = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================================
# REFACTORING PLANNING MODELS
# ============================================================================

class RefactoringPlanDB(Base):
    """Refactoring plan model for complexity-based code improvement"""
    __tablename__ = "refactoring_plans"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200), nullable=False)
    
    # Complexity analysis
    current_complexity = Column(Integer, nullable=False)
    target_complexity = Column(Integer, nullable=False)
    complexity_reduction = Column(Integer)  # Target reduction amount
    lines_of_code = Column(Integer)
    functions_count = Column(Integer)
    
    # Plan details
    action_type = Column(String(50), nullable=False)  # refactor, optimize, review
    priority = Column(String(10), nullable=False)  # critical, high, medium, low
    status = Column(String(20), default="planned")  # planned, in_progress, completed, blocked
    estimated_hours = Column(Integer)
    actual_hours = Column(Integer)
    
    # Sprint integration
    sprint_id = Column(String(36), index=True)  # Link to sprint/task
    task_id = Column(String(36), index=True)
    
    # Plan content
    description = Column(Text)
    strategy = Column(Text)  # Refactoring approach
    breakdown = Column(JSON)  # Step-by-step breakdown
    
    # Risk assessment
    risk_level = Column(String(10))
    dependencies = Column(JSON)  # Files that depend on this one
    impact_analysis = Column(JSON)
    
    # Progress tracking
    progress_percentage = Column(Integer, default=0)
    assignee = Column(String(100))
    team = Column(String(100))
    
    # Results
    actual_complexity_after = Column(Integer)  # Measured after completion
    improvement_percentage = Column(Float)  # Actual improvement achieved
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)

class RefactoringTaskDB(Base):
    """Individual refactoring tasks within a plan"""
    __tablename__ = "refactoring_tasks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id = Column(String(36), nullable=False, index=True)
    
    # Task details
    title = Column(String(200), nullable=False)
    description = Column(Text)
    task_type = Column(String(50))  # extraction, simplification, modularization, etc.
    
    # Complexity impact
    complexity_before = Column(Integer)
    complexity_after = Column(Integer)
    complexity_reduction = Column(Integer)
    
    # Status and progress
    status = Column(String(20), default="pending")  # pending, in_progress, completed, blocked
    progress_percentage = Column(Integer, default=0)
    estimated_hours = Column(Integer)
    actual_hours = Column(Integer)
    
    # Dependencies
    depends_on_tasks = Column(JSON)  # Array of task IDs
    blocks_tasks = Column(JSON)  # Array of task IDs this blocks
    
    # Code location
    file_section = Column(String(200))  # Function/class/section being refactored
    line_range_start = Column(Integer)
    line_range_end = Column(Integer)
    
    # Validation
    tests_required = Column(Boolean, default=True)
    tests_passed = Column(Boolean, default=False)
    
    # Metadata
    assignee = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)

class ComplexityAnalysisDB(Base):
    """Historical complexity analysis for tracking improvements"""
    __tablename__ = "complexity_analysis_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    
    # Analysis snapshot
    analyzed_at = Column(DateTime, default=datetime.utcnow, index=True)
    complexity_score = Column(Integer)
    cyclomatic_complexity = Column(Integer)
    maintainability_index = Column(Integer)
    
    # File metrics
    lines_of_code = Column(Integer)
    functions_count = Column(Integer)
    classes_count = Column(Integer)
    
    # Issues found
    code_smells = Column(Integer)
    code_duplication = Column(Integer)
    security_issues = Column(Integer)
    
    # Context
    analyzer_version = Column(String(20))
    analysis_duration = Column(Integer)  # Seconds
    
    # Comparison with previous
    previous_complexity = Column(Integer)
    complexity_change = Column(Integer)
    improvement_percentage = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class RefactoringSprintIntegrationDB(Base):
    """Integration between refactoring plans and sprint tasks"""
    __tablename__ = "refactoring_sprint_integration"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    refactoring_plan_id = Column(String(36), nullable=False, index=True)
    sprint_id = Column(String(36), nullable=False, index=True)
    task_id = Column(String(36), nullable=False, index=True)
    
    # Integration details
    integration_type = Column(String(20), default="automatic")  # automatic, manual
    integration_status = Column(String(20), default="pending")  # pending, synced, failed
    
    # Task mapping
    task_title = Column(String(200))
    task_description = Column(Text)
    estimated_hours = Column(Integer)
    priority = Column(String(10))
    
    # Sync details
    last_synced_at = Column(DateTime)
    sync_error_message = Column(Text)
    
    # Progress tracking
    sprint_progress = Column(Integer)  # Progress from sprint system
    refactoring_progress = Column(Integer)  # Progress from refactoring system
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================================
# PERFORMANCE MONITORING MODELS
# ============================================================================

class APIPerformanceDB(Base):
    """API endpoint performance tracking"""
    __tablename__ = "api_performance"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    endpoint_name = Column(String(200), nullable=False, index=True)
    method = Column(String(10), nullable=False)  # GET, POST, PUT, DELETE
    
    # Performance metrics
    response_time_ms = Column(Float, nullable=False)
    status_code = Column(Integer, nullable=False)
    error_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    
    # Performance analysis
    avg_response_time = Column(Float)
    p95_response_time = Column(Float)
    p99_response_time = Column(Float)
    error_rate = Column(Float)
    
    # Trend analysis
    performance_trend = Column(String(20))  # improving, degrading, stable
    trend_percentage = Column(Float)
    
    # Alert thresholds
    response_time_threshold = Column(Float, default=5000)  # 5 seconds
    error_rate_threshold = Column(Float, default=5.0)  # 5%
    
    # Metadata
    meta_data = Column(JSON)
    tags = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SystemResourcesDB(Base):
    """System resources monitoring (CPU, memory, disk, network)"""
    __tablename__ = "system_resources"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # CPU metrics
    cpu_percent = Column(Float, nullable=False)
    cpu_count = Column(Integer)
    cpu_freq_mhz = Column(Float)
    
    # Memory metrics
    memory_percent = Column(Float, nullable=False)
    memory_total_mb = Column(Float, nullable=False)
    memory_available_mb = Column(Float, nullable=False)
    memory_used_mb = Column(Float, nullable=False)
    memory_cached_mb = Column(Float)
    
    # Disk metrics
    disk_percent = Column(Float, nullable=False)
    disk_total_gb = Column(Float, nullable=False)
    disk_used_gb = Column(Float, nullable=False)
    disk_free_gb = Column(Float, nullable=False)
    disk_read_mb_s = Column(Float)
    disk_write_mb_s = Column(Float)
    
    # Network metrics
    network_sent_mb_s = Column(Float)
    network_recv_mb_s = Column(Float)
    network_connections = Column(Integer)
    
    # System health
    load_average_1m = Column(Float)
    load_average_5m = Column(Float)
    load_average_15m = Column(Float)
    uptime_seconds = Column(Float)
    
    # Alert thresholds
    cpu_threshold = Column(Float, default=80.0)
    memory_threshold = Column(Float, default=85.0)
    disk_threshold = Column(Float, default=90.0)
    
    # Health status
    system_health = Column(String(20), default="healthy")  # healthy, warning, critical
    
    # Metadata
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class PerformanceAlertDB(Base):
    """Performance alert configuration and tracking"""
    __tablename__ = "performance_alerts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_name = Column(String(200), nullable=False)
    alert_type = Column(String(50), nullable=False)  # api_performance, system_resources, custom
    
    # Alert conditions
    metric_name = Column(String(100), nullable=False)
    condition = Column(String(20), nullable=False)  # above, below, equals, changes_by
    threshold_value = Column(Float, nullable=False)
    
    # Alert configuration
    severity = Column(String(20), default="warning")  # info, warning, critical
    is_active = Column(Boolean, default=True)
    cooldown_minutes = Column(Integer, default=15)
    
    # Alert tracking
    last_triggered_at = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    last_cleared_at = Column(DateTime)
    
    # Notification settings
    notification_channels = Column(JSON)  # email, slack, webhook, etc.
    recipients = Column(JSON)
    
    # Metadata
    description = Column(Text)
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PerformanceHistoryDB(Base):
    """Historical performance data for trend analysis"""
    __tablename__ = "performance_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    metric_type = Column(String(50), nullable=False, index=True)  # api, system, custom
    metric_name = Column(String(100), nullable=False, index=True)
    
    # Metric value
    metric_value = Column(Float, nullable=False)
    previous_value = Column(Float)
    change_value = Column(Float)
    change_percentage = Column(Float)
    
    # Context
    context = Column(JSON)
    tags = Column(JSON)
    
    # Analysis
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class SlowOperationDB(Base):
    """Slow operation tracking and analysis"""
    __tablename__ = "slow_operations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operation_name = Column(String(200), nullable=False)
    operation_type = Column(String(50), nullable=False)  # database, api, file, network, custom
    
    # Performance metrics
    duration_ms = Column(Float, nullable=False)
    threshold_ms = Column(Float, default=1000)  # 1 second threshold
    
    # Operation details
    endpoint = Column(String(200))
    query = Column(Text)
    file_path = Column(String(500))
    stack_trace = Column(Text)
    
    # Analysis
    frequency = Column(Integer, default=1)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    
    # Status
    status = Column(String(20), default="active")  # active, investigating, resolved, ignored
    
    # Metadata
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================================
# DATA UPLOAD MONITORING MODELS
# ============================================================================

class UploadTrackingDB(Base):
    """Individual upload tracking and monitoring"""
    __tablename__ = "upload_tracking"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_id = Column(String(100), unique=True, nullable=False, index=True)
    file_name = Column(String(500), nullable=False)
    file_type = Column(String(50))  # csv, json, xlsx, etc.
    file_size_mb = Column(Float, nullable=False)
    
    # Upload status
    upload_status = Column(String(20), default="pending")  # pending, uploading, processing, completed, failed
    upload_progress = Column(Integer, default=0)  # 0-100
    upload_speed_mb_s = Column(Float)
    
    # Processing metrics
    processing_time_seconds = Column(Float)
    processing_start_time = Column(DateTime)
    processing_end_time = Column(DateTime)
    
    # Result
    records_processed = Column(Integer)
    records_failed = Column(Integer)
    error_message = Column(Text)
    
    # User and session info
    user_id = Column(String(100))
    session_id = Column(String(100))
    ip_address = Column(String(50))
    
    # Classification
    upload_category = Column(String(50))  # data_import, backup, export, etc.
    priority = Column(String(10), default="normal")  # low, normal, high, urgent
    
    # Metadata
    meta_data = Column(JSON)
    tags = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UploadStatisticsDB(Base):
    """Aggregated upload statistics and metrics"""
    __tablename__ = "upload_statistics"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Time period
    period_type = Column(String(20), nullable=False)  # hourly, daily, weekly, monthly
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)
    
    # Upload counts
    total_uploads = Column(Integer, default=0)
    successful_uploads = Column(Integer, default=0)
    failed_uploads = Column(Integer, default=0)
    pending_uploads = Column(Integer, default=0)
    
    # Size metrics
    total_size_mb = Column(Float, default=0)
    avg_size_mb = Column(Float)
    max_size_mb = Column(Float)
    min_size_mb = Column(Float)
    
    # Processing metrics
    avg_processing_time_seconds = Column(Float)
    max_processing_time_seconds = Column(Float)
    min_processing_time_seconds = Column(Float)
    
    # Success rate
    success_rate = Column(Float)
    failure_rate = Column(Float)
    
    # Performance metrics
    avg_upload_speed_mb_s = Column(Float)
    total_upload_time_seconds = Column(Float)
    
    # File type breakdown
    file_type_counts = Column(JSON)  # {"csv": 10, "json": 5, "xlsx": 3}
    
    # Trend analysis
    uploads_trend = Column(String(20))  # increasing, decreasing, stable
    trend_percentage = Column(Float)
    
    # Metadata
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UploadAlertDB(Base):
    """Upload alert configuration and tracking"""
    __tablename__ = "upload_alerts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_name = Column(String(200), nullable=False)
    alert_type = Column(String(50), nullable=False)  # failure_rate, processing_time, file_size, custom
    
    # Alert conditions
    metric_name = Column(String(100), nullable=False)
    condition = Column(String(20), nullable=False)  # above, below, equals, changes_by
    threshold_value = Column(Float, nullable=False)
    
    # Alert configuration
    severity = Column(String(20), default="warning")  # info, warning, critical
    is_active = Column(Boolean, default=True)
    cooldown_minutes = Column(Integer, default=30)
    
    # Alert tracking
    last_triggered_at = Column(DateTime)
    trigger_count = Column(Integer, default=0)
    last_cleared_at = Column(DateTime)
    
    # Notification settings
    notification_channels = Column(JSON)  # email, slack, webhook, etc.
    recipients = Column(JSON)
    
    # Metadata
    description = Column(Text)
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UploadHistoryDB(Base):
    """Historical upload data for trend analysis"""
    __tablename__ = "upload_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    upload_id = Column(String(100), nullable=False, index=True)
    
    # Snapshot data
    snapshot_time = Column(DateTime, nullable=False, index=True)
    upload_status = Column(String(20))
    upload_progress = Column(Integer)
    processing_time_seconds = Column(Float)
    file_size_mb = Column(Float)
    
    # Analysis
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float)
    anomaly_reason = Column(String(200))
    
    # Context
    context = Column(JSON)
    tags = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class UploadPatternDB(Base):
    """Upload pattern analysis and detection"""
    __tablename__ = "upload_patterns"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pattern_name = Column(String(200), nullable=False)
    pattern_type = Column(String(50), nullable=False)  # time_based, user_based, file_type_based, size_based
    
    # Pattern detection
    detection_criteria = Column(JSON)  # {"hour": 9, "day_of_week": 1} for Monday 9am uploads
    confidence_score = Column(Float)
    frequency = Column(Integer, default=1)
    
    # Pattern metrics
    avg_upload_size_mb = Column(Float)
    avg_processing_time_seconds = Column(Float)
    success_rate = Column(Float)
    
    # Pattern status
    is_active = Column(Boolean, default=True)
    first_detected_at = Column(DateTime, default=datetime.utcnow)
    last_detected_at = Column(DateTime, default=datetime.utcnow)
    
    # Recommendations
    recommendations = Column(JSON)
    
    # Metadata
    meta_data = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)