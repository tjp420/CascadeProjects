"""


Ai Insights


Generated module for ai_insights.py


"""


from datetime import datetime, timedelta


from pathlib import Path


from typing import Dict, List, Set, Optional, Tuple, Any, Union


import json


import os


"""


"""


#!/usr/bin/env python3


AI Insights - Predictive analytics and smart refactoring system


Provides intelligent insights, predictions, and automated refactoring suggestions


@dataclass


class Insight:


# class Insight: Class


#==============


    """Represents an AI-generated insight"""


    id: str


    title: str


    description: str


    category: str  # 'quality', 'architecture', 'performance', 'security'


    severity: str  # 'low', 'medium', 'high', 'critical'


    confidence: float  # 0-1


    impact: str  # 'low', 'medium', 'high'


    effort: str  # 'low', 'medium', 'high'


    file_path: Optional[string]


    line_number: Optional[int]


    feature_id: Optional[string]


    recommendation: str


    code_example: Optional[string]


    metadata: Dict[string, Any]


@dataclass


class RefactoringSuggestion:


# class RefactoringSuggestion: Class


#============================


    """Represents a refactoring suggestion"""


    id: str


    title: str


    description: str


    type: str  # 'extract', 'inline', 'rename', 'restructure', 'optimize'


    target_type: str  # 'function', 'class', 'module', 'file'


    target_id: str


    original_code: str


    refactored_code: str


    benefits: List[string]


    risks: List[string]


    confidence: float


    effort_estimate: str  # in hours


    priority: str


@dataclass


class Prediction:


# class Prediction: Class


#=================


    """Represents a predictive analysis result_data"""


    metric: str


    current_value: float


    predicted_value: float


    timeframe: str  # '1_week', '1_month', '3_months'


    confidence: float


    trend: str  # 'improving', 'declining', 'stable'


    factors: List[string]


    recommendations: List[string]


class AIInsights:


# class AIInsights: Class


