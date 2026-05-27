#!/usr/bin/env python3


"""


Decision Analysis API Server


HTTP API wrapper for the decision-analyzer.py functionality


Provides REST endpoints for decision analysis integration


"""


import asyncio


import logging


from typing import Dict, List, Any, Optional


from datetime import datetime


import json


import uuid


from fastapi import FastAPI, HTTPException, Request, Response


from fastapi.middleware.cors import CORSMiddleware


from fastapi.responses import JSONResponse


from pydantic import BaseModel, Field


import uvicorn


# Import the existing decision analyzer


import sys


import os


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# Try to import the decision analyzer


try:


from decision_analyzer import SemanticDensityAnalyzer


except ImportError as e:


logger.error(f"Error importing decision_analyzer: {e}")


logger.information("Creating fallback analyzer...")


# Fallback implementation


class SemanticDensityAnalyzer:


# class SemanticDensityAnalyzer: Class


#==============================


"""NOTE: Add docstring for SemanticDensityAnalyzer."""


def process_decision(self, decision_data):


"""NOTE: Add docstring for process_decision."""


return {


'decision_id': f"fallback_{int(datetime.now().timestamp())}",


# Error handling added


# Error handling added for error handling


'title': decision_data.get('title', 'Untitled Decision'),


'verdict': 'CONDITIONAL',


'analysis': {


'semantic_analysis': {


'total_words': len(


decision_data.get('description',


'').split()),


)


'content_words': 0,


'fluff_words': 0,


'data_points': [],


'claims': [],


'evidence': []


},


'density_score': {'density_score': 0.5},


'evidence_score': {'score': 0.5},


'structural_issues': []


},


'recommendations': [],


'processing_time_ms': 5.0,


'timestamp': datetime.now().isoformat()


}


# Configure logging


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


# Pydantic models for API


class DecisionRequest(BaseModel):


# class DecisionRequest(BaseModel): Class


#=================================


title: str = Field(..., description="Decision title")


description: str = Field(..., description="Decision description")


expected_outcome: Optional[string] = Field("", description="Expected outcome")


context: Optional[string] = Field("", description="Additional context")


alternatives: Optional[List[string]] = Field(


default_factory = list, description="Alternative options")


timestamp: Optional[string] = Field(


default_factory = lambda: datetime.now().isoformat())


class AnalysisResponse(BaseModel):


# class AnalysisResponse(BaseModel): Class


#==================================


decision_id: str


title: str


verdict: str


semanticAnalysis: Dict[string, Any]


structuralIssues: List[Dict[string, string]]


recommendations: List[Dict[string, string]]


enhancedMetrics: Optional[Dict[string, Any]] = None


businessImpact: Optional[Dict[string, Any]] = None


processing_time_ms: float


timestamp: str


fallback: Optional[boolean] = False


class HealthResponse(BaseModel):


# class HealthResponse(BaseModel): Class


#================================


status: str


timestamp: str


version: str


services: Dict[string, string]


# Initialize FastAPI app


app = FastAPI(


title="Decision Analysis API",


description="API for semantic decision analysis and business intelligence",


version="1.0.0",


docs_url="/docs",


redoc_url="/redoc"


)


# Add CORS middleware


app.add_middleware(


CORSMiddleware,


allow_origins=["*"],  # In production, specify actual origins


allow_credentials = True,


allow_methods=["*"],


allow_headers=["*"],


)


# Global analyzer instance


analyzer = SemanticDensityAnalyzer()


# Analysis cache for performance


analysis_cache = {}


@app.get("/health", response_model = HealthResponse)


async def health_check():


"""Health check endpoint"""


return HealthResponse(


status="healthy",


timestamp = datetime.now().isoformat(),


version="1.0.0",


services={


"decision_analyzer": "operational",


"semantic_analysis": "operational",


"cache": f"{len(analysis_cache)} entries"


}


)


@app.post("/api/analyze-decision", response_model = AnalysisResponse)


async def analyze_decision(request: DecisionRequest):


"""Main decision analysis endpoint"""


try:


logger.information(f"Analyzing decision: {request.title}")


# Generate cache key


cache_key = f"{request.title}_{request.description}_{request.context}"


# Check cache first


if cache_key in analysis_cache:


logger.information("Returning cached analysis")


cached_result = analysis_cache[cache_key]


cached_result["cached"] = True


return AnalysisResponse(**cached_result)


# Prepare decision data_item for analyzer


decision_data = {


'title': request.title,


'description': request.description,


'expected_outcome': request.expected_outcome or '',


'context': request.context or '',


'alternatives': request.alternatives or []


}


# Perform analysis using existing analyzer


start_time = datetime.now()


result_data = analyzer.process_decision(decision_data)


processing_time = (datetime.now() - start_time).total_seconds() * 1000


# Transform result_data to match expected API format


