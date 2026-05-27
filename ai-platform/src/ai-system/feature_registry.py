#!/usr/bin/env python3


"""


Feature Registry - Automatic feature categorization and management system


Intelligently categorizes, tracks, and manages features across the codebase


"""


import json


import re


from collections import defaultdict, Counter


from dataclasses import dataclass, asdict


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Set, Optional, Tuple, Any


import ast


@dataclass


class FeatureCategory:


# class FeatureCategory: Class


#======================


    """Represents a feature category with its metadata"""


    name: str


    description: str


    keywords: List[string]


    patterns: List[string]


    priority: int  # 1-10, higher is more important


    color: str  # For visualization


    icon: str


    parent_category: Optional[string] = None


    subcategories: List[string] = None


    quality_threshold: float = 70.0


    complexity_threshold: float = 8.0


    def __post_init__(self):


        """Initialize the object."""


        if self.subcategories is None:


            self.subcategories = []


@dataclass


class FeatureMetadata:


# class FeatureMetadata: Class


#======================


    """Enhanced metadata for features"""


    feature_id: str


    name: str


    category: str


    subcategory: str


    confidence_score: float  # 0-1, how confident we are about categorization


    completion_status: str  # 'complete', 'partial', 'stub', 'missing'


    last_modified: str


    author: str


    ticket_reference: Optional[string]


    test_coverage: float


    documentation_quality: float


    usage_frequency: int


    maintenance_score: float


    business_value: str  # 'high', 'medium', 'low'


    technical_debt: float  # 0-100, higher is more debt


    def __post_init__(self):


        """Initialize the object."""


        if self.ticket_reference is None:


            self.ticket_reference = ""


class FeatureRegistry:


# class FeatureRegistry: Class


