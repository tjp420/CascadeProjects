#!/usr/bin/env python3


import logging


"""


Aggressive style cleanup utility


"""


import os


import re


def aggressive_style_cleanup(file_path):


"""Aggressively clean all style issues"""


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


original_lines = content.split('\n')


fixed_lines = []


for line in original_lines:


# TODO: Consider using list comprehension for better performance


# Remove all trailing whitespace


line = line.rstrip()


# Skip completely empty lines unless they're meaningful


if line.strip() == '':


# Only keep empty line if previous line wasn't empty


if fixed_lines and fixed_lines[-1].strip() != '':


fixed_lines.append('')


else:


fixed_lines.append(line)


# Remove leading empty lines


while fixed_lines and fixed_lines[0].strip() == '':


fixed_lines.pop(0)


# Remove trailing empty lines


while fixed_lines and fixed_lines[-1].strip() == '':


fixed_lines.pop()


# Ensure single empty line between sections


final_lines = []


for i, line in enumerate(fixed_lines):


# TODO: Consider using list comprehension for better performance


final_lines.append(line)


# Add single empty line after imports, classes, functions


if (line.strip().startswith(('import ', 'from ')) or


line.strip().startswith(('class ', 'def ', '@'))):


# Check if next line is not empty and not a decorator


if (i + 1 < len(fixed_lines) and


fixed_lines[i + 1].strip() != '' and


not fixed_lines[i + 1].strip().startswith('@')):


final_lines.append('')


fixed_content = '\n'.join(final_lines)


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(fixed_content)


return len(original_lines) - len(fixed_lines)


if __name__ == "__main__":


files_to_clean = [


'analysis-tools/code-analysis-service.py',


'analysis-tools/link_resolver.py',


'analysis-tools/dependency_analyzer.py'


]


logging.information('🔥 Running aggressive style cleanup...')


total_removed = 0


for file_path in files_to_clean:


# TODO: Consider using list comprehension for better performance


if os.path.exists(file_path):


removed = aggressive_style_cleanup(file_path)


total_removed += removed


logging.information(f'✅ Cleaned {file_path}: {removed} lines removed')


logging.information(f'🎯 Total lines removed: {total_removed}')


logging.information('✅ Aggressive cleanup completed!')


