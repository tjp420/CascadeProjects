#!/usr/bin/env python3
"""
Local AST scanners for Python sources — no network, no external APIs.
Stdout: JSON { findings, scanned, errors } for SimpleBeacon CLI merge.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys
from typing import Any

SKIP_DIR_NAMES = {
    'node_modules', '.git', 'coverage', 'dist', 'build', 'tests', 'test',
    '__tests__', 'fixtures', 'docs', 'examples', '.simplebeacon'
}

SLOP_PATTERN = re.compile(
    r'(mock_data|sample\.json|test-api|placeholder|todo_truncate_this|dummy-key|'
    r'mock/|fixtures/|-sample\.json)',
    re.IGNORECASE
)

HIGH_RISK_TERMS = re.compile(
    r'(biometric|facial_recognition|credit_score|loan_approval|resume_screen|'
    r'hiring_filter|polygraph|recidivism)',
    re.IGNORECASE
)

LLM_CALL_ATTRS = frozenset({'create', 'generate', 'invoke', 'stream', 'batch'})
TOKEN_LIMIT_KEYS = frozenset({'max_tokens', 'max_completion_tokens', 'limit', 'max_output_tokens'})


def _rel_path(root: str, filepath: str) -> str:
    try:
        return os.path.relpath(filepath, root).replace('\\', '/')
    except ValueError:
        return filepath.replace('\\', '/')


def _under_production(rel: str, prefixes: list[str]) -> bool:
    norm = rel.replace('\\', '/')
    for prefix in prefixes:
        p = prefix.strip('/').replace('\\', '/')
        if not p:
            continue
        if norm == p or norm.startswith(p + '/'):
            return True
    return False


def _should_skip_file(rel: str) -> bool:
    low = rel.lower()
    if '/tests/' in low or low.startswith('tests/'):
        return True
    if '/__tests__/' in low:
        return True
    if '.test.py' in low or '.spec.py' in low:
        return True
    if '/fixtures/' in low or '/docs/' in low or '/examples/' in low:
        return True
    if 'simplebeacon_ast_scan.py' in low:
        return True
    return False


class AIFictionScanner(ast.NodeVisitor):
    def __init__(self, rel_file: str):
        self.rel_file = rel_file
        self.findings: list[dict[str, Any]] = []

    def _string(self, value: str, lineno: int) -> None:
        if SLOP_PATTERN.search(value):
            self.findings.append({
                'file': self.rel_file,
                'line': lineno,
                'pattern': 'SB-PY-FICTION-001',
                'category': 'ai-fiction',
                'type': 'AI Slop / Mock Leak',
                'severity': 'medium',
                'details': f"Hardcoded placeholder string detected: '{value[:120]}'"
            })

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str):
            self._string(node.value, node.lineno)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        if len(node.body) == 1 and isinstance(node.body[0], ast.Return):
            ret_val = node.body[0].value
            if isinstance(ret_val, ast.Constant) and ret_val.value is None:
                self.findings.append({
                    'file': self.rel_file,
                    'line': node.lineno,
                    'pattern': 'SB-PY-FICTION-002',
                    'category': 'ai-fiction',
                    'type': 'Dead / Mock Function',
                    'severity': 'medium',
                    'details': f"Function '{node.name}' returns None immediately — likely AI stub."
                })
        self.generic_visit(node)


class TokenBleedScanner(ast.NodeVisitor):
    def __init__(self, rel_file: str):
        self.rel_file = rel_file
        self.findings: list[dict[str, Any]] = []

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        attr_name = None
        if isinstance(func, ast.Attribute):
            attr_name = func.attr
        if attr_name in LLM_CALL_ATTRS:
            has_limit = any(
                isinstance(kw, ast.keyword) and kw.arg in TOKEN_LIMIT_KEYS
                for kw in node.keywords
            )
            if not has_limit:
                label = attr_name
                if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Attribute):
                    label = f'{func.value.attr}.{attr_name}'
                self.findings.append({
                    'file': self.rel_file,
                    'line': node.lineno,
                    'pattern': 'SB-PY-TB-001',
                    'category': 'token-bleed',
                    'type': 'Token Bleed',
                    'severity': 'medium',
                    'details': (
                        f"Unbounded LLM invocation via '{label}'. "
                        "Missing explicit max_tokens / max_completion_tokens."
                    )
                })
        self.generic_visit(node)


class EUAIActScanner(ast.NodeVisitor):
    def __init__(self, rel_file: str):
        self.rel_file = rel_file
        self.findings: list[dict[str, Any]] = []
        self._seen: set[tuple[str, int]] = set()

    def _flag(self, name: str, lineno: int, kind: str) -> None:
        key = (name, lineno)
        if key in self._seen:
            return
        if not HIGH_RISK_TERMS.search(name):
            return
        self._seen.add(key)
        self.findings.append({
            'file': self.rel_file,
            'line': lineno,
            'pattern': 'SB-PY-EU-001',
            'category': 'eu-ai-act',
            'type': 'EU AI Act — High-Risk Indicator',
            'severity': 'high',
            'details': (
                f"{kind} '{name}' triggers Annex III high-risk assessment review."
            )
        })

    def visit_Name(self, node: ast.Name) -> None:
        self._flag(node.id, node.lineno, 'Variable/entity')
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._flag(node.name, node.lineno, 'Function')
        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str):
            self._flag(node.value, node.lineno, 'String literal')
        self.generic_visit(node)


def scan_file(root: str, filepath: str, production_prefixes: list[str]) -> list[dict[str, Any]]:
    rel = _rel_path(root, filepath)
    if _should_skip_file(rel):
        return []
    if not _under_production(rel, production_prefixes):
        return []

    try:
        with open(filepath, 'r', encoding='utf-8') as handle:
            source = handle.read()
    except OSError:
        return []

    if len(source) > 512000:
        return []

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError:
        return []

    scanners = [
        AIFictionScanner(rel),
        TokenBleedScanner(rel),
        EUAIActScanner(rel)
    ]
    findings: list[dict[str, Any]] = []
    for scanner in scanners:
        scanner.visit(tree)
        findings.extend(scanner.findings)
    return findings


def collect_py_files(root: str, explicit_files: list[str] | None) -> list[str]:
    if explicit_files:
        return [os.path.abspath(f) for f in explicit_files if f.endswith('.py') and os.path.isfile(f)]

    results: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for name in filenames:
            if name.endswith('.py'):
                results.append(os.path.join(dirpath, name))
    return results


def run_scan(root: str, production_prefixes: list[str], explicit_files: list[str] | None = None) -> dict[str, Any]:
    root = os.path.abspath(root)
    files = collect_py_files(root, explicit_files)
    all_findings: list[dict[str, Any]] = []
    errors: list[str] = []
    scanned = 0

    for filepath in files:
        try:
            batch = scan_file(root, filepath, production_prefixes)
            if batch:
                scanned += 1
            all_findings.extend(batch)
        except Exception as exc:  # noqa: BLE001 — skip broken files, report count only
            errors.append(f'{filepath}: {exc}')

    return {
        'findings': all_findings,
        'scanned': scanned,
        'filesVisited': len(files),
        'errors': errors[:20]
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='SimpleBeacon Python AST scan')
    parser.add_argument('--root', required=True, help='Project root for relative paths')
    parser.add_argument(
        '--production-paths',
        default='server/,src/,app/,lib/',
        help='Comma-separated production path prefixes'
    )
    parser.add_argument(
        '--files',
        default='',
        help='Comma-separated absolute paths (optional; limits scan)'
    )
    args = parser.parse_args()
    prefixes = [p.strip() for p in args.production_paths.split(',') if p.strip()]
    explicit = [f.strip() for f in args.files.split(',') if f.strip()] or None
    payload = run_scan(args.root, prefixes, explicit)
    json.dump(payload, sys.stdout, indent=2)
    return 0


if __name__ == '__main__':
    sys.exit(main())
