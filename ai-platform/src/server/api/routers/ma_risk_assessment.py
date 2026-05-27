"""
M&A Risk Assessment API Router
Endpoints for comprehensive M&A risk scoring and analysis
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ma_risk_assessor import calculate_maq_risk

router = APIRouter(prefix="/api/ma-risk-assessment", tags=["ma-risk-assessment"])

@router.post("/calculate")
async def calculate_maq_risk_endpoint(request_data: Dict[str, Any]):
    """
    Calculate comprehensive M&A risk assessment
    
    Args:
        request_data: Dictionary containing:
            - codebase_metrics: Code quality and technical metrics
            - deal_context: Deal-specific information (industry, timeline, team_size, etc.)
    
    Returns:
        Comprehensive M&A risk assessment with scores, recommendations, and mitigation strategies
    """
    try:
        result = calculate_maq_risk(request_data)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
            
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk assessment error: {str(e)}")

@router.get("/risk-factors")
async def get_risk_factors():
    """Get information about risk factors used in M&A assessment"""
    from ma_risk_assessor import MARiskAssessor
    
    assessor = MARiskAssessor()
    return {
        "risk_factors": {
            "integration_complexity": {
                "weight": assessor.RISK_WEIGHTS['integration_complexity'],
                "description": "How difficult it will be to integrate the target's systems",
                "impact": "High - affects integration timeline and cost"
            },
            "talent_retention": {
                "weight": assessor.RISK_WEIGHTS['talent_retention'],
                "description": "Risk of losing key developers during/after acquisition",
                "impact": "High - affects continuity and knowledge transfer"
            },
            "scalability_risk": {
                "weight": assessor.RISK_WEIGHTS['scalability_risk'],
                "description": "Whether the target's systems can scale with acquirer's growth",
                "impact": "Medium - affects long-term value realization"
            },
            "time_to_value": {
                "weight": assessor.RISK_WEIGHTS['time_to_value'],
                "description": "How long it will take to realize value from the acquisition",
                "impact": "Medium - affects ROI timeline"
            },
            "compliance_risk": {
                "weight": assessor.RISK_WEIGHTS['compliance_risk'],
                "description": "Regulatory and compliance risks",
                "impact": "Variable - depends on industry"
            }
        },
        "risk_levels": {
            "LOW": "0-25 score - Minimal risk, proceed with standard due diligence",
            "MEDIUM": "26-50 score - Moderate risk, requires mitigation planning",
            "HIGH": "51-75 score - High risk, requires significant mitigation",
            "CRITICAL": "76-100 score - Critical risk, may jeopardize deal"
        }
    }

@router.get("/industry-risk-multipliers")
async def get_industry_risk_multipliers():
    """Get industry-specific risk multipliers"""
    from ma_risk_assessor import MARiskAssessor
    
    assessor = MARiskAssessor()
    return {
        "industries": assessor.INDUSTRY_RISK_MULTIPLIERS,
        "description": "Industry-specific multipliers for risk calculation",
        "highest_risk": "healthcare (1.5x)",
        "lowest_risk": "education (0.8x)"
    }

@router.get("/timeline-risk-factors")
async def get_timeline_risk_factors():
    """Get timeline risk factors for deal assessment"""
    from ma_risk_assessor import MARiskAssessor
    
    assessor = MARiskAssessor()
    return {
        "timeline_factors": assessor.TIMELINE_RISK_FACTORS,
        "description": "Timeline-based risk multipliers",
        "categories": {
            "aggressive": "< 3 months - higher risk but faster value",
            "standard": "3-6 months - normal risk profile",
            "extended": "> 6 months - lower risk but higher cost"
        }
    }

@router.post("/sample-assessment")
async def sample_risk_assessment():
    """Generate sample M&A risk assessment for demonstration purposes"""
    sample_data = {
        "codebase_metrics": {
            "debt_score": 65,
            "complexity_score": 72,
            "security_score": 78,
            "architecture_score": 60,
            "performance_score": 55,
            "documentation_score": 38,
            "modularity_score": 45,
            "productivity_score": 50,
            "api_count": 75,
            "coupling_score": 68,
            "tech_diversity_score": 70,
            "database_score": 62,
            "privacy_score": 70,
            "audit_score": 55
        },
        "deal_context": {
            "company_name": "Demo Target Company",
            "industry": "fintech",
            "timeline_months": 6,
            "team_size": 15,
            "deal_value": 50000000
        }
    }
    
    result = calculate_maq_risk(sample_data)
    return result

@router.post("/compare-scenarios")
async def compare_risk_scenarios(request_data: Dict[str, Any]):
    """
    Compare multiple risk scenarios (different industries, timelines, etc.)
    
    Args:
        request_data: Dictionary containing:
            - base_metrics: Base codebase metrics
            - scenarios: List of scenario variations (industry, timeline, etc.)
    
    Returns:
        Comparison of risk scores across different scenarios
    """
    try:
        base_metrics = request_data.get('base_metrics', {})
        scenarios = request_data.get('scenarios', [])
        
        results = []
        for scenario in scenarios:
            scenario_data = {
                'codebase_metrics': base_metrics,
                'deal_context': scenario
            }
            
            result = calculate_maq_risk(scenario_data)
            if result['success']:
                scenario_result = result['data']
                scenario_result['scenario_name'] = scenario.get('name', 'Unnamed Scenario')
                results.append(scenario_result)
        
        return {
            'success': True,
            'data': {
                'scenarios': results,
                'comparison': {
                    'lowest_risk': min(results, key=lambda x: x['overall_maq_risk']),
                    'highest_risk': max(results, key=lambda x: x['overall_maq_risk']),
                    'average_risk': sum(s['overall_maq_risk'] for s in results) / len(results)
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario comparison error: {str(e)}")

@router.get("/mitigation-strategies")
async def get_mitigation_strategies():
    """Get comprehensive mitigation strategies for different risk factors"""
    strategies = {
        "integration_complexity": {
            "strategy": "Phased Integration Approach",
            "phases": [
                "Phase 1: API Integration (1-2 months)",
                "Phase 2: Data Migration (2-3 months)", 
                "Phase 3: Full System Integration (3-6 months)"
            ],
            "key_actions": [
                "Create detailed integration roadmap",
                "Allocate dedicated integration team",
                "Implement API-first integration pattern",
                "Establish integration testing framework"
            ],
            "estimated_cost": "$250k - $500k",
            "timeline": "6-12 months",
            "success_metrics": [
                "Integration completion rate",
                "System uptime during integration",
                "User adoption metrics"
            ]
        },
        "talent_retention": {
            "strategy": "Comprehensive Talent Retention Program",
            "components": [
                "Financial incentives (retention bonuses)",
                "Career development paths",
                "Cultural integration programs",
                "Knowledge transfer initiatives"
            ],
            "key_actions": [
                "Offer 18-24 month retention bonuses",
                "Create clear career progression",
                "Maintain engineering culture",
                "Implement mentorship programs"
            ],
            "estimated_cost": "15-25% of annual salaries",
            "timeline": "Immediate implementation",
            "success_metrics": [
                "Retention rate after 12 months",
                "Employee satisfaction scores",
                "Productivity maintenance"
            ]
        },
        "scalability_risk": {
            "strategy": "Scalability Assessment & Upgrade",
            "components": [
                "Architecture review",
                "Performance testing",
                "Infrastructure planning",
                "Monitoring implementation"
            ],
            "key_actions": [
                "Conduct load testing to 10x current load",
                "Plan microservices architecture migration",
                "Implement auto-scaling infrastructure",
                "Create performance monitoring"
            ],
            "estimated_cost": "$200k - $400k",
            "timeline": "3-6 months",
            "success_metrics": [
                "System performance under load",
                "Response time improvements",
                "Infrastructure utilization"
            ]
        },
        "compliance_risk": {
            "strategy": "Regulatory Compliance Framework",
            "components": [
                "Compliance audit",
                "Legal review",
                "Documentation creation",
                "Ongoing monitoring"
            ],
            "key_actions": [
                "Hire compliance specialists",
                "Implement audit controls",
                "Create compliance documentation",
                "Establish monitoring systems"
            ],
            "estimated_cost": "$150k - $300k",
            "timeline": "3-6 months",
            "success_metrics": [
                "Audit pass rate",
                "Compliance documentation completeness",
                "Regulatory issue resolution time"
            ]
        }
    }
    
    return {
        "strategies": strategies,
        "implementation_approach": "Combine strategies based on highest risk factors",
        "budget_planning": "Allocate 2-5% of deal value for risk mitigation"
    }
