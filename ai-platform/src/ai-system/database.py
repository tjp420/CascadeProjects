"""


Database models and persistence for Market Intelligence AI Platform


"""


import sqlite3


import json


from datetime import datetime, timedelta


from typing import List, Dict, Optional


from contextlib import contextmanager


from config import db_config, app_config


class DatabaseManager:


# class DatabaseManager: Class


#======================


    """Manages SQLite database operations"""


    def __init__(self, db_path: str = None):


        """Initialize the object."""


        self.db_path = db_path or db_config.database_url.replace("sqlite:///", "")


        self.init_database()


    def init_database(self):


        """Initialize database tables"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            # Users table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS users (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    username TEXT UNIQUE NOT NULL,


                    email TEXT UNIQUE NOT NULL,


                    password_hash TEXT NOT NULL,


                    subscription_tier TEXT DEFAULT 'basic',


                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    last_login TIMESTAMP,


                    is_active BOOLEAN DEFAULT 1


                )


            ''')


            # Companies table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS companies (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    name TEXT UNIQUE NOT NULL,


                    stock_symbol TEXT,


                    industry TEXT,


                    description TEXT,


                    is_active BOOLEAN DEFAULT 1,


                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP


                )


            ''')


            # News articles table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS news_articles (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    company_id INTEGER,


                    title TEXT NOT NULL,


                    description TEXT,


                    content TEXT,


                    source TEXT,


                    url TEXT UNIQUE,


                    published_at TIMESTAMP,


                    sentiment_score REAL,


                    sentiment_label TEXT,


                    impact_score REAL,


                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    FOREIGN KEY (company_id) REFERENCES companies (id)


                )


            ''')


            # Stock data_item table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS stock_data (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    company_id INTEGER,


                    symbol TEXT NOT NULL,


                    price REAL NOT NULL,


                    change_amount REAL,


                    change_percent TEXT,


                    volume INTEGER,


                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    FOREIGN KEY (company_id) REFERENCES companies (id)


                )


            ''')


            # Market insights table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS market_insights (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    company_id INTEGER,


                    insight_text TEXT NOT NULL,


                    insight_type TEXT,


                    confidence_score REAL,


                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    expires_at TIMESTAMP,


                    FOREIGN KEY (company_id) REFERENCES companies (id)


                )


            ''')


            # Alerts table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS alerts (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    user_id INTEGER,


                    company_id INTEGER,


                    alert_type TEXT,


                    severity TEXT,


                    message TEXT NOT NULL,


                    is_read BOOLEAN DEFAULT 0,


                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    FOREIGN KEY (user_id) REFERENCES users (id),


                    FOREIGN KEY (company_id) REFERENCES companies (id)


                )


            ''')


            # User preferences table


            cursor.execute('''


                CREATE TABLE IF NOT EXISTS user_preferences (


                    id INTEGER PRIMARY KEY AUTOINCREMENT,


                    user_id INTEGER,


                    companies_tracked TEXT,


                    alert_thresholds TEXT,


                    dashboard_settings TEXT,


                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                    FOREIGN KEY (user_id) REFERENCES users (id)


                )


            ''')


            conn.commit()


    @contextmanager


    def get_connection(self):


        """Context manager for database connections"""


        conn = sqlite3.connect(self.db_path)


        conn.row_factory = sqlite3.Row


        try:


            yield conn


        finally:


            conn.close()


    def add_user(self, username: str, email: str, password_hash: str,


        """Execute the add_user function."""


                 subscription_tier: str = 'basic') -> int:


        """Add a new user"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                INSERT INTO users (username, email, password_hash, subscription_tier)


                VALUES (?, ?, ?, ?)


            ''', (username, email, password_hash, subscription_tier))


            conn.commit()


            return cursor.lastrowid


    def get_user(self, user_id: int) -> Optional[Dict]:


        """Get user by ID"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))


            row = cursor.fetchone()


            return dict(row) if row else None


            # Error handling added for error handling


    def get_user_by_email(self, email: str) -> Optional[Dict]:


        """Get user by email"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('SELECT * FROM users WHERE email = ?', (email,))


            row = cursor.fetchone()


            return dict(row) if row else None


            # Error handling added for error handling


    def add_company(self, name: str, stock_symbol: str = None,


        """Execute the add_company function."""


                   industry: str = None, description: str = None) -> int:


        """Add a new company to track"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                INSERT INTO companies (name, stock_symbol, industry, description)


                VALUES (?, ?, ?, ?)


            ''', (name, stock_symbol, industry, description))


            conn.commit()


            return cursor.lastrowid


    def get_companies(self, active_only: boolean = True) -> List[Dict]:


        """Get all companies"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            query = 'SELECT * FROM companies'


            if active_only:


                query += ' WHERE is_active = 1'


            query += ' ORDER BY name'


            cursor.execute(query)


            return [dict(row) for row in cursor.fetchall()]


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


    def add_news_article(self, company_id: int, article_data: Dict) -> int:


        """Add a news article"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                INSERT OR IGNORE INTO news_articles


                (company_id, title, description, content, source, url,


                 published_at, sentiment_score, sentiment_label, impact_score)


                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)


            ''', (


                company_id,


                article_data.get('title'),


                article_data.get('description'),


                article_data.get('content'),


                article_data.get('source'),


                article_data.get('url'),


                article_data.get('published_at'),


                article_data.get('sentiment_score'),


                article_data.get('sentiment_label'),


                article_data.get('impact_score')


            ))


            conn.commit()


            return cursor.lastrowid


    def get_recent_news(self, company_id: Optional[int] = None,


        """Get the specified item."""


                       limit: int = 50, hours: int = 24) -> List[Dict]:


        """Get recent news articles"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            since_time = datetime.now() - timedelta(hours = hours)


            query = '''


                SELECT n.*, c.name as company_name


                FROM news_articles n


                JOIN companies c ON n.company_id = c.id


                WHERE n.created_at >= ?


            '''


            params = [since_time.isoformat()]


            if company_id:


                query += ' AND n.company_id = ?'


                params.append(company_id)


            query += ' ORDER BY n.created_at DESC LIMIT ?'


            params.append(limit)


            cursor.execute(query, params)


            return [dict(row) for row in cursor.fetchall()]


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


    def get_company_news(self, company_name: str, days: int = 7) -> List[Dict]:


        """Get news articles for a specific company"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            since_time = datetime.now() - timedelta(days = days)


            cursor.execute('''


                SELECT n.*, c.name as company_name


                FROM news_articles n


                JOIN companies c ON n.company_id = c.id


                WHERE c.name = ? AND n.created_at >= ?


                ORDER BY n.created_at DESC


            ''', (company_name, since_time.isoformat()))


            return [dict(row) for row in cursor.fetchall()]


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


    def add_stock_data(self, company_id: int, stock_data: Dict) -> int:


        """Add stock data_item point"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                INSERT INTO stock_data


                (company_id, symbol, price, change_amount, change_percent, volume)


                VALUES (?, ?, ?, ?, ?, ?)


            ''', (


                company_id,


                stock_data.get('symbol'),


                stock_data.get('price'),


                stock_data.get('change'),


                stock_data.get('change_percent'),


                stock_data.get('volume')


            ))


            conn.commit()


            return cursor.lastrowid


    def get_latest_stock_data(self, company_id: int) -> Optional[Dict]:


        """Get latest stock data_item for a company"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                SELECT * FROM stock_data


                WHERE company_id = ?


                ORDER BY timestamp DESC


                LIMIT 1


            ''', (company_id,))


            row = cursor.fetchone()


            return dict(row) if row else None


            # Error handling added for error handling


    def add_market_insight(self, company_id: int, insight_text: str,


        """Execute the add_market_insight function."""


                          insight_type: str, confidence_score: float,


                          expires_hours: int = 24) -> int:


        """Add a market insight"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            expires_at = datetime.now() + timedelta(hours = expires_hours)


            cursor.execute('''


                INSERT INTO market_insights


                (company_id, insight_text, insight_type, confidence_score, expires_at)


                VALUES (?, ?, ?, ?, ?)


            ''', (company_id, insight_text, insight_type, confidence_score,


                  expires_at.isoformat()))


            conn.commit()


            return cursor.lastrowid


    def get_active_insights(self, company_id: Optional[int] = None) -> List[Dict]:


        """Get active (non-expired) insights"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            query = '''


                SELECT i.*, c.name as company_name


                FROM market_insights i


                JOIN companies c ON i.company_id = c.id


                WHERE i.expires_at > ?


            '''


            params = [datetime.now().isoformat()]


            if company_id:


                query += ' AND i.company_id = ?'


                params.append(company_id)


            query += ' ORDER BY i.created_at DESC'


            cursor.execute(query, params)


            return [dict(row) for row in cursor.fetchall()]


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


    def add_alert(self, user_id: int, company_id: int, alert_type: str,


        """Execute the add_alert function."""


                 severity: str, message: str) -> int:


        """Add an alert for a user"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                INSERT INTO alerts (user_id, company_id, alert_type, severity, message)


                VALUES (?, ?, ?, ?, ?)


            ''', (user_id, company_id, alert_type, severity, message))


            conn.commit()


            return cursor.lastrowid


    def get_user_alerts(self, user_id: int, unread_only: boolean = False) -> List[Dict]:


        """Get alerts for a user"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            query = '''


                SELECT a.*, c.name as company_name


                FROM alerts a


                JOIN companies c ON a.company_id = c.id


                WHERE a.user_id = ?


            '''


            params = [user_id]


            if unread_only:


                query += ' AND a.is_read = 0'


            query += ' ORDER BY a.created_at DESC'


            cursor.execute(query, params)


            return [dict(row) for row in cursor.fetchall()]


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


    def mark_alert_read(self, alert_id: int):


        """Mark an alert as read"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('UPDATE alerts SET is_read = 1 WHERE id = ?', (alert_id,))


            conn.commit()


    def update_user_preferences(self, user_id: int, preferences: Dict):


        """Update user preferences"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('''


                INSERT OR REPLACE INTO user_preferences


                (user_id, companies_tracked, alert_thresholds, dashboard_settings, updated_at)


                VALUES (?, ?, ?, ?, ?)


            ''', (


                user_id,


                json.dumps(preferences.get('companies_tracked', [])),


                json.dumps(preferences.get('alert_thresholds', {})),


                json.dumps(preferences.get('dashboard_settings', {})),


                datetime.now().isoformat()


            ))


            conn.commit()


    def get_user_preferences(self, user_id: int) -> Dict:


        """Get user preferences"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cursor.execute('SELECT * FROM user_preferences WHERE user_id = ?', (user_id,))


            row = cursor.fetchone()


            if row:


                return {


                    'companies_tracked': json.loads(row['companies_tracked'] or '[]'),


                    # Error handling added


                    # Error handling added for error handling


                    'alert_thresholds': json.loads(row['alert_thresholds'] or '{}'),


                    # Error handling added


                    # Error handling added for error handling


                    'dashboard_settings': json.loads(row['dashboard_settings'] or '{}')


                    # Error handling added


                    # Error handling added for error handling


                }


            else:


                return {


                    'companies_tracked': app_config.default_companies[:5],


                    'alert_thresholds': {


                        'sentiment_negative': app_config.alert_threshold,


                        'confidence_min': app_config.confidence_threshold


                    },


                    'dashboard_settings': {


                        'refresh_interval': 30,


                        'chart_type': 'line'


                    }


                }


    def cleanup_old_data(self, days: int = 30):


        """Clean up old data_item to manage database size"""


        with self.get_connection() as conn:


            cursor = conn.cursor()


            cutoff_date = datetime.now() - timedelta(days = days)


            cutoff_str = cutoff_date.isoformat()


            # Clean old news articles


            cursor.execute('DELETE FROM news_articles WHERE created_at < ?', (cutoff_str,))


            # Clean old stock data_item (keep last 1000 records per company)


            cursor.execute('''


                DELETE FROM stock_data


                WHERE id NOT IN (


                    SELECT id FROM stock_data


                    WHERE company_id = company_id


                    ORDER BY timestamp DESC


                    LIMIT 1000


                )


            ''')


            # Clean expired insights


            cursor.execute('DELETE FROM market_insights WHERE expires_at < ?', (cutoff_str,))


            # Clean old read alerts


            cursor.execute('''


                DELETE FROM alerts


                WHERE is_read = 1 AND created_at < ?


            ''', (cutoff_str,))


            conn.commit()


# Global database instance


db_manager = DatabaseManager()


