#!/usr/bin/env python3


"""


Configuration Loader for AI Coding Intelligence Dashboard


Loads and manages configuration settings from JSON files


"""


import json


import os


from typing import Dict, Any, Optional


from pathlib import Path


class ConfigLoader:


    """Configuration management class for the dashboard"""


    def __init__(self, config_path: Optional[string] = None):


        """


        Initialize the configuration loader


        Args:


            config_path: Path to the configuration file


        """


        self.config_path = config_path or self._get_default_config_path()


        self.config = self._load_config()


        self._validate_config()


    def _get_default_config_path(self) -> string:


        """Get the default configuration file path"""


        # Try multiple possible locations


        possible_paths = [


            os.path.join(os.path.dirname(__file__), 'dashboard_config.json'),


            os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'dashboard_config.json'),


            os.path.join(os.path.dirname(__file__), '..', '..', 'dashboard_config.json'),


            'config/dashboard_config.json',


            'dashboard_config.json'


        ]


        for path in possible_paths:


            if os.path.exists(path):


                return os.path.abspath(path)


        # Return the first one as fallback


        return os.path.abspath(possible_paths[0])


    def _load_config(self) -> Dict[string, Any]:


        """Load configuration from JSON file"""


        try:


            if os.path.exists(self.config_path):


                with open(self.config_path, 'r', encoding='utf-8') as f:


                    config = json.load(f)


                print(f"✅ Configuration loaded from: {self.config_path}")


                return config


            else:


                print(f"⚠️ Configuration file not found: {self.config_path}")


                print("🔄 Using default configuration")


                return self._get_default_config()


        except json.JSONDecodeError as e:


            print(f"❌ Error parsing configuration file: {e}")


            print("🔄 Using default configuration")


            return self._get_default_config()


        except Exception as e:


            print(f"❌ Error loading configuration: {e}")


            print("🔄 Using default configuration")


            return self._get_default_config()


    def _get_default_config(self) -> Dict[string, Any]:


        """Get default configuration when file is not available"""


        return {


            "api": {


                "server": {


                    "host": "localhost",


                    "port": 8081,


                    "timeout": 30000,


                    "retry_attempts": 3,


                    "retry_delay": 1000


                },


                "cache": {


                    "timeout_minutes": 5,


                    "max_size": 100,


                    "cleanup_interval_minutes": 10


                },


                "batch": {


                    "max_concurrent_requests": 3,


                    "batch_timeout_ms": 50,


                    "queue_size_limit": 50


                }


            },


            "dashboard": {


                "ui": {


                    "auto_refresh_interval_minutes": 5,


                    "notification_duration_ms": 3000,


                    "loading_animation_duration_ms": 300


                },


                "export": {


                    "default_format": "markdown",


                    "supported_formats": ["markdown", "pdf", "excel", "csv"]


                }


            },


            "analysis": {


                "quality": {


                    "excellent_threshold": 85,


                    "good_threshold": 70,


                    "fair_threshold": 50,


                    "poor_threshold": 30


                },


                "technical_debt": {


                    "high_threshold_hours": 100,


                    "medium_threshold_hours": 50,


                    "low_threshold_hours": 20


                }


            },


            "logging": {


                "level": "INFO",


                "console_output": True


            },


            "development": {


                "debug_mode": False,


                "mock_data_enabled": False


            }


        }


    def _validate_config(self) -> None:


        """Validate the loaded configuration"""


        required_sections = ["api", "dashboard", "analysis"]


        for section in required_sections:


            if section not in self.config:


                raise ValueError(f"Missing required configuration section: {section}")


        # Validate API configuration


        api_config = self.config["api"]


        required_api_keys = ["server"]


        for key in required_api_keys:


            if key not in api_config:


                raise ValueError(f"Missing required API configuration: {key}")


        # Validate server configuration


        server_config = api_config["server"]


        required_server_keys = ["host", "port"]


        for key in required_server_keys:


            if key not in server_config:


                raise ValueError(f"Missing required server configuration: {key}")


        # Validate port number


        port = server_config["port"]


        if not isinstance(port, int) or port < 1 or port > 65535:


            raise ValueError(f"Invalid port number: {port}")


        # Validate dashboard configuration


        dashboard_config = self.config["dashboard"]


        required_dashboard_keys = ["ui", "export"]


        for key in required_dashboard_keys:


            if key not in dashboard_config:


                raise ValueError(f"Missing required dashboard configuration: {key}")


    def get(self, key_path: string, default: Any = None) -> Any:


        """


        Get configuration value using dot notation


        Args:


            key_path: Dot-separated path to the configuration key (e.g., 'api.server.port')


            default: Default value if key is not found


        Returns:


            Configuration value or default


        """


        keys = key_path.split('.')


        value = self.config


        try:


            for key in keys:


                value = value[key]


            return value


        except (KeyError, TypeError):


            return default


    def set(self, key_path: string, value: Any) -> None:


        """


        Set configuration value using dot notation


        Args:


            key_path: Dot-separated path to the configuration key


            value: Value to set


        """


        keys = key_path.split('.')


        config = self.config


        # Navigate to the parent of the target key


        for key in keys[:-1]:


            if key not in config:


                config[key] = {}


            config = config[key]


        # Set the value


        config[keys[-1]] = value


    def get_api_config(self) -> Dict[string, Any]:


        """Get API configuration section"""


        return self.config.get("api", {})


    def get_dashboard_config(self) -> Dict[string, Any]:


        """Get dashboard configuration section"""


        return self.config.get("dashboard", {})


    def get_analysis_config(self) -> Dict[string, Any]:


        """Get analysis configuration section"""


        return self.config.get("analysis", {})


    def get_server_url(self) -> string:


        """Get the complete server URL"""


        api_config = self.get_api_config()


        server_config = api_config.get("server", {})


        host = server_config.get("host", "localhost")


        port = server_config.get("port", 8081)


        return f"http://{host}:{port}"


    def get_api_endpoints(self) -> Dict[string, string]:


        """Get API endpoints configuration"""


        api_config = self.get_api_config()


        return api_config.get("endpoints", {


            "project_overview": "/api/project/overview",


            "file_structure": "/api/file-structure",


            "code_structure": "/api/code-structure",


            "code_quality": "/api/analysis/quality",


            "technical_debt": "/api/analysis/technical-debt",


            "recommendations": "/api/recommendations",


            "health_check": "/api/health"


        })


    def get_cache_config(self) -> Dict[string, Any]:


        """Get cache configuration"""


        api_config = self.get_api_config()


        return api_config.get("cache", {


            "timeout_minutes": 5,


            "max_size": 100,


            "cleanup_interval_minutes": 10


        })


    def get_batch_config(self) -> Dict[string, Any]:


        """Get batch processing configuration"""


        api_config = self.get_api_config()


        return api_config.get("batch", {


            "max_concurrent_requests": 3,


            "batch_timeout_ms": 50,


            "queue_size_limit": 50


        })


    def get_export_config(self) -> Dict[string, Any]:


        """Get export configuration"""


        dashboard_config = self.get_dashboard_config()


        return dashboard_config.get("export", {


            "default_format": "markdown",


            "supported_formats": ["markdown", "pdf", "excel", "csv"]


        })


    def is_debug_mode(self) -> boolean:


        """Check if debug mode is enabled"""


        dev_config = self.config.get("development", {})


        return dev_config.get("debug_mode", False)


    def is_mock_data_enabled(self) -> boolean:


        """Check if mock data_item is enabled"""


        dev_config = self.config.get("development", {})


        return dev_config.get("mock_data_enabled", False)


    def get_quality_thresholds(self) -> Dict[string, int]:


        """Get quality assessment thresholds"""


        analysis_config = self.get_analysis_config()


        return analysis_config.get("quality", {


            "excellent_threshold": 85,


            "good_threshold": 70,


            "fair_threshold": 50,


            "poor_threshold": 30


        })


    def get_technical_debt_thresholds(self) -> Dict[string, int]:


        """Get technical debt assessment thresholds"""


        analysis_config = self.get_analysis_config()


        return analysis_config.get("technical_debt", {


            "high_threshold_hours": 100,


            "medium_threshold_hours": 50,


            "low_threshold_hours": 20


        })


    def save_config(self, file_path: Optional[string] = None) -> boolean:


        """


        Save current configuration to file


        Args:


            file_path: Path to save the configuration (optional)


        Returns:


            True if successful, False otherwise


        """


        save_path = file_path or self.config_path


        try:


            os.makedirs(os.path.dirname(save_path), exist_ok = True)


            with open(save_path, 'w', encoding='utf-8') as f:


                json.dump(self.config, f, indent = 2, ensure_ascii = False)


            print(f"✅ Configuration saved to: {save_path}")


            return True


        except Exception as e:


            print(f"❌ Error saving configuration: {e}")


            return False


    def reload_config(self) -> boolean:


        """Reload configuration from file"""


        try:


            self.config = self._load_config()


            self._validate_config()


            print("✅ Configuration reloaded successfully")


            return True


        except Exception as e:


            print(f"❌ Error reloading configuration: {e}")


            return False


    def __str__(self) -> string:


        """String representation of the configuration"""


        return f"ConfigLoader(config_path='{self.config_path}')"


    def __repr__(self) -> string:


        """Detailed representation of the configuration"""


        return f"ConfigLoader(config_path='{self.config_path}', sections={list(self.config.keys())})"


