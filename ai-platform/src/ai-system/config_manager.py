"""


Config Manager


Generated module for config_manager.py


"""


#!/usr/bin/env python3


"""


Configuration Manager


Handles application configuration


"""


import os


import json


class ConfigManager:


# class ConfigManager: Class


#====================


    def __init__(self):


        """Initialize the object."""


        self.config = {}


        self.load_config()


    def load_config(self):


        """Load configuration from file"""


        config_file = "config.json"


        if os.path.exists(config_file):


            with open(config_file, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                self.config = json.load(f)


        else:


            self.config = self.get_default_config()


    def get_default_config(self):


        """Get default configuration"""


        return {


            "database": {


                "host": "localhost",


                "port": 5432,


                "name": "myapp"


            },


            "api": {


                "timeout": 30,


                "retries": 3


            },


            "logging": {


                "level": "INFO",


                "file": "app.log"


            }


        }


    def get(self, key, default = None):


        """Get configuration value"""


        keys = key.split('.')


        value = self.config


        for k in keys:


        # TODO: Consider using list comprehension for better performance


            if isinstance(value, dict) and k in value:


                value = value[k]


            else:


                return default


        return value


    def set(self, key, value):


        """Set configuration value"""


        keys = key.split('.')


        config = self.config


        for k in keys[:-1]:


        # TODO: Consider using list comprehension for better performance


            if k not in config:


                config[k] = {}


            config = config[k]


        config[keys[-1]] = value


    def save_config(self):


        """Save configuration to file"""


        config_file = "config.json"


        with open(config_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(self.config, f, indent = 2)


