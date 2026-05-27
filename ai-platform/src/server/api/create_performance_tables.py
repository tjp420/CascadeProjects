#!/usr/bin/env python3
"""
Create Performance and Upload Monitoring Tables

This script creates the performance and upload monitoring tables in the database.
"""

from enhanced_database import EnhancedDatabaseConfig
from enhanced_models import Base

def create_monitoring_tables():
    """Create performance and upload monitoring tables"""
    print("Creating performance and upload monitoring tables...")
    
    # Initialize database
    db_config = EnhancedDatabaseConfig()
    
    # Create all tables (including new performance and upload monitoring tables)
    db_config.create_tables()
    
    print("Performance and upload monitoring tables created successfully")

if __name__ == "__main__":
    create_monitoring_tables()