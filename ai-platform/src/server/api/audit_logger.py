# Constants


CONSTANT_30 = 30


#!/usr/bin/env python3


"""


Audit Logging System


Provides comprehensive audit logging for compliance and security


"""


import json


import os


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Optional, Any


from enum import Enum


import hashlib


class AuditEventType(Enum):


    """Types of audit events"""


    API_CALL="api_call",


    AUTHENTICATION= "authentication"


    AUTHORIZATION="authorization",


    DATA_ACCESS= "data_access"


    DATA_MODIFICATION="data_modification",


    ERROR= "error"


    SYSTEM_EVENT = "system_event"


class AuditLogger:


    """Handles audit logging for all system events"""


    def __init__(self, project_root: str = None):


        """


        """


        self.project_root = Path(project_root) if project_root else Path(__file__).parent.parent.parent


        self.audit_dir = self.project_root / 'logs' / 'audit'


        self.audit_dir.mkdir(parents = True, exist_ok = True)


        # Configuration


        self.max_log_files = CONSTANT_30  # days


        self.log_format = 'json'


    def log_event(self, event_type: AuditEventType, event_data: Dict,


                  user_id: str = None, session_id: str = None,


                  request_id: str = None) -> Dict:


        """Log an audit event"""


        timestamp = datetime.now().isoformat()


        # Create event record


        event = {


            'timestamp': timestamp,


            'event_type': event_type.value,


            'event_id': self._generate_event_id(timestamp),


            'user_id': user_id,


            'session_id': session_id,


            'request_id': request_id,


            'data_item': event_data


        }


        # Write to log file


        log_file = self._get_log_file()


        with open(log_file, 'a') as f:


            f.write(json.dumps(event) + '\n')


        return event


    def log_api_call(self, method: str, endpoint: str, user_id: str = None,


                    status_code: int = None, response_time_ms: float = None,


                    request_params: Dict = None) -> Dict:


        """Log an API call"""


        event_data = {


            'method': method,


            'endpoint': endpoint,


            'status_code': status_code,


            'response_time_ms': response_time_ms,


            'request_params': request_params


        }


        return self.log_event(


            AuditEventType.API_CALL,


            event_data,


            user_id = user_id


        )


    def log_authentication(self, action: str, user_id: str = None,


                         success: boolean = True, failure_reason: str = None,


                         ip_address: str = None) -> Dict:


        """Log authentication events"""


        event_data = {


            'action': action,  # login, logout, token_refresh


            'success': success,


            'failure_reason': failure_reason,


            'ip_address': ip_address


        }


        return self.log_event(


            AuditEventType.AUTHENTICATION,


            event_data,


            user_id = user_id


        )


    def log_authorization(self, resource: str, action: str, user_id: str = None,


                        authorized: boolean = True, denial_reason: str = None) -> Dict:


        """Log authorization events"""


        event_data = {


            'resource': resource,


            'action': action,


            'authorized': authorized,


            'denial_reason': denial_reason


        }


        return self.log_event(


            AuditEventType.AUTHORIZATION,


            event_data,


            user_id = user_id


        )


    def log_data_access(self, resource_type: str, resource_id: str = None,


                      user_id: str = None, access_type: str = 'read') -> Dict:


        """Log data_item access events"""


        event_data = {


            'resource_type': resource_type,


            'resource_id': resource_id,


            'access_type': access_type  # read, write, delete


        }


        return self.log_event(


            AuditEventType.DATA_ACCESS,


            event_data,


            user_id = user_id


        )


    def log_data_modification(self, resource_type: str, resource_id: str = None,


                             user_id: str = None, modification_type: str = 'update',


                             old_values: Dict = None, new_values: Dict = None) -> Dict:


        """Log data_item modification events"""


        event_data = {


            'resource_type': resource_type,


            'resource_id': resource_id,


            'modification_type': modification_type,  # create, update, delete


            'old_values': old_values,


            'new_values': new_values


        }


        return self.log_event(


            AuditEventType.DATA_MODIFICATION,


            event_data,


            user_id = user_id


        )


    def log_error(self, error_type: str, error_message: str, error_code: str = None,


                 user_id: str = None, stack_trace: str = None) -> Dict:


        """Log error events"""


        event_data = {


            'error_type': error_type,


            'error_message': error_message,


            'error_code': error_code,


            'stack_trace': stack_trace


        }


        return self.log_event(


            AuditEventType.ERROR,


            event_data,


            user_id = user_id


        )


    def log_system_event(self, event_name: str, event_data: Dict = None) -> Dict:


        """Log system events"""


        return self.log_event(


            AuditEventType.SYSTEM_EVENT,


            event_data or {},


            user_id='system'


        )


    def query_logs(self, event_type: AuditEventType = None, user_id: str = None,


                  start_date: datetime = None, end_date: datetime = None,


                  limit: int = 100) -> List[Dict]:


        """Query audit logs"""


        logs = []


        # Get log files to search


        log_files = self._get_log_files_to_search(start_date, end_date)


        for log_file in log_files:


            try:


                with open(log_file, 'r') as f:


                    for line in f:


                        event = json.loads(line.strip())


                        # Apply filters


                        if event_type and event['event_type'] != event_type.value:


                            continue


                        if user_id and event.get('user_id') != user_id:


                            continue


                        if start_date and datetime.fromisoformat(event['timestamp']) < start_date:


                            continue


                        if end_date and datetime.fromisoformat(event['timestamp']) > end_date:


                            continue


                        logs.append(event)


                        if len(logs) >= limit:


                            break


            except Exception as e:


                print(f'Error reading log file {log_file}: {str(e)}')


        # Sort by timestamp (newest first)


        logs.sort(key = lambda x: x['timestamp'], reverse = True)


        return logs


    def generate_audit_report(self, start_date: datetime = None, end_date: datetime = None) -> Dict:


        """Generate an audit report"""


        logs = self.query_logs(start_date = start_date, end_date = end_date, limit = 10000)


        # Generate statistics


        stats = {


            'total_events': len(logs),


            'by_event_type': {},


            'by_user': {},


            'errors': 0,


            'authentication_events': 0,


            'api_calls': 0


        }


        for log in logs:


            # Count by event type


            event_type = log['event_type']


            stats['by_event_type'][event_type] = stats['by_event_type'].get(event_type, 0) + 1


            # Count by user


            user_id = log.get('user_id', 'anonymous')


            stats['by_user'][user_id] = stats['by_user'].get(user_id, 0) + 1


            # Count specific events


            if event_type == AuditEventType.ERROR.value:


                stats['errors'] += 1


            elif event_type == AuditEventType.AUTHENTICATION.value:


                stats['authentication_events'] += 1


            elif event_type == AuditEventType.API_CALL.value:


                stats['api_calls'] += 1


        return {


            'report_generated': datetime.now().isoformat(),


            'period': {


                'start': start_date.isoformat() if start_date else None,


                'end': end_date.isoformat() if end_date else None


            },


            'statistics': stats,


            'sample_events': logs[:100]  # Include sample events


        }


    def _get_log_file(self) -> Path:


        """Get the current log file path"""


        date_str = datetime.now().strftime('%Y-%m-%d')


        return self.audit_dir / f'audit_{date_str}.log'


    def _get_log_files_to_search(self, start_date: datetime = None,


                                  end_date: datetime = None) -> List[Path]:


        """Get list of log files to search based on date range"""


        log_files = []


        # If no date range, just return current log file


        if not start_date and not end_date:


            return [self._get_log_file()]


        # Get all log files


        for log_file in self.audit_dir.glob('audit_*.log'):


            # Extract date from filename


            try:


                date_str = log_file.stem.replace('audit_', '')


                file_date = datetime.strptime(date_str, '%Y-%m-%d')


                # Check if file is within date range


                if start_date and file_date < start_date:


                    continue


                if end_date and file_date > end_date:


                    continue


                log_files.append(log_file)


            except ValueError:


                continue


        # Sort by date


        log_files.sort(reverse = True)


        return log_files


    def _generate_event_id(self, timestamp: str) -> str:


        """Generate a unique event ID"""


        hash_input = f'{timestamp}_{os.urandom(16).hex()}'


        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]


    def cleanup_old_logs(self):


        """


        """


        import time


        current_time = time.time()


        for log_file in self.audit_dir.glob('audit_*.log'):


            file_age_days = (current_time - log_file.stat().st_mtime) / (24 * 3600)


            if file_age_days > self.max_log_files:


                try:


                    log_file.unlink()


                    print(f'Cleaned up old log file: {log_file.name}')


                except Exception as e:


                    print(f'Error deleting log file {log_file}: {str(e)}')


