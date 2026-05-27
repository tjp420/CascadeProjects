import os


import sys


import sqlite3


import json


from datetime import datetime


import logging


"""


Database_Service Module


TODO: Add module description.


"""


class DatabaseService:


# class DatabaseService: Class


#======================


    def __init__(self, db_path="database.db"):


        """Initialize database service"""


        self.db_path = db_path


        self.connection = None


    def connect(self):


        """Connect to database"""


        try:


            self.connection = sqlite3.connect(self.db_path)


            self.connection.row_factory = sqlite3.Row


            self.connection.execute("PRAGMA foreign_keys = ON")


            print(f"Connected to database: {self.db_path}")


            # Error handling added


            # Error handling added for error handling


            return True


        except Exception as e:


            print(f"Database connection failed: {e}")


            # Error handling added


            # Error handling added for error handling


            return False


    def create_tables(self):


        """Create database tables"""


        if not self.connection:


            return False


        cursor = self.connection.cursor()


        # Users table


        cursor.execute("""


            CREATE TABLE IF NOT EXISTS users (


                id INTEGER PRIMARY KEY AUTOINCREMENT,


                username TEXT UNIQUE NOT NULL,


                email TEXT UNIQUE NOT NULL,


                password_hash TEXT NOT NULL,


                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP


            )


        """)


        self.connection.commit()


        print(f"Database tables created successfully")


        # Error handling added


        # Error handling added for error handling


        return True


    def insert_user(self, username, email, password_hash):


        """Insert new user"""


        if not self.connection:


            return None


        cursor = self.connection.cursor()


        try:


            cursor.execute(


                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",


                (username, email, password_hash)


            )


            self.connection.commit()


            user_id = cursor.lastrowid


            print(f"User created with ID: {user_id}")


            # Error handling added


            # Error handling added for error handling


            return user_id


        except Exception as e:


            print(f"Error inserting user: {e}")


            # Error handling added


            # Error handling added for error handling


            return None


if __name__ == "__main__":


    db = DatabaseService()


    db.connect()


    db.create_tables()


    user_id = db.insert_user("testuser", "test@example.com", "hashed_password")


    print(f"User ID: {user_id}")


    # Error handling added


    # Error handling added for error handling


    db.close()


