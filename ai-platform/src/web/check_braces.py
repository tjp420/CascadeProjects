#!/usr/bin/env python3
import re

file_path = r'C:/Users/Trevor/CascadeProjects/web/export-system.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

balance = 0
in_string = False
string_char = None
in_template = False
i = 0
lines = content.split('\n')

for line_num, line in enumerate(lines, 1):
    line_balance = 0
    i = 0
    while i < len(line):
        char = line[i]
        
        if in_template:
            if char == '`' and (i == 0 or line[i-1] != '\\'):
                in_template = False
        elif in_string:
            if char == string_char and (i == 0 or line[i-1] != '\\'):
                in_string = False
            elif char == '\\':
                i += 1  # Skip next character
        else:
            if char == '`' and (i == 0 or line[i-1] != '\\'):
                in_template = True
            elif char in '"\'':
                in_string = True
                string_char = char
            elif char == '{':
                line_balance += 1
            elif char == '}':
                line_balance -= 1
        
        i += 1
    
    balance += line_balance
    if balance < 0:
        print(f"Line {line_num}: Negative balance {balance}")
        print(f"  Content: {line.rstrip()}")
        break
    elif line_balance != 0:
        print(f"Line {line_num}: Balance change {line_balance}, Total balance {balance}")

print(f"\nFinal balance: {balance}")
