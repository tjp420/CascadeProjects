# test_plan.md

> Copy to `.simplebeacon/qa/test_plan.md` and fill before Builder writes feature code.
> User approval required unless the task explicitly includes an approved plan.

## Metadata

| Field            | Value                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| Feature / change |                                                                                    |
| Author (Builder) |                                                                                    |
| Date             |                                                                                    |
| Branch           |                                                                                    |
| Packages touched | ai-platform / simplebeacon-vscode-merged / packages/simplebeacon-cli / coming-soon |

## Scope

### Files in scope

-

### APIs / routes

-

### UI / IDE surfaces

- [ ] Sidebar webview
- [ ] Main dashboard iframe / address bar
- [ ] Welcome / main window panel
- [ ] Simple Browser / external browser

---

## Level 1 — Deterministic (Validator MUST run all)

| ID    | Check                          | Command / method                                    | Pass |
| ----- | ------------------------------ | --------------------------------------------------- | ---- |
| L1-01 | Syntax on changed JS/CJS       | `node -c <file>`                                    | [ ]  |
| L1-02 | ai-platform tests (if touched) | `cd ai-platform && npm test`                        | [ ]  |
| L1-03 | Extension compile (if touched) | `cd simplebeacon-vscode-merged && npm run compile`  | [ ]  |
| L1-04 | SimpleBeacon gate (full)       | `npx simplebeacon scan --full --gate --format json` | [ ]  |
| L1-05 | No secrets in diff             | Manual / gate token rules                           | [ ]  |
| L1-06 | npm audit (if deps changed)    | `npm audit`                                         | [ ]  |

---

## Level 2 — Behavioral

| ID    | Scenario | Steps | Expected | Pass |
| ----- | -------- | ----- | -------- | ---- |
| L2-01 |          |       |          | [ ]  |
| L2-02 |          |       |          | [ ]  |

---

## Level 3 — Edge cases & regression

| ID    | Case                           | Expected                                  | Pass |
| ----- | ------------------------------ | ----------------------------------------- | ---- |
| L3-01 | Website mode vs localhost mode | Embed params preserved                    | [ ]  |
| L3-02 | SPA route change               | `sb_api_base` / `sb_notify_base` retained | [ ]  |
| L3-03 | Extension host load            | No runaway webview postMessage loops      | [ ]  |

---

## Security

| ID   | Requirement                                                 | Pass |
| ---- | ----------------------------------------------------------- | ---- |
| S-01 | No credentials / PII in logs or commits                     | [ ]  |
| S-02 | Localhost bridge only for 127.0.0.1 / extension data server | [ ]  |

---

## Approval

- [ ] User approved this plan (or task included approved scope)
- Approved by: __________ Date: __________
