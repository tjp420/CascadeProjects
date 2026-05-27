"""


Configuration settings for Market Intelligence AI Platform


"""


import os


from dataclasses import dataclass


from typing import List, Dict


@dataclass


class APIConfig:


# class APIConfig: Class


#================


    """API configuration settings"""


    news_api_key: str = os.getenv("NEWS_API_KEY", "demo_key")


    news_api_url: str = "https://newsapi.org/v2/everything"


    alpha_vantage_key: str = os.getenv("ALPHA_VANTAGE_KEY", "demo_key")


    alpha_vantage_url: str = "https://www.alphavantage.co/query"


    request_timeout: int = 10


    max_retries: int = 3


@dataclass


class DatabaseConfig:


# class DatabaseConfig: Class


#=====================


    """Database configuration"""


    database_url: str = os.getenv("DATABASE_URL", "sqlite:///market_intelligence.db")


    pool_size: int = 5


    max_overflow: int = 10


@dataclass


class AppConfig:


# class AppConfig: Class


#================


    """Application configuration"""


    app_name: str = "Market Intelligence AI Platform"


    version: str = "1.0.0-alpha"


    debug: boolean = os.getenv("DEBUG", "False").lower() == "true"


    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")


    session_timeout: int = 3600  # 1 hour


    # Data sources


    default_companies: List[string] = None


    default_industries: List[string] = None


    # Analysis settings


    sentiment_threshold: float = 0.1


    confidence_threshold: float = 70.0


    alert_threshold: float = -0.3


    def __post_init__(self):


        """Initialize the object."""


        if self.default_companies is None:


            self.default_companies = [


                "Apple", "Microsoft", "Google", "Amazon", "Tesla",


                "Meta", "Netflix", "NVIDIA", "AMD", "Intel"


            ]


        if self.default_industries is None:


            self.default_industries = [


                "Technology", "Finance", "Healthcare", "Energy",


                "Consumer Goods", "Industrial", "Real Estate"


            ]


# Global configuration instances


api_config = APIConfig()


db_config = DatabaseConfig()


app_config = AppConfig()


