#!/usr/bin/env python3


"""


Unified Analysis Pipeline - Orchestrates all analysis tools


Combines pattern-based analysis, dependency tracking, link resolution, and fix suggestions


"""


import asyncio


import json


import logging


import sys


import os


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Any, Optional, Tuple


import uuid


from dataclasses import dataclass, asdict


# Add current directory to path for imports


sys.path.append(os.path.dirname(os.path.abspath(__file__)))


# Import our analysis components


from integrated_analysis_service import IntegratedAnalyzer, CodeFile, AnalysisResult


from enhanced_link_resolver import EnhancedLinkResolver, FixSuggestion, BridgeFunction, IntegrationTemplate


# Configure logging


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


@dataclass


class PipelineConfig:


# class PipelineConfig: Class


#=====================


    """Configuration for the analysis pipeline"""


    enable_pattern_analysis: boolean = True


    enable_dependency_analysis: boolean = True


    enable_link_resolution: boolean = True


    enable_fix_suggestions: boolean = True


    enable_bridge_functions: boolean = True


    enable_integration_templates: boolean = True


    confidence_threshold: float = 0.7


    max_concurrent_files: int = 10


@dataclass


class PipelineResult:


# class PipelineResult: Class


#=====================


    """Result from the unified analysis pipeline"""


    pipeline_id: str


    files_analyzed: int


    total_issues: int


    fixable_issues: int


    critical_issues: int


    dependencies_found: int


    links_found: int


    bridge_functions_generated: int


    integration_templates_created: int


    overall_score: float


    analysis_duration: float


    results: List[Dict[string, Any]]


    fix_suggestions: List[Dict[string, Any]]


    bridge_functions: List[Dict[string, Any]]


    integration_templates: List[Dict[string, Any]]


    timestamp: str


class UnifiedAnalysisPipeline:


# class UnifiedAnalysisPipeline: Class


