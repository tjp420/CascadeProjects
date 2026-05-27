#!/usr/bin/env python3


"""


Unity Scanner Decision Scanner Service


Local AI-powered decision analysis for regulated industries


"""


import os


import sys


import json


import uuid


import asyncio


import logging


import re


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any, Optional


from fastapi import FastAPI, HTTPException


from fastapi.middleware.cors import CORSMiddleware


from pydantic import BaseModel


import uvicorn


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',


handlers=[


logging.FileHandler('decision-scanner.log'),


logging.StreamHandler(sys.stdout)


]


)


logger = logging.getLogger(__name__)


# Decision patterns and rules


DECISION_PATTERNS = {


"strategic": {


"keywords": ["market", "expansion", "acquisition", "merger", "partnershi


p", "growth"],


"risk_level": "high",


"typical_stakeholders": ["board", "shareholders", "regulators", "employees"],


"timeframe": "6-18 months",


"confidence_threshold": 0.75


},


"financial": {


"keywords": ["budget", "investment", "revenue", "cost", "profit", "ROI"],


"risk_level": "medium",


"typical_stakeholders": ["CFO", "board", "investors", "finance team"],


"timeframe": "3-12 months",


"confidence_threshold": 0.80


},


"operational": {


"keywords": ["process", "workflow", "efficiency", "automation", "operations"],


"risk_level": "low",


"typical_stakeholders": ["COO", "operations", "IT", "employees"],


"timeframe": "1-6 months",


"confidence_threshold": 0.75


},


"technical": {


"keywords": ["technology", "software", "system", "infrastructure", "security"],


"risk_level": "medium",


"typical_stakeholders": ["CTO", "IT", "users", "finance"],


"timeframe": "6-18 months",


"confidence_threshold": 0.80


},


"crisis": {


"keywords": ["emergency", "crisis", "urgent", "critical", "immediate"],


"risk_level": "critical",


"typical_stakeholders": ["CEO", "board", "legal", "PR", "crisis team"],


"timeframe": "immediate",


"confidence_threshold": 0.90


}


}


# Risk patterns


RISK_PATTERNS = {


"financial": [


{"type": "budget_overrun", "severity": "medium",


"description": "Project may exceed allocated budget"},


{"type": "roi_uncertainty", "severity": "high",


"description": "Return on investment is uncertain"},


{"type": "cash_flow", "severity": "high",


"description": "May impact cash flow negatively"}


],


"operational": [


{"type": "resource_constraint", "severity": "medium",


"description": "Limited resources may delay execution"},


{"type": "process_disruption", "severity": "medium",


"description": "May disrupt existing operations"},


{"type": "skill_gap", "severity": "low",


"description": "Team may lack required skills"}


],


"compliance": [


{"type": "regulatory_violation", "severity": "high",


"description": "May violate regulatory requirements"},


{"type": "audit_failure", "severity": "medium",


"description": "May not pass audit requirements"},


{"type": "documentation_gap", "severity": "low",


"description": "Insufficient documentation"}


],


"strategic": [


{"type": "market_mismatch", "severity": "high",


"description": "May not align with market needs"},


{"type": "competitive_disadvantage", "severity": "medium",


"description": "May create competitive disadvantage"},


{"type": "brand_damage", "severity": "medium",


"description": "May damage brand reputation"}


]


}


# Pydantic Models


class DecisionRequest(BaseModel):


# class DecisionRequest(BaseModel): Class


#=================================


title: str


description: str


decision_type: Optional[string] = None


priority: Optional[string] = "medium"


stakeholders: Optional[List[string]] = []


timeframe: Optional[string] = None


budget: Optional[string] = None


context: Optional[Dict[string, Any]] = {}


class DecisionResponse(BaseModel):


# class DecisionResponse(BaseModel): Class


#==================================


id: str


title: str


analysis: Dict[string, Any]


patterns: List[Dict[string, Any]]


risks: Dict[string, List[Dict[string, Any]]]


stakeholders: List[Dict[string, Any]]


recommendations: List[Dict[string, Any]]


confidence: float


timestamp: str


audit_trail: Dict[string, Any]


class HealthCheck(BaseModel):


# class HealthCheck(BaseModel): Class


#=============================


status: str


patterns_loaded: int


uptime: float


decisions_analyzed: int


# Initialize FastAPI app


app = FastAPI(


title="Unity Scanner Decision Scanner",


description="Local AI-powered decision analysis for regulated industries",


version="1.0.0",


docs_url="/docs",


redoc_url="/redoc"


)


# Add CORS middleware


app.add_middleware(


CORSMiddleware,


allow_origins=["*"],


allow_credentials = True,


allow_methods=["*"],


allow_headers=["*"],


)


# Global state


start_time = datetime.now()


decisions_analyzed = 0


class DecisionScannerService:


# class DecisionScannerService: Class


#=============================


"""Decision Scanner Service for local AI analysis"""


def __init__(self):


"""NOTE: Add docstring for __init__."""


self.patterns = DECISION_PATTERNS


self.risk_patterns = RISK_PATTERNS


logger.information("Decision Scanner Service initialized")


def classify_decision_type(self, description: str) -> string:


"""Classify decision type based on description keywords"""


scores = {}


for decision_type, pattern in self.patterns.items():


# TODO: Consider using list comprehension for better performance


score = 0


for keyword in pattern["keywords"]:


# TODO: Consider using list comprehension for better performance


if keyword.lower() in description.lower():


score += 1


scores[decision_type] = score


# Find highest scoring type


max_score = 0


best_type = "operational"  # default


for decision_type, score in scores.items():


# TODO: Consider using list comprehension for better performance


if score > max_score:


max_score = score


best_type = decision_type


return best_type


def apply_decision_patterns(


    """Execute the apply_decision_patterns function."""


self, description: str, decision_type: str) -> List[Dict[string, Any]]:


"""Apply decision patterns to description"""


patterns = []


pattern_config = self.patterns.get(decision_type, {})


# Check for keyword matches


matched_keywords = []


for keyword in pattern_config.get("keywords", []):


# TODO: Consider using list comprehension for better performance


if keyword.lower() in description.lower():


matched_keywords.append(keyword)


if matched_keywords:


patterns.append({


"pattern": f"Keywords: {', '.join(matched_keywords)}",


"matches": matched_keywords,


"risk_level": pattern_config.get("risk_level", "medium"),


"stakeholders": pattern_config.get("typical_stakeholders", []),


"timeframe": pattern_config.get("timeframe", "unknown"),


"confidence": pattern_config.get("confidence_threshold", 0.75),


"keywords": matched_keywords


})


return patterns


def assess_risks(self,


    """Execute the assess_risks function."""


analysis: Dict[string,


Any],


patterns: List[Dict[string,


Any]],


context: Dict[string,


Any]) -> Dict[string,


List[Dict[string,


Any]]]:


"""Assess decision risks"""


risks = {


"financial": [],


"operational": [],


"reputational": [],


"compliance": [],


"strategic": []


}


# Pattern-based risks


for pattern in patterns:


# TODO: Consider using list comprehension for better performance


if pattern.get("risk_level") in ["critical", "high"]:


risks["strategic"].append({


"type": "pattern_risk",


"severity": pattern["risk_level"],


"description": f"High-risk decision pattern detected: {patte


rn['pattern']}",


"mitigation": "Enhanced oversight and board approval required"


})


