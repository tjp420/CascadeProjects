# software_health_report.md

> Validator output after executing `.simplebeacon/qa/test_plan.md`.
> Copy to `.simplebeacon/qa/software_health_report.md` when complete.

## Metadata

| Field             | Value             |
| ----------------- | ----------------- |
| Validator         |                   |
| Date              |                   |
| Branch            |                   |
| test_plan version | (date or git sha) |

## Executive summary

- **Gate:** PASS / FAIL — quality score: __ — blocking: __
- **Level 1:** __ / __ passed
- **Level 2:** __ / __ passed
- **Level 3:** __ / __ passed
- **Ship recommendation:** GO / NO-GO

---

## 1. Defects (fix immediately)

| ID   | test_plan ref | Description | Severity                 | Owner |
| ---- | ------------- | ----------- | ------------------------ | ----- |
| D-01 |               |             | critical / high / medium |       |

---

## 2. Unimplemented (spec gaps)

| ID   | test_plan ref | Missing capability | Notes |
| ---- | ------------- | ------------------ | ----- |
| U-01 |               |                    |       |

---

## 3. Enhancements (debt / perf / UX)

| ID   | Area | Suggestion | Effort    |
| ---- | ---- | ---------- | --------- |
| E-01 |      |            | S / M / L |

---

## 4. Future roadmap

| ID   | Feature | Rationale |
| ---- | ------- | --------- |
| R-01 |         |           |

---

## Command log (summary)

```
# Paste abbreviated results — gate, npm test, compile
```

---

## Validator sign-off

- [ ] All Level 1 checks executed
- [ ] Failures documented in Defects (not hidden)
- [ ] No feature code written except test fixes
- Validator: __________ Date: __________
