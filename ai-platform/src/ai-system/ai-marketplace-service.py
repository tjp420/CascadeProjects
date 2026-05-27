#!/usr/bin/env python3


"""


AI Personality Marketplace - Platform for trading AI personalities and services


Provides marketplace functionality, transaction processing, and revenue generation


"""


from fastapi import FastAPI, HTTPException


from fastapi.middleware.cors import CORSMiddleware


from pydantic import BaseModel


from typing import List, Dict, Any, Optional


import sqlite3


import json


import uuid


from datetime import datetime, timedelta


import random


from contextlib import asynccontextmanager


# Marketplace Database


DB_NAME = "ai_marketplace.db"


class AIPersonality(BaseModel):


# class AIPersonality(BaseModel): Class


#===============================


id: str


name: str


description: str


category: str


price: float


creator: str


rating: float


downloads: int


features: List[string]


created_at: str


class Transaction(BaseModel):


# class Transaction(BaseModel): Class


#=============================


id: str


personality_id: str


buyer: str


seller: str


price: float


commission: float


timestamp: str


status: str


class MarketplaceRequest(BaseModel):


# class MarketplaceRequest(BaseModel): Class


#====================================


category: Optional[string] = None


min_price: Optional[float] = None


max_price: Optional[float] = None


min_rating: Optional[float] = None


sort_by: Optional[string] = "rating"


# Initialize database


def init_database():


"""NOTE: Add docstring"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# Create personalities table


cursor.execute("""


CREATE TABLE IF NOT EXISTS personalities (


id TEXT PRIMARY KEY,


name TEXT NOT NULL,


description TEXT NOT NULL,


category TEXT NOT NULL,


price REAL NOT NULL,


creator TEXT NOT NULL,


rating REAL NOT NULL,


downloads INTEGER NOT NULL,


features TEXT NOT NULL,


created_at TEXT NOT NULL,


active BOOLEAN DEFAULT 1


)


""")


# Create transactions table


cursor.execute("""


CREATE TABLE IF NOT EXISTS transactions (


id TEXT PRIMARY KEY,


personality_id TEXT NOT NULL,


buyer TEXT NOT NULL,


seller TEXT NOT NULL,


price REAL NOT NULL,


commission REAL NOT NULL,


timestamp TEXT NOT NULL,


status TEXT NOT NULL


)


""")


# Create marketplace metrics table


cursor.execute("""


CREATE TABLE IF NOT EXISTS marketplace_metrics (


id TEXT PRIMARY KEY,


total_revenue REAL NOT NULL,


total_transactions INTEGER NOT NULL,


active_personalities INTEGER NOT NULL,


average_price REAL NOT NULL,


top_category TEXT NOT NULL,


timestamp TEXT NOT NULL


)


