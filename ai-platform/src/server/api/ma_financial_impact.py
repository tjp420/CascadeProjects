#!/usr/bin/env python3

"""
M&A Financial Impact Calculator

Converts technical debt and code quality metrics into financial impact assessments
for M&A due diligence decisions.

"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class FinancialImpactData:
    """Data structure for financial impact calculations"""
    technical_debt_score: float
    code_quality_score: float
    security_score: float
    scalability_score: float
    documentation_score: float
    team_size: int
    average_salary: float
    lines_of_code: int
    complexity_score: float

@dataclass
class FinancialImpactResult:
    """Financial impact calculation results"""
    remediation_cost: float
    annual_maintenance_cost: float
    integration_cost: float
    total_3_year_impact: float
    risk_adjusted_valuation_impact: float
    due_diligence_score: str
    recommendation: str
    key_risk_factors: List[str]

class MAFinancialImpactCalculator:
    """M&A Financial Impact Calculator for Due Diligence"""
    
    def __init__(self):
        """Initialize the financial impact calculator"""
        # Industry standard cost multipliers
        self.remediation_multipliers = {
            'low': 0.05,      # 5% of team annual salary
            'medium': 0.15,   # 15% of team annual salary  
            'high': 0.35,     # 35% of team annual salary
            'critical': 0.60  # 60% of team annual salary
        }
        
        self.maintenance_multipliers = {
            'low': 0.02,      # 2% of team annual salary annually
            'medium': 0.08,   # 8% of team annual salary annually
            'high': 0.20,     # 20% of team annual salary annually
            'critical': 0.35  # 35% of team annual salary annually
        }
        
        # Integration complexity factors
        self.integration_factors = {
            'simple': 0.1,    # 10% of remediation cost
            'moderate': 0.25,  # 25% of remediation cost
            'complex': 0.5,    # 50% of remediation cost
            'very_complex': 1.0 # 100% of remediation cost
        }

    def calculate_financial_impact(self, data: FinancialImpactData) -> FinancialImpactResult:
        """
        Calculate comprehensive financial impact for M&A due diligence
        
        Args:
            data: Financial impact input data
            
        Returns:
            FinancialImpactResult: Detailed financial impact analysis
        """
        try:
            # Determine risk categories
            debt_category = self._categorize_technical_debt(data.technical_debt_score)
            quality_category = self._categorize_code_quality(data.code_quality_score)
            security_category = self._categorize_security(data.security_score)
            
            # Calculate base costs
            team_annual_cost = data.team_size * data.average_salary
            
            # Remediation cost (one-time)
            remediation_multiplier = self.remediation_multipliers[debt_category]
            remediation_cost = team_annual_cost * remediation_multiplier
            
            # Annual maintenance cost
            maintenance_multiplier = self.maintenance_multipliers[debt_category]
            annual_maintenance_cost = team_annual_cost * maintenance_multiplier
            
            # Integration cost
            integration_complexity = self._assess_integration_complexity(data)
            integration_factor = self.integration_factors[integration_complexity]
            integration_cost = remediation_cost * integration_factor
            
            # Total 3-year impact
            total_3_year_impact = (
                remediation_cost + 
                (annual_maintenance_cost * 3) + 
                integration_cost
            )
            
            # Risk-adjusted valuation impact (conservative 2x multiplier for risk)
            risk_adjusted_valuation_impact = total_3_year_impact * 2.0
            
            # Due diligence scoring
            due_diligence_score = self._calculate_due_diligence_score(data)
            recommendation = self._generate_recommendation(due_diligence_score, debt_category)
            
            # Key risk factors
            key_risk_factors = self._identify_risk_factors(data)
            
            return FinancialImpactResult(
                remediation_cost=remediation_cost,
                annual_maintenance_cost=annual_maintenance_cost,
                integration_cost=integration_cost,
                total_3_year_impact=total_3_year_impact,
                risk_adjusted_valuation_impact=risk_adjusted_valuation_impact,
                due_diligence_score=due_diligence_score,
                recommendation=recommendation,
                key_risk_factors=key_risk_factors
            )
            
        except Exception as e:
            logger.error(f"Error calculating financial impact: {e}")
            raise

    def _categorize_technical_debt(self, score: float) -> str:
        """Categorize technical debt based on score"""
        if score >= 90:
            return 'low'
        elif score >= 75:
            return 'medium'
        elif score >= 60:
            return 'high'
        else:
            return 'critical'

    def _categorize_code_quality(self, score: float) -> str:
        """Categorize code quality based on score"""
        if score >= 85:
            return 'excellent'
        elif score >= 70:
            return 'good'
        elif score >= 55:
            return 'fair'
        else:
            return 'poor'

    def _categorize_security(self, score: float) -> str:
        """Categorize security based on score"""
        if score >= 90:
            return 'secure'
        elif score >= 75:
            return 'mostly_secure'
        elif score >= 60:
            return 'vulnerable'
        else:
            return 'critical_vulnerabilities'

    def _assess_integration_complexity(self, data: FinancialImpactData) -> str:
        """Assess integration complexity based on multiple factors"""
        complexity_score = 0
        
        # Factor in lines of code
        if data.lines_of_code > 500000:
            complexity_score += 2
        elif data.lines_of_code > 100000:
            complexity_score += 1
            
        # Factor in architectural complexity
        if data.complexity_score > 80:
            complexity_score += 2
        elif data.complexity_score > 60:
            complexity_score += 1
            
        # Factor in documentation quality
        if data.documentation_score < 50:
            complexity_score += 2
        elif data.documentation_score < 70:
            complexity_score += 1
            
        # Factor in scalability issues
        if data.scalability_score < 60:
            complexity_score += 1
            
        # Determine complexity category
        if complexity_score >= 5:
            return 'very_complex'
        elif complexity_score >= 3:
            return 'complex'
        elif complexity_score >= 1:
            return 'moderate'
        else:
            return 'simple'

    def _calculate_due_diligence_score(self, data: FinancialImpactData) -> str:
        """Calculate overall due diligence score"""
        # Weight different factors for M&A decision making
        weights = {
            'code_quality': 0.25,
            'security': 0.30,
            'scalability': 0.20,
            'documentation': 0.15,
            'technical_debt': 0.10
        }
        
        # Calculate weighted score
        weighted_scores = [
            data.code_quality_score * weights['code_quality'],
            data.security_score * weights['security'],
            data.scalability_score * weights['scalability'],
            data.documentation_score * weights['documentation'],
            data.technical_debt_score * weights['technical_debt']
        ]
        
        overall_score = sum(weighted_scores)
        
        # Convert to letter grade
        if overall_score >= 90:
            return 'A+'
        elif overall_score >= 85:
            return 'A'
        elif overall_score >= 80:
            return 'A-'
        elif overall_score >= 75:
            return 'B+'
        elif overall_score >= 70:
            return 'B'
        elif overall_score >= 65:
            return 'B-'
        elif overall_score >= 60:
            return 'C+'
        elif overall_score >= 55:
            return 'C'
        elif overall_score >= 50:
            return 'C-'
        else:
            return 'D'

    def _generate_recommendation(self, score: str, debt_category: str) -> str:
        """Generate M&A recommendation based on assessment"""
        if score in ['A+', 'A', 'A-']:
            return "PROCEED - Low risk, high quality codebase"
        elif score in ['B+', 'B', 'B-']:
            if debt_category in ['low', 'medium']:
                return "PROCEED WITH CONDITIONS - Moderate risk, negotiate remediation budget"
            else:
                return "PROCEED WITH CAUTION - Significant technical debt, require detailed integration plan"
        elif score in ['C+', 'C', 'C-']:
            return "RECONSIDER - High risk, substantial technical investment required"
        else:
            return "DO NOT PROCEED - Critical issues, significant financial risk"

    def _identify_risk_factors(self, data: FinancialImpactData) -> List[str]:
        """Identify key risk factors for M&A decision"""
        risk_factors = []
        
        if data.technical_debt_score < 70:
            risk_factors.append("High technical debt requiring significant remediation")
            
        if data.security_score < 75:
            risk_factors.append("Security vulnerabilities requiring immediate attention")
            
        if data.scalability_score < 65:
            risk_factors.append("Scalability concerns for future growth")
            
        if data.documentation_score < 60:
            risk_factors.append("Poor documentation complicating integration")
            
        if data.complexity_score > 75:
            risk_factors.append("High architectural complexity")
            
        if data.lines_of_code > 500000:
            risk_factors.append("Large codebase increases integration complexity")
            
        return risk_factors

    def generate_executive_summary(self, result: FinancialImpactResult, company_name: str) -> Dict[str, Any]:
        """Generate executive summary for M&A decision makers"""
        return {
            'company_name': company_name,
            'assessment_date': datetime.now().isoformat(),
            'due_diligence_score': result.due_diligence_score,
            'recommendation': result.recommendation,
            'financial_highlights': {
                'immediate_remediation_cost': f"${result.remediation_cost:,.0f}",
                'annual_maintenance_burden': f"${result.annual_maintenance_cost:,.0f}",
                'integration_complexity_cost': f"${result.integration_cost:,.0f}",
                'total_3_year_financial_impact': f"${result.total_3_year_impact:,.0f}",
                'risk_adjusted_valuation_impact': f"${result.risk_adjusted_valuation_impact:,.0f}"
            },
            'key_risk_factors': result.key_risk_factors,
            'next_steps': self._generate_next_steps(result),
            'deal_implications': self._assess_deal_implications(result)
        }

    def _generate_next_steps(self, result: FinancialImpactResult) -> List[str]:
        """Generate recommended next steps"""
        steps = []
        
        if result.remediation_cost > 100000:
            steps.append("Conduct detailed technical audit before final agreement")
            
        if 'critical' in result.recommendation.lower():
            steps.append("Consider renegotiating purchase price based on technical findings")
            
        if len(result.key_risk_factors) > 3:
            steps.append("Require technical representations and warranties in agreement")
            
        steps.append("Budget for post-acquisition integration and remediation")
        steps.append("Establish technical integration team and timeline")
        
        return steps

    def _assess_deal_implications(self, result: FinancialImpactResult) -> Dict[str, str]:
        """Assess implications for deal structure"""
        implications = {}
        
        if result.total_3_year_impact > 1000000:
            implications['purchase_price'] = "Consider price adjustment of 10-20% of technical impact"
            implications['earn_out'] = "Structure earn-out based on successful technical integration"
        elif result.total_3_year_impact > 500000:
            implications['purchase_price'] = "Consider price adjustment of 5-10% of technical impact"
            implications['escrow'] = "Establish escrow for remediation costs"
        else:
            implications['purchase_price'] = "Minimal price adjustment needed"
            implications['timeline'] = "Standard integration timeline acceptable"
            
        return implications