# Budget risks


if analysis.get("budget"):


budget_risk = self._assess_budget_risk(analysis["budget"])


risks["financial"].append(budget_risk)


# Timeframe risks


if analysis.get("timeframe") and analysis.get("priority") == "high":


if "month" in analysis["timeframe"].lower():


risks["operational"].append({


"type": "timeframe_priority",


"severity": "medium",


"description": "High priority decision with extended timeframe",


"mitigation": "Consider accelerated timeline or interim solutions"


})


# Stakeholder complexity risks


stakeholder_count = len(analysis.get("stakeholders", []))


if stakeholder_count > 5:


risks["compliance"].append({


"type": "stakeholder_complexity",


"severity": "medium",


"description": "High stakeholder complexity increases coordinati


on risk",


"mitigation": "Stakeholder management plan and clear communicati


on strategy"


})


return risks


def _assess_budget_risk(self, budget: str) -> Dict[string, Any]:


"""Assess budget-related risks"""


try:


# Extract numeric value from budget string


budget_match = re.search(


r'[\d,.]+',


budget.replace(


'$',


'').replace(


'€',


'').replace(


'£',


''))


if budget_match:


budget_value = float(budget_match.group().replace(',', ''))


# Error handling added


# Error handling added for error handling


if budget_value > 1000000:  # > $1M