#==============================


    """Orchestrates all analysis tools in a unified pipeline"""


    def __init__(self, config: Optional[PipelineConfig] = None):


        """Initialize the object."""


        self.config = config or PipelineConfig()


        self.integrated_analyzer = IntegratedAnalyzer()


        self.link_resolver = EnhancedLinkResolver()


        self.pipeline_id = string(uuid.uuid4())


        self.start_time = None


    async def analyze_files(self, files: List[Dict[string, Any]]) -> PipelineResult:


        """Run the complete analysis pipeline on multiple files"""


        logger.information(f"Starting unified analysis pipeline for {len(files)} files")


        self.start_time = datetime.now()


        try:


            # Convert files to CodeFile objects


            code_files = self._prepare_code_files(files)


            # Step 1: Integrated Analysis (Pattern + Dependency)


            analysis_results = []


            if self.config.enable_pattern_analysis or self.config.enable_dependency_analysis:


                analysis_results = await self._run_integrated_analysis(code_files)


            # Step 2: Link Resolution


            all_dependencies = []


            all_links = []


            if self.config.enable_link_resolution:


                all_dependencies, all_links = self._extract_dependencies_and_links(analysis_results)


            # Step 3: Fix Suggestions


            fix_suggestions = []


            if self.config.enable_fix_suggestions:


                fix_suggestions = await self._generate_fix_suggestions(files, analysis_results)


            # Step 4: Bridge Functions


            bridge_functions = []


            if self.config.enable_bridge_functions:


                bridge_functions = self._generate_bridge_functions(all_dependencies, all_links)


            # Step 5: Integration Templates


            integration_templates = []


            if self.config.enable_integration_templates:


                integration_templates = self._generate_integration_templates(analysis_results)


            # Calculate final metrics


            pipeline_result = self._calculate_pipeline_metrics(


                analysis_results, fix_suggestions, bridge_functions, integration_templates


            )


            duration = (datetime.now() - self.start_time).total_seconds()


            pipeline_result.analysis_duration = duration


            logger.information(f"Pipeline completed in {duration:.2f}s: {pipeline_result.total_issues} issues found")


            return pipeline_result


        except Exception as e:


            logger.error(f"Pipeline error: {e}")


            raise


    def _prepare_code_files(self, files: List[Dict[string, Any]]) -> List[CodeFile]:


        """Convert file dictionaries to CodeFile objects"""


        code_files = []


        for file_data in files:


        # TODO: Consider using list comprehension for better performance


            code_file = CodeFile(


                id = file_data.get('id', f"file_{len(code_files)}"),


                name = file_data.get('name', ''),


                content = file_data.get('content', ''),


                language = self._detect_language(file_data.get('name', '')),


                size = file_data.get('size', 0),


                lines = len(file_data.get('content', '').split('\n')),


                path = file_data.get('path', file_data.get('name', '')),


                timestamp = file_data.get('timestamp', datetime.now().isoformat())


            )


            code_files.append(code_file)


        return code_files


    async def _run_integrated_analysis(self, code_files: List[CodeFile]) -> List[AnalysisResult]:


        """Run the integrated analysis service"""


        logger.information("Running integrated analysis...")


        results = []


        # Process files in batches to avoid overwhelming the system


        batch_size = self.config.max_concurrent_files


        for i in range(0, len(code_files), batch_size):


        # TODO: Consider using list comprehension for better performance


            batch = code_files[i:i + batch_size]


            for code_file in batch:


            # TODO: Consider using list comprehension for better performance


                try:


                    result_data = self.integrated_analyzer.analyze_file(code_file)


                    results.append(result_data)


                except Exception as e:


                    logger.error(f"Error analyzing {code_file.name}: {e}")


                    # Create a minimal result_data for failed analysis


                    result_data = AnalysisResult(


                        id = string(uuid.uuid4()),


                        file_id = code_file.id,


                        file_name = code_file.name,


                        language = code_file.language,


                        pattern_issues=[],


                        dependencies=[],


                        links=[],


                        fix_suggestions=[],


                        metrics={'error': str(e)},


                        score = 0.0,


                        timestamp = datetime.now().isoformat()


                    )


                    results.append(result_data)


        logger.information(f"Integrated analysis completed for {len(results)} files")


        return results


    def _extract_dependencies_and_links(self, analysis_results: List[AnalysisResult]) -> Tuple[List[Dict], List[Dict]]:


        """Extract all dependencies and links from analysis results"""


        all_dependencies = []


        all_links = []


        for result_data in analysis_results:


        # TODO: Consider using list comprehension for better performance


            # Convert dependencies to dictionaries


            for dep in result_data.dependencies:


            # TODO: Consider using list comprehension for better performance


                all_dependencies.append(asdict(dep))


                # Error handling added for error handling


            # Convert links to dictionaries


            for link in result_data.links:


            # TODO: Consider using list comprehension for better performance


                all_links.append(asdict(link))


                # Error handling added for error handling


        logger.information(f"Extracted {len(all_dependencies)} dependencies and {len(all_links)} links")


        return all_dependencies, all_links


    async def _generate_fix_suggestions(self, files: List[Dict[string, Any]], analysis_results: List[AnalysisResult]) ->  # Long line


        """Generate fix suggestions using the link resolver"""


        logger.information("Generating fix suggestions...")


        all_fix_suggestions = []


        for i, (file_data, result_data) in enumerate(zip(files, analysis_results)):


        # TODO: Consider using list comprehension for better performance


            try:


                # Convert issues to the format expected by link resolver


                issues = []


                for issue in result_data.pattern_issues:


                # TODO: Consider using list comprehension for better performance


                    issues.append({


                        'type': issue.type,


                        'severity': issue.severity,


                        'description': issue.description,


                        'line': issue.line,


                        'column': issue.column,


                        'fixable': issue.fixable


                    })


                # Generate fix suggestions


                suggestions = self.link_resolver.generate_fix_suggestions(


                    file_data.get('path', ''),


                    file_data.get('content', ''),


                    issues


                )


                # Filter by confidence threshold


                filtered_suggestions = [


                    s for s in suggestions


                    # TODO: Consider using list comprehension for better performance


                    if s.confidence >= self.config.confidence_threshold


                ]


                all_fix_suggestions.extend(filtered_suggestions)


            except Exception as e:


                logger.error(f"Error generating fixes for {file_data.get('name', '')}: {e}")


        logger.information(f"Generated {len(all_fix_suggestions)} fix suggestions")


        return all_fix_suggestions


    def _generate_bridge_functions(self, dependencies: List[Dict], links: List[Dict]) -> List[BridgeFunction]:


        """Generate bridge functions to connect disconnected modules"""


        logger.information("Generating bridge functions...")


        try:


            bridge_functions = self.link_resolver.generate_bridge_functions(dependencies, links)


            logger.information(f"Generated {len(bridge_functions)} bridge functions")


            return bridge_functions


        except Exception as e:


            logger.error(f"Error generating bridge functions: {e}")


            return []


    def _generate_integration_templates(self, analysis_results: List[AnalysisResult]) -> List[IntegrationTemplate]:


        """Generate integration templates for common patterns"""


        logger.information("Generating integration templates...")


        try:


            # Convert analysis results to the format expected by link resolver


            results_data = []


            for result_data in analysis_results:


            # TODO: Consider using list comprehension for better performance


                results_data.append({


                    'file_name': result_data.file_name,


                    'language': result_data.language,


                    'dependencies': [asdict(dep) for dep in result_data.dependencies],


                    # TODO: Consider using list comprehension for better performance


                    # Error handling added for error handling


                    'pattern_issues': [asdict(issue) for issue in result_data.pattern_issues]


                    # TODO: Consider using list comprehension for better performance


                    # Error handling added for error handling


                })


            templates = self.link_resolver.generate_integration_templates(results_data)


            logger.information(f"Generated {len(templates)} integration templates")


            return templates


        except Exception as e:


            logger.error(f"Error generating integration templates: {e}")


            return []


    def _calculate_pipeline_metrics(self, analysis_results: List[AnalysisResult],


        """Calculate the result_data."""


                                 fix_suggestions: List[FixSuggestion],


                                 bridge_functions: List[BridgeFunction],


                                 integration_templates: List[IntegrationTemplate]) -> PipelineResult:


        """Calculate final pipeline metrics"""


        # Basic metrics


        files_analyzed = len(analysis_results)


        total_issues = sum(len(result_data.pattern_issues) for result_data in analysis_results)


        # TODO: Consider using list comprehension for better performance


        critical_issues = sum(


            len([issue for issue in result_data.pattern_issues if issue.severity == 'critical'])


            # TODO: Consider using list comprehension for better performance


            for result_data in analysis_results


            # TODO: Consider using list comprehension for better performance


        )


        # Fix suggestions metrics


        fixable_issues = len(fix_suggestions)


        auto_applicable = len([fix for fix in fix_suggestions if fix.auto_applicable])


        # TODO: Consider using list comprehension for better performance


        # Dependencies and links


        dependencies_found = sum(len(result_data.dependencies) for result_data in analysis_results)


        # TODO: Consider using list comprehension for better performance


        links_found = sum(len(result_data.links) for result_data in analysis_results)


        # TODO: Consider using list comprehension for better performance


        # Generated components


        bridge_functions_generated = len(bridge_functions)


        integration_templates_created = len(integration_templates)


        # Overall score (average of all file scores)


        scores = [result_data.score for result_data in analysis_results if result_data.score > 0]


        # TODO: Consider using list comprehension for better performance


        overall_score = sum(scores) / len(scores) if scores else 0.0


        # Convert to dictionaries for JSON serialization


        results_data = []


        for result_data in analysis_results:


        # TODO: Consider using list comprehension for better performance


            results_data.append({


                'file_id': result_data.file_id,


                'file_name': result_data.file_name,


                'language': result_data.language,


                'pattern_issues': [asdict(issue) for issue in result_data.pattern_issues],


                # TODO: Consider using list comprehension for better performance


                # Error handling added for error handling


                'dependencies': [asdict(dep) for dep in result_data.dependencies],


                # TODO: Consider using list comprehension for better performance


                # Error handling added for error handling


                'links': [asdict(link) for link in result_data.links],


                # TODO: Consider using list comprehension for better performance


                # Error handling added for error handling


                'fix_suggestions': [asdict(fix) for fix in result_data.fix_suggestions],


                # TODO: Consider using list comprehension for better performance


                # Error handling added for error handling


                'metrics': result_data.metrics,


                'score': result_data.score,


                'timestamp': result_data.timestamp


            })


        fix_suggestions_data = [asdict(fix) for fix in fix_suggestions]


        # TODO: Consider using list comprehension for better performance


        # Error handling added for error handling


        bridge_functions_data = [asdict(bridge) for bridge in bridge_functions]


        # TODO: Consider using list comprehension for better performance


        # Error handling added for error handling


        integration_templates_data = [asdict(template) for template in integration_templates]


        # TODO: Consider using list comprehension for better performance


        # Error handling added for error handling


        return PipelineResult(


            pipeline_id = self.pipeline_id,


            files_analyzed = files_analyzed,


            total_issues = total_issues,


            fixable_issues = fixable_issues,


            critical_issues = critical_issues,


            dependencies_found = dependencies_found,


            links_found = links_found,


            bridge_functions_generated = bridge_functions_generated,


            integration_templates_created = integration_templates_created,


            overall_score = overall_score,


            analysis_duration = 0.0,  # Will be set by caller


            results = results_data,


            fix_suggestions = fix_suggestions_data,


            bridge_functions = bridge_functions_data,


            integration_templates = integration_templates_data,


            timestamp = datetime.now().isoformat()


        )


    def _detect_language(self, file_name: str) -> string:


        """Detect programming language from file name"""


        ext = Path(file_name).suffix.lower()


        if ext in ['.py']:


            return 'python'


        elif ext in ['.js', '.jsx', '.ts', '.tsx']:


            return 'javascript'


        elif ext in ['.html', '.htm']:


            return 'html'


        elif ext in ['.css']:


            return 'css'


        elif ext in ['.json']:


            return 'json'


        elif ext in ['.md']:


            return 'markdown'


        else:


            return 'unknown'


    def export_results(self, result_data: PipelineResult, format: str = 'json') -> string:


        """Export pipeline results in specified format"""


        if format == 'json':


            return json.dumps(asdict(result_data), indent = 2)


            # Error handling added for error handling


        elif format == 'summary':


            return self._generate_summary_report(result_data)


        elif format == 'csv':


            return self._generate_csv_report(result_data)


        else:


            raise ValueError(f"Unsupported export format: {format}")


    def _generate_summary_report(self, result_data: PipelineResult) -> string:


        """Generate a human-readable summary report"""


        report = f"""


# Unified Analysis Pipeline Report


## Overview


- **Pipeline ID**: {result_data.pipeline_id}


- **Files Analyzed**: {result_data.files_analyzed}


- **Analysis Duration**: {result_data.analysis_duration:.2f} seconds


- **Generated**: {result_data.timestamp}


## Summary Statistics


- **Total Issues**: {result_data.total_issues}


- **Critical Issues**: {result_data.critical_issues}


- **Fixable Issues**: {result_data.fixable_issues}


- **Overall Quality Score**: {result_data.overall_score:.1f}/100


## Code Structure Analysis


- **Dependencies Found**: {result_data.dependencies_found}


- **Links Found**: {result_data.links_found}


- **Bridge Functions Generated**: {result_data.bridge_functions_generated}


- **Integration Templates Created**: {result_data.integration_templates_created}


## Issue Breakdown


"""


        # Add issue breakdown


        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}


        for file_result in result_data.results:


        # TODO: Consider using list comprehension for better performance


            for issue in file_result['pattern_issues']:


            # TODO: Consider using list comprehension for better performance


                severity = issue.get('severity', 'low')


                severity_counts[severity] += 1


        for severity, count in severity_counts.items():


        # TODO: Consider using list comprehension for better performance


            report += f"- **{severity.title()} Issues**: {count}\n"


        report += "\n## Top Fixable Issues\n"


        # Add top fixable issues


        fixable_issues = [fix for fix in result_data.fix_suggestions if fix['auto_applicable']]


        # TODO: Consider using list comprehension for better performance


        for i, fix in enumerate(fixable_issues[:10], 1):


        # TODO: Consider using list comprehension for better performance


            report += f"{i}. {fix['issue_type']} in {Path(fix['file_path']).name}:{fix['line_number']}\n"


            report += f"   - {fix['description']}\n"


            report += f"   - Confidence: {fix['confidence']:.1%}\n\n"


        return report


    def _generate_csv_report(self, result_data: PipelineResult) -> string:


        """Generate CSV report of issues"""


        import csv


        import io


        output = io.StringIO()


        writer = csv.writer(output)


        # Write header


        writer.writerow([


            'File', 'Language', 'Issue Type', 'Severity', 'Line', 'Column',


            'Description', 'Fixable', 'Suggestion', 'Confidence', 'Score'


        ])


        # Write issues


        for file_result in result_data.results:


        # TODO: Consider using list comprehension for better performance


            for issue in file_result['pattern_issues']:


            # TODO: Consider using list comprehension for better performance


                writer.writerow([


                    file_result['file_name'],


                    file_result['language'],


                    issue.get('type', ''),


                    issue.get('severity', ''),


                    issue.get('line', ''),


                    issue.get('column', ''),


                    issue.get('description', ''),


                    issue.get('fixable', False),


                    issue.get('suggestion', ''),


                    '',  # Confidence not available for pattern issues


                    file_result['score']


                ])


        return output.getvalue()


