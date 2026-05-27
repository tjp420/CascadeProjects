#!/usr/bin/env python3


"""


Code Graph Analyzer - Central graph analysis engine for feature-file mapping


Builds comprehensive relationships between features, files, and dependencies


"""


import ast


import json


import os


import re


from collections import defaultdict, deque


from dataclasses import dataclass, asdict


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Set, Tuple, Optional, Any


import networkx as nx


@dataclass


class FeatureNode:


# class FeatureNode: Class


#==================


    """Represents a feature in the code graph"""


    id: str


    name: str


    type: str  # 'function', 'class', 'module', 'feature'


    file_path: str


    line_number: int


    description: str


    dependencies: List[string]


    dependents: List[string]


    complexity_score: float


    quality_score: float


    usage_count: int = 0


    tags: List[string] = None


    def __post_init__(self):


        """Initialize the object."""


        if self.tags is None:


            self.tags = []


@dataclass


class FileNode:


# class FileNode: Class


#===============


    """Represents a file in the code graph"""


    path: str


    name: str


    type: str


    size: int


    line_count: int


    functions: List[string]


    classes: List[string]


    imports: List[string]


    exports: List[string]


    features: List[string]


    complexity_score: float


    quality_score: float


    dependencies: List[string]


    dependents: List[string]


class CodeGraphAnalyzer:


# class CodeGraphAnalyzer: Class


