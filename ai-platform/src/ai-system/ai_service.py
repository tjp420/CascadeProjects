#!/usr/bin/env python3
"""
Real AI Service Integration
Provides genuine AI capabilities for development assistance
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIService:
    """Real AI service wrapper for development assistance"""
    
    def __init__(self, provider: str = "openai"):
        self.provider = provider.lower()
        self.api_key = self._get_api_key()
        self.client = None
        self._initialize_client()
    
    def _get_api_key(self) -> str:
        """Get API key from environment variables"""
        if self.provider == "openai":
            return os.getenv("OPENAI_API_KEY", "")
        elif self.provider == "anthropic":
            return os.getenv("ANTHROPIC_API_KEY", "")
        elif self.provider == "google":
            return os.getenv("GOOGLE_AI_API_KEY", "")
        else:
            raise ValueError(f"Unsupported AI provider: {self.provider}")
    
    def _initialize_client(self):
        """Initialize the appropriate AI client"""
        try:
            if self.provider == "openai":
                self._initialize_openai()
            elif self.provider == "anthropic":
                self._initialize_anthropic()
            elif self.provider == "google":
                self._initialize_google()
            else:
                raise ValueError(f"Unsupported AI provider: {self.provider}")
        except Exception as e:
            logger.error(f"Failed to initialize {self.provider} client: {e}")
            self.client = None
    
    def _initialize_openai(self):
        """Initialize OpenAI client"""
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key)
            logger.info("✅ OpenAI client initialized successfully")
        except ImportError:
            logger.error("❌ OpenAI library not installed. Run: pip install openai")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to initialize OpenAI client: {e}")
            raise
    
    def _initialize_anthropic(self):
        """Initialize Anthropic client"""
        try:
            from anthropic import Anthropic
            self.client = Anthropic(api_key=self.api_key)
            logger.info("✅ Anthropic client initialized successfully")
        except ImportError:
            logger.error("❌ Anthropic library not installed. Run: pip install anthropic")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to initialize Anthropic client: {e}")
            raise
    
    def _initialize_google(self):
        """Initialize Google AI client"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel('gemini-pro')
            logger.info("✅ Google AI client initialized successfully")
        except ImportError:
            logger.error("❌ Google AI library not installed. Run: pip install google-generativeai")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to initialize Google AI client: {e}")
            raise
    
    def is_available(self) -> bool:
        """Check if AI service is available"""
        return self.client is not None
    
    def analyze_code(self, code: str, context: str = "") -> str:
        """Analyze code using AI"""
        if not self.is_available():
            return "❌ AI service not available. Please check API key and installation."
        
        try:
            if self.provider == "openai":
                return self._analyze_code_openai(code, context)
            elif self.provider == "anthropic":
                return self._analyze_code_anthropic(code, context)
            elif self.provider == "google":
                return self._analyze_code_google(code, context)
        except Exception as e:
            logger.error(f"❌ Error analyzing code: {e}")
            return f"❌ Error analyzing code: {str(e)}"
    
    def _analyze_code_openai(self, code: str, context: str) -> str:
        """Analyze code using OpenAI"""
        prompt = f"""You are an expert software development assistant. Analyze the following code and provide insights:

Code:
{code}

Context: {context}

Please provide:
1. Code quality assessment
2. Potential issues or improvements
3. Best practices recommendations
4. Security considerations
5. Performance optimization suggestions

Be specific and actionable in your analysis."""
        
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert software development assistant."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    def _analyze_code_anthropic(self, code: str, context: str) -> str:
        """Analyze code using Anthropic Claude"""
        prompt = f"""You are an expert software development assistant. Analyze the following code and provide insights:

Code:
{code}

Context: {context}

Please provide:
1. Code quality assessment
2. Potential issues or improvements
3. Best practices recommendations
4. Security considerations
5. Performance optimization suggestions

Be specific and actionable in your analysis."""
        
        response = self.client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text
    
    def _analyze_code_google(self, code: str, context: str) -> str:
        """Analyze code using Google AI"""
        prompt = f"""You are an expert software development assistant. Analyze the following code and provide insights:

Code:
{code}

Context: {context}

Please provide:
1. Code quality assessment
2. Potential issues or improvements
3. Best practices recommendations
4. Security considerations
5. Performance optimization suggestions

Be specific and actionable in your analysis."""
        
        response = self.client.generate_content(prompt)
        return response.text
    
    def generate_recommendations(self, analysis: Dict[str, Any]) -> str:
        """Generate AI-powered recommendations"""
        if not self.is_available():
            return "❌ AI service not available for recommendations."
        
        try:
            analysis_text = json.dumps(analysis, indent=2)
            prompt = f"""Based on this project analysis, provide specific, actionable recommendations for improvement:

Analysis:
{analysis_text}

Focus on:
1. Code quality improvements
2. Architecture suggestions
3. Performance optimizations
4. Security enhancements
5. Best practices implementation

Be specific and prioritize the most important recommendations."""
            
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert software development advisor."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=800,
                    temperature=0.7
                )
                return response.choices[0].message.content
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=800,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            elif self.provider == "google":
                response = self.client.generate_content(prompt)
                return response.text
                
        except Exception as e:
            logger.error(f"❌ Error generating recommendations: {e}")
            return f"❌ Error generating recommendations: {str(e)}"
    
    def optimize_code(self, code: str, issues: List[Dict[str, Any]]) -> str:
        """Optimize code using AI"""
        if not self.is_available():
            return "❌ AI service not available for code optimization."
        
        try:
            issues_text = "\n".join([f"- {issue.get('description', 'Unknown issue')}" for issue in issues])
            prompt = f"""Optimize this code based on the identified issues:

Code:
{code}

Issues:
{issues_text}

Please provide:
1. Optimized code version
2. Explanation of changes made
3. Benefits of the optimization
4. Any additional recommendations

Focus on the most critical issues first."""
            
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert code optimizer."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=1200,
                    temperature=0.3
                )
                return response.choices[0].message.content
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=1200,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            elif self.provider == "google":
                response = self.client.generate_content(prompt)
                return response.text
                
        except Exception as e:
            logger.error(f"❌ Error optimizing code: {e}")
            return f"❌ Error optimizing code: {str(e)}"
    
    def get_ai_assistance(self, query: str, context: str = "") -> str:
        """Get AI assistance for custom queries"""
        if not self.is_available():
            return "❌ AI service not available for assistance."
        
        try:
            prompt = f"""User query: {query}

Context: {context}

Please provide helpful, specific assistance for this software development query. Be practical and actionable."""
            
            if self.provider == "openai":
                response = self.client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are an expert software development assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=800,
                    temperature=0.7
                )
                return response.choices[0].message.content
            elif self.provider == "anthropic":
                response = self.client.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=800,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            elif self.provider == "google":
                response = self.client.generate_content(prompt)
                return response.text
                
        except Exception as e:
            logger.error(f"❌ Error getting AI assistance: {e}")
            return f"❌ Error getting AI assistance: {str(e)}"

# Global AI service instance
_ai_service = None

def get_ai_service() -> AIService:
    """Get or create AI service instance"""
    global _ai_service
    if _ai_service is None:
        provider = os.getenv("AI_PROVIDER", "openai")
        _ai_service = AIService(provider)
    return _ai_service

def is_ai_available() -> bool:
    """Check if AI service is available"""
    try:
        service = get_ai_service()
        return service.is_available()
    except Exception:
        return False
