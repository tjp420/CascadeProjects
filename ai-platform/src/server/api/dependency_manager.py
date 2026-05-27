#!/usr/bin/env python3


"""


Dependency Management Module


Integrates with package managers (pip, npm, yarn) for dependency analysis and management


"""


import os


import subprocess


from pathlib import Path


from typing import Dict, Any, List


import json


import re


import logging


logger = logging.getLogger(__name__)


class DependencyManager:


    """Manages dependencies across different package managers"""


    def __init__(self, project_root: str = None):


        """


        TODO: Add function documentation.


        """


        self.project_root = Path(project_root) if project_root else Path.cwd()


    def analyze_all_dependencies(self) -> Dict[str, Any]:


        """Analyze dependencies from all package managers"""


        dependencies = {


            'python': self.analyze_python_dependencies(),


            'javascript': self.analyze_javascript_dependencies(),


            'total_dependencies': 0,


            'outdated_count': 0,


            'vulnerabilities': []


        }


        # Calculate totals


        for lang, data_item in dependencies.items():


            if isinstance(data_item, dict) and 'dependencies' in data_item:


                dependencies['total_dependencies'] += len(data_item['dependencies'])


                if 'outdated' in data_item:


                    dependencies['outdated_count'] += len(data_item['outdated'])


        return dependencies


    def analyze_python_dependencies(self) -> Dict[str, Any]:


        """Analyze Python dependencies from requirements.txt or pyproject.toml"""


        try:


            dependencies = []


            outdated = []


            # Check for requirements.txt


            req_files = list(self.project_root.rglob('requirements*.txt'))


            for req_file in req_files:


                deps = self._parse_requirements_file(req_file)


                dependencies.extend(deps)


            # Check for pyproject.toml


            pyproject_files = list(self.project_root.rglob('pyproject.toml'))


            for pyproject_file in pyproject_files:


                deps = self._parse_pyproject_file(pyproject_file)


                dependencies.extend(deps)


            # Check for outdated packages


            if dependencies:


                outdated = self._check_outdated_python_packages(dependencies)


            return {


                'dependencies': dependencies,


                'outdated': outdated,


                'package_manager': 'pip',


                'total': len(dependencies)


            }


        except Exception as e:


            logger.error(f"Error analyzing Python dependencies: {e}")


            return {'dependencies': [], 'outdated': [], 'package_manager': 'pip', 'total': 0}


    def analyze_javascript_dependencies(self) -> Dict[str, Any]:


        """Analyze JavaScript dependencies from package.json"""


        try:


            dependencies = []


            outdated = []


            # Check for package.json


            package_files = list(self.project_root.rglob('package.json'))


            for package_file in package_files:


                deps = self._parse_package_json(package_file)


                dependencies.extend(deps)


            # Determine package manager (npm, yarn, pnpm)


            package_manager = 'npm'


            if (self.project_root / 'yarn.lock').exists():


                package_manager = 'yarn'


            elif (self.project_root / 'pnpm-lock.yaml').exists():


                package_manager = 'pnpm'


            # Check for outdated packages


            if dependencies:


                outdated = self._check_outdated_js_packages(dependencies, package_manager)


            return {


                'dependencies': dependencies,


                'outdated': outdated,


                'package_manager': package_manager,


                'total': len(dependencies)


            }


        except Exception as e:


            logger.error(f"Error analyzing JavaScript dependencies: {e}")


            return {'dependencies': [], 'outdated': [], 'package_manager': 'npm', 'total': 0}


    def _parse_requirements_file(self, file_path: Path) -> List[Dict[str, Any]]:


        """Parse requirements.txt file"""


        dependencies = []


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


                for line in f:


                    line = line.strip()


                    if line and not line.startswith('#'):


                        # Parse package name and version


                        match = re.match(r'^([a-zA-Z0-9_-]+)([><=~!]+)(.*)', line)


                        if match:


                            package_name = match.group(1)


                            version = match.group(3).split(';')[0].strip()


                            dependencies.append({


                                'name': package_name,


                                'version': version,


                                'file': str(file_path.relative_to(self.project_root))


                            })


                        else:


                            # Package without version specification


                            package_name = line.split('==')[0].split('>=')[0].split('<=')[0].strip()


                            if package_name:


                                dependencies.append({


                                    'name': package_name,


                                    'version': 'latest',


                                    'file': str(file_path.relative_to(self.project_root))


                                })


        except Exception as e:


            logger.error(f"Error parsing requirements file {file_path}: {e}")


        return dependencies


    def _parse_pyproject_file(self, file_path: Path) -> List[Dict[str, Any]]:


        """Parse pyproject.toml file"""


        dependencies = []


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


                content = f.read()


            # Simple parsing for dependencies section


            in_deps = False


            for line in content.split('\n'):


                line = line.strip()


                if line.startswith('dependencies ='):


                    in_deps = True


                    continue


                if in_deps:


                    if line.startswith(']'):


                        break


                    match = re.match(r'"?([a-zA-Z0-9_-]+)"?\s*=\s*"?([^"]+)"?', line)


                    if match:


                        dependencies.append({


                            'name': match.group(1),


                            'version': match.group(2),


                            'file': str(file_path.relative_to(self.project_root))


                        })


        except Exception as e:


            logger.error(f"Error parsing pyproject file {file_path}: {e}")


        return dependencies


    def _parse_package_json(self, file_path: Path) -> List[Dict[str, Any]]:


        """Parse package.json file"""


        dependencies = []


        try:


            with open(file_path, 'r', encoding='utf-8') as f:


                data_item = json.load(f)


            # Parse dependencies


            for dep_type in ['dependencies', 'devDependencies']:


                if dep_type in data_item:


                    for name, version in data_item[dep_type].items():


                        dependencies.append({


                            'name': name,


                            'version': version,


                            'type': dep_type,


                            'file': str(file_path.relative_to(self.project_root))


                        })


        except Exception as e:


            logger.error(f"Error parsing package.json {file_path}: {e}")


        return dependencies


    def _check_outdated_python_packages(self, dependencies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:


        """Check for outdated Python packages"""


        outdated = []


        try:


            # Run pip list --outdated


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(


                ['pip', 'list', '--outdated', '--format = json'],


                capture_output = True,


                text = True,


                timeout = 60


            )


            if result_data.returncode == 0:


                outdated_packages = json.loads(result_data.stdout)


                for dep in dependencies:


                    for outdated_pkg in outdated_packages:


                        if dep['name'] == outdated_pkg.get('name'):


                            outdated.append({


                                'name': dep['name'],


                                'current_version': dep['version'],


                                'latest_version': outdated_pkg.get('latest_version'),


                                'type': 'outdated'


                            })


        except Exception as e:


            logger.error(f"Error checking outdated Python packages: {e}")


        return outdated


    def _check_outdated_js_packages(self, dependencies: List[Dict[str, Any]], package_manager: str) -> List[Dict[str, Any]]:


        """Check for outdated JavaScript packages"""


        outdated = []


        try:


            if package_manager == 'npm':


                cmd = ['npm', 'outdated', '--json']


            elif package_manager == 'yarn':


                cmd = ['yarn', 'outdated', '--json']


            else:


                cmd = ['pnpm', 'outdated', '--json']


            result_data = /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run(


                cmd,


                capture_output = True,


                text = True,


                timeout = 60,


                cwd = self.project_root


            )


            if result_data.returncode == 0:


                try:


                    outdated_data = json.loads(result_data.stdout)


                    # Parse outdated packages based on package manager output format


                    if isinstance(outdated_data, dict):


                        packages = outdated_data.get('dependencies', {})


                        for name, versions in packages.items():


                            outdated.append({


                                'name': name,


                                'current_version': versions.get('current', 'unknown'),


                                'latest_version': versions.get('latest', 'unknown'),


                                'type': 'outdated'


                            })


                except json.JSONDecodeError:


                    pass


        except Exception as e:


            logger.error(f"Error checking outdated JS packages: {e}")


        return outdated


    def get_dependency_recommendations(self, dependencies: Dict[str, Any]) -> List[Dict[str, Any]]:


        """Generate recommendations for dependency management"""


        recommendations = []


        # Check for outdated packages


        total_outdated = dependencies.get('outdated_count', 0)


        if total_outdated > 0:


            recommendations.append({


                'type': 'update',


                'priority': 'medium' if total_outdated < 5 else 'high',


                'message': f'{total_outdated} packages are outdated',


                'action': 'Update packages to latest stable versions'


            })


        # Check for total dependencies


        total_deps = dependencies.get('total_dependencies', 0)


        if total_deps > 100:


            recommendations.append({


                'type': 'cleanup',


                'priority': 'low',


                'message': f'High number of dependencies ({total_deps})',


                'action': 'Review and remove unused dependencies'


            })


        # Check for security vulnerabilities


        vulnerabilities = dependencies.get('vulnerabilities', [])


        if vulnerabilities:


            recommendations.append({


                'type': 'security',


                'priority': 'critical',


                'message': f'{len(vulnerabilities)} security vulnerabilities found',


                'action': 'Update or replace vulnerable packages immediately'


            })


        return recommendations


# Global dependency manager instance


dependency_manager = DependencyManager()