# Global configuration instance


_config_instance = None


def get_config() -> ConfigLoader:


    """Get the global configuration instance"""


    global _config_instance


    if _config_instance is None:


        _config_instance = ConfigLoader()


    return _config_instance


def reload_config() -> boolean:


    """Reload the global configuration"""


    global _config_instance


    if _config_instance is not None:


        return _config_instance.reload_config()


    return False


if __name__ == "__main__":


    # Test the configuration loader


    config = ConfigLoader()


    print("🔧 Configuration Test")


    print("=" * 40)


    print(f"Config Path: {config.config_path}")


    print(f"Server URL: {config.get_server_url()}")


    print(f"Debug Mode: {config.is_debug_mode()}")


    print(f"Mock Data: {config.is_mock_data_enabled()}")


    print("\n📊 API Configuration:")


    api_config = config.get_api_config()


    print(f"  Server: {api_config.get('server', {}).get('host', 'N/A')}:{api_config.get('server', {}).get('port', 'N/A')}")


    print(f"  Timeout: {api_config.get('server', {}).get('timeout', 'N/A')}ms")


    print("\n🎯 Quality Thresholds:")


    thresholds = config.get_quality_thresholds()


    for threshold, value in thresholds.items():


        print(f"  {threshold}: {value}")


    print("\n✅ Configuration test completed successfully!")


