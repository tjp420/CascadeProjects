#!/usr/bin/env python3


import os


"""


Centralized Configuration Constants for Python Applications


Replaces hardcoded values throughout the codebase


"""


class Percentages:


    """Percentage thresholds and targets"""


    SECURITY_TARGET = 85


    QUALITY_TARGET = 80


    PERFORMANCE_TARGET = 79


    COVERAGE_TARGET = 80


    COMPLIANCE_TARGET = 85


    SATISFACTION_TARGET = 85


    TRAINING_PASSING_SCORE = 85


    QUALITY_THRESHOLD = 85


    EXCELLENCE_THRESHOLD = 95


    CRITICAL_THRESHOLD = 70


class Thresholds:


    """Various threshold values"""


    HIGH_COMPLEXITY = 75


    MAX_RETRIES = 3


    TIMEOUT_SECONDS = 30


    BATCH_SIZE = 100


class URLs:


    """Centralized URL configurations"""


    LOCALHOST_BASE = os.getenv("LOCALHOST_BASE", "http://localhost")


    API_PORT = os.getenv("API_PORT", "8081")


    WEB_PORT = os.getenv("WEB_PORT", "8000")


    ANALYZER_PORT = os.getenv("ANALYZER_PORT", "9000")


    @classmethod


    def get_api_url(cls):


    """


    TODO: Add function documentation.


    """


        return f"{cls.LOCALHOST_BASE}:{cls.API_PORT}"


    @classmethod


    def get_web_url(cls):


    """


    TODO: Add function documentation.


    """


        return f"{cls.LOCALHOST_BASE}:{cls.WEB_PORT}"


    @classmethod


    def get_analyzer_url(cls):


    """


    TODO: Add function documentation.


    """


        return f"{cls.LOCALHOST_BASE}:{cls.ANALYZER_PORT}"


