# Python Validation Tools Configuration

## Overview

This document provides the complete configuration setup for Python-specific validation tools to ensure consistent and accurate project measurements across CascadeProjects.

## Core Validation Tools Setup

### 1. Test Coverage Tools

#### pytest-cov Configuration
```ini
# pytest.ini
[tool:pytest]
addopts = 
    --cov=. 
    --cov-report=term-missing 
    --cov-report=html 
    --cov-report=xml 
    --cov-report=json
    --cov-fail-under=75
    --strict-markers
    --disable-warnings
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    slow: Slow running tests

# .coveragerc
[run]
source = .
branch = True
omit = 
    */tests/*
    */test_*
    */__pycache__/*
    */venv/*
    */env/*
    */migrations/*
    */node_modules/*
    */conftest.py
    */fixtures/*
    setup.py

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    if self.debug:
    if settings.DEBUG
    raise AssertionError
    raise NotImplementedError
    if 0:
    if __name__ == .__main__.:
    class .*\bProtocol\):
    @(abc\.)?abstractmethod
    @overload
show_missing = True
precision = 2

[html]
directory = htmlcov
title = CascadeProjects Coverage Report

[xml]
output = coverage.xml

[json]
output = coverage.json
```

#### Coverage.py Configuration
```ini
# .coveragerc (same as above for consistency)
```

### 2. Technical Debt Assessment Tools

#### SonarQube Configuration
```properties
# sonar-project.properties
sonar.projectKey=cascade-projects
sonar.projectName=CascadeProjects
sonar.projectVersion=1.0.0
sonar.sources=.
sonar.tests=tests
sonar.inclusions=**/*.py
sonar.exclusions=**/tests/**,**/test_*/**,**/__pycache__/**,**/migrations/**,**/venv/**,**/env/**

# Python-specific settings
sonar.python.coverage.reportPaths=coverage.xml
sonar.python.xunit.reportPath=pytest-report.xml
sonar.python.file.suffixes=.py
sonar.python.bandit.reportPaths=bandit-report.json

# Technical Debt Settings
sonar.technicalDebt.hoursInDay=8
sonar.technicalDebt.remediationCost=60
sonar.technicalDebt.developmentCost=30

# Quality Gates
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300

# Exclusions
sonar.exclusions+=**/conftest.py,**/fixtures/**/*.py
```

#### Radon Configuration
```ini
# .radonrc
[radon]
cc_min = B
mi_min = C
max_complexity = 10
max_line_length = 88
exclude = tests, migrations, __pycache__, venv, env

[radon_cc]
show_complexity = True
average_complexity = True
total_complexity = True

[radon_mi]
show = True
min = C
multi = True

[radon_raw]
show = True
json = True
xml = True
```

### 3. Code Quality Assessment Tools