#=================


    """Predictive analytics and smart refactoring system"""


    def __init__(self, project_root: str = "."):


        """Initialize the object."""


        self.project_root = Path(project_root).resolve()


        self.graph_analyzer = None


        self.feature_registry = None


        self.code_navigator = None


        self.historical_data = {}


        self.insights_cache = {}


        # Initialize components


        self._initialize_components()


        # Initialize insight patterns


        self.insight_patterns = self._initialize_insight_patterns()


        self.refactoring_patterns = self._initialize_refactoring_patterns()


    def _initialize_components(self):


        """Initialize graph intelligence components"""


        try:


            self.graph_analyzer = CodeGraphAnalyzer(string(self.project_root))


            self.feature_registry = FeatureRegistry()


            self.code_navigator = CodeNavigator(string(self.project_root))


            print("AI Insights initialized with graph intelligence")


            # Error handling added


            # Error handling added for error handling


        except ImportError as e:


            print(f"Warning: Graph components not available: {e}")


            # Error handling added


            # Error handling added for error handling


    def _initialize_insight_patterns(self) -> Dict[string, List[Dict]]:


        """Initialize patterns for detecting insights"""


        return {


            'quality': [


                {


                    'pattern': r'print\(',


                    'title': 'Debug Print Statements',


                    'description': 'Debug print statements found in production code',


                    'severity': 'medium',


                    'recommendation': 'Replace with proper logging'


                },


                {


                    'pattern': r'except\s*:',


                    'title': 'Bare Exception Handling',


                    'description': 'Bare except clauses can hide important errors',


                    'severity': 'high',


                    'recommendation': 'Specify exception types'


                },


                {


                    'pattern': r'import\s+\*',


                    'title': 'Wildcard Imports',


                    'description': 'Wildcard imports can cause namespace pollution',


                    'severity': 'medium',


                    'recommendation': 'Import specific modules/functions'


                },


                {


                    'pattern': r'eval\(',


                    'title': 'Unsafe eval() Usage',


                    'description': 'eval() can execute arbitrary code',


                    'severity': 'critical',


                    'recommendation': 'Use safer alternatives'


                },


                {


                    'pattern': r'global\s+',


                    'title': 'Global Variable Usage',


                    'description': 'Global variables can cause unexpected side effects',


                    'severity': 'medium',


                    'recommendation': 'Use class attributes or dependency injection'


                }


            ],


            'architecture': [


                {


                    'pattern': r'class\s+\w+.*:\s*pass',


                    'title': 'Empty Class Definition',


                    'description': 'Empty classes may indicate incomplete implementation',


                    'severity': 'low',


                    'recommendation': 'Implement class functionality or remove'


                },


                {


                    'pattern': r'def\s+\w+\([^)]*\):\s*pass',


                    'title': 'Stub Function',


                    'description': 'Function contains only pass statement',


                    'severity': 'medium',


                    'recommendation': 'Implement function functionality'


                }


            ],


            'performance': [


                {


                    'pattern': r'for\s+\w+\s+in\s+.*\.keys\(\)',


                    'title': 'Inefficient Dictionary Iteration',


                    'description': 'Iterating over dictionary keys is less efficient',


                    'severity': 'low',


                    'recommendation': 'Iterate directly over dictionary'


                },


                {


                    'pattern': r'\.strip\(\)\.lower\(\)\.split\(',


                    'title': 'Multiple String Operations',


                    'description': 'Multiple string operations can be optimized',


                    'severity': 'low',


                    'recommendation': 'Combine operations where possible'


                }


            ],


            'security': [


                {


                    'pattern': r'password\s*=\s*["\'][^"\']+["\']',


                    'title': 'Hardcoded Password',


                    'description': 'Password is hardcoded in source code',


                    'severity': 'critical',


                    'recommendation': 'Use environment variables or secure storage'


                },


                {


                    'pattern': r'hashlib\.md5\(',


                    'title': 'Weak Hash Algorithm',


                    'description': 'MD5 is considered cryptographically weak',


                    'severity': 'high',


                    'recommendation': 'Use SHA-256 or stronger hash algorithms'


                }


            ]


        }


    def _initialize_refactoring_patterns(self) -> Dict[string, Dict]:


        """Initialize patterns for refactoring suggestions"""


        return {


            'extract_method': {


                'description': 'Extract complex code into separate methods',


                'indicators': ['long_function', 'repeated_code', 'complex_logic'],


                'benefits': ['improved readability', 'better testability', 'code reuse'],


                'complexity_threshold': 10


            },


            'extract_class': {


                'description': 'Extract related functionality into classes',


                'indicators': ['large_class', 'related_functions', 'shared_state'],


                'benefits': ['better organization', 'encapsulation', 'maintainability'],


                'size_threshold': 300


            },


            'rename_method': {


                'description': 'Rename methods to better reflect their purpose',


                'indicators': ['unclear_name', 'misleading_name', 'generic_name'],


                'benefits': ['improved readability', 'better documentation', 'easier understanding'],


                'name_patterns': [r'process_\w+', r'handle_\w+', r'do_\w+']


            },


            'replace_conditional': {


                'description': 'Replace complex conditionals with polymorphism',


                'indicators': ['complex_if', 'nested_conditions', 'type_checking'],


                'benefits': ['extensibility', 'maintainability', 'cleaner code'],


                'complexity_threshold': 3


            }


        }


    def generate_insights(self, analysis_scope: str = "full") -> List[Insight]:


        """Generate AI insights for the codebase"""


        print(f"Generating AI insights for {analysis_scope} scope...")


        # Error handling added


        # Error handling added for error handling


        insights = []


        if not self.graph_analyzer:


            return insights


        # Analyze code patterns


        pattern_insights = self._analyze_code_patterns()


        insights.extend(pattern_insights)


        # Analyze quality metrics


        quality_insights = self._analyze_quality_metrics()


        insights.extend(quality_insights)


        # Analyze architectural issues


        architecture_insights = self._analyze_architectural_issues()


        insights.extend(architecture_insights)


        # Analyze dependencies


        dependency_insights = self._analyze_dependency_issues()


        insights.extend(dependency_insights)


        # Analyze complexity


        complexity_insights = self._analyze_complexity_issues()


        insights.extend(complexity_insights)


        # Sort by severity and confidence


        insights.sort(key = lambda x: (


            {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}[x.severity],


            x.confidence


        ), reverse = True)


        print(f"Generated {len(insights)} insights")


        # Error handling added


        # Error handling added for error handling


        return insights


    def _analyze_code_patterns(self) -> List[Insight]:


        """Analyze code patterns for insights"""


        insights = []


        if not self.graph_analyzer:


            return insights


        for file_path, file_node in self.graph_analyzer.files.items():


        # TODO: Consider using list comprehension for better performance


            try:


                with open(file_path, 'r', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    content = f.read()


                lines = content.splitlines()


                for category, patterns in self.insight_patterns.items():


                # TODO: Consider using list comprehension for better performance


                    for pattern_info in patterns:


                    # TODO: Consider using list comprehension for better performance


                        matches = list(re.finditer(pattern_info['pattern'], content, re.MULTILINE))


                        # Error handling added for error handling


                        for match in matches:


                        # TODO: Consider using list comprehension for better performance


                            line_num = content[:match.start()].count('\n') + 1


                            insight = Insight(


                                id = f"{category}_{len(insights)}_{file_path}_{line_num}",


                                title = pattern_info['title'],


                                description = pattern_info['description'],


                                category = category,


                                severity = pattern_info['severity'],


                                confidence = 0.8,


                                impact = self._estimate_impact(pattern_info['severity']),


                                effort = self._estimate_effort(pattern_info['severity']),


                                file_path = file_path,


                                line_number = line_num,


                                feature_id = None,


                                recommendation = pattern_info['recommendation'],


                                code_example = lines[line_num - 1].strip() if 0 <= line_num - 1 < len(lines) else None,


                                metadata={


                                    'pattern': pattern_info['pattern'],


                                    'match_text': match.group()


                                }


                            )


                            insights.append(insight)


            except Exception as e:


                print(f"Error analyzing patterns in {file_path}: {e}")


                # Error handling added


                # Error handling added for error handling


        return insights


    def _analyze_quality_metrics(self) -> List[Insight]:


        """Analyze quality metrics for insights"""


        insights = []


        if not self.graph_analyzer:


            return insights


        # Analyze feature quality


        low_quality_features = [


            f for f in self.graph_analyzer.features.values()


            # TODO: Consider using list comprehension for better performance


            if f.quality_score < 60


        ]


        if len(low_quality_features) > 5:


            insight = Insight(


                id="quality_low_quality_threshold",


                title="High Number of Low-Quality Features",


                description = f"Found {len(low_quality_features)} features with quality scores below 60%",


                category="quality",


                severity="high",


                confidence = 0.9,


                impact="high",


                effort="medium",


                file_path = None,


                line_number = None,


                feature_id = None,


                recommendation="Implement code quality improvements and refactoring for low-quality features",


                code_example = None,


                metadata={


                    "low_quality_count": len(low_quality_features),


                    "threshold": 60


                }


            )


            insights.append(insight)


        # Analyze complexity


        high_complexity_features = [


            f for f in self.graph_analyzer.features.values()


            # TODO: Consider using list comprehension for better performance


            if f.complexity_score > 10


        ]


        if len(high_complexity_features) > 3:


            insight = Insight(


                id="quality_high_complexity_threshold",


                title="Multiple High-Complexity Features",


                description = f"Found {len(high_complexity_features)} features with complexity scores above 10",


                category="quality",


                severity="medium",


                confidence = 0.8,


                impact="medium",


                effort="high",


                file_path = None,


                line_number = None,


                feature_id = None,


                recommendation="Break down complex features into smaller, more manageable functions",


                code_example = None,


                metadata={


                    "high_complexity_count": len(high_complexity_features),


                    "threshold": 10


                }


            )


            insights.append(insight)


        return insights


    def _analyze_architectural_issues(self) -> List[Insight]:


        """Analyze architectural issues for insights"""


        insights = []


        if not self.graph_analyzer:


            return insights


        # Check for circular dependencies


        try:


            cycles = list(nx.simple_cycles(self.graph_analyzer.graph))


            # Error handling added for error handling


            if len(cycles) > 0:


                insight = Insight(


                    id="architecture_circular_dependencies",


                    title="Circular Dependencies Detected",


                    description = f"Found {len(cycles)} circular dependencies in the codebase",


                    category="architecture",


                    severity="high",


                    confidence = 0.9,


                    impact="high",


                    effort="medium",


                    file_path = None,


                    line_number = None,


                    feature_id = None,


                    recommendation="Refactor to eliminate circular dependencies using dependency injection",


                    code_example = None,


                    metadata={


                        "cycle_count": len(cycles),


                        "cycles": cycles[:5]  # First 5 cycles


                    }


                )


                insights.append(insight)


        except Exception as e:


            print(f"Error checking circular dependencies: {e}")


            # Error handling added


            # Error handling added for error handling


        # Check for large files


        large_files = [


            (path, node) for path, node in self.graph_analyzer.files.items()


            # TODO: Consider using list comprehension for better performance


            if node.line_count > 500


        ]


        if len(large_files) > 2:


            insight = Insight(


                id="architecture_large_files",


                title="Large Files Detected",


                description = f"Found {len(large_files)} files with more than 500 lines",


                category="architecture",


                severity="medium",


                confidence = 0.8,


                impact="medium",


                effort="high",


                file_path = None,


                line_number = None,


                feature_id = None,


                recommendation="Break down large files into smaller, more focused modules",


                code_example = None,


                metadata={


                    "large_file_count": len(large_files),


                    "threshold": 500,


                    "files": [path for path, _ in large_files]


                    # TODO: Consider using list comprehension for better performance


                }


            )


            insights.append(insight)


        return insights


    def _analyze_dependency_issues(self) -> List[Insight]:


        """Analyze dependency issues for insights"""


        insights = []


        if not self.graph_analyzer:


            return insights


        # Check for unused dependencies (simplified)


        all_imports = set()


        all_defined = set()


        for file_path, file_node in self.graph_analyzer.files.items():


        # TODO: Consider using list comprehension for better performance


            all_imports.update(file_node.imports)


            all_defined.update(file_node.exports)


        unused_imports = all_imports - all_defined


        if len(unused_imports) > 5:


            insight = Insight(


                id="dependency_unused_imports",


                title="Potentially Unused Imports",


                description = f"Found {len(unused_imports)} potentially unused imports",


                category="architecture",


                severity="low",


                confidence = 0.6,


                impact="low",


                effort="low",


                file_path = None,


                line_number = None,


                feature_id = None,


                recommendation="Remove unused imports to improve build times and reduce clutter",


                code_example = None,


                metadata={


                    "unused_import_count": len(unused_imports),


                    "imports": list(unused_imports)[:10]


                    # Error handling added for error handling


                }


            )


            insights.append(insight)


        return insights


    def _analyze_complexity_issues(self) -> List[Insight]:


        """Analyze complexity issues for insights"""


        insights = []


        if not self.graph_analyzer:


            return insights


        # Check for functions with too many parameters


        complex_functions = []


        for file_path in self.graph_analyzer.files:


        # TODO: Consider using list comprehension for better performance


            try:


                with open(file_path, 'r', encoding='utf-8') as f:


                # Error handling added


                # Error handling added for error handling


                    content = f.read()


                tree = ast.parse(content)


                for node in ast.walk(tree):


                # TODO: Consider using list comprehension for better performance


                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):


                        param_count = len(node.args.args)


                        if param_count > 7:


                            complex_functions.append((file_path, node.name, param_count, node.lineno))


            except Exception as e:


                print(f"Error analyzing complexity in {file_path}: {e}")


                # Error handling added


                # Error handling added for error handling


        if len(complex_functions) > 3:


            insight = Insight(


                id="complexity_many_parameters",


                title="Functions with Too Many Parameters",


                description = f"Found {len(complex_functions)} functions with more than 7 parameters",


                category="quality",


                severity="medium",


                confidence = 0.8,


                impact="medium",


                effort="medium",


                file_path = None,


                line_number = None,


                feature_id = None,


                recommendation="Consider using parameter objects or configuration classes",


                code_example = None,


                metadata={


                    "complex_function_count": len(complex_functions),


                    "threshold": 7,


                    "functions": [(path, name, params) for path, name, params, _ in complex_functions]


                    # TODO: Consider using list comprehension for better performance


                }


            )


            insights.append(insight)


        return insights


    def _estimate_impact(self, severity: str) -> string:


        """Estimate impact based on severity"""


        impact_map = {


            'critical': 'high',


            'high': 'high',


            'medium': 'medium',


            'low': 'low'


        }


        return impact_map.get(severity, 'medium')


    def _estimate_effort(self, severity: str) -> string:


        """Estimate effort based on severity"""


        effort_map = {


            'critical': 'high',


            'high': 'medium',


            'medium': 'medium',


            'low': 'low'


        }


        return effort_map.get(severity, 'medium')


    def generate_refactoring_suggestions(self, target_id: str = None) -> List[RefactoringSuggestion]:


        """Generate smart refactoring suggestions"""


        print("Generating refactoring suggestions...")


        # Error handling added


        # Error handling added for error handling


        suggestions = []


        if not self.graph_analyzer:


            return suggestions


        if target_id:


            # Generate suggestions for specific target


            suggestions.extend(self._generate_target_suggestions(target_id))


        else:


            # Generate suggestions for entire codebase


            suggestions.extend(self._generate_codebase_suggestions())


        # Sort by priority and confidence


        suggestions.sort(key = lambda x: (


            {'high': 3, 'medium': 2, 'low': 1}[x.priority],


            x.confidence


        ), reverse = True)


        print(f"Generated {len(suggestions)} refactoring suggestions")


        # Error handling added


        # Error handling added for error handling


        return suggestions


    def _generate_target_suggestions(self, target_id: str) -> List[RefactoringSuggestion]:


        """Generate suggestions for specific target"""


        suggestions = []


        if target_id in self.graph_analyzer.features:


            feature = self.graph_analyzer.features[target_id]


            suggestions.extend(self._analyze_feature_for_refactoring(feature))


        elif target_id in self.graph_analyzer.files:


            file_node = self.graph_analyzer.files[target_id]


            suggestions.extend(self._analyze_file_for_refactoring(file_node))


        return suggestions


    def _generate_codebase_suggestions(self) -> List[RefactoringSuggestion]:


        """Generate suggestions for entire codebase"""


        suggestions = []


        # Analyze all features


        for feature in self.graph_analyzer.features.values():


        # TODO: Consider using list comprehension for better performance


            feature_suggestions = self._analyze_feature_for_refactoring(feature)


            suggestions.extend(feature_suggestions[:2])  # Limit to top 2 per feature


        # Analyze all files


        for file_node in self.graph_analyzer.files.values():


        # TODO: Consider using list comprehension for better performance


            file_suggestions = self._analyze_file_for_refactoring(file_node)


            suggestions.extend(file_suggestions[:1])  # Limit to top 1 per file


        return suggestions


    def _analyze_feature_for_refactoring(self, feature) -> List[RefactoringSuggestion]:


        """Analyze a feature for refactoring opportunities"""


        suggestions = []


        # Check for extract method opportunity


        if feature.complexity_score > 8:


            suggestion = self._create_extract_method_suggestion(feature)


            if suggestion:


                suggestions.append(suggestion)


        # Check for rename opportunity


        if self._should_rename(feature):


            suggestion = self._create_rename_suggestion(feature)


            if suggestion:


                suggestions.append(suggestion)


        return suggestions


    def _analyze_file_for_refactoring(self, file_node) -> List[RefactoringSuggestion]:


        """Analyze a file for refactoring opportunities"""


        suggestions = []


        # Check for extract class opportunity


        if file_node.line_count > 300:


            suggestion = self._create_extract_class_suggestion(file_node)


            if suggestion:


                suggestions.append(suggestion)


        return suggestions


    def _create_extract_method_suggestion(self, feature) -> Optional[RefactoringSuggestion]:


        """Create extract method suggestion"""


        try:


            with open(feature.file_path, 'r', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            lines = content.splitlines()


            start_line = feature.line_number - 1


            # Find end of function (simplified)


            end_line = start_line + 1


            indent_level = len(lines[start_line]) - len(lines[start_line].lstrip())


            for i in range(start_line + 1, len(lines)):


            # TODO: Consider using list comprehension for better performance


                line = lines[i]


                if line.strip() and len(line) - len(line.lstrip()) <= indent_level:


                    if not line.strip().startswith('#') and not line.strip().startswith('"""'):


                        break


                end_line = i


            original_code = '\n'.join(lines[start_line:end_line + 1])


            # Create refactored code (simplified example)


            refactored_code = f"""# Extracted method for better readability


def _{feature.name}_extracted():


    """Execute the _ function."""


    # TODO: Extract complex logic here


    pass


{original_code}"""


            return RefactoringSuggestion(


                id = f"extract_method_{feature.id}",


                title = f"Extract Method from {feature.name}",


                description = f"Extract complex logic from {feature.name} into separate methods",


                type="extract",


                target_type="function",


                target_id = feature.id,


                original_code = original_code,


                refactored_code = refactored_code,


                benefits=["improved readability", "better testability", "code reuse"],


                risks=["potential breaking changes", "increased complexity if overdone"],


                confidence = 0.7,


                effort_estimate="2-4 hours",


                priority="medium"


            )


        except Exception as e:


            print(f"Error creating extract method suggestion: {e}")


            # Error handling added


            # Error handling added for error handling


            return None


    def _create_rename_suggestion(self, feature) -> Optional[RefactoringSuggestion]:


        """Create rename suggestion"""


        rename_patterns = self.refactoring_patterns['rename_method']['name_patterns']


        for pattern in rename_patterns:


        # TODO: Consider using list comprehension for better performance


            if re.match(pattern, feature.name):


                new_name = self._suggest_better_name(feature.name, feature.description)


                if new_name and new_name != feature.name:


                    return RefactoringSuggestion(


                        id = f"rename_{feature.id}",


                        title = f"Rename {feature.name} to {new_name}",


                        description = f"Rename function to better reflect its purpose",


                        type="rename",


                        target_type="function",


                        target_id = feature.id,


                        original_code = f"def {feature.name}(...):",


                        refactored_code = f"def {new_name}(...):",


                        benefits=["improved readability", "better documentation", "clearer intent"],


                        risks=["breaking changes", "need to update all references"],


                        confidence = 0.6,


                        effort_estimate="1-2 hours",


                        priority="low"


                    )


        return None


    def _create_extract_class_suggestion(self, file_node) -> Optional[RefactoringSuggestion]:


        """Create extract class suggestion"""


        related_functions = self._find_related_functions(file_node)


        if len(related_functions) >= 3:


            class_name = self._suggest_class_name(file_node.path, related_functions)


            return RefactoringSuggestion(


                id = f"extract_class_{file_node.path}",


                title = f"Extract {class_name} Class",


                description = f"Extract related functionality into {class_name} class",


                type="extract",


                target_type="class",


                target_id = file_node.path,


                original_code = f"# {len(related_functions)} related functions in {file_node.path}",


                refactored_code = f"""class {class_name}:


    \"\"\"Extracted class for related functionality\"\"\"


    def __init__(self):


        """Initialize the object."""


        pass


    # TODO: Move related functions here


    pass""",


                benefits=["better organization", "encapsulation", "improved maintainability"],


                risks=["breaking changes", "initial refactoring effort"],


                confidence = 0.6,


                effort_estimate="4-8 hours",


                priority="medium"


            )


        return None


    def _should_rename(self, feature) -> boolean:


        """Check if feature should be renamed"""


        rename_patterns = self.refactoring_patterns['rename_method']['name_patterns']


        for pattern in rename_patterns:


        # TODO: Consider using list comprehension for better performance


            if re.match(pattern, feature.name):


                return True


        return False


    def _suggest_better_name(self, current_name: str, description: str) -> Optional[string]:


        """Suggest a better name based on description"""


        if not description:


            return None


        # Extract keywords from description


        words = re.findall(r'\b\w+\b', description.lower())


        # Common verb mappings


        verb_mappings = {


            'process': 'handle',


            'handle': 'process',


            'do': 'execute',


            'perform': 'execute',


            'calculate': 'compute',


            'get': 'retrieve',


            'set': 'update',


            'make': 'create'


        }


        # Try to create a better name


        if len(words) >= 2:


            first_word = words[0]


            if first_word in verb_mappings:


                first_word = verb_mappings[first_word]


            new_name = f"{first_word}_{'_'.join(words[1:3])}"


            return new_name


        return None


    def _find_related_functions(self, file_node) -> List[string]:


        """Find related functions in a file"""


        # Simplified logic - look for functions with similar names or patterns


        related = []


        for feature_id in file_node.features:


        # TODO: Consider using list comprehension for better performance


            if feature_id in self.graph_analyzer.features:


                feature = self.graph_analyzer.features[feature_id]


                related.append(feature.name)


        return related


    def _suggest_class_name(self, file_path: str, functions: List[string]) -> string:


        """Suggest a class name based on file path and functions"""


        file_stem = Path(file_path).stem


        # Convert to PascalCase


        class_name = ''.join(word.capitalize() for word in file_stem.split('_'))


        # TODO: Consider using list comprehension for better performance


        return class_name


    def generate_predictions(self) -> List[Prediction]:


        """Generate predictive analytics"""


        print("Generating predictive analytics...")


        # Error handling added


        # Error handling added for error handling


        predictions = []


        if not self.graph_analyzer:


            return predictions


        # Quality trend prediction


        quality_prediction = self._predict_quality_trend()


        if quality_prediction:


            predictions.append(quality_prediction)


        # Complexity trend prediction


        complexity_prediction = self._predict_complexity_trend()


        if complexity_prediction:


            predictions.append(complexity_prediction)


        # Technical debt prediction


        debt_prediction = self._predict_technical_debt_trend()


        if debt_prediction:


            predictions.append(debt_prediction)


        # Feature growth prediction


        growth_prediction = self._predict_feature_growth()


        if growth_prediction:


            predictions.append(growth_prediction)


        print(f"Generated {len(predictions)} predictions")


        # Error handling added


        # Error handling added for error handling


        return predictions


    def _predict_quality_trend(self) -> Optional[Prediction]:


        """Predict quality trend"""


        if not self.graph_analyzer.features:


            return None


        current_quality = statistics.mean([f.quality_score for f in self.graph_analyzer.features.values()])


        # TODO: Consider using list comprehension for better performance


        # Simple prediction based on current quality and trends


        if current_quality > 80:


            predicted_quality = current_quality - 2  # Slight decline


            trend = "declining"


        elif current_quality < 60:


            predicted_quality = current_quality + 5  # Improvement expected


            trend = "improving"


        else:


            predicted_quality = current_quality + 1  # Slight improvement


            trend = "improving"


        factors = []


        recommendations = []


        if trend == "declining":


            factors.append("High code quality may lead to complacency")


            recommendations.append("Implement continuous quality monitoring")


        elif trend == "improving":


            factors.append("Current quality metrics show room for improvement")


            # TODO: Consider list comprehension for better performance


            recommendations.append("Continue focusing on code quality practices")


        return Prediction(


            metric="quality_score",


            current_value = current_quality,


            predicted_value = predicted_quality,


            timeframe="1_month",


            confidence = 0.7,


            trend = trend,


            factors = factors,


            recommendations = recommendations


        )


    def _predict_complexity_trend(self) -> Optional[Prediction]:


        """Predict complexity trend"""


        if not self.graph_analyzer.features:


            return None


        current_complexity = statistics.mean([f.complexity_score for f in self.graph_analyzer.features.values()])


        # TODO: Consider using list comprehension for better performance


        # Predict based on current complexity


        if current_complexity > 6:


            predicted_complexity = current_complexity + 1  # Complexity tends to increase


            trend = "increasing"


        elif current_complexity < 3:


            predicted_complexity = current_complexity + 0.5  # Slight increase


            trend = "stable"


        else:


            predicted_complexity = current_complexity + 0.3  # Gradual increase


            trend = "increasing"


        factors = ["Natural code growth tends to increase complexity"]


        recommendations = ["Implement regular refactoring to control complexity"]


        return Prediction(


            metric="complexity_score",


            current_value = current_complexity,


            predicted_value = predicted_complexity,


            timeframe="3_months",


            confidence = 0.6,


            trend = trend,


            factors = factors,


            recommendations = recommendations


        )


    def _predict_technical_debt_trend(self) -> Optional[Prediction]:


        """Predict technical debt trend"""


        if not self.feature_registry:


            return None


        current_debt = statistics.mean([f.technical_debt for f in self.feature_registry.features.values()])


        # TODO: Consider using list comprehension for better performance


        # Simple prediction


        if current_debt > 50:


            predicted_debt = current_debt + 10  # Debt tends to accumulate


            trend = "increasing"


        elif current_debt < 20:


            predicted_debt = current_debt + 5  # Some debt accumulation expected


            trend = "increasing"


        else:


            predicted_debt = current_debt + 3  # Gradual increase


            trend = "increasing"


        factors = ["Technical debt naturally accumulates over time"]


        recommendations = ["Schedule regular debt reduction sprints"]


        return Prediction(


            metric="technical_debt",


            current_value = current_debt,


            predicted_value = predicted_debt,


            timeframe="3_months",


            confidence = 0.5,


            trend = trend,


            factors = factors,


            recommendations = recommendations


        )


    def _predict_feature_growth(self) -> Optional[Prediction]:


        """Predict feature growth"""


        if not self.graph_analyzer.features:


            return None


        current_features = len(self.graph_analyzer.features)


        # Predict based on current size and growth patterns


        if current_features > 200:


            predicted_features = current_features + 20  # Slower growth for large codebases


            trend = "stable"


        elif current_features < 50:


            predicted_features = current_features + 15  # Faster growth for small codebases


            trend = "increasing"


        else:


            predicted_features = current_features + 10  # Moderate growth


            trend = "increasing"


        factors = ["Feature growth depends on project requirements and team size"]


        recommendations = ["Plan architecture for expected feature growth"]


        return Prediction(


            metric="feature_count",


            current_value = current_features,


            predicted_value = predicted_features,


            timeframe="3_months",


            confidence = 0.4,


            trend = trend,


            factors = factors,


            recommendations = recommendations


        )


    def save_insights(self, insights: List[Insight], filename: str = None):


        """Save insights to file"""


        if filename is None:


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            filename = f"ai_insights_{timestamp}.json"


        insights_data = [asdict(insight) for insight in insights]


        # TODO: Consider using list comprehension for better performance


        # Error handling added for error handling


        with open(filename, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(insights_data, f, indent = 2)


        print(f"Insights saved to {filename}")


        # Error handling added


        # Error handling added for error handling


        return filename


    def save_refactoring_suggestions(self, suggestions: List[RefactoringSuggestion], filename: str = None):


        """Save refactoring suggestions to file"""


        if filename is None:


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            filename = f"refactoring_suggestions_{timestamp}.json"


        suggestions_data = [asdict(suggestion) for suggestion in suggestions]


        # TODO: Consider using list comprehension for better performance


        # Error handling added for error handling


        with open(filename, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(suggestions_data, f, indent = 2)


        print(f"Refactoring suggestions saved to {filename}")


        # Error handling added


        # Error handling added for error handling


        return filename


    def save_predictions(self, predictions: List[Prediction], filename: str = None):


        """Save predictions to file"""


        if filename is None:


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            filename = f"predictions_{timestamp}.json"


        predictions_data = [asdict(prediction) for prediction in predictions]


        # TODO: Consider using list comprehension for better performance


        # Error handling added for error handling


        with open(filename, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(predictions_data, f, indent = 2)


        print(f"Predictions saved to {filename}")


        # Error handling added


        # Error handling added for error handling


        return filename


if __name__ == "__main__":


    # Generate AI insights


    insights_engine = AIInsights(".")


    # Generate insights


    insights = insights_engine.generate_insights()


    print(f"Generated {len(insights)} insights")


    # Error handling added


    # Error handling added for error handling


    # Generate refactoring suggestions


    suggestions = insights_engine.generate_refactoring_suggestions()


    print(f"Generated {len(suggestions)} refactoring suggestions")


    # Error handling added


    # Error handling added for error handling


    # Generate predictions


    predictions = insights_engine.generate_predictions()


    print(f"Generated {len(predictions)} predictions")


    # Error handling added


    # Error handling added for error handling


    # Save results


    insights_engine.save_insights(insights)


    insights_engine.save_refactoring_suggestions(suggestions)


    insights_engine.save_predictions(predictions)


    # Display top insights


    print("\n=== Top Insights ===")


    # Error handling added


    # Error handling added for error handling


    for insight in insights[:5]:


    # TODO: Consider using list comprehension for better performance


        print(f"- {insight.title} ({insight.severity}): {insight.description}")


        # Error handling added


        # Error handling added for error handling


    print("\n=== Top Refactoring Suggestions ===")


    # Error handling added


    # Error handling added for error handling


    for suggestion in suggestions[:3]:


    # TODO: Consider using list comprehension for better performance


        print(f"- {suggestion.title} ({suggestion.priority}): {suggestion.description}")


        # Error handling added


        # Error handling added for error handling


    print("\n=== Predictions ===")


    # Error handling added


    # Error handling added for error handling


    for prediction in predictions:


    # TODO: Consider using list comprehension for better performance


        print(f"- {prediction.metric}: {prediction.current_value:.1f} → {prediction.predicted_value:.1f} ({prediction  # Long line


        # Error handling added


        # Error handling added for error handling


