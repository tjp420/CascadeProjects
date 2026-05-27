"""
Financial Impact API Router
Endpoints for M&A financial impact calculations
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from financial_impact_calculator import calculate_financial_impact

router = APIRouter(prefix="/api/financial-impact", tags=["financial-impact"])

@router.post("/calculate")
async def calculate_financial_impact_endpoint(request_data: Dict[str, Any]):
    """
    Calculate financial impact of technical debt for M&A decisions
    
    Args:
        request_data: Dictionary containing:
            - metrics: Code quality metrics
            - team_size: Number of developers
            - avg_salary: Average annual salary
            - industry: Industry sector
            - company_name: Target company name
    
    Returns:
        Financial impact analysis with cost breakdowns
    """
    try:
        result = calculate_financial_impact(request_data)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
            
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@router.get("/industries")
async def get_supported_industries():
    """Get list of supported industries with their multipliers"""
    from financial_impact_calculator import FinancialImpactCalculator
    
    calculator = FinancialImpactCalculator()
    return {
        "industries": calculator.INDUSTRY_MULTIPLIERS,
        "description": "Industry multipliers for technical debt impact calculation"
    }

@router.get("/severity-levels")
async def get_severity_levels():
    """Get technical debt severity levels and multipliers"""
    from financial_impact_calculator import FinancialImpactCalculator
    
    calculator = FinancialImpactCalculator()
    return {
        "severity_levels": calculator.DEBT_SEVERITY_MULTIPLIERS,
        "description": "Technical debt severity multipliers for cost calculation"
    }

@router.post("/sample-calculation")
async def sample_calculation():
    """Generate sample calculation for demonstration purposes"""
    sample_data = {
        "metrics": {
            "debt_score": 65,
            "complexity_score": 72,
            "security_score": 78,
            "test_coverage": 45,
            "documentation_score": 38
        },
        "team_size": 15,
        "avg_salary": 135000,
        "industry": "fintech",
        "company_name": "Demo Target Company"
    }
    
    result = calculate_financial_impact(sample_data)
    return result