#### Pylint Configuration
```ini
# .pylintrc
[MASTER]
init-hook='import sys; sys.path.append(".")'
load-plugins=pylint_django,pylint_flask,pylint_numpy
persistent=yes
unsafe-load-any-extension=no
suggestion-mode=yes
extension-pkg-whitelist=numpy,pandas,scipy

[MESSAGES CONTROL]
disable=
    R0903,  # Too few public methods
    C0114,   # Missing module docstring
    R0902,   # Too many instance attributes
    C0115,   # Missing class docstring
    R0913,   # Too many arguments
    C0116,   # Missing function or method docstring
    W0613,   # Unused argument
    R0914,   # Too many local variables
    R0912,   # Too many branches
    R0915,   # Too many statements
    R0911,   # Too many return statements
    W0702,   # No exception type specified
    W0703,   # Catching too general exception
    R0801,   # Similar lines in files
    C0301,   # Line too long
    R0201    # Method could be a function

[FORMAT]
max-line-length=88
max-module-lines=1000
indent-string='    '
indent-after-paren=4
indent-after-paren=4
string-quote=single
trailing-comma=true

[DESIGN]
max-args=7
max-locals=15
max-returns=6
max-branches=12
max-statements=50
max-attributes=7
min-public-methods=2
max-public-methods=20
max-parents=7
max-complexity=10
max-bool-expr=5

[CLASSES]
defining-attr-methods=__init__,__new__,setUp
valid-classmethod-first-arg=cls
valid-metaclass-classmethod-first-arg=mcs
exclude-protected=_asdict,_fields,_replace,_source,_make
valid-name=main,setUp,tearDown

[VARIABLES]
init-import=no
dummy-variables-rgx=^_|dummy
callbacks=cb_,_cb
redefining-builtins-modules=distutils

[BASIC]
good-names=i,j,k,ex,Run,_
bad-names=foo,bar,baz,toto,tutu,tata
name-format=snake_case
class-name-format=PascalCase
function-name-format=snake_case
const-name-format=UPPER_CASE
attr-name-format=snake_case
argument-name-format=snake_case
class-attribute-name-format=snake_case
variable-name-format=snake_case
inlinevar-name-format=snake_case

[TYPECHECK]
contextmanager-decorators=contextlib.contextmanager
generated-members=request,session,meta
ignore-on-opaque-inference=True
ignored-classes=optparse.Values,thread._local_dict,_thread._local_dict
ignored-modules=distutils,imp,optparse,old_div,tkinter,pygame,numpy,pandas,scipy
missing-member-hint=yes
missing-member-hint-max-choices=3
missing-member-max-choices=5
mixin-class-rgx=^[Mm]ix[Ii]n

[STRING]
check-str-concat-over-line-jumps=True
check-quote-consistency=True

[IMPORTS]
allow-wildcard-with-all=yes
deprecated-modules=optparse,tkinter.tix
ext-import-graph=
import-graph=
int-import-graph=
known-standard-library=
known-third-party=environ,requests,pytest,flask,django,numpy,pandas,scipy
analyse-fallback-blocks=no
allow-any-generated-level=

[LOGGING]
logging-modules=logging
logging-format-style=new
disable=no-docstring-rgx,^_
no-logstring-interpolation=no
no-logstring-kwargs=no

[FORMAT]
max-line-length=88
max-module-lines=1000
indent-string='    '
indent-after-paren=4
string-quote=single
trailing-comma=true

[MISCELLANEOUS]
notes=FIXME,XXX,TODO,NOTE
notes-rx=FIXME|XXX|TODO|NOTE

[SIMILARITIES]
min-similarity-lines=4
ignore-comments=yes
ignore-docstrings=yes
ignore-imports=no
ignore-signatures=no
```

#### Flake8 Configuration
```ini
# .flake8
[flake8]
max-line-length = 88
max-complexity = 10
extend-ignore = 
    E203,  # whitespace before ':'
    W503,  # line break before binary operator
    E501,  # line too long (handled by black)
    F401,  # imported but unused (handled by isort)
exclude = 
    .git,
    __pycache__,
    .venv,
    venv,
    migrations,
    tests,
    build,
    dist
per-file-ignores =
    __init__.py:F401
    conftest.py:F401,F811
    test_*.py:F401,F811
```

### 4. Security Assessment Tools

#### Bandit Configuration
```yaml
# .bandit
exclude_dirs:
    - tests
    - migrations
    - __pycache__
    - venv
    - env
    - build
    - dist

include_dirs:
    - .

skips:
    - B101  # assert_used
    - B601   # shell_injection_process
    - B602   # subprocess_popen_with_shell_equals_true
    - B404   # import_subprocess

tests:
    - B101
    - B102
    - B103
    - B104
    - B105
    - B106
    - B107
    - B108
    - B110
    - B112
    - B201
    - B301
    - B302
    - B303
    - B304
    - B305
    - B306
    - B307
    - B308
    - B309
    - B310
    - B311
    - B312
    - B313
    - B314
    - B315
    - B316
    - B317
    - B318
    - B319
    - B320
    - B321
    - B322
    - B323
    - B324
    - B325
    - B401
    - B402
    - B403
    - B404
    - B405
    - B406
    - B407
    - B408
    - B409
    - B410
    - B411
    - B412
    - B413
    - B501
    - B502
    - B503
    - B504
    - B505
    - B506
    - B507
    - B601
    - B602
    - B603
    - B604
    - B605
    - B606
    - B607
    - B608
    - B609
    - B610
    - B611
    - B701
    - B702
    - B703

plugins:
    - bandit_high_entropy_entropy
    - bandit_high_entropy_strings

severity_level: medium
confidence_level: high
```

