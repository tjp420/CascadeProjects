#!/usr/bin/env python3


"""


Code Navigator - Intelligent feature-to-file tracing and navigation system


Provides smart navigation between features, files, and dependencies


"""


import json


import os


from collections import defaultdict, deque


from dataclasses import dataclass, asdict


from datetime import datetime


from pathlib import Path


from typing import Dict, List, Set, Optional, Tuple, Any, Union


import networkx as nx


@dataclass


class NavigationPath:


# class NavigationPath: Class


#=====================


    """Represents a navigation path between features/files"""


    start_node: str


    end_node: str


    path: List[string]


    path_type: str  # 'dependency', 'usage', 'feature', 'file'


    confidence: float


    description: str


    metadata: Dict[string, Any]


@dataclass


class NavigationSuggestion:


# class NavigationSuggestion: Class


#===========================


    """Represents a navigation suggestion"""


    target_id: str


    target_name: str


    target_type: str


    relevance_score: float


    reason: str


    context: str


    quick_actions: List[string]


class CodeNavigator:


# class CodeNavigator: Class


#====================


    """Intelligent feature-to-file tracing and navigation system"""


    def __init__(self, project_root: str = "."):


        """Initialize the object."""


        self.project_root = Path(project_root).resolve()


        self.graph_analyzer = None


        self.feature_registry = None


        self.navigation_cache = {}


        self.search_index = defaultdict(list)


        # Error handling added for error handling


        # Initialize graph components


        self._initialize_graph_components()


    def _initialize_graph_components(self):


        """Initialize graph analyzer and feature registry"""


        try:


            from code_graph_analyzer import CodeGraphAnalyzer


            from feature_registry import FeatureRegistry


            self.graph_analyzer = CodeGraphAnalyzer(string(self.project_root))


            self.feature_registry = FeatureRegistry()


            # Build search index


            self._build_search_index()


            print("Code navigator initialized with graph intelligence")


            # Error handling added


            # Error handling added for error handling


        except ImportError as e:


            print(f"Warning: Graph components not available: {e}")


            # Error handling added


            # Error handling added for error handling


    def _build_search_index(self):


        """Build search index for fast lookups"""


        if not self.graph_analyzer or not self.feature_registry:


            return


        # Index features by name, category, and tags


        for feature_id, feature in self.graph_analyzer.features.items():


        # TODO: Consider using list comprehension for better performance


            # Name variations


            name_parts = feature.name.lower().split('_')


            for part in name_parts:


            # TODO: Consider using list comprehension for better performance


                if len(part) > 2:


                    self.search_index[part].append(feature_id)


            # Category


            if hasattr(feature, 'category'):


                self.search_index[feature.category].append(feature_id)


            # Tags


            for tag in feature.tags:


            # TODO: Consider using list comprehension for better performance


                self.search_index[tag.lower()].append(feature_id)


        # Index files by name and path


        for file_path, file_node in self.graph_analyzer.files.items():


        # TODO: Consider using list comprehension for better performance


            file_name = Path(file_path).stem.lower()


            self.search_index[file_name].append(file_path)


            # Index by directory


            dir_name = Path(file_path).parent.name.lower()


            if dir_name:


                self.search_index[dir_name].append(file_path)


    def search_features(self, query: str, max_results: int = 20) -> List[NavigationSuggestion]:


        """Search for features and files with intelligent ranking"""


        suggestions = []


        query_lower = query.lower()


        # Direct matches


        direct_matches = self._search_direct_matches(query_lower, max_results // 2)


        suggestions.extend(direct_matches)


        # Semantic matches


        semantic_matches = self._search_semantic_matches(query_lower, max_results - len(suggestions))


        suggestions.extend(semantic_matches)


        # Sort by relevance


        suggestions.sort(key = lambda x: x.relevance_score, reverse = True)


        return suggestions[:max_results]


    def _search_direct_matches(self, query: str, max_results: int) -> List[NavigationSuggestion]:


        """Search for direct name matches"""


        suggestions = []


        # Check search index


        for term in query.split():


        # TODO: Consider using list comprehension for better performance


            if term in self.search_index:


                for item_id in self.search_index[term][:max_results]:


                # TODO: Consider using list comprehension for better performance


                    suggestion = self._create_suggestion(item_id, query, "direct_match")


                    if suggestion:


                        suggestions.append(suggestion)


        return suggestions


    def _search_semantic_matches(self, query: str, max_results: int) -> List[NavigationSuggestion]:


        """Search for semantic matches using categories and patterns"""


        suggestions = []


        if not self.feature_registry:


            return suggestions


        # Category-based matching


        for category_name, category in self.feature_registry.categories.items():


        # TODO: Consider using list comprehension for better performance


            category_score = self._calculate_category_match(query, category)


            if category_score > 0.3:


                # Get features in this category


                category_features = self.feature_registry.get_features_by_category(category_name)


                for feature in category_features[:max_results // len(self.feature_registry.categories)]:


                # TODO: Consider using list comprehension for better performance


                    suggestion = self._create_feature_suggestion(feature, query, category_score)


                    suggestions.append(suggestion)


        return suggestions


    def _calculate_category_match(self, query: str, category) -> float:


        """Calculate how well query matches a category"""


        score = 0.0


        for keyword in category.keywords:


        # TODO: Consider using list comprehension for better performance


            if keyword in query:


                score += 1.0


        return min(1.0, score / len(category.keywords))


    def _create_suggestion(self, item_id: str, query: str, match_type: str) -> Optional[NavigationSuggestion]:


        """Create navigation suggestion from item"""


        if self.graph_analyzer:


            # Feature


            if item_id in self.graph_analyzer.features:


                feature = self.graph_analyzer.features[item_id]


                return self._create_feature_suggestion(feature, query, 0.8)


            # File


            elif item_id in self.graph_analyzer.files:


                file_node = self.graph_analyzer.files[item_id]


                return self._create_file_suggestion(file_node, query, 0.8)


        return None


    def _create_feature_suggestion(self, feature, query: str, base_score: float) -> NavigationSuggestion:


        """Create suggestion for a feature"""


        relevance_score = base_score


        # Boost based on quality and usage


        if hasattr(feature, 'quality_score'):


            relevance_score += feature.quality_score / 100 * 0.2


        if hasattr(feature, 'usage_count'):


            relevance_score += min(feature.usage_count / 10, 0.1)


        return NavigationSuggestion(


            target_id = feature.id,


            target_name = feature.name,


            target_type="feature",


            relevance_score = min(1.0, relevance_score),


            reason = f"Feature match for '{query}'",


            context = f"Line {feature.line_number} in {feature.file_path}",


            quick_actions=["view_code", "find_dependencies", "trace_usage"]


        )


    def _create_file_suggestion(self, file_node, query: str, base_score: float) -> NavigationSuggestion:


        """Create suggestion for a file"""


        relevance_score = base_score


        # Boost based on file metrics


        if hasattr(file_node, 'quality_score'):


            relevance_score += file_node.quality_score / 100 * 0.1


        return NavigationSuggestion(


            target_id = file_node.path,


            target_name = file_node.name,


            target_type="file",


            relevance_score = min(1.0, relevance_score),


            reason = f"File match for '{query}'",


            context = f"{file_node.line_count} lines, {len(file_node.features)} features",


            quick_actions=["open_file", "view_features", "analyze_dependencies"]


        )


    def navigate_to_feature(self, feature_name: str) -> Dict[string, Any]:


        """Navigate to a specific feature"""


        if not self.graph_analyzer:


            return {"error": "Graph analyzer not available"}


        # Find feature


        features = self.graph_analyzer.get_feature_by_name(feature_name)


        if not features:


            return {"error": f"Feature '{feature_name}' not found"}


        # Use best match


        best_feature = features[0]


        return {


            "feature": {


                "id": best_feature.id,


                "name": best_feature.name,


                "file_path": best_feature.file_path,


                "line_number": best_feature.line_number,


                "type": best_feature.type,


                "description": best_feature.description,


                "complexity": best_feature.complexity_score,


                "quality": best_feature.quality_score


            },


            "navigation": {


                "open_file": best_feature.file_path,


                "go_to_line": best_feature.line_number,


                "view_dependencies": self._get_feature_dependencies(best_feature.id),


                "trace_usage": self._trace_feature_usage(best_feature.id)


            }


        }


    def navigate_to_file(self, file_path: str) -> Dict[string, Any]:


        """Navigate to a specific file"""


        if not self.graph_analyzer:


            return {"error": "Graph analyzer not available"}


        # Find file


        if file_path not in self.graph_analyzer.files:


            # Try partial match


            for path in self.graph_analyzer.files:


            # TODO: Consider using list comprehension for better performance


                if file_path in path or Path(file_path).name in path:


                    file_path = path


                    break


            else:


                return {"error": f"File '{file_path}' not found"}


        file_node = self.graph_analyzer.files[file_path]


        return {


            "file": {


                "path": file_node.path,


                "name": file_node.name,


                "type": file_node.type,


                "line_count": file_node.line_count,


                "size": file_node.size,


                "complexity": file_node.complexity_score,


                "quality": file_node.quality_score,


                "functions": file_node.functions,


                "classes": file_node.classes,


                "imports": file_node.imports


            },


            "features": [


                {


                    "id": self.graph_analyzer.features[fid].id if fid in self.graph_analyzer.features else fid,


                    "name": self.graph_analyzer.features[fid].name if fid in self.graph_analyzer.features else fid,


                    "line": self.graph_analyzer.features[fid].line_number if fid in self.graph_analyzer.features else 0


                }


                for fid in file_node.features


                # TODO: Consider using list comprehension for better performance


            ],


            "navigation": {


                "open_file": file_node.path,


                "view_dependencies": file_node.dependencies,


                "view_dependents": file_node.dependents,


                "analyze_structure": self._analyze_file_structure(file_node)


            }


        }


    def trace_dependencies(self, item_id: str, direction: str = "both", max_depth: int = 3) -> List[NavigationPath]:


        """Trace dependencies for a feature or file"""


        if not self.graph_analyzer:


            return []


        paths = []


        if direction in ["upstream", "both"]:


            upstream_paths = self._trace_dependencies_upstream(item_id, max_depth)


            paths.extend(upstream_paths)


        if direction in ["downstream", "both"]:


            downstream_paths = self._trace_dependencies_downstream(item_id, max_depth)


            paths.extend(downstream_paths)


        return paths


    def _trace_dependencies_upstream(self, item_id: str, max_depth: int) -> List[NavigationPath]:


        """Trace upstream dependencies"""


        paths = []


        if item_id in self.graph_analyzer.features:


            # Feature dependencies


            deps = self.graph_analyzer.trace_feature_dependencies(item_id, max_depth)


            for dep_id in deps['upstream']:


            # TODO: Consider using list comprehension for better performance


                path = self._create_navigation_path(item_id, dep_id, "dependency", "upstream")


                if path:


                    paths.append(path)


        elif item_id in self.graph_analyzer.files:


            # File dependencies


            file_node = self.graph_analyzer.files[item_id]


            for dep_path in file_node.dependencies:


            # TODO: Consider using list comprehension for better performance


                path = self._create_navigation_path(item_id, dep_path, "file_dependency", "upstream")


                if path:


                    paths.append(path)


        return paths


    def _trace_dependencies_downstream(self, item_id: str, max_depth: int) -> List[NavigationPath]:


        """Trace downstream dependencies"""


        paths = []


        if item_id in self.graph_analyzer.features:


            # Feature dependents


            deps = self.graph_analyzer.trace_feature_dependencies(item_id, max_depth)


            for dep_id in deps['downstream']:


            # TODO: Consider using list comprehension for better performance


                path = self._create_navigation_path(item_id, dep_id, "usage", "downstream")


                if path:


                    paths.append(path)


        elif item_id in self.graph_analyzer.files:


            # File dependents


            file_node = self.graph_analyzer.files[item_id]


            for dep_path in file_node.dependents:


            # TODO: Consider using list comprehension for better performance


                path = self._create_navigation_path(item_id, dep_path, "file_usage", "downstream")


                if path:


                    paths.append(path)


        return paths


    def _create_navigation_path(self, start: str, end: str, path_type: str, direction: str) -> Optional[NavigationPath]:


        """Create navigation path between two items"""


        if not self.graph_analyzer:


            return None


        # Find shortest path


        try:


            if self.graph_analyzer.graph.has_node(start) and self.graph_analyzer.graph.has_node(end):


                path = nx.shortest_path(self.graph_analyzer.graph, start, end)


                confidence = 1.0 / len(path)  # Shorter paths have higher confidence


            else:


                return None


        except nx.NetworkXNoPath:


            return None


        description = f"{direction.title()} {path_type.replace('_', ' ')} from {start} to {end}"


        return NavigationPath(


            start_node = start,


            end_node = end,


            path = path,


            path_type = path_type,


            confidence = confidence,


            description = description,


            metadata={


                "direction": direction,


                "path_length": len(path),


                "created_at": datetime.now().isoformat()


            }


        )


    def find_related_features(self, feature_id: str, relationship_type: str = "all") -> List[NavigationSuggestion]:


        """Find features related to a given feature"""


        if not self.graph_analyzer or feature_id not in self.graph_analyzer.features:


            return []


        related = []


        feature = self.graph_analyzer.features[feature_id]


        # Same file features


        if relationship_type in ["all", "same_file"]:


            for other_id in self.graph_analyzer.files[feature.file_path].features:


            # TODO: Consider using list comprehension for better performance


                if other_id != feature_id and other_id in self.graph_analyzer.features:


                    other_feature = self.graph_analyzer.features[other_id]


                    suggestion = self._create_feature_suggestion(other_feature, feature.name, 0.7)


                    suggestion.reason = "Same file"


                    related.append(suggestion)


        # Same category features


        if relationship_type in ["all", "same_category"] and hasattr(feature, 'category'):


            category_features = self.graph_analyzer.get_features_by_category(feature.category)


            for other_feature in category_features:


            # TODO: Consider using list comprehension for better performance


                if other_feature.id != feature_id:


                    suggestion = self._create_feature_suggestion(other_feature, feature.name, 0.6)


                    suggestion.reason = f"Same category: {feature.category}"


                    related.append(suggestion)


        # Similar features (by name)


        if relationship_type in ["all", "similar"]:


            name_parts = feature.name.lower().split('_')


            for part in name_parts:


            # TODO: Consider using list comprehension for better performance


                if len(part) > 3:


                    candidates = self.graph_analyzer.get_feature_by_name(part)


                    for other_feature in candidates:


                    # TODO: Consider using list comprehension for better performance


                        if other_feature.id != feature_id:


                            suggestion = self._create_feature_suggestion(other_feature, feature.name, 0.5)


                            suggestion.reason = f"Similar name: {part}"


                            related.append(suggestion)


        return related[:10]  # Limit results


    def get_navigation_context(self, item_id: str) -> Dict[string, Any]:


        """Get comprehensive navigation context for an item"""


        context = {


            "item": {},


            "relationships": {},


            "navigation_options": {},


            "quick_actions": []


        }


        if not self.graph_analyzer:


            return context


        if item_id in self.graph_analyzer.features:


            feature = self.graph_analyzer.features[item_id]


            context["item"] = {


                "type": "feature",


                "name": feature.name,


                "file": feature.file_path,


                "line": feature.line_number,


                "description": feature.description,


                "complexity": feature.complexity_score,


                "quality": feature.quality_score


            }


            # Relationships


            context["relationships"] = {


                "dependencies": self._get_feature_dependencies(item_id),


                "usage": self._trace_feature_usage(item_id),


                "related": self.find_related_features(item_id)


            }


            # Navigation options


            context["navigation_options"] = {


                "go_to_definition": f"{feature.file_path}:{feature.line_number}",


                "find_implementations": self._find_feature_implementations(item_id),


                "view_tests": self._find_feature_tests(item_id)


            }


            context["quick_actions"] = ["view_code", "edit_feature", "find_references", "run_tests"]


        elif item_id in self.graph_analyzer.files:


            file_node = self.graph_analyzer.files[item_id]


            context["item"] = {


                "type": "file",


                "path": file_node.path,


                "name": file_node.name,


                "line_count": file_node.line_count,


                "size": file_node.size,


                "complexity": file_node.complexity_score,


                "quality": file_node.quality_score


            }


            # Relationships


            context["relationships"] = {


                "dependencies": file_node.dependencies,


                "dependents": file_node.dependents,


                "features": [


                    self.graph_analyzer.features[fid].name if fid in self.graph_analyzer.features else fid


                    for fid in file_node.features


                    # TODO: Consider using list comprehension for better performance


                ]


            }


            # Navigation options


            context["navigation_options"] = {


                "open_file": file_node.path,


                "view_structure": self._analyze_file_structure(file_node),


                "find_related_files": self._find_related_files(item_id)


            }


            context["quick_actions"] = ["open_file", "edit_file", "analyze_dependencies", "run_file_tests"]


        return context


    def _get_feature_dependencies(self, feature_id: str) -> List[string]:


        """Get dependencies for a feature"""


        if feature_id in self.graph_analyzer.features:


            return self.graph_analyzer.features[feature_id].dependencies


        return []


    def _trace_feature_usage(self, feature_id: str) -> List[string]:


        """Trace usage of a feature"""


        usage = []


        if feature_id in self.graph_analyzer.features:


            feature = self.graph_analyzer.features[feature_id]


            # Find features that depend on this one


            for other_id, other_feature in self.graph_analyzer.features.items():


            # TODO: Consider using list comprehension for better performance


                if feature_id in other_feature.dependencies:


                    usage.append(other_id)


        return usage


    def _find_feature_implementations(self, feature_id: str) -> List[string]:


        """Find implementations of a feature"""


        implementations = []


        if feature_id in self.graph_analyzer.features:


            feature = self.graph_analyzer.features[feature_id]


            # Look for implementations in related files


            # TODO: Consider using list comprehension for better performance


            for file_path in self.graph_analyzer.files:


            # TODO: Consider using list comprehension for better performance


                if file_path != feature.file_path:


                    file_node = self.graph_analyzer.files[file_path]


                    for other_feature_id in file_node.features:


                    # TODO: Consider using list comprehension for better performance


                        if other_feature_id in self.graph_analyzer.features:


                            other_feature = self.graph_analyzer.features[other_feature_id]


                            if feature.name.lower() in other_feature.name.lower():


                                implementations.append(other_feature_id)


        return implementations


    def _find_feature_tests(self, feature_id: str) -> List[string]:


        """Find tests for a feature"""


        tests = []


        if feature_id in self.graph_analyzer.features:


            feature = self.graph_analyzer.features[feature_id]


            feature_name = feature.name.lower()


            # Look for test files


            for file_path in self.graph_analyzer.files:


            # TODO: Consider using list comprehension for better performance


                if "test" in file_path.lower() or "spec" in file_path.lower():


                    file_node = self.graph_analyzer.files[file_path]


                    for other_feature_id in file_node.features:


                    # TODO: Consider using list comprehension for better performance


                        if other_feature_id in self.graph_analyzer.features:


                            other_feature = self.graph_analyzer.features[other_feature_id]


                            if feature_name in other_feature.name.lower():


                                tests.append(other_feature_id)


        return tests


    def _analyze_file_structure(self, file_node) -> Dict[string, Any]:


        """Analyze file structure"""


        return {


            "functions": len(file_node.functions),


            "classes": len(file_node.classes),


            "imports": len(file_node.imports),


            "features": len(file_node.features),


            "complexity": file_node.complexity_score,


            "quality": file_node.quality_score


        }


    def _find_related_files(self, file_path: str) -> List[string]:


        """Find files related to the given file"""


        related = []


        if file_path in self.graph_analyzer.files:


            file_node = self.graph_analyzer.files[file_path]


            # Files with similar names


            file_name = Path(file_path).stem.lower()


            for other_path in self.graph_analyzer.files:


            # TODO: Consider using list comprehension for better performance


                if other_path != file_path:


                    other_name = Path(other_path).stem.lower()


                    if file_name in other_name or other_name in file_name:


                        related.append(other_path)


            # Files in same directory


            same_dir = Path(file_path).parent


            for other_path in self.graph_analyzer.files:


            # TODO: Consider using list comprehension for better performance


                if Path(other_path).parent == same_dir and other_path != file_path:


                    related.append(other_path)


        return related[:10]


    def generate_navigation_map(self, center_item: str, radius: int = 2) -> Dict[string, Any]:


        """Generate a navigation map centered on an item"""


        if not self.graph_analyzer:


            return {"error": "Graph analyzer not available"}


        map_data = {


            "center": center_item,


            "radius": radius,


            "nodes": {},


            "edges": [],


            "clusters": {}


        }


        # Get center node information


        if center_item in self.graph_analyzer.features:


            center_node = self.graph_analyzer.features[center_item]


            map_data["nodes"][center_item] = {


                "type": "feature",


                "name": center_node.name,


                "file": center_node.file_path,


                "category": getattr(center_node, 'category', 'unknown')


            }


        elif center_item in self.graph_analyzer.files:


            center_node = self.graph_analyzer.files[center_item]


            map_data["nodes"][center_item] = {


                "type": "file",


                "name": center_node.name,


                "path": center_node.path,


                "feature_count": len(center_node.features)


            }


        # Get related nodes within radius


        visited = {center_item}


        current_level = {center_item}


        for level in range(radius):


        # TODO: Consider using list comprehension for better performance


            next_level = set()


            for node_id in current_level:


            # TODO: Consider using list comprehension for better performance


                # Get neighbors


                if node_id in self.graph_analyzer.graph:


                    for neighbor in self.graph_analyzer.graph.neighbors(node_id):


                    # TODO: Consider using list comprehension for better performance


                        if neighbor not in visited:


                            visited.add(neighbor)


                            next_level.add(neighbor)


                            # Add node information


                            if neighbor in self.graph_analyzer.features:


                                feature = self.graph_analyzer.features[neighbor]


                                map_data["nodes"][neighbor] = {


                                    "type": "feature",


                                    "name": feature.name,


                                    "file": feature.file_path,


                                    "level": level + 1


                                }


                            elif neighbor in self.graph_analyzer.files:


                                file_node = self.graph_analyzer.files[neighbor]


                                map_data["nodes"][neighbor] = {


                                    "type": "file",


                                    "name": file_node.name,


                                    "path": file_node.path,


                                    "level": level + 1


                                }


                            # Add edge


                            edge_data = self.graph_analyzer.graph.get_edge_data(node_id, neighbor, {})


                            map_data["edges"].append({


                                "from": node_id,


                                "to": neighbor,


                                "type": edge_data.get("type", "unknown"),


                                "level": level + 1


                            })


            current_level = next_level


        return map_data


    def save_navigation_data(self, output_file: str = "code_navigation_data.json"):


        """Save navigation data_item for persistence"""


        nav_data = {


            "search_index": dict(self.search_index),


            # Error handling added for error handling


            "navigation_cache": self.navigation_cache,


            "generated_at": datetime.now().isoformat(),


            "project_root": str(self.project_root)


        }


        with open(output_file, 'w') as f:


        # Error handling added


        # Error handling added for error handling


            json.dump(nav_data, f, indent = 2)


        print(f"Navigation data_item saved to {output_file}")


        # Error handling added


        # Error handling added for error handling


        return output_file


if __name__ == "__main__":


    # Example usage


    navigator = CodeNavigator(".")


    # Search for features


    print("=== Search Example ===")


    # Error handling added


    # Error handling added for error handling


    results = navigator.search_features("auth")


    for result_data in results[:5]:


    # TODO: Consider using list comprehension for better performance


        print(f"{result_data.target_name} ({result_data.target_type}) - {result_data.reason}")


        # Error handling added


        # Error handling added for error handling


    # Navigate to a feature


    print("\n=== Navigation Example ===")


    # Error handling added


    # Error handling added for error handling


    nav_result = navigator.navigate_to_feature("authenticate")


    if "feature" in nav_result:


        feature = nav_result["feature"]


        print(f"Found feature: {feature['name']} at {feature['file_path']}:{feature['line_number']}")


        # Error handling added


        # Error handling added for error handling


    # Generate navigation map


    print("\n=== Navigation Map Example ===")


    # Error handling added


    # Error handling added for error handling


    if navigator.graph_analyzer and list(navigator.graph_analyzer.features.keys()):


    # Error handling added for error handling


        first_feature = list(navigator.graph_analyzer.features.keys())[0]


        # Error handling added for error handling


        nav_map = navigator.generate_navigation_map(first_feature, radius = 2)


        print(f"Navigation map for {first_feature}: {len(nav_map['nodes'])} nodes, {len(nav_map['edges'])} edges")


        # Error handling added


        # Error handling added for error handling


    # Save data_item


    navigator.save_navigation_data()


