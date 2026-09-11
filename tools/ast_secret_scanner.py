#!/usr/bin/env python3
"""AST-based secret detector.

Walks Python source files and flags high-entropy string assignments
to variables with secret-related names (api_key, token, password, etc.).

Usage:
  python tools/ast_secret_scanner.py --dir path/to/scan

"""
import ast
import os
import re
import argparse


# High-entropy detection helper for keys/tokens
def calculate_entropy(text):
    if not text:
        return 0.0
    import math
    counts = {c: text.count(c) for c in set(text)}
    entropy = sum((count / len(text)) * math.log2(len(text) / count) for count in counts.values())
    return entropy


class ASTSecretDetector(ast.NodeVisitor):
    def __init__(self, filename):
        self.filename = filename
        self.findings = []
        # Suspicious keyword variables
        self.secret_keywords = {"api_key", "secret", "password", "token", "passwd", "db_url", "aws_key", "access_key", "secret_key", "bearer"}

    def visit_Assign(self, node):
        # Target assignment structures (e.g., target = value)
        for target in node.targets:
            if isinstance(target, ast.Name):
                var_name = target.id.lower()

                # Check if variable name contains a target keyword
                if any(kw in var_name for kw in self.secret_keywords):
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                        val = node.value.value
                        entropy = calculate_entropy(val)

                        # Flag strings that look like hardcoded credentials (length and complexity)
                        if len(val) > 12 and entropy > 3.0:
                            self.findings.append({
                                "file": self.filename,
                                "line": node.lineno,
                                "severity": "CRITICAL",
                                "issue": "HARDCODED_SECRET",
                                "description": f"Variable '{target.id}' appears to hold a high-entropy hardcoded credential (Entropy: {entropy:.2f}).",
                            })
        self.generic_visit(node)


def run_ast_secret_scan(target_dir):
    all_findings = []
    for root, _, files in os.walk(target_dir):
        # skip common large or virtualenv folders
        if any(p in root for p in (".git", "venv", "__pycache__", "node_modules", ".venv")):
            continue
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        src = f.read()
                    tree = ast.parse(src, filename=file_path)
                    detector = ASTSecretDetector(file_path)
                    detector.visit(tree)
                    if detector.findings:
                        all_findings.extend(detector.findings)
                except Exception:
                    # parse errors or unreadable files: skip
                    continue
    return all_findings


def main():
    p = argparse.ArgumentParser(description="AST Secret Scanner — find likely hardcoded secrets in Python files")
    p.add_argument('--dir', default='.', help='Directory to scan')
    p.add_argument('--json', help='Write findings to JSON file')
    args = p.parse_args()

    findings = run_ast_secret_scan(args.dir)
    if findings:
        print(f"[!] Found {len(findings)} potential hardcoded secret(s):")
        for f in findings:
            print(f"- {f['file']}:{f['line']} — {f['issue']} — {f['description']}")
    else:
        print("[+] No high-entropy hardcoded secrets found (quick AST check).")

    if args.json:
        import json
        with open(args.json, 'w', encoding='utf-8') as out:
            json.dump(findings, out, indent=2)


if __name__ == '__main__':
    main()