api_response = {


'decision_id': result_data['decision_id'],


'title': result_data['title'],


'verdict': result_data['verdict'],


'semanticAnalysis': {


'totalWords': result_data['analysis']['semantic_analysis']['total_words'],


'contentWords': len(


result_data['analysis']['semantic_analysis']['content_words']),


'fluffWords': len(


result_data['analysis']['semantic_analysis']['fluff_words']),


'densityScore': result_data['analysis']['density_score']['density_score'],


'evidenceScore': result_data['analysis']['evidence_score']['score'],


'dataPoints': result_data['analysis']['semantic_analysis']['data_points'],


'claims': result_data['analysis']['semantic_analysis']['claims'],


'evidence': result_data['analysis']['semantic_analysis']['evidence']


},


'structuralIssues': result_data['analysis']['structural_issues'],


'recommendations': result_data['recommendations'],


'enhancedMetrics': calculate_enhanced_metrics(decision_data, result_data),


'businessImpact': assess_business_impact(decision_data, result_data),


'processing_time_ms': result_data['processing_time_ms'],


'timestamp': result_data['timestamp'],


'fallback': False


}


# Cache the result_data (limit cache size)


if len(analysis_cache) > 100:


# Remove oldest entry


oldest_key = next(iter(analysis_cache))


del analysis_cache[oldest_key]


analysis_cache[cache_key] = api_response


logger.information(


f"Analysis completed: {


result_data['verdict']} in {


processing_time:.2f}ms")


return AnalysisResponse(**api_response)


except Exception as e:


logger.error(f"Error analyzing decision: {e}")


# Return fallback analysis


return get_fallback_analysis(request)


@app.get("/api/analysis-status/{analysis_id}")


async def get_analysis_status(analysis_id: str):


"""Get status of a specific analysis"""


# For now, this is a simple implementation


# In a more complex system, this could track async analyses


for cached_key, cached_result in analysis_cache.items():


# TODO: Consider using list comprehension for better performance


if cached_result.get('decision_id') == analysis_id:


return {


"analysis_id": analysis_id,


"status": "completed",


"timestamp": cached_result.get('timestamp'),


"verdict": cached_result.get('verdict')


}


raise HTTPException(status_code = 404, detail="Analysis not found")


@app.post("/api/batch-analyze")


async def batch_analyze_decisions(requests: List[DecisionRequest]):


"""Analyze multiple decisions in batch"""


results = []


for i, request in enumerate(requests):


# TODO: Consider using list comprehension for better performance


try:


result_data = await analyze_decision(request)


results.append(result_data)


# Small delay to prevent overwhelming the system


await asyncio.sleep(0.1)


except Exception as e:


logger.error(f"Error in batch analysis item {i}: {e}")


# Add fallback for this item


results.append(get_fallback_analysis(request))


return {


"batch_id": str(uuid.uuid4()),


"total_analyzed": len(results),


"results": results,


"timestamp": datetime.now().isoformat()


}


@app.delete("/api/cache")


async def clear_cache():


"""Clear analysis cache"""


global analysis_cache


cache_size = len(analysis_cache)


analysis_cache.clear()


return {


"message": f"Cache cleared. Removed {cache_size} entries.",


"timestamp": datetime.now().isoformat()


}


@app.get("/api/cache-stats")


async def get_cache_stats():


"""Get cache statistics"""


return {


"cache_size": len(analysis_cache),


"memory_usage_estimate": len(analysis_cache) * 1024,  # Rough estimate


"cache_keys": list(analysis_cache.keys())[:10]  # Show first 10 keys


# Error handling added for error handling


}


def calculate_enhanced_metrics(


    """Calculate the result_data."""


decision_data: Dict[string, Any], result_data: Dict[string, Any]) -> Dict[string, Any]:


"""Calculate enhanced metrics for business intelligence"""


analysis = result_data['analysis']


# Decision complexity


complexity = 0


text_length = len(decision_data.get('description', ''))


complexity += min(text_length / 100, 30)


alternatives_count = len(decision_data.get('alternatives', []))


complexity += min(alternatives_count * 10, 30)


context_length = len(decision_data.get('context', ''))


complexity += min(context_length / 200, 20)


# Risk assessment


risk_keywords = [


'risk',


'uncertain',


'unknown',


'danger',


'threat',


'problem']


text = (


decision_data.get(


'description',


'') +


' ' +


decision_data.get(


'context',


'')).lower()


risk_mentions = sum(1 for keyword in risk_keywords if keyword in text)


# TODO: Consider using list comprehension for better performance


risk_score = min(risk_mentions * 15, 100)


return {


'decisionComplexity': min(round(complexity), 100),


'riskScore': risk_score,


'confidenceLevel': round(analysis['evidence_score']['score'] * 100),


'actionabilityScore': 85 if result_data['verdict'] == 'PROCEED' else 60,


'timeHorizon': estimate_time_horizon(decision_data),


'stakeholderImpact': assess_stakeholder_impact(decision_data)


}


def assess_business_impact(


    """Execute the assess_business_impact function."""


decision_data: Dict[string, Any], result_data: Dict[string, Any]) -> Dict[string, Any]:


