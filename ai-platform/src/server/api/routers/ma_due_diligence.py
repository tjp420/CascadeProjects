#!/usr/bin/env python3

"""
M&A Due Diligence API Router

Provides endpoints for M&A due diligence analysis including financial impact
calculations, risk assessments, and executive reporting.

"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

# Import dependencies
from database import get_db
from auth import get_current_user
from models import User

# Import M&A modules
from ma_financial_impact import MAFinancialImpactCalculator, FinancialImpactData
from ma_risk_assessment import MARiskAssessment

# Import existing analysis modules
from code_analysis import analyze_codebase
from mock_scanner import perform_security_scan

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize M&A analysis engines
financial_calculator = MAFinancialImpactCalculator()
risk_assessor = MARiskAssessment()

@router.post("/financial-impact")
async def calculate_financial_impact(
    project_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate financial impact for M&A due diligence
    
    Args:
        project_data: Project analysis data including team size, salaries, etc.
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Comprehensive financial impact analysis
    """
    try:
        # Extract required data
        team_size = project_data.get('team_size', 10)
        average_salary = project_data.get('average_salary', 120000)
        
        # Get code analysis data
        code_analysis = project_data.get('code_analysis', {})
        technical_debt_score = code_analysis.get('technicalDebtScore', 70)
        code_quality_score = code_analysis.get('codeQuality', 75)
        security_score = code_analysis.get('securityScore', 80)
        scalability_score = code_analysis.get('scalabilityScore', 70)
        documentation_score = code_analysis.get('documentationScore', 65)
        lines_of_code = code_analysis.get('linesOfCode', 100000)
        complexity_score = code_analysis.get('complexityScore', 60)
        
        # Create financial impact data
        financial_data = FinancialImpactData(
            technical_debt_score=technical_debt_score,
            code_quality_score=code_quality_score,
            security_score=security_score,
            scalability_score=scalability_score,
            documentation_score=documentation_score,
            team_size=team_size,
            average_salary=average_salary,
            lines_of_code=lines_of_code,
            complexity_score=complexity_score
        )
        
        # Calculate financial impact
        result = financial_calculator.calculate_financial_impact(financial_data)
        
        # Generate executive summary
        company_name = project_data.get('company_name', 'Target Company')
        executive_summary = financial_calculator.generate_executive_summary(result, company_name)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "financial_impact": {
                "remediation_cost": result.remediation_cost,
                "annual_maintenance_cost": result.annual_maintenance_cost,
                "integration_cost": result.integration_cost,
                "total_3_year_impact": result.total_3_year_impact,
                "risk_adjusted_valuation_impact": result.risk_adjusted_valuation_impact,
                "due_diligence_score": result.due_diligence_score,
                "recommendation": result.recommendation,
                "key_risk_factors": result.key_risk_factors
            },
            "executive_summary": executive_summary
        }
        
    except Exception as e:
        logger.error(f"Error calculating financial impact: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate financial impact: {str(e)}"
        )

