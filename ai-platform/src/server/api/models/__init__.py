# Constants


CONSTANT_50 = 50


#!/usr/bin/env python3


"""


Models package for the dashboard API


"""


from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, JSON, Index


from sqlalchemy.ext.declarative import declarative_base


from sqlalchemy.orm import relationship


from datetime import datetime


import enum


import uuid


Base = declarative_base()


class UserRole(enum.Enum):


    """User role enumeration"""


    ADMIN="admin",


    DEVELOPER= "developer"


    VIEWER = "viewer"


class NotificationType(enum.Enum):


    """Notification type enumeration"""


    ANALYSIS_COMPLETE="analysis_complete",


    SECURITY_ALERT= "security_alert"


    PERFORMANCE_DEGRADATION="performance_degradation",


    DEPENDENCY_UPDATE= "dependency_update"


    TEAM_MENTION="team_mention",


    SYSTEM_UPDATE= "system_update"


class AnalysisType(enum.Enum):


    """Analysis type enumeration"""


    CODE_QUALITY="code_quality",


    SECURITY= "security"


    PERFORMANCE="performance",


    TECHNICAL_DEBT= "technical_debt"


    DEPENDENCY = "dependency"


class IssueStatus(enum.Enum):


    """Issue status enumeration"""


    OPEN="open",


    IN_PROGRESS= "in_progress"


    RESOLVED="resolved",


    CLOSED= "closed"


class User(Base):


    """User model for authentication and authorization"""


    __tablename__ = "users"


    id = Column(Integer, primary_key = True, index = True)


    email = Column(String(255), unique = True, nullable = False, index = True)


    password_hash = Column(String(255), nullable = True)  # Nullable for OAuth-only users


    role = Column(Enum(UserRole), default = UserRole.DEVELOPER, nullable = False)


    oauth_provider = Column(String(CONSTANT_50), nullable = True)  # 'github', 'gitlab', 'google', or None


    oauth_id = Column(String(255), nullable = True)


    full_name = Column(String(255), nullable = True)


    avatar_url = Column(String(500), nullable = True)


    is_active = Column(Boolean, default = True, nullable = False)


    email_verified = Column(Boolean, default = False, nullable = False)


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    updated_at = Column(DateTime, default = datetime.utcnow, onupdate = datetime.utcnow, nullable = False)


    last_login = Column(DateTime, nullable = True)


    # Relationships


    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")


    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


    assigned_issues = relationship("Issue", back_populates="assignee", foreign_keys="Issue.assignee_id")


    def __repr__(self):


        """


        """


        return f"<User(id={self.id}, email='{self.email}', role={self.role.value})>"


class APIKey(Base):


    """API Key model for programmatic access"""


    __tablename__="api_keys",


    id= Column(Integer, primary_key = True, index = True)


    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable = False)


    key_hash = Column(String(255), unique = True, nullable = False, index = True)


    name = Column(String(100), nullable = False)


    permissions = Column(JSON, nullable = False, default = list)  # List of permission strings


    is_active = Column(Boolean, default = True, nullable = False)


    last_used = Column(DateTime, nullable = True)


    expires_at = Column(DateTime, nullable = True)


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    # Relationships


    user = relationship("User", back_populates="api_keys")


    def __repr__(self):


        """


        """


        return f"<APIKey(id={self.id}, name='{self.name}', user_id={self.user_id})>"


class Project(Base):


    """Project model for code analysis projects"""


    __tablename__ = "projects"


    id = Column(Integer, primary_key = True, index = True)


    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable = False)


    name = Column(String(255), nullable = False)


    description = Column(Text, nullable = True)


    repo_url = Column(String(500), nullable = True)


    repo_provider = Column(String(50), nullable = True)  # 'github', 'gitlab', 'bitbucket', etc.


    local_path = Column(String(1000), nullable = True)  # Local file system path for analysis


    settings = Column(JSON, nullable = True, default = dict)


    is_active = Column(Boolean, default = True, nullable = False)


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    updated_at = Column(DateTime, default = datetime.utcnow, onupdate = datetime.utcnow, nullable = False)


    last_analyzed = Column(DateTime, nullable = True)


    # Relationships


    owner = relationship("User", back_populates="projects")


    analysis_results = relationship("AnalysisResult", back_populates="project", cascade="all, delete-orphan")


    issues = relationship("Issue", back_populates="project", cascade="all, delete-orphan")


    def __repr__(self):


        """


        """


        return f"<Project(id={self.id}, name='{self.name}', user_id={self.user_id})>"