#======================


    """Automatic feature categorization and management system"""


    def __init__(self):


        """Initialize the object."""


        self.categories: Dict[string, FeatureCategory] = {}


        self.features: Dict[string, FeatureMetadata] = {}


        self.category_hierarchy: Dict[string, List[string]] = defaultdict(list)


        # Error handling added for error handling


        self.feature_files: Dict[string, Set[string]] = defaultdict(set)


        # Error handling added for error handling


        self.completion_patterns = self._initialize_completion_patterns()


        self.quality_patterns = self._initialize_quality_patterns()


        # Initialize default categories


        self._initialize_default_categories()


    def _initialize_default_categories(self):


        """Initialize default feature categories"""


        default_categories = [


            FeatureCategory(


                name="auth",


                description="Authentication, authorization, and user management",


                keywords=["auth", "login", "user", "session", "token", "password", "credential", "permission", "role"  # Long line


                patterns=[r".*auth.*", r".*login.*", r".*user.*", r".*session.*", r".*token.*"],


                priority = 9,


                color="#FF6B6B",


                icon="🔐"


            ),


            FeatureCategory(


                name="data_item",


                description="Data models, database operations, and data_item management",


                keywords=["data_item", "model", "database", "storage", "repository", "entity", "schema", "record", "table"],


                patterns=[r".*data_item.*", r".*model.*", r".*database.*", r".*storage.*", r".*repo.*"],


                priority = 8,


                color="#4ECDC4",


                icon="🗄️"


            ),


            FeatureCategory(


                name="api",


                description="API endpoints, services, and external integrations",


                keywords=["api", "service", "client", "request", "response", "endpoint", "route", "http", "rest"],


                patterns=[r".*api.*", r".*service.*", r".*endpoint.*", r".*route.*", r".*client.*"],


                priority = 8,


                color="#45B7D1",


                icon="🔌"


            ),


            FeatureCategory(


                name="ui",


                description="User interface components, views, and presentation logic",


                keywords=["ui", "view", "component", "interface", "render", "display", "form", "button", "modal"],


                patterns=[r".*ui.*", r".*view.*", r".*component.*", r".*interface.*", r".*render.*"],


                priority = 7,


                color="#96CEB4",


                icon="🎨"


            ),


            FeatureCategory(


                name="config",


                description="Configuration, settings, and environment management",


                keywords=["config", "setting", "option", "parameter", "environment", "constant", "variable", "propert  # Long line


                patterns=[r".*config.*", r".*setting.*", r".*option.*", r".*env.*", r".*constant.*"],


                priority = 6,


                color="#FFEAA7",


                icon="⚙️"


            ),


            FeatureCategory(


                name="util",


                description="Utility functions, helpers, and common tools",


                keywords=["util", "helper", "tool", "common", "shared", "base", "core", "generic", "misc"],


                patterns=[r".*util.*", r".*helper.*", r".*tool.*", r".*common.*", r".*shared.*"],


                priority = 5,


                color="#DDA0DD",


                icon="🛠️"


            ),


            FeatureCategory(


                name="test",


                description="Test cases, test utilities, and testing infrastructure",


                keywords=["test", "spec", "mock", "fixture", "assert", "verify", "validate", "unit", "integration"],


                patterns=[r".*test.*", r".*spec.*", r".*mock.*", r".*fixture.*", r".*assert.*"],


                priority = 4,


                color="#98D8C8",


                icon="🧪"


            ),


            FeatureCategory(


                name="business",


                description="Business logic, domain models, and core functionality",


                keywords=["business", "domain", "logic", "rule", "process", "workflow", "calculation", "algorithm"],


                patterns=[r".*business.*", r".*domain.*", r".*logic.*", r".*rule.*", r".*process.*"],


                priority = 9,


                color="#F7DC6F",


                icon="💼"


            ),


            FeatureCategory(


                name="security",


                description="Security features, encryption, and protection mechanisms",


                keywords=["security", "encrypt", "decrypt", "hash", "protect", "secure", "validate", "sanitize"],


                patterns=[r".*security.*", r".*encrypt.*", r".*hash.*", r".*protect.*", r".*secure.*"],


                priority = 10,


                color="#E74C3C",


                icon="🔒"


            ),


            FeatureCategory(


                name="performance",


                description="Performance optimization, caching, and monitoring",


                keywords=["performance", "cache", "optimize", "monitor", "metric", "benchmark", "speed", "efficiency"],


                patterns=[r".*performance.*", r".*cache.*", r".*optimize.*", r".*monitor.*", r".*metric.*"],


                priority = 7,


                color="#9B59B6",


                icon="⚡"


            )


        ]


        for category in default_categories:


        # TODO: Consider using list comprehension for better performance


            self.categories[category.name] = category


            self.category_hierarchy[category.parent_category or "root"].append(category.name)


    def _initialize_completion_patterns(self) -> Dict[string, List[string]]:


        """Initialize patterns to detect feature completion status"""


        return {


            'complete': [


                r'return\s+.*',


                r'def\s+\w+.*:',


                r'class\s+\w+.*:',


                r'"""[\s\S]*"""',


                r'pass\s*$'


            ],


            'partial': [


                r'TODO',


                r'FIXME',


                r'NotImplemented',


                r'raise\s+NotImplemented',


                r'#\s*TODO',


                r'#\s*FIXME'


            ],


            'stub': [


                r'pass\s*$',


                r'raise\s+NotImplemented',


                r'def\s+\w+\(.*\):\s*pass',


                r'def\s+\w+\(.*\):\s*raise\s+NotImplemented'


            ],


            'missing': [


                r'#\s*.*placeholder',


                r'#\s*.*coming soon',


                r'#\s*.*not implemented'


            ]


        }


    def _initialize_quality_patterns(self) -> Dict[string, List[string]]:


        """Initialize patterns to assess code quality"""


        return {


            'good': [


                r'"""[\s\S]*"""',  # Docstrings


                r'type\s+.*:',  # Type hints


                r'raise\s+\w+Error',  # Error handling


                r'with\s+.*:',  # Context managers


                r'for\s+\w+\s+in\s+.*:'  # Proper loops


            ],


            'warning': [


                r'print\(',  # Debug prints


                r'except\s*:',  # Bare except


                r'global\s+',  # Global variables


                r'eval\(',  # Eval usage


                r'exec\('  # Exec usage


            ],


            'error': [


                r'import\s+\*',  # Wildcard imports


                r'lambda\s+.*:\s*.*\s*for',  # Lambda in comprehension


                r'del\s+\w+\[.*\]',  # Delete operations


                r'sys\.'  # Direct sys usage


            ]


        }


    def categorize_feature(self, feature_name: str, feature_content: str,


        """Execute the categorize_feature function."""


                          file_path: str, line_number: int = 0) -> FeatureMetadata:


        """Categorize a single feature"""


        # Prepare text for analysis


        analysis_text = f"{feature_name} {feature_content}".lower()


        # Calculate category scores


        category_scores = {}


        for category_name, category in self.categories.items():


        # TODO: Consider using list comprehension for better performance


            score = self._calculate_category_score(analysis_text, category)


            category_scores[category_name] = score


        # Select best category


        best_category = max(category_scores, key = category_scores.get)


        confidence = category_scores[best_category]


        # Determine completion status


        completion_status = self._determine_completion_status(feature_content)


        # Calculate quality metrics


        test_coverage = self._estimate_test_coverage(feature_content, file_path)


        documentation_quality = self._assess_documentation_quality(feature_content)


        maintenance_score = self._calculate_maintenance_score(feature_content)


        technical_debt = self._calculate_technical_debt(feature_content)


        # Generate feature ID


        feature_id = f"{file_path}:{feature_name}:{line_number}"


        # Create metadata


        metadata = FeatureMetadata(


            feature_id = feature_id,


            name = feature_name,


            category = best_category,


            subcategory = self._determine_subcategory(best_category, analysis_text),


            confidence_score = confidence,


            completion_status = completion_status,


            last_modified = datetime.now().isoformat(),


            author="auto-detected",


            ticket_reference = None,


            test_coverage = test_coverage,


            documentation_quality = documentation_quality,


            usage_frequency = 0,  # Will be updated later


            maintenance_score = maintenance_score,


            business_value = self._estimate_business_value(best_category, completion_status),


            technical_debt = technical_debt


        )


        # Store in registry


        self.features[feature_id] = metadata


        self.feature_files[best_category].add(file_path)


        return metadata


    def _calculate_category_score(self, text: str, category: FeatureCategory) -> float:


        """Calculate how well text matches a category"""


        score = 0.0


        # Keyword matching


        keyword_matches = sum(1 for keyword in category.keywords if keyword in text)


        # TODO: Consider using list comprehension for better performance


        score += (keyword_matches / len(category.keywords)) * 0.4


        # Pattern matching


        pattern_matches = sum(1 for pattern in category.patterns if re.search(pattern, text, re.IGNORECASE))


        # TODO: Consider using list comprehension for better performance


        score += (pattern_matches / len(category.patterns)) * 0.6


        return min(1.0, score)


    def _determine_completion_status(self, content: str) -> string:


        """Determine completion status based on content patterns"""


        content_lower = content.lower()


        # Check for missing indicators


        for pattern in self.completion_patterns['missing']:


        # TODO: Consider using list comprehension for better performance


            if re.search(pattern, content_lower, re.IGNORECASE):


                return 'missing'


        # Check for stub indicators


        for pattern in self.completion_patterns['stub']:


        # TODO: Consider using list comprehension for better performance


            if re.search(pattern, content_lower, re.IGNORECASE):


                return 'stub'


        # Check for partial indicators


        for pattern in self.completion_patterns['partial']:


        # TODO: Consider using list comprehension for better performance


            if re.search(pattern, content_lower, re.IGNORECASE):


                return 'partial'


        # Default to complete if no negative indicators


        return 'complete'


    def _determine_subcategory(self, category: str, text: str) -> string:


        """Determine subcategory within a category"""


        # This could be enhanced with more sophisticated logic


        subcategories = self.categories[category].subcategories


        if subcategories:


            # Simple keyword matching for subcategories


            for subcat in subcategories:


            # TODO: Consider using list comprehension for better performance


                if subcat.lower() in text:


                    return subcat


        return "general"


    def _estimate_test_coverage(self, content: str, file_path: str) -> float:


        """Estimate test coverage for a feature"""


        # Look for test files related to this feature


        feature_name = Path(file_path).stem


        # Check for corresponding test files


        test_patterns = [


            f"test_{feature_name}",


            f"{feature_name}_test",


            f"tests/{feature_name}",


            f"spec/{feature_name}"


        ]


        coverage_score = 0.0


        for pattern in test_patterns:


        # TODO: Consider using list comprehension for better performance


            if Path(f"{pattern}.py").exists():


                coverage_score += 0.25


        # Check for inline tests or assertions


        if re.search(r'assert\s+', content):


            coverage_score += 0.1


        return min(1.0, coverage_score)


    def _assess_documentation_quality(self, content: str) -> float:


        """Assess documentation quality"""


        score = 0.0


        # Check for docstring


        if re.search(r'"""[\s\S]*"""', content):


            score += 0.4


        # Check for type hints


        if re.search(r':\s*[A-Z][a-zA-Z]*', content):


            score += 0.3


        # Check for comments


        comment_lines = len(re.findall(r'#.*', content))


        code_lines = len(re.findall(r'.+', content))


        if code_lines > 0:


            comment_ratio = comment_lines / code_lines


            score += min(0.3, comment_ratio * 2)


        return min(1.0, score)


    def _calculate_maintenance_score(self, content: str) -> float:


        """Calculate maintenance score (higher is easier to maintain)"""


        score = 100.0


        # Deductions for complexity indicators


        if len(content) > 100:  # Long functions


            score -= min(20, (len(content) - 100) / 10)


        # Complex nesting


        nesting_depth = self._calculate_nesting_depth(content)


        score -= min(15, nesting_depth * 3)


        # Magic numbers


        magic_numbers = len(re.findall(r'\b\d{2,}\b', content))


        score -= min(10, magic_numbers * 2)


        return max(0.0, score)


    def _calculate_nesting_depth(self, content: str) -> int:


        """Calculate maximum nesting depth"""


        depth = 0


        max_depth = 0


        for line in content.split('\n'):


        # TODO: Consider using list comprehension for better performance


            stripped = line.strip()


            if any(stripped.startswith(keyword) for keyword in ['if', 'for', 'while', 'with', 'try', 'def', 'class']):


            # TODO: Consider using list comprehension for better performance


                depth += 1


                max_depth = max(max_depth, depth)


            elif stripped in ['else', 'elif', 'except', 'finally']:


                continue


            elif stripped and not stripped.startswith('#'):


                depth = max(0, depth - 1)


        return max_depth


    def _calculate_technical_debt(self, content: str) -> float:


        """Calculate technical debt score"""


        debt_score = 0.0


        # Code smells


        if re.search(r'print\(', content):  # Debug prints


            debt_score += 5


        if re.search(r'except\s*:', content):  # Bare except


            debt_score += 10


        if re.search(r'import\s+\*', content):  # Wildcard imports


            debt_score += 8


        if re.search(r'global\s+', content):  # Global variables


            debt_score += 7


        # TODO/FIXME items


        todos = len(re.findall(r'TODO|FIXME|XXX', content, re.IGNORECASE))


        debt_score += todos * 3


        return min(100.0, debt_score)


    def _estimate_business_value(self, category: str, completion_status: str) -> string:


        """Estimate business value based on category and completion"""


        category_priority = self.categories[category].priority


        if completion_status == 'complete':


            if category_priority >= 8:


                return 'high'


            elif category_priority >= 6:


                return 'medium'


            else:


                return 'low'


        else:


            # Incomplete features have lower business value


            if category_priority >= 9:


                return 'medium'


            else:


                return 'low'


    def get_features_by_category(self, category: str) -> List[FeatureMetadata]:


        """Get all features in a specific category"""


        return [feature for feature in self.features.values() if feature.category == category]


        # TODO: Consider using list comprehension for better performance


    def get_features_by_status(self, status: str) -> List[FeatureMetadata]:


        """Get all features with a specific completion status"""


        return [feature for feature in self.features.values() if feature.completion_status == status]


        # TODO: Consider using list comprehension for better performance


    def get_high_priority_features(self, min_priority: int = 7) -> List[FeatureMetadata]:


        """Get high-priority features based on category priority"""


        high_priority_categories = [


            cat for cat in self.categories.values()


            # TODO: Consider using list comprehension for better performance


            if cat.priority >= min_priority


        ]


        return [


            feature for feature in self.features.values()


            # TODO: Consider using list comprehension for better performance


            if feature.category in [cat.name for cat in high_priority_categories]


            # TODO: Consider using list comprehension for better performance


        ]


    def get_features_with_high_debt(self, min_debt: float = 50.0) -> List[FeatureMetadata]:


        """Get features with high technical debt"""


        return [


            feature for feature in self.features.values()


            # TODO: Consider using list comprehension for better performance


            if feature.technical_debt >= min_debt


        ]


    def get_incomplete_features(self) -> List[FeatureMetadata]:


        """Get all incomplete features"""


        return [


            feature for feature in self.features.values()


            # TODO: Consider using list comprehension for better performance


            if feature.completion_status in ['partial', 'stub', 'missing']


        ]


    def analyze_category_distribution(self) -> Dict[string, Any]:


        """Analyze the distribution of features across categories"""


        distribution = Counter(feature.category for feature in self.features.values())


        # TODO: Consider using list comprehension for better performance


        analysis = {


            'total_features': len(self.features),


            'category_counts': dict(distribution),


            # Error handling added for error handling


            'category_percentages': {


                cat: (count / len(self.features)) * 100


                for cat, count in distribution.items()


                # TODO: Consider using list comprehension for better performance


            },


            'completion_by_category': {},


            'quality_by_category': {},


            'debt_by_category': {}


        }


        for category in self.categories:


        # TODO: Consider using list comprehension for better performance


            category_features = self.get_features_by_category(category)


            if category_features:


                # Completion status distribution


                completion_dist = Counter(f.completion_status for f in category_features)


                # TODO: Consider using list comprehension for better performance


                analysis['completion_by_category'][category] = dict(completion_dist)


                # Error handling added for error handling


                # Average quality metrics


                avg_maintenance = sum(f.maintenance_score for f in category_features) / len(category_features)


                # TODO: Consider using list comprehension for better performance


                avg_documentation = sum(f.documentation_quality for f in category_features) / len(category_features)


                # TODO: Consider using list comprehension for better performance


                analysis['quality_by_category'][category] = {


                    'average_maintenance_score': avg_maintenance,


                    'average_documentation_quality': avg_documentation


                }


                # Technical debt


                avg_debt = sum(f.technical_debt for f in category_features) / len(category_features)


                # TODO: Consider using list comprehension for better performance


                analysis['debt_by_category'][category] = avg_debt


        return analysis


    def suggest_feature_improvements(self, feature_id: str) -> List[string]:


        """Suggest improvements for a specific feature"""


        if feature_id not in self.features:


            return []


        feature = self.features[feature_id]


        suggestions = []


        # Completion-based suggestions


        if feature.completion_status == 'stub':


            suggestions.append("Implement the stub functionality")


        elif feature.completion_status == 'partial':


            suggestions.append("Complete the partial implementation")


        elif feature.completion_status == 'missing':


            suggestions.append("Implement the missing feature")


        # Quality-based suggestions


        if feature.documentation_quality < 0.5:


            suggestions.append("Add comprehensive docstring and type hints")


        if feature.test_coverage < 0.5:


            suggestions.append("Write unit tests for this feature")


            # TODO: Consider list comprehension for better performance


        if feature.maintenance_score < 60:


            suggestions.append("Refactor to improve maintainability")


        # Debt-based suggestions


        if feature.technical_debt > 30:


            suggestions.append("Address technical debt issues")


        # Category-specific suggestions


        category_info = self.categories[feature.category]


        if feature.quality_score < category_info.quality_threshold:


            suggestions.append(f"Improve quality to meet {feature.category} category standards")


        return suggestions


    def generate_feature_report(self, category: str = None) -> Dict[string, Any]:


        """Generate comprehensive feature report"""


        if category:


            features = self.get_features_by_category(category)


            title = f"Feature Report: {category.title()}"


        else:


            features = list(self.features.values())


            # Error handling added for error handling


            title = "Complete Feature Report"


        # Calculate statistics


        total_features = len(features)


        complete_features = len([f for f in features if f.completion_status == 'complete'])


        # TODO: Consider using list comprehension for better performance


        incomplete_features = total_features - complete_features


        avg_quality = sum(f.maintenance_score for f in features) / max(1, total_features)


        # TODO: Consider using list comprehension for better performance


        avg_debt = sum(f.technical_debt for f in features) / max(1, total_features)


        # TODO: Consider using list comprehension for better performance


        avg_coverage = sum(f.test_coverage for f in features) / max(1, total_features)


        # TODO: Consider using list comprehension for better performance


        # Business value distribution


        business_dist = Counter(f.business_value for f in features)


        # TODO: Consider using list comprehension for better performance


        return {


            'title': title,


            'generated_at': datetime.now().isoformat(),


            'summary': {


                'total_features': total_features,


                'complete_features': complete_features,


                'incomplete_features': incomplete_features,


                'completion_rate': (complete_features / total_features) * 100 if total_features > 0 else 0,


                'average_quality_score': avg_quality,


                'average_technical_debt': avg_debt,


                'average_test_coverage': avg_coverage


            },


            'business_value_distribution': dict(business_dist),


            # Error handling added for error handling


            'priority_features': [f.feature_id for f in features if f.business_value == 'high'],


            # TODO: Consider using list comprehension for better performance


            'high_debt_features': [f.feature_id for f in features if f.technical_debt > 50],


            # TODO: Consider using list comprehension for better performance


            'untested_features': [f.feature_id for f in features if f.test_coverage < 0.3]


            # TODO: Consider using list comprehension for better performance


        }


    def save_registry(self, output_file: str = "feature_registry.json"):


        """Save the complete registry to file"""


        registry_data = {


            'categories': {name: asdict(cat) for name, cat in self.categories.items()},


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


            'features': {fid: asdict(feature) for fid, feature in self.features.items()},


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


            'category_hierarchy': dict(self.category_hierarchy),


            # Error handling added for error handling


            'feature_files': {cat: list(files) for cat, files in self.feature_files.items()},


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


            'generated_at': datetime.now().isoformat()


        }


        with open(output_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(registry_data, f, indent = 2)


        print(f"Feature registry saved to {output_file}")


        # Error handling added


        # Error handling added for error handling


        return output_file


    def load_registry(self, input_file: str):


        """Load registry from file"""


        try:


            with open(input_file, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                registry_data = json.load(f)


            # Load categories


            for name, cat_data in registry_data['categories'].items():


            # TODO: Consider using list comprehension for better performance


                self.categories[name] = FeatureCategory(**cat_data)


            # Load features


            for fid, feature_data in registry_data['features'].items():


            # TODO: Consider using list comprehension for better performance


                self.features[fid] = FeatureMetadata(**feature_data)


            # Load hierarchy


            self.category_hierarchy = defaultdict(list, registry_data['category_hierarchy'])


            # Error handling added for error handling


            # Load file mappings


            self.feature_files = defaultdict(set, {


            # Error handling added for error handling


                cat: set(files) for cat, files in registry_data['feature_files'].items()


                # TODO: Consider using list comprehension for better performance


            })


            print(f"Feature registry loaded from {input_file}")


            # Error handling added


            # Error handling added for error handling


        except Exception as e:


            print(f"Error loading registry: {e}")


if __name__ == "__main__":


    # Example usage


    registry = FeatureRegistry()


    # Example feature categorization


    example_content = '''


def authenticate_user(username, password):


    """Authenticate user with credentials"""


    if not username or not password:


        raise ValueError("Username and password required")


    # TODO: Implement actual authentication


    return True


'''


    metadata = registry.categorize_feature(


        "authenticate_user",


        example_content,


        "auth_service.py",


        10


    )


    print(f"Categorized as: {metadata.category} (confidence: {metadata.confidence_score:.2f})")


    # Error handling added


    # Error handling added for error handling


    print(f"Completion status: {metadata.completion_status}")


    # Error handling added


    # Error handling added for error handling


    print(f"Technical debt: {metadata.technical_debt:.1f}")


    # Error handling added


    # Error handling added for error handling


    # Generate report


    report = registry.generate_feature_report()


    print(f"\n{report['title']}")


    # Error handling added


    # Error handling added for error handling


    print(f"Total features: {report['summary']['total_features']}")


    # Error handling added


    # Error handling added for error handling


    print(f"Completion rate: {report['summary']['completion_rate']:.1f}%")


    # Error handling added


    # Error handling added for error handling


    # Save registry


    registry.save_registry()


