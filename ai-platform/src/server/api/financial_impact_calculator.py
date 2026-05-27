"""
M&A Financial Impact Calculator
Converts technical debt and code quality metrics into dollar amounts for M&A decisions
"""

import json
from typing import Dict, List, Tuple
from datetime import datetime

class FinancialImpactCalculator:
    def __init__(self):
        # Industry-specific multipliers for technical debt impact
        self.INDUSTRY_MULTIPLIERS = {
            'fintech': 1.3,      # Higher technical debt impact due to regulations
            'healthcare': 1.4,    # Compliance costs and regulations
            'ecommerce': 1.1,    # Standard impact
            'tech': 1.0,         # Baseline
            'manufacturing': 0.9, # Lower tech dependency
            'retail': 1.0,       # Standard
            'education': 0.8,     # Lower financial impact
            'government': 1.2,   # Higher compliance requirements
        }
        
        # Cost factors based on team size and salary ranges
        self.SALARY_MULTIPLIERS = {
            'junior': 0.6,       # $60-80k
            'mid': 1.0,          # $80-120k  
            'senior': 1.5,       # $120-180k
            'lead': 2.0,         # $180k+
        }
        
        # Technical debt severity multipliers
        self.DEBT_SEVERITY_MULTIPLIERS = {
            'low': 0.5,      # Minor issues, quick fixes
            'medium': 1.0,   # Standard technical debt
            'high': 1.8,     # Significant architectural issues
            'critical': 2.5  # Major restructuring required
        }

    def calculate_technical_debt_cost(self, metrics: Dict, team_size: int, avg_salary: float, industry: str = 'tech') -> Dict:
        """
        Convert code metrics to dollar amounts for technical debt
        
        Args:
            metrics: Code quality metrics from analysis
            team_size: Number of developers on team
            avg_salary: Average annual salary in USD
            industry: Industry sector for multiplier
            
        Returns:
            Dictionary with cost breakdowns
        """
        industry_multiplier = self.INDUSTRY_MULTIPLIERS.get(industry, 1.0)
        
        # Base calculations
        debt_score = metrics.get('debt_score', 50)  # 0-100 scale
        complexity_score = metrics.get('complexity_score', 50)
        security_score = metrics.get('security_score', 70)
        
        # Determine debt severity
        if debt_score < 25:
            severity = 'low'
        elif debt_score < 50:
            severity = 'medium'
        elif debt_score < 75:
            severity = 'high'
        else:
            severity = 'critical'
            
        severity_multiplier = self.DEBT_SEVERITY_MULTIPLIERS[severity]
        
        # Calculate remediation cost (one-time)
        # Formula: debt_score * team_size * avg_salary * severity_multiplier * 0.15
        remediation_cost = (
            debt_score / 100 *  # Normalize to 0-1
            team_size * 
            avg_salary * 
            severity_multiplier * 
            0.15  # 15% of annual team cost for remediation
        )
        
        # Calculate annual maintenance cost
        # Formula: debt_score * team_size * avg_salary * industry_multiplier * 0.08
        annual_maintenance = (
            debt_score / 100 *
            team_size *
            avg_salary *
            industry_multiplier *
            0.08  # 8% of annual team cost for maintenance
        )
        
        # Calculate integration cost
        # Formula: complexity_score * team_size * avg_salary * 0.25
        integration_cost = (
            complexity_score / 100 *
            team_size *
            avg_salary *
            0.25  # 25% of annual team cost for integration
        )
        
        # Calculate security remediation cost
        # Formula: (100 - security_score) * team_size * avg_salary * 0.1
        security_cost = (
            (100 - security_score) / 100 *
            team_size *
            avg_salary *
            0.1  # 10% of annual team cost for security
        )
        
        # Calculate 3-year total impact
        total_3_year_impact = (
            remediation_cost +
            (annual_maintenance * 3) +
            integration_cost +
            security_cost
        )
        
        # Calculate risk-adjusted impact
        risk_adjustment = 1.0 + (debt_score - 50) / 100  # Risk factor based on debt
        risk_adjusted_impact = total_3_year_impact * risk_adjustment
        
        return {
            'remediation_cost': round(remediation_cost, 2),
            'annual_maintenance': round(annual_maintenance, 2),
            'integration_cost': round(integration_cost, 2),
            'security_cost': round(security_cost, 2),
            'total_3_year_impact': round(total_3_year_impact, 2),
            'risk_adjusted_impact': round(risk_adjusted_impact, 2),
            'severity': severity,
            'industry_multiplier': industry_multiplier,
            'severity_multiplier': severity_multiplier,
            'risk_adjustment': round(risk_adjustment, 2),
            'calculation_date': datetime.now().isoformat()
        }

    def generate_financial_summary(self, cost_data: Dict, company_name: str) -> Dict:
        """Generate executive summary of financial impact"""
        
        total_impact = cost_data['total_3_year_impact']
        risk_adjusted = cost_data['risk_adjusted_impact']
        
        # Generate recommendations based on impact
        if total_impact < 100000:
            recommendation = "Low financial impact. Proceed with standard due diligence."
            risk_level = "Low"
        elif total_impact < 500000:
            recommendation = "Moderate financial impact. Consider technical debt in negotiations."
            risk_level = "Medium"
        elif total_impact < 1000000:
            recommendation = "High financial impact. Technical debt should significantly affect valuation."
            risk_level = "High"
        else:
            recommendation = "Critical financial impact. Major restructuring costs expected."
            risk_level = "Critical"
        
        return {
            'company_name': company_name,
            'total_3_year_impact': total_impact,
            'risk_adjusted_impact': risk_adjusted,
            'risk_level': risk_level,
            'recommendation': recommendation,
            'key_cost_drivers': [
                {
                    'category': 'Remediation',
                    'cost': cost_data['remediation_cost'],
                    'percentage': round(cost_data['remediation_cost'] / total_impact * 100, 1)
                },
                {
                    'category': 'Annual Maintenance (3 years)',
                    'cost': cost_data['annual_maintenance'] * 3,
                    'percentage': round((cost_data['annual_maintenance'] * 3) / total_impact * 100, 1)
                },
                {
                    'category': 'Integration',
                    'cost': cost_data['integration_cost'],
                    'percentage': round(cost_data['integration_cost'] / total_impact * 100, 1)
                },
                {
                    'category': 'Security',
                    'cost': cost_data['security_cost'],
                    'percentage': round(cost_data['security_cost'] / total_impact * 100, 1)
                }
            ],
            'negotiation_leverage': self._calculate_negotiation_leverage(cost_data),
            'timeline_impact': self._estimate_timeline_impact(cost_data)
        }

    def _calculate_negotiation_leverage(self, cost_data: Dict) -> Dict:
        """Calculate negotiation leverage based on technical debt"""
        total_impact = cost_data['total_3_year_impact']
        
        if total_impact < 100000:
            leverage_points = "Minimal leverage"
            suggested_discount = "0-2%"
        elif total_impact < 500000:
            leverage_points = "Moderate leverage"
            suggested_discount = "2-5%"
        elif total_impact < 1000000:
            leverage_points = "Strong leverage"
            suggested_discount = "5-10%"
        else:
            leverage_points = "Significant leverage"
            suggested_discount = "10-20%"
        
        return {
            'leverage_points': leverage_points,
            'suggested_discount': suggested_discount,
            'total_leverage_value': total_impact
        }

    def _estimate_timeline_impact(self, cost_data: Dict) -> Dict:
        """Estimate timeline impact based on remediation and integration costs"""
        remediation_cost = cost_data['remediation_cost']
        integration_cost = cost_data['integration_cost']
        
        # Estimate months based on cost (assuming $10k per month per developer)
        remediation_months = max(1, round(remediation_cost / 100000))
        integration_months = max(2, round(integration_cost / 100000))
        
        total_months = remediation_months + integration_months
        
        return {
            'remediation_timeline_months': remediation_months,
            'integration_timeline_months': integration_months,
            'total_timeline_months': total_months,
            'time_to_value': f"{total_months} months",
            'delay_risk': "High" if total_months > 12 else "Medium" if total_months > 6 else "Low"
        }

