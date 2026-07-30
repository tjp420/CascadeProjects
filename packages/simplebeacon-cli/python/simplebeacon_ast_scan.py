#!/usr/bin/env python3
"""
SimpleBeacon Python AST scanner — detects algorithmic redundancy and AI slop patterns.
Uses Python's built-in ast module. No external dependencies required.

Usage:
    python simplebeacon_ast_scan.py --root /path/to/project --production-paths server/,src/,app/,lib/
"""

import ast
import argparse
import json
import os
import sys
import hashlib
from pathlib import Path

SCAN_TIMEOUT_S = 120
MAX_FILE_BYTES = 512_000

SKIP_DIRS = {
    'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
    '.simplebeacon', 'tests', 'test', '__tests__', 'fixtures', 'docs',
    'venv', '.venv', 'env', '.env', '.tox', '.mypy_cache', '.pytest_cache',
    '__pycache__', 'site-packages',
}


def is_excluded(rel_path):
    parts = rel_path.replace('\\', '/').split('/')
    for part in parts:
        if part in SKIP_DIRS:
            return True
    return False


def is_under_production_paths(rel_path, production_paths):
    if not production_paths:
        return True
    rel = rel_path.replace('\\', '/')
    for pp in production_paths:
        pp = pp.strip().rstrip('/')
        if not pp:
            continue
        if rel.startswith(pp + '/') or rel == pp:
            return True
    return False


def normalize_body(node):
    """Serialize an AST node body to a canonical string for comparison."""
    try:
        return ast.dump(node, annotate_fields=False, include_attributes=False)
    except Exception:
        return ''


def body_hash(node):
    """Produce a hash of a function body for duplicate detection."""
    body_str = normalize_body(node)
    if not body_str:
        return None
    return hashlib.md5(body_str.encode('utf-8')).hexdigest()


def get_func_name(node):
    if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
        return node.name
    return '<anonymous>'


def get_line(node):
    return getattr(node, 'lineno', 1)


def is_stub_body(body):
    """Check if a function body is a stub (returns None immediately or just pass)."""
    if not body or len(body) == 0:
        return True
    if len(body) == 1:
        stmt = body[0]
        if isinstance(stmt, ast.Return):
            val = stmt.value
            if val is None:
                return True
            if isinstance(val, ast.Constant) and val.value is None:
                return True
        if isinstance(stmt, ast.Pass):
            return True
    return False


SLOP_PATTERN_STRINGS = [
    'mock_data', 'sample.json', 'test-api', 'placeholder', 'dummy-key',
    'todo_truncate_this', 'mock', 'fake', 'stub_data',
]

HIGH_RISK_TERMS = [
    'biometric', 'facial_recognition', 'credit_score', 'loan_approval',
    'resume_screen', 'hiring_filter', 'polygraph', 'recidivism',
]

LLM_CALL_NAMES = {'create', 'generate', 'invoke', 'stream', 'batch'}
LLM_CLIENT_ATTRS = {'chat', 'completions', 'messages', 'responses', 'embeddings'}
TOKEN_LIMIT_KEYS = {'max_tokens', 'max_completion_tokens', 'maxOutputTokens', 'max_tokens_to_sample'}


def contains_slop_string(s):
    s_lower = s.lower()
    return any(p in s_lower for p in SLOP_PATTERN_STRINGS)


def contains_high_risk_term(s):
    s_lower = s.lower()
    return any(t in s_lower for t in HIGH_RISK_TERMS)


def is_llm_call(node):
    """Check if a Call node looks like an LLM API call."""
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Attribute):
        if func.attr in LLM_CALL_NAMES:
            obj = func.value
            if isinstance(obj, ast.Attribute) and obj.attr in LLM_CLIENT_ATTRS:
                return True
            if isinstance(obj, ast.Name) and obj.id.lower() in ('openai', 'anthropic', 'claude', 'llm', 'client'):
                return True
    if isinstance(func, ast.Name) and func.id in LLM_CALL_NAMES:
        return True
    return False


def has_token_limit(call_node):
    """Check if an LLM call has a max_tokens parameter."""
    for kw in (call_node.keywords or []):
        if kw.arg and kw.arg in TOKEN_LIMIT_KEYS:
            return True
    return False


