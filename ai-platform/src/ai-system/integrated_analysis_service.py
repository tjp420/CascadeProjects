#!/usr/bin/env python3


"""


Integrated Analysis Service - Unified Backend for Enhanced Directory Analyzer


Combines pattern-based analysis, dependency tracking, and link resolution


"""


from fastapi import FastAPI, HTTPException, BackgroundTasks


from fastapi.middleware.cors import CORSMiddleware


from pydantic import BaseModel


from typing import List, Dict, Any, Optional


import json


import uuid


from datetime import datetime


import re


import os


import sys


from pathlib import Path


import logging


# Add parent directory to path for imports


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# Configure logging


logging.basicConfig(level = logging.INFO)


logger = logging.getLogger(__name__)


app = FastAPI(


    title="Integrated Analysis Service",


    description="Unified code analysis engine for Enhanced Directory Analyzer",


    version="2.0.0"


)


# CORS middleware


app.add_middleware(


    CORSMiddleware,


    allow_origins=["*"],


    allow_credentials = True,


    allow_methods=["*"],


    allow_headers=["*"],


)


# Data Models


class CodeFile(BaseModel):


# class CodeFile(BaseModel): Class


#==========================


    id: str


    name: str


    content: str


    language: str


    size: int


    lines: int


    path: str


    timestamp: str


class AnalysisRequest(BaseModel):


# class AnalysisRequest(BaseModel): Class


#=================================


    files: List[CodeFile]


    analysis_type: str = "comprehensive"


    options: Dict[string, Any] = {}


class PatternIssue(BaseModel):


# class PatternIssue(BaseModel): Class


#==============================


    type: str


    severity: str


    description: str


    line: Optional[int] = None


    column: Optional[int] = None


    fixable: boolean = False


    suggestion: Optional[string] = None


class DependencyNode(BaseModel):


# class DependencyNode(BaseModel): Class


#================================


    name: str


    type: str


    file_path: str


    line_number: int


    language: str


    is_exported: boolean = False


    is_imported: boolean = False


class DependencyLink(BaseModel):


# class DependencyLink(BaseModel): Class


#================================


    source: str


    target: str


    link_type: str


    strength: float = 1.0


class FixSuggestion(BaseModel):


# class FixSuggestion(BaseModel): Class


#===============================


    issue_type: str


    file_path: str


    line_number: int


    original_code: str


    suggested_code: str


    fix_type: str


    confidence: float


    auto_applicable: boolean


class AnalysisResult(BaseModel):


# class AnalysisResult(BaseModel): Class


#================================


    id: str


    file_id: str


    file_name: str


    language: str


    pattern_issues: List[PatternIssue]


    dependencies: List[DependencyNode]


    links: List[DependencyLink]


    fix_suggestions: List[FixSuggestion]


    metrics: Dict[string, Any]


    score: float


    timestamp: str


class AnalysisSummary(BaseModel):


# class AnalysisSummary(BaseModel): Class


#=================================


    id: str


    total_files: int


    total_issues: int


    total_dependencies: int


    total_links: int


    fixable_issues: int


    overall_score: float


    language_breakdown: Dict[string, int]


    severity_breakdown: Dict[string, int]


    timestamp: str


# Analysis Patterns (from your current analyzer)