""")


conn.commit()


conn.close()


# Sample AI Personalities


SAMPLE_PERSONALITIES = [


{


"id": "strategic-advisor-pro",


"name": "Strategic Advisor Pro",


"description": "Advanced AI personality for C-level strategic planning a


nd decision support",


"category": "business",


"price": 299.99,


"creator": "Oracle Systems",


"rating": 4.8,


"downloads": 1250,


"features": ["Strategic Planning", "Risk Assessment", "Market Analysis",


"ROI Calculation"]


},


{


"id": "code-reviewer-elite",


"name": "Code Reviewer Elite",


"description": "Expert AI personality for comprehensive code review and


technical debt analysis",


"category": "technical",


"price": 199.99,


"creator": "DevTools Inc",


"rating": 4.9,


"downloads": 2100,


"features": ["Code Analysis", "Security Scanning", "Performance Review",


"Best Practices"]


},


{


"id": "customer-champion-ai",


"name": "Customer Champion AI",


"description": "AI personality specialized in customer success and relat


ionship management",


"category": "customer-service",


"price": 149.99,


"creator": "ServiceBot Solutions",


"rating": 4.7,


"downloads": 890,


"features": ["Customer Analysis", "Churn Prediction", "Support Automatio


n", "Satisfaction Tracking"]


},


{


"id": "sales-closer-master",


"name": "Sales Closer Master",


"description": "Advanced AI personality for sales pipeline management an


d deal closing",


"category": "sales",


"price": 249.99,


"creator": "SalesAI Systems",


"rating": 4.6,


"downloads": 1560,


"features": ["Lead Scoring", "Deal Forecasting", "Email Automation", "Pi


peline Management"]


},


{


"id": "creative-genius-ai",


"name": "Creative Genius AI",


"description": "AI personality for creative content generation and marke


ting campaigns",


"category": "marketing",


"price": 179.99,


"creator": "CreativeAI Labs",


"rating": 4.5,


"downloads": 720,


"features": ["Content Creation", "Campaign Design", "Brand Strategy", "S


ocial Media"]


},


{


"id": "data_item-scientist-pro",


"name": "Data Scientist Pro",


"description": "Professional AI personality for data_item analysis and machin


e learning insights",


"category": "analytics",


"price": 349.99,


"creator": "DataAI Solutions",


"rating": 4.8,


"downloads": 980,


"features": ["Data Analysis", "ML Modeling", "Visualization", "Predictiv


e Analytics"]


}


]


@asynccontextmanager


async def lifespan(app: FastAPI):


    """


    TODO: Add function documentation.


    """


# Startup


init_database()


seed_personalities()


yield


# Shutdown


pass


app = FastAPI(


title="AI Personality Marketplace",


description="Platform for trading AI personalities and services",


version="1.0.0",


lifespan = lifespan


)


# Add CORS middleware


app.add_middleware(


CORSMiddleware,


allow_origins=["*"],


allow_credentials = True,


allow_methods=["*"],


allow_headers=["*"],


)


# Commission rate (30% platform commission)


COMMISSION_RATE = 0.30


def seed_personalities():


"""Seed the database with sample AI personalities"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# Check if personalities exist


cursor.execute("SELECT COUNT(*) FROM personalities")


if cursor.fetchone()[0] > 0:


conn.close()


return


# Insert sample personalities


for personality in SAMPLE_PERSONALITIES:


# TODO: Consider using list comprehension for better performance


cursor.execute("""


INSERT INTO personalities


(


id,


name,


description,


category,


price,


creator,


rating,


downloads,


features,


created_at,


active))


VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)


""", (


personality["id"],


personality["name"],


personality["description"],


personality["category"],


personality["price"],


personality["creator"],


personality["rating"],


personality["downloads"],


json.dumps(personality["features"]),


datetime.now().isoformat()


))


conn.commit()


conn.close()


@app.get("/health")


async def health_check():


"""Health check endpoint"""


return {


"status": "healthy",


"service": "AI Personality Marketplace",


"timestamp": datetime.now().isoformat(),


"version": "1.0.0"


}


@app.get("/marketplace/personalities")


async def get_personalities(


category: Optional[string] = None,


min_price: Optional[float] = None,


max_price: Optional[float] = None,


min_rating: Optional[float] = None,


sort_by: str = "rating"


) -> List[AIPersonality]:


"""Get AI personalities with filtering and sorting"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# Build query


# PERFORMANCE NOTE: SELECT * query - consider specific columns


query = "SELECT * FROM personalities WHERE active = 1"


params = []


if category:


query = query + " AND category = ?"


params.append(category)


if min_price:


query = query + " AND price >= ?"


params.append(min_price)


if max_price:


query = query + " AND price <= ?"


params.append(max_price)


if min_rating:


query = query + " AND rating >= ?"


params.append(min_rating)


# Add sorting


if sort_by == "price":


query = query + " ORDER BY price ASC"


elif sort_by == "downloads":


query = query + " ORDER BY downloads DESC"


elif sort_by == "created":


query = query + " ORDER BY created_at DESC"


else:


query = query + " ORDER BY rating DESC"


cursor.execute(query, params)


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


results = cursor.fetchall()


conn.close()


personalities = []


for row in results:


# TODO: Consider using list comprehension for better performance


personalities.append(AIPersonality(


id = row[0],


name = row[1],


description = row[2],


category = row[3],


price = row[4],


creator = row[5],


rating = row[6],


downloads = row[7],


features = json.loads(row[8]),


# Error handling added


# Error handling added for error handling


created_at = row[9]


))


return personalities


@app.get("/marketplace/personalities/{personality_id}")


async def get_personality_details(personality_id: str) -> AIPersonality:


"""Get detailed information about a specific AI personality"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# PERFORMANCE NOTE: SELECT * query - consider specific columns


