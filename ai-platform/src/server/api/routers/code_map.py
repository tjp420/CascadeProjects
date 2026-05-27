"""


Code Map Router


Provides endpoints for code structure visualization and dependency analysis


"""


from fastapi import APIRouter, HTTPException


from pydantic import BaseModel


from typing import Dict, List, Optional, Any


import os


import ast


import re


from pathlib import Path


import json


router = APIRouter(prefix="/code-map", tags=["code-map"])


class CodeNode(BaseModel):


    """Represents a file or module in the code map"""


    id: str


    name: str


    path: str


    type: str  # 'file', 'directory', 'module'


    language: Optional[str] = None


    dependencies: List[str] = []


    imported_by: List[str] = []


class CodeMapResponse(BaseModel):


    """Response containing the complete code map structure"""


    nodes: List[CodeNode]


    edges: List[Dict[str, str]]


    statistics: Dict[str, Any]


def analyze_python_file(file_path: Path, base_path: Path) -> Dict[str, Any]:


    """Analyze a Python file for imports and dependencies"""


    try:


        with open(file_path, 'r', encoding='utf-8') as f:


            content = f.read()


        tree = ast.parse(content)


        imports = []


        for node in ast.walk(tree):


            if isinstance(node, ast.Import):


                for alias in node.names:


                    imports.append(alias.name)


            elif isinstance(node, ast.ImportFrom):


                module = node.module or ''


                for alias in node.names:


                    imports.append(f"{module}.{alias.name}" if module else alias.name)


        return {


            'imports': imports,


            'classes': [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)],


            'functions': [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]


        }


    except Exception as e:


        return {'imports': [], 'classes': [], 'functions': [], 'error': str(e)}


def analyze_javascript_file(file_path: Path, base_path: Path) -> Dict[str, Any]:


    """Analyze a JavaScript/TypeScript file for imports and dependencies"""


    try:


        with open(file_path, 'r', encoding='utf-8') as f:


            content = f.read()


        imports = []


        # Match ES6 imports: import ... from '...'


        es6_pattern = r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]'


        imports.extend(re.findall(es6_pattern, content))


        # Match CommonJS requires: require('...')


        commonjs_pattern = r'require\([\'"]([^\'"]+)[\'"]\)'


        imports.extend(re.findall(commonjs_pattern, content))


        return {


            'imports': imports,


            'classes': [],  # Would need proper JS parser


            'functions': []


        }


    except Exception as e:


        return {'imports': [], 'classes': [], 'functions': [], 'error': str(e)}


