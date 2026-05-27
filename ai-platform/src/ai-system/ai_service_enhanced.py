#!/usr/bin/env python3
"""
Enhanced AI Service Integration with GGUF Support
Provides comprehensive AI capabilities including local GGUF models
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import GGUF service
try:
    from gguf_service import get_gguf_service, is_gguf_available
    GGUF_AVAILABLE = True
except ImportError:
    GGUF_AVAILABLE = False
    logger.warning("⚠️ GGUF service not available")

class EnhancedAIService:
    """Enhanced AI service with GGUF support"""
    
    def __init__(self, provider: str = "openai"):
        self.provider = provider.lower()
        self.api_key = self._get_api_key()
        self.client = None
        self.gguf_service = None
        self._initialize_client()
        self._initialize_gguf()
    
    def _get_api_key(self) -> str:
        """Get API key from environment variables"""
        if self.provider == "gguf":
            return "local_model"
        elif self.provider == "openai":
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
            if self.provider == "gguf":
                # GGUF is handled by the GGUF service
                pass
            elif self.provider == "openai":
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
    
    def _initialize_gguf(self):
        """Initialize GGUF service"""
        if GGUF_AVAILABLE and self.provider == "gguf":
            try:
                self.gguf_service = get_gguf_service()
                logger.info("✅ GGUF service initialized successfully")
            except Exception as e:
                logger.error(f"❌ Error initializing GGUF service: {e}")
                self.gguf_service = None
    
    def _initialize_openai(self):
        """Initialize OpenAI client"""
        try:
            import openai
            self.client = openai.OpenAI(api_key=self.api_key)
            logger.info("✅ OpenAI client initialized successfully")
        except ImportError:
            logger.error("❌ OpenAI library not installed")
            self.client = None
        except Exception as e:
            logger.error(f"❌ Error initializing OpenAI: {e}")
            self.client = None
    
    def _initialize_anthropic(self):
        """Initialize Anthropic client"""
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.api_key)
            logger.info("✅ Anthropic client initialized successfully")
        except ImportError:
            logger.error("❌ Anthropic library not installed")
            self.client = None
        except Exception as e:
            logger.error(f"❌ Error initializing Anthropic: {e}")
            self.client = None
    
    def _initialize_google(self):
        """Initialize Google AI client"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel('gemini-pro')
            logger.info("✅ Google AI client initialized successfully")
        except ImportError:
            logger.error("❌ Google AI library not installed")
            self.client = None
        except Exception as e:
            logger.error(f"❌ Error initializing Google AI: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """Check if AI service is available"""
        if self.provider == "gguf":
            return self.gguf_service is not None and self.gguf_service.is_available()
        elif self.provider == "openai":
            return self.client is not None and self.api_key
        elif self.provider == "anthropic":
            return self.client is not None and self.api_key
        elif self.provider == "google":
            return self.client is not None and self.api_key
        else:
            return False
    
    def analyze_code(self, code: str, context: str = "") -> str:
        """Analyze code using the appropriate AI provider"""
        if self.provider == "gguf":
            return self.gguf_service.analyze_code(code, context)
        elif self.provider == "openai":
            return self._openai_analyze_code(code, context)
        elif self.provider == "anthropic":
            return self._anthropic_analyze_code(code, context)
        elif self.provider == "google":
            return self._google_analyze_code(code, context)
        else:
            return "❌ Unsupported provider"
    
    def _openai_analyze_code(self, code: str, context: str) -> str:
        """Analyze code using OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert software development assistant."},
                    {"role": "user", "content": f"Analyze this code:\n\n{code}\n\nContext: {context}"}
                ],
                max_tokens=800,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"❌ Error analyzing code: {e}")
            return f"❌ Error analyzing code: {str(e)}"
    
    def _anthropic_analyze_code(self, code: str, context: str) -> str:
        """Analyze code using Anthropic"""
        try:
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=800,
                messages=[{"role": "user", "content": f"Analyze this code:\n\n{code}\n\nContext: {context}"}]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"❌ Error analyzing code: {e}")
            return f"❌ Error analyzing code: {str(e)}"
    
    def _google_analyze_code(self, code: str, context: str) -> str:
        """Analyze code using Google AI"""
        try:
            response = self.client.generate_content(f"Analyze this code:\n\n{code}\n\nContext: {context}")
            return response.text
        except Exception as e:
            logger.error(f"❌ Error analyzing code: {e}")
            return f"❌ Error analyzing code: {str(e)}"
    
    def generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations using the appropriate AI provider"""
        if self.provider == "gguf":
            return self.gguf_service.generate_recommendations(analysis)
        elif self.provider == "openai":
            return self._openai_generate_recommendations(analysis)
        elif self.provider == "anthropic":
            return self._anthropic_generate_recommendations(analysis)
        elif self.provider == "google":
            return self._google_generate_recommendations(analysis)
        else:
            return ["❌ Unsupported provider"]
    
    def _openai_generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations using OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert software development assistant."},
                    {"role": "user", "content": f"Generate recommendations based on this analysis:\n\n{json.dumps(analysis, indent=2)}"}
                ],
                max_tokens=800,
                temperature=0.7
            )
            content = response.choices[0].message.content
            return self._parse_recommendations(content)
        except Exception as e:
            logger.error(f"❌ Error generating recommendations: {e}")
            return [f"❌ Error generating recommendations: {str(e)}"]
    
    def _anthropic_generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations using Anthropic"""
        try:
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=800,
                messages=[{"role": "user", "content": f"Generate recommendations based on this analysis:\n\n{json.dumps(analysis, indent=2)}"}]
            )
            content = response.content[0].text
            return self._parse_recommendations(content)
        except Exception as e:
            logger.error(f"❌ Error generating recommendations: {e}")
            return [f"❌ Error generating recommendations: {str(e)}"]
    
    def _google_generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations using Google AI"""
        try:
            response = self.client.generate_content(f"Generate recommendations based on this analysis:\n\n{json.dumps(analysis, indent=2)}")
            content = response.text
            return self._parse_recommendations(content)
        except Exception as e:
            logger.error(f"❌ Error generating recommendations: {e}")
            return [f"❌ Error generating recommendations: {str(e)}"]
    
    def _parse_recommendations(self, content: str) -> List[str]:
        """Parse recommendations from AI response"""
        recommendations = []
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if line and (line.startswith('-') or line.startswith('*') or line.startswith('1.') or line.startswith('2.') or line.startswith('3.') or line.startswith('4.') or line.startswith('5.')):
                # Remove bullet points and numbers
                clean_line = line.lstrip('-*123456789. ')
                if clean_line:
                    recommendations.append(clean_line)
        return recommendations[:5]  # Return top 5 recommendations
    
    def get_ai_assistance(self, question: str) -> str:
        """Get AI assistance using the appropriate AI provider"""
        if self.provider == "gguf":
            return self.gguf_service.get_ai_assistance(question)
        elif self.provider == "openai":
            return self._openai_get_ai_assistance(question)
        elif self.provider == "anthropic":
            return self._anthropic_get_ai_assistance(question)
        elif self.provider == "google":
            return self._google_get_ai_assistance(question)
        else:
            return "❌ Unsupported provider"
    
    def _openai_get_ai_assistance(self, question: str) -> str:
        """Get AI assistance using OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert software development assistant."},
                    {"role": "user", "content": question}
                ],
                max_tokens=800,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"❌ Error getting AI assistance: {e}")
            return f"❌ Error getting AI assistance: {str(e)}"
    
    def _anthropic_get_ai_assistance(self, question: str) -> str:
        """Get AI assistance using Anthropic"""
        try:
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=800,
                messages=[{"role": "user", "content": question}]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"❌ Error getting AI assistance: {e}")
            return f"❌ Error getting AI assistance: {str(e)}"
    
    def _google_get_ai_assistance(self, question: str) -> str:
        """Get AI assistance using Google AI"""
        try:
            response = self.client.generate_content(question)
            return response.text
        except Exception as e:
            logger.error(f"❌ Error getting AI assistance: {e}")
            return f"❌ Error getting AI assistance: {str(e)}"

# Global enhanced AI service instance
_enhanced_ai_service = None

def get_enhanced_ai_service() -> EnhancedAIService:
    """Get or create enhanced AI service instance"""
    global _enhanced_ai_service
    if _enhanced_ai_service is None:
        provider = os.getenv("AI_PROVIDER", "openai")
        _enhanced_ai_service = EnhancedAIService(provider)
    return _enhanced_ai_service

def is_enhanced_ai_available() -> bool:
    """Check if enhanced AI service is available"""
    try:
        service = get_enhanced_ai_service()
        return service.is_available()
    except Exception:
        return False

# Backward compatibility with original AI service
def get_ai_service():
    """Get AI service (backward compatibility)"""
    return get_enhanced_ai_service()

def is_ai_available():
    """Check if AI service is available (backward compatibility)"""
    return is_enhanced_ai_available()
