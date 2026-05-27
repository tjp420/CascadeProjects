#!/usr/bin/env python3
"""
Advanced Project Analysis and Planning System
Analyzes codebases and generates optimal development strategies
"""

import os
import json
import ast
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging
import subprocess
import hashlib

@dataclass
class CodeMetrics:
    lines_of_code: int
    complexity_score: float
    test_coverage: float
    maintainability_index: float
    technical_debt: int
    duplicate_code_percentage: float

@dataclass
class ProjectMetrics:
    total_files: int
    total_lines: int
    languages_used: Dict[str, int]
    frameworks_detected: List[str]
    dependencies_count: int
    security_issues: int
    performance_issues: int
    code_metrics: CodeMetrics

@dataclass
class DevelopmentPlan:
    phases: List[Dict[str, Any]]
    estimated_timeline: int
    resource_requirements: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    optimization_opportunities: List[str]

class ProjectAnalyzer:
    """Advanced project analysis and strategic planning system"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.logger = logging.getLogger("ProjectAnalyzer")
        self.analysis_cache = {}
        
    def analyze_project(self) -> ProjectMetrics:
        """Comprehensive project analysis"""
        self.logger.info("Starting comprehensive project analysis...")
        
        # Basic metrics
        total_files, total_lines = self._count_files_and_lines()
        languages_used = self._detect_languages()
        frameworks_detected = self._detect_frameworks()
        dependencies_count = self._count_dependencies()
        
        # Code quality metrics
        code_metrics = self._analyze_code_quality()
        
        # Security and performance
        security_issues = self._analyze_security()
        performance_issues = self._analyze_performance()
        
        metrics = ProjectMetrics(
            total_files=total_files,
            total_lines=total_lines,
            languages_used=languages_used,
            frameworks_detected=frameworks_detected,
            dependencies_count=dependencies_count,
            security_issues=security_issues,
            performance_issues=performance_issues,
            code_metrics=code_metrics
        )
        
        self.logger.info(f"Analysis complete: {total_files} files, {total_lines} lines")
        return metrics
    
    def _count_files_and_lines(self) -> Tuple[int, int]:
        """Count total files and lines of code"""
        total_files = 0
        total_lines = 0
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and self._is_source_file(file_path):
                total_files += 1
                try:
                    total_lines += len(file_path.read_text(encoding='utf-8').splitlines())
                except Exception:
                    continue
        
        return total_files, total_lines
    
    def _is_source_file(self, file_path: Path) -> bool:
        """Check if file is a source code file"""
        source_extensions = {
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h',
            '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt'
        }
        return file_path.suffix.lower() in source_extensions
    
    def _detect_languages(self) -> Dict[str, int]:
        """Detect programming languages and their usage"""
        language_extensions = {
            'python': ['.py'],
            'javascript': ['.js'],
            'typescript': ['.ts'],
            'java': ['.java'],
            'cpp': ['.cpp', '.c', '.h', '.hpp'],
            'csharp': ['.cs'],
            'php': ['.php'],
            'ruby': ['.rb'],
            'go': ['.go'],
            'rust': ['.rs'],
            'swift': ['.swift'],
            'kotlin': ['.kt']
        }
        
        languages = {}
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file():
                ext = file_path.suffix.lower()
                for lang, extensions in language_extensions.items():
                    if ext in extensions:
                        languages[lang] = languages.get(lang, 0) + 1
                        break
        
        return languages
    
    def _detect_frameworks(self) -> List[str]:
        """Detect development frameworks"""
        frameworks = []
        
        # Python frameworks
        if (self.project_path / "manage.py").exists():
            frameworks.append("Django")
        if (self.project_path / "app.py").exists():
            frameworks.append("Flask")
        if (self.project_path / "main.py").exists() and "fastapi" in self._read_file_safe("requirements.txt", ""):
            frameworks.append("FastAPI")
        
        # JavaScript/TypeScript frameworks
        package_json = self._read_file_safe("package.json", "")
        if "react" in package_json:
            frameworks.append("React")
        if "vue" in package_json:
            frameworks.append("Vue")
        if "angular" in package_json:
            frameworks.append("Angular")
        if "express" in package_json:
            frameworks.append("Express")
        if "next" in package_json:
            frameworks.append("Next.js")
        
        # Other frameworks
        if (self.project_path / "pom.xml").exists():
            frameworks.append("Maven")
        if (self.project_path / "build.gradle").exists():
            frameworks.append("Gradle")
        if (self.project_path / "Cargo.toml").exists():
            frameworks.append("Cargo/Rust")
        
        return frameworks
    
    def _read_file_safe(self, filename: str, default: str = "") -> str:
        """Safely read file content"""
        try:
            return (self.project_path / filename).read_text(encoding='utf-8')
        except Exception:
            return default
    
    def _count_dependencies(self) -> int:
        """Count project dependencies"""
        count = 0
        
        # Python dependencies
        if (self.project_path / "requirements.txt").exists():
            content = self._read_file_safe("requirements.txt")
            count += len([line for line in content.splitlines() if line.strip() and not line.startswith('#')])
        
        # Node.js dependencies
        package_json = self._read_file_safe("package.json")
        if package_json:
            try:
                data = json.loads(package_json)
                deps = data.get("dependencies", {})
                dev_deps = data.get("devDependencies", {})
                count += len(deps) + len(dev_deps)
            except json.JSONDecodeError:
                pass
        
        return count
    
    def _analyze_code_quality(self) -> CodeMetrics:
        """Analyze code quality metrics"""
        total_lines = 0
        complexity_score = 0.0
        test_lines = 0
        duplicate_blocks = 0
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and file_path.suffix == '.py':
                try:
                    content = file_path.read_text(encoding='utf-8')
                    lines = content.splitlines()
                    total_lines += len(lines)
                    
                    # Calculate complexity (simplified)
                    complexity_score += self._calculate_complexity(content)
                    
                    # Count test lines
                    if 'test' in file_path.name.lower() or file_path.parent.name.lower() == 'tests':
                        test_lines += len(lines)
                    
                    # Detect duplicates (simplified)
                    duplicate_blocks += self._detect_duplicates(content)
                    
                except Exception:
                    continue
        
        # Calculate metrics
        test_coverage = (test_lines / total_lines * 100) if total_lines > 0 else 0
        maintainability_index = max(0, 100 - complexity_score / 10)
        technical_debt = int(complexity_score * 2)
        duplicate_percentage = (duplicate_blocks / total_lines * 100) if total_lines > 0 else 0
        
        return CodeMetrics(
            lines_of_code=total_lines,
            complexity_score=complexity_score,
            test_coverage=test_coverage,
            maintainability_index=maintainability_index,
            technical_debt=technical_debt,
            duplicate_code_percentage=duplicate_percentage
        )
    
    def _calculate_complexity(self, content: str) -> float:
        """Calculate cyclomatic complexity"""
        complexity = 1  # Base complexity
        
        # Count decision points
        complexity += content.count('if ')
        complexity += content.count('elif ')
        complexity += content.count('else')
        complexity += content.count('for ')
        complexity += content.count('while ')
        complexity += content.count('except')
        complexity += content.count('and ')
        complexity += content.count('or ')
        
        return float(complexity)
    
    def _detect_duplicates(self, content: str) -> int:
        """Detect duplicate code blocks (simplified)"""
        lines = content.splitlines()
        duplicates = 0
        seen_lines = set()
        
        for line in lines:
            stripped = line.strip()
            if len(stripped) > 20:  # Only check meaningful lines
                if stripped in seen_lines:
                    duplicates += 1
                else:
                    seen_lines.add(stripped)
        
        return duplicates
    
    def _analyze_security(self) -> int:
        """Analyze security issues"""
        issues = 0
        security_patterns = [
            r'eval\s*\(',
            r'exec\s*\(',
            r'shell=True',
            r'password\s*=\s*["\'][^"\']+["\']',
            r'api_key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
            r'token\s*=\s*["\'][^"\']+["\']'
        ]
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and self._is_source_file(file_path):
                try:
                    content = file_path.read_text(encoding='utf-8')
                    for pattern in security_patterns:
                        issues += len(re.findall(pattern, content, re.IGNORECASE))
                except Exception:
                    continue
        
        return issues
    
    def _analyze_performance(self) -> int:
        """Analyze performance issues"""
        issues = 0
        performance_patterns = [
            r'time\.sleep\s*\(\s*\d+\s*\)',
            r'while\s+True\s*:',
            r'for\s+\w+\s+in\s+range\s*\(\s*\d{4,}\s*\)',
            r'\.select\s*\(',
            r'\.find_all\s*\(',
            r'O\([n^2]\)',
            r'O\([n^3]\)'
        ]
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and self._is_source_file(file_path):
                try:
                    content = file_path.read_text(encoding='utf-8')
                    for pattern in performance_patterns:
                        issues += len(re.findall(pattern, content))
                except Exception:
                    continue
        
        return issues
    
    def generate_development_plan(self, metrics: ProjectMetrics, requirements: str) -> DevelopmentPlan:
        """Generate optimized development plan"""
        self.logger.info("Generating development plan...")
        
        # Analyze requirements and current state
        current_state = self._assess_current_state(metrics)
        target_state = self._define_target_state(requirements)
        
        # Generate phases
        phases = self._create_development_phases(current_state, target_state, metrics)
        
        # Calculate timeline
        timeline = self._calculate_timeline(phases, metrics)
        
        # Resource requirements
        resources = self._assess_resources(phases, metrics)
        
        # Risk assessment
        risks = self._assess_risks(phases, metrics)
        
        # Optimization opportunities
        optimizations = self._identify_optimizations(metrics)
        
        return DevelopmentPlan(
            phases=phases,
            estimated_timeline=timeline,
            resource_requirements=resources,
            risk_assessment=risks,
            optimization_opportunities=optimizations
        )
    
    def _assess_current_state(self, metrics: ProjectMetrics) -> Dict[str, Any]:
        """Assess current project state"""
        return {
            "maturity": self._calculate_maturity(metrics),
            "quality_score": metrics.code_metrics.maintainability_index,
            "complexity": metrics.code_metrics.complexity_score,
            "coverage": metrics.code_metrics.test_coverage,
            "security_health": "Good" if metrics.security_issues < 5 else "Needs Attention"
        }
    
    def _calculate_maturity(self, metrics: ProjectMetrics) -> str:
        """Calculate project maturity level"""
        if metrics.total_files < 10:
            return "Initial"
        elif metrics.total_files < 50:
            return "Developing"
        elif metrics.code_metrics.test_coverage > 70:
            return "Mature"
        else:
            return "Growing"
    
    def _define_target_state(self, requirements: str) -> Dict[str, Any]:
        """Define target state based on requirements"""
        # Simple keyword-based analysis
        target = {
            "features": [],
            "quality_goals": {"coverage": 80, "maintainability": 85},
            "performance_goals": {"response_time": "<200ms", "throughput": "1000 req/s"}
        }
        
        if "api" in requirements.lower():
            target["features"].append("REST API")
        if "web" in requirements.lower():
            target["features"].append("Web Interface")
        if "mobile" in requirements.lower():
            target["features"].append("Mobile Support")
        if "database" in requirements.lower():
            target["features"].append("Database Integration")
        
        return target
    
    def _create_development_phases(self, current: Dict[str, Any], target: Dict[str, Any], metrics: ProjectMetrics) -> List[Dict[str, Any]]:
        """Create development phases"""
        phases = []
        
        # Phase 1: Foundation
        phases.append({
            "name": "Foundation Setup",
            "duration_days": 3,
            "tasks": [
                "Setup project structure",
                "Configure development environment",
                "Initialize version control",
                "Setup CI/CD pipeline"
            ],
            "deliverables": ["Project scaffold", "Development environment", "CI/CD setup"]
        })
        
        # Phase 2: Core Development
        phases.append({
            "name": "Core Development",
            "duration_days": max(7, len(target["features"]) * 3),
            "tasks": [f"Implement {feature}" for feature in target["features"]] + [
                "Write unit tests",
                "Integration testing"
            ],
            "deliverables": target["features"] + ["Test suite"]
        })
        
        # Phase 3: Quality Assurance
        phases.append({
            "name": "Quality Assurance",
            "duration_days": 5,
            "tasks": [
                "Code review and refactoring",
                "Performance optimization",
                "Security audit",
                "Documentation"
            ],
            "deliverables": ["Optimized code", "Security report", "Documentation"]
        })
        
        # Phase 4: Deployment
        phases.append({
            "name": "Deployment",
            "duration_days": 2,
            "tasks": [
                "Production deployment",
                "Monitoring setup",
                "User training"
            ],
            "deliverables": ["Production deployment", "Monitoring dashboard", "User guide"]
        })
        
        return phases
    
    def _calculate_timeline(self, phases: List[Dict[str, Any]], metrics: ProjectMetrics) -> int:
        """Calculate total timeline in days"""
        base_timeline = sum(phase["duration_days"] for phase in phases)
        
        # Adjust based on complexity
        complexity_factor = 1 + (metrics.code_metrics.complexity_score / 100)
        
        # Adjust based on technical debt
        debt_factor = 1 + (metrics.code_metrics.technical_debt / 100)
        
        adjusted_timeline = int(base_timeline * complexity_factor * debt_factor)
        
        return adjusted_timeline
    
    def _assess_resources(self, phases: List[Dict[str, Any]], metrics: ProjectMetrics) -> Dict[str, Any]:
        """Assess resource requirements"""
        total_tasks = sum(len(phase["tasks"]) for phase in phases)
        
        return {
            "developers": max(1, total_tasks // 20),
            "devops": 1,
            "qa_testers": max(1, total_tasks // 30),
            "estimated_hours": total_tasks * 4,
            "infrastructure_needs": self._assess_infrastructure(metrics)
        }
    
    def _assess_infrastructure(self, metrics: ProjectMetrics) -> List[str]:
        """Assess infrastructure needs"""
        needs = ["Development server", "CI/CD pipeline"]
        
        if "python" in metrics.languages_used:
            needs.append("Python environment")
        if any(lang in metrics.languages_used for lang in ["javascript", "typescript"]):
            needs.append("Node.js environment")
        if "database" in str(metrics.frameworks_detected).lower():
            needs.append("Database server")
        
        return needs
    
    def _assess_risks(self, phases: List[Dict[str, Any]], metrics: ProjectMetrics) -> Dict[str, Any]:
        """Assess project risks"""
        risks = {
            "technical": [],
            "timeline": [],
            "resource": []
        }
        
        # Technical risks
        if metrics.code_metrics.complexity_score > 50:
            risks["technical"].append("High complexity may cause maintenance issues")
        if metrics.code_metrics.test_coverage < 30:
            risks["technical"].append("Low test coverage increases bug risk")
        if metrics.security_issues > 10:
            risks["technical"].append("Multiple security issues need addressing")
        
        # Timeline risks
        total_duration = sum(phase["duration_days"] for phase in phases)
        if total_duration > 30:
            risks["timeline"].append("Long timeline increases risk of scope creep")
        
        # Resource risks
        if metrics.dependencies_count > 100:
            risks["resource"].append("High dependency count requires more maintenance")
        
        return risks
    
    def _identify_optimizations(self, metrics: ProjectMetrics) -> List[str]:
        """Identify optimization opportunities"""
        optimizations = []
        
        if metrics.code_metrics.test_coverage < 50:
            optimizations.append("Increase test coverage to improve reliability")
        
        if metrics.code_metrics.duplicate_code_percentage > 10:
            optimizations.append("Refactor duplicate code to improve maintainability")
        
        if metrics.code_metrics.technical_debt > 50:
            optimizations.append("Address technical debt to improve performance")
        
        if metrics.performance_issues > 5:
            optimizations.append("Optimize performance bottlenecks")
        
        if metrics.security_issues > 0:
            optimizations.append("Fix security vulnerabilities")
        
        return optimizations
    
    def generate_report(self, metrics: ProjectMetrics, plan: DevelopmentPlan) -> str:
        """Generate comprehensive analysis report"""
        report = f"""