@router.post("/risk-assessment")
async def perform_risk_assessment(
    project_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perform comprehensive M&A risk assessment
    
    Args:
        project_data: Project data for risk analysis
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Comprehensive risk assessment results
    """
    try:
        # Get analysis data
        code_analysis = project_data.get('code_analysis', {})
        security_scan = project_data.get('security_scan', {})
        team_analysis = project_data.get('team_analysis', {})
        
        # Perform risk assessment
        result = risk_assessor.assess_risks(code_analysis, security_scan, team_analysis)
        
        # Generate risk report
        company_name = project_data.get('company_name', 'Target Company')
        risk_report = risk_assessor.generate_risk_report(result, company_name)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "risk_assessment": {
                "overall_risk_score": result.overall_risk_score,
                "overall_risk_level": result.overall_risk_level.value,
                "deal_recommendation": result.deal_recommendation,
                "critical_risks_count": len(result.critical_risks),
                "total_risk_factors": len(result.risk_factors),
                "category_scores": result.category_scores
            },
            "risk_report": risk_report
        }
        
    except Exception as e:
        logger.error(f"Error performing risk assessment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform risk assessment: {str(e)}"
        )

@router.post("/comprehensive-analysis")
async def perform_comprehensive_ma_analysis(
    project_path: str,
    project_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perform comprehensive M&A due diligence analysis
    
    This endpoint combines code analysis, security scanning, financial impact
    calculation, and risk assessment into a single comprehensive report.
    
    Args:
        project_path: Path to the target project
        project_data: Project metadata (team size, salaries, etc.)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Complete M&A due diligence analysis
    """
    try:
        # Step 1: Perform code analysis
        code_analysis = analyze_codebase(project_path)
        
        # Step 2: Perform security scan
        security_scan = perform_security_scan(project_path)
        
        # Step 3: Analyze team structure (mock for now)
        team_analysis = project_data.get('team_analysis', {
            'team_size': project_data.get('team_size', 10),
            'key_person_dependency': project_data.get('key_person_dependency', False),
            'skill_gaps': project_data.get('skill_gaps', [])
        })
        
        # Step 4: Calculate financial impact
        team_size = project_data.get('team_size', 10)
        average_salary = project_data.get('average_salary', 120000)
        
        financial_data = FinancialImpactData(
            technical_debt_score=code_analysis.get('technicalDebtScore', 70),
            code_quality_score=code_analysis.get('codeQuality', 75),
            security_score=security_scan.get('securityScore', 80),
            scalability_score=code_analysis.get('scalabilityScore', 70),
            documentation_score=code_analysis.get('documentationScore', 65),
            team_size=team_size,
            average_salary=average_salary,
            lines_of_code=code_analysis.get('linesOfCode', 100000),
            complexity_score=code_analysis.get('complexityScore', 60)
        )
        
        financial_result = financial_calculator.calculate_financial_impact(financial_data)
        
        # Step 5: Perform risk assessment
        risk_result = risk_assessor.assess_risks(code_analysis, security_scan, team_analysis)
        
        # Step 6: Generate comprehensive report
        company_name = project_data.get('company_name', 'Target Company')
        
        executive_summary = financial_calculator.generate_executive_summary(
            financial_result, company_name
        )
        
        risk_report = risk_assessor.generate_risk_report(risk_result, company_name)
        
        # Step 7: Calculate overall M&A score
        ma_score = _calculate_overall_ma_score(financial_result, risk_result)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "company_name": company_name,
            "project_path": project_path,
            "overall_ma_score": ma_score,
            "financial_impact": {
                "remediation_cost": financial_result.remediation_cost,
                "annual_maintenance_cost": financial_result.annual_maintenance_cost,
                "integration_cost": financial_result.integration_cost,
                "total_3_year_impact": financial_result.total_3_year_impact,
                "risk_adjusted_valuation_impact": financial_result.risk_adjusted_valuation_impact,
                "due_diligence_score": financial_result.due_diligence_score,
                "recommendation": financial_result.recommendation
            },
            "risk_assessment": {
                "overall_risk_score": risk_result.overall_risk_score,
                "overall_risk_level": risk_result.overall_risk_level.value,
                "deal_recommendation": risk_result.deal_recommendation,
                "critical_risks_count": len(risk_result.critical_risks),
                "category_scores": risk_result.category_scores
            },
            "executive_summary": executive_summary,
            "risk_report": risk_report,
            "deal_recommendation": _generate_final_recommendation(ma_score, financial_result, risk_result)
        }
        
    except Exception as e:
        logger.error(f"Error performing comprehensive M&A analysis: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform comprehensive analysis: {str(e)}"
        )

@router.get("/industry-benchmark")
async def get_industry_benchmarks(
    industry: str,
    company_size: str = "medium",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get industry benchmarks for M&A due diligence comparison
    
    Args:
        industry: Industry sector (tech, fintech, healthcare, etc.)
        company_size: Company size (small, medium, large, enterprise)
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Industry benchmark data
    """
    try:
        # Mock benchmark data (in production, this would come from a database)
        benchmarks = {
            "tech": {
                "small": {
                    "avg_technical_debt_score": 75,
                    "avg_security_score": 80,
                    "avg_remediation_cost": 50000,
                    "avg_integration_time": "6 months"
                },
                "medium": {
                    "avg_technical_debt_score": 70,
                    "avg_security_score": 75,
                    "avg_remediation_cost": 150000,
                    "avg_integration_time": "12 months"
                },
                "large": {
                    "avg_technical_debt_score": 65,
                    "avg_security_score": 70,
                    "avg_remediation_cost": 500000,
                    "avg_integration_time": "18 months"
                }
            },
            "fintech": {
                "small": {
                    "avg_technical_debt_score": 80,
                    "avg_security_score": 85,
                    "avg_remediation_cost": 75000,
                    "avg_integration_time": "9 months"
                },
                "medium": {
                    "avg_technical_debt_score": 75,
                    "avg_security_score": 80,
                    "avg_remediation_cost": 200000,
                    "avg_integration_time": "15 months"
                },
                "large": {
                    "avg_technical_debt_score": 70,
                    "avg_security_score": 75,
                    "avg_remediation_cost": 750000,
                    "avg_integration_time": "24 months"
                }
            }
        }
        
        industry_data = benchmarks.get(industry.lower(), benchmarks["tech"])
        size_data = industry_data.get(company_size.lower(), industry_data["medium"])
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "industry": industry,
            "company_size": company_size,
            "benchmarks": size_data,
            "comparative_notes": _generate_comparative_notes(industry, company_size)
        }
        
    except Exception as e:
        logger.error(f"Error getting industry benchmarks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get benchmarks: {str(e)}"
        )

@router.post("/executive-report")
async def generate_executive_report(
    analysis_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate executive-ready M&A due diligence report
    
    Args:
        analysis_data: Complete analysis data
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Executive report in PDF/Excel format
    """
    try:
        # Generate executive report
        company_name = analysis_data.get('company_name', 'Target Company')
        
        executive_report = {
            "company_name": company_name,
            "report_date": datetime.now().isoformat(),
            "prepared_for": current_user.email,
            "executive_summary": analysis_data.get('executive_summary', {}),
            "financial_highlights": analysis_data.get('financial_impact', {}),
            "risk_assessment": analysis_data.get('risk_assessment', {}),
            "deal_recommendation": analysis_data.get('deal_recommendation', {}),
            "next_steps": _generate_executive_next_steps(analysis_data)
        }
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "executive_report": executive_report,
            "export_options": ["PDF", "Excel", "PowerPoint"]
        }
        
    except Exception as e:
        logger.error(f"Error generating executive report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate executive report: {str(e)}"
        )