#### Safety Configuration
```ini
# .safety
ignore:
    # Add specific vulnerability IDs to ignore
    # Example: 12345
```

#### Semgrep Configuration
```yaml
# .semgrep.yml
rules:
  - id: python.security.audit
    pattern: |
      eval(...)
    message: Use of eval() function
    severity: ERROR
    languages: [python]

  - id: python.security.hardcoded-secret
    pattern: |
      $VAR = "$SECRET"
    message: Potential hardcoded secret
    severity: ERROR
    languages: [python]
    metadata:
      category: security
      technology:
        - python
      confidence: HIGH

  - id: python.security.sql-injection
    pattern: |
      execute($QUERY + $INPUT)
    message: Potential SQL injection
    severity: ERROR
    languages: [python]
```

### 5. Performance Assessment Tools

#### pytest-benchmark Configuration
```python
# conftest.py
import pytest
import time

@pytest.fixture
def benchmark_timer():
    """Standard benchmark configuration"""
    return {
        'min_rounds': 5,
        'max_time': 1.0,
        'timer': 'perf_counter',
        'warmup': True,
        'disable_gc': True,
        'max_iterations': 1000000
    }

@pytest.fixture
def performance_data():
    """Performance test data fixture"""
    return {
        'small_dataset': list(range(100)),
        'medium_dataset': list(range(1000)),
        'large_dataset': list(range(10000))
    }

@pytest.fixture
def benchmark_thresholds():
    """Performance thresholds for validation"""
    return {
        'response_time_ms': 100,
        'memory_mb': 100,
        'cpu_percent': 50
    }
```

#### cProfile Configuration
```python
# performance_profiler.py
import cProfile
import pstats
import io
from contextlib import contextmanager

@contextmanager
def profile_performance(output_file='profile_output.prof'):
    """Context manager for performance profiling"""
    profiler = cProfile.Profile()
    profiler.enable()
    yield
    profiler.disable()
    
    # Save profiling data
    profiler.dump_stats(output_file)
    
    # Generate statistics
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    print(f"Performance profile saved to {output_file}")
    
def analyze_performance_profile(profile_file):
    """Analyze performance profile data"""
    stats = pstats.Stats(profile_file)
    stats.sort_stats('cumulative')
    
    # Get top 10 functions by cumulative time
    top_functions = []
    for func, (cc, nc, tt, ct, callers) in stats.stats.items():
        top_functions.append({
            'function': func,
            'cumulative_time': ct,
            'total_time': tt,
            'call_count': cc,
            'ncalls': nc
        })
    
    return sorted(top_functions, key=lambda x: x['cumulative_time'], reverse=True)[:10]
```

## Integration Scripts