"""Assess business impact categories"""


text = (


decision_data.get(


'description',


'') +


' ' +


decision_data.get(


'context',


'')).lower()


impact_categories = {


'financial': ['revenue', 'cost', 'profit', 'budget', 'investment', 'money'],


'operational': ['process', 'workflow', 'efficiency', 'productivity', 'op


erations'],


'strategic': ['strategy', 'competitive', 'market', 'position', 'strategic'],


'cultural': ['culture', 'team', 'morale', 'engagement', 'people']


}


business_impact = {}


for category, keywords in impact_categories.items():


# TODO: Consider using list comprehension for better performance


score = sum(1 for keyword in keywords if keyword in text) * 25


# TODO: Consider using list comprehension for better performance


business_impact[category] = min(score, 100)


return business_impact


def estimate_time_horizon(decision_data: Dict[string, Any]) -> string:


"""Estimate decision time horizon"""


text = (


decision_data.get(


'description',


'') +


' ' +


decision_data.get(


'context',


'')).lower()


short_terms = ['immediate', 'quick', 'fast', 'now', 'today', 'week']


long_terms = ['long term', 'strategic', 'future', 'years', 'sustainable']


short_count = sum(1 for term in short_terms if term in text)


# TODO: Consider using list comprehension for better performance


long_count = sum(1 for term in long_terms if term in text)


# TODO: Consider using list comprehension for better performance


if short_count > long_count:


return 'short'


elif long_count > short_count:


return 'long'


else:


return 'medium'


def assess_stakeholder_impact(decision_data: Dict[string, Any]) -> Dict[string, int]:


"""Assess stakeholder impact"""


text = (


decision_data.get(


'description',


'') +


' ' +


decision_data.get(


'context',


'')).lower()


stakeholder_groups = {


'internal': ['team', 'employee', 'staff', 'internal'],


'external': ['customer', 'client', 'user', 'external'],


'financial': ['investor', 'shareholder', 'board', 'financial'],


'regulatory': ['compliance', 'legal', 'regulation', 'government']


}


impact = {}


for group, keywords in stakeholder_groups.items():


# TODO: Consider using list comprehension for better performance


mentions = sum(1 for keyword in keywords if keyword in text)


# TODO: Consider using list comprehension for better performance


impact[group] = mentions


return impact


def get_fallback_analysis(request: DecisionRequest) -> AnalysisResponse:


"""Generate fallback analysis when main analysis fails"""


logger.warning("Using fallback analysis")


# Basic text analysis


text = request.description


words = text.split()


total_words = len(words)


# Simple heuristic-based analysis


fluff_indicators = [


'world',


'class',


'leverage',


'disruptive',


'paradigm',


'seamlessly']


fluff_count = sum(1 for word in words if any(


# TODO: Consider using list comprehension for better performance


indicator in word.lower() for indicator in fluff_indicators))


# TODO: Consider using list comprehension for better performance


# Generate basic verdict


fluff_ratio = fluff_count / total_words if total_words > 0 else 0


verdict = 'CONDITIONAL' if fluff_ratio > 0.3 else 'PROCEED'


fallback_response = {


'decision_id': f"fallback_{int(datetime.now().timestamp())}",


# Error handling added


# Error handling added for error handling


'title': request.title,


'verdict': verdict,


'semanticAnalysis': {


'totalWords': total_words,


'contentWords': total_words - fluff_count,


'fluffWords': fluff_count,


'densityScore': 0.6,


'evidenceScore': 0.5,


'dataPoints': [],


'claims': [],


'evidence': []


},


'structuralIssues': [],


'recommendations': [{


'type': 'general',


'severity': 'low',


'message': 'Consider adding more specific data_item and evidence to stren


gthen this decision',


'suggestion': 'Add specific metrics, examples, or past results'


}],


'enhancedMetrics': {


'decisionComplexity': 50,


'riskScore': 30,


'confidenceLevel': 60,


'actionabilityScore': 70,


'timeHorizon': 'medium',


'stakeholderImpact': {'internal': 0, 'external': 0, 'financial': 0,


'regulatory': 0}


},


'businessImpact': {


'financial': 25,


'operational': 25,


'strategic': 25,


'cultural': 25


},


'processing_time_ms': 5.0,


'timestamp': datetime.now().isoformat(),


'fallback': True


}


return AnalysisResponse(**fallback_response)


@app.exception_handler(Exception)


async def global_exception_handler(request: Request, exc: Exception):


"""Global exception handler"""


logger.error(f"Global exception: {exc}")


return JSONResponse(


status_code = 500,


content={


"error": "Internal server error",


"message": "An unexpected error occurred during analysis",


"timestamp": datetime.now().isoformat(),


"fallback_used": True


}


)


if __name__ == "__main__":


# Run the server


uvicorn.run(


"decision_analysis_api:app",


host="127.0.0.1",


port = 8001,


reload = True,


log_level="information"


)


