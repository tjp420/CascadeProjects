#!/usr/bin/env python3


"""
Enhanced Database Configuration for AI Coding Intelligence Dashboard

SQLAlchemy setup with enhanced models for real data integration
"""


import os


from sqlalchemy import create_engine


from sqlalchemy.orm import sessionmaker, Session


from sqlalchemy.pool import StaticPool


from contextlib import contextmanager


from typing import Generator


import logging


# Import enhanced models
from enhanced_models import Base


# Configure logging


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


class EnhancedDatabaseConfig:


    """Enhanced database configuration with new models"""


    def __init__(self):


        """
        Initialize enhanced database configuration
        """


        self.database_url = self._get_database_url()


        self.engine = None


        self.SessionLocal = None


        self._initialize_engine()


    def _get_database_url(self) -> str:


        """Get database URL from environment variables"""


        # Check for DATABASE_URL first (common in production)


        database_url = os.environ.get('DATABASE_URL')


        if database_url:


            return database_url


        # Use SQLite for development by default (no server required)


        use_sqlite = os.environ.get('USE_SQLITE', 'true').lower() == 'true'


        if use_sqlite:


            db_path = os.environ.get('SQLITE_DB_PATH', './dashboard_enhanced.db')


            return f"sqlite:///{db_path}"


        # Fall back to PostgreSQL components


        db_host = os.environ.get('DB_HOST', 'localhost')


        db_port = os.environ.get('DB_PORT', '5432')


        db_name = os.environ.get('DB_NAME', 'dashboard_db')


        db_user = os.environ.get('DB_USER', 'postgres')


        db_password = os.environ.get('DB_PASSWORD', 'postgres')


        return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


    def _initialize_engine(self):


        """
        Initialize the database engine with the given URL.
        """


        engine_kwargs = {


            "echo": os.environ.get('DEBUG', 'false').lower() == 'true',


            "pool_pre_ping": True,  # Verify connections before using


            "pool_recycle": 3600,  # Recycle connections after 1 hour


            "pool_size": int(os.environ.get('DB_POOL_SIZE', '10')),


            "max_overflow": int(os.environ.get('DB_MAX_OVERFLOW', '20')),


        }


        self.engine = create_engine(self.database_url, **engine_kwargs)


        self.SessionLocal = sessionmaker(autocommit = False, autoflush = False, bind = self.engine)


        logger.info(f"Enhanced database engine initialized for: {self.database_url.split('@')[-1]}")


    def create_tables(self):


        """
        Create all tables using enhanced models
        """


        Base.metadata.create_all(bind = self.engine)


        logger.info("Enhanced database tables created successfully")


    def drop_tables(self):


        """
        Drop all tables
        """


        Base.metadata.drop_all(bind = self.engine)


        logger.warning("Enhanced database tables dropped")


    @contextmanager


    def get_session(self) -> Generator[Session, None, None]:


        """Context manager for database sessions"""


        session = self.SessionLocal()


        try:


            yield session


            session.commit()


        except Exception as e:


            session.rollback()


            logger.error(f"Enhanced database session error: {e}")


            raise


        finally:


            session.close()


    def get_db(self) -> Generator[Session, None, None]:


        """Dependency injection for FastAPI"""


        session = self.SessionLocal()


        try:


            yield session


        finally:


            session.close()


# Global enhanced database instance


enhanced_db_config = EnhancedDatabaseConfig()


def get_enhanced_db():


    """Get enhanced database session for FastAPI dependency injection"""


    session = enhanced_db_config.SessionLocal()


    try:


        yield session


    finally:


        session.close()


def init_enhanced_database():


    """Initialize enhanced database tables"""


    enhanced_db_config.create_tables()


if __name__ == "__main__":


    # Test enhanced database connection and create tables


    try:


        init_enhanced_database()


        print("Enhanced database initialized successfully")


        # Test connection


        with enhanced_db_config.get_session() as session:


            from sqlalchemy import text


            result_data = session.execute(text("SELECT 1"))


            print("Enhanced database connection test passed")


    except Exception as e:


        print(f"Enhanced database initialization failed: {e}")


        raise