def scan_file(file_path, rel_path):
    """Scan a single Python file and return findings."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            return findings
    except Exception:
        return findings

    try:
        tree = ast.parse(content, filename=rel_path)
    except SyntaxError:
        return findings

    # Collect all function definitions
    functions = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(node)

    # --- SB-PY-FICTION-001: Hardcoded placeholder strings ---
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            val = node.value
            if contains_slop_string(val):
                findings.append({
                    'pattern': 'SB-PY-FICTION-001',
                    'category': 'ai-fiction',
                    'type': 'AI Slop / Mock Leak',
                    'severity': 'medium',
                    'file': rel_path,
                    'line': getattr(node, 'lineno', 1),
                    'details': f"Hardcoded placeholder string: '{val[:80]}'",
                })
            if contains_high_risk_term(val):
                findings.append({
                    'pattern': 'SB-PY-EU-001',
                    'category': 'eu-ai-act',
                    'type': 'EU AI Act — High-Risk Indicator',
                    'severity': 'high',
                    'file': rel_path,
                    'line': getattr(node, 'lineno', 1),
                    'details': f"String triggers Annex III review: '{val[:80]}'",
                })

    # --- SB-PY-FICTION-002: Stub functions ---
    for func in functions:
        if is_stub_body(func.body):
            findings.append({
                'pattern': 'SB-PY-FICTION-002',
                'category': 'ai-fiction',
                'type': 'Dead / Mock Function',
                'severity': 'medium',
                'file': rel_path,
                'line': get_line(func),
                'details': f"Function '{get_func_name(func)}' returns None immediately — likely AI stub",
            })

    # --- SB-PY-TB-001: LLM calls without token limits ---
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and is_llm_call(node):
            if not has_token_limit(node):
                findings.append({
                    'pattern': 'SB-PY-TB-001',
                    'category': 'token-bleed',
                    'type': 'Token Bleed',
                    'severity': 'medium',
                    'file': rel_path,
                    'line': get_line(node),
                    'details': 'LLM call without max_tokens / max_completion_tokens',
                })

    # --- SB-PY-REDUNDANCY-001: Duplicate function bodies ---
    body_map = {}
    for func in functions:
        h = body_hash(func)
        if h:
            body_map.setdefault(h, []).append(func)

    for h, funcs in body_map.items():
        if len(funcs) >= 2:
            names = [get_func_name(f) for f in funcs]
            first_line = get_line(funcs[0])
            findings.append({
                'pattern': 'SB-PY-REDUNDANCY-001',
                'category': 'algorithmic-redundancy',
                'type': 'Duplicate Function Body',
                'severity': 'medium',
                'file': rel_path,
                'line': first_line,
                'details': f"{len(funcs)} functions share identical bodies: {', '.join(names[:5])}",
            })

    # --- SB-PY-REDUNDANCY-002: Redundant try/except wrappers ---
    try_except_count = 0
    func_count = 0
    for func in functions:
        func_count += 1
        if len(func.body) == 1 and isinstance(func.body[0], ast.Try):
            try_except_count += 1

    if func_count >= 3 and try_except_count / func_count > 0.8:
        findings.append({
            'pattern': 'SB-PY-REDUNDANCY-002',
            'category': 'algorithmic-redundancy',
            'type': 'Redundant Try/Except Wrappers',
            'severity': 'low',
            'file': rel_path,
            'line': 1,
            'details': f"{try_except_count}/{func_count} functions are single-statement try/except — possible boilerplate",
        })

    # --- SB-PY-REDUNDANCY-003: Repeated exception handlers ---
    except_bodies = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler):
            body_str = normalize_body(node)
            if body_str:
                except_bodies.append(body_str)

    if len(except_bodies) >= 3:
        from collections import Counter
        counter = Counter(except_bodies)
        most_common, count = counter.most_common(1)[0]
        if count / len(except_bodies) > 0.8:
            findings.append({
                'pattern': 'SB-PY-REDUNDANCY-003',
                'category': 'algorithmic-redundancy',
                'type': 'Identical Exception Handlers',
                'severity': 'low',
                'file': rel_path,
                'line': 1,
                'details': f"{count}/{len(except_bodies)} except blocks have identical bodies — possible boilerplate",
            })

    # --- SB-PY-REDUNDANCY-004: Deep nesting (complexity) ---
    for func in functions:
        max_depth = 0

        def measure_depth(node, current=0):
            nonlocal max_depth
            if current > max_depth:
                max_depth = current
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.If, ast.For, ast.While, ast.With, ast.Try)):
                    measure_depth(child, current + 1)
                else:
                    measure_depth(child, current)

        for stmt in func.body:
            measure_depth(stmt, 1)

        if max_depth >= 6:
            findings.append({
                'pattern': 'SB-PY-REDUNDANCY-004',
                'category': 'algorithmic-redundancy',
                'type': 'Deep Nesting / High Complexity',
                'severity': 'medium',
                'file': rel_path,
                'line': get_line(func),
                'details': f"Function '{get_func_name(func)}' has nesting depth {max_depth} — consider refactoring",
            })

    return findings


def walk_python_files(root, production_paths):
    """Walk directory tree and yield Python files to scan."""
    for dirpath, dirnames, filenames in os.walk(root):
        # Filter skip dirs in-place
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.')]

        for filename in filenames:
            if not filename.endswith('.py'):
                continue
            full_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(full_path, root).replace('\\', '/')
            if is_excluded(rel_path):
                continue
            if not is_under_production_paths(rel_path, production_paths):
                continue
            yield full_path, rel_path


def main():
    parser = argparse.ArgumentParser(description='SimpleBeacon Python AST scanner')
    parser.add_argument('--root', required=True, help='Project root directory')
    parser.add_argument('--production-paths', default='server/,src/,app/,lib/', help='Comma-separated production paths')
    parser.add_argument('--files', default=None, help='Comma-separated specific files to scan')
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    production_paths = [p.strip() for p in args.production_paths.split(',') if p.strip()]

    all_findings = []
    files_scanned = 0
    errors = []

    if args.files:
        file_list = [f.strip() for f in args.files.split(',') if f.strip()]
        for f in file_list:
            if not os.path.isfile(f):
                continue
            rel = os.path.relpath(f, root).replace('\\', '/')
            files_scanned += 1
            try:
                file_findings = scan_file(f, rel)
                all_findings.extend(file_findings)
            except Exception as e:
                errors.append(f"{rel}: {str(e)}")
    else:
        for full_path, rel_path in walk_python_files(root, production_paths):
            files_scanned += 1
            try:
                file_findings = scan_file(full_path, rel_path)
                all_findings.extend(file_findings)
            except Exception as e:
                errors.append(f"{rel_path}: {str(e)}")

    output = {
        'scanned': files_scanned,
        'filesVisited': files_scanned,
        'findings': all_findings,
        'findingsCount': len(all_findings),
        'errors': errors,
    }

    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