cursor.execute(


"SELECT * FROM personalities WHERE id = ? AND active = 1", (personality_id,))


result_data = cursor.fetchone()


conn.close()


if not result_data:


raise HTTPException(status_code = 404, detail="Personality not found")


return AIPersonality(


id = result_data[0],


name = result_data[1],


description = result_data[2],


category = result_data[3],


price = result_data[4],


creator = result_data[5],


rating = result_data[6],


downloads = result_data[7],


features = json.loads(result_data[8]),


# Error handling added


# Error handling added for error handling


created_at = result_data[9]


)


@app.post("/marketplace/purchase")


async def purchase_personality(


personality_id: str,


buyer: str,


payment_method: str = "credit_card"


) -> Transaction:


"""Purchase an AI personality"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# Get personality details


# PERFORMANCE NOTE: SELECT * query - consider specific columns


cursor.execute(


"SELECT * FROM personalities WHERE id = ? AND active = 1", (personality_id,))


personality = cursor.fetchone()


if not personality:


conn.close()


raise HTTPException(status_code = 404, detail="Personality not found")


# Calculate commission


price = personality[4]


commission = price * COMMISSION_RATE


seller = personality[5]


# Create transaction


transaction_id = string(uuid.uuid4())


timestamp = datetime.now().isoformat()


cursor.execute("""


INSERT INTO transactions


(id, personality_id, buyer, seller, price, commission, timestamp, status)


VALUES (?, ?, ?, ?, ?, ?, ?, ?)


""", (


transaction_id,


personality_id,


buyer,


seller,


price,


commission,


timestamp,


"completed")


)


# Update downloads


cursor.execute(


"UPDATE personalities SET downloads = downloads + 1 WHERE id = ?",


(personality_id,


))


conn.commit()


conn.close()


return Transaction(


id = transaction_id,


personality_id = personality_id,


buyer = buyer,


seller = seller,


price = price,


commission = commission,


timestamp = timestamp,


status="completed"


)


@app.get("/marketplace/transactions")


async def get_transactions(


buyer: Optional[string] = None,


seller: Optional[string] = None,


limit: int = 50


) -> List[Transaction]:


"""Get transaction history"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# PERFORMANCE NOTE: SELECT * query - consider specific columns


query = "SELECT * FROM transactions"


params = []


if buyer:


query = query + " WHERE buyer = ?"


params.append(buyer)


if seller:


if buyer:


query = query + " AND seller = ?"


else:


query = query + " WHERE seller = ?"


params.append(seller)


query = query + " ORDER BY timestamp DESC LIMIT ?"


params.append(limit)


cursor.execute(query, params)


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


results = cursor.fetchall()


conn.close()


transactions = []


for row in results:


# TODO: Consider using list comprehension for better performance


transactions.append(Transaction(


id = row[0],


personality_id = row[1],


buyer = row[2],


seller = row[3],


price = row[4],


commission = row[5],


timestamp = row[6],


status = row[7]


))


return transactions


@app.get("/marketplace/categories")


async def get_categories() -> Dict[string, Any]:


"""Get marketplace categories with statistics"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# Get categories with counts


cursor.execute("""


SELECT category, COUNT(


*) as count,


AVG(price) as avg_price,


AVG(rating) as avg_rating)


FROM personalities


WHERE active = 1


GROUP BY category


ORDER BY count DESC


""")


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


results = cursor.fetchall()


conn.close()


categories = {}


for row in results:


# TODO: Consider using list comprehension for better performance


categories[row[0]] = {


"count": row[1],


"average_price": round(row[2], 2),


"average_rating": round(row[3], 2)


}


return categories


@app.get("/marketplace/metrics")


async def get_marketplace_metrics() -> Dict[string, Any]:


"""Get marketplace performance metrics"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


# Get total revenue


