#!/usr/bin/env python3
"""Remove inline deferred-init script blocks from dashboard-new.html."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'web' / 'dashboard-new.html'

content = HTML.read_text(encoding='utf-8')

pattern = re.compile(
    r'\n    <script>\n        document\.addEventListener\(\'DOMContentLoaded\', async function\(\) \{.*?\n        \}\);\n    </script>',
    re.DOTALL,
)
new_content, count = pattern.subn('', content)

if count == 0:
    raise SystemExit('No deferred-init blocks removed')

insert = '\n    <script src="/scripts/dashboard-deferred-init.js"></script>\n'
marker = '<script src="/scripts/development-roadmap-page.js"></script>'
if marker not in new_content:
    raise SystemExit('development-roadmap-page.js marker not found')
new_content = new_content.replace(marker, marker + insert, 1)

HTML.write_text(new_content, encoding='utf-8')
print(f'Removed {count} inline deferred-init blocks')
print('Added dashboard-deferred-init.js script tag')