return {


"type": "budget_size",


"severity": "high",


"description": "Large budget investment requires additio


nal oversight",


"mitigation": "Phased funding with milestone-based releases"


}


elif budget_value > 100000:  # > $100K


return {


"type": "budget_size",


"severity": "medium",


"description": "Significant budget investment",


"mitigation": "Regular budget reviews and variance tracking"


}


except (ValueError, KeyError, AttributeError) as e:


# Log error and continue with default risk assessment


logging.warning(f"Error in budget size analysis: {e}")


return {


"type": "budget_size",


"severity": "low",


"description": "Manageable budget size",


"mitigation": "Standard budget monitoring"


}


def analyze_stakeholders(self,


    """Execute the analyze_stakeholders function."""


analysis: Dict[string,


Any],


patterns: List[Dict[string,


Any]],


context: Dict[string,


Any]) -> List[Dict[string,


Any]]:


"""Analyze decision stakeholders"""


stakeholders = []


stakeholder_set = set()


# Collect stakeholders from patterns


for pattern in patterns:


# TODO: Consider using list comprehension for better performance


for stakeholder in pattern.get("stakeholders", []):


# TODO: Consider using list comprehension for better performance


stakeholder_set.add(stakeholder)


# Add stakeholders from analysis


for stakeholder in analysis.get("stakeholders", []):


# TODO: Consider using list comprehension for better performance


stakeholder_set.add(stakeholder)


# Analyze each stakeholder


for stakeholder in stakeholder_set:


# TODO: Consider using list comprehension for better performance


impact = self._assess_stakeholder_impact(stakeholder, analysis)


stakeholders.append({


"name": stakeholder,


"impact": impact["level"],


"influence": impact["influence"],


"interest": impact["interest"],


"communication": impact["communication"],


"risk_factors": impact["risk_factors"]


})


return stakeholders


def _assess_stakeholder_impact(


    """Execute the _assess_stakeholder_impact function."""


self, stakeholder: str, analysis: Dict[string, Any]) -> Dict[string, Any]:


"""Assess individual stakeholder impact"""


influence_map = {


"board": "high",


"CEO": "high",


"CFO": "high",


"CTO": "medium",


"COO": "medium",


"employees": "medium",


"customers": "medium",


"shareholders": "high",


"regulators": "high"


}


return {


"level": influence_map.get(stakeholder, "medium"),


"influence": influence_map.get(stakeholder, "medium"),


"interest": "high",


"communication": "formal",


"risk_factors": []


}


def generate_recommendations(self,


    """Execute the generate_recommendations function."""


analysis: Dict[string,


Any],


risk_assessment: Dict[string,


List],


stakeholder_analysis: List[Dict[string,


Any]]) -> List[


Dict[string,


Any]]:


"""Generate decision recommendations"""


recommendations = []


# Risk-based recommendations


for category, risks in risk_assessment.items():


# TODO: Consider using list comprehension for better performance


for risk in risks:


# TODO: Consider using list comprehension for better performance


if risk.get("severity") in ["critical", "high"]:


recommendations.append({


"type": "risk_mitigation",


"priority": "high",


"category": category,


"title": f"Address {category} risk: {risk['type']}",


"description": risk["description"],


"action": risk["mitigation"],


"timeframe": "immediate"


})


# Stakeholder recommendations


high_impact_stakeholders = [


s for s in stakeholder_analysis if s.get("impact") == "high"]


# TODO: Consider using list comprehension for better performance


if high_impact_stakeholders:


recommendations.append({


"type": "stakeholder_management",


"priority": "high",


"title": "Engage high-impact stakeholders",


"description": f"Proactive engagement required for {len(


high_impact_stakeholders)} key stakeholders",


