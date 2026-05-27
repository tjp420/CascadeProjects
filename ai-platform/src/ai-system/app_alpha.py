#!/usr/bin/env python3


"""


Market Intelligence AI Platform - Alpha Build


Enterprise-grade business intelligence and market analysis tool


"""


import streamlit as st


import pandas as pd


import numpy as np


import plotly.graph_objects as go


import plotly.express as px


from datetime import datetime, timedelta


import json


from textblob import TextBlob


from collections import defaultdict


# Import alpha build components


from config import app_config, api_config, db_config


from data_sources import DataAggregator


from database import db_manager


from auth import auth_manager, auth_ui


class AlphaMarketIntelligenceEngine:


# class AlphaMarketIntelligenceEngine: Class


#====================================


    """Enhanced AI-powered market analysis engine for alpha build"""


    def __init__(self):


        """Initialize the object."""


        self.data_aggregator = DataAggregator()


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


            'label': 'positive' if sentiment.polarity > app_config.sentiment_threshold else


                    'negative' if sentiment.polarity < -app_config.sentiment_threshold else 'neutral'


        }


    def get_real_market_data(self, companies):


        """Get real market data_item from APIs"""


        try:


            snapshot = self.data_aggregator.get_market_snapshot(companies)


            return self._process_market_snapshot(snapshot)


        except Exception as e:


            st.error(f"Error fetching real data_item: {e}")


            return self._get_fallback_data(companies)


    def _process_market_snapshot(self, snapshot):


        """Process market snapshot into analysis format"""


        processed_data = []


        for company, data_item in snapshot['companies'].items():


        # TODO: Consider using list comprehension for better performance


            if 'error' in data_item:


                continue


            # Process news articles


            for article in data_item.get('news', []):


            # TODO: Consider using list comprehension for better performance


                text = f"{article.get('title', '')} {article.get('description', '')}"


                sentiment = self.analyze_sentiment(text)


                processed_data.append({


                    'timestamp': article.get('published_at', datetime.now().isoformat()),


                    'company': company,


                    'headline': article.get('title', ''),


                    'sentiment': sentiment['label'],


                    'polarity': sentiment['polarity'],


                    'impact_score': abs(sentiment['polarity']) * np.random.uniform(0.8, 1.2),


                    'source': article.get('source', ''),


                    'url': article.get('url', '')


                })


        return pd.DataFrame(processed_data) if processed_data else self._get_fallback_data(snapshot['companies'].keys())


    def _get_fallback_data(self, companies):


        """Fallback data_item generation when APIs fail"""


        companies_list = list(companies) if isinstance(companies, (list, dict)) else ['Apple', 'Microsoft', 'Google']


        # Error handling added for error handling


        headline_templates = [


            "{company} reports strong quarterly performance",


            "{company} announces strategic partnership",


            "{company} faces market challenges",


            "{company} launches innovative product",


            "{company} stock shows bullish momentum"


        ]


        data_item = []


        for i in range(15):


        # TODO: Consider using list comprehension for better performance


            company = np.random.choice(companies_list)


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


                'impact_score': abs(sentiment['polarity']) * np.random.uniform(0.8, 1.2),


                'source': 'Market Intelligence AI',


                'url': f'https://example.com/news/{i}'


            })


        return pd.DataFrame(data_item)


    def predict_trends(self, historical_data):


        """Enhanced trend prediction with confidence scoring"""


        if len(historical_data) < 3:


            return {


                'direction': 'stable',


                'confidence': 0,


                'current_value': historical_data.mean() if len(historical_data) > 0 else 0,


                'predicted_next': historical_data.mean() if len(historical_data) > 0 else 0


            }


        # Calculate moving averages and momentum


        window = min(3, len(historical_data))


        ma = historical_data.rolling(window = window).mean()


        # Enhanced trend analysis


        last_ma = ma.iloc[-1]


        prev_ma = ma.iloc[-2] if len(ma) > 1 else last_ma


        # Calculate momentum and volatility


        momentum = (last_ma - prev_ma) / prev_ma if prev_ma != 0 else 0


        volatility = historical_data.std() / historical_data.mean() if historical_data.mean() != 0 else 0


        # Determine trend direction


        if momentum > 0.02:


            trend_direction = 'strong_up'


        elif momentum > 0.005:


            trend_direction = 'up'


        elif momentum < -0.02:


            trend_direction = 'strong_down'


        elif momentum < -0.005:


            trend_direction = 'down'


        else:


            trend_direction = 'stable'


        # Calculate confidence based on momentum and volatility


        base_confidence = abs(momentum) * 100


        volatility_penalty = min(volatility * 50, 30)


        confidence = max(0, min(95, base_confidence - volatility_penalty))


        # Predict next value


        trend_multiplier = 1.05 if 'up' in trend_direction else 0.95 if 'down' in trend_direction else 1


        predicted_next = last_ma * trend_multiplier


        return {


            'direction': trend_direction,


            'confidence': confidence,


            'current_value': last_ma,


            'predicted_next': predicted_next,


            'momentum': momentum,


            'volatility': volatility


        }


    def generate_insights(self, data_item, user_preferences = None):


        """Generate enhanced AI-powered insights"""


        insights = []


        # Sentiment analysis insights


        sentiment_summary = data_item.groupby('company')['sentiment'].value_counts().unstack(fill_value = 0)


        for company in sentiment_summary.index:


        # TODO: Consider using list comprehension for better performance


            positive = sentiment_summary.loc[company, 'positive'] if 'positive' in sentiment_summary.columns else 0


            negative = sentiment_summary.loc[company, 'negative'] if 'negative' in sentiment_summary.columns else 0


            total = positive + negative


            if total > 0:


                sentiment_ratio = positive / total


                if sentiment_ratio > 0.7:


                    insights.append({


                        'type': 'opportunity',


                        'company': company,


                        'message': f"Strong positive sentiment ({sentiment_ratio:.1%}) for {company} - consider incre  # Long line


                        'priority': 'high',


                        'confidence': min(sentiment_ratio * 100, 95)


                    })


                elif sentiment_ratio < 0.3:


                    insights.append({


                        'type': 'risk',


                        'company': company,


                        'message': f"Negative sentiment dominance ({(1-sentiment_ratio):.1%}) for {company} - risk as  # Long line


                        'priority': 'high',


                        'confidence': min((1-sentiment_ratio) * 100, 95)


                    })


        # Trend insights


        for company in data_item['company'].unique():


        # TODO: Consider using list comprehension for better performance


            company_data = data_item[data_item['company'] == company]['polarity']


            if len(company_data) > 0:


                trend = self.predict_trends(company_data)


                if trend['confidence'] > app_config.confidence_threshold:


                    insights.append({


                        'type': 'trend',


                        'company': company,


                        'message': f"{company} showing {trend['direction'].replace('_', ' ')} trend with {trend['conf  # Long line


                        'priority': 'medium' if trend['confidence'] > 80 else 'low',


                        'confidence': trend['confidence'],


                        'details': f"Momentum: {trend['momentum']:.3f}, Volatility: {trend['volatility']:.3f}"


                    })


        # Cross-company insights


        if len(data_item['company'].unique()) > 1:


            overall_sentiment = data_item['polarity'].mean()


            if overall_sentiment > 0.2:


                insights.append({


                    'type': 'market',


                    'company': 'Market',


                    'message': f"Bullish market sentiment detected (avg: {overall_sentiment:.3f})",


                    'priority': 'medium',


                    'confidence': abs(overall_sentiment) * 100


                })


            elif overall_sentiment < -0.2:


                insights.append({


                    'type': 'market',


                    'company': 'Market',


                    'message': f"Bearish market sentiment detected (avg: {overall_sentiment:.3f})",


                    'priority': 'medium',


                    'confidence': abs(overall_sentiment) * 100


                })


        return sorted(insights, key = lambda x: x['confidence'], reverse = True)


    def check_alerts(self, data_item, user_preferences = None):


        """Enhanced alert system with user preferences"""


        alerts = []


        alert_thresholds = user_preferences.get('alert_thresholds', {}) if user_preferences else {}


        sentiment_threshold = alert_thresholds.get('sentiment_negative', app_config.alert_threshold)


        # Check for significant sentiment shifts


        for company in data_item['company'].unique():


        # TODO: Consider using list comprehension for better performance


            company_data = data_item[data_item['company'] == company].tail(5)


            if len(company_data) >= 3:


                recent_sentiment = company_data['polarity'].mean()


                if recent_sentiment < sentiment_threshold:


                    alerts.append({


                        'level': 'HIGH',


                        'company': company,


                        'message': f"Critical negative sentiment for {company}: {recent_sentiment:.3f}",


                        'timestamp': datetime.now(),


                        'action': 'Immediate risk assessment recommended',


                        'value': recent_sentiment


                    })


                elif recent_sentiment < -0.1:


                    alerts.append({


                        'level': 'MEDIUM',


                        'company': company,


                        'message': f"Declining sentiment for {company}: {recent_sentiment:.3f}",


                        'timestamp': datetime.now(),


                        'action': 'Monitor closely',


                        'value': recent_sentiment


                    })


                elif recent_sentiment > 0.4:


                    alerts.append({


                        'level': 'MEDIUM',


                        'company': company,


                        'message': f"Strong positive momentum for {company}: {recent_sentiment:.3f}",


                        'timestamp': datetime.now(),


                        'action': 'Consider opportunity analysis',


                        'value': recent_sentiment


                    })


        # Check for unusual volatility


        for company in data_item['company'].unique():


        # TODO: Consider using list comprehension for better performance


            company_data = data_item[data_item['company'] == company]['polarity']


            if len(company_data) >= 5:


                volatility = company_data.std()


                if volatility > 0.3:


                    alerts.append({


                        'level': 'MEDIUM',


                        'company': company,


                        'message': f"High volatility detected for {company}: {volatility:.3f}",


                        'timestamp': datetime.now(),


                        'action': 'Increased market uncertainty',


                        'value': volatility


                    })


        return alerts