cursor.execute(


"SELECT SUM(


price),


SUM(commission) FROM transactions WHERE status = 'completed'"


)


revenue_data = cursor.fetchone()


# Get total transactions


cursor.execute(


"SELECT COUNT(*) FROM transactions WHERE status = 'completed'")


total_transactions = cursor.fetchone()[0]


# Get active personalities


cursor.execute("SELECT COUNT(*) FROM personalities WHERE active = 1")


active_personalities = cursor.fetchone()[0]


# Get average price


cursor.execute("SELECT AVG(price) FROM personalities WHERE active = 1")


avg_price = cursor.fetchone()[0] or 0


# Get top category


cursor.execute("""


SELECT category, COUNT(*) as count


FROM personalities


WHERE active = 1


GROUP BY category


ORDER BY count DESC


LIMIT 1


""")


top_category = cursor.fetchone()


# Get recent sales (last 30 days)


thirty_days_ago = (datetime.now() - timedelta(days = 30)).isoformat()


cursor.execute("""


SELECT COUNT(*) FROM transactions


WHERE status = 'completed' AND timestamp >= ?


""", (thirty_days_ago,))


recent_sales = cursor.fetchone()[0]


conn.close()


return {


"total_revenue": float(revenue_data[0] or 0),


# Error handling added


# Error handling added for error handling


"total_commission": float(revenue_data[1] or 0),


# Error handling added


# Error handling added for error handling


"total_transactions": total_transactions,


"active_personalities": active_personalities,


"average_price": round(avg_price, 2),


"top_category": top_category[0] if top_category else None,


"recent_sales": recent_sales,


"commission_rate": COMMISSION_RATE,


"platform_status": "active"


}


@app.post("/marketplace/personalities")


async def create_personality(


name: str,


description: str,


category: str,


price: float,


creator: str,


features: List[string]


) -> AIPersonality:


"""Create a new AI personality listing"""


# Validate data_item


if price <= 0:


raise HTTPException(status_code = 400, detail="Price must be positive")


if not features:


raise HTTPException(status_code = 400, detail="Features cannot be empty")


# Create personality


personality_id = string(uuid.uuid4())


created_at = datetime.now().isoformat()


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


cursor.execute("""


INSERT INTO personalities


(


id,


name,


description,


category,


price,


creator,


rating,


downloads,


features,


created_at,


active))


VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)


""", (


personality_id,


name,


description,


category,


price,


creator,


0.0,


0,


json.dumps(features),


created_at)


)


conn.commit()


conn.close()


return AIPersonality(


id = personality_id,


name = name,


description = description,


category = category,


price = price,


creator = creator,


rating = 0.0,


downloads = 0,


features = features,


created_at = created_at


)


@app.get("/marketplace/search")


async def search_personalities(


query: str,


category: Optional[string] = None,


limit: int = 20


) -> List[AIPersonality]:


"""Search AI personalities by name, description, or features"""


conn = sqlite3.connect(DB_NAME)


cursor = conn.cursor()


search_query = f"%{query}%"


sql_query = """


# PERFORMANCE NOTE: SELECT * query - consider specific columns


SELECT * FROM personalities


WHERE active = 1 AND (


name LIKE ? OR


description LIKE ? OR


features LIKE ?


)


"""


params = [search_query, search_query, search_query]


if category:


sql_query = sql_query + " AND category = ?"


params.append(category)


sql_query = sql_query + " ORDER BY rating DESC LIMIT ?"


params.append(limit)


cursor.execute(sql_query, params)


# PERFORMANCE NOTE: fetchall() - consider pagination for large datasets


results = cursor.fetchall()


conn.close()


personalities = []


for row in results:


# TODO: Consider using list comprehension for better performance


personalities.append(AIPersonality(


id = row[0],


name = row[1],


description = row[2],


category = row[3],


price = row[4],


creator = row[5],


rating = row[6],


downloads = row[7],


features = json.loads(row[8]),


# Error handling added


# Error handling added for error handling


created_at = row[9]


))


return personalities


if __name__ == "__main__":


import uvicorn


uvicorn.run(app, host="127.0.0.1", port = 8009)