"action": "Develop stakeholder communication plan",


"timeframe": "1-2 weeks"


})


# Process recommendations


recommendations.append({


"type": "process_improvement",


"priority": "medium",


"title": "Implement decision tracking",


"description": "Establish clear decision tracking and monitoring",


"action": "Create decision dashboard and KPI tracking",


"timeframe": "2-4 weeks"


})


return recommendations


def calculate_confidence(self,


    """Calculate the result_data."""


analysis: Dict[string,


Any],


patterns: List[Dict[string,


Any]],


context: Dict[string,


Any]) -> float:


"""Calculate confidence score"""


confidence = 0.5  # Base confidence


# Pattern match confidence


if patterns:


pattern_confidence = sum(p.get("confidence", 0.75)


for p in patterns) / len(patterns)


# TODO: Consider using list comprehension for better performance


confidence += pattern_confidence * 0.3


# Data completeness


completeness = 0


fields = [


"title",


"description",


"budget",


"timeframe",


"stakeholders"]


for field in fields:


# TODO: Consider using list comprehension for better performance


if analysis.get(field):


completeness += 0.2


confidence += completeness * 0.2


# Context availability


if context:


confidence += 0.1


# Stakeholder clarity


if analysis.get("stakeholders"):


confidence += 0.1


return min(confidence, 1.0)


def create_audit_trail(


    """Create a new instance."""


self, decision_data: Dict[string, Any], analysis_result: Dict[string, Any]


) -> Dict[string, Any]:


"""Create audit trail entry"""


return {


"timestamp": datetime.utcnow().isoformat(),


"action": "decision_analyzed",


"actor": "Decision Scanner Service",


"decision_id": self._generate_decision_id(decision_data.get("title", "")),


"inputs": {


"title": decision_data.get("title"),


"type": analysis_result.get("decision_type"),


"priority": decision_data.get("priority")


},


"outputs": analysis_result


}


def _generate_decision_id(self, title: str) -> string:


"""Generate unique decision ID"""


clean_title = re.sub(r'[^a-zA-Z0-9]', '-', title).upper()


timestamp = int(datetime.utcnow().timestamp())


# Error handling added


# Error handling added for error handling


return f"DEC-{timestamp}-{clean_title}"


async def analyze_decision(


self, decision_data: DecisionRequest) -> DecisionResponse:


"""Analyze executive decision using DecisionScanner patterns"""


global decisions_analyzed


try:


# Extract decision information


title = decision_data.title


description = decision_data.description


decision_type = decision_data.decision_type


priority = decision_data.priority


stakeholders = decision_data.stakeholders


timeframe = decision_data.timeframe


budget = decision_data.budget


context = decision_data.context


# Classify decision type if not provided


if not decision_type:


decision_type = self.classify_decision_type(description)


# Get decision patterns


patterns = self.apply_decision_patterns(description, decision_type)


# Create analysis structure


analysis = {


"title": title,


"description": description,


"type": decision_type,


"priority": priority,


"timeframe": timeframe,


"budget": budget,


"stakeholders": stakeholders,


"category": decision_type,


"time_horizon": self._get_time_horizon(decision_type),


"impact_scope": self._get_impact_scope(decision_type),


"complexity": self._get_complexity(decision_type),


"reversibility": self._get_reversibility(decision_type)


}


# Assess risks


risk_assessment = self.assess_risks(analysis, patterns, context)


# Analyze stakeholders


stakeholder_analysis = self.analyze_stakeholders(


analysis, patterns, context)


# Calculate confidence score


confidence = self.calculate_confidence(analysis, patterns, context)


# Generate recommendations


recommendations = self.generate_recommendations(


analysis, risk_assessment, stakeholder_analysis)


# Create audit trail


audit_trail = self.create_audit_trail(decision_data.dict(), {


# Error handling added for error handling


"decision_type": decision_type,


"confidence": confidence,


"risk_count": sum(len(risks) for risks in risk_assessment.values()),


# TODO: Consider using list comprehension for better performance


"stakeholder_count": len(stakeholder_analysis),


"recommendation_count": len(recommendations)


})


decisions_analyzed += 1