def create_alpha_dashboard():


    """Create enhanced alpha dashboard"""


    st.set_page_config(


        page_title="Market Intelligence AI Platform - Alpha",


        page_icon="chart_with_upwards_trend",


        layout="wide",


        initial_sidebar_state="expanded"


    )


    # Initialize session state


    if 'current_user' not in st.session_state:


        st.session_state.current_user = auth_manager.get_current_user()


    # Sidebar navigation


    with st.sidebar:


        st.title("Market Intelligence AI")


        st.markdown(f"**Version:** {app_config.version}")


        if st.session_state.current_user:


            user = st.session_state.current_user


            st.write(f"**Logged in as:** {user['username']}")


            st.write(f"**Tier:** {user['subscription_tier'].title()}")


            page = st.selectbox("Navigate", [


                "Dashboard", "Market Analysis", "Companies", "Insights", "Alerts", "Profile"


            ])


            if st.button("Logout"):


                auth_manager.logout_user()


                st.rerun()


        else:


            page = "Login"


            st.information("Please log in to access the platform")


    # Route to appropriate page


    if page == "Login":


        auth_ui.show_auth_page()


        return


    # Main dashboard (authenticated)


    if page == "Dashboard":


        show_main_dashboard()


    elif page == "Market Analysis":


        show_market_analysis()


    elif page == "Companies":


        show_companies_page()


    elif page == "Insights":


        show_insights_page()


    elif page == "Alerts":


        show_alerts_page()


    elif page == "Profile":


        auth_ui.show_user_profile()