### Validation Pipeline Script
```python
# scripts/run_validation.py
#!/usr/bin/env python3
"""
Comprehensive validation pipeline for CascadeProjects
"""
import subprocess
import json
import sys
from pathlib import Path

def run_command(cmd, capture_output=True):
    """Run command and return result"""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=capture_output, text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def validate_test_coverage():
    """Run test coverage validation"""
    print("Running test coverage validation...")
    success, stdout, stderr = run_command("pytest --cov=. --cov-report=json --cov-fail-under=75")
    
    if success:
        with open('coverage.json') as f:
            coverage_data = json.load(f)
        return True, coverage_data['totals']['percent_covered']
    else:
        return False, stderr

def validate_technical_debt():
    """Run technical debt validation"""
    print("Running technical debt validation...")
    success, stdout, stderr = run_command("radon cc . --json")
    
    if success:
        debt_data = json.loads(stdout)
        return True, debt_data
    else:
        return False, stderr

def validate_code_quality():
    """Run code quality validation"""
    print("Running code quality validation...")
    success, stdout, stderr = run_command("pylint --output-format=json .")
    
    if success:
        quality_data = json.loads(stdout)
        return True, quality_data
    else:
        return False, stderr

def validate_security():
    """Run security validation"""
    print("Running security validation...")
    success, stdout, stderr = run_command("bandit -r . -f json -o bandit-report.json")
    
    if success:
        with open('bandit-report.json') as f:
            security_data = json.load(f)
        return True, security_data
    else:
        return False, stderr

def validate_performance():
    """Run performance validation"""
    print("Running performance validation...")
    success, stdout, stderr = run_command("pytest --benchmark-only --benchmark-json=benchmark.json")
    
    if success:
        with open('benchmark.json') as f:
            perf_data = json.load(f)
        return True, perf_data
    else:
        return False, stderr

def generate_validation_report():
    """Generate comprehensive validation report"""
    results = {}
    
    # Test Coverage
    coverage_success, coverage_data = validate_test_coverage()
    results['test_coverage'] = {
        'success': coverage_success,
        'data': coverage_data,
        'threshold_met': coverage_success and coverage_data >= 75.0
    }
    
    # Technical Debt
    debt_success, debt_data = validate_technical_debt()
    results['technical_debt'] = {
        'success': debt_success,
        'data': debt_data,
        'threshold_met': debt_success  # Add specific debt threshold logic
    }
    
    # Code Quality
    quality_success, quality_data = validate_code_quality()
    results['code_quality'] = {
        'success': quality_success,
        'data': quality_data,
        'threshold_met': quality_success  # Add specific quality threshold logic
    }
    
    # Security
    security_success, security_data = validate_security()
    results['security'] = {
        'success': security_success,
        'data': security_data,
        'threshold_met': security_success and len(security_data.get('results', [])) == 0
    }
    
    # Performance
    perf_success, perf_data = validate_performance()
    results['performance'] = {
        'success': perf_success,
        'data': perf_data,
        'threshold_met': perf_success  # Add specific performance threshold logic
    }
    
    # Save report
    with open('validation_report.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return results

if __name__ == "__main__":
    print("Starting comprehensive validation pipeline...")
    results = generate_validation_report()
    
    # Print summary
    print("\nValidation Summary:")
    for category, result in results.items():
        status = "✓" if result['success'] and result['threshold_met'] else "✗"
        print(f"{status} {category}: {'PASS' if result['success'] and result['threshold_met'] else 'FAIL'}")
    
    # Exit with appropriate code
    all_passed = all(r['success'] and r['threshold_met'] for r in results.values())
    sys.exit(0 if all_passed else 1)
```

## Requirements File

### Development Dependencies
```txt
# requirements-dev.txt
# Testing and Coverage
pytest>=7.0.0
pytest-cov>=4.0.0
pytest-benchmark>=4.0.0
pytest-xdist>=3.0.0
pytest-mock>=3.10.0

# Code Quality
pylint>=2.17.0
flake8>=6.0.0
black>=23.0.0
isort>=5.12.0
mypy>=1.4.0

# Technical Debt
radon>=5.1.0
sonar-scanner>=4.7.0

# Security
bandit>=1.7.4
safety>=2.3.5
semgrep>=1.0.0

# Performance
memory-profiler>=0.61.0
line-profiler>=4.0.0

# Documentation
sphinx>=7.0.0
sphinx-rtd-theme>=1.3.0

# Development Tools
pre-commit>=3.3.0
tox>=4.6.0
```

## Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/psf/black
    rev: 23.3.0
    hooks:
      - id: black
        language_version: python3

  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort
        args: ["--profile", "black"]

  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8

  - repo: https://github.com/pycqa/bandit
    rev: 1.7.4
    hooks:
      - id: bandit
        args: ["-c", ".bandit"]

  - repo: local
    hooks:
      - id: pylint
        name: pylint
        entry: pylint
        language: system
        types: [python]
        args: ["--output-format=text"]
```

This comprehensive configuration ensures consistent, accurate, and automated validation of all project metrics using Python-specific tools and best practices.
