---
name: "Pilot Week 1 Feedback"
about: "Submit Week 1 feedback for the observability pilot"
title: "[Pilot Feedback] "
labels: "pilot-feedback"
assignees: []
---

# 📝 Pilot Week 1 Developer Feedback Form

Please complete this evaluation at the end of the initial telemetry trial week. The feedback helps the team triage alert noise, UX friction, and performance regressions.

## 👤 Contributor Context
- **Name / Handle**: 
- **Engineering Discipline**: [ ] Automation  [ ] Infra/SRE  [ ] Security  [ ] QA  [ ] Product

## 💾 Storage Layer & Performance Evaluation
1. Have you encountered any browser crashes or "Out of Memory" freezes when loading large scan reports?
   - [ ] Yes
   - [ ] No
2. Check your browser DevTools Console. Is the `⚡ IndexedDB (Quota-Safe)` status badge visible in the Results view footer?
   - [ ] Yes
   - [ ] No
3. Rate the perceived dashboard loading speed when switching between findings views (1-5, 5 being instantaneous): ______

## 🌀 Local Jitter Harness Usage
1. Did you run the `npm run dev:jitter` harness during local development tasks this week?
   - [ ] Yes
   - [ ] No
2. Did the pre-flight health checker (`scripts/check-api.js`) successfully flag offline backend instances on your machine?
   - [ ] Yes
   - [ ] No / False Positive

## 🚨 Alert Fidelity & Noise Tracking
1. Did you receive any automated failure alerts from the `verify-vite-build` or `web-e2e-tests` CI pipelines in Slack/Teams?
   - [ ] Yes
   - [ ] No
2. If yes, were the direct log links and artifact trace bundles sufficient to debug the breaking commit?
   - [ ] Yes
   - [ ] No (Please specify missing context below)

## 💬 General Observations & Friction Points
Please detail any layout anomalies, loading state flakiness, or documentation gaps experienced during the pilot phase:

---

**Optional:** Attach a screenshot, HAR file, or a short screen recording (mp4) to help the engineering team reproduce the issue.
