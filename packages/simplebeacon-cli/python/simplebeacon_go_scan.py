#!/usr/bin/env python3
"""
SimpleBeacon Go AST scanner — detects algorithmic redundancy in Go microservices.
Uses a regex-based structural analysis fallback since Go's parser requires Go runtime.
Falls back to heuristic pattern matching when Go toolchain is unavailable.

Usage:
    python simplebeacon_go_scan.py --root /path/to/project --production-paths server/,src/,app/,cmd/,internal/
"""

import argparse
import json
import os
import re
import hashlib
from collections import Counter

MAX_FILE_BYTES = 512_000

SKIP_DIRS = {
    'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
    '.simplebeacon', 'tests', 'test', 'vendor', 'docs', 'examples',
    '.vscode', '.idea', 'bin', 'tmp',
}

GO_FILE_RE = re.compile(r'\.go$')

# Patterns for detecting algorithmic redundancy in Go
FUNC_DEF_RE = re.compile(r'^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(', re.MULTILINE)
FUNC_BODY_RE = re.compile(r'^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)\s*(?:\{)', re.MULTILINE | re.DOTALL)

STUB_RETURN_RE = re.compile(r'func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)[^{]*\{\s*(?:return\s*(?:nil|""|0|false|err)?\s*;?\s*)?\}', re.MULTILINE)

DEEP_NESTING_THRESHOLD = 6

# Duplicate function body detection via normalized text
def normalize_go_body(body_text):
    """Normalize Go function body for comparison by stripping whitespace and comments."""
    # Remove comments
    text = re.sub(r'//.*?$', '', body_text, flags=re.MULTILINE)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def body_hash(normalized):
    if not normalized or len(normalized) < 20:
        return None
    return hashlib.md5(normalized.encode('utf-8')).hexdigest()

def extract_func_bodies(content):
    """Extract function names and their body text from Go source."""
    functions = []
    # Find all func declarations with bodies
    for match in re.finditer(r'^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\([^)]*\)\s*(?:[\w\s\*]*?)\{', content, re.MULTILINE):
        func_name = match.group(1)
        start = match.start()
        # Find matching closing brace
        brace_count = 0
        body_start = content.index('{', match.start())
        i = body_start
        while i < len(content):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    body = content[body_start+1:i]
                    functions.append({
                        'name': func_name,
                        'body': body,
                        'line': content[:match.start()].count('\n') + 1,
                        'body_start': body_start + 1,
                        'body_end': i,
                    })
                    break
            i += 1
    return functions

def count_nesting_depth(body, start_idx=0, depth=0):
    """Count maximum nesting depth in a Go function body."""
    max_depth = depth
    i = start_idx
    while i < len(body):
        ch = body[i]
        if ch == '{':
            max_depth = max(max_depth, count_nesting_depth(body, i + 1, depth + 1))
            # Skip to matching brace
            brace_count = 1
            i += 1
            while i < len(body) and brace_count > 0:
                if body[i] == '{':
                    brace_count += 1
                elif body[i] == '}':
                    brace_count -= 1
                i += 1
            continue
        i += 1
    return max_depth

def is_stub_body(body):
    """Check if a Go function body is a stub."""
    stripped = body.strip()
    if not stripped:
        return True
    # Just a return with nil/zero
    if re.match(r'^(?:return\s+(?:nil|""|0|false|nil,\s*nil)\s*)?$', stripped):
        return True
    if stripped == 'panic("not implemented")':
        return True
    if stripped == 'panic("TODO")':
        return True
    return False

# LLM call patterns in Go
LLM_CALL_RE = re.compile(r'\b(?:openai|anthropic|claude|llm|client)\.(?:Create|Generate|Invoke|Stream|Batch|Chat|Complete|Embed)\b', re.IGNORECASE)
TOKEN_LIMIT_RE = re.compile(r'MaxTokens|max_tokens|MaxCompletionTokens', re.IGNORECASE)

# High-risk terms
HIGH_RISK_RE = re.compile(r'(?:biometric|facial_recognition|credit_score|loan_approval|resume_screen|hiring_filter|polygraph|recidivism)', re.IGNORECASE)

# Slop patterns
SLOP_RE = re.compile(r'(?:mock_data|sample\.json|test-api|placeholder|dummy-key|todo_truncate_this|stub_data|fake_data)', re.IGNORECASE)

# Repeated error handling
ERR_HANDLER_RE = re.compile(r'if\s+err\s*!=\s*nil\s*\{([^}]+)\}', re.MULTILINE)