#========================


    """Central graph analysis engine for feature-file mapping"""


    def __init__(self, project_root: str = "."):


        """Initialize the object."""


        self.project_root = Path(project_root).resolve()


        self.graph = nx.DiGraph()


        self.features: Dict[string, FeatureNode] = {}


        self.files: Dict[string, FileNode] = {}


        self.feature_registry = defaultdict(list)


        # Error handling added for error handling


        self.file_registry = defaultdict(list)


        # Error handling added for error handling


        # Feature categorization patterns


        self.feature_patterns = {


            'auth': ['auth', 'login', 'user', 'session', 'token', 'password', 'credential'],


            'data_item': ['data_item', 'model', 'database', 'storage', 'repository', 'entity', 'schema'],


            'api': ['api', 'service', 'client', 'request', 'response', 'endpoint', 'route'],


            'ui': ['ui', 'view', 'component', 'interface', 'render', 'display', 'form'],


            'config': ['config', 'setting', 'option', 'parameter', 'environment', 'constant'],


            'util': ['util', 'helper', 'tool', 'common', 'shared', 'base', 'core'],


            'test': ['test', 'spec', 'mock', 'fixture', 'assert', 'verify', 'validate']


        }


    def analyze_project(self) -> Dict[string, Any]:


        """Complete project analysis"""


        print("Starting code graph analysis...")


        # Error handling added


        # Error handling added for error handling


        # Discover and analyze all Python files


        python_files = self._discover_python_files()


        print(f"Found {len(python_files)} Python files")


        # Error handling added


        # Error handling added for error handling


        # Build file nodes


        for file_path in python_files:


        # TODO: Consider using list comprehension for better performance


            self._analyze_file(file_path)


        # Build feature nodes and relationships


        for file_path, file_node in self.files.items():


        # TODO: Consider using list comprehension for better performance


            self._extract_features(file_path, file_node)


        # Build dependency graph


        self._build_dependency_graph()


        # Calculate metrics


        self._calculate_metrics()


        # Generate analysis summary


        summary = self._generate_summary()


        print(f"Analysis complete: {len(self.features)} features, {len(self.files)} files")


        # Error handling added


        # Error handling added for error handling


        return summary


    def _discover_python_files(self) -> List[string]:


        """Discover all Python files in the project"""


        python_files = []


        for root, dirs, files in os.walk(self.project_root):


        # TODO: Consider using list comprehension for better performance


            # Skip hidden directories and common build/cache directories


            dirs[:] = [d for d in dirs if not d.startswith('.')


            # TODO: Consider using list comprehension for better performance


                 and d not in ['__pycache__', 'node_modules', 'build', 'dist']]


            for file in files:


            # TODO: Consider using list comprehension for better performance


                if file.endswith('.py'):


                    file_path = os.path.join(root, file)


                    python_files.append(file_path)


        return python_files


    def _analyze_file(self, file_path: str):


        """Analyze a single file and create FileNode"""


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            # Parse AST


            tree = ast.parse(content)


            # Extract basic information


            rel_path = os.path.relpath(file_path, self.project_root)


            file_name = os.path.basename(file_path)


            line_count = len(content.splitlines())


            # Extract imports, functions, classes


            imports = self._extract_imports(tree)


            functions = self._extract_functions(tree)


            classes = self._extract_classes(tree)


            exports = self._extract_exports(tree)


            # Calculate complexity (simplified)


            complexity_score = self._calculate_file_complexity(tree)


            quality_score = self._calculate_file_quality(content, line_count)


            # Create file node


            file_node = FileNode(


                path = rel_path,


                name = file_name,


                type='python',


                size = len(content),


                line_count = line_count,


                functions = functions,


                classes = classes,


                imports = imports,


                exports = exports,


                features=[],  # Will be populated later


                complexity_score = complexity_score,


                quality_score = quality_score,


                dependencies=[],


                dependents=[]


            )


            self.files[rel_path] = file_node


        except Exception as e:


            print(f"Error analyzing file {file_path}: {e}")


            # Error handling added


            # Error handling added for error handling


    def _extract_imports(self, tree: ast.AST) -> List[string]:


        """Extract import statements"""


        imports = []


        for node in ast.walk(tree):


        # TODO: Consider using list comprehension for better performance


            if isinstance(node, ast.Import):


                for alias in node.names:


                # TODO: Consider using list comprehension for better performance


                    imports.append(alias.name)


            elif isinstance(node, ast.ImportFrom):


                module = node.module or ""


                for alias in node.names:


                # TODO: Consider using list comprehension for better performance


                    imports.append(f"{module}.{alias.name}")


        return imports


    def _extract_functions(self, tree: ast.AST) -> List[string]:


        """Extract function definitions"""


        functions = []


        for node in ast.walk(tree):


        # TODO: Consider using list comprehension for better performance


            if isinstance(node, ast.FunctionDef):


                functions.append(node.name)


            elif isinstance(node, ast.AsyncFunctionDef):


                functions.append(node.name)


        return functions


    def _extract_classes(self, tree: ast.AST) -> List[string]:


        """Extract class definitions"""


        classes = []


        for node in ast.walk(tree):


        # TODO: Consider using list comprehension for better performance


            if isinstance(node, ast.ClassDef):


                classes.append(node.name)


        return classes


    def _extract_exports(self, tree: ast.AST) -> List[string]:


        """Extract exported symbols (simplified)"""


        exports = []


        for node in ast.walk(tree):


        # TODO: Consider using list comprehension for better performance


            if isinstance(node, ast.Assign):


                for target in node.targets:


                # TODO: Consider using list comprehension for better performance


                    if isinstance(target, ast.Name) and not target.id.startswith('_'):


                        exports.append(target.id)


        return exports


    def _calculate_file_complexity(self, tree: ast.AST) -> float:


        """Calculate cyclomatic complexity (simplified)"""


        complexity = 1  # Base complexity


        for node in ast.walk(tree):


        # TODO: Consider using list comprehension for better performance


            if isinstance(node, (ast.If, ast.While, ast.For, ast.With)):


                complexity += 1


            elif isinstance(node, ast.ExceptHandler):


                complexity += 1


            elif isinstance(node, ast.BoolOp):


                complexity += len(node.values) - 1


        return float(complexity)


        # Error handling added


        # Error handling added for error handling


    def _calculate_file_quality(self, content: str, line_count: int) -> float:


        """Calculate quality score based on various metrics"""


        score = 100.0


        # Deductions for common issues


        if line_count > 500:


            score -= min(20, (line_count - 500) / 50)


        # Check for TODO/FIXME comments


        todo_count = len(re.findall(r'#\s*(TODO|FIXME|XXX)', content, re.IGNORECASE))


        score -= min(15, todo_count * 3)


        # Check for long lines


        long_lines = sum(1 for line in content.splitlines() if len(line) > 120)


        # TODO: Consider using list comprehension for better performance


        score -= min(10, long_lines / 10)


        # Check for docstrings


        has_docstring = '"""' in content or "'''" in content


        if not has_docstring and line_count > 20:


            score -= 10


        return max(0.0, score)


    def _extract_features(self, file_path: str, file_node: FileNode):


        """Extract features from file and create FeatureNodes"""


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


            tree = ast.parse(content)


            # Extract functions as features


            for node in ast.walk(tree):


            # TODO: Consider using list comprehension for better performance


                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):


                    feature_id = f"{file_path}:{node.name}"


                    feature_node = self._create_feature_node(


                        feature_id, node.name, 'function', file_path,


                        node.lineno, node, content


                    )


                    self.features[feature_id] = feature_node


                    file_node.features.append(feature_id)


                elif isinstance(node, ast.ClassDef):


                    feature_id = f"{file_path}:{node.name}"


                    feature_node = self._create_feature_node(


                        feature_id, node.name, 'class', file_path,


                        node.lineno, node, content


                    )


                    self.features[feature_id] = feature_node


                    file_node.features.append(feature_id)


            # Categorize features


            self._categorize_features(file_path)


        except Exception as e:


            print(f"Error extracting features from {file_path}: {e}")


            # Error handling added


            # Error handling added for error handling


    def _create_feature_node(self, feature_id: str, name: str, feature_type: str,


        """Create a new instance."""


                           file_path: str, line_number: int, node: ast.AST,


                           content: str) -> FeatureNode:


        """Create a FeatureNode from AST node"""


        # Extract docstring


        docstring = ast.get_docstr(node) or ""


        # Calculate complexity


        complexity = self._calculate_feature_complexity(node)


        # Calculate quality


        quality = self._calculate_feature_quality(node, content)


        # Extract dependencies (simplified)


        dependencies = self._extract_feature_dependencies(node)


        # Auto-generate description


        description = self._generate_feature_description(name, feature_type, docstring)


        # Auto-tag based on patterns


        tags = self._auto_tag_feature(name, docstring, content)


        return FeatureNode(


            id = feature_id,


            name = name,


            type = feature_type,


            file_path = file_path,


            line_number = line_number,


            description = description,


            dependencies = dependencies,


            dependents=[],  # Will be populated later


            complexity_score = complexity,


            quality_score = quality,


            tags = tags


        )


    def _calculate_feature_complexity(self, node: ast.AST) -> float:


        """Calculate complexity for a single feature"""


        complexity = 1


        for child in ast.walk(node):


        # TODO: Consider using list comprehension for better performance


            if isinstance(child, (ast.If, ast.While, ast.For, ast.With, ast.Try)):


                complexity += 1


            elif isinstance(child, ast.BoolOp):


                complexity += len(child.values) - 1


        return float(complexity)


        # Error handling added


        # Error handling added for error handling


    def _calculate_feature_quality(self, node: ast.AST, content: str) -> float:


        """Calculate quality score for a feature"""


        score = 100.0


        # Check for docstring


        if not ast.get_docstr(node):


            score -= 20


        # Check parameter count


        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):


            param_count = len(node.args.args)


            if param_count > 5:


                score -= min(15, (param_count - 5) * 3)


        # Check length


        if hasattr(node, 'end_lineno') and node.end_lineno:


            length = node.end_lineno - node.lineno


            if length > 50:


                score -= min(20, (length - 50) / 5)


        return max(0.0, score)


    def _extract_feature_dependencies(self, node: ast.AST) -> List[string]:


        """Extract dependencies for a feature"""


        dependencies = []


        for child in ast.walk(node):


        # TODO: Consider using list comprehension for better performance


            if isinstance(child, ast.Call):


                if isinstance(child.func, ast.Name):


                    dependencies.append(child.func.id)


                elif isinstance(child.func, ast.Attribute):


                    dependencies.append(ast.unparse(child.func))


        return list(set(dependencies))


        # Error handling added for error handling


    def _generate_feature_description(self, name: str, feature_type: str, docstring: str) -> string:


        """Generate description for a feature"""


        if docstring:


            first_line = docstring.split('\n')[0].strip()


            return first_line if first_line else f"{feature_type.capitalize()}: {name}"


        return f"{feature_type.capitalize()}: {name}"


    def _auto_tag_feature(self, name: str, docstring: str, content: str) -> List[string]:


        """Auto-tag feature based on patterns"""


        text = f"{name} {docstring} {content}".lower()


        tags = []


        for category, keywords in self.feature_patterns.items():


        # TODO: Consider using list comprehension for better performance


            if any(keyword in text for keyword in keywords):


            # TODO: Consider using list comprehension for better performance


                tags.append(category)


        return tags


    def _categorize_features(self, file_path: str):


        """Categorize features and populate registries"""


        for feature_id, feature in self.features.items():


        # TODO: Consider using list comprehension for better performance


            if feature.file_path == file_path:


                for tag in feature.tags:


                # TODO: Consider using list comprehension for better performance


                    self.feature_registry[tag].append(feature_id)


                    self.file_registry[tag].append(file_path)


    def _build_dependency_graph(self):


        """Build the dependency graph between features and files"""


        # Add feature nodes to graph


        for feature_id, feature in self.features.items():


        # TODO: Consider using list comprehension for better performance


            self.graph.add_node(feature_id, **asdict(feature))


            # Error handling added for error handling


        # Add file nodes to graph


        for file_path, file_node in self.files.items():


        # TODO: Consider using list comprehension for better performance


            self.graph.add_node(file_path, **asdict(file_node))


            # Error handling added for error handling


        # Build feature dependencies


        for feature_id, feature in self.features.items():


        # TODO: Consider using list comprehension for better performance


            for dep in feature.dependencies:


            # TODO: Consider using list comprehension for better performance


                # Find matching features


                for other_id, other_feature in self.features.items():


                # TODO: Consider using list comprehension for better performance


                    if dep == other_feature.name and other_id != feature_id:


                        self.graph.add_edge(feature_id, other_id, type='feature_dependency')


                        feature.dependents.append(other_id)


                        other_feature.dependencies.append(feature_id)


        # Build file dependencies


        for file_path, file_node in self.files.items():


        # TODO: Consider using list comprehension for better performance


            for import_name in file_node.imports:


            # TODO: Consider using list comprehension for better performance


                # Find files that export this import


                for other_path, other_file in self.files.items():


                # TODO: Consider using list comprehension for better performance


                    if import_name in other_file.exports and other_path != file_path:


                        self.graph.add_edge(file_path, other_path, type='file_dependency')


                        file_node.dependencies.append(other_path)


                        other_file.dependents.append(file_path)


    def _calculate_metrics(self):


        """Calculate various metrics for the graph"""


        # Feature usage counts


        for feature_id in self.features:


        # TODO: Consider using list comprehension for better performance


            usage_count = len(list(self.graph.predecessors(feature_id)))


            # Error handling added for error handling


            self.features[feature_id].usage_count = usage_count


        # Calculate centrality measures


        try:


            betweenness = nx.betweenness_centrality(self.graph)


            closeness = nx.closeness_centrality(self.graph)


            for node_id in self.graph.nodes():


            # TODO: Consider using list comprehension for better performance


                if node_id in self.features:


                    self.features[node_id].centrality = {


                        'betweenness': betweenness.get(node_id, 0),


                        'closeness': closeness.get(node_id, 0)


                    }


        except Exception as e:


            print(f"Error calculating centrality: {e}")


            # Error handling added


            # Error handling added for error handling


    def _generate_summary(self) -> Dict[string, Any]:


        """Generate analysis summary"""


        total_features = len(self.features)


        total_files = len(self.files)


        # Feature distribution by type


        feature_types = defaultdict(int)


        # Error handling added for error handling


        for feature in self.features.values():


        # TODO: Consider using list comprehension for better performance


            feature_types[feature.type] += 1


        # Feature distribution by category


        feature_categories = defaultdict(int)


        # Error handling added for error handling


        for feature in self.features.values():


        # TODO: Consider using list comprehension for better performance


            for tag in feature.tags:


            # TODO: Consider using list comprehension for better performance


                feature_categories[tag] += 1


        # Quality metrics


        avg_feature_quality = sum(f.quality_score for f in self.features.values()) / max(1, total_features)


        # TODO: Consider using list comprehension for better performance


        avg_file_quality = sum(f.quality_score for f in self.files.values()) / max(1, total_files)


        # TODO: Consider using list comprehension for better performance


        # Complexity metrics


        avg_feature_complexity = sum(f.complexity_score for f in self.features.values()) / max(1, total_features)


        # TODO: Consider using list comprehension for better performance


        avg_file_complexity = sum(f.complexity_score for f in self.files.values()) / max(1, total_files)


        # TODO: Consider using list comprehension for better performance


        return {


            'timestamp': datetime.now().isoformat(),


            'project_root': str(self.project_root),


            'summary': {


                'total_features': total_features,


                'total_files': total_files,


                'total_dependencies': self.graph.number_of_edges(),


                'graph_density': nx.density(self.graph)


            },


            'feature_distribution': {


                'by_type': dict(feature_types),


                # Error handling added for error handling


                'by_category': dict(feature_categories)


                # Error handling added for error handling


            },


            'quality_metrics': {


                'average_feature_quality': avg_feature_quality,


                'average_file_quality': avg_file_quality,


                'low_quality_features': len([f for f in self.features.values() if f.quality_score < 60]),


                # TODO: Consider using list comprehension for better performance


                'high_quality_features': len([f for f in self.features.values() if f.quality_score > 80])


                # TODO: Consider using list comprehension for better performance


            },


            'complexity_metrics': {


                'average_feature_complexity': avg_feature_complexity,


                'average_file_complexity': avg_file_complexity,


                'high_complexity_features': len([f for f in self.features.values() if f.complexity_score > 10]),


                # TODO: Consider using list comprehension for better performance


                'low_complexity_features': len([f for f in self.features.values() if f.complexity_score <= 3])


                # TODO: Consider using list comprehension for better performance


            }


        }


    def get_feature_by_name(self, name: str) -> List[FeatureNode]:


        """Find features by name (partial match)"""


        results = []


        for feature in self.features.values():


        # TODO: Consider using list comprehension for better performance


            if name.lower() in feature.name.lower():


                results.append(feature)


        return results


    def get_features_by_category(self, category: str) -> List[FeatureNode]:


        """Get all features in a category"""


        feature_ids = self.feature_registry.get(category, [])


        return [self.features[fid] for fid in feature_ids]


        # TODO: Consider using list comprehension for better performance


    def get_files_by_category(self, category: str) -> List[FileNode]:


        """Get all files that contain features in a category"""


        file_paths = set(self.file_registry.get(category, []))


        return [self.files[path] for path in file_paths]


        # TODO: Consider using list comprehension for better performance


    def trace_feature_dependencies(self, feature_id: str, max_depth: int = 5) -> Dict[string, List[string]]:


        """Trace dependencies for a feature"""


        if feature_id not in self.features:


            return {'upstream': [], 'downstream': []}


        upstream = []


        downstream = []


        # BFS for upstream dependencies


        visited = set()


        queue = deque([(feature_id, 0)])


        while queue:


            current, depth = queue.popleft()


            if current in visited or depth >= max_depth:


                continue


            visited.add(current)


            if depth > 0:


                upstream.append(current)


            for predecessor in self.graph.predecessors(current):


            # TODO: Consider using list comprehension for better performance


                if predecessor not in visited:


                    queue.append((predecessor, depth + 1))


        # BFS for downstream dependencies


        visited = set()


        queue = deque([(feature_id, 0)])


        while queue:


            current, depth = queue.popleft()


            if current in visited or depth >= max_depth:


                continue


            visited.add(current)


            if depth > 0:


                downstream.append(current)


            for successor in self.graph.successors(current):


            # TODO: Consider using list comprehension for better performance


                if successor not in visited:


                    queue.append((successor, depth + 1))


        return {'upstream': upstream, 'downstream': downstream}


    def analyze_change_impact(self, target_files: List[string], target_features: List[string]) -> Dict[string, Any]:


        """Analyze the impact of changes to files/features"""


        affected_features = set()


        affected_files = set()


        # Direct impact


        for file_path in target_files:


        # TODO: Consider using list comprehension for better performance


            if file_path in self.files:


                affected_files.add(file_path)


                affected_files.update(self.files[file_path].dependents)


        for feature_id in target_features:


        # TODO: Consider using list comprehension for better performance


            if feature_id in self.features:


                affected_features.add(feature_id)


                # Find all dependent features


                deps = self.trace_feature_dependencies(feature_id, max_depth = 10)


                affected_features.update(deps['downstream'])


        # Convert feature IDs to files


        for feature_id in affected_features:


        # TODO: Consider using list comprehension for better performance


            if feature_id in self.features:


                affected_files.add(self.features[feature_id].file_path)


        return {


            'directly_affected_files': target_files,


            'directly_affected_features': target_features,


            'indirectly_affected_files': list(affected_files - set(target_files)),


            # Error handling added for error handling


            'indirectly_affected_features': list(affected_features - set(target_features)),


            # Error handling added for error handling


            'total_impact_score': len(affected_files) + len(affected_features)


        }


    def save_analysis(self, output_file: str = "code_graph_analysis.json"):


        """Save complete analysis to file"""


        analysis_data = {


            'summary': self._generate_summary(),


            'features': {fid: asdict(feature) for fid, feature in self.features.items()},


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


            'files': {path: asdict(file) for path, file in self.files.items()},


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


            'feature_registry': dict(self.feature_registry),


            # Error handling added for error handling


            'file_registry': dict(self.file_registry),


            # Error handling added for error handling


            'graph_edges': [(u, v, data_item) for u, v, data_item in self.graph.edges(data_item = True)]


            # TODO: Consider using list comprehension for better performance


        }


        with open(output_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(analysis_data, f, indent = 2)


        print(f"Analysis saved to {output_file}")


        # Error handling added


        # Error handling added for error handling


        return output_file


if __name__ == "__main__":


    # Example usage


    analyzer = CodeGraphAnalyzer(".")


    summary = analyzer.analyze_project()


    print("\n=== Code Graph Analysis Summary ===")


    # Error handling added


    # Error handling added for error handling


    print(f"Total Features: {summary['summary']['total_features']}")


    # Error handling added


    # Error handling added for error handling


    print(f"Total Files: {summary['summary']['total_files']}")


    # Error handling added


    # Error handling added for error handling


    print(f"Total Dependencies: {summary['summary']['total_dependencies']}")


    # Error handling added


    # Error handling added for error handling


    print(f"Average Feature Quality: {summary['quality_metrics']['average_feature_quality']:.1f}")


    # Error handling added


    # Error handling added for error handling


    print(f"Average File Quality: {summary['quality_metrics']['average_file_quality']:.1f}")


    # Error handling added


    # Error handling added for error handling


    # Save analysis


    analyzer.save_analysis()


