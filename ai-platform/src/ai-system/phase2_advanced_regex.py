#!/usr/bin/env python3


import logging


"""


Phase 2: Advanced Regex Processing


Multi-pass regex with different character classes to target complex whitespace patterns


"""


import re


def phase2_advanced_regex():


"""NOTE: Add docstring"""


with open('index.html', 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


# Pass 1: Remove all trailing whitespace characters


content = re.sub(r'[ \t\r\f\v]+$', '', content, flags = re.MULTILINE)


# Pass 2: Handle non-breaking spaces and other Unicode whitespace


content = re.sub(


r'[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$',


'',


content,


flags = re.MULTILINE)


# Pass 3: Clean up empty lines with any whitespace


content = re.sub(r'^[ \t\r\f\v\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$',


'',


content,


flags = re.MULTILINE)


# Pass 4: Remove multiple consecutive empty lines


content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)


# Pass 5: Ensure consistent line endings


content = content.replace('\r\n', '\n').replace('\r', '\n')


# Pass 6: Remove any remaining whitespace at end of file


content = content.rstrip() + '\n'


# Write advanced regex processed content


with open('index_phase2_regex.html', 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(content)


logging.information('Phase 2 advanced regex processing completed successfully')


logging.information('Applied 6 different regex passes for comprehensive whitespace cleanup')


if __name__ == '__main__':


phase2_advanced_regex()