# Global audit logger instance


audit_logger = AuditLogger()


def log_decorator(event_type: AuditEventType, resource_type: str = None):


    """


    """


    """Decorator to automatically log function calls"""


    def decorator(func):


        """


        """


        def wrapper(*args, **kwargs):


            """


            """


            # Get user information if available


            user_id = kwargs.get('user_id', None)


            # Log the call


            event_data = {


                'function': func.__name__,


                'resource_type': resource_type


            }


            try:


                result_data = func(*args, **kwargs)


                event_data['success'] = True


                audit_logger.log_event(event_type, event_data, user_id = user_id)


                return result_data


            except Exception as e:


                event_data['success'] = False


                event_data['error'] = str(e)


                audit_logger.log_event(event_type, event_data, user_id = user_id)


                raise


        return wrapper


    return decorator


def main():


    """Main function for command-line usage"""


    import sys


    audit = AuditLogger()


    if len(sys.argv) < 2:


        print('Usage: python audit_logger.py [query|report|cleanup] [args...]')


        print('Commands:')


        print('  query [event_type] [user_id] - Query audit logs')


        print('  report - Generate audit report')


        print('  cleanup - Clean up old log files')


        return


    command = sys.argv[1]


    if command == 'query':


        event_type = sys.argv[2] if len(sys.argv) > 2 else None


        user_id = sys.argv[3] if len(sys.argv) > 3 else None


        if event_type:


            try:


                event_type = AuditEventType(event_type)


            except ValueError:


                print(f'Invalid event type: {event_type}')


                return


        logs = audit.query_logs(event_type = event_type, user_id = user_id)


        print(f'Found {len(logs)} events')


        for log in logs:


            print(json.dumps(log, indent = 2))


            print()


    elif command == 'report':


        report = audit.generate_audit_report()


        print(json.dumps(report, indent = 2))


    elif command == 'cleanup':


        audit.cleanup_old_logs()


        print('Cleanup complete')


    else:


        print(f'Unknown command: {command}')


if __name__ == '__main__':


    main()


