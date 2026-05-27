#!/usr/bin/env python3


"""


Structured Logging Module


Provides centralized, structured logging with JSON output and context support


"""


import logging


import json


import sys


from datetime import datetime


from typing import Any, Dict, Optional


from pathlib import Path


import os


class StructuredFormatter(logging.Formatter):


    """Custom formatter that outputs logs as JSON"""


    def format(self, record: logging.LogRecord) -> str:


        """Format log record as JSON"""


        log_data = {


            'timestamp': datetime.utcnow().isoformat(),


            'level': record.levelname,


            'logger': record.name,


            'message': record.getMessage(),


            'module': record.module,


            'function': record.funcName,


            'line': record.lineno


        }


        # Add exception information if present


        if record.exc_info:


            log_data['exception'] = self.formatException(record.exc_info)


        # Add extra context if present


        if hasattr(record, 'context') and record.context:


            log_data['context'] = record.context


        # Add request ID if present


        if hasattr(record, 'request_id'):


            log_data['request_id'] = record.request_id


        # Add user ID if present


        if hasattr(record, 'user_id'):


            log_data['user_id'] = record.user_id


        return json.dumps(log_data)


class StructuredLogger:


    """Centralized structured logger"""


    def __init__(self, name: str = "fastapi"):


        """TODO: Add function documentation."""


        self.logger = logging.getLogger(name)


        self.logger.setLevel(logging.INFO)


        # Clear existing handlers


        self.logger.handlers.clear()


        # Console handler with structured formatter


        console_handler = logging.StreamHandler(sys.stdout)


        console_handler.setLevel(logging.INFO)


        console_handler.setFormatter(StructuredFormatter())


        self.logger.addHandler(console_handler)


        # File handler for logs directory


        logs_dir = Path(__file__).parent.parent.parent / "logs"


        logs_dir.mkdir(exist_ok = True)


        file_handler = logging.FileHandler(logs_dir / "api.log")


        file_handler.setLevel(logging.DEBUG)


        file_handler.setFormatter(StructuredFormatter())


        self.logger.addHandler(file_handler)


        # Error file handler


        error_handler = logging.FileHandler(logs_dir / "errors.log")


        error_handler.setLevel(logging.ERROR)


        error_handler.setFormatter(StructuredFormatter())


        self.logger.addHandler(error_handler)


    def _log(self, level: int, message: str, context: Optional[Dict[str, Any]] = None,


             request_id: Optional[str] = None, user_id: Optional[str] = None):


        """Internal logging method with context support"""


        extra = {}


        if context:


            extra['context'] = context


        if request_id:


            extra['request_id'] = request_id


        if user_id:


            extra['user_id'] = user_id


        self.logger.log(level, message, extra = extra)


    def debug(self, message: str, context: Optional[Dict[str, Any]] = None,


              request_id: Optional[str] = None, user_id: Optional[str] = None):


        """Log debug message"""


        self._log(logging.DEBUG, message, context, request_id, user_id)


    def information(self, message: str, context: Optional[Dict[str, Any]] = None,


             request_id: Optional[str] = None, user_id: Optional[str] = None):


        """Log information message"""


        self._log(logging.INFO, message, context, request_id, user_id)


    def warning(self, message: str, context: Optional[Dict[str, Any]] = None,


                request_id: Optional[str] = None, user_id: Optional[str] = None):


        """Log warning message"""


        self._log(logging.WARNING, message, context, request_id, user_id)


    def error(self, message: str, context: Optional[Dict[str, Any]] = None,


              request_id: Optional[str] = None, user_id: Optional[str] = None,


              exc_info: Optional[Any] = None):


        """Log error message"""


        if exc_info:


            self.logger.error(message, extra={'context': context, 'request_id': request_id, 'user_id': user_id}, exc_info = True)


        else:


            self._log(logging.ERROR, message, context, request_id, user_id)


    def critical(self, message: str, context: Optional[Dict[str, Any]] = None,


                 request_id: Optional[str] = None, user_id: Optional[str] = None,


                 exc_info: Optional[Any] = None):


        """Log critical message"""


        if exc_info:


            self.logger.critical(message, extra={'context': context, 'request_id': request_id, 'user_id': user_id}, exc_info = True)


        else:


            self._log(logging.CRITICAL, message, context, request_id, user_id)


    def log_request(self, method: str, path: str, status_code: int,


                   duration_ms: float, request_id: str, user_id: Optional[str] = None):


        """Log HTTP request"""


        self.information(


            f"{method} {path} - {status_code}",


            context={


                'method': method,


                'path': path,


                'status_code': status_code,


                'duration_ms': duration_ms


            },


            request_id = request_id,


            user_id = user_id


        )


    def log_database_query(self, query_type: str, table: str, duration_ms: float,


                          request_id: Optional[str] = None, user_id: Optional[str] = None):


        """Log database query"""


        self.debug(


            f"Database {query_type} on {table}",


            context={


                'query_type': query_type,


                'table': table,


                'duration_ms': duration_ms


            },


            request_id = request_id,


            user_id = user_id


        )


    def log_external_api_call(self, service: str, endpoint: str, status_code: int,


                            duration_ms: float, request_id: Optional[str] = None,


                            user_id: Optional[str] = None):


        """Log external API call"""


        self.information(


            f"External API call to {service}",


            context={


                'service': service,


                'endpoint': endpoint,


                'status_code': status_code,


                'duration_ms': duration_ms


            },


            request_id = request_id,


            user_id = user_id


        )


    def log_analysis_task(self, project_id: int, task_type: str, status: str,


                         duration_ms: float, request_id: Optional[str] = None,


                         user_id: Optional[str] = None):


        """Log analysis task execution"""


        self.information(


            f"Analysis task: {task_type}",


            context={


                'project_id': project_id,


                'task_type': task_type,


                'status': status,


                'duration_ms': duration_ms


            },


            request_id = request_id,


            user_id = user_id


        )


# Global logger instance


logger = StructuredLogger()


def get_logger(name: Optional[str] = None) -> StructuredLogger:


    """Get logger instance"""


    if name:


        return StructuredLogger(name)


    return logger


def configure_logging(log_level: str = "INFO", log_file: Optional[str] = None):


    """Configure global logging settings"""


    level = getattr(logging, log_level.upper(), logging.INFO)


    # Update root logger


    logging.basicConfig(


        level = level,


        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',


        handlers=[]


    )


    # Update structured logger level


    logger.logger.setLevel(level)


    for handler in logger.logger.handlers:


        if isinstance(handler, logging.FileHandler):


            handler.setLevel(level)


        else:


            handler.setLevel(level)


