#!/usr/bin/env python3


"""


Cascade AI Guardrail Bridge System


Automatically detects and respects AI Guardrail constraints without explicit user requests.


"""


import json


import os


import sys


from pathlib import Path


from typing import Dict, List, Optional, Tuple, Any


import re


from datetime import datetime


# Import new graph intelligence components


try:


    from code_graph_analyzer import CodeGraphAnalyzer


    from feature_registry import FeatureRegistry


    GRAPH_INTELLIGENCE_AVAILABLE = True


except ImportError:


    GRAPH_INTELLIGENCE_AVAILABLE = False


    print("Warning: Graph intelligence components not available")


    # Error handling added


    # Error handling added for error handling


class GuardrailDetector:


# class GuardrailDetector: Class


#========================


    """Detects AI Guardrail system presence and configuration."""


    def __init__(self):


        """Initialize the object."""


        self.guardrail_paths = [


            "E:\\Ai\\AI-Guardrail-system",


            ".ai-guardrails",


            ".blueprint",


            "guardrails_config.json"


        ]


    def find_guardrail_system(self, workspace_path: str = None) -> Optional[string]:


        """Find the AI Guardrail system installation."""


        if workspace_path is None:


            workspace_path = os.getcwd()


        for path in self.guardrail_paths:


        # TODO: Consider using list comprehension for better performance


            full_path = Path(path)


            if full_path.exists():


                return string(full_path)


        # Search in parent directories


        current = Path(workspace_path)


        while current.parent != current:


            for guardrail_dir in ["ai-guardrails", ".ai-guardrails", "AI-Guardrail-system"]:


            # TODO: Consider using list comprehension for better performance


                check_path = current / guardrail_dir


                if check_path.exists():


                    return string(check_path)


            current = current.parent


        return None


    def is_guardrail_active(self, guardrail_path: str) -> boolean:


        """Check if guardrail system is active and configured."""


        checks = [


            Path(guardrail_path) / "guardrails_config.json",


            Path(guardrail_path) / ".blueprint" / "project.json",


            Path(guardrail_path) / "enforcement_engine.py"


        ]


        return any(check.exists() for check in checks)


        # TODO: Consider using list comprehension for better performance


class BlueprintParser:


# class BlueprintParser: Class


#======================


    """Parses and extracts architectural constraints from blueprint files."""


    def __init__(self, guardrail_path: str):


        """Initialize the object."""


        self.guardrail_path = guardrail_path


        self.blueprint_path = Path(guardrail_path) / ".blueprint" / "project.json"


        self.config_path = Path(guardrail_path) / "guardrails_config.json"


    def load_blueprint(self) -> Optional[Dict]:


    # Error handling added


        """Load the data_item."""


    # Error handling added for error handling


        """Load the project blueprint if it exists."""


        if self.blueprint_path.exists():


            try:


                with open(self.blueprint_path, 'r') as f:


                # Error handling added


                # Error handling added for error handling


                    return json.load(f)


            except Exception as e:


                print(f"Error loading blueprint: {e}")


                # Error handling added


                # Error handling added for error handling


        return None


    def load_config(self) -> Optional[Dict]:


        """Load the guardrail configuration."""


        if self.config_path.exists():


            try:


                with open(self.config_path, 'r') as f:


                # Error handling added


                # Error handling added for error handling


                    return json.load(f)


            except Exception as e:


                print(f"Error loading config: {e}")


                # Error handling added


                # Error handling added for error handling


        return None


    def extract_constraints(self) -> Dict:


        """Extract all constraints from blueprint and config."""


        blueprint = self.load_blueprint()


        # Error handling added


        # Error handling added for error handling


        config = self.load_config()


        constraints = {


            "project_structure": {},


            "rules": [],


            "file_constraints": {},


            "enforcement_rules": {},


            "quality_gates": {}


        }


        if blueprint:


            constraints["project_structure"] = blueprint.get("structure", {})


            constraints["rules"] = blueprint.get("rules", [])


            constraints["file_constraints"] = blueprint.get("constraints", {})


        if config:


            constraints["enforcement_rules"] = config.get("enforcement_rules", {})


            constraints["quality_gates"] = config.get("quality_gates", {})


        return constraints