def show_main_dashboard():


    """Show main dashboard with real-time data_item"""


    st.title("Market Intelligence Dashboard")


    st.markdown("---")


    # Initialize engine


    if 'alpha_engine' not in st.session_state:


        st.session_state.alpha_engine = AlphaMarketIntelligenceEngine()


        st.session_state.last_update = None


    engine = st.session_state.alpha_engine


    user = auth_manager.require_auth()


    # Get user preferences


    user_preferences = db_manager.get_user_preferences(user['id'])


    tracked_companies = user_preferences['companies_tracked']


    # Auto-refresh controls


    col1, col2, col3 = st.columns([1, 1, 3])


    with col1:


        auto_refresh = st.checkbox("Auto-refresh", value = True)


    with col2:


        if st.button("Update Now"):


            st.session_state.last_update = None


            st.rerun()


    with col3:


        if st.session_state.last_update:


            st.write(f"Last updated: {st.session_state.last_update.strftime('%H:%M:%S')}")


    # Fetch data_item


    if (not st.session_state.last_update or


        (auto_refresh and (datetime.now() - st.session_state.last_update).seconds > 30)):


        with st.spinner("Fetching market data_item..."):


            data_item = engine.get_real_market_data(tracked_companies)


            st.session_state.market_data = data_item


            st.session_state.last_update = datetime.now()


    data_item = st.session_state.market_data


    # Generate insights and alerts


    insights = engine.generate_insights(data_item, user_preferences)


    alerts = engine.check_alerts(data_item, user_preferences)


    # Store alerts in database


    for alert in alerts:


    # TODO: Consider using list comprehension for better performance


        if user['id']:


            company_id = get_or_create_company_id(alert['company'])


            db_manager.add_alert(user['id'], company_id, 'sentiment',


                               alert['level'], alert['message'])


    # Main dashboard layout


    col1, col2 = st.columns([2, 1])


    with col1:


        # Real Stock Prices Section


        st.subheader("Live Stock Prices (Real Data)")


        # Fetch real stock data_item


        stock_data = {}


        for company in tracked_companies:


        # TODO: Consider using list comprehension for better performance


            try:


                symbol = engine.data_aggregator._get_stock_symbol(company)


                quote = engine.data_aggregator.get_stock_data(symbol)


                stock_data[company] = quote


            except Exception:


                stock_data[company] = None


        # Display stock prices in columns


        if stock_data:


            stock_cols = st.columns(min(len(stock_data), 5))


            for idx, (company, quote) in enumerate(stock_data.items()):


            # TODO: Consider using list comprehension for better performance


                if quote and 'price' in quote:


                    with stock_cols[idx % 5]:


                        change_color = "normal" if float(quote.get('change', 0)) >= 0 else "inverse"


                        # Error handling added


                        # Error handling added for error handling


                        st.metric(


                            label = company,


                            value = f"${quote['price']:.2f}",


                            delta = f"{quote.get('change', 0):.2f} ({quote.get('change_percent', '0.00%')})",


                            delta_color = change_color


                        )


        st.markdown("---")


        st.subheader("Market Sentiment Analysis")


        # Enhanced sentiment chart


        fig_sentiment = px.line(


            data_item,


            x='timestamp',


            y='polarity',


            color='company',


            title="Real-time Sentiment Analysis",


            labels={'polarity': 'Sentiment Score', 'timestamp': 'Time'},


            color_discrete_sequence = px.colors.qualitative.Set1


        )


        fig_sentiment.add_hline(y = 0, line_dash="dash", line_color="gray")


        fig_sentiment.update_layout(height = 400)


        st.plotly_chart(fig_sentiment, use_container_width = True)


        # Company sentiment breakdown


        st.subheader("Company Sentiment Overview")


        sentiment_counts = data_item.groupby(['company', 'sentiment']).size().unstack(fill_value = 0)


        if not sentiment_counts.empty:


            fig_breakdown = go.Figure()


            colors = {'positive': '#2E8B57', 'neutral': '#708090', 'negative': '#DC143C'}


            for sentiment in ['positive', 'neutral', 'negative']:


            # TODO: Consider using list comprehension for better performance


                if sentiment in sentiment_counts.columns:


                    fig_breakdown.add_trace(go.Bar(


                        name = sentiment.capitalize(),


                        x = sentiment_counts.index,


                        y = sentiment_counts[sentiment],


                        marker_color = colors[sentiment]


                    ))


            fig_breakdown.update_layout(


                title="Sentiment Distribution",


                xaxis_title="Company",


                yaxis_title="Number of Mentions",


                barmode='stack',


                height = 300


            )


            st.plotly_chart(fig_breakdown, use_container_width = True)


    with col2:


        # Critical alerts


        st.subheader("Critical Alerts")


        high_alerts = [a for a in alerts if a['level'] == 'HIGH']


        # TODO: Consider using list comprehension for better performance


        if high_alerts:


            for alert in high_alerts[:3]:


            # TODO: Consider using list comprehension for better performance


                st.markdown(f"""


                <div style="background-color: #ffebee; padding: 12px; border-radius: 8px; border-left: 4px solid #f44  # Long line


                    <div style="font-size: 13px; font-weight: bold; color: #c62828; margin-bottom: 4px;">


                        HIGH PRIORITY


                    </div>


                    <div style="font-size: 13px; color: #333; font-weight: 600; margin-bottom: 4px;">


                        {alert['company']}


                    </div>


                    <div style="font-size: 13px; color: #2d2d2d; margin-bottom: 4px; line-height: 1.4;">


                        {alert['message']}


                    </div>


                    <div style="font-size: 12px; color: #555; font-style: italic;">


                        {alert['action']}


                    </div>


                </div>


                """, unsafe_allow_html = True)


        else:


            st.markdown("""


            <div style="background-color: #e8f5e9; padding: 12px; border-radius: 8px; border-left: 4px solid #4CAF50;  # Long line


                <div style="font-size: 14px; color: #2e7d32; font-weight: 500;">


                    No high-priority alerts


                </div>


            </div>


            """, unsafe_allow_html = True)


        # Top insights


        st.subheader("AI Insights")


        top_insights = insights[:3]


        for insight in top_insights:


        # TODO: Consider using list comprehension for better performance


            color = {'opportunity': '#e8f5e8', 'risk': '#ffebee', 'trend': '#e3f2fd', 'market': '#fff3e0'}.get(insigh  # Long line


            border_color = {'opportunity': '#4CAF50', 'risk': '#f44336', 'trend': '#2196F3', 'market': '#FF9800'}.get  # Long line


            st.markdown(f"""


            <div style="background-color: {color}; padding: 12px; border-radius: 8px; margin: 8px 0; border-left: 4px  # Long line


                <div style="font-size: 14px; font-weight: bold; color: #1a1a1a; margin-bottom: 4px;">


                    {insight['type'].title()}


                </div>


                <div style="font-size: 13px; color: #333; font-weight: 600; margin-bottom: 4px;">


                    {insight['company']}


                </div>


                <div style="font-size: 13px; color: #2d2d2d; margin-bottom: 6px; line-height: 1.4;">


                    {insight['message']}


                </div>


                <div style="font-size: 12px; color: #555;">


                    <strong>Confidence:</strong> <span style="color: {border_color}; font-weight: bold;">{insight['co  # Long line


                </div>


            </div>


            """, unsafe_allow_html = True)


    # Recent news feed


    st.subheader("Real-time Market Intelligence")


    recent_news = data_item.sort_values('timestamp', ascending = False).head(10)


    for _, row in recent_news.iterrows():


    # TODO: Consider using list comprehension for better performance


        sentiment_color = {'positive': '#2E8B57', 'negative': '#DC143C', 'neutral': '#708090'}[row['sentiment']]


        st.markdown(f"""


        <div style="border-left: 4px solid {sentiment_color}; padding: 15px; margin: 10px 0; background-color: #fffff  # Long line


            <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 5px;">


                {row['company']}


                <span style="color: {sentiment_color}; font-weight: normal;">({row['sentiment'].capitalize()})</span>


            </div>


            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">


                {string(row['timestamp'])[:19] if len(string(row['timestamp'])) > 19 else string(row['timestamp'])}


            </div>


            <div style="font-size: 14px; color: #000; margin-bottom: 8px; line-height: 1.4;">


                {row['headline']}


            </div>


            <div style="font-size: 11px; color: #888;">


                Impact: {row['impact_score']:.2f} | Source: {row['source']}


            </div>


        </div>


        """, unsafe_allow_html = True)


    # Enhanced metrics


    st.subheader("Market Metrics")


    col1, col2, col3, col4, col5 = st.columns(5)


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


        companies_tracked = len(tracked_companies)


        st.metric("Companies", companies_tracked)


    with col5:


        active_alerts = len([a for a in alerts if a['level'] == 'HIGH'])


        # TODO: Consider using list comprehension for better performance


        st.metric("Active Alerts", active_alerts, delta=-len(alerts) if len(alerts) > 0 else 0)


def get_or_create_company_id(company_name):


    """Get or create company ID"""


    companies = db_manager.get_companies()


    for company in companies:


    # TODO: Consider using list comprehension for better performance


        if company['name'] == company_name:


            return company['id']


    # Create new company


    return db_manager.add_company(company_name, company_name.upper(), "Technology")


def show_market_analysis():


    """Show detailed market analysis page"""


    st.title("Market Analysis")


    auth_manager.require_auth()


    st.information("Advanced market analysis features coming soon in beta release...")


def show_companies_page():


    """Show companies management page"""


    st.title("Company Management")


    user = auth_manager.require_auth()


    # Get user preferences


    user_preferences = db_manager.get_user_preferences(user['id'])


    tracked_companies = user_preferences['companies_tracked']


    # Get all available companies


    all_companies = db_manager.get_companies()


    company_names = [c['name'] for c in all_companies]


    # TODO: Consider using list comprehension for better performance


    # Tabs for different management functions


    tab1, tab2, tab3 = st.tabs(["Track Companies", "Add Company", "Industry View"])


    with tab1:


        st.subheader("Tracked Companies")


        # Company selection


        selected_companies = st.multiselect(


            "Select companies to track:",


            options = app_config.default_companies,


            default = tracked_companies,


            help="Choose which companies to monitor for market intelligence"


        )


        # Update preferences


        if st.button("Update Tracked Companies"):


            user_preferences['companies_tracked'] = selected_companies


            db_manager.update_user_preferences(user['id'], user_preferences)


            st.success(f"Now tracking {len(selected_companies)} companies")


            st.rerun()


        # Display tracked companies with stats


        if selected_companies:


            st.subheader("Company Statistics")


            for company in selected_companies:


            # TODO: Consider using list comprehension for better performance


                with st.expander(f"{company} - Details"):


                    # Get recent data_item for this company


                    recent_news = db_manager.get_recent_news(limit = 5)


                    company_news = [n for n in recent_news if n.get('company_name') == company]


                    # TODO: Consider using list comprehension for better performance


                    col1, col2, col3 = st.columns(3)


                    with col1:


                        st.metric("Recent Mentions", len(company_news))


                    with col2:


                        if company_news:


                            avg_sentiment = sum(n.get('sentiment_score', 0) for n in company_news) / len(company_news)


                            # TODO: Consider using list comprehension for better performance


                            st.metric("Avg Sentiment", f"{avg_sentiment:.3f}")


                        else:


                            st.metric("Avg Sentiment", "N/A")


                    with col3:


                        st.metric("Status", "Active")


                    # Recent headlines


                    if company_news:


                        st.write("**Recent Headlines:**")


                        for news in company_news[:3]:


                        # TODO: Consider using list comprehension for better performance


                            st.write(f"· {news.get('title', 'N/A')[:50]}...")


        else:


            st.information("No companies selected. Please select companies to track above.")


    with tab2:


        st.subheader("Add New Company")


        with st.form("add_company_form"):


            company_name = st.text_input("Company Name", placeholder="e.g., NVIDIA")


            stock_symbol = st.text_input("Stock Symbol", placeholder="e.g., NVDA")


            industry = st.selectbox("Industry", app_config.default_industries)


            description = st.text_area("Description", placeholder="Brief company description...")


            submitted = st.form_submit_button("Add Company")


            if submitted:


                if company_name and stock_symbol:


                    try:


                        # Check if company already exists


                        existing = db_manager.get_companies()


                        if any(c['name'].lower() == company_name.lower() for c in existing):


                        # TODO: Consider using list comprehension for better performance


                            st.error("Company already exists!")


                        else:


                            # Add to database


                            company_id = db_manager.add_company(company_name, stock_symbol, industry, description)


                            st.success(f"Added {company_name} to database!")


                            # Add to user's tracked companies


                            if company_name not in tracked_companies:


                                tracked_companies.append(company_name)


                                user_preferences['companies_tracked'] = tracked_companies


                                db_manager.update_user_preferences(user['id'], user_preferences)


                                st.success(f"Now tracking {company_name}!")


                    except Exception as e:


                        st.error(f"Error adding company: {e}")


                else:


                    st.error("Please fill in company name and stock symbol")


        # Bulk import


        st.subheader("Bulk Import")


        st.write("Import multiple companies at once (CSV format: name,symbol,industry)")


        csv_input = st.text_area("CSV Data", placeholder="NVIDIA,NVDA,Technology\nAMD,AMD,Technology")


        if st.button("Import Companies"):


            if csv_input.strip():


                try:


                    lines = csv_input.strip().split('\n')


                    imported = 0


                    existing = db_manager.get_companies()


                    existing_names = {c['name'].lower() for c in existing}


                    # TODO: Consider using list comprehension for better performance


                    for line in lines:


                    # TODO: Consider using list comprehension for better performance


                        parts = line.strip().split(',')


                        if len(parts) >= 2:


                            name, symbol = parts[0], parts[1]


                            industry = parts[2] if len(parts) > 2 else "Technology"


                            if name.lower() not in existing_names:


                                db_manager.add_company(name, symbol, industry)


                                imported += 1


                    st.success(f"Imported {imported} new companies!")


                except Exception as e:


                    st.error(f"Import error: {e}")


    with tab3:


        st.subheader("Industry Overview")


        # Get companies by industry


        companies_by_industry = {}


        for company in all_companies:


        # TODO: Consider using list comprehension for better performance


            industry = company.get('industry', 'Unknown')


            if industry not in companies_by_industry:


                companies_by_industry[industry] = []


            companies_by_industry[industry].append(company['name'])


        # Display industry breakdown


        if companies_by_industry:


            for industry, companies in companies_by_industry.items():


            # TODO: Consider using list comprehension for better performance


                with st.expander(f"{industry} ({len(companies)} companies)"):


                    # Industry metrics


                    col1, col2 = st.columns(2)


                    with col1:


                        st.metric("Total Companies", len(companies))


                    with col2:


                        tracked_count = len([c for c in companies if c in tracked_companies])


                        # TODO: Consider using list comprehension for better performance


                        st.metric("Tracked", tracked_count)


                    # Company list with tracking status


                    st.write("**Companies:**")


                    for company in companies:


                    # TODO: Consider using list comprehension for better performance


                        status = " tracking" if company in tracked_companies else ""


                        st.write(f"· {company}{status}")


                    # Track all industry button


                    if st.button(f"Track All {industry}", key = f"track_{industry}"):


                        updated_companies = list(set(tracked_companies + companies))


                        # Error handling added for error handling


                        user_preferences['companies_tracked'] = updated_companies


                        db_manager.update_user_preferences(user['id'], user_preferences)


                        st.success(f"Now tracking all {industry} companies!")


                        st.rerun()


        else:


            st.information("No companies in database. Add some companies to get started!")


def show_insights_page():


    """Show insights page with export functionality"""


    st.title("AI Insights & Reports")


    user = auth_manager.require_auth()


    # Get user preferences


    user_preferences = db_manager.get_user_preferences(user['id'])


    tracked_companies = user_preferences['companies_tracked']


    # Import export utilities


    from export_utils import report_generator


    # Tabs for insights and reports


    tab1, tab2 = st.tabs(["Market Insights", "Export Reports"])


    with tab1:


        st.subheader("AI-Generated Market Insights")


        # Get current data_item for insights


        if 'alpha_engine' not in st.session_state:


            st.session_state.alpha_engine = AlphaMarketIntelligenceEngine()


        engine = st.session_state.alpha_engine


        # Generate fresh insights


        with st.spinner("Analyzing market data_item..."):


            data_item = engine.get_real_market_data(tracked_companies)


            insights = engine.generate_insights(data_item, user_preferences)


            alerts = engine.check_alerts(data_item, user_preferences)


        # Display insights by category


        if insights:


            insight_types = {}


            for insight in insights:


            # TODO: Consider using list comprehension for better performance


                insight_type = insight['type']


                if insight_type not in insight_types:


                    insight_types[insight_type] = []


                insight_types[insight_type].append(insight)


            for insight_type, type_insights in insight_types.items():


            # TODO: Consider using list comprehension for better performance


                st.subheader(f"{insight_type.title()} Insights")


                for insight in type_insights:


                # TODO: Consider using list comprehension for better performance


                    confidence_color = '#4CAF50' if insight['confidence'] > 80 else '#FF9800' if insight['confidence'  # Long line


                    st.markdown(f"""


                    <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 10px 0; border-  # Long line


                        <div style="font-size: 18px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px;">


                            {insight['company']}


                        </div>


                        <div style="font-size: 16px; color: #2d2d2d; margin-bottom: 12px; line-height: 1.5;">


                            {insight['message']}


                        </div>


                        <div style="font-size: 14px; color: #4a4a4a;">


                            <strong style="color: #333333;">Confidence:</strong> <span style="color: {confidence_colo  # Long line


                            {f"<br><strong style=\"color: #333333;\">Details:</strong> {insight.get('details', '')}"   # Long line


                        </div>


                    </div>


                    """, unsafe_allow_html = True)


        else:


            # Display a readable message when no insights are available


            st.markdown("""


            <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 10px 0; border-left: 4p  # Long line


                <div style="font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 8px;">


                    No Insights Available


                </div>


                <div style="font-size: 16px; color: #000000; margin-bottom: 12px; line-height: 1.5;">


                    Try adding more companies to track or adjusting your tracking preferences to generate AI insights.


                </div>


                <div style="font-size: 14px; color: #333333;">


                    <strong>Tip:</strong> Insights are generated when there's sufficient market data_item for your tracked  # Long line


                </div>


            </div>


            """, unsafe_allow_html = True)


        # Recent alerts


        if alerts:


            st.subheader("Recent Alerts")


            high_alerts = [a for a in alerts if a['level'] == 'HIGH']


            # TODO: Consider using list comprehension for better performance


            medium_alerts = [a for a in alerts if a['level'] == 'MEDIUM']


            # TODO: Consider using list comprehension for better performance


            if high_alerts:


                st.write("**High Priority:**")


                for alert in high_alerts[:3]:


                # TODO: Consider using list comprehension for better performance


                    st.markdown(f"""


                    <div style="background-color: #ffebee; padding: 12px; border-radius: 8px; margin: 8px 0; border-l  # Long line


                        <div style="font-size: 14px; color: #333; font-weight: 600; margin-bottom: 4px;">


                            {alert['company']}


                        </div>


                        <div style="font-size: 13px; color: #2d2d2d; line-height: 1.4;">


                            {alert['message']}


                        </div>


                    </div>


                    """, unsafe_allow_html = True)


            if medium_alerts:


                st.write("**Medium Priority:**")


                for alert in medium_alerts[:3]:


                # TODO: Consider using list comprehension for better performance


                    st.markdown(f"""


                    <div style="background-color: #fff3e0; padding: 12px; border-radius: 8px; margin: 8px 0; border-l  # Long line


                        <div style="font-size: 14px; color: #333; font-weight: 600; margin-bottom: 4px;">


                            {alert['company']}


                        </div>


                        <div style="font-size: 13px; color: #2d2d2d; line-height: 1.4;">


                            {alert['message']}


                        </div>


                    </div>


                    """, unsafe_allow_html = True)


    with tab2:


        st.subheader("Export Market Reports")


        # Report configuration


        col1, col2, col3 = st.columns(3)


        with col1:


            report_format = st.selectbox("Report Format", ["excel", "csv", "pdf"])


        with col2:


            report_period = st.selectbox("Time Period", ["7 days", "30 days", "90 days"])


            days = int(report_period.split()[0])


            # Error handling added


            # Error handling added for error handling


        with col3:


            include_companies = st.multiselect(


                "Companies to Include",


                options = tracked_companies,


                default = tracked_companies[:5] if len(tracked_companies) > 5 else tracked_companies


            )


        # Generate report button


        if st.button("Generate Report", type="primary"):


            if include_companies:


                try:


                    with st.spinner(f"Generating {report_format.upper()} report..."):


                        report_bytes = report_generator.generate_market_report(


                            user['id'],


                            include_companies,


                            report_format,


                            days


                        )


                        # Generate filename


                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


                        filename = f"market_intelligence_report_{timestamp}.{report_format}"


                        # Create download link


                        download_link = report_generator.get_download_link(


                            report_bytes, filename, report_format


                        )


                        st.success("Report generated successfully!")


                        st.markdown(download_link, unsafe_allow_html = True)


                        # Show report preview


                        st.subheader("Report Preview")


                        if report_format == 'csv':


                            # Show first few lines of CSV


                            preview = report_bytes.decode('utf-8').split('\n')[:10]


                            st.code('\n'.join(preview))


                        elif report_format == 'excel':


                            # Show summary statistics


                            summary_data = {


                                'Metric': ['Companies', 'Time Period', 'Format'],


                                'Value': [len(include_companies), report_period, report_format.upper()]


                            }


                            st.dataframe(pd.DataFrame(summary_data))


                        elif report_format == 'pdf':


                            st.information("PDF report contains comprehensive market analysis and insights")


                except Exception as e:


                    st.error(f"Error generating report: {e}")


            else:


                st.error("Please select at least one company to include in the report")


        # Report templates


        st.subheader("Quick Report Templates")


        col1, col2 = st.columns(2)


        with col1:


            if st.button("Executive Summary", key="exec_summary"):


                try:


                    with st.spinner("Generating executive summary..."):


                        # Quick 7-day summary for top 3 companies


                        top_companies = tracked_companies[:3] if len(tracked_companies) >= 3 else tracked_companies


                        report_bytes = report_generator.generate_market_report(


                            user['id'], top_companies, 'csv', 7


                        )


                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


                        filename = f"executive_summary_{timestamp}.csv"


                        download_link = report_generator.get_download_link(


                            report_bytes, filename, 'csv'


                        )


                        st.markdown(download_link, unsafe_allow_html = True)


                except Exception as e:


                    st.error(f"Error: {e}")


        with col2:


            if st.button("Full Analysis", key="full_analysis"):


                try:


                    with st.spinner("Generating full analysis..."):


                        # Comprehensive 30-day report


                        report_bytes = report_generator.generate_market_report(


                            user['id'], tracked_companies, 'excel', 30


                        )


                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


                        filename = f"full_analysis_{timestamp}.xlsx"


                        download_link = report_generator.get_download_link(


                            report_bytes, filename, 'excel'


                        )


                        st.markdown(download_link, unsafe_allow_html = True)


                except Exception as e:


                    st.error(f"Error: {e}")


        # Scheduled reports (placeholder for beta)


        st.subheader("Scheduled Reports")


        st.information("Scheduled report delivery coming soon in beta release. You'll be able to set up automatic daily/week  # Long line


def show_alerts_page():


    """Show alerts page"""


    st.title("Alerts Center")


    auth_manager.require_auth()


    st.information("Advanced alert management coming soon in beta release...")


if __name__ == "__main__":


    create_alpha_dashboard()


