#!/usr/bin/env python3
"""SimpleBeacon dynamic E2E crawler with dual webhook notifications."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List
from urllib.parse import urljoin, urlparse
from xml.sax.saxutils import escape

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import Page, async_playwright

START_URL = "https://simplebeacon.ai"
DEFAULT_JSON_OUT = ".simplebeacon/logs/simplebeacon-e2e-report.json"
DEFAULT_TIMEOUT_MS = 20000
DEFAULT_MAX_ROUTES = 180

ERROR_TEXT_PATTERNS = [
    re.compile(r"dashboard load error", re.IGNORECASE),
    re.compile(r"404\\s+not\\s+found", re.IGNORECASE),
    re.compile(r"application error", re.IGNORECASE),
]

SKIP_EXTENSIONS = {
    ".svg", ".png", ".jpg", ".jpeg", ".ico", ".json", ".xml", ".css",
    ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".gz", ".mp4", ".map",
}


@dataclass
class RouteResult:
    url: str
    status: str = "pass"
    reason: str = ""
    http_status: int = 0
    interactions: int = 0
    discovered_links: int = 0
    duration_ms: int = 0


@dataclass
class CrawlReport:
    start_url: str
    domain: str
    visited_urls: List[str] = field(default_factory=list)
    passed_routes: List[str] = field(default_factory=list)
    failed_routes: Dict[str, str] = field(default_factory=dict)
    console_errors: List[str] = field(default_factory=list)
    interaction_count: int = 0
    route_results: Dict[str, RouteResult] = field(default_factory=dict)
    payload_injection_results: List[Dict[str, object]] = field(default_factory=list)
    xss_reflection_results: List[Dict[str, object]] = field(default_factory=list)
    severity_counts: Dict[str, int] = field(default_factory=lambda: {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0,
    })
    highest_active_severity: str = "NONE"
    failed_routes_detailed: Dict[str, Dict[str, str]] = field(default_factory=dict)
    started_at: float = 0.0
    finished_at: float = 0.0

    def as_json(self) -> Dict[str, object]:
        return {
            "startUrl": self.start_url,
            "domain": self.domain,
            "startedAt": self.started_at,
            "finishedAt": self.finished_at,
            "durationSec": round(max(0.0, self.finished_at - self.started_at), 3),
            "totals": {
                "visited": len(self.visited_urls),
                "passed": len(self.passed_routes),
                "failed": len(self.failed_routes),
                "interactions": self.interaction_count,
                "consoleErrors": len(self.console_errors),
                "payloadInjections": len(self.payload_injection_results),
                "xssReflected": len(self.xss_reflection_results),
            },
            "severityCounts": self.severity_counts,
            "highestActiveSeverity": self.highest_active_severity,
            "visitedRoutes": self.visited_urls,
            "passedRoutes": self.passed_routes,
            "failedRoutes": self.failed_routes,
            "failedRoutesDetailed": self.failed_routes_detailed,
            "payloadInjectionResults": self.payload_injection_results,
            "xssReflectionResults": self.xss_reflection_results,
            # Legacy aliases kept for backward compatibility with older parsers.
            "failed_routes": self.failed_routes,
            "failed_routes_detailed": self.failed_routes_detailed,
            "consoleErrors": self.console_errors,
        }


class SimpleBeaconDualNotifyingCrawler:
    REQUIRED_TOP_LEVEL_KEYS = [
        "startUrl",
        "domain",
        "startedAt",
        "finishedAt",
        "durationSec",
        "totals",
        "severityCounts",
        "highestActiveSeverity",
        "passedRoutes",
        "failedRoutes",
        "failedRoutesDetailed",
        "consoleErrors",
    ]

    REQUIRED_TOTAL_KEYS = [
        "visited",
        "passed",
        "failed",
        "interactions",
        "consoleErrors",
        "payloadInjections",
        "xssReflected",
    ]

    REQUIRED_SEVERITY_KEYS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

    def __init__(
        self,
        enable_assertions: bool = True,
        slack_url: str = "",
        discord_url: str = "",
        legacy_webhook_url: str = "",
        start_url: str = START_URL,
        timeout_ms: int = DEFAULT_TIMEOUT_MS,
        max_routes: int = DEFAULT_MAX_ROUTES,
        screenshot: bool = False,
        screenshot_dir: str = ".simplebeacon/logs/e2e-screenshots",
    ):
        self.start_url = start_url
        self.domain = urlparse(start_url).netloc
        self.timeout_ms = max(1000, timeout_ms)
        self.max_routes = max(1, max_routes)
        self.enable_assertions = enable_assertions
        self.screenshot = screenshot
        self.screenshot_dir = Path(screenshot_dir)
        self.visited_set = set()
        self.queue = [self.start_url]

        self.slack_webhook = slack_url or ""
        self.discord_webhook = discord_url or ""
        if legacy_webhook_url and not self.slack_webhook and not self.discord_webhook:
            if "discord.com" in legacy_webhook_url:
                self.discord_webhook = legacy_webhook_url
            else:
                self.slack_webhook = legacy_webhook_url

        self.report = CrawlReport(start_url=self.start_url, domain=self.domain)

    @staticmethod
    def _classify_failure(reason: str) -> str:
        normalized = reason.lower()
        if re.search(r"http return failure code:\s*5\d\d|timeout|no response|dns|connection reset", normalized):
            return "Critical"
        if re.search(r"http return failure code:\s*4\d\d|matched known error text pattern|assert|missing|not found", normalized):
            return "High"
        if re.search(r"forbidden|blocked|rate limit|unauthorized", normalized):
            return "Medium"
        return "Low"

    def _severity_breakdown(self) -> tuple[dict[str, int], list[tuple[str, str, str]]]:
        order = ["Critical", "High", "Medium", "Low"]
        rank = {name: idx for idx, name in enumerate(order)}
        counts = {name: 0 for name in order}
        rows: list[tuple[str, str, str]] = []

        for route, reason in self.report.failed_routes.items():
            severity = self._classify_failure(reason)
            counts[severity] += 1
            rows.append((severity, route, reason))

        rows.sort(key=lambda item: (rank[item[0]], item[1]))
        return counts, rows

    def _refresh_severity_telemetry(self) -> None:
        counts, rows = self._severity_breakdown()
        self.report.severity_counts = {
            "CRITICAL": counts.get("Critical", 0),
            "HIGH": counts.get("High", 0),
            "MEDIUM": counts.get("Medium", 0),
            "LOW": counts.get("Low", 0),
        }
        self.report.highest_active_severity = rows[0][0].upper() if rows else "NONE"

        for severity, route, reason in rows:
            detail = self.report.failed_routes_detailed.get(route, {})
            self.report.failed_routes_detailed[route] = {
                "severity": severity.upper(),
                "reason": reason,
                "timestamp": str(
                    detail.get("timestamp")
                    or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                ),
            }

    @staticmethod
    def _discord_color_for_severity(highest: str) -> int:
        if highest == "CRITICAL":
            return 15158332
        if highest == "HIGH":
            return 15105570
        if highest == "MEDIUM":
            return 15844367
        if highest == "LOW":
            return 3447003
        return 3066993

    @staticmethod
    def _severity_badge(severity: str) -> str:
        token = str(severity or "NONE").upper()
        badges = {
            "CRITICAL": "🔴",
            "HIGH": "🟠",
            "MEDIUM": "🟡",
            "LOW": "🔵",
            "NONE": "🟢",
        }
        return f"{badges.get(token, '⚪')} {token}"

    def _should_skip_url(self, url: str) -> bool:
        path = urlparse(url).path.lower()
        return any(path.endswith(ext) for ext in SKIP_EXTENSIONS)

    async def assert_business_logic(self, page: Page, url: str) -> None:
        if not self.enable_assertions:
            return
        path = urlparse(url).path.rstrip("/") or "/"
        body_text = (await page.locator("body").inner_text()).lower()

        if path == "/audit":
            has_marker = await page.locator("[class*='analyzer' i], [id*='audit' i], [data-testid*='analy' i]").count()
            if has_marker == 0:
                raise AssertionError("Route /audit missing analyzer/audit UI markers")
        elif path == "/pricing":
            if "enterprise" not in body_text:
                raise AssertionError("Route /pricing missing enterprise tier marker")
            yearly_toggle_count = await page.locator(
                "button:has-text('Yearly'), button:has-text('Annual'), [role='button']:has-text('Yearly'), [role='button']:has-text('Annual')"
            ).count()
            if yearly_toggle_count == 0:
                raise AssertionError("Route /pricing missing yearly/annual toggle")
        elif path == "/community":
            if "simplebeacon-mcp" not in body_text and "mcp" not in body_text:
                raise AssertionError("Route /community missing simplebeacon-mcp marker")
        elif path in {"/upload", "/cloud-scan"}:
            file_input_count = await page.locator("input[type='file']").count()
            if file_input_count < 1:
                raise AssertionError(f"Route {path} missing file input")

    XSS_TEST_PAYLOADS = [
        {"label": "script-tag", "value": "<script>window.__XSS_FIRED__=true</script>"},
        {"label": "img-onerror", "value": '<img src=x onerror="window.__XSS_FIRED__=true">'},
        {"label": "svg-onload", "value": '<svg onload="window.__XSS_FIRED__=true"></svg>'},
    ]

    PAYLOAD_VECTORS = [
        {"label": "XSS-script", "value": "<script>alert(1)</script>"},
        {"label": "XSS-img", "value": "<img src=x onerror=alert(1)>"},
        {"label": "SQL-injection", "value": "' OR '1'='1"},
        {"label": "overflow-10k", "value": "A" * 10000},
        {"label": "unicode-emoji", "value": "\U0001f680\u00e9\u4e2d\u2603\ufe0f"},
        {"label": "empty", "value": ""},
        {"label": "null-bytes", "value": "test\x00\x01null"},
        {"label": "template-injection", "value": "{{7*7}}${7*7}<%=7*7>"},
    ]

    FORM_SELECTORS = [
        "input[type='text']", "input[type='email']", "input[type='password']",
        "input[type='search']", "input[type='url']", "textarea",
        "input[placeholder]:not([type='hidden'])",
    ]

    async def inject_payloads(self, page: Page, url: str) -> int:
        injected = 0
        for selector in self.FORM_SELECTORS:
            elements = await page.locator(selector).all()
            for element in elements:
                try:
                    if not await element.is_visible():
                        continue
                except PlaywrightError:
                    continue
                for payload in self.PAYLOAD_VECTORS:
                    try:
                        await element.fill(payload["value"], timeout=1000)
                        actual = await element.input_value()
                        was_sanitized = actual != payload["value"]
                        was_truncated = len(actual) < len(payload["value"])
                        self.report.payload_injection_results.append({
                            "url": url, "selector": selector,
                            "payload": payload["label"],
                            "accepted": not was_sanitized,
                            "sanitized": was_sanitized,
                            "truncated": was_truncated,
                            "actualLength": len(actual),
                        })
                        injected += 1
                    except PlaywrightError:
                        continue
                try:
                    await element.fill("", timeout=500)
                except PlaywrightError:
                    pass
        if injected > 0:
            print(f"  Injected {injected} payload variants into form fields on {url}")
        return injected

    async def test_xss_reflection(self, page: Page, url: str) -> int:
        reflected = 0
        tested = 0
        for selector in self.FORM_SELECTORS:
            elements = await page.locator(selector).all()
            for element in elements:
                try:
                    if not await element.is_visible():
                        continue
                except PlaywrightError:
                    continue
                for payload in self.XSS_TEST_PAYLOADS:
                    try:
                        await page.evaluate("() => { delete window.__XSS_FIRED__; }")
                        await element.fill(payload["value"], timeout=1000)
                        tested += 1
                        # Try submitting the form
                        try:
                            submit_btn = page.locator("button[type='submit'], .contact-form-submit").first
                            if await submit_btn.is_visible():
                                await submit_btn.click(timeout=2000)
                                await page.wait_for_timeout(1500)
                        except PlaywrightError:
                            pass
                        xss_fired = await page.evaluate("() => !!window.__XSS_FIRED__")
                        if xss_fired:
                            reflected += 1
                            self.report.xss_reflection_results.append({
                                "url": url, "selector": selector,
                                "payload": payload["label"], "reflected": True,
                            })
                            print(f"  XSS REFLECTED & EXECUTED: {payload['label']} on {url}")
                    except PlaywrightError:
                        continue
                try:
                    await element.fill("", timeout=500)
                except PlaywrightError:
                    pass
        if tested > 0:
            print(f"  XSS reflection test: {tested} payloads tested, {reflected} reflected on {url}")
        return reflected

    async def interact_with_ui(self, page: Page) -> int:
        interactions = 0
        inputs = await page.locator("input[type='email'], input[type='text'], textarea").all()
        for idx, field in enumerate(inputs[:3]):
            try:
                if await field.is_visible() and await field.is_enabled():
                    await field.fill(f"agent-test-{idx}@simplebeacon.internal", timeout=1200)
                    interactions += 1
            except PlaywrightError:
                continue

        buttons = await page.locator("button, [role='button'], [class*='toggle' i], [class*='tab' i]").all()
        for btn in buttons[:4]:
            try:
                if await btn.is_visible() and await btn.is_enabled():
                    await btn.click(timeout=1000)
                    interactions += 1
            except PlaywrightError:
                continue

        file_inputs = await page.locator("input[type='file']").all()
        if file_inputs:
            with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
                tf.write("SimpleBeacon upload payload for E2E crawler\\n")
                temp_file_path = tf.name
            try:
                for file_input in file_inputs[:2]:
                    try:
                        await file_input.set_input_files(temp_file_path, timeout=1200)
                        interactions += 1
                    except PlaywrightError:
                        continue
            finally:
                try:
                    os.remove(temp_file_path)
                except OSError:
                    pass

        return interactions

    async def _discover_links(self, page: Page, current_url: str) -> List[str]:
        hrefs = await page.locator("a[href]").evaluate_all("els => els.map(el => el.getAttribute('href')).filter(Boolean)")
        discovered = []
        for href in hrefs:
            full_url = urljoin(current_url, href).split("#", 1)[0].rstrip("/")
            if not full_url:
                continue
            parsed = urlparse(full_url)
            if parsed.scheme not in {"http", "https"}:
                continue
            if parsed.netloc != self.domain:
                continue
            if full_url in self.visited_set or full_url in self.queue:
                continue
            discovered.append(full_url)
        return discovered

    async def scan_route(self, page: Page, url: str) -> None:
        if url in self.visited_set:
            return
        self.visited_set.add(url)
        self.report.visited_urls.append(url)

        route_result = RouteResult(url=url)
        started = time.time()

        if self._should_skip_url(url):
            self.report.passed_routes.append(url)
            route_result.status = "pass"
            route_result.reason = "Skipped static asset"
            route_result.duration_ms = int((time.time() - started) * 1000)
            self.report.route_results[url] = route_result
            return

        try:
            response = await page.goto(url, wait_until="networkidle", timeout=self.timeout_ms)
            if not response or response.status >= 400:
                raise RuntimeError(f"HTTP Return Failure Code: {response.status if response else 'Timeout'}")

            body_text = await page.locator("body").inner_text()
            for pattern in ERROR_TEXT_PATTERNS:
                if pattern.search(body_text):
                    raise AssertionError(f"Matched known error text pattern: {pattern.pattern}")

            interactions = await self.interact_with_ui(page)
            self.report.interaction_count += interactions
            await self.inject_payloads(page, url)
            await self.test_xss_reflection(page, url)
            await self.assert_business_logic(page, url)

            if self.screenshot:
                self.screenshot_dir.mkdir(parents=True, exist_ok=True)
                safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", (urlparse(url).path.strip("/") or "root")) + ".png"
                await page.screenshot(path=str(self.screenshot_dir / safe_name), full_page=True)

            links = await self._discover_links(page, url)
            for full_url in links:
                if len(self.visited_set) + len(self.queue) >= self.max_routes:
                    break
                self.queue.append(full_url)

            self.report.passed_routes.append(url)
            route_result.status = "pass"
        except Exception as err:
            route_result.status = "fail"
            route_result.reason = str(err)
            self.report.failed_routes[url] = str(err)
            self.report.failed_routes_detailed[url] = {
                "severity": self._classify_failure(str(err)).upper(),
                "reason": str(err),
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        finally:
            route_result.duration_ms = int((time.time() - started) * 1000)
            self.report.route_results[url] = route_result

    @staticmethod
    def dispatch_webhook(url: str, payload: Dict[str, object], label: str) -> None:
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "SimpleBeacon-Watchdog"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status not in [200, 201, 204]:
                    print(f"[WARN] {label} channel alert payload rejected: {resp.status}")
        except urllib.error.URLError as err:
            print(f"[WARN] {label} webhook execution failure: {err}")
        except Exception as err:
            print(f"[WARN] {label} webhook unexpected failure: {err}")

    def _notification_context(self) -> Dict[str, object]:
        total_failures = len(self.report.failed_routes)
        severity_counts, severity_rows = self._severity_breakdown()

        telemetry_counts = self.report.severity_counts if isinstance(self.report.severity_counts, dict) else {}
        severity_counts = {
            "Critical": int(telemetry_counts.get("CRITICAL", severity_counts["Critical"]) or 0),
            "High": int(telemetry_counts.get("HIGH", severity_counts["High"]) or 0),
            "Medium": int(telemetry_counts.get("MEDIUM", severity_counts["Medium"]) or 0),
            "Low": int(telemetry_counts.get("LOW", severity_counts["Low"]) or 0),
        }
        highest_severity = str(self.report.highest_active_severity or "NONE").upper()
        highest_severity_badge = self._severity_badge(highest_severity)

        xss_reflected_count = len(self.report.xss_reflection_results)
        unsanitized_count = len([
            r for r in self.report.payload_injection_results
            if r.get("accepted") and ("XSS" in str(r.get("payload", "")) or "template" in str(r.get("payload", "")))
        ])
        sanitized_count = len([r for r in self.report.payload_injection_results if r.get("sanitized")])
        total_injections = len(self.report.payload_injection_results)
        has_security_alert = xss_reflected_count > 0 or unsanitized_count > 50

        visited_count = len(self.report.visited_urls)
        if visited_count == 0:
            visited_count = len(self.report.passed_routes) + len(self.report.failed_routes)

        severity_summary = (
            f"Critical: {severity_counts['Critical']} | "
            f"High: {severity_counts['High']} | "
            f"Medium: {severity_counts['Medium']} | "
            f"Low: {severity_counts['Low']}"
        )

        top_failures_lines = []
        for severity, route, reason in severity_rows[:5]:
            top_failures_lines.append(f"[{severity}] {route}: {reason}")

        summary = (
            f"SimpleBeacon E2E scan complete\\n"
            f"Visited: {visited_count}\\n"
            f"Passed: {len(self.report.passed_routes)}\\n"
            f"Failed: {total_failures}\\n"
            f"Interactions: {self.report.interaction_count}\\n"
            f"Highest Active Severity: {highest_severity_badge}\\n"
            f"Severity: {severity_summary}"
        )

        if top_failures_lines:
            summary += "\\nTop Failures:\\n- " + "\\n- ".join(top_failures_lines)

        return {
            "total_failures": total_failures,
            "severity_counts": severity_counts,
            "severity_rows": severity_rows,
            "highest_severity": highest_severity,
            "highest_severity_badge": highest_severity_badge,
            "xss_reflected_count": xss_reflected_count,
            "unsanitized_count": unsanitized_count,
            "sanitized_count": sanitized_count,
            "total_injections": total_injections,
            "has_security_alert": has_security_alert,
            "visited_count": visited_count,
            "severity_summary": severity_summary,
            "summary": summary,
        }

    def build_discord_payload(self, context: Dict[str, object] | None = None) -> Dict[str, object]:
        ctx = context or self._notification_context()
        total_failures = int(ctx["total_failures"])
        highest_severity = str(ctx["highest_severity"])
        highest_severity_badge = str(ctx["highest_severity_badge"])
        summary = str(ctx["summary"])
        severity_counts = ctx["severity_counts"]
        has_security_alert = bool(ctx["has_security_alert"])

        embeds = [{
            "title": (
                f"E2E Regression Warning ({highest_severity})"
                if total_failures > 0
                else "E2E Health Check Passed"
            ),
            "color": self._discord_color_for_severity(highest_severity),
            "description": summary,
            "fields": [
                {"name": "Highest Active Severity", "value": highest_severity_badge, "inline": False},
                {
                    "name": "Failed Routes / Visited Routes",
                    "value": f"{total_failures} / {ctx['visited_count']}",
                    "inline": True,
                },
                {
                    "name": "Severity Counts Matrix",
                    "value": (
                        f"Critical: {severity_counts['Critical']} | "
                        f"High: {severity_counts['High']} | "
                        f"Medium: {severity_counts['Medium']} | "
                        f"Low: {severity_counts['Low']}"
                    ),
                    "inline": False,
                },
                {"name": "Payload Injections", "value": str(ctx["total_injections"]), "inline": True},
                {"name": "XSS Reflected", "value": str(ctx["xss_reflected_count"]), "inline": True},
                {"name": "Unsanitized XSS/Template", "value": str(ctx["unsanitized_count"]), "inline": True},
                {"name": "Sanitized by Field", "value": str(ctx["sanitized_count"]), "inline": True},
                {"name": "Security Report", "value": "SECURITY.md generated", "inline": True},
            ],
        }]

        if has_security_alert:
            alert_fields = []
            if int(ctx["xss_reflected_count"]) > 0:
                xss_list = "\\n".join(
                    f"{r.get('payload', '')} on {r.get('url', '')}"
                    for r in self.report.xss_reflection_results[:5]
                )
                alert_fields.append({
                    "name": "XSS Reflection Details",
                    "value": xss_list or "None",
                    "inline": False,
                })
            if int(ctx["unsanitized_count"]) > 0:
                grouped = {}
                for r in self.report.payload_injection_results:
                    if r.get("accepted") and ("XSS" in str(r.get("payload", "")) or "template" in str(r.get("payload", ""))):
                        key = str(r.get("url", ""))
                        if key not in grouped:
                            grouped[key] = set()
                        grouped[key].add(str(r.get("payload", "")))
                unsanitized_list = "\\n".join(
                    f"{url}: {', '.join(payloads)}"
                    for url, payloads in list(grouped.items())[:5]
                )
                alert_fields.append({
                    "name": "Unsanitized Payload Vectors",
                    "value": unsanitized_list or "None",
                    "inline": False,
                })

            embeds.append({
                "title": "Security Remediation Alert",
                "description": "Input sanitization failures detected. Review SECURITY.md for full details.",
                "color": 15105570,
                "fields": alert_fields,
                "footer": {"text": "SimpleBeacon Security Monitor"},
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            })

        return {"embeds": embeds}

    def build_slack_payload(self, context: Dict[str, object] | None = None) -> Dict[str, object]:
        ctx = context or self._notification_context()
        total_failures = int(ctx["total_failures"])
        highest_severity = str(ctx["highest_severity"])
        has_security_alert = bool(ctx["has_security_alert"])
        summary = str(ctx["summary"])
        severity_counts = ctx["severity_counts"]

        prefix = "E2E Health Check Passed" if total_failures == 0 else f"E2E Regression Warning ({highest_severity})"
        if has_security_alert:
            prefix = (
                "SECURITY ALERT: "
                f"{ctx['xss_reflected_count']} XSS reflections, "
                f"{ctx['unsanitized_count']} unsanitized payloads"
            )

        slack_text = f"{prefix}\\n{summary}"
        slack_blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": prefix},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Highest Active Severity*\\n{ctx['highest_severity_badge']}"},
                    {
                        "type": "mrkdwn",
                        "text": f"*Failed Routes / Visited Routes*\\n{total_failures} / {ctx['visited_count']}",
                    },
                    {"type": "mrkdwn", "text": f"*Failed Routes*\\n{total_failures}"},
                    {"type": "mrkdwn", "text": f"*Visited Routes*\\n{ctx['visited_count']}"},
                    {"type": "mrkdwn", "text": f"*Passed Routes*\\n{len(self.report.passed_routes)}"},
                    {
                        "type": "mrkdwn",
                        "text": (
                            "*Severity Counts Matrix*\\n"
                            f"Critical: {severity_counts['Critical']} | "
                            f"High: {severity_counts['High']} | "
                            f"Medium: {severity_counts['Medium']} | "
                            f"Low: {severity_counts['Low']}"
                        ),
                    },
                    {"type": "mrkdwn", "text": f"*Payload Injections*\\n{ctx['total_injections']}"},
                    {"type": "mrkdwn", "text": f"*XSS Reflected*\\n{ctx['xss_reflected_count']}"},
                    {"type": "mrkdwn", "text": f"*Unsanitized XSS/Template*\\n{ctx['unsanitized_count']}"},
                    {"type": "mrkdwn", "text": f"*Sanitized by Field*\\n{ctx['sanitized_count']}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"```{summary}```"},
            },
        ]

        if has_security_alert:
            security_detail = (
                f"XSS Reflected: {ctx['xss_reflected_count']}\\n"
                f"Unsanitized Payloads: {ctx['unsanitized_count']}\\n"
                "Review SECURITY.md for details."
            )
            slack_blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Security Remediation Alert*\\n{security_detail}"},
            })

        return {"text": slack_text, "blocks": slack_blocks}

    def validate_report_schema(self, report_json: Dict[str, object]) -> List[str]:
        errors: List[str] = []

        for key in self.REQUIRED_TOP_LEVEL_KEYS:
            if key not in report_json:
                errors.append(f"Missing top-level key: {key}")

        totals = report_json.get("totals")
        if not isinstance(totals, dict):
            errors.append("Key 'totals' must be an object")
        else:
            for key in self.REQUIRED_TOTAL_KEYS:
                if key not in totals:
                    errors.append(f"Missing totals key: {key}")

        severity_counts = report_json.get("severityCounts")
        if not isinstance(severity_counts, dict):
            errors.append("Key 'severityCounts' must be an object")
        else:
            for key in self.REQUIRED_SEVERITY_KEYS:
                if key not in severity_counts:
                    errors.append(f"Missing severityCounts key: {key}")

        if not isinstance(report_json.get("failedRoutes"), dict):
            errors.append("Key 'failedRoutes' must be an object")
        if not isinstance(report_json.get("failedRoutesDetailed"), dict):
            errors.append("Key 'failedRoutesDetailed' must be an object")
        if not isinstance(report_json.get("passedRoutes"), list):
            errors.append("Key 'passedRoutes' must be an array")
        if not isinstance(report_json.get("consoleErrors"), list):
            errors.append("Key 'consoleErrors' must be an array")
        if not isinstance(report_json.get("highestActiveSeverity"), str):
            errors.append("Key 'highestActiveSeverity' must be a string")

        return errors

    def ensure_report_ready_for_notifications(self) -> None:
        snapshot = self.report.as_json()
        errors = self.validate_report_schema(snapshot)
        if errors:
            details = "\\n".join([f"- {line}" for line in errors])
            raise RuntimeError(f"Notification report schema validation failed:\\n{details}")

    def load_report_from_json(self, report_json: Dict[str, object]) -> None:
        start_url = str(report_json.get("startUrl", self.start_url))
        domain = str(report_json.get("domain", self.domain))
        loaded = CrawlReport(start_url=start_url, domain=domain)

        loaded.started_at = float(report_json.get("startedAt", 0) or 0)
        loaded.finished_at = float(report_json.get("finishedAt", 0) or 0)
        loaded.visited_urls = [str(v) for v in report_json.get("visitedRoutes", [])] if isinstance(report_json.get("visitedRoutes"), list) else []
        loaded.passed_routes = [str(v) for v in report_json.get("passedRoutes", [])] if isinstance(report_json.get("passedRoutes"), list) else []
        loaded.failed_routes = {str(k): str(v) for k, v in report_json.get("failedRoutes", {}).items()} if isinstance(report_json.get("failedRoutes"), dict) else {}
        loaded.failed_routes_detailed = report_json.get("failedRoutesDetailed", {}) if isinstance(report_json.get("failedRoutesDetailed"), dict) else {}
        loaded.console_errors = [str(v) for v in report_json.get("consoleErrors", [])] if isinstance(report_json.get("consoleErrors"), list) else []

        totals = report_json.get("totals") if isinstance(report_json.get("totals"), dict) else {}
        loaded.interaction_count = int(totals.get("interactions", 0) or 0)
        loaded.severity_counts = report_json.get("severityCounts", {}) if isinstance(report_json.get("severityCounts"), dict) else loaded.severity_counts
        loaded.highest_active_severity = str(report_json.get("highestActiveSeverity", "NONE") or "NONE").upper()
        loaded.payload_injection_results = report_json.get("payloadInjectionResults", []) if isinstance(report_json.get("payloadInjectionResults"), list) else []
        loaded.xss_reflection_results = report_json.get("xssReflectionResults", []) if isinstance(report_json.get("xssReflectionResults"), list) else []

        self.start_url = loaded.start_url
        self.domain = loaded.domain
        self.report = loaded

    def trigger_notifications(self) -> None:
        context = self._notification_context()

        if self.discord_webhook:
            self.dispatch_webhook(
                self.discord_webhook,
                self.build_discord_payload(context),
                "Discord",
            )

        if self.slack_webhook:
            self.dispatch_webhook(self.slack_webhook, self.build_slack_payload(context), "Slack")

    def _write_json_report(self, json_out: str) -> None:
        out_path = Path(json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(self.report.as_json(), indent=2), encoding="utf-8")

    def _write_security_report(self) -> None:
        report_path = Path(__file__).resolve().parent.parent / "SECURITY.md"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        total = len(self.report.payload_injection_results)
        accepted = [r for r in self.report.payload_injection_results if r.get("accepted")]
        sanitized = [r for r in self.report.payload_injection_results if r.get("sanitized")]
        truncated = [r for r in self.report.payload_injection_results if r.get("truncated")]
        xss_accepted = [r for r in accepted if "XSS" in r.get("payload", "") or "template" in r.get("payload", "")]
        xss_reflected = self.report.xss_reflection_results

        by_url = {}
        for r in self.report.payload_injection_results:
            key = r.get("url", "")
            if key not in by_url:
                by_url[key] = []
            by_url[key].append(r)

        md = "# SimpleBeacon Security Vulnerability Report\n\n"
        md += f"**Generated:** {timestamp}\n"
        md += f"**Scanner:** SimpleBeacon E2E Python Runner v1.1\n"
        md += f"**Target:** {self.start_url}\n\n---\n\n"
        md += "## Executive Summary\n\n| Metric | Count |\n|---|---|\n"
        md += f"| Total payload injections | {total} |\n"
        md += f"| Accepted without sanitization | {len(accepted)} |\n"
        md += f"| Sanitized by input field | {len(sanitized)} |\n"
        md += f"| Truncated by maxlength | {len(truncated)} |\n"
        md += f"| XSS/template payloads accepted unsanitized | {len(xss_accepted)} |\n"
        md += f"| XSS payloads reflected & executed | {len(xss_reflected)} |\n\n"

        if xss_reflected:
            md += "## Critical: XSS Reflection Detected\n\n"
            md += "| URL | Payload Type | Selector |\n|---|---|---|\n"
            for r in xss_reflected:
                md += f"| {r.get('url', '')} | {r.get('payload', '')} | {r.get('selector', '')} |\n"
            md += "\n"
        else:
            md += "## XSS Reflection: Safe\n\n"
            md += "No injected script payloads were executed by the browser.\n\n"

        if xss_accepted:
            md += "## High Risk: Unsanitized XSS/Template Payloads Accepted\n\n"
            md += f"{len(xss_accepted)} payloads accepted without client-side sanitization.\n\n"
            grouped = {}
            for r in xss_accepted:
                key = f"{r.get('url', '')}|{r.get('selector', '')}"
                if key not in grouped:
                    grouped[key] = []
                grouped[key].append(r.get("payload", ""))
            md += "| URL | Selector | Payloads Accepted |\n|---|---|---|\n"
            for key, payloads in grouped.items():
                parts = key.split("|", 1)
                md += f"| {parts[0]} | {parts[1]} | {', '.join(payloads)} |\n"
            md += "\n"

        md += "## Detailed Payload Injection Results\n\n"
        for url, results in by_url.items():
            md += f"### {url}\n\n"
            md += "| Payload | Accepted | Sanitized | Truncated | Actual Length |\n|---|---|---|---|---|\n"
            for r in results:
                md += f"| {r.get('payload', '')} | {'Yes' if r.get('accepted') else 'No'} | {'Yes' if r.get('sanitized') else 'No'} | {'Yes' if r.get('truncated') else 'No'} | {r.get('actualLength', 0)} |\n"
            md += "\n"

        md += "## Remediation Recommendations\n\n"
        md += "1. **Client-side sanitization:** Apply `sanitizeUserPayload()` to all form fields before submission\n"
        md += "2. **Backend sanitization:** Apply `sanitizeRequestBody()` middleware to all POST endpoints\n"
        md += "3. **Content Security Policy:** Add CSP headers to prevent inline script execution\n"
        md += "4. **Input validation:** Enforce maxlength and pattern validation on all form fields\n"
        md += "5. **Output escaping:** Ensure all user-supplied data is HTML-escaped when rendered in the DOM\n\n"
        md += "---\n*This report is auto-generated by the SimpleBeacon E2E Python Runner.\n"

        report_path.write_text(md, encoding="utf-8")
        print(f"Security report generated: {report_path}")

    def _write_junit_report(self, junit_out: str) -> None:
        out_path = Path(junit_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        results = list(self.report.route_results.values())
        failures = [r for r in results if r.status == "fail"]
        total_time = max(0.0, self.report.finished_at - self.report.started_at)

        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            (
                f'<testsuite name="simplebeacon-e2e" tests="{len(results)}" '
                f'failures="{len(failures)}" errors="0" time="{total_time:.3f}">'
            ),
        ]
        for route in results:
            case_name = escape(route.url)
            case_time = max(0.0, route.duration_ms / 1000.0)
            lines.append(f'  <testcase classname="simplebeacon.e2e" name="{case_name}" time="{case_time:.3f}">')
            if route.status == "fail":
                msg = escape(route.reason or "Unknown failure")
                lines.append(f'    <failure message="{msg}"/>')
            lines.append("  </testcase>")
        lines.append("</testsuite>")
        out_path.write_text("\\n".join(lines) + "\\n", encoding="utf-8")

    async def execute(self, json_out: str, junit_out: str, notify: bool = True) -> None:
        self.report.started_at = time.time()
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1440, "height": 900})
            page = await context.new_page()
            page.on("console", lambda m: self.report.console_errors.append(m.text) if m.type == "error" else None)

            while self.queue and len(self.visited_set) < self.max_routes:
                await self.scan_route(page, self.queue.pop(0))

            await browser.close()

        self.report.finished_at = time.time()
        self._refresh_severity_telemetry()
        self._write_json_report(json_out)
        if junit_out:
            self._write_junit_report(junit_out)
        self._write_security_report()
        if notify:
            self.ensure_report_ready_for_notifications()
            self.trigger_notifications()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SimpleBeacon dynamic E2E crawler")
    parser.add_argument("--start-url", default=START_URL)
    parser.add_argument("--json-out", default=DEFAULT_JSON_OUT)
    parser.add_argument("--junit-out", default="")
    parser.add_argument("--timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS)
    parser.add_argument("--max-routes", type=int, default=DEFAULT_MAX_ROUTES)
    parser.add_argument("--screenshot", action="store_true")
    parser.add_argument("--screenshot-dir", default=".simplebeacon/logs/e2e-screenshots")
    parser.add_argument("--no-route-assertions", action="store_false", dest="assertions")
    parser.add_argument("--slack-webhook", default="", help="Explicit Slack webhook URL")
    parser.add_argument("--discord-webhook", default="", help="Explicit Discord webhook URL")
    parser.add_argument("--webhook", default="", help="Legacy single webhook URL")
    parser.add_argument("--skip-notifications", action="store_true", help="Generate reports but do not dispatch webhooks")
    parser.add_argument("--notify-from-report", default="", help="Dispatch notifications from an existing JSON report")
    return parser.parse_args()


async def async_main() -> int:
    args = parse_args()
    crawler = SimpleBeaconDualNotifyingCrawler(
        enable_assertions=args.assertions,
        slack_url=args.slack_webhook,
        discord_url=args.discord_webhook,
        legacy_webhook_url=args.webhook,
        start_url=args.start_url,
        timeout_ms=args.timeout_ms,
        max_routes=args.max_routes,
        screenshot=args.screenshot,
        screenshot_dir=args.screenshot_dir,
    )
    if args.notify_from_report:
        report_path = Path(args.notify_from_report)
        if not report_path.exists():
            raise SystemExit(f"Report not found: {report_path}")
        snapshot = json.loads(report_path.read_text(encoding="utf-8"))
        if not isinstance(snapshot, dict):
            raise SystemExit("Report payload must be a JSON object")
        crawler.load_report_from_json(snapshot)
        crawler.ensure_report_ready_for_notifications()
        if args.skip_notifications:
            print("Notification schema validation passed")
            return 0
        crawler.trigger_notifications()
        return 0

    await crawler.execute(args.json_out, args.junit_out, notify=(not args.skip_notifications))
    return 1 if crawler.report.failed_routes else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(async_main()))