# Project Analysis Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Project Metrics
- **Total Files**: {metrics.total_files}
- **Lines of Code**: {metrics.total_lines}
- **Languages**: {', '.join(metrics.languages_used.keys())}
- **Frameworks**: {', '.join(metrics.frameworks_detected)}
- **Dependencies**: {metrics.dependencies_count}

## Code Quality
- **Maintainability Index**: {metrics.code_metrics.maintainability_index:.1f}/100
- **Test Coverage**: {metrics.code_metrics.test_coverage:.1f}%
- **Complexity Score**: {metrics.code_metrics.complexity_score:.1f}
- **Technical Debt**: {metrics.code_metrics.technical_debt} points
- **Duplicate Code**: {metrics.code_metrics.duplicate_code_percentage:.1f}%

## Issues Found
- **Security Issues**: {metrics.security_issues}
- **Performance Issues**: {metrics.performance_issues}

## Development Plan
### Timeline: {plan.estimated_timeline} days

### Phases:
"""
        
        for i, phase in enumerate(plan.phases, 1):
            report += f"""
#### Phase {i}: {phase['name']} ({phase['duration_days']} days)
**Tasks:**
{chr(10).join(f"- {task}" for task in phase['tasks'])}

**Deliverables:**
{chr(10).join(f"- {deliverable}" for deliverable in phase['deliverables'])}
"""
        
        report += f"""
### Resource Requirements
- **Developers**: {plan.resource_requirements['developers']}
- **DevOps Engineers**: {plan.resource_requirements['devops']}
- **QA Testers**: {plan.resource_requirements['qa_testers']}
- **Estimated Hours**: {plan.resource_requirements['estimated_hours']}

### Risk Assessment
"""
        
        for risk_type, risk_list in plan.risk_assessment.items():
            if risk_list:
                report += f"**{risk_type.title()} Risks:**\n"
                for risk in risk_list:
                    report += f"- {risk}\n"
        
        if plan.optimization_opportunities:
            report += "\n### Optimization Opportunities\n"
            for opt in plan.optimization_opportunities:
                report += f"- {opt}\n"
        
        return report

if __name__ == "__main__":
    # Example usage
    analyzer = ProjectAnalyzer(".")
    metrics = analyzer.analyze_project()
    plan = analyzer.generate_development_plan(metrics, "Create a web application with API")
    report = analyzer.generate_report(metrics, plan)
    print(report)
