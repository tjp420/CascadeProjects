# Constants


CONSTANT_3600 = 3600


#!/usr/bin/env python3


"""


Celery Configuration for Async Task Processing


Configures Celery with Redis broker for background analysis and export tasks


"""


from celery import Celery


import os


# Create Celery app


celery_app = Celery(


    'dashboard_tasks',


    broker = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0'),


    backend = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0'),


    include=['tasks.analysis_tasks', 'tasks.export_tasks']


)


# Celery configuration


celery_app.conf.update(


    task_serializer='json',


    accept_content=['json'],


    result_serializer='json',


    timezone='UTC',


    enable_utc = True,


    task_track_started = True,


    task_time_limit = CONSTANT_3600,  # 1 hour max per task


    task_soft_time_limit = 3300,  # 55 min soft limit


    worker_prefetch_multiplier = 1,


    worker_max_tasks_per_child = 1000,


)


# Task routing for different task types


celery_app.conf.task_routes = {


    'tasks.analysis_tasks.run_code_analysis': {'queue': 'analysis'},


    'tasks.analysis_tasks.run_security_scan': {'queue': 'security'},


    'tasks.analysis_tasks.run_performance_analysis': {'queue': 'performance'},


    'tasks.export_tasks.generate_export': {'queue': 'exports'},


    'tasks.export_tasks.generate_quality_report': {'queue': 'exports'},


    'tasks.export_tasks.retry_export': {'queue': 'exports'},


    'tasks.export_tasks.retry_export_by_name': {'queue': 'exports'},


    'tasks.export_tasks.generate_project_history_export': {'queue': 'exports'},


    'tasks.export_tasks.cleanup_old_exports': {'queue': 'exports'},


}


if __name__ == '__main__':


    celery_app.start()