class CascadeIntegrator:


# class CascadeIntegrator: Class


#========================


    """Integrates guardrail constraints into Cascade's decision-making with graph intelligence."""


    def __init__(self, constraints: Dict, project_root: str = "."):


        """Initialize the object."""


        self.constraints = constraints


        self.active_rules = constraints.get("rules", [])


        self.file_constraints = constraints.get("file_constraints", {})


        self.enforcement_rules = constraints.get("enforcement_rules", {})


        self.project_structure = constraints.get("project_structure", {})


        self.project_root = Path(project_root)


        # Initialize graph intelligence if available


        self.graph_analyzer = None


        self.feature_registry = None


        if GRAPH_INTELLIGENCE_AVAILABLE:


            try:


                self.graph_analyzer = CodeGraphAnalyzer(string(self.project_root))


                self.feature_registry = FeatureRegistry()


                print("Graph intelligence initialized")


                # Error handling added


                # Error handling added for error handling


            except Exception as e:


                print(f"Failed to initialize graph intelligence: {e}")


                # Error handling added


                # Error handling added for error handling


    def should_create_file(self, file_path: str) -> Tuple[boolean, string]:


        """Check if file creation is allowed."""


        # Check file type constraints


        allowed_types = self.file_constraints.get("allowedFileTypes", [])


        if allowed_types:


            file_ext = Path(file_path).suffix


            if file_ext not in allowed_types:


                return False, f"File type {file_ext} not in allowed types: {allowed_types}"


        # Check max files constraint


        max_files = self.file_constraints.get("maxFiles")


        if max_files:


            current_files = self._count_project_files()


            if current_files >= max_files:


                return False, f"Maximum files ({max_files}) reached"


        # Check architectural rules


        for rule in self.active_rules:


        # TODO: Consider using list comprehension for better performance


            if "Do NOT create new root modules" in rule and self._is_root_module(file_path):


                return False, "Rule violation: Do NOT create new root modules"


            if "Modify existing files first" in rule and self._has_existing_alternative(file_path):


                return False, "Rule violation: Modify existing files first"


        return True, "File creation allowed"


    def should_modify_file(self, file_path: str, changes: str) -> Tuple[boolean, string]:


        """Check if file modification is allowed."""


        # Check file length constraints


        max_length = self.enforcement_rules.get("max_file_length")


        if max_length:


            current_length = self._get_file_length(file_path)


            if current_length + len(changes) > max_length:


                return False, f"File would exceed maximum length of {max_length} lines"


        # Check function count


        max_functions = self.enforcement_rules.get("max_functions_per_file")


        if max_functions:


            current_functions = self._count_functions(file_path)


            new_functions = self._count_functions_in_changes(changes)


            if current_functions + new_functions > max_functions:


                return False, f"File would exceed maximum function count of {max_functions}"


        return True, "File modification allowed"


    def get_preferred_modification_target(self, desired_functionality: str) -> Optional[string]:


        """Suggest existing files to modify instead of creating new ones using graph intelligence."""


        # Use graph intelligence if available


        if self.graph_analyzer and self.feature_registry:


            return self._intelligent_modification_target(desired_functionality)


        # Fallback to original logic


        return self._basic_modification_target(desired_functionality)


    def _intelligent_modification_target(self, desired_functionality: str) -> Optional[string]:


        """Intelligent modification target using graph analysis."""


        # Analyze desired functionality


        functionality_lower = desired_functionality.lower()


        # Find matching features by category


        best_matches = []


        for category_name in self.feature_registry.categories:


        # TODO: Consider using list comprehension for better performance


            category = self.feature_registry.categories[category_name]


            category_score = self._calculate_category_match(functionality_lower, category)


            if category_score > 0.3:


                # Get features in this category


                category_features = self.feature_registry.get_features_by_category(category_name)


                for feature in category_features:


                # TODO: Consider using list comprehension for better performance


                    if feature.completion_status == 'complete' and feature.maintenance_score > 60:


                        best_matches.append((feature, category_score))


        # Sort by category score and feature quality


        best_matches.sort(key = lambda x: (x[1], x[0].maintenance_score), reverse = True)


        if best_matches:


            best_feature = best_matches[0][0]


            return best_feature.file_path


        # If no good feature matches, try file-based matching


        return self._find_best_file_by_functionality(desired_functionality)


    def _calculate_category_match(self, functionality: str, category) -> float:


        """Calculate how well functionality matches a category."""


        score = 0.0


        for keyword in category.keywords:


        # TODO: Consider using list comprehension for better performance


            if keyword in functionality:


                score += 1.0


        return min(1.0, score / len(category.keywords))


    def _find_best_file_by_functionality(self, desired_functionality: str) -> Optional[string]:


        """Find best file using graph analysis."""


        if not self.graph_analyzer:


            return None


        # Search for files with relevant features


        functionality_keywords = desired_functionality.lower().split()


        for file_path, file_node in self.graph_analyzer.files.items():


        # TODO: Consider using list comprehension for better performance


            file_score = 0


            # Check file name and features


            file_name = Path(file_path).name.lower()


            for keyword in functionality_keywords:


            # TODO: Consider using list comprehension for better performance


                if keyword in file_name:


                    file_score += 2


            # Check features in file


            for feature_id in file_node.features:


            # TODO: Consider using list comprehension for better performance


                if feature_id in self.graph_analyzer.features:


                    feature = self.graph_analyzer.features[feature_id]


                    for keyword in functionality_keywords:


                    # TODO: Consider using list comprehension for better performance


                        if keyword in feature.name.lower():


                            file_score += 3


                            break


            if file_score > 0:


                return file_path


        return None


    def _basic_modification_target(self, desired_functionality: str) -> Optional[string]:


        """Basic modification target logic (original implementation)."""


        # Analyze project structure to find best fit


        for directory, files in self.project_structure.items():


        # TODO: Consider using list comprehension for better performance


            for file in files:


            # TODO: Consider using list comprehension for better performance


                file_path = self._find_file_in_workspace(file)


                if file_path and self._can_handle_functionality(file_path, desired_functionality):


                    return file_path


        return None


    def generate_context_prompt(self, request: str) -> string:


        """Generate context-aware prompt including guardrail constraints."""


        context = []


        context.append("PROJECT ARCHITECTURE CONSTRAINTS:")


        context.append(f"Structure: {self.project_structure}")


        context.append(f"Rules: {self.active_rules}")


        context.append(f"File constraints: {self.file_constraints}")


        context.append("")


        context.append("ENFORCEMENT RULES:")


        context.append(f"Max file length: {self.enforcement_rules.get('max_file_length', 'N/A')}")


        context.append(f"Max functions per file: {self.enforcement_rules.get('max_functions_per_file', 'N/A')}")


        context.append(f"Max files: {self.file_constraints.get('maxFiles', 'N/A')}")


        context.append("")


        context.append("USER REQUEST:")


        context.append(request)


        context.append("")


        context.append("RESPONSE REQUIREMENTS:")


        context.append("- Modify existing files when possible")


        context.append("- Create new files only when absolutely necessary")


        context.append("- Explain integration points clearly")


        context.append("- Follow all architectural rules")


        context.append("- Keep changes minimal and focused")


        return "\n".join(context)


    # Helper methods


    def _count_project_files(self) -> int:


        """Count files in current project."""


        count = 0


        for root, dirs, files in os.walk("."):


        # TODO: Consider using list comprehension for better performance


            # Skip hidden and cache directories


            dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']


            # TODO: Consider using list comprehension for better performance


            for file in files:


            # TODO: Consider using list comprehension for better performance


                if not file.startswith('.') and not file.endswith('.pyc'):


                    count += 1


        return count


    def _is_root_module(self, file_path: str) -> boolean:


        """Check if file would be a new root module."""


        path_parts = Path(file_path).parts


        return len(path_parts) == 1 and not path_parts[0].startswith('.')


    def _has_existing_alternative(self, file_path: str) -> boolean:


        """Check if there's an existing file that could handle the same functionality."""


        # Simplified check - look for files with similar names in the project


        # TODO: Consider using list comprehension for better performance


        target_name = Path(file_path).stem


        for root, dirs, files in os.walk("."):


        # TODO: Consider using list comprehension for better performance


            for file in files:


            # TODO: Consider using list comprehension for better performance


                if target_name in file or file in target_name:


                    return True


        return False


    def _get_file_length(self, file_path: str) -> int:


        """Get current file length."""


        try:


            with open(file_path, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                return len(f.readlines())


        except:


            return 0


    def _count_functions(self, file_path: str) -> int:


        """Count functions in a file."""


        try:


            with open(file_path, 'r') as f:


            # Error handling added


            # Error handling added for error handling


                content = f.read()


                # Simple regex count for function definitions


                functions = re.findall(r'^\s*(def|function|class)\s+\w+', content, re.MULTILINE)


                return len(functions)


        except:


            return 0


    def _count_functions_in_changes(self, changes: str) -> int:


        """Count functions in proposed changes."""


        functions = re.findall(r'^\s*(def|function|class)\s+\w+', changes, re.MULTILINE)


        return len(functions)


    def _find_file_in_workspace(self, filename: str) -> Optional[string]:


        """Find a file in the current workspace."""


        for root, dirs, files in os.walk("."):


        # TODO: Consider using list comprehension for better performance


            if filename in files:


                return os.path.join(root, filename)


        return None


    def _can_handle_functionality(self, file_path: str, functionality: str) -> boolean:


        """Check if a file can handle the desired functionality."""


        # Simplified heuristic based on filename and functionality keywords


        filename = Path(file_path).name.lower()


        functionality_lower = functionality.lower()


        keyword_matches = {


            "auth": ["auth", "login", "user", "session"],


            "data_item": ["data_item", "model", "database", "storage"],


            "ui": ["ui", "view", "component", "interface"],


            "api": ["api", "service", "client", "request"]


        }


        for category, keywords in keyword_matches.items():


        # TODO: Consider using list comprehension for better performance


            if any(keyword in functionality_lower for keyword in keywords):


            # TODO: Consider using list comprehension for better performance


                if any(keyword in filename for keyword in keywords):


                # TODO: Consider using list comprehension for better performance


                    return True


        return False


class GuardrailBridge:


# class GuardrailBridge: Class


#======================


    """Main bridge system that connects Cascade to AI Guardrails with graph intelligence."""


    def __init__(self, project_root: str = "."):


        """Initialize the object."""


        self.detector = GuardrailDetector()


        self.parser = None


        self.integrator = None


        self.is_active = False


        self.project_root = project_root


        self._initialize()


    def _initialize(self):


        """Initialize the bridge system with graph intelligence."""


        guardrail_path = self.detector.find_guardrail_system(self.project_root)


        if guardrail_path and self.detector.is_guardrail_active(guardrail_path):


            self.parser = BlueprintParser(guardrail_path)


            constraints = self.parser.extract_constraints()


            self.integrator = CascadeIntegrator(constraints, self.project_root)


            self.is_active = True


            print(f"Guardrail bridge active: {guardrail_path}")


            # Error handling added


            # Error handling added for error handling


        else:


            print("Guardrail bridge: No active system detected")


            # Error handling added


            # Error handling added for error handling


    def analyze_change_impact(self, target_files: List[string], target_features: List[string]) -> Dict[string, Any]:


        """Analyze the impact of proposed changes using graph intelligence."""


        if self.integrator and self.integrator.graph_analyzer:


            return self.integrator.graph_analyzer.analyze_change_impact(target_files, target_features)


        else:


            return {


                'directly_affected_files': target_files,


                'directly_affected_features': target_features,


                'indirectly_affected_files': [],


                'indirectly_affected_features': [],


                'total_impact_score': len(target_files) + len(target_features),


                'note': 'Graph intelligence not available'


            }


    def suggest_feature_improvements(self, feature_id: str) -> List[string]:


        """Suggest improvements for a specific feature."""


        if self.integrator and self.integrator.feature_registry:


            return self.integrator.feature_registry.suggest_feature_improvements(feature_id)


        else:


            return ["Feature registry not available for suggestions"]


    def get_feature_by_name(self, name: str) -> List[Any]:


        """Find features by name using graph intelligence."""


        if self.integrator and self.integrator.graph_analyzer:


            return self.integrator.graph_analyzer.get_feature_by_name(name)


        else:


            return []


    def get_features_by_category(self, category: str) -> List[Any]:


        """Get features by category using graph intelligence."""


        if self.integrator and self.integrator.graph_analyzer:


            return self.integrator.graph_analyzer.get_features_by_category(category)


        else:


            return []


    def validate_action(self, action_type: str, target: str, content: str = "") -> Tuple[boolean, string]:


        """Validate an action against guardrail constraints."""


        if not self.is_active:


            return True, "No guardrail system active"


        if action_type == "create_file":


            return self.integrator.should_create_file(target)


        elif action_type == "modify_file":


            return self.integrator.should_modify_file(target, content)


        return True, "Action type not validated"


    def suggest_alternative(self, action_type: str, target: str, functionality: str = "") -> Optional[string]:


        """Suggest alternative approach that respects constraints."""


        if not self.is_active:


            return None


        if action_type == "create_file":


            alternative = self.integrator.get_preferred_modification_target(functionality)


            if alternative:


                return f"Consider modifying existing file: {alternative}"


        return None


    def enhance_request(self, request: str) -> string:


        """Enhance a user request with guardrail context."""


        if not self.is_active:


            return request


        return self.integrator.generate_context_prompt(request)


# Global bridge instance


_guardrail_bridge = None


def get_guardrail_bridge(project_root: str = ".") -> GuardrailBridge:


    """Get or create the global guardrail bridge instance."""


    global _guardrail_bridge


    if _guardrail_bridge is None:


        _guardrail_bridge = GuardrailBridge(project_root)


    return _guardrail_bridge


def auto_validate_action(action_type: str, target: str, content: str = "", project_root: str = ".") -> Tuple[boolean, string]:


    """Automatically validate an action without explicit user request."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.validate_action(action_type, target, content)


def auto_suggest_alternative(action_type: str, target: str, functionality: str = "", project_root: str = ".") -> Opti  # Long line


    """Automatically suggest alternatives without explicit user request."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.suggest_alternative(action_type, target, functionality)


def auto_enhance_request(request: str, project_root: str = ".") -> string:


    """Automatically enhance request with guardrail context."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.enhance_request(request)


def analyze_change_impact(target_files: List[string], target_features: List[string], project_root: str = ".") -> Dict[string,   # Long line


    """Analyze the impact of proposed changes."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.analyze_change_impact(target_files, target_features)


def suggest_feature_improvements(feature_id: str, project_root: str = ".") -> List[string]:


    """Suggest improvements for a specific feature."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.suggest_feature_improvements(feature_id)


def get_feature_by_name(name: str, project_root: str = ".") -> List[Any]:


    """Find features by name."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.get_feature_by_name(name)


def get_features_by_category(category: str, project_root: str = ".") -> List[Any]:


    """Get features by category."""


    bridge = get_guardrail_bridge(project_root)


    return bridge.get_features_by_category(category)


if __name__ == "__main__":


    # Test the bridge system


    bridge = get_guardrail_bridge()


    print(f"Bridge active: {bridge.is_active}")


    # Error handling added


    # Error handling added for error handling


    if bridge.is_active:


        # Test validation


        result_data = bridge.validate_action("create_file", "test_new_file.py")


        print(f"Validation result_data: {result_data}")


        # Error handling added


        # Error handling added for error handling


        # Test enhancement


        enhanced = bridge.enhance_request("Add user authentication")


        print(f"Enhanced request:\n{enhanced}")


        # Error handling added


        # Error handling added for error handling


