import os


import json


"""


Settings Module


TODO: Add module description.


"""


DEBUG = True


SECRET_KEY = "your-secret-key-here"


DATABASE_URL = "sqlite:///app.db"


def get_config():


    """Get the specified item."""


    return {


        "debug": DEBUG,


        "secret_key": SECRET_KEY,


        "database_url": DATABASE_URL


    }