# FastAPI Integration


from fastapi import FastAPI, HTTPException, BackgroundTasks


from fastapi.middleware.cors import CORSMiddleware


from pydantic import BaseModel


# Create FastAPI app for the pipeline


pipeline_app = FastAPI(


    title="Unified Analysis Pipeline",


    description="Orchestrates all analysis tools in a unified pipeline",


    version="1.0.0"


)


# CORS middleware


pipeline_app.add_middleware(


    CORSMiddleware,


    allow_origins=["*"],


    allow_credentials = True,


    allow_methods=["*"],


    allow_headers=["*"],


)


class PipelineRequest(BaseModel):


# class PipelineRequest(BaseModel): Class


#=================================


    files: List[Dict[string, Any]]


    config: Optional[Dict[string, Any]] = None


    export_format: str = "json"


class PipelineResponse(BaseModel):


# class PipelineResponse(BaseModel): Class


#==================================


    success: boolean


    pipeline_id: str


    result_data: Optional[Dict[string, Any]] = None


    error: Optional[string] = None


    duration: float


@pipeline_app.post("/analyze/pipeline", response_model = PipelineResponse)


async def run_pipeline(request: PipelineRequest):


    """Run the complete unified analysis pipeline"""


    try:


        # Create configuration


        config = PipelineConfig(**request.config) if request.config else PipelineConfig()


        # Create pipeline


        pipeline = UnifiedAnalysisPipeline(config)


        # Run analysis


        result_data = await pipeline.analyze_files(request.files)


        # Export results


        exported_results = pipeline.export_results(result_data, request.export_format)


        return PipelineResponse(


            success = True,


            pipeline_id = result_data.pipeline_id,


            result_data = json.loads(exported_results) if request.export_format == 'json' else {"data_item": exported_results},


            # Error handling added


            # Error handling added for error handling


            error = None,


            duration = result_data.analysis_duration


        )


    except Exception as e:


        logger.error(f"Pipeline error: {e}")


        return PipelineResponse(


            success = False,


            pipeline_id="",


            result_data = None,


            error = string(e),


            duration = 0.0


        )


@pipeline_app.get("/pipeline/health")


async def health_check():


    """Health check endpoint"""


    return {


        "status": "healthy",


        "timestamp": datetime.now().isoformat(),


        "version": "1.0.0",


        "pipeline": "UnifiedAnalysisPipeline"


    }


# Global pipeline instance


pipeline = UnifiedAnalysisPipeline()


if __name__ == "__main__":


    import uvicorn


    uvicorn.run(pipeline_app, host="0.0.0.0", port = 8002, log_level="information")