def build_code_map(directory: Path, base_path: Path, language: str = 'all', max_files: int = 100) -> Dict[str, Any]:


    """Recursively build code map from directory structure"""


    nodes = []


    edges = []


    import_map = {}  # file -> list of imports


    file_count = 0


    python_extensions = {'.py'}


    javascript_extensions = {'.js', '.jsx', '.ts', '.tsx'}


    if language == 'python':


        target_extensions = python_extensions


    elif language == 'javascript':


        target_extensions = javascript_extensions


    else:


        target_extensions = python_extensions | javascript_extensions


    for root, dirs, files in os.walk(directory):


        root_path = Path(root)


        # Skip hidden directories and common ignore directories


        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'}]


        # Add directory node


        rel_path = root_path.relative_to(base_path)


        dir_id = str(rel_path).replace('\\', '/') if str(rel_path) != '.' else 'root'


        nodes.append({


            'id': dir_id,


            'name': root_path.name,


            'path': str(rel_path),


            'type': 'directory',


            'language': None,


            'dependencies': [],


            'imported_by': []


        })


        # Process files (limit to max_files to prevent timeout)


        for file in files:


            if file_count >= max_files:


                print(f"[DEBUG] Reached max files limit ({max_files}), stopping analysis")


                break


            file_path = root_path / file


            ext = file_path.suffix


            if ext in target_extensions:


                file_count += 1


                rel_file_path = file_path.relative_to(base_path)


                file_id = str(rel_file_path).replace('\\', '/')


                # Determine language


                if ext in python_extensions:


                    file_language = 'python'


                    analysis = analyze_python_file(file_path, base_path)


                elif ext in javascript_extensions:


                    file_language = 'javascript'


                    analysis = analyze_javascript_file(file_path, base_path)


                else:


                    file_language = None


                    analysis = {'imports': [], 'classes': [], 'functions': []}


                # Add file node


                nodes.append({


                    'id': file_id,


                    'name': file,


                    'path': str(rel_file_path),


                    'type': 'file',


                    'language': file_language,


                    'dependencies': analysis['imports'],


                    'imported_by': []


                })


                # Track imports for edge creation


                import_map[file_id] = analysis['imports']


                # Add directory edge


                edges.append({


                    'source': dir_id,


                    'target': file_id,


                    'type': 'contains'


                })


    # Create dependency edges based on imports (limit to prevent timeout)


    import_edge_count = 0


    max_import_edges = 200


    for file_id, imports in import_map.items():


        if import_edge_count >= max_import_edges:


            print(f"[DEBUG] Reached max import edges limit ({max_import_edges}), stopping edge creation")


            break


        for imp in imports:


            # Try to find matching file in nodes


            for node in nodes:


                if node['type'] == 'file':


                    # Simple matching: check if import matches file name


                    if imp.replace('.', '/') in node['id'] or imp in node['name']:


                        edges.append({


                            'source': file_id,


                            'target': node['id'],


                            'type': 'imports'


                        })


                        import_edge_count += 1


                        break


    # Calculate statistics


    python_files = [n for n in nodes if n['language'] == 'python']


    javascript_files = [n for n in nodes if n['language'] == 'javascript']


    statistics = {


        'total_files': len([n for n in nodes if n['type'] == 'file']),


        'total_directories': len([n for n in nodes if n['type'] == 'directory']),


        'python_files': len(python_files),


        'javascript_files': len(javascript_files),


        'total_dependencies': len([e for e in edges if e['type'] == 'imports']),


        'files_analyzed': file_count,


        'max_files_limit': max_files


    }


    return {


        'nodes': nodes,


        'edges': edges,


        'statistics': statistics


    }


@router.get("/", response_model = CodeMapResponse)


async def get_code_map(


    directory: str = "web",


    language: str = "all"


):


    """


    Generate code map for specified directory


    Parameters:


    - directory: Root directory to analyze (default: 'web')


    - language: Filter by language ('python', 'javascript', or 'all')


    """


    try:


        import time


        start_time = time.time()


        base_path = Path(directory)


        if not base_path.exists():


            raise HTTPException(status_code = 404, detail = f"Directory not found: {directory}")


        print(f"[DEBUG] Building code map for {directory} (language: {language})")


        code_map = build_code_map(base_path, base_path, language)


        elapsed_time = time.time() - start_time


        print(f"[DEBUG] Code map built in {elapsed_time:.2f}s - {len(code_map['nodes'])} nodes, {len(code_map['edges'])} edges")


        return CodeMapResponse(


            nodes = code_map['nodes'],


            edges = code_map['edges'],


            statistics = code_map['statistics']


        )


    except Exception as e:


        print(f"[ERROR] Error building code map: {str(e)}")


        import traceback


        traceback.print_exc()


        raise HTTPException(status_code = 500, detail = str(e))


@router.get("/statistics")


async def get_code_statistics(


    directory: str = "web",


    language: str = "all"


):


    """Get code statistics without full map"""


    try:


        base_path = Path(directory)


        if not base_path.exists():


            raise HTTPException(status_code = 404, detail = f"Directory not found: {directory}")


        code_map = build_code_map(base_path, base_path, language)


        return code_map['statistics']


    except Exception as e:


        raise HTTPException(status_code = 500, detail = str(e))


