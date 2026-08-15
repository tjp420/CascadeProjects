#!/usr/bin/env python3
"""Local Python AST sidecar for SimpleBeacon. Stdlib only. Prints JSON to stdout."""
from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys

SLOP_RE = re.compile(
    r"(?:mock_data|sample\.json|test-api|placeholder|todo_truncate_this|dummy-key|"
    r"(?:/|\\)mock(?:/|\\)|-sample\.json|YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE)",
    re.I,
)
HIGH_RISK_RE = re.compile(
    r"(?:biometric|facial_recognition|credit_score|loan_approval|resume_screen|"
    r"hiring_filter|polygraph|recidivism)",
    re.I,
)
TOKEN_LIMIT_KEYS = {
    "max_tokens",
    "max_completion_tokens",
    "max_tokens_to_sample",
    "maxOutputTokens",
}
LLM_TAILS = {"create", "generate", "invoke", "stream", "batch", "streamtext", "generatetext"}
LLM_LABEL_RE = re.compile(
    r"(?:openai|anthropic|claude|gpt|llm|chat\.completion|completion|embedding|ai\.)",
    re.I,
)
LLM_EXACT_RE = re.compile(
    r"openai\.chat\.completions\.create|anthropic\.messages\.create|"
    r"\.chat\.completions\.create|\.responses\.create",
    re.I,
)
SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    "venv",
    ".venv",
    "dist",
    "build",
    ".tox",
    ".mypy_cache",
}
MAX_BYTES = 512000

RULES = {
    "SB-PY-FICTION-001": {
        "category": "ai-fiction",
        "type": "AI Slop / Mock Leak",
        "severity": "medium",
    },
    "SB-PY-FICTION-002": {
        "category": "ai-fiction",
        "type": "Dead / Mock Function",
        "severity": "medium",
    },
    "SB-PY-TB-001": {
        "category": "token-bleed",
        "type": "Token Bleed",
        "severity": "medium",
    },
    "SB-PY-EU-001": {
        "category": "eu-ai-act",
        "type": "EU AI Act — High-Risk Indicator",
        "severity": "high",
    },
}


def rel_posix(root: str, path: str) -> str:
    return os.path.relpath(path, root).replace("\\", "/")


def under_production(rel: str, production_paths: list[str]) -> bool:
    if not production_paths:
        return True
    normalized = rel.replace("\\", "/")
    for prefix in production_paths:
        p = prefix.replace("\\", "/").lstrip("./")
        if not p:
            continue
        if normalized == p.rstrip("/") or normalized.startswith(p if p.endswith("/") else p + "/"):
            return True
    return False


def callee_label(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{callee_label(node.value)}.{node.attr}"
    return "call"


def is_llm_call(func: ast.AST) -> bool:
    if isinstance(func, ast.Name) and func.id.lower() in LLM_TAILS:
        return True
    label = callee_label(func)
    if LLM_EXACT_RE.search(label):
        return True
    if not LLM_LABEL_RE.search(label):
        return False
    tail = label.rsplit(".", 1)[-1].lower()
    return tail in LLM_TAILS


def has_token_limit(call: ast.Call) -> bool:
    for kw in call.keywords:
        if kw.arg in TOKEN_LIMIT_KEYS:
            return True
    return False


def is_none(node: ast.AST | None) -> bool:
    if node is None:
        return True
    return isinstance(node, ast.Constant) and node.value is None


def is_stub_body(body: list[ast.stmt]) -> bool:
    if len(body) != 1:
        return False
    stmt = body[0]
    if isinstance(stmt, ast.Pass):
        return True
    if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and stmt.value.value is ...:
        return True
    if isinstance(stmt, ast.Return) and is_none(stmt.value):
        return True
    return False


def make_finding(rel: str, line: int, pattern: str, details: str) -> dict:
    meta = RULES[pattern]
    return {
        "file": rel,
        "line": line,
        "pattern": pattern,
        "severity": meta["severity"],
        "category": meta["category"],
        "type": meta["type"],
        "details": details,
        "issue": details,
    }


def scan_source(rel: str, source: str) -> list[dict]:
    findings: list[dict] = []
    seen: set[str] = set()

    def push(pattern: str, line: int, details: str) -> None:
        key = f"{pattern}:{line}:{details[:40]}"
        if key in seen:
            return
        seen.add(key)
        findings.append(make_finding(rel, line, pattern, details))

    try:
        tree = ast.parse(source)
    except SyntaxError as err:
        raise err

    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if SLOP_RE.search(node.value):
                push(
                    "SB-PY-FICTION-001",
                    getattr(node, "lineno", 1),
                    f"Hardcoded placeholder string detected: '{node.value[:80]}'",
                )
            if HIGH_RISK_RE.search(node.value):
                push(
                    "SB-PY-EU-001",
                    getattr(node, "lineno", 1),
                    f"String literal triggers Annex III review: '{node.value[:80]}'",
                )
        if isinstance(node, ast.Name) and HIGH_RISK_RE.search(node.id):
            push(
                "SB-PY-EU-001",
                getattr(node, "lineno", 1),
                f"Identifier '{node.id}' triggers Annex III review.",
            )
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and is_stub_body(node.body):
            push(
                "SB-PY-FICTION-002",
                getattr(node, "lineno", 1),
                f"Function '{node.name}' returns None immediately — likely stub.",
            )
        if isinstance(node, ast.Call) and is_llm_call(node.func) and not has_token_limit(node):
            push(
                "SB-PY-TB-001",
                getattr(node, "lineno", 1),
                f"Unbounded LLM call via '{callee_label(node.func)}' — missing token limit.",
            )
    return findings


def iter_py_files(root: str, production_paths: list[str], files: list[str] | None) -> list[str]:
    if files:
        return [os.path.abspath(f) for f in files if f.lower().endswith(".py") and os.path.isfile(f)]
    out: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            if not name.endswith(".py"):
                continue
            abs_path = os.path.join(dirpath, name)
            rel = rel_posix(root, abs_path)
            if not under_production(rel, production_paths):
                continue
            out.append(abs_path)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="SimpleBeacon Python AST scan")
    parser.add_argument("--root", required=True)
    parser.add_argument("--production-paths", default="server/,src/,app/,lib/")
    parser.add_argument("--files", default="")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    production_paths = [p.strip() for p in args.production_paths.split(",") if p.strip()]
    explicit = [p.strip() for p in args.files.split(",") if p.strip()] if args.files else None

    findings: list[dict] = []
    errors: list[str] = []
    scanned = 0
    visited = 0

    for abs_path in iter_py_files(root, production_paths, explicit):
        visited += 1
        rel = rel_posix(root, abs_path)
        try:
            size = os.path.getsize(abs_path)
            if size > MAX_BYTES:
                errors.append(f"{rel}: skipped (>{MAX_BYTES} bytes)")
                continue
            with open(abs_path, "r", encoding="utf-8", errors="replace") as handle:
                source = handle.read()
            scanned += 1
            findings.extend(scan_source(rel, source))
        except SyntaxError as err:
            errors.append(f"{rel}: syntax error: {err.msg}")
        except OSError as err:
            errors.append(f"{rel}: {err}")

    sys.stdout.write(
        json.dumps(
            {
                "scanned": scanned,
                "filesVisited": visited,
                "findings": findings,
                "errors": errors,
            }
        )
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
