#!/usr/bin/env python3
"""Unit tests for dynamic E2E README badge updater."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def _load_target_module():
    script_path = Path(__file__).with_name("update_e2e_badge.py")
    spec = importlib.util.spec_from_file_location("update_e2e_badge", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load update_e2e_badge.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


badge = _load_target_module()


class UpdateE2EBadgeTests(unittest.TestCase):
    def test_badge_markdown_exact_golden_output(self) -> None:
        expected = {
            "CRITICAL": "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-CRITICAL-red)",
            "HIGH": "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-HIGH-orange)",
            "MEDIUM": "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-MEDIUM-yellow)",
            "LOW": "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-LOW-blue)",
            "NONE": "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-HEALTHY-brightgreen)",
            "UNKNOWN": "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-UNKNOWN-lightgrey)",
        }

        for severity, golden in expected.items():
            with self.subTest(severity=severity):
                self.assertEqual(badge._badge_markdown(severity), golden)

    def test_badge_markdown_maps_known_and_unknown_severity(self) -> None:
        critical = badge._badge_markdown("CRITICAL")
        healthy = badge._badge_markdown("NONE")
        unknown = badge._badge_markdown("not-a-real-level")

        self.assertIn("-CRITICAL-red", critical)
        self.assertIn("-HEALTHY-brightgreen", healthy)
        self.assertIn("-UNKNOWN-lightgrey", unknown)

    def test_read_severity_fallbacks_and_normalization(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            missing = root / "missing.json"
            self.assertEqual(badge._read_severity(missing), "UNKNOWN")

            malformed = root / "bad.json"
            malformed.write_text("{not-json", encoding="utf-8")
            self.assertEqual(badge._read_severity(malformed), "UNKNOWN")

            valid = root / "valid.json"
            valid.write_text(json.dumps({"highestActiveSeverity": "medium"}), encoding="utf-8")
            self.assertEqual(badge._read_severity(valid), "MEDIUM")

    def test_replace_or_insert_replaces_only_anchor_block(self) -> None:
        original = (
            "# Demo\n\n"
            f"{badge.BADGE_START}\n"
            "![SimpleBeacon E2E State](https://img.shields.io/badge/SimpleBeacon%20E2E-UNKNOWN-lightgrey)\n"
            f"{badge.BADGE_END}\n\n"
            "Body text\n"
        )
        new_line = badge._badge_markdown("HIGH")
        updated = badge._replace_or_insert_badge(original, new_line)

        self.assertIn(badge.BADGE_START, updated)
        self.assertIn(badge.BADGE_END, updated)
        self.assertEqual(updated.count(badge.BADGE_START), 1)
        self.assertEqual(updated.count(badge.BADGE_END), 1)
        self.assertIn("-HIGH-orange", updated)
        self.assertIn("Body text", updated)

    def test_replace_or_insert_inserts_after_heading_when_anchor_missing(self) -> None:
        original = "# SimpleBeacon\n\nIntro line\n"
        new_line = badge._badge_markdown("LOW")
        updated = badge._replace_or_insert_badge(original, new_line)

        self.assertIn(badge.BADGE_START, updated)
        self.assertIn(badge.BADGE_END, updated)
        self.assertIn("-LOW-blue", updated)

        lines = updated.splitlines()
        self.assertEqual(lines[0], "# SimpleBeacon")
        self.assertEqual(lines[1], "")
        self.assertTrue(lines[2].startswith("[//]: # (simplebeacon-e2e-badge:start)"))


if __name__ == "__main__":
    unittest.main()
