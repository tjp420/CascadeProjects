"""
M&A Risk Assessment Algorithm
Comprehensive risk scoring for M&A due diligence decisions
"""

import json
from typing import Dict, List, Tuple
from datetime import datetime
from enum import Enum

class RiskLevel(Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class MARiskAssessor:
    def __init__(self):
        # M&A-specific risk weights (different from general code quality)
        self.RISK_WEIGHTS = {
            'integration_complexity': 0.30,      # How hard to integrate systems
            'talent_retention': 0.25,            # Risk of losing key developers
            'scalability_risk': 0.20,           # Can the system scale with growth
            'time_to_value': 0.15,               # How long to realize value
            'compliance_risk': 0.10              # Regulatory and compliance issues
        }
        
        # Industry-specific risk multipliers
        self.INDUSTRY_RISK_MULTIPLIERS = {
            'fintech': 1.4,      # Higher regulatory risk
            'healthcare': 1.5,    # Compliance and data privacy risks
            'ecommerce': 1.1,    # Standard risk profile
            'tech': 1.0,         # Baseline
            'manufacturing': 0.9, # Lower tech risk
            'retail': 1.0,       # Standard
            'education': 0.8,     # Lower risk profile
            'government': 1.3,   # Higher compliance requirements
        }
        
        # Deal timeline risk factors
        self.TIMELINE_RISK_FACTORS = {
            'aggressive': 1.3,   # < 3 months - higher risk
            'standard': 1.0,     # 3-6 months - normal risk
            'extended': 0.8      # > 6 months - lower risk but higher cost
        }

    def calculate_maq_risk(self, codebase_metrics: Dict, deal_context: Dict) -> Dict:
        """
        Calculate M&A-specific risk scores
        
        Args:
            codebase_metrics: Code quality and technical metrics
            deal_context: Deal-specific information (timeline, industry, etc.)
        
        Returns:
            Comprehensive risk assessment with scores and recommendations
        """
        industry = deal_context.get('industry', 'tech')
        timeline_months = deal_context.get('timeline_months', 6)
        team_size = deal_context.get('team_size', 10)
        
        # Calculate individual risk factors
        integration_risk = self._assess_integration_complexity(codebase_metrics, deal_context)
        talent_risk = self._assess_talent_retention_risk(codebase_metrics, deal_context)
        scalability_risk = self._assess_scalability_risk(codebase_metrics, deal_context)
        time_to_value_risk = self._assess_time_to_value(codebase_metrics, deal_context)
        compliance_risk = self._assess_compliance_risk(codebase_metrics, deal_context)
        
        # Apply industry multipliers
        industry_multiplier = self.INDUSTRY_RISK_MULTIPLIERS.get(industry, 1.0)
        
        # Apply timeline risk factor
        timeline_category = self._categorize_timeline(timeline_months)
        timeline_multiplier = self.TIMELINE_RISK_FACTORS.get(timeline_category, 1.0)
        
        # Calculate weighted risk score
        risk_scores = {
            'integration_complexity': integration_risk['score'] * self.RISK_WEIGHTS['integration_complexity'],
            'talent_retention': talent_risk['score'] * self.RISK_WEIGHTS['talent_retention'],
            'scalability_risk': scalability_risk['score'] * self.RISK_WEIGHTS['scalability_risk'],
            'time_to_value': time_to_value_risk['score'] * self.RISK_WEIGHTS['time_to_value'],
            'compliance_risk': compliance_risk['score'] * self.RISK_WEIGHTS['compliance_risk']
        }
        
        # Calculate overall risk score (0-100)
        overall_score = sum(risk_scores.values()) * 100 * industry_multiplier * timeline_multiplier
        
        # Determine risk level
        risk_level = self._determine_risk_level(overall_score)
        
        # Generate deal recommendation
        recommendation = self._generate_deal_recommendation(overall_score, risk_scores, deal_context)
        
        return {
            'overall_maq_risk': round(overall_score, 1),
            'risk_level': risk_level.value,
            'industry_multiplier': industry_multiplier,
            'timeline_multiplier': timeline_multiplier,
            'risk_factors': {
                'integration_complexity': integration_risk,
                'talent_retention': talent_risk,
                'scalability_risk': scalability_risk,
                'time_to_value': time_to_value_risk,
                'compliance_risk': compliance_risk
            },
            'risk_scores': {k: round(v * 100, 1) for k, v in risk_scores.items()},
            'recommendation': recommendation,
            'key_risks': self._identify_key_risks(risk_scores),
            'mitigation_strategies': self._generate_mitigation_strategies(risk_scores),
            'assessment_date': datetime.now().isoformat()
        }

    def _assess_integration_complexity(self, metrics: Dict, deal_context: Dict) -> Dict:
        """Assess how difficult it will be to integrate the target's systems"""
        
        # Factors affecting integration complexity
        tech_stack_diversity = self._calculate_tech_stack_diversity(metrics)
        api_surface_area = metrics.get('api_count', 50)  # Number of APIs to integrate
        data_migration_complexity = self._assess_data_migration_complexity(metrics)
        architectural_coupling = metrics.get('coupling_score', 50)  # How coupled is the system
        
        # Calculate integration complexity score
        complexity_score = (
            tech_stack_diversity * 0.3 +
            (min(api_surface_area / 100, 1) * 100) * 0.25 +
            data_migration_complexity * 0.25 +
            architectural_coupling * 0.2
        )
        
        # Estimate integration timeline
        integration_months = max(1, round(complexity_score / 10))  # 1 month per 10 points
        
        return {
            'score': min(complexity_score / 100, 1),  # Normalize to 0-1
            'level': self._determine_risk_level(complexity_score).value,
            'factors': {
                'tech_stack_diversity': tech_stack_diversity,
                'api_surface_area': api_surface_area,
                'data_migration_complexity': data_migration_complexity,
                'architectural_coupling': architectural_coupling
            },
            'estimated_timeline_months': integration_months,
            'description': f"Integration complexity estimated at {complexity_score:.1f}/100"
        }

    def _assess_talent_retention_risk(self, metrics: Dict, deal_context: Dict) -> Dict:
        """Assess risk of losing key developers during/after acquisition"""
        
        # Factors affecting talent retention
        code_complexity = metrics.get('complexity_score', 50)
        documentation_quality = metrics.get('documentation_score', 50)
        technical_debt = metrics.get('debt_score', 50)
        team_size = deal_context.get('team_size', 10)
        
        # Calculate talent retention risk (higher complexity + poor docs + high debt = higher risk)
        retention_risk_score = (
            (code_complexity * 0.3) +
            ((100 - documentation_quality) * 0.3) +
            (technical_debt * 0.25) +
            (max(0, (50 - team_size)) * 0.15)  # Smaller teams have higher risk
        )
        
        # Estimate retention percentage
        retention_percentage = max(60, 100 - retention_risk_score * 0.4)
        
        return {
            'score': min(retention_risk_score / 100, 1),
            'level': self._determine_risk_level(retention_risk_score).value,
            'estimated_retention_percentage': round(retention_percentage, 1),
            'factors': {
                'code_complexity': code_complexity,
                'documentation_quality': documentation_quality,
                'technical_debt': technical_debt,
                'team_size': team_size
            },
            'description': f"Talent retention risk estimated at {retention_risk_score:.1f}/100"
        }

    def _assess_scalability_risk(self, metrics: Dict, deal_context: Dict) -> Dict:
        """Assess whether the target's systems can scale with acquirer's growth"""
        
        # Factors affecting scalability
        architecture_score = metrics.get('architecture_score', 50)
        performance_score = metrics.get('performance_score', 50)
        database_design = metrics.get('database_score', 50)
        code_modularity = metrics.get('modularity_score', 50)
        
        # Calculate scalability risk
        scalability_score = (
            (100 - architecture_score) * 0.3 +
            (100 - performance_score) * 0.3 +
            (100 - database_design) * 0.25 +
            (100 - code_modularity) * 0.15
        )
        
        # Estimate scaling capacity
        scaling_factor = max(0.1, (100 - scalability_score) / 100)
        
        return {
            'score': min(scalability_score / 100, 1),
            'level': self._determine_risk_level(scalability_score).value,
            'scaling_factor': round(scaling_factor, 2),
            'factors': {
                'architecture_score': architecture_score,
                'performance_score': performance_score,
                'database_design': database_design,
                'code_modularity': code_modularity
            },
            'description': f"Scalability risk estimated at {scalability_score:.1f}/100"
        }

    def _assess_time_to_value(self, metrics: Dict, deal_context: Dict) -> Dict:
        """Assess how long it will take to realize value from the acquisition"""
        
        # Factors affecting time to value
        integration_complexity = metrics.get('debt_score', 50)  # Higher debt = longer time
        team_productivity = metrics.get('productivity_score', 50)
        learning_curve = metrics.get('complexity_score', 50)
        
        # Calculate time to value risk
        time_value_score = (
            integration_complexity * 0.4 +
            (100 - team_productivity) * 0.3 +
            learning_curve * 0.3
        )
        
        # Estimate months to break-even
        months_to_value = max(3, round(time_value_score / 10))
        
        return {
            'score': min(time_value_score / 100, 1),
            'level': self._determine_risk_level(time_value_score).value,
            'estimated_months_to_value': months_to_value,
            'factors': {
                'integration_complexity': integration_complexity,
                'team_productivity': team_productivity,
                'learning_curve': learning_curve
            },
            'description': f"Time to value risk estimated at {time_value_score:.1f}/100"
        }

    def _assess_compliance_risk(self, metrics: Dict, deal_context: Dict) -> Dict:
        """Assess regulatory and compliance risks"""
        
        # Factors affecting compliance
        security_score = metrics.get('security_score', 50)
        data_privacy = metrics.get('privacy_score', 50)
        audit_trail = metrics.get('audit_score', 50)
        industry = deal_context.get('industry', 'tech')
        
        # Industry-specific compliance requirements
        industry_compliance_weight = {
            'fintech': 0.9,      # High compliance requirements
            'healthcare': 0.95,   # Very high compliance requirements
            'ecommerce': 0.7,    # Moderate compliance requirements
            'tech': 0.5,         # Standard compliance
            'government': 1.0,   # Highest compliance requirements
        }.get(industry, 0.5)
        
        # Calculate compliance risk
        compliance_score = (
            (100 - security_score) * 0.3 +
            (100 - data_privacy) * 0.3 +
            (100 - audit_trail) * 0.2 +
            industry_compliance_weight * 100 * 0.2
        )
        
        return {
            'score': min(compliance_score / 100, 1),
            'level': self._determine_risk_level(compliance_score).value,
            'industry_compliance_weight': industry_compliance_weight,
            'factors': {
                'security_score': security_score,
                'data_privacy': data_privacy,
                'audit_trail': audit_trail
            },
            'description': f"Compliance risk estimated at {compliance_score:.1f}/100"
        }

    def _determine_risk_level(self, score: float) -> RiskLevel:
        """Determine risk level based on score (0-100)"""
        if score < 25:
            return RiskLevel.LOW
        elif score < 50:
            return RiskLevel.MEDIUM
        elif score < 75:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL

    def _categorize_timeline(self, months: int) -> str:
        """Categorize deal timeline for risk assessment"""
        if months < 3:
            return 'aggressive'
        elif months <= 6:
            return 'standard'
        else:
            return 'extended'

    def _generate_deal_recommendation(self, overall_score: float, risk_scores: Dict, deal_context: Dict) -> Dict:
        """Generate deal recommendation based on risk assessment"""
        
        if overall_score < 30:
            recommendation = "PROCEED"
            confidence = "High"
            rationale = "Low overall risk with manageable integration challenges."
        elif overall_score < 50:
            recommendation = "PROCEED WITH CONDITIONS"
            confidence = "Medium"
            rationale = "Moderate risk requires specific mitigation strategies and earnouts."
        elif overall_score < 70:
            recommendation = "RECONSIDER"
            confidence = "Low"
            rationale = "High risk requires significant price adjustment or extensive due diligence."
        else:
            recommendation = "DO NOT PROCEED"
            confidence = "Very Low"
            rationale = "Critical risk levels pose unacceptable integration and operational challenges."
        
        # Identify highest risk factors
        highest_risk = max(risk_scores.items(), key=lambda x: x[1])
        
        return {
            'recommendation': recommendation,
            'confidence': confidence,
            'overall_score': round(overall_score, 1),
            'rationale': rationale,
            'highest_risk_factor': highest_risk[0],
            'highest_risk_score': round(highest_risk[1] * 100, 1),
            'price_adjustment_suggestion': self._suggest_price_adjustment(overall_score),
            'key_mitigation_requirements': self._identify_mitigation_requirements(risk_scores)
        }

    def _identify_key_risks(self, risk_scores: Dict) -> List[Dict]:
        """Identify the top 3 key risks"""
        sorted_risks = sorted(risk_scores.items(), key=lambda x: x[1], reverse=True)
        
        key_risks = []
        for risk_name, score in sorted_risks[:3]:
            key_risks.append({
                'factor': risk_name,
                'score': round(score * 100, 1),
                'impact': self._get_risk_impact_description(score),
                'priority': 'High' if score > 0.7 else 'Medium' if score > 0.4 else 'Low'
            })
        
        return key_risks

    def _generate_mitigation_strategies(self, risk_scores: Dict) -> List[Dict]:
        """Generate mitigation strategies for high-risk factors"""
        strategies = []
        
        for risk_name, score in risk_scores.items():
            if score > 0.6:  # Only for medium-high and high risks
                strategy = self._get_mitigation_strategy(risk_name, score)
                if strategy:
                    strategies.append(strategy)
        
        return strategies

    def _suggest_price_adjustment(self, overall_score: float) -> Dict:
        """Suggest price adjustment based on risk score"""
        if overall_score < 30:
            adjustment = 0
            reasoning = "Low risk - no price adjustment needed"
        elif overall_score < 50:
            adjustment = 10  # 10% discount
            reasoning = "Moderate risk - 10% price adjustment recommended"
        elif overall_score < 70:
            adjustment = 25  # 25% discount
            reasoning = "High risk - 25% price adjustment recommended"
        else:
            adjustment = 40  # 40% discount or walk away
            reasoning = "Critical risk - 40%+ price adjustment or reconsider deal"
        
        return {
            'suggested_adjustment_percent': adjustment,
            'reasoning': reasoning
        }

    # Helper methods for calculations
    def _calculate_tech_stack_diversity(self, metrics: Dict) -> float:
        """Calculate how diverse the technology stack is"""
        # Simplified calculation based on number of different technologies
        return min(100, metrics.get('tech_diversity_score', 50))

    def _assess_data_migration_complexity(self, metrics: Dict) -> float:
        """Assess how complex data migration will be"""
        data_volume = metrics.get('data_volume_score', 50)
        data_complexity = metrics.get('data_complexity_score', 50)
        return (data_volume + data_complexity) / 2

    def _get_risk_impact_description(self, score: float) -> str:
        """Get description of risk impact based on score"""
        if score > 0.8:
            return "Critical - Could jeopardize entire deal"
        elif score > 0.6:
            return "High - Significant mitigation required"
        elif score > 0.4:
            return "Medium - Manageable with planning"
        else:
            return "Low - Minor impact expected"

    def _get_mitigation_strategy(self, risk_name: str, score: float) -> Dict:
        """Get mitigation strategy for specific risk factor"""
        strategies = {
            'integration_complexity': {
                'strategy': 'Phased Integration Approach',
                'actions': ['Create detailed integration roadmap', 'Allocate dedicated integration team', 'Implement API-first integration'],
                'timeline': '6-12 months',
                'cost_impact': 'Medium'
            },
            'talent_retention': {
                'strategy': 'Talent Retention Program',
                'actions': ['Offer retention bonuses', 'Provide career development paths', 'Maintain engineering culture'],
                'timeline': 'Immediate',
                'cost_impact': 'High'
            },
            'scalability_risk': {
                'strategy': 'Scalability Assessment',
                'actions': ['Conduct load testing', 'Plan architecture upgrades', 'Implement monitoring'],
                'timeline': '3-6 months',
                'cost_impact': 'Medium'
            },
            'time_to_value': {
                'strategy': 'Value Realization Plan',
                'actions': ['Set clear milestones', 'Implement quick wins', 'Establish KPIs'],
                'timeline': 'Ongoing',
                'cost_impact': 'Low'
            },
            'compliance_risk': {
                'strategy': 'Compliance Framework',
                'actions': ['Hire compliance specialists', 'Implement audit controls', 'Create compliance documentation'],
                'timeline': '3-6 months',
                'cost_impact': 'Medium'
            }
        }
        
        return strategies.get(risk_name, {
            'strategy': 'General Risk Mitigation',
            'actions': ['Conduct detailed analysis', 'Create mitigation plan', 'Monitor progress'],
            'timeline': '3-6 months',
            'cost_impact': 'Medium'
        })

    def _identify_mitigation_requirements(self, risk_scores: Dict) -> List[str]:
        """Identify specific mitigation requirements"""
        requirements = []
        
        for risk_name, score in risk_scores.items():
            if score > 0.7:
                if risk_name == 'integration_complexity':
                    requirements.append('Dedicated integration team with $500k+ budget')
                elif risk_name == 'talent_retention':
                    requirements.append('Retention bonus pool of 20% of annual salaries')
                elif risk_name == 'scalability_risk':
                    requirements.append('Architecture redesign budget of $250k+')
                elif risk_name == 'compliance_risk':
                    requirements.append('Compliance team and legal budget of $200k+')
        
        return requirements

# API endpoint functions
def calculate_maq_risk(request_data: Dict) -> Dict:
    """API endpoint for M&A risk assessment"""
    try:
        assessor = MARiskAssessor()
        
        # Extract parameters
        codebase_metrics = request_data.get('codebase_metrics', {})
        deal_context = request_data.get('deal_context', {})
        
        # Calculate risk assessment
        risk_assessment = assessor.calculate_maq_risk(codebase_metrics, deal_context)
        
        return {
            'success': True,
            'data': risk_assessment
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
        'architecture_score': 60,
        'performance_score': 55,
        'documentation_score': 38,
        'modularity_score': 45,
        'productivity_score': 50,
        'api_count': 75,
        'coupling_score': 68,
        'tech_diversity_score': 70,
        'database_score': 62,
        'privacy_score': 70,
        'audit_score': 55
    }
    
    sample_deal_context = {
        'company_name': 'AcquireTech Inc.',
        'industry': 'fintech',
        'timeline_months': 6,
        'team_size': 15,
        'deal_value': 50000000
    }
    
    result = calculate_maq_risk({
        'codebase_metrics': sample_metrics,
        'deal_context': sample_deal_context
    })
    
    print(json.dumps(result, indent=2))