def scan_go_file(file_path, rel_path):
    """Scan a single Go file and return findings."""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            return findings
    except Exception:
        return findings

    # --- SB-GO-FICTION-001: Slop strings ---
    for match in SLOP_RE.finditer(content):
        line = content[:match.start()].count('\n') + 1
        findings.append({
            'pattern': 'SB-GO-FICTION-001',
            'category': 'ai-fiction',
            'type': 'AI Slop / Mock Leak',
            'severity': 'medium',
            'file': rel_path,
            'line': line,
            'details': f"Hardcoded placeholder string: '{match.group()[:80]}'",
        })

    # --- SB-GO-EU-001: High-risk terms ---
    for match in HIGH_RISK_RE.finditer(content):
        line = content[:match.start()].count('\n') + 1
        findings.append({
            'pattern': 'SB-GO-EU-001',
            'category': 'eu-ai-act',
            'type': 'EU AI Act — High-Risk Indicator',
            'severity': 'high',
            'file': rel_path,
            'line': line,
            'details': f"Identifier triggers Annex III review: '{match.group()[:80]}'",
        })

    # Extract function bodies
    functions = extract_func_bodies(content)

    # --- SB-GO-FICTION-002: Stub functions ---
    for func in functions:
        if is_stub_body(func['body']):
            findings.append({
                'pattern': 'SB-GO-FICTION-002',
                'category': 'ai-fiction',
                'type': 'Dead / Mock Function',
                'severity': 'medium',
                'file': rel_path,
                'line': func['line'],
                'details': f"Function '{func['name']}' appears to be a stub — returns nil/zero or panics",
            })

    # --- SB-GO-REDUNDANCY-001: Duplicate function bodies ---
    body_map = {}
    for func in functions:
        normalized = normalize_go_body(func['body'])
        h = body_hash(normalized)
        if h:
            body_map.setdefault(h, []).append(func)

    for h, funcs in body_map.items():
        if len(funcs) >= 2:
            names = [f['name'] for f in funcs]
            findings.append({
                'pattern': 'SB-GO-REDUNDANCY-001',
                'category': 'algorithmic-redundancy',
                'type': 'Duplicate Function Body',
                'severity': 'medium',
                'file': rel_path,
                'line': funcs[0]['line'],
                'details': f"{len(funcs)} functions share identical bodies: {', '.join(names[:5])}",
            })

    # --- SB-GO-REDUNDANCY-002: Repeated error handling ---
    err_handlers = []
    for match in ERR_HANDLER_RE.finditer(content):
        handler_body = match.group(1).strip()
        if handler_body:
            err_handlers.append(handler_body)

    if len(err_handlers) >= 5:
        counter = Counter(err_handlers)
        most_common, count = counter.most_common(1)[0]
        if count / len(err_handlers) > 0.7:
            line = content[:ERR_HANDLER_RE.search(content).start()].count('\n') + 1
            findings.append({
                'pattern': 'SB-GO-REDUNDANCY-002',
                'category': 'algorithmic-redundancy',
                'type': 'Identical Error Handlers',
                'severity': 'low',
                'file': rel_path,
                'line': line,
                'details': f"{count}/{len(err_handlers)} error handlers are identical — consider wrapping with a helper",
            })

    # --- SB-GO-REDUNDANCY-003: Deep nesting ---
    for func in functions:
        depth = count_nesting_depth(func['body'])
        if depth >= DEEP_NESTING_THRESHOLD:
            findings.append({
                'pattern': 'SB-GO-REDUNDANCY-003',
                'category': 'algorithmic-redundancy',
                'type': 'Deep Nesting / High Complexity',
                'severity': 'medium',
                'file': rel_path,
                'line': func['line'],
                'details': f"Function '{func['name']}' has nesting depth {depth} — consider refactoring with guard clauses",
            })

    # --- SB-GO-REDUNDANCY-004: Deeply nested if-blocks ---
    NESTED_IF_RE = re.compile(r'if\s+[^\{]+\{\s*\n\s+if\s+[^\{]+\{\s*\n\s+\S', re.MULTILINE)
    for match in NESTED_IF_RE.finditer(content):
        line = content[:match.start()].count('\n') + 1
        findings.append({
            'pattern': 'SB-GO-REDUNDANCY-004',
            'category': 'algorithmic-redundancy',
            'type': 'Deeply Nested If-Blocks',
            'severity': 'medium',
            'file': rel_path,
            'line': line,
            'details': f"Deeply nested if-blocks at line {line} — extract guard clauses for early returns",
        })

    # --- SB-GO-TB-001: LLM calls without token limits ---
    for match in LLM_CALL_RE.finditer(content):
        line = content[:match.start()].count('\n') + 1
        # Check surrounding 500 chars for token limit
        context_start = max(0, match.start() - 200)
        context_end = min(len(content), match.end() + 500)
        context = content[context_start:context_end]
        if not TOKEN_LIMIT_RE.search(context):
            findings.append({
                'pattern': 'SB-GO-TB-001',
                'category': 'token-bleed',
                'type': 'Token Bleed',
                'severity': 'medium',
                'file': rel_path,
                'line': line,
                'details': f"LLM call '{match.group()[:60]}' without MaxTokens parameter",
            })

    return findings


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


def walk_go_files(root, production_paths):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.')]
        for filename in filenames:
            if not GO_FILE_RE.search(filename):
                continue
            if filename.endswith('_test.go'):
                continue
            full_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(full_path, root).replace('\\', '/')
            if is_excluded(rel_path):
                continue
            if not is_under_production_paths(rel_path, production_paths):
                continue
            yield full_path, rel_path


def main():
    parser = argparse.ArgumentParser(description='SimpleBeacon Go AST scanner')
    parser.add_argument('--root', required=True, help='Project root directory')
    parser.add_argument('--production-paths', default='server/,src/,app/,cmd/,internal/', help='Comma-separated production paths')
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
            if not os.path.isfile(f) or not f.endswith('.go'):
                continue
            rel = os.path.relpath(f, root).replace('\\', '/')
            files_scanned += 1
            try:
                all_findings.extend(scan_go_file(f, rel))
            except Exception as e:
                errors.append(f"{rel}: {str(e)}")
    else:
        for full_path, rel_path in walk_go_files(root, production_paths):
            files_scanned += 1
            try:
                all_findings.extend(scan_go_file(full_path, rel_path))
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
