#!/usr/bin/env python3
"""
Real AI Development Assistant - Enhanced with genuine AI capabilities
Real AI-powered development assistance with OpenAI, Anthropic, or Google AI integration
"""

import os
import sys
import json
import time
import subprocess
import importlib
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging

# Import our real AI service
from ai_service import get_ai_service, is_ai_available

# Configure logging with UTF-8 encoding
import sys
import io

# Create a UTF-8 encoded stream handler
utf8_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_development_assistant.log', encoding='utf-8'),
        logging.StreamHandler(utf8_stdout)
    ]
)
logger = logging.getLogger(__name__)

class RealAIDevelopmentAssistant:
    """Real AI-powered development assistant with genuine AI capabilities"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.ai_system_path = self.project_root / "src" / "ai-system"
        self.src_path = self.project_root / "src"
        self.web_path = self.project_root / "web"
        
        # Initialize AI components
        self.analysis_results = {}
        self.development_plan = {}
        self.optimization_history = []
        self.current_phase = "analysis"
        
        # Initialize real AI service
        self.ai_service = get_ai_service()
        
        logger.info(f"Real AI Development Assistant initialized for project: {self.project_root}")
        logger.info(f"AI Provider: {self.ai_service.provider if self.ai_service else 'None'}")
        logger.info(f"AI Available: {is_ai_available()}")
    
    def analyze_project_structure(self) -> Dict[str, Any]:
        """Real AI-powered project structure analysis"""
        logger.info("🔍 Running AI-powered project analysis...")
        
        analysis = {
            "project_root": str(self.project_root),
            "timestamp": datetime.now().isoformat(),
            "structure": {},
            "technologies": [],
            "components": {},
            "issues": [],
            "recommendations": [],
            "ai_insights": ""
        }
        
        # Analyze directory structure
        analysis["structure"] = self._analyze_directory_structure(self.project_root)
        
        # Identify technologies
        analysis["technologies"] = self._identify_technologies()
        
        # Analyze components
        analysis["components"] = self._analyze_components()
        
        # Detect issues
        analysis["issues"] = self._detect_development_issues()
        
        # Generate AI insights if available
        if is_ai_available():
            try:
                code_sample = self._get_code_sample()
                context = f"Project structure: {analysis['structure']}"
                analysis["ai_insights"] = self.ai_service.analyze_code(code_sample, context)
                logger.info("✅ AI-powered analysis completed")
            except Exception as e:
                logger.error(f"❌ Error in AI analysis: {e}")
                analysis["ai_insights"] = "AI analysis unavailable"
        
        # Generate AI recommendations if available
        if is_ai_available():
            try:
                analysis["recommendations"] = self._generate_ai_recommendations(analysis)
                logger.info("✅ AI recommendations generated")
            except Exception as e:
                logger.error(f"❌ Error generating AI recommendations: {e}")
                analysis["recommendations"] = self._generate_fallback_recommendations(analysis)
        else:
            analysis["recommendations"] = self._generate_fallback_recommendations(analysis)
        
        self.analysis_results = analysis
        logger.info(f"✅ Project analysis complete. Found {len(analysis['issues'])} issues")
        
        return analysis
    
    def _analyze_directory_structure(self, path: Path, max_depth: int = 3) -> Dict[str, Any]:
        """Analyze directory structure recursively"""
        structure = {
            "path": str(path),
            "type": "directory",
            "children": [],
            "files": [],
            "total_files": 0,
            "total_dirs": 0,
            "size_bytes": 0
        }
        
        try:
            for item in path.iterdir():
                if item.is_file():
                    structure["files"].append({
                        "name": item.name,
                        "size": item.stat().st_size,
                        "extension": item.suffix.lower(),
                        "modified": datetime.fromtimestamp(item.stat().st_mtime).isoformat()
                    })
                    structure["total_files"] += 1
                    structure["size_bytes"] += item.stat().st_size
                elif item.is_dir() and max_depth > 0:
                    if not item.name.startswith('.') and item.name not in ['node_modules', '__pycache__', '.git']:
                        child_analysis = self._analyze_directory_structure(item, max_depth - 1)
                        structure["children"].append(child_analysis)
                        structure["total_dirs"] += child_analysis["total_dirs"] + 1
                        structure["total_files"] += child_analysis["total_files"]
                        structure["size_bytes"] += child_analysis["size_bytes"]
        except Exception as e:
            logger.error(f"Error analyzing directory {path}: {e}")
        
        return structure
    
    def _identify_technologies(self) -> List[str]:
        """Identify technologies used in the project"""
        technologies = []
        
        # Check for common technology indicators
        tech_indicators = {
            'python': ['*.py', 'requirements.txt', 'setup.py', 'pyproject.toml'],
            'javascript': ['*.js', '*.mjs', 'package.json', 'node_modules'],
            'typescript': ['*.ts', 'tsconfig.json'],
            'html': ['*.html', '*.htm'],
            'css': ['*.css', '*.scss', '*.sass'],
            'react': ['package.json'],
            'vue': ['*.vue'],
            'docker': ['Dockerfile', 'docker-compose.yml'],
            'database': ['*.sql', 'database.py', 'models.py'],
            'api': ['api.py', 'server.py', 'app.py'],
            'testing': ['test_', 'tests/', '*_test.py', 'pytest.ini'],
            'ai_ml': ['ai-', 'ml-', 'model', 'neural', 'tensorflow', 'pytorch']
        }
        
        for tech, patterns in tech_indicators.items():
            for pattern in patterns:
                if pattern.startswith('*'):
                    if list(self.project_root.rglob(pattern)):
                        technologies.append(tech)
                        break
                else:
                    if (self.project_root / pattern).exists():
                        technologies.append(tech)
                        break
        
        return list(set(technologies))  # Remove duplicates
    
    def _analyze_components(self) -> Dict[str, Any]:
        """Analyze project components"""
        components = {}
        
        # Check for web components
        components['web'] = self._analyze_web_components()
        
        # Check for database components
        components['database'] = self._analyze_database_components()
        
        # Check for API components
        components['api'] = self._analyze_api_components()
        
        # Check for AI/ML components
        components['ai_ml'] = self._analyze_ai_components()
        
        return components
    
    def _analyze_web_components(self) -> Dict[str, Any]:
        """Analyze web components"""
        web_components = {
            "frameworks": [],
            "pages": [],
            "assets": [],
            "config": []
        }
        
        # Check for web frameworks
        web_frameworks = ['react', 'vue', 'angular', 'django', 'flask', 'fastapi']
        for framework in web_frameworks:
            if any(self.project_root.rglob(f"*{framework}*")):
                web_components['frameworks'].append(framework)
        
        # Check for HTML pages
        for html_file in self.project_root.rglob("*.html"):
            web_components['pages'].append(html_file.name)
        
        return web_components
    
    def _analyze_database_components(self) -> Dict[str, Any]:
        """Analyze database components"""
        db_components = {
            "models": [],
            "migrations": [],
            "config": []
        }
        
        # Check for Django models
        for model_file in self.project_root.rglob("models.py"):
            db_components['models'].append(str(model_file))
        
        # Check for database config
        db_configs = ['database.py', 'settings.py', 'config.py']
        for config in db_configs:
            if (self.project_root / config).exists():
                db_components['config'].append(config)
        
        return db_components
    
    def _analyze_api_components(self) -> Dict[str, Any]:
        """Analyze API components"""
        api_components = {
            "endpoints": [],
            "frameworks": [],
            "config": []
        }
        
        # Check for API files
        api_files = ['api.py', 'server.py', 'app.py', 'main.py']
        for api_file in api_files:
            if (self.project_root / api_file).exists():
                api_components['endpoints'].append(api_file)
        
        return api_components
    
    def _analyze_ai_components(self) -> Dict[str, Any]:
        """Analyze AI/ML components"""
        ai_components = {
            "models": [],
            "training": [],
            "config": []
        }
        
        # Check for AI/ML files
        ai_files = ['model.py', 'train.py', 'predict.py', 'ai_*.py']
        for pattern in ai_files:
            for ai_file in self.project_root.glob(pattern):
                ai_components['models'].append(ai_file.name)
        
        return ai_components
    
    def _detect_development_issues(self) -> List[Dict[str, Any]]:
        """Detect development issues using both rules and AI"""
        issues = []
        
        # Basic rule-based issue detection
        issues.extend(self._check_code_quality())
        issues.extend(self._check_dependencies())
        issues.extend(self._check_configuration())
        issues.extend(self._check_performance())
        issues.extend(self._check_security())
        
        # If AI is available, enhance issue detection
        if is_ai_available():
            try:
                code_sample = self._get_code_sample()
                ai_issues = self._detect_ai_issues(code_sample)
                issues.extend(ai_issues)
            except Exception as e:
                logger.error(f"❌ Error in AI issue detection: {e}")
        
        return issues
    
    def _detect_ai_issues(self, code: str) -> List[Dict[str, Any]]:
        """Use AI to detect development issues"""
        try:
            prompt = f"""Analyze this code for potential issues and problems:

