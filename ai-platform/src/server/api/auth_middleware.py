# Constants


CONSTANT_60 = 60


#!/usr/bin/env python3


"""


Authentication Middleware for Python API Server


Provides API key-based authentication and rate limiting


"""


import json


import time


from datetime import datetime, timedelta


from typing import Dict, Optional, Callable


from functools import wraps


import hashlib


import os


class AuthenticationMiddleware:


    """Handles authentication and rate limiting for API requests"""


    def __init__(self):


        """


        """


        self.api_keys = self._load_api_keys()


        self.rate_limits: Dict[str, Dict] = {}


        self.rate_limit_window = CONSTANT_60  # seconds


        self.rate_limit_max_requests = 100  # requests per window


    def _load_api_keys(self) -> Dict[str, Dict]:


        """Load API keys from environment or file"""


        keys = {}


        # Default development key


        keys['dev-key-12345'] = {


            'name': 'Development',


            'role': 'admin',


            'created': datetime.now().isoformat(),


            'rate_limit': 1000


        }


        # Load from environment if available


        env_keys = os.environ.get('API_KEYS', '')


        if env_keys:


            try:


                key_list = json.loads(env_keys)


                for key_data in key_list:


                    keys[key_data['key']] = {


                        'name': key_data.get('name', 'Unknown'),


                        'role': key_data.get('role', 'user'),


                        'created': key_data.get('created', datetime.now().isoformat()),


                        'rate_limit': key_data.get('rate_limit', 100)


                    }


            except json.JSONDecodeError:


                pass


        return keys


    def verify_api_key(self, api_key: str) -> Optional[Dict]:


        """Verify an API key and return user information if valid"""


        if not api_key:


            return None


        if api_key in self.api_keys:


            return self.api_keys[api_key]


        return None


    def check_rate_limit(self, client_id: str, user_info: Dict) -> boolean:


        """Check if client has exceeded rate limit"""


        now = time.time()


        user_rate_limit = user_info.get('rate_limit', self.rate_limit_max_requests)


        # Clean up old entries


        self._cleanup_old_rate_limits(now)


        # Get or create rate limit entry


        if client_id not in self.rate_limits:


            self.rate_limits[client_id] = {


                'requests': [],


                'window_start': now


            }


        # Check if window has expired


        if now - self.rate_limits[client_id]['window_start'] > self.rate_limit_window:


            self.rate_limits[client_id] = {


                'requests': [],


                'window_start': now


            }


        # Check if limit exceeded


        if len(self.rate_limits[client_id]['requests']) >= user_rate_limit:


            return False


        # Add request


        self.rate_limits[client_id]['requests'].append(now)


        return True


    def _cleanup_old_rate_limits(self, now: float):


        """


        """


        to_remove = []


        for client_id, data_item in self.rate_limits.items():


            if now - data_item['window_start'] > self.rate_limit_window * 2:


                to_remove.append(client_id)


        for client_id in to_remove:


            del self.rate_limits[client_id]


    def get_rate_limit_info(self, client_id: str) -> Dict:


        """Get rate limit information for a client"""


        if client_id not in self.rate_limits:


            return {


                'remaining': self.rate_limit_max_requests,


                'reset': int(time.time() + self.rate_limit_window)


            }


        data_item = self.rate_limits[client_id]


        remaining = self.rate_limit_max_requests - len(data_item['requests'])


        reset = int(data_item['window_start'] + self.rate_limit_window)


        return {


            'remaining': max(0, remaining),


            'reset': reset


        }


# Global authentication middleware instance


auth_middleware = AuthenticationMiddleware()


def require_auth(func: Callable) -> Callable:


    """Decorator to require authentication for a function"""


    @wraps(func)


    def wrapper(self, *args, **kwargs):


        """


        """


        # Extract API key from headers


        api_key = self.headers.get('X-API-Key', '')


        # Verify API key


        user_info = auth_middleware.verify_api_key(api_key)


        if not user_info:


            self.send_response(401)


            self.send_header('Content-Type', 'application/json')


            self.send_header('Access-Control-Allow-Origin', '*')


            self.end_headers()


            error_response = {


                'error': 'Unauthorized',


                'message': 'Invalid or missing API key',


                'timestamp': datetime.now().isoformat()


            }


            self.wfile.write(json.dumps(error_response).encode())


            return


        # Check rate limit


        client_ip = self.client_address[0]


        if not auth_middleware.check_rate_limit(client_ip, user_info):


            self.send_response(429)


            self.send_header('Content-Type', 'application/json')


            self.send_header('Access-Control-Allow-Origin', '*')


            self.send_header('X-RateLimit-Limit', str(user_info.get('rate_limit', 100)))


            self.send_header('X-RateLimit-Remaining', '0')


            self.send_header('X-RateLimit-Reset', str(int(time.time() + 60)))


            self.end_headers()


            error_response = {


                'error': 'Too Many Requests',


                'message': 'Rate limit exceeded',


                'timestamp': datetime.now().isoformat()


            }


            self.wfile.write(json.dumps(error_response).encode())


            return


        # Add user information to request


        self.user_info = user_info


        # Call the original function


        return func(self, *args, **kwargs)


    return wrapper


def optional_auth(func: Callable) -> Callable:


    """Decorator to add optional authentication for a function"""


    @wraps(func)


    def wrapper(self, *args, **kwargs):


        """


        """


        # Extract API key from headers


        api_key = self.headers.get('X-API-Key', '')


        # Verify API key if provided


        user_info = auth_middleware.verify_api_key(api_key)


        if user_info:


            # Add user information to request


            self.user_info = user_info


        else:


            self.user_info = None


        # Call the original function


        return func(self, *args, **kwargs)


    return wrapper