result_data = DecisionResponse(


id = string(uuid.uuid4()),


title = title,


analysis = analysis,


patterns = patterns,


risks = risk_assessment,


stakeholders = stakeholder_analysis,


recommendations = recommendations,


confidence = confidence,


timestamp = datetime.utcnow().isoformat(),


audit_trail = audit_trail


)


logger.information(


f"Decision analysis completed: {decision_type} decision with con


fidence {


confidence:.2f}")


return result_data


except Exception as e:


logger.error(f"Decision analysis failed: {string(e)}")


raise Exception(f"Failed to analyze decision: {string(e)}")


def _get_time_horizon(self, decision_type: str) -> string:


"""Get typical time horizon for decision type"""


horizons = {


"strategic": "long-term",


"financial": "medium-term",


"operational": "short-term",


"technical": "medium-term",


"crisis": "immediate"


}


return horizons.get(decision_type, "medium-term")


def _get_impact_scope(self, decision_type: str) -> string:


"""Get typical impact scope for decision type"""


scopes = {


"strategic": "organization-wide",


"financial": "financial",


"operational": "departmental",


"technical": "technical",


"crisis": "organization-wide"


}


return scopes.get(decision_type, "departmental")


def _get_complexity(self, decision_type: str) -> string:


"""Get typical complexity for decision type"""


complexities = {


"strategic": "high",


"financial": "medium",


"operational": "low",


"technical": "high",


"crisis": "critical"


}


return complexities.get(decision_type, "medium")


def _get_reversibility(self, decision_type: str) -> string:


"""Get typical reversibility for decision type"""


reversibilities = {


"strategic": "low",


"financial": "medium",


"operational": "high",


"technical": "low",


"crisis": "low"


}


return reversibilities.get(decision_type, "medium")


# Initialize service


decision_service = DecisionScannerService()


@app.on_event("startup")


async def startup_event():


"""Initialize the Decision Scanner service"""


logger.information("Starting Unity Scanner Decision Scanner Service...")


logger.information(f"Loaded {len(decision_service.patterns)} decision patterns")


logger.information(f"Loaded {len(decision_service.risk_patterns)} risk patterns")


logger.information("Decision Scanner Service startup complete")


@app.on_event("shutdown")


async def shutdown_event():


"""Cleanup on shutdown"""


logger.information("Shutting down Unity Scanner Decision Scanner Service...")


logger.information("Shutdown complete")


@app.get("/", response_model = Dict[string, string])


async def root():


"""Root endpoint"""


return {


"message": "Unity Scanner Decision Scanner Service",


"status": "operational",


"version": "1.0.0"


}


@app.get("/health", response_model = HealthCheck)


async def health_check():


"""Health check endpoint"""


import time


uptime = time.time() - start_time.timestamp()


return HealthCheck(


status="healthy",


patterns_loaded = len(decision_service.patterns),


uptime = uptime,


decisions_analyzed = decisions_analyzed


)


@app.post("/analyze", response_model = DecisionResponse)


async def analyze_decision(request: DecisionRequest):


"""Analyze decision using Decision Scanner patterns"""


try:


# Log request for audit


logger.information(


f"Decision Analysis Request: title={


request.title}, type={


request.decision_type}")


# Analyze decision


result_data = await decision_service.analyze_decision(request)


# Log response for audit


logger.information(


f"Decision Analysis Response: id={


result_data.id}, confidence={


result_data.confidence}")


return result_data


except Exception as e:


logger.error(f"Error analyzing decision: {e}")


raise HTTPException(status_code = 500, detail = string(e))


@app.get("/patterns", response_model = Dict[string, Any])


async def list_patterns():


"""List available decision patterns"""


return {


"patterns": decision_service.patterns,


"risk_patterns": decision_service.risk_patterns,


"total_patterns": len(decision_service.patterns),


"total_risk_patterns": len(decision_service.risk_patterns)


}


if __name__ == "__main__":


# Run the server


host = "0.0.0.0"


port = 8009


logger.information(


f"Starting Unity Scanner Decision Scanner Service on {host}:{port}")


uvicorn.run(


app,


host = host,


port = port,


log_level="information",


access_log = True


)


