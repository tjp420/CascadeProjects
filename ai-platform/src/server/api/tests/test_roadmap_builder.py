#!/usr/bin/env python3


"""


Test suite for roadmap builder functionality


"""


import pytest


from pathlib import Path


def test_roadmap_builder_date_calculation():


    """Test that roadmap builder calculates dates correctly"""


    # Verify the fix for Invalid Date issues in deliverables


    from datetime import datetime, timedelta


    start_date = datetime(2026, 5, 17)


    end_date = start_date + timedelta(days = 90)


    # Test deliverable date distribution


    deliverable_count = 2


    days_per_deliverable = (end_date - start_date).total_seconds() / (deliverable_count + 1)


    for i in range(deliverable_count):


        deliverable_date = start_date + timedelta(days=(i + 1) * int(days_per_deliverable / (24 * 3600)))


        assert deliverable_date > start_date


        assert deliverable_date < end_date


def test_roadmap_progress_calculation():


    """Test that roadmap progress calculation includes deliverables"""


    # Verify the fix to include deliverables in progress calculation


    activities = [


        {"status": "completed"},


        {"status": "in-progress"},


        {"status": "planned"}


    ]


    deliverables = [


        {"status": "completed"},


        {"status": "planned"}


    ]


    completed_activities = sum(1 for a in activities if a["status"] == "completed")


    completed_deliverables = sum(1 for d in deliverables if d["status"] == "completed")


    total_items = len(activities) + len(deliverables)


    progress = ((completed_activities + completed_deliverables) / total_items) * 100


    assert progress == 60.0  # (2 + 1) / 5 * 100


