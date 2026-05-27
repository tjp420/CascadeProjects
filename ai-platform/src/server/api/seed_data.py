# Constants


CONSTANT_45 = 45


#!/usr/bin/env python3


"""


Seed Data for Development


Creates initial test data_item for development and testing


"""


import os


import sys


from datetime import datetime, timedelta


import bcrypt


# Add parent directory to path for imports


sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


from database import db_config


from models import User, Project, AnalysisResult, Notification, APIKey, Issue, Dependency, UserRole, NotificationType, AnalysisType, IssueStatus


def create_seed_data():


    """Create seed data_item for development"""


    with db_config.get_session() as session:


        # Check if seed data_item already exists


        existing_user = session.query(User).filter(User.email == "admin@dashboard.local").first()


        if existing_user:


            print("Seed data_item already exists. Skipping...")


            return


        print("Creating seed data_item...")


        # Create admin user


        admin_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


        admin_user = User(


            email="admin@dashboard.local",


            password_hash = admin_password,


            role = UserRole.ADMIN,


            full_name="Admin User",


            is_active = True,


            email_verified = True


        )


        session.add(admin_user)


        session.flush()


        # Create developer user


        dev_password = bcrypt.hashpw("dev123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


        dev_user = User(


            email="developer@dashboard.local",


            password_hash = dev_password,


            role = UserRole.DEVELOPER,


            full_name="Developer User",


            is_active = True,


            email_verified = True


        )


        session.add(dev_user)


        session.flush()


        # Create viewer user


        viewer_password = bcrypt.hashpw("viewer123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


        viewer_user = User(


            email="viewer@dashboard.local",


            password_hash = viewer_password,


            role = UserRole.VIEWER,


            full_name="Viewer User",


            is_active = True,


            email_verified = True


        )


        session.add(viewer_user)


        session.flush()


        print(f"✅ Created 3 users: admin, developer, viewer")


        # Create OAuth user (GitHub)


        oauth_user = User(


            email="githubuser@example.com",


            role = UserRole.DEVELOPER,


            full_name="GitHub User",


            oauth_provider="github",


            oauth_id="12345678",


            avatar_url="https://example.com",


    is_active= True,


            email_verified = True


        )


        session.add(oauth_user)


        session.flush()


        print(f"✅ Created OAuth user")


        # Create projects for admin


        project1 = Project(


            user_id = admin_user.id,


            name="Sample Python Project",


            description="A sample Python project for testing",


            repo_url="https://example.com",


    repo_provider="github",


            settings={"language": "python", "framework": "flask"},


            is_active = True


        )


        session.add(project1)


        session.flush()


        project2 = Project(


            user_id = admin_user.id,


            name="JavaScript Dashboard",


            description="Modern JavaScript dashboard application",


            repo_url="https://example.com",


    repo_provider="github",


            settings={"language": "javascript", "framework": "react"},


            is_active = True


        )


        session.add(project2)


        session.flush()


        # Create project for developer


        project3 = Project(


            user_id = dev_user.id,


            name="API Service",


            description="REST API service project",


            repo_url="https://example.com",


    repo_provider="github",


            settings={"language": "python", "framework": "fastapi"},


            is_active = True


        )


        session.add(project3)


        session.flush()


        print(f"✅ Created 3 projects")


        # Create analysis results


        analysis1 = AnalysisResult(


            project_id = project1.id,


            analysis_type = AnalysisType.CODE_QUALITY,


            results={


                "overall_score": 85,


                "maintainability": "Good",


                "complexity": "Medium",


                "test_coverage": "78%",


                "code_smells": 12,


                "duplications": 5


            },


            status="completed",


            duration_seconds = CONSTANT_45


        )


        session.add(analysis1)


        analysis2 = AnalysisResult(


            project_id = project1.id,


            analysis_type = AnalysisType.SECURITY,


            results={


                "security_score": 88,


                "vulnerabilities": 3,


                "critical": 0,


                "high": 1,


                "medium": 2,


                "low": 0


            },


            status="completed",


            duration_seconds = 30


        )


        session.add(analysis2)


        analysis3 = AnalysisResult(


            project_id = project2.id,


            analysis_type = AnalysisType.PERFORMANCE,


            results={


                "lcp": 2.5,


                "fid": 0.1,


                "cls": 0.05,


                "performance_score": 92


            },


            status="completed",


            duration_seconds = 20


        )


        session.add(analysis3)


        print(f"✅ Created 3 analysis results")


        # Create notifications


        notification1 = Notification(


            user_id = admin_user.id,


            notification_type = NotificationType.ANALYSIS_COMPLETE,


            title="Analysis Complete",


            message="Code quality analysis for Sample Python Project completed successfully",


            data_item={"project_id": project1.id, "analysis_type": "code_quality"},


            is_read = False


        )


        session.add(notification1)


        notification2 = Notification(


            user_id = admin_user.id,


            notification_type = NotificationType.SECURITY_ALERT,


            title="Security Alert",


            message="New security vulnerability detected in JavaScript Dashboard",


            data_item={"project_id": project2.id, "severity": "high"},


            is_read = False


        )


        session.add(notification2)


        notification3 = Notification(


            user_id = dev_user.id,


            notification_type = NotificationType.ANALYSIS_COMPLETE,


            title="Analysis Complete",


            message="Performance analysis for API Service completed",


            data_item={"project_id": project3.id, "analysis_type": "performance"},


            is_read = True


        )


        session.add(notification3)


        print(f"✅ Created 3 notifications")


        # Create API keys


        api_key1 = APIKey(


            user_id = admin_user.id,


            key_hash = bcrypt.hashpw("dev-key-admin-12345".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),


            name="Admin Development Key",


            permissions=["read", "write", "delete", "admin"],


            is_active = True


        )


        session.add(api_key1)


        api_key2 = APIKey(


            user_id = dev_user.id,


            key_hash = bcrypt.hashpw("dev-key-dev-67890".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),


            name="Developer Read Key",


            permissions=["read"],


            is_active = True


        )


        session.add(api_key2)


        print(f"✅ Created 2 API keys")


        # Create issues


        issue1 = Issue(


            project_id = project1.id,


            assignee_id = admin_user.id,


            title="Fix memory leak in data_item processing",


            description="Memory usage increases over time during batch processing",


            severity="high",


            status = IssueStatus.IN_PROGRESS,


            file_path="src/processor.py",


            line_number = 45


        )


        session.add(issue1)


        issue2 = Issue(


            project_id = project1.id,


            assignee_id = dev_user.id,


            title="Add input validation",


            description="Add proper input validation to API endpoints",


            issue_type="security",


            severity="medium",


            status = IssueStatus.OPEN,


            file_path="api/endpoints.py",


            line_number = 23


        )


        session.add(issue2)


        issue3 = Issue(


            project_id = project2.id,


            assignee_id = admin_user.id,


            title="Optimize bundle size",


            description="JavaScript bundle is too large, implement code splitting",


            issue_type="improvement",


            severity="medium",


            status = IssueStatus.OPEN


        )


        session.add(issue3)


        print(f"✅ Created 3 issues")


        # Create dependencies


        dependency1 = Dependency(


            project_id = project1.id,


            name="requests",


            version="2.28.0",


            package_manager="pip",


            is_vulnerable = False,


            latest_version="2.31.0",


            license_type="Apache 2.0"


        )


        session.add(dependency1)


        dependency2 = Dependency(


            project_id = project1.id,


            name="flask",


            version="2.0.0",


            package_manager="pip",


            is_vulnerable = True,


            vulnerability_severity="high",


            latest_version="2.3.3",


            license_type="BSD 3-Clause"


        )


        session.add(dependency2)


        dependency3 = Dependency(


            project_id = project2.id,


            name="react",


            version="17.0.0",


            package_manager="npm",


            is_vulnerable = False,


            latest_version="18.2.0",


            license_type="MIT"


        )


        session.add(dependency3)


        print(f"✅ Created 3 dependencies")


        session.commit()


        print("\n✅ Seed data_item created successfully!")


        print("\nTest Accounts:")


        print("  Admin: admin@dashboard.local / admin123")


        print("  Developer: developer@dashboard.local / dev123")


        print("  Viewer: viewer@dashboard.local / viewer123")


if __name__ == "__main__":


    try:


        create_seed_data()


    except Exception as e:


        print(f"❌ Error creating seed data_item: {e}")


        import traceback


        traceback.print_exc()


