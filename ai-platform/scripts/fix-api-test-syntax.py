#!/usr/bin/env python3
"""Repair common syntax corruption in API integration tests."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "server" / "api" / "tests"


def fix_content(text: str) -> str:
    text = re.sub(
        r'(\n        )(\w+)="([^"]+)",(\s*\n\s*\n)\s{4}response=\s*',
        r'\1\2 = "\3"\4\1response = ',
        text,
    )
    text = re.sub(
        r'("https://example\.com")\s*\n(\s*"repo_provider")',
        r'\1,\n\2',
        text,
    )
    text = re.sub(
        r'("http://localhost:8000")\s*\n(\s*"Access-Control)',
        r'\1,\n\2',
        text,
    )
    text = re.sub(
        r'uri = "ws:\s*\n',
        'uri = "ws://localhost:8000/api/dashboard/ws"\n',
        text,
    )
    return text


def main() -> None:
    changed = []
    for path in sorted(ROOT.glob("test_*.py")):
        original = path.read_text(encoding="utf-8")
        updated = fix_content(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed.append(path.name)
    print(f"Updated {len(changed)} test files")
    for name in changed:
        print(f"  {name}")


if __name__ == "__main__":
    main()