{code}

Identify:
1. Code quality issues
2. Security vulnerabilities
3. Performance problems
4. Maintainability concerns
5. Best practices violations

Return as JSON array of issue objects with fields: type, severity, description, recommendation"""
            
            response = self.ai_service.analyze_code(code, "Development issue detection")
            
            # Parse AI response (basic parsing)
            issues = []
            lines = response.split('\n')
            for line in lines:
                if line.strip() and not line.startswith('#'):
                    if 'issue' in line.lower() or 'problem' in line.lower():
                        issues.append({
                            "type": "ai_detected",
                            "severity": "medium",
                            "description": line.strip(),
                            "recommendation": "Review AI analysis for details"
                        })
            
            return issues
            
        except Exception as e:
            logger.error(f"❌ Error in AI issue detection: {e}")
            return []
    
    def _check_code_quality(self) -> List[Dict[str, Any]]:
        """Check code quality issues"""
        issues = []
        
        # Check for long files
        for file_path in self.project_root.rglob("*.py"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) > 500:
                        issues.append({
                            "type": "code_quality",
                            "severity": "medium",
                            "file": str(file_path),
                            "description": f"File too long: {len(lines)} lines",
                            "recommendation": "Consider breaking down into smaller modules"
                        })
            except Exception:
                continue
        
        return issues
    
    def _check_dependencies(self) -> List[Dict[str, Any]]:
        """Check dependency issues"""
        issues = []
        
        # Check for requirements.txt
        req_file = self.project_root / "requirements.txt"
        if req_file.exists():
            try:
                with open(req_file, 'r') as f:
                    requirements = f.read()
                    if 'tensorflow' in requirements and 'torch' in requirements:
                        issues.append({
                            "type": "dependencies",
                            "severity": "medium",
                            "file": str(req_file),
                            "description": "Multiple ML frameworks detected",
                            "recommendation": "Consider using one primary ML framework"
                        })
            except Exception:
                pass
        
        return issues
    
    def _check_configuration(self) -> List[Dict[str, Any]]:
        """Check configuration issues"""
        issues = []
        
        # Check for missing configuration files
        config_files = ['package.json', 'requirements.txt', 'setup.py', '.env.example']
        for config_file in config_files:
            if not (self.project_root / config_file).exists():
                issues.append({
                    "type": "configuration",
                    "severity": "low",
                    "file": config_file,
                    "description": f"Missing configuration file: {config_file}",
                    "recommendation": f"Create {config_file} template"
                })
        
        return issues
    
    def _check_performance(self) -> List[Dict[str, Any]]:
        """Check performance issues"""
        issues = []
        
        # Check for large files
        for file_path in self.project_root.rglob("*"):
            if file_path.is_file() and file_path.stat().st_size > 10 * 1024 * 1024:  # 10MB
                issues.append({
                    "type": "performance",
                    "severity": "low",
                    "file": str(file_path),
                    "description": f"Large file: {file_path.stat().st_size / (1024*1024):.1f}MB",
                    "recommendation": "Consider optimizing or compressing large files"
                })
        
        return issues
    
    def _check_security(self) -> List[Dict[str, Any]]:
        """Check security issues"""
        issues = []
        
        # Check for exposed API keys or secrets
        sensitive_patterns = ['api_key', 'secret', 'password', 'token']
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    for pattern in sensitive_patterns:
                        if pattern in content.lower():
                            issues.append({
                                "type": "security",
                                "severity": "high",
                                "file": str(file_path),
                                "description": f"Potential sensitive data: {pattern}",
                                "recommendation": "Use environment variables for sensitive data"
                            })
            except Exception:
                continue
        
        return issues
    
    def _get_code_sample(self, max_lines: int = 50) -> str:
        """Get a sample of code for AI analysis"""
        code_samples = []
        
        # Get Python files
        for file_path in self.project_root.rglob("*.py"):
            if file_path.stat().st_size < 10000:  # Not too large
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        if len(lines) > 10:  # Not empty
                            sample_lines = lines[:max_lines]
                            code_samples.append(f"File: {file_path.name}\n")
                            code_samples.extend([line.rstrip() for line in sample_lines])
                            code_samples.append("\n")
                            break
                except Exception:
                    continue
        
        return '\n'.join(code_samples[:max_lines * 2]) if code_samples else "# No code samples available"
    
    def _generate_ai_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate AI-powered recommendations"""
        try:
            recommendations_text = self.ai_service.generate_recommendations(analysis)
            # Parse recommendations
            recommendations = [line.strip() for line in recommendations_text.split('\n') if line.strip()]
            return recommendations
        except Exception as e:
            logger.error(f"❌ Error generating AI recommendations: {e}")
            return self._generate_fallback_recommendations(analysis)
    
    def _generate_fallback_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate fallback recommendations when AI is not available"""
        recommendations = []
        
        # Basic recommendations based on analysis
        if analysis.get('issues'):
            issue_types = set(issue.get('type') for issue in analysis['issues'])
            
            if 'code_quality' in issue_types:
                recommendations.append("🔧 Improve code quality by breaking down large files")
                recommendations.append("📚 Add comprehensive documentation")
            
            if 'security' in issue_types:
                recommendations.append("🔒 Address security vulnerabilities immediately")
                recommendations.append("🔐 Use environment variables for sensitive data")
            
            if 'performance' in issue_types:
                recommendations.append("⚡ Optimize large files and assets")
                recommendations.append("📈 Implement caching strategies")
        
        # Technology-specific recommendations
        technologies = analysis.get('technologies', [])
        if 'python' in technologies:
            recommendations.append("🐍 Use virtual environments for Python dependencies")
            recommendations.append("📦 Implement proper error handling")
        
        if 'javascript' in technologies:
            recommendations.append("🌐 Use npm for package management")
            recommendations.append("📦 Implement proper error handling")
        
        if not recommendations:
            recommendations.append("✅ No specific recommendations at this time")
            recommendations.append("📊 Continue monitoring project health")
        
        return recommendations
    
    def generate_development_plan(self) -> Dict[str, Any]:
        """Generate AI-powered development plan"""
        logger.info("📋 Generating AI-powered development plan...")
        
        plan = {
            "timestamp": datetime.now().isoformat(),
            "total_duration": 49,
            "phases": 4,
            "team_size": 4,
            "estimated_hours": 2352,
            "phases": []
        }
        
        # AI-enhanced phase planning
        if is_ai_available():
            try:
                context = f"Technologies: {self._identify_technologies()}, Issues: {len(self._detect_development_issues())}"
                ai_plan = self.ai_service.get_ai_assistance("Generate a 49-day development plan with 4 phases", context)
                logger.info("✅ AI-powered development plan generated")
            except Exception as e:
                logger.error(f"❌ Error generating AI development plan: {e}")
                ai_plan = "AI plan generation failed, using fallback plan"
        else:
            ai_plan = "AI not available, using fallback plan"
        
        # Phase definitions
        phases = [
            {
                "name": "Analysis & Planning",
                "duration_days": 7,
                "objectives": [
                    "Review and refine development plan",
                    "Set up project management tools",
                    "Establish development environment",
                    "Create team communication channels",
                    "Define detailed objectives"
                ],
                "deliverables": [
                    "Refined development plan",
                    "Project management setup",
                    "Development environment",
                    "Communication channels",
                    "Detailed objectives document"
                ]
            },
            {
                "name": "Core Development",
                "duration_days": 21,
                "objectives": [
                    "Implement core authentication system",
                    "Build data processing engine",
                    "Create API gateway",
                    "Integrate AI system components",
                    "Establish database layer",
                    "Build web interface",
                    "Integrate all components"
                ],
                "deliverables": [
                    "Authentication system",
                    "Data processing engine",
                    "API gateway",
                    "AI integration layer",
                    "Database management",
                    "Web interface",
                    "Component integration",
                    "Core functionality"
                ]
            },
            {
                "name": "Testing & Quality Assurance",
                "duration_days": 14,
                "objectives": [
                    "Implement comprehensive test suite",
                    "Perform quality assurance checks",
                    "Conduct security audits",
                    "Validate performance benchmarks",
                    "Complete documentation",
                    "Prepare for production"
                ],
                "deliverables": [
                    "Test suite (unit, integration, e2e)",
                    "Quality assurance reports",
                    "Security audit report",
                    "Performance benchmarks",
                    "Complete documentation",
                    "Production readiness report"
                ]
            },
            {
                "name": "Deployment & Launch",
                "duration_days": 7,
                "objectives": [
                    "Execute production deployment",
                    "Monitor system performance",
                    "Train users on platform",
                    "Complete launch activities",
                    "Establish monitoring",
                    "Handover to operations"
                ],
                "deliverables": [
                    "Production deployment",
                    "Monitoring systems",
                    "User training materials",
                    "Launch completion report",
                    "Operations handover",
                    "Post-launch support"
                ]
            }
        ]
        
        plan["phases"] = phases
        plan["ai_insights"] = ai_plan
        
        self.development_plan = plan
        logger.info("✅ Development plan generated: 49 days, 4 phases")
        
        return plan
    
    def optimize_codebase(self) -> Dict[str, Any]:
        """Real AI-powered codebase optimization"""
        logger.info("⚡ Starting AI-powered codebase optimization...")
        
        optimization = {
            "timestamp": datetime.now().isoformat(),
            "tools_applied": 0,
            "optimizations": []
        }
        
        # Get current issues
        issues = self._detect_development_issues()
        
        if issues and is_ai_available():
            try:
                # Get code sample for optimization
                code_sample = self._get_code_sample()
                
                # AI optimization
                optimization_result = self.ai_service.optimize_code(code_sample, issues)
                optimization["optimizations"].append({
                    "type": "ai_optimization",
                    "description": "AI-powered code optimization",
                    "result": optimization_result
                })
                optimization["tools_applied"] = 1
                
                logger.info("✅ AI-powered optimization completed")
            except Exception as e:
                logger.error(f"❌ Error in AI optimization: {e}")
                optimization["optimizations"].append({
                    "type": "error",
                    "description": f"AI optimization failed: {str(e)}"
                })
        else:
            logger.info("⚠️ AI not available, optimization skipped")
            optimization["optimizations"].append({
                "type": "info",
                "description": "AI service not available for optimization"
            })
        
        self.optimization_history.append(optimization)
        logger.info(f"✅ Codebase optimization complete. Applied {optimization['tools_applied']} optimizations")
        
        return optimization
    
    def get_ai_assistance(self, query: str) -> str:
        """Get real AI assistance for custom queries"""
        if not is_ai_available():
            return "❌ AI service not available. Please check API key and installation."
        
        try:
            context = f"Project: {self.project_root}, Technologies: {self._identify_technologies()}"
            response = self.ai_service.get_ai_assistance(query, context)
            return response
        except Exception as e:
            logger.error(f"❌ Error getting AI assistance: {e}")
            return f"❌ Error getting AI assistance: {str(e)}"

# Create global instance for backward compatibility
_real_ai_assistant = None

def get_real_ai_assistant():
    """Get real AI assistant instance"""
    global _real_ai_assistant
    if _real_ai_assistant is None:
        _real_ai_assistant = RealAIDevelopmentAssistant()
    return _real_ai_assistant