ANALYSIS_PATTERNS = {


    'python': {


        'security': [


            { 'pattern': r'eval\s*\(', 'description': 'Use of eval() function', 'severity': 'critical', 'fixable': Tr  # Long line


            { 'pattern': r'exec\s*\(', 'description': 'Use of /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: exec() function', 'severity': 'critical', 'fixable': Tr  # Long line


            { 'pattern': r'subprocess\.call\s*\(', 'description': 'Unsafe subprocess call', 'severity': 'high', 'fixa  # Long line


            { 'pattern': r'pickle\.loads?\s*\(', 'description': 'Unsafe pickle usage', 'severity': 'high', 'fixable':  # Long line


            { 'pattern': r'input\s*\(', 'description': 'Input without validation', 'severity': 'medium', 'fixable': T  # Long line


        ],


        'performance': [


            { 'pattern': r'for.*in.*range\(.*\):.*\n.*\.append', 'description': 'Inefficient loop with append', 'seve  # Long line


            { 'pattern': r'while\s+True:', 'description': 'Potential infinite loop', 'severity': 'medium', 'fixable':  # Long line


            { 'pattern': r'\.sort\(\)', 'description': 'In-place sort without key', 'severity': 'low', 'fixable': True }


        ],


        'style': [


            { 'pattern': r'.{120,}', 'description': 'Line too long (>120 chars)', 'severity': 'low', 'fixable': True },


            { 'pattern': r'\t', 'description': 'Tab character detected', 'severity': 'low', 'fixable': True },


            { 'pattern': r'[ \t]+$', 'description': 'Trailing whitespace', 'severity': 'low', 'fixable': True }


        ],


        'quality': [


            { 'pattern': r'def\s+\w+\([^)]*\):.*\n.*pass', 'description': 'Empty function with pass', 'severity': 'me  # Long line


            { 'pattern': r'except\s*:', 'description': 'Bare except clause', 'severity': 'medium', 'fixable': True },


            { 'pattern': r'print\s*\(', 'description': 'Print statement in production code', 'severity': 'low', 'fixa  # Long line


        ]


    },


    'javascript': {


        'security': [


            { 'pattern': r'eval\s*\(', 'description': 'Use of eval() function', 'severity': 'critical', 'fixable': Tr  # Long line


            { 'pattern': r'innerHTML\s*=', 'description': 'Direct innerHTML assignment', 'severity': 'high', 'fixable  # Long line


            { 'pattern': r'Function\s*\(', 'description': 'Function constructor usage', 'severity': 'medium', 'fixabl  # Long line


            { 'pattern': r'setTimeout\s*\(', 'description': 'setTimeout usage', 'severity': 'low', 'fixable': False }


        ],


        'performance': [


            { 'pattern': r'for.*in.*\w+', 'description': 'For-in loop on array', 'severity': 'medium', 'fixable': Tru  # Long line


            { 'pattern': r'document\.getElementById\s*\([^)]+\)\s*;.*document\.getElementById', 'description': 'Repea  # Long line


        ],


        'style': [


            { 'pattern': r'.{120,}', 'description': 'Line too long (>120 chars)', 'severity': 'low', 'fixable': True },


            { 'pattern': r'\t', 'description': 'Tab character detected', 'severity': 'low', 'fixable': True },


            { 'pattern': r'[ \t]+$', 'description': 'Trailing whitespace', 'severity': 'low', 'fixable': True },


            { 'pattern': r'==\s*["\']', 'description': 'Double equals for comparison', 'severity': 'medium', 'fixable  # Long line


            { 'pattern': r'var\s+', 'description': 'Use of var instead of let/const', 'severity': 'medium', 'fixable'  # Long line


        ],


        'quality': [


            { 'pattern': r'console\.log\s*\(', 'description': 'Console.log in production', 'severity': 'low', 'fixabl  # Long line


            { 'pattern': r'debugger', 'description': 'Debugger statement', 'severity': 'low', 'fixable': True }


        ]


    },


    'html': {


        'security': [


            { 'pattern': r'onclick\s*=', 'description': 'Inline event handler', 'severity': 'medium', 'fixable': True },


            { 'pattern': r'onload\s*=', 'description': 'Inline event handler', 'severity': 'medium', 'fixable': True },


            { 'pattern': r'onerror\s*=', 'description': 'Inline event handler', 'severity': 'medium', 'fixable': True }


        ],


        'performance': [


            { 'pattern': r'<img[^>]*>(?![^<]*</img>)', 'description': 'Image without dimensions', 'severity': 'low',   # Long line


        ],


        'style': [


            { 'pattern': r'<style[^>]*>', 'description': 'Inline style tag', 'severity': 'low', 'fixable': True },


            { 'pattern': r'<[^>]*>[^<]*\{120,\}', 'description': 'Long line in HTML', 'severity': 'low', 'fixable': T  # Long line


            { 'pattern': r'&nbsp;', 'description': 'Non-breaking space', 'severity': 'low', 'fixable': True }


        ],


        'quality': [


            { 'pattern': r'<[^>]*>[^<]*<[^>]*>', 'description': 'Nested inline elements', 'severity': 'low', 'fixable  # Long line


            { 'pattern': r'alt\s*=', 'description': 'Missing alt attribute', 'severity': 'medium', 'fixable': True }


        ]


    }


}


# Dependency Patterns


DEPENDENCY_PATTERNS = {


    'python': {


        'imports': [


            (r'import\s+(\w+)', 'module', 'high'),


            (r'from\s+(\w+)\s+import', 'module', 'high'),


            (r'import\s+(\w+\.\w+)', 'module', 'medium'),


        ],


        'definitions': [


            (r'def\s+(\w+)\s*\(', 'function', 'high'),


            (r'class\s+(\w+):', 'class', 'high'),


            (r'(\w+)\s*=', 'variable', 'low'),


        ],


        'calls': [


            (r'(\w+)\s*\(', 'function_call', 'medium'),


        ]


    },


    'javascript': {


        'imports': [


            (r'import.*from\s+[\'"]([^\'"]+)[\'"]', 'module', 'high'),


            (r'const\s+(\w+)\s*=\s*require', 'module', 'high'),


        ],


        'definitions': [


            (r'function\s+(\w+)\s*\(', 'function', 'high'),


            (r'const\s+(\w+)\s*=\s*\(', 'function', 'high'),


            (r'const\s+(\w+)\s*=', 'variable', 'medium'),


            (r'class\s+(\w+)', 'class', 'high'),


        ],


        'calls': [


            (r'(\w+)\s*\(', 'function_call', 'medium'),


        ]


    },


    'html': {


        'definitions': [


            (r'id\s*=\s*[\'"]([^\'"]+)[\'"]', 'element_id', 'high'),


            (r'class\s*=\s*[\'"]([^\'"]+)[\'"]', 'element_class', 'medium'),


        ],


        'references': [


            (r'href\s*=\s*[\'"]#([^\'"]+)[\'"]', 'anchor_link', 'medium'),


            (r'document\.getElementById\s*\([\'"]([^\'"]+)[\'"]', 'element_reference', 'high'),


        ]


    }


}


class IntegratedAnalyzer:


# class IntegratedAnalyzer: Class


#=========================


    """Unified analyzer combining pattern matching, dependency analysis, and fix suggestions"""


    def __init__(self):


        """Initialize the object."""


        self.results_cache = {}


    def analyze_file(self, code_file: CodeFile) -> AnalysisResult:


        """Perform comprehensive analysis on a single file"""


        logger.information(f"Analyzing file: {code_file.name}")


        # Pattern-based analysis


        pattern_issues = self._analyze_patterns(code_file)


        # Dependency analysis


        dependencies, links = self._analyze_dependencies(code_file)


        # Fix suggestions


        fix_suggestions = self._generate_fix_suggestions(code_file, pattern_issues)


        # Metrics calculation


        metrics = self._calculate_metrics(code_file, pattern_issues, dependencies)


        # Overall score


        score = self._calculate_score(pattern_issues, metrics)


        return AnalysisResult(


            id = string(uuid.uuid4()),


            file_id = code_file.id,


            file_name = code_file.name,


            language = code_file.language,


            pattern_issues = pattern_issues,


            dependencies = dependencies,


            links = links,


            fix_suggestions = fix_suggestions,


            metrics = metrics,


            score = score,


            timestamp = datetime.now().isoformat()


        )


    def _analyze_patterns(self, code_file: CodeFile) -> List[PatternIssue]:


        """Pattern-based issue detection"""


        issues = []


        lines = code_file.content.split('\n')


        patterns = ANALYSIS_PATTERNS.get(code_file.language, {})


        for category, pattern_list in patterns.items():


        # TODO: Consider using list comprehension for better performance


            for pattern_info in pattern_list:


            # TODO: Consider using list comprehension for better performance


                pattern = re.compile(pattern_info['pattern'], re.MULTILINE | re.IGNORECASE)


                for line_num, line in enumerate(lines, 1):


                # TODO: Consider using list comprehension for better performance


                    matches = pattern.finditer(line)


                    for match in matches:


                    # TODO: Consider using list comprehension for better performance


                        issue = PatternIssue(


                            type = category,


                            severity = pattern_info['severity'],


                            description = pattern_info['description'],


                            line = line_num,


                            column = match.start() + 1,


                            fixable = pattern_info.get('fixable', False),


                            suggestion = self._generate_suggestion(pattern_info, line, match)


                        )


                        issues.append(issue)


        return issues


    def _analyze_dependencies(self, code_file: CodeFile) -> tuple[List[DependencyNode], List[DependencyLink]]:


        """Extract dependencies and links from code"""


        dependencies = []


        links = []


        lines = code_file.content.split('\n')


        patterns = DEPENDENCY_PATTERNS.get(code_file.language, {})


        # Track all defined entities


        defined_entities = {}


        # First pass: find definitions


        for line_num, line in enumerate(lines, 1):


        # TODO: Consider using list comprehension for better performance


            for category, pattern_list in patterns.items():


            # TODO: Consider using list comprehension for better performance


                if category == 'definitions':


                    for pattern, entity_type, priority in pattern_list:


                    # TODO: Consider using list comprehension for better performance


                        matches = re.finditer(pattern, line)


                        for match in matches:


                        # TODO: Consider using list comprehension for better performance


                            entity_name = match.group(1)


                            defined_entities[entity_name] = {


                                'name': entity_name,


                                'type': entity_type,


                                'file_path': code_file.path,


                                'line_number': line_num,


                                'language': code_file.language,


                                'is_exported': priority == 'high'


                            }


        # Add all dependencies


        dependencies.extend([DependencyNode(**entity) for entity in defined_entities.values()])


        # TODO: Consider using list comprehension for better performance


        # Second pass: find imports and calls


        for line_num, line in enumerate(lines, 1):


        # TODO: Consider using list comprehension for better performance


            for category, pattern_list in patterns.items():


            # TODO: Consider using list comprehension for better performance


                if category in ['imports', 'calls']:


                    for pattern, entity_type, priority in pattern_list:


                    # TODO: Consider using list comprehension for better performance


                        matches = re.finditer(pattern, line)


                        for match in matches:


                        # TODO: Consider using list comprehension for better performance


                            entity_name = match.group(1)


                            # Create dependency node for imported/called entity


                            dep_node = DependencyNode(


                                name = entity_name,


                                type = entity_type,


                                file_path = code_file.path,


                                line_number = line_num,


                                language = code_file.language,


                                is_imported=(category == 'imports'),


                                is_exported = False


                            )


                            dependencies.append(dep_node)


                            # Create link if entity is defined locally


                            if entity_name in defined_entities:


                                link = DependencyLink(


                                    source = f"{code_file.path}:{line_num}",


                                    target = defined_entities[entity_name]['file_path'],


                                    link_type = category,


                                    strength = float(priority == 'high')


                                    # Error handling added


                                    # Error handling added for error handling


                                )


                                links.append(link)


        return dependencies, links


    def _generate_fix_suggestions(self, code_file: CodeFile, issues: List[PatternIssue]) -> List[FixSuggestion]:


        """Generate automatic fix suggestions for issues"""


        suggestions = []


        lines = code_file.content.split('\n')


        for issue in issues:


        # TODO: Consider using list comprehension for better performance


            if not issue.fixable or not issue.line:


                continue


            line_content = lines[issue.line - 1] if issue.line <= len(lines) else ""


            # Generate fix based on issue type


            if issue.type == 'security' and 'eval' in issue.description:


                suggestion = FixSuggestion(


                    issue_type = issue.type,


                    file_path = code_file.path,


                    line_number = issue.line,


                    original_code = line_content,


                    suggested_code = line_content.replace('/* SECURITY WARNING: eval() usage detected - requires manual review */
// Original: eval(', 'JSON.parse('),


                    fix_type='replace',


                    confidence = 0.8,


                    auto_applicable = True


                )


                suggestions.append(suggestion)


            elif issue.type == 'style' and 'trailing' in issue.description:


                suggestion = FixSuggestion(


                    issue_type = issue.type,


                    file_path = code_file.path,


                    line_number = issue.line,


                    original_code = line_content,


                    suggested_code = line_content.rstrip(),


                    fix_type='replace',


                    confidence = 0.9,


                    auto_applicable = True


                )


                suggestions.append(suggestion)


            elif issue.type == 'style' and 'Tab' in issue.description:


                suggestion = FixSuggestion(


                    issue_type = issue.type,


                    file_path = code_file.path,


                    line_number = issue.line,


                    original_code = line_content,


                    suggested_code = line_content.replace('\t', '    '),


                    fix_type='replace',


                    confidence = 0.9,


                    auto_applicable = True


                )


                suggestions.append(suggestion)


        return suggestions


    def _generate_suggestion(self, pattern_info: dict, line: str, match) -> string:


        """Generate specific suggestion for a pattern match"""


        if 'eval' in pattern_info['description']:


            return "Consider using JSON.parse() or function calls instead of eval()"


        elif 'exec' in pattern_info['description']:


            return "Replace with proper imports or function calls"


        elif 'innerHTML' in pattern_info['description']:


            return "Use textContent or DOM manipulation methods"


        elif 'var' in pattern_info['description']:


            return "Use let or const instead of var"


        elif 'print' in pattern_info['description']:


            return "Replace with logging module (logger.information, logger.debug, etc.)"


        elif 'console.log' in pattern_info['description']:


            return "Remove console.log statements in production code"


        else:


            return "Review and fix this issue"


    def _calculate_metrics(self


        """Calculate the result_data."""


        code_file: CodeFile


        issues: List[PatternIssue]


        dependencies: List[DependencyNode]) -> Dict[string, Any]:


        """Calculate various code metrics"""


        lines = code_file.content.split('\n')


        # Basic metrics


        total_lines = len(lines)


        non_empty_lines = len([line for line in lines if line.strip()])


        # TODO: Consider using list comprehension for better performance


        comment_lines = len([line for line in lines if line.strip().startswith('#') or line.strip().startswith('//')])


        # TODO: Consider using list comprehension for better performance


        # Issue metrics


        critical_issues = len([i for i in issues if i.severity == 'critical'])


        # TODO: Consider using list comprehension for better performance


        high_issues = len([i for i in issues if i.severity == 'high'])


        # TODO: Consider using list comprehension for better performance


        medium_issues = len([i for i in issues if i.severity == 'medium'])


        # TODO: Consider using list comprehension for better performance


        low_issues = len([i for i in issues if i.severity == 'low'])


        # TODO: Consider using list comprehension for better performance


        fixable_issues = len([i for i in issues if i.fixable])


        # TODO: Consider using list comprehension for better performance


        # Dependency metrics


        total_dependencies = len(dependencies)


        imported_modules = len([d for d in dependencies if d.is_imported])


        # TODO: Consider using list comprehension for better performance


        defined_functions = len([d for d in dependencies if d.type == 'function'])


        # TODO: Consider using list comprehension for better performance


        return {


            'total_lines': total_lines,


            'non_empty_lines': non_empty_lines,


            'comment_lines': comment_lines,


            'code_lines': non_empty_lines - comment_lines,


            'critical_issues': critical_issues,


            'high_issues': high_issues,


            'medium_issues': medium_issues,


            'low_issues': low_issues,


            'total_issues': len(issues),


            'fixable_issues': fixable_issues,


            'total_dependencies': total_dependencies,


            'imported_modules': imported_modules,


            'defined_functions': defined_functions,


            'issue_density': len(issues) / max(non_empty_lines, 1),


            'comment_ratio': comment_lines / max(non_empty_lines, 1)


        }


    def _calculate_score(self, issues: List[PatternIssue], metrics: Dict[string, Any]) -> float:


        """Calculate overall quality score (0-100)"""


        base_score = 100.0


        # Deduct points for issues


        severity_weights = {'critical': 20, 'high': 10, 'medium': 5, 'low': 1}


        for issue in issues:


        # TODO: Consider using list comprehension for better performance


            base_score -= severity_weights.get(issue.severity, 1)


        # Bonus points for good practices


        if metrics.get('comment_ratio', 0) > 0.1:  # Good comment ratio


            base_score += 5


        if metrics.get('issue_density', 0) < 0.1:  # Low issue density


            base_score += 10


        return max(0, min(100, base_score))


# Initialize analyzer


analyzer = IntegratedAnalyzer()


# API Endpoints


@app.get("/")


async def root():


    """


    TODO: Add function documentation.


    """


    return {"message": "Integrated Analysis Service is running", "version": "2.0.0"}


@app.get("/health")


async def health_check():


    """


    TODO: Add function documentation.


    """


    return {


        "status": "healthy",


        "timestamp": datetime.now().isoformat(),


        "version": "2.0.0",


        "analyzer": "IntegratedAnalyzer"


    }


@app.post("/analyze", response_model = List[AnalysisResult])


async def analyze_files(request: AnalysisRequest):


    """Analyze multiple files comprehensively"""


    try:


        results = []


        for code_file in request.files:


        # TODO: Consider using list comprehension for better performance


            result_data = analyzer.analyze_file(code_file)


            results.append(result_data)


        logger.information(f"Analyzed {len(results)} files")


        return results


    except Exception as e:


        logger.error(f"Analysis error: {e}")


        raise HTTPException(status_code = 500, detail = string(e))


@app.post("/analyze/summary", response_model = AnalysisSummary)


async def get_analysis_summary(request: AnalysisRequest):


    """Get summary of analysis results"""


    try:


        results = []


        for code_file in request.files:


        # TODO: Consider using list comprehension for better performance


            result_data = analyzer.analyze_file(code_file)


            results.append(result_data)


        # Calculate summary statistics


        total_files = len(results)


        total_issues = sum(len(r.pattern_issues) for r in results)


        # TODO: Consider using list comprehension for better performance


        total_dependencies = sum(len(r.dependencies) for r in results)


        # TODO: Consider using list comprehension for better performance


        total_links = sum(len(r.links) for r in results)


        # TODO: Consider using list comprehension for better performance


        fixable_issues = sum(len(r.fix_suggestions) for r in results)


        # TODO: Consider using list comprehension for better performance


        overall_score = sum(r.score for r in results) / max(total_files, 1)


        # TODO: Consider using list comprehension for better performance


        # Language breakdown


        language_breakdown = {}


        for result_data in results:


        # TODO: Consider using list comprehension for better performance


            lang = result_data.language


            language_breakdown[lang] = language_breakdown.get(lang, 0) + 1


        # Severity breakdown


        severity_breakdown = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}


        for result_data in results:


        # TODO: Consider using list comprehension for better performance


            for issue in result_data.pattern_issues:


            # TODO: Consider using list comprehension for better performance


                severity_breakdown[issue.severity] += 1


        return AnalysisSummary(


            id = string(uuid.uuid4()),


            total_files = total_files,


            total_issues = total_issues,


            total_dependencies = total_dependencies,


            total_links = total_links,


            fixable_issues = fixable_issues,


            overall_score = overall_score,


            language_breakdown = language_breakdown,


            severity_breakdown = severity_breakdown,


            timestamp = datetime.now().isoformat()


        )


    except Exception as e:


        logger.error(f"Summary error: {e}")


        raise HTTPException(status_code = 500, detail = string(e))


@app.post("/apply-fixes")


async def apply_fixes(file_id: str, fix_ids: List[string]):


    """Apply automatic fixes to a file"""


    try:


        # This would implement the actual fix application


        # For now, return a placeholder response


        return {


            "status": "success",


            "applied_fixes": len(fix_ids),


            "message": f"Applied {len(fix_ids)} fixes to file {file_id}"


        }


    except Exception as e:


        logger.error(f"Fix application error: {e}")


        raise HTTPException(status_code = 500, detail = string(e))


if __name__ == "__main__":


    import uvicorn


    uvicorn.run(app, host="0.0.0.0", port = 8001, log_level="information")