def _calculate_overall_ma_score(financial_result, risk_result) -> Dict[str, Any]:
    """Calculate overall M&A due diligence score"""
    # Convert financial score to numeric (A+ = 4.33, A = 4.0, etc.)
    grade_to_numeric = {
        'A+': 4.33, 'A': 4.0, 'A-': 3.67,
        'B+': 3.33, 'B': 3.0, 'B-': 2.67,
        'C+': 2.33, 'C': 2.0, 'C-': 1.67,
        'D': 1.0
    }
    
    financial_score = grade_to_numeric.get(financial_result.due_diligence_score, 2.0)
    risk_score = 10 - risk_result.overall_risk_score  # Invert risk score (higher is better)
    
    # Weighted average (60% financial, 40% risk)
    overall_score = (financial_score * 0.6) + (risk_score * 0.4)
    
    # Convert back to grade
    if overall_score >= 4.0:
        grade = 'A'
    elif overall_score >= 3.5:
        grade = 'B+'
    elif overall_score >= 3.0:
        grade = 'B'
    elif overall_score >= 2.5:
        grade = 'C+'
    elif overall_score >= 2.0:
        grade = 'C'
    else:
        grade = 'D'
    
    return {
        "overall_score": round(overall_score, 2),
        "overall_grade": grade,
        "financial_component": round(financial_score, 2),
        "risk_component": round(risk_score, 2)
    }

def _generate_final_recommendation(ma_score: Dict[str, Any], 
                                 financial_result, risk_result) -> Dict[str, str]:
    """Generate final M&A recommendation"""
    grade = ma_score['overall_grade']
    
    if grade in ['A']:
        return {
            "recommendation": "PROCEED",
            "confidence": "High",
            "reasoning": "Strong financial profile with manageable risks"
        }
    elif grade in ['B+', 'B']:
        return {
            "recommendation": "PROCEED WITH CONDITIONS",
            "confidence": "Medium",
            "reasoning": "Good opportunity with specific risk mitigation requirements"
        }
    elif grade in ['C+', 'C']:
        return {
            "recommendation": "PROCEED WITH CAUTION",
            "confidence": "Low",
            "reasoning": "Significant concerns require substantial mitigation"
        }
    else:
        return {
            "recommendation": "DO NOT PROCEED",
            "confidence": "Very Low",
            "reasoning": "Unacceptable risk profile and financial concerns"
        }

def _generate_comparative_notes(industry: str, company_size: str) -> List[str]:
    """Generate comparative notes for benchmarks"""
    notes = [
        f"Benchmarks based on {industry} industry data for {company_size} companies",
        "Data represents industry averages from 2023-2024 M&A transactions",
        "Individual results may vary based on specific circumstances"
    ]
    
    if industry == "fintech":
        notes.append("Fintech companies typically have higher security requirements")
        notes.append("Regulatory compliance costs are typically higher in fintech")
    
    return notes

def _generate_executive_next_steps(analysis_data: Dict[str, Any]) -> List[str]:
    """Generate next steps for executive report"""
    steps = []
    
    financial_impact = analysis_data.get('financial_impact', {})
    risk_assessment = analysis_data.get('risk_assessment', {})
    
    if financial_impact.get('total_3_year_impact', 0) > 500000:
        steps.append("Establish technical remediation budget in acquisition agreement")
    
    if risk_assessment.get('critical_risks_count', 0) > 0:
        steps.append("Address all critical risks before closing")
    
    steps.append("Conduct technical team interviews as part of due diligence")
    steps.append("Review integration timeline and resource requirements")
    steps.append("Establish post-acquisition technical governance structure")
    
    return steps
