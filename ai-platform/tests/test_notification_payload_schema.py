#!/usr/bin/env python3
"""Lightweight schema assertions for Slack/Discord notification payloads."""

from __future__ import annotations

import unittest

from test_simplebeacon_e2e_runner import SimpleBeaconDualNotifyingCrawler


class NotificationPayloadSchemaTests(unittest.TestCase):
    def _build_crawler(self) -> SimpleBeaconDualNotifyingCrawler:
        crawler = SimpleBeaconDualNotifyingCrawler(
            enable_assertions=False,
            start_url="https://simplebeacon.ai",
            slack_url="https://hooks.slack.test/services/demo",
            discord_url="https://discord.com/api/webhooks/demo",
        )
        crawler.report.visited_urls = ["https://simplebeacon.ai", "https://simplebeacon.ai/pricing"]
        crawler.report.passed_routes = ["https://simplebeacon.ai"]
        crawler.report.failed_routes = {
            "https://simplebeacon.ai/pricing": "HTTP Return Failure Code: 500"
        }
        crawler.report.failed_routes_detailed = {
            "https://simplebeacon.ai/pricing": {
                "severity": "CRITICAL",
                "reason": "HTTP Return Failure Code: 500",
                "timestamp": "2026-07-29T00:00:00Z",
            }
        }
        crawler.report.severity_counts = {
            "CRITICAL": 1,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
        }
        crawler.report.highest_active_severity = "CRITICAL"
        crawler.report.payload_injection_results = [
            {
                "url": "https://simplebeacon.ai/pricing",
                "selector": "input[type='text']",
                "payload": "XSS-script",
                "accepted": True,
                "sanitized": False,
                "truncated": False,
                "actualLength": 24,
            },
            {
                "url": "https://simplebeacon.ai/pricing",
                "selector": "input[type='text']",
                "payload": "SQL-injection",
                "accepted": False,
                "sanitized": True,
                "truncated": False,
                "actualLength": 10,
            },
        ]
        crawler.report.xss_reflection_results = [
            {
                "url": "https://simplebeacon.ai/pricing",
                "selector": "input[type='text']",
                "payload": "script-tag",
                "reflected": True,
            }
        ]
        return crawler

    def test_discord_payload_has_required_metadata_fields(self) -> None:
        crawler = self._build_crawler()
        payload = crawler.build_discord_payload()

        self.assertIn("embeds", payload)
        self.assertIsInstance(payload["embeds"], list)
        self.assertGreaterEqual(len(payload["embeds"]), 1)

        embed = payload["embeds"][0]
        self.assertIn("title", embed)
        self.assertIn("description", embed)
        self.assertIn("color", embed)
        self.assertIn("fields", embed)

        field_names = {field.get("name") for field in embed["fields"] if isinstance(field, dict)}
        self.assertIn("Highest Active Severity", field_names)
        self.assertIn("Failed Routes / Visited Routes", field_names)
        self.assertIn("Severity Counts Matrix", field_names)

    def test_slack_payload_has_required_block_fields(self) -> None:
        crawler = self._build_crawler()
        payload = crawler.build_slack_payload()

        self.assertIn("text", payload)
        self.assertIn("blocks", payload)
        self.assertIsInstance(payload["blocks"], list)
        self.assertGreaterEqual(len(payload["blocks"]), 2)

        header_block = payload["blocks"][0]
        self.assertEqual(header_block.get("type"), "header")

        field_text = []
        for block in payload["blocks"]:
            if block.get("type") != "section":
                continue
            for field in block.get("fields", []):
                text = field.get("text") if isinstance(field, dict) else ""
                if isinstance(text, str):
                    field_text.append(text)

        merged = "\n".join(field_text)
        self.assertIn("Highest Active Severity", merged)
        self.assertIn("Failed Routes / Visited Routes", merged)
        self.assertIn("Severity Counts Matrix", merged)

    def test_report_schema_rejects_missing_required_key(self) -> None:
        crawler = self._build_crawler()
        report_json = crawler.report.as_json()
        report_json.pop("severityCounts", None)

        errors = crawler.validate_report_schema(report_json)
        self.assertTrue(any("Missing top-level key: severityCounts" in err for err in errors))

    def test_report_schema_rejects_missing_nested_totals_key(self) -> None:
        crawler = self._build_crawler()
        report_json = crawler.report.as_json()
        totals = report_json.get("totals")
        self.assertIsInstance(totals, dict)
        totals.pop("failed", None)

        errors = crawler.validate_report_schema(report_json)
        self.assertTrue(any("Missing totals key: failed" in err for err in errors))

    def test_ensure_report_ready_raises_on_missing_key(self) -> None:
        crawler = self._build_crawler()
        crawler.report.severity_counts = {}

        with self.assertRaises(RuntimeError):
            crawler.ensure_report_ready_for_notifications()

    def test_discord_payload_snapshot_stability(self) -> None:
        crawler = self._build_crawler()
        payload = crawler.build_discord_payload()

        self.assertIsInstance(payload, dict)
        embeds = payload.get("embeds")
        self.assertIsInstance(embeds, list)
        self.assertGreaterEqual(len(embeds), 1)

        primary = embeds[0]
        self.assertIsInstance(primary.get("title"), str)
        self.assertIsInstance(primary.get("description"), str)
        self.assertIsInstance(primary.get("color"), int)
        self.assertEqual(primary.get("color"), 15158332)

        fields = primary.get("fields")
        self.assertIsInstance(fields, list)
        names = [f.get("name") for f in fields if isinstance(f, dict)]

        self.assertIn("Highest Active Severity", names)
        self.assertIn("Failed Routes / Visited Routes", names)
        self.assertIn("Severity Counts Matrix", names)

        lookup = {f.get("name"): f for f in fields if isinstance(f, dict)}
        ratio_field = lookup["Failed Routes / Visited Routes"]
        self.assertIs(ratio_field.get("inline"), True)
        self.assertRegex(str(ratio_field.get("value", "")), r"^\d+\s*/\s*\d+$")

        matrix_field = lookup["Severity Counts Matrix"]
        self.assertIsInstance(matrix_field.get("value"), str)
        self.assertRegex(
            matrix_field["value"],
            r"Critical:\s*\d+\s*\|\s*High:\s*\d+\s*\|\s*Medium:\s*\d+\s*\|\s*Low:\s*\d+",
        )

    def test_slack_payload_snapshot_stability(self) -> None:
        crawler = self._build_crawler()
        payload = crawler.build_slack_payload()

        self.assertIsInstance(payload, dict)
        self.assertIsInstance(payload.get("text"), str)
        self.assertTrue(payload["text"].strip())

        blocks = payload.get("blocks")
        self.assertIsInstance(blocks, list)
        self.assertGreaterEqual(len(blocks), 2)

        header = blocks[0]
        self.assertEqual(header.get("type"), "header")
        self.assertIsInstance(header.get("text"), dict)
        self.assertEqual(header["text"].get("type"), "plain_text")
        self.assertIsInstance(header["text"].get("text"), str)

        section_blocks = [b for b in blocks if isinstance(b, dict) and b.get("type") == "section"]
        self.assertGreaterEqual(len(section_blocks), 1)

        field_section = next((b for b in section_blocks if isinstance(b.get("fields"), list)), None)
        self.assertIsNotNone(field_section)

        field_entries = field_section.get("fields", [])
        self.assertTrue(field_entries)
        for entry in field_entries:
            self.assertIsInstance(entry, dict)
            self.assertEqual(entry.get("type"), "mrkdwn")
            self.assertIsInstance(entry.get("text"), str)

        merged = "\n".join(e["text"] for e in field_entries if isinstance(e.get("text"), str))
        self.assertIn("Highest Active Severity", merged)
        self.assertIn("Failed Routes / Visited Routes", merged)
        self.assertIn("Severity Counts Matrix", merged)
        self.assertRegex(
            merged,
            r"Critical:\s*\d+\s*\|\s*High:\s*\d+\s*\|\s*Medium:\s*\d+\s*\|\s*Low:\s*\d+",
        )


if __name__ == "__main__":
    unittest.main()
