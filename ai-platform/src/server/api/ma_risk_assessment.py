#!/usr/bin/env python3

"""
M&A Risk Assessment Module

Provides comprehensive risk scoring and assessment for M&A due diligence
including technical, security, scalability, and business risks.

"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class RiskLevel(Enum):
    """Risk level enumeration"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class RiskCategory(Enum):
    """Risk category enumeration"""
    TECHNICAL = "Technical"
    SECURITY = "Security"
    SCALABILITY = "Scalability"
    COMPLIANCE = "Compliance"
    INTEGRATION = "Integration"
    TALENT = "Talent"

@dataclass
class RiskFactor:
    """Individual risk factor"""
    category: RiskCategory
    description: str
    severity: RiskLevel
    impact_score: float
    likelihood_score: float
    mitigation_cost: float
    timeline_to_resolve: str

@dataclass
class RiskAssessmentResult:
    """Complete risk assessment result"""
    overall_risk_score: float
    overall_risk_level: RiskLevel
    risk_factors: List[RiskFactor]
    category_scores: Dict[str, float]
    deal_recommendation: str
    critical_risks: List[RiskFactor]
    mitigation_plan: Dict[str, List[str]]

class MARiskAssessment:
    """M&A Risk Assessment Engine"""
    
    def __init__(self):
        """Initialize risk assessment engine"""
        # Risk weightings for M&A decisions
        self.risk_weights = {
            RiskCategory.TECHNICAL: 0.25,
            RiskCategory.SECURITY: 0.30,
            RiskCategory.SCALABILITY: 0.20,
            RiskCategory.COMPLIANCE: 0.15,
            RiskCategory.INTEGRATION: 0.05,
            RiskCategory.TALENT: 0.05
        }
        
        # Risk severity multipliers
        self.severity_multipliers = {
            RiskLevel.LOW: 1.0,
            RiskLevel.MEDIUM: 2.0,
            RiskLevel.HIGH: 3.5,
            RiskLevel.CRITICAL: 5.0
        }

    def assess_risks(self, code_analysis: Dict[str, Any], security_scan: Dict[str, Any], 
                    team_analysis: Dict[str, Any]) -> RiskAssessmentResult:
        """
        Perform comprehensive M&A risk assessment
        
        Args:
            code_analysis: Code quality and technical analysis results
            security_scan: Security vulnerability scan results
            team_analysis: Team structure and talent analysis
            
        Returns:
            RiskAssessmentResult: Complete risk assessment
        """
        try:
            # Analyze risks in each category
            technical_risks = self._assess_technical_risks(code_analysis)
            security_risks = self._assess_security_risks(security_scan)
            scalability_risks = self._assess_scalability_risks(code_analysis)
            compliance_risks = self._assess_compliance_risks(code_analysis, security_scan)
            integration_risks = self._assess_integration_risks(code_analysis, team_analysis)
            talent_risks = self._assess_talent_risks(team_analysis)
            
            # Combine all risk factors
            all_risks = (technical_risks + security_risks + scalability_risks + 
                        compliance_risks + integration_risks + talent_risks)
            
            # Calculate category scores
            category_scores = self._calculate_category_scores(all_risks)
            
            # Calculate overall risk score
            overall_risk_score = self._calculate_overall_risk_score(category_scores)
            overall_risk_level = self._determine_risk_level(overall_risk_score)
            
            # Generate deal recommendation
            deal_recommendation = self._generate_deal_recommendation(overall_risk_level, all_risks)
            
            # Identify critical risks
            critical_risks = [risk for risk in all_risks if risk.severity == RiskLevel.CRITICAL]
            
            # Generate mitigation plan
            mitigation_plan = self._generate_mitigation_plan(all_risks)
            
            return RiskAssessmentResult(
                overall_risk_score=overall_risk_score,
                overall_risk_level=overall_risk_level,
                risk_factors=all_risks,
                category_scores=category_scores,
                deal_recommendation=deal_recommendation,
                critical_risks=critical_risks,
                mitigation_plan=mitigation_plan
            )
            
        except Exception as e:
            logger.error(f"Error in risk assessment: {e}")
            raise

    def _assess_technical_risks(self, code_analysis: Dict[str, Any]) -> List[RiskFactor]:
        """Assess technical risks"""
        risks = []
        
        # Code quality risks
        code_quality = code_analysis.get('codeQuality', 0)
        if code_quality < 60:
            risks.append(RiskFactor(
                category=RiskCategory.TECHNICAL,
                description="Poor code quality indicating maintenance challenges",
                severity=RiskLevel.HIGH if code_quality < 50 else RiskLevel.MEDIUM,
                impact_score=8.0,
                likelihood_score=9.0,
                mitigation_cost=150000,
                timeline_to_resolve="6-12 months"
            ))
        
        # Technical debt risks
        tech_debt = code_analysis.get('technicalDebt', 'Low')
        if tech_debt in ['High', 'Very High']:
            risks.append(RiskFactor(
                category=RiskCategory.TECHNICAL,
                description=f"High technical debt ({tech_debt}) requiring significant remediation",
                severity=RiskLevel.HIGH,
                impact_score=7.0,
                likelihood_score=8.0,
                mitigation_cost=200000,
                timeline_to_resolve="12-18 months"
            ))
        
        # Complexity risks
        complexity = code_analysis.get('projectComplexity', 'Low')
        if complexity in ['High', 'Very High']:
            risks.append(RiskFactor(
                category=RiskCategory.TECHNICAL,
                description=f"High project complexity ({complexity}) complicating integration",
                severity=RiskLevel.MEDIUM,
                impact_score=6.0,
                likelihood_score=7.0,
                mitigation_cost=100000,
                timeline_to_resolve="9-15 months"
            ))
        
        # Architecture risks
        maintainability = code_analysis.get('maintainability', 'Good')
        if maintainability in ['Fair', 'Poor']:
            risks.append(RiskFactor(
                category=RiskCategory.TECHNICAL,
                description=f"Poor maintainability ({maintainability}) affecting future development",
                severity=RiskLevel.MEDIUM,
                impact_score=5.0,
                likelihood_score=8.0,
                mitigation_cost=80000,
                timeline_to_resolve="6-9 months"
            ))
        
        return risks

    def _assess_security_risks(self, security_scan: Dict[str, Any]) -> List[RiskFactor]:
        """Assess security risks"""
        risks = []
        
        # Vulnerability risks
        critical_vulns = security_scan.get('critical_vulnerabilities', 0)
        if critical_vulns > 0:
            risks.append(RiskFactor(
                category=RiskCategory.SECURITY,
                description=f"{critical_vulns} critical security vulnerabilities found",
                severity=RiskLevel.CRITICAL,
                impact_score=10.0,
                likelihood_score=9.0,
                mitigation_cost=50000 * critical_vulns,
                timeline_to_resolve="Immediate - 3 months"
            ))
        
        high_vulns = security_scan.get('high_vulnerabilities', 0)
        if high_vulns > 5:
            risks.append(RiskFactor(
                category=RiskCategory.SECURITY,
                description=f"{high_vulns} high-severity security vulnerabilities",
                severity=RiskLevel.HIGH,
                impact_score=8.0,
                likelihood_score=7.0,
                mitigation_cost=15000 * high_vulns,
                timeline_to_resolve="3-6 months"
            ))
        
        # Compliance risks
        compliance_score = security_scan.get('compliance_score', 85)
        if compliance_score < 70:
            risks.append(RiskFactor(
                category=RiskCategory.SECURITY,
                description=f"Poor security compliance score ({compliance_score}%)",
                severity=RiskLevel.HIGH,
                impact_score=7.0,
                likelihood_score=8.0,
                mitigation_cost=100000,
                timeline_to_resolve="6-12 months"
            ))
        
        return risks

    def _assess_scalability_risks(self, code_analysis: Dict[str, Any]) -> List[RiskFactor]:
        """Assess scalability risks"""
        risks = []
        
        # Performance risks
        performance_score = code_analysis.get('performance_score', 75)
        if performance_score < 60:
            risks.append(RiskFactor(
                category=RiskCategory.SCALABILITY,
                description=f"Poor performance metrics ({performance_score}%) limiting growth",
                severity=RiskLevel.MEDIUM,
                impact_score=6.0,
                likelihood_score=7.0,
                mitigation_cost=120000,
                timeline_to_resolve="6-9 months"
            ))
        
        # Architecture scalability
        architecture = code_analysis.get('architecture', 'Custom')
        if architecture == 'Custom':
            risks.append(RiskFactor(
                category=RiskCategory.SCALABILITY,
                description="Custom architecture may limit scalability",
                severity=RiskLevel.MEDIUM,
                impact_score=5.0,
                likelihood_score=6.0,
                mitigation_cost=80000,
                timeline_to_resolve="9-12 months"
            ))
        
        return risks

    def _assess_compliance_risks(self, code_analysis: Dict[str, Any], 
                               security_scan: Dict[str, Any]) -> List[RiskFactor]:
        """Assess compliance risks"""
        risks = []
        
        # Documentation compliance
        documentation = code_analysis.get('documentation', 'Moderate')
        if documentation in ['Poor', 'Minimal']:
            risks.append(RiskFactor(
                category=RiskCategory.COMPLIANCE,
                description=f"Poor documentation ({documentation}) complicating compliance",
                severity=RiskLevel.MEDIUM,
                impact_score=4.0,
                likelihood_score=8.0,
                mitigation_cost=60000,
                timeline_to_resolve="3-6 months"
            ))
        
        # Data handling compliance
        data_compliance = security_scan.get('data_compliance_score', 80)
        if data_compliance < 70:
            risks.append(RiskFactor(
                category=RiskCategory.COMPLIANCE,
                description=f"Data handling compliance issues ({data_compliance}%)",
                severity=RiskLevel.HIGH,
                impact_score=7.0,
                likelihood_score=6.0,
                mitigation_cost=90000,
                timeline_to_resolve="6-9 months"
            ))
        
        return risks

    def _assess_integration_risks(self, code_analysis: Dict[str, Any], 
                                team_analysis: Dict[str, Any]) -> List[RiskFactor]:
        """Assess integration risks"""
        risks = []
        
        # Technology stack compatibility
        tech_stack = code_analysis.get('languages', [])
        if len(tech_stack) > 5:
            risks.append(RiskFactor(
                category=RiskCategory.INTEGRATION,
                description=f"Complex technology stack ({len(tech_stack)} languages) complicating integration",
                severity=RiskLevel.MEDIUM,
                impact_score=5.0,
                likelihood_score=7.0,
                mitigation_cost=100000,
                timeline_to_resolve="12-18 months"
            ))
        
        # Team size considerations
        team_size = team_analysis.get('team_size', 0)
        if team_size < 5:
            risks.append(RiskFactor(
                category=RiskCategory.INTEGRATION,
                description=f"Small team ({team_size} members) may struggle with integration",
                severity=RiskLevel.LOW,
                impact_score=3.0,
                likelihood_score=6.0,
                mitigation_cost=50000,
                timeline_to_resolve="6-12 months"
            ))
        
        return risks

    def _assess_talent_risks(self, team_analysis: Dict[str, Any]) -> List[RiskFactor]:
        """Assess talent-related risks"""
        risks = []
        
        # Key person dependency
        key_person_risk = team_analysis.get('key_person_dependency', False)
        if key_person_risk:
            risks.append(RiskFactor(
                category=RiskCategory.TALENT,
                description="High dependency on key personnel creates retention risk",
                severity=RiskLevel.HIGH,
                impact_score=6.0,
                likelihood_score=7.0,
                mitigation_cost=150000,
                timeline_to_resolve="Immediate - 12 months"
            ))
        
        # Skill gaps
        skill_gaps = team_analysis.get('skill_gaps', [])
        if len(skill_gaps) > 3:
            risks.append(RiskFactor(
                category=RiskCategory.TALENT,
                description=f"Multiple skill gaps identified: {', '.join(skill_gaps)}",
                severity=RiskLevel.MEDIUM,
                impact_score=5.0,
                likelihood_score=6.0,
                mitigation_cost=80000,
                timeline_to_resolve="6-12 months"
            ))
        
        return risks

    def _calculate_category_scores(self, risks: List[RiskFactor]) -> Dict[str, float]:
        """Calculate risk scores by category"""
        category_scores = {}
        
        for category in RiskCategory:
            category_risks = [r for r in risks if r.category == category]
            if category_risks:
                # Weighted average of risk scores
                total_weight = 0
                weighted_score = 0
                for risk in category_risks:
                    weight = self.severity_multipliers[risk.severity]
                    score = (risk.impact_score * risk.likelihood_score) / 10
                    weighted_score += score * weight
                    total_weight += weight
                
                category_scores[category.value] = weighted_score / total_weight if total_weight > 0 else 0
            else:
                category_scores[category.value] = 0
        
        return category_scores

    def _calculate_overall_risk_score(self, category_scores: Dict[str, float]) -> float:
        """Calculate overall risk score"""
        total_weighted_score = 0
        total_weight = 0
        
        for category, score in category_scores.items():
            try:
                category_enum = RiskCategory(category)
                weight = self.risk_weights[category_enum]
                total_weighted_score += score * weight
                total_weight += weight
            except ValueError:
                continue
        
        return total_weighted_score / total_weight if total_weight > 0 else 0

    def _determine_risk_level(self, score: float) -> RiskLevel:
        """Determine risk level from score"""
        if score >= 8.0:
            return RiskLevel.CRITICAL
        elif score >= 6.0:
            return RiskLevel.HIGH
        elif score >= 4.0:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _generate_deal_recommendation(self, risk_level: RiskLevel, risks: List[RiskFactor]) -> str:
        """Generate deal recommendation based on risk assessment"""
        critical_count = len([r for r in risks if r.severity == RiskLevel.CRITICAL])
        high_count = len([r for r in risks if r.severity == RiskLevel.HIGH])
        
        if risk_level == RiskLevel.CRITICAL or critical_count > 2:
            return "DO NOT PROCEED - Critical risks pose significant threat to investment"
        elif risk_level == RiskLevel.HIGH or high_count > 4:
            return "PROCEED WITH EXTREME CAUTION - Significant risks require detailed mitigation plan"
        elif risk_level == RiskLevel.MEDIUM:
            return "PROCEED WITH CONDITIONS - Moderate risks manageable with proper planning"
        else:
            return "PROCEED - Low risk profile suitable for acquisition"

    def _generate_mitigation_plan(self, risks: List[RiskFactor]) -> Dict[str, List[str]]:
        """Generate risk mitigation plan"""
        mitigation_plan = {}
        
        for category in RiskCategory:
            category_risks = [r for r in risks if r.category == category]
            if category_risks:
                strategies = []
                for risk in category_risks:
                    if risk.severity == RiskLevel.CRITICAL:
                        strategies.append(f"URGENT: Address {risk.description.lower()}")
                    else:
                        strategies.append(f"Develop mitigation plan for {risk.description.lower()}")
                
                mitigation_plan[category.value] = strategies
        
        return mitigation_plan

    def generate_risk_report(self, result: RiskAssessmentResult, company_name: str) -> Dict[str, Any]:
        """Generate comprehensive risk report for M&A decision makers"""
        return {
            'company_name': company_name,
            'assessment_date': datetime.now().isoformat(),
            'executive_summary': {
                'overall_risk_score': round(result.overall_risk_score, 2),
                'overall_risk_level': result.overall_risk_level.value,
                'deal_recommendation': result.deal_recommendation,
                'critical_risks_count': len(result.critical_risks),
                'total_risk_factors': len(result.risk_factors)
            },
            'risk_breakdown': {
                'category_scores': result.category_scores,
                'risk_factors_by_category': {
                    category.value: [
                        {
                            'description': risk.description,
                            'severity': risk.severity.value,
                            'impact_score': risk.impact_score,
                            'likelihood_score': risk.likelihood_score,
                            'mitigation_cost': f"${risk.mitigation_cost:,.0f}",
                            'timeline': risk.timeline_to_resolve
                        }
                        for risk in result.risk_factors if risk.category == category
                    ]
                    for category in RiskCategory
                }
            },
            'critical_risks': [
                {
                    'description': risk.description,
                    'severity': risk.severity.value,
                    'mitigation_cost': f"${risk.mitigation_cost:,.0f}",
                    'timeline': risk.timeline_to_resolve
                }
                for risk in result.critical_risks
            ],
            'mitigation_plan': result.mitigation_plan,
            'deal_implications': self._assess_deal_implications(result)
        }

    def _assess_deal_implications(self, result: RiskAssessmentResult) -> Dict[str, Any]:
        """Assess implications for deal structure"""
        implications = {}
        
        if result.overall_risk_level == RiskLevel.CRITICAL:
            implications['recommendation'] = "Walk away or renegotiate entirely"
            implications['price_adjustment'] = "30-50% reduction recommended"
            implications['structure'] = "Contingent on complete risk remediation"
        elif result.overall_risk_level == RiskLevel.HIGH:
            implications['recommendation'] = "Significant price adjustment required"
            implications['price_adjustment'] = "15-30% reduction recommended"
            implications['structure'] = "Earn-out based on risk mitigation"
        elif result.overall_risk_level == RiskLevel.MEDIUM:
            implications['recommendation'] = "Moderate price adjustment"
            implications['price_adjustment'] = "5-15% reduction recommended"
            implications['structure'] = "Standard agreement with risk warranties"
        else:
            implications['recommendation'] = "Proceed with standard terms"
            implications['price_adjustment'] = "Minimal adjustment needed"
            implications['structure'] = "Standard acquisition structure"
        
        total_mitigation_cost = sum(risk.mitigation_cost for risk in result.risk_factors)
        implications['estimated_mitigation_costs'] = f"${total_mitigation_cost:,.0f}"
        
        return implications