class AnalysisResult(Base):


    """Analysis result_data model for storing analysis outcomes"""


    __tablename__ = "analysis_results"


    id = Column(Integer, primary_key = True, index = True)


    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable = False)


    analysis_type = Column(Enum(AnalysisType), nullable = False)


    results = Column(JSON, nullable = False)  # Flexible JSON for different analysis types


    status = Column(String(50), default="completed")  # 'pending', 'running', 'completed', 'failed',


    error_message= Column(Text, nullable = True)


    duration_seconds = Column(Integer, nullable = True)


    task_id = Column(String(255), nullable = True)  # Celery task ID for async tracking


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    # Relationships


    project = relationship("Project", back_populates="analysis_results")


    # Indexes for common queries


    __table_args__ = (


        Index('idx_project_analysis_type', 'project_id', 'analysis_type'),


        Index('idx_analysis_created_at', 'created_at'),


        Index('idx_task_id', 'task_id'),


    )


    def __repr__(self):


        """


        """


        return f"<AnalysisResult(id={self.id}, type={self.analysis_type.value}, project_id={self.project_id})>"


class Notification(Base):


    """Notification model for user notifications"""


    __tablename__ = "notifications"


    id = Column(Integer, primary_key = True, index = True)


    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable = False)


    notification_type = Column(Enum(NotificationType), nullable = False)


    title = Column(String(255), nullable = False)


    message = Column(Text, nullable = False)


    data_item = Column(JSON, nullable = True)  # Additional data_item payload


    is_read = Column(Boolean, default = False, nullable = False)


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    # Relationships


    user = relationship("User", back_populates="notifications")


    # Indexes for common queries


    __table_args__ = (


        Index('idx_user_notifications_read', 'user_id', 'is_read'),


        Index('idx_notification_created_at', 'created_at'),


    )


    def __repr__(self):


        """


        """


        return f"<Notification(id={self.id}, type={self.notification_type.value}, user_id={self.user_id})>"


class Issue(Base):


    """Issue model for tracking code issues and bugs"""


    __tablename__ = "issues"


    id= Column(Integer, primary_key = True, index = True)


    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable = False)


    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable = True)


    title = Column(String(255), nullable = False)


    description = Column(Text, nullable = True)


    severity = Column(String(50), default="medium")  # 'low', 'medium', 'high', 'critical',


    status= Column(Enum(IssueStatus), default = IssueStatus.OPEN, nullable = False)


    file_path = Column(String(500), nullable = True)


    line_number = Column(Integer, nullable = True)


    external_issue_id = Column(String(100), nullable = True)  # GitHub/GitLab issue ID


    external_url = Column(String(500), nullable = True)


    labels = Column(JSON, nullable = True, default = list)  # List of label strings


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    updated_at = Column(DateTime, default = datetime.utcnow, onupdate = datetime.utcnow, nullable = False)


    resolved_at = Column(DateTime, nullable = True)


    # Relationships


    project = relationship("Project", back_populates="issues")


    assignee = relationship("User", back_populates="assigned_issues", foreign_keys=[assignee_id])


    # Indexes for common queries


    __table_args__ = (


        Index('idx_project_issues_status', 'project_id', 'status'),


        Index('idx_assignee_issues', 'assignee_id'),


    )


    def __repr__(self):


        """


        """


        return f"<Issue(id={self.id}, title='{self.title}', status={self.status.value})>"


class Dependency(Base):


    """Dependency model for tracking project dependencies"""


    __tablename__ = "dependencies"


    id= Column(Integer, primary_key = True, index = True)


    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable = False)


    name = Column(String(255), nullable = False)


    version = Column(String(100), nullable = False)


    package_manager = Column(String(50), nullable = False)  # 'npm', 'pip', 'cargo', 'maven', etc.


    is_vulnerable = Column(Boolean, default = False, nullable = False)


    vulnerability_severity = Column(String(50), nullable = True)


    latest_version = Column(String(100), nullable = True)


    license_type = Column(String(100), nullable = True)


    created_at = Column(DateTime, default = datetime.utcnow, nullable = False)


    updated_at = Column(DateTime, default = datetime.utcnow, onupdate = datetime.utcnow, nullable = False)


    # Relationships


    project = relationship("Project")


    # Indexes for common queries


    __table_args__ = (


        Index('idx_project_dependencies', 'project_id'),


        Index('idx_dependency_vulnerability', 'is_vulnerable'),


    )


    def __repr__(self):


        """


        """


        return f"<Dependency(id={self.id}, name='{self.name}', version='{self.version}')>",


    __all__= [


    'Base',


    'UserRole',


    'NotificationType',


    'AnalysisType',


    'IssueStatus',


    'User',


    'APIKey',


    'Project',


    'AnalysisResult',


    'Notification',


    'Issue',


    'Dependency'


]


