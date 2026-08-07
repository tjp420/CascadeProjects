# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field | Value |
|-------|-------|
| Feature / change | Interactive Compliance Policy Editor panel (`PolicyEditor.js`) |
| Author (Builder) | Devin |
| Date | 2026-08-07 |
| Branch | feature/compliance-policy-editor |
| Packages touched | ai-platform (dashboard frontend only) |

## Scope

### Files in scope

- `ai-platform/web/simplebeacon-dashboard/js-es2018/components/PolicyEditor.js` (NEW)
- `ai-platform/web/simplebeacon-dashboard/css/components.css` (append styles)
- `ai-platform/web/simplebeacon-dashboard/js-es2018/views/DashboardView.js` (import + mount slot)

### APIs / routes

- `GET /api/config` — existing, used to load current config (profile, gate, rules)
- `PUT /api/config` — existing, used to save edited config
- `GET /api/config/presets` — existing, used to load preset profiles

### UI / IDE surfaces

- [ ] Sidebar webview
- [x] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID | Check | Command / method | Pass |
|----|-------|------------------|------|
| L1-01 | Syntax on PolicyEditor.js | `node -c ai-platform/web/simplebeacon-dashboard/js-es2018/components/PolicyEditor.js` | [ ] |
| L1-02 | Syntax on DashboardView.js | `node -c ai-platform/web/simplebeacon-dashboard/js-es2018/views/DashboardView.js` | [ ] |
| L1-03 | ai-platform tests (not touched — skip) | N/A | [ ] |
| L1-04 | SimpleBeacon gate (full) | `npx simplebeacon scan --full --gate --format json` | [ ] |
| L1-05 | No secrets in diff | Manual / gate token rules | [ ] |
| L1-06 | npm audit (no deps changed — skip) | N/A | [ ] |

---

## Level 2 — Behavioral

| ID | Scenario | Steps | Expected | Pass |
|----|----------|-------|----------|------|
| L2-01 | Policy editor renders on dashboard | Navigate to dashboard with a loaded report | Policy editor card appears below scan status section with current config values | [ ] |
| L2-02 | Gate severity toggles work | Click fail-on/warn-on checkboxes for high/medium/low | Checkbox state updates, dirty indicator appears, preview updates | [ ] |
| L2-03 | Rule engine toggles work | Click toggle switches for individual rules (credentials, json-schema, etc.) | Toggle visual state flips, dirty indicator appears | [ ] |
| L2-04 | Profile preset selector | Change profile dropdown (minimal/standard/cascade) | Rule toggles update to match preset, dirty indicator appears | [ ] |
| L2-05 | Save config | Click "Save Policy" button | Config is PUT to server, success toast appears, dirty indicator clears | [ ] |
| L2-06 | Reset to saved | Click "Reset" button while dirty | All fields revert to last saved state, dirty indicator clears | [ ] |
| L2-07 | Live preview panel | Toggle rules and gate severities | Preview panel shows effective gate policy summary (fail-on/warn-on counts, enabled rule count) | [ ] |
| L2-08 | Empty state | Dashboard with no report loaded | Policy editor still renders with config from server (or placeholder if no config) | [ ] |

---

## Level 3 — Edge cases & regression

| ID | Case | Expected | Pass |
|----|------|----------|------|
| L3-01 | Website mode vs localhost mode | Embed params preserved; policy editor works in both modes | [ ] |
| L3-02 | SPA route change | Navigating away and back to dashboard re-mounts policy editor cleanly | [ ] |
| L3-03 | Config save failure | Server returns error → error toast shown, dirty state retained | [ ] |
| L3-04 | No config loaded | Policy editor renders with defaults (all rules enabled, failOn: high) | [ ] |
| L3-05 | Rapid toggle clicks | No race conditions; final state matches last click | [ ] |

---

## Security

| ID | Requirement | Pass |
|----|-------------|------|
| S-01 | No credentials / PII in logs or commits | [ ] |
| S-02 | Config save uses existing authenticated fetchSimplebeacon helper | [ ] |
| S-03 | All user-generated content escaped via escapeHtml | [ ] |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________  Date: __________
