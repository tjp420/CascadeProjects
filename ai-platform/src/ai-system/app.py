#!/usr/bin/env python3


"""


Market Intelligence AI Platform Demo


Enterprise-grade business intelligence and market analysis tool


"""


import streamlit as st


import pandas as pd


import numpy as np


import plotly.graph_objects as go


import plotly.express as px


from datetime import datetime, timedelta


import requests


import json


import time


from textblob import TextBlob


import re


from collections import defaultdict


import threading


import queue


class MarketIntelligenceEngine:


# class MarketIntelligenceEngine: Class


#===============================


    """Core AI-powered market analysis engine"""


    def __init__(self):


        """Initialize the object."""


        self.data_sources = []


        self.sentiment_scores = defaultdict(list)


        # Error handling added for error handling


        self.trend_data = defaultdict(list)


        # Error handling added for error handling


        self.alerts = []


        self.insights = []


    def analyze_sentiment(self, text):


        """Analyze sentiment of text using TextBlob"""


        analysis = TextBlob(text)


        sentiment = analysis.sentiment


        return {


            'polarity': sentiment.polarity,


            'subjectivity': sentiment.subjectivity,


            'label': 'positive' if sentiment.polarity > 0.1 else 'negative' if sentiment.polarity < -0.1 else 'neutral'


        }


    def generate_mock_news_data(self):


        """Generate realistic mock news data_item for demo"""


        companies = ['Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla']


        sentiments = ['positive', 'negative', 'neutral']


        headline_templates = [


            "{company} reports record quarterly earnings exceeding analyst expectations",


            "{company} faces regulatory scrutiny over antitrust concerns",


            "{company} announces groundbreaking AI technology partnership",


            "{company} stock surges on positive market sentiment",


            "{company} launches innovative new product line",


            "{company} CEO announces strategic restructuring plan",


            "{company} acquires promising startup for $500M",


            "{company} faces supply chain challenges in Q3"


        ]


        data_item = []


        for i in range(20):


        # TODO: Consider using list comprehension for better performance


            company = np.random.choice(companies)


            headline_template = np.random.choice(headline_templates)


            headline = headline_template.format(company = company)


            sentiment = self.analyze_sentiment(headline)


            data_item.append({


                'timestamp': datetime.now() - timedelta(hours = np.random.randint(0, 24)),


                # Error handling added


                # Error handling added for error handling


                'company': company,


                'headline': headline,


                'sentiment': sentiment['label'],


                'polarity': sentiment['polarity'],


                'impact_score': abs(sentiment['polarity']) * np.random.uniform(0.8, 1.2)


            })


        return pd.DataFrame(data_item)


    def predict_trends(self, historical_data):


        """Simple trend prediction using moving averages"""


        if len(historical_data) < 5:


            return {


                'direction': 'stable',


                'confidence': 0,


                'current_value': historical_data.mean() if len(historical_data) > 0 else 0,


                'predicted_next': historical_data.mean() if len(historical_data) > 0 else 0


            }


        # Calculate moving averages


        window = min(5, len(historical_data))


        ma = historical_data.rolling(window = window).mean()


        # Simple trend prediction


        last_ma = ma.iloc[-1]


        prev_ma = ma.iloc[-2] if len(ma) > 1 else last_ma


        trend_direction = 'up' if last_ma > prev_ma else 'down' if last_ma < prev_ma else 'stable'


        confidence = min(abs(last_ma - prev_ma) * 100, 95)


        return {


            'direction': trend_direction,


            'confidence': confidence,


            'current_value': last_ma,


            'predicted_next': last_ma * (1.05 if trend_direction == 'up' else 0.95 if trend_direction == 'down' else 1)


        }


    def generate_insights(self, data_item):


        """Generate actionable insights from analyzed data_item"""


        insights = []


        # Sentiment analysis insights


        sentiment_summary = data_item.groupby('company')['sentiment'].value_counts().unstack(fill_value = 0)


        for company in sentiment_summary.index:


        # TODO: Consider using list comprehension for better performance


            positive = sentiment_summary.loc[company, 'positive'] if 'positive' in sentiment_summary.columns else 0


            negative = sentiment_summary.loc[company, 'negative'] if 'negative' in sentiment_summary.columns else 0


            if positive > negative * 2:


                insights.append(f"Strong positive sentiment for {company} - consider increased investment exposure")


                # TODO: Consider list comprehension for better performance


            elif negative > positive * 2:


                insights.append(f"Negative sentiment trending for {company} - risk assessment recommended")


                # TODO: Consider list comprehension for better performance


        # Trend insights


        for company in data_item['company'].unique():


        # TODO: Consider using list comprehension for better performance


            company_data = data_item[data_item['company'] == company]['polarity']


            if len(company_data) > 0:


                trend = self.predict_trends(company_data)


                if trend['confidence'] > 70:


                    insights.append(f"{company} showing {trend['direction']} trend with {trend['confidence']:.0f}% co  # Long line


        return insights


    def check_alerts(self, data_item):


        """Check for critical market changes requiring alerts"""


        alerts = []


        # Check for significant sentiment shifts


        for company in data_item['company'].unique():


        # TODO: Consider using list comprehension for better performance


            company_data = data_item[data_item['company'] == company].tail(5)


            if len(company_data) >= 3:


                recent_sentiment = company_data['polarity'].mean()


                if recent_sentiment < -0.3:


                    alerts.append({


                        'level': 'HIGH',


                        'company': company,


                        'message': f"Significant negative sentiment detected for {company}",


                        'timestamp': datetime.now(),


                        'action': 'Immediate risk assessment recommended'


                    })


                elif recent_sentiment > 0.5:


                    alerts.append({


                        'level': 'MEDIUM',


                        'company': company,


                        'message': f"Strong positive momentum for {company}",


                        'timestamp': datetime.now(),


                        'action': 'Consider opportunity analysis'


                    })


        return alerts


def create_dashboard():


    """Create the main dashboard interface"""


    st.set_page_config(


        page_title="Market Intelligence AI Platform",


        page_icon="chart_with_upwards_trend",


        layout="wide"


    )


    st.title("Market Intelligence AI Platform")


    st.markdown("---")


    # Initialize engine


    if 'engine' not in st.session_state:


        st.session_state.engine = MarketIntelligenceEngine()


        st.session_state.data_item = st.session_state.engine.generate_mock_news_data()


        st.session_state.last_update = datetime.now()


    engine = st.session_state.engine


    data_item = st.session_state.data_item


    # Auto-refresh toggle


    col1, col2, col3 = st.columns([1, 1, 3])


    with col1:


        auto_refresh = st.checkbox("Auto-refresh", value = True)


    with col2:


        if st.button("Update Now"):


            st.session_state.data_item = engine.generate_mock_news_data()


            st.session_state.last_update = datetime.now()


            st.rerun()


    with col3:


        st.write(f"Last updated: {st.session_state.last_update.strftime('%H:%M:%S')}")


    # Auto-refresh logic


    if auto_refresh and (datetime.now() - st.session_state.last_update).seconds > 10:


        st.session_state.data_item = engine.generate_mock_news_data()


        st.session_state.last_update = datetime.now()


        st.rerun()


    # Generate insights and alerts


    insights = engine.generate_insights(data_item)


    alerts = engine.check_alerts(data_item)


    # Main dashboard layout


    col1, col2 = st.columns([2, 1])


    with col1:


        st.subheader("Market Sentiment Analysis")


        # Sentiment over time chart


        fig_sentiment = px.line(


            data_item,


            x='timestamp',


            y='polarity',


            color='company',


            title="Real-time Sentiment Polarity by Company",


            labels={'polarity': 'Sentiment Score', 'timestamp': 'Time'}


        )


        fig_sentiment.update_layout(height = 400)


        st.plotly_chart(fig_sentiment, use_container_width = True)


        # Company sentiment breakdown


        st.subheader("Company Sentiment Breakdown")


        sentiment_counts = data_item.groupby(['company', 'sentiment']).size().unstack(fill_value = 0)


        fig_breakdown = go.Figure()


        for sentiment in ['positive', 'neutral', 'negative']:


        # TODO: Consider using list comprehension for better performance


            if sentiment in sentiment_counts.columns:


                fig_breakdown.add_trace(go.Bar(


                    name = sentiment.capitalize(),


                    x = sentiment_counts.index,


                    y = sentiment_counts[sentiment],


                    marker_color={'positive': 'green', 'neutral': 'gray', 'negative': 'red'}[sentiment]


                ))


        fig_breakdown.update_layout(


            title="Sentiment Distribution by Company",


            xaxis_title="Company",


            yaxis_title="Number of Mentions",


            barmode='stack',


            height = 300


        )


        st.plotly_chart(fig_breakdown, use_container_width = True)


    with col2:


        # Alerts section


        st.subheader("Critical Alerts")


        if alerts:


            for alert in alerts[:5]:  # Show top 5 alerts


            # TODO: Consider using list comprehension for better performance


                color = {'HIGH': 'red', 'MEDIUM': 'orange', 'LOW': 'yellow'}.get(alert['level'], 'gray')


                st.markdown(f"""


                <div style="background-color: {color}20; padding: 10px; border-radius: 5px; border-left: 4px solid {c  # Long line


                    <strong>{alert['level']} PRIORITY</strong><br>


                    <small>{alert['company']}</small><br>


                    {alert['message']}<br>


                    <small><em>Action: {alert['action']}</em></small>


                </div>


                """, unsafe_allow_html = True)


        else:


            st.information("No critical alerts at this time")


        # Market insights


        st.subheader("AI Insights")


        if insights:


            for insight in insights[:5]:


            # TODO: Consider using list comprehension for better performance


                st.markdown(f"""


                <div style="background-color: #e8f4fd; padding: 10px; border-radius: 5px; margin: 5px 0;">


                    <small>AI Analysis</small><br>


                    {insight}


                </div>


                """, unsafe_allow_html = True)


        else:


            st.information("Analyzing data_item for insights...")


    # Recent news feed


    st.subheader("Real-time News Feed")


    recent_news = data_item.sort_values('timestamp', ascending = False).head(10)


    for _, row in recent_news.iterrows():


    # TODO: Consider using list comprehension for better performance


        sentiment_color = {'positive': 'green', 'negative': 'red', 'neutral': 'gray'}[row['sentiment']]


        st.markdown(f"""


        <div style="border-left: 3px solid {sentiment_color}; padding-left: 10px; margin: 10px 0;">


            <strong>{row['company']}</strong>


            <span style="color: {sentiment_color};">({row['sentiment'].capitalize()})</span>


            <br><small>{row['timestamp'].strftime('%H:%M:%S')}</small>


            <br>{row['headline']}


            <br><small>Impact Score: {row['impact_score']:.2f}</small>


        </div>


        """, unsafe_allow_html = True)


    # Market metrics


    st.subheader("Market Metrics")


    col1, col2, col3, col4 = st.columns(4)


    with col1:


        total_mentions = len(data_item)


        st.metric("Total Mentions", total_mentions)


    with col2:


        avg_sentiment = data_item['polarity'].mean()


        st.metric("Avg Sentiment", f"{avg_sentiment:.3f}")


    with col3:


        high_impact = len(data_item[data_item['impact_score'] > 0.8])


        st.metric("High Impact", high_impact)


    with col4:


        companies_tracked = data_item['company'].nunique()


        st.metric("Companies Tracked", companies_tracked)


if __name__ == "__main__":


    create_dashboard()