# API endpoint functions
def calculate_financial_impact(request_data: Dict) -> Dict:
    """API endpoint for financial impact calculation"""
    try:
        calculator = FinancialImpactCalculator()
        
        # Extract parameters
        metrics = request_data.get('metrics', {})
        team_size = request_data.get('team_size', 10)
        avg_salary = request_data.get('avg_salary', 120000)
        industry = request_data.get('industry', 'tech')
        company_name = request_data.get('company_name', 'Target Company')
        
        # Calculate costs
        cost_data = calculator.calculate_technical_debt_cost(
            metrics, team_size, avg_salary, industry
        )
        
        # Generate summary
        summary = calculator.generate_financial_summary(cost_data, company_name)
        
        return {
            'success': True,
            'data': {
                'cost_breakdown': cost_data,
                'executive_summary': summary
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

# Example usage and test data
if __name__ == "__main__":
    # Test with sample data
    sample_metrics = {
        'debt_score': 65,
        'complexity_score': 72,
        'security_score': 78,
        'test_coverage': 45,
        'documentation_score': 38
    }
    
    result = calculate_financial_impact({
        'metrics': sample_metrics,
        'team_size': 15,
        'avg_salary': 135000,
        'industry': 'fintech',
        'company_name': 'AcquireTech Inc.'
    })
    
    print(json.dumps(result, indent=2))
