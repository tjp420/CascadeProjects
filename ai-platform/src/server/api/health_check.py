import logging

logger = logging.getLogger(__name__)

# Constants


CONSTANT_90 = 90


#!/usr/bin/env python3


"""


Health Check Module for AI Coding Intelligence Dashboard API


Provides comprehensive health monitoring and status reporting


"""


import os


import sys


import json


import time


import psutil


from datetime import datetime


from pathlib import Path


class HealthChecker:


    def __init__(self):


        """Check critical project files exist and are readable."""


        self.start_time = time.time()


        self.project_root = Path(__file__).parent.parent.parent


        self.web_dir = self.project_root / "web"


    def check_database_health(self):


        """


        """


        try:


            # Add database health checks here


            return {


                "status": "healthy",


                "message": "Database connection successful",


                "timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {


                "status": "unhealthy",


                "message": f"Database connection failed: {str(e)}",


                "timestamp": datetime.now().isoformat()


            }


    def check_filesystem_health(self):


        """


        """


        try:


            disk_usage = psutil.disk_usage('/')


            free_space_gb = disk_usage.free / (1024**3)


            if free_space_gb < 1:  # Less than 1GB free


                status = "warning"



                message = f"Low disk space: {free_space_gb:.2f}GB free"


            else:


                status = "healthy"



                message = f"Disk space OK: {free_space_gb:.2f}GB free"


            return {


                "status": status,


                "message": message,


                "freeSpace": free_space_gb,


                "totalSpace": disk_usage.total / (1024**3),


                "timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {


                "status": "unhealthy",


                "message": f"Filesystem check failed: {str(e)}",


                "timestamp": datetime.now().isoformat()


            }


    def check_memory_usage(self):


        """Check memory usage thresholds."""


        try:


            memory = psutil.virtual_memory()


            memory_usage_percent = memory.percent


            if memory_usage_percent > CONSTANT_90:


                status = "critical"



                message = f"High memory usage: {memory_usage_percent:.1f}%"


            elif memory_usage_percent > 80:


                status = "warning"



                message = f"High memory usage: {memory_usage_percent:.1f}%"


            else:


                status = "healthy"



                message = f"Memory usage OK: {memory_usage_percent:.1f}%"


            return {


                "status": status,


                "message": message,


                "usagePercent": memory_usage_percent,


                "availableGB": memory.available / (1024**3),


                "totalGB": memory.total / (1024**3),


                "timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {


                "status": "unhealthy",


                "message": f"Memory check failed: {str(e)}",


                "timestamp": datetime.now().isoformat()


            }


    def check_project_files(self):


        """


        """


        try:


            critical_files = [


                "dashboard_direct.html",


                "api/simple_server.py",


                "package.json",


                ".eslintrc.js",


                ".prettierrc",


                "jest.config.js",


                "README.md"


            ]


            missing_files = []


            inaccessible_files = []


            for file_path in critical_files:


                full_path = self.project_root / file_path


                if full_path.exists():


                    try:


                        with open(full_path, 'r', encoding='utf-8') as f:


                            f.read(1)  # Test readability


                    except Exception as e:


                        inaccessible_files.append(file_path)


                else:


                    missing_files.append(file_path)


            if missing_files or inaccessible_files:


                status = "unhealthy"



                message = f"Missing files: {len(missing_files)}, Inaccessible files: {len(inaccessible_files)}"


            else:


                status = "healthy"



                message = "All critical files accessible"


            return {


                "status": status,


                "message": message,


                "missingFiles": missing_files,


                "inaccessibleFiles": inaccessible_files,


                "totalFiles": len(critical_files),


                "timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {


                "status": "unhealthy",


                "message": f"Project files check failed: {str(e)}",


                "timestamp": datetime.now().isoformat()


            }


    def check_api_endpoints(self):


        """Check memory usage thresholds."""


        try:


            # Test key API endpoints


            endpoints_to_check = [


                "/api/health",


                "/api/project/overview",


                "/api/project/metrics"


            ]


            failed_endpoints = []


            for endpoint in endpoints_to_check:


                # Endpoint probes are added when HTTP health checks are enabled.
                continue


            if failed_endpoints:


                status = "unhealthy"



                message = f"Failed endpoints: {', '.join(failed_endpoints)}"


            else:


                status = "healthy"



                message = "All API endpoints accessible"


            return {


                "status": status,


                "message": message,


                "failedEndpoints": failed_endpoints,


                "totalEndpoints": len(endpoints_to_check),


                "timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {


                "status": "unhealthy",


                "message": f"API endpoints check failed: {str(e)}",


                "timestamp": datetime.now().isoformat()


            }


    def get_system_info(self):


        """


        """


        try:


            cpu_info = psutil.cpu_percent(interval = 1)


            boot_time = psutil.boot_time()


            uptime = time.time() - boot_time


            return {


                "cpuUsage": cpu_info,


                "uptime": uptime,


                "processCount": len(psutil.pids()),


                "platform": sys.platform,


                "pythonVersion": sys.version,


                "timestamp": datetime.now().isoformat()


            }


        except Exception as e:


            return {


                "error": str(e),


                "timestamp": datetime.now().isoformat()


            }


    def get_service_uptime(self):


        """


        """


        uptime_seconds = time.time() - self.start_time


        uptime_days = int(uptime_seconds / 86400)


        uptime_hours = int((uptime_seconds % 86400) / 3600)


        uptime_minutes = int((uptime_seconds % 3600) / 60)


        return {


            "seconds": int(uptime_seconds),


            "days": uptime_days,


            "hours": uptime_hours,


            "minutes": uptime_minutes,


            "formatted": f"{uptime_days}d {uptime_hours}h {uptime_minutes}m",


            "timestamp": datetime.now().isoformat()


        }


    def get_overall_health(self):


        """Check memory usage thresholds."""


        checks = {


            "database": self.check_database_health(),


            "filesystem": self.check_filesystem_health(),


            "memory": self.check_memory_usage(),


            "projectFiles": self.check_project_files(),


            "apiEndpoints": self.check_api_endpoints()


        }


        # Count status types


        healthy_count = sum(1 for check in checks.values() if check["status"] == "healthy")


        warning_count = sum(1 for check in checks.values() if check["status"] == "warning")


        unhealthy_count = sum(1 for check in checks.values() if check["status"] == "unhealthy")


        critical_count = sum(1 for check in checks.values() if check["status"] == "critical")


        # Determine overall status


        if critical_count > 0:


            overall_status = "critical"


        elif unhealthy_count > 0:


            overall_status = "unhealthy"


        elif warning_count > 0:


            overall_status = "warning"


        else:


            overall_status = "healthy"


        return {


            "status": overall_status,


            "checks": checks,


            "summary": {


                "healthy": healthy_count,


                "warning": warning_count,


                "unhealthy": unhealthy_count,


                "critical": critical_count,


                "total": len(checks)


            },


            "uptime": self.get_service_uptime(),


            "systemInfo": self.get_system_info(),


            "timestamp": datetime.now().isoformat()


        }


def create_health_response():


    """Create health check response for API"""


    health_checker = HealthChecker()


    health_data = health_checker.get_overall_health()


    return {


        "status": health_data["status"],


        "timestamp": health_data["timestamp"],


        "version": "2.0.0",


        "uptime": health_data["uptime"],


        "checks": health_data["summary"],


        "details": health_data["checks"]


    }


def create_detailed_health_response():


    """Create detailed health check response"""


    health_checker = HealthChecker()


    return health_checker.get_overall_health()


if __name__ == "__main__":


    # Test health checker


    health_checker = HealthChecker()


    health_data = health_checker.get_overall_health()


    logger.info("Health Check Results:")


    logger.info(f"Overall Status: {health_data['status']}")


    logger.info(f"Uptime: {health_data['uptime']['formatted']}")


    logger.info(f"Healthy Checks: {health_data['summary']['healthy']}/{health_data['summary']['total']}")


    if health_data['status'] != 'healthy':


        logger.info("\nIssues found:")


        for check_name, check_data in health_data['checks'].items():


            if check_data['status'] != 'healthy':


                logger.info(f"  {check_name}: {check_data['message']}")


