#!/usr/bin/env python3
"""
Production Environment Configuration
"""

import os

class ProductionConfig:
    """Production environment settings"""
    
    # Database Configuration
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///production.db')
    
    # Security Settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'production-secret-key')
    DEBUG = False
    
    # Performance Settings
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', '4'))
    CACHE_SIZE = int(os.getenv('CACHE_SIZE', '1000'))
    
    # Monitoring Settings
    LOG_LEVEL = 'INFO'
    METRICS_ENABLED = True
    
    # API Settings
    API_RATE_LIMIT = int(os.getenv('API_RATE_LIMIT', '1000'))
    
    @classmethod
    def validate_config(cls):
        """Validate production configuration"""
        required_vars = ['DATABASE_URL', 'SECRET_KEY']
        missing = []
        
        for var in required_vars:
            if not os.getenv(var):
                missing.append(var)
        
        if missing:
            raise ValueError(f"Missing required environment variables: {missing}")
        
        return True

if __name__ == "__main__":
    config = ProductionConfig()
    print("✅ Production configuration loaded")
