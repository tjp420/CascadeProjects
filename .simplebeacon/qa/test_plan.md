# Test Plan — Compliance Rule Expansion

> QA Phase 1 deliverable. No implementation until approved.
> Spec: `.simplebeacon/qa/compliance-expansion-spec.md`

## Objective check-items

### OWASP LLM Top 10 Scanner (`owasp-llm-patterns.js`)

| # | Check-item | Level | Pass criteria |
|---|-----------|-------|---------------|
| 1 | LLM01 Prompt Injection: flags `prompt += req.body.input` | L1 | Finding with ruleId `OWASP-LLM01-001`, severity `high` |
| 2 | LLM02 Sensitive Info: flags `openai.create({prompt: user.email})` | L1 | Finding with ruleId `OWASP-LLM02-001`, severity `high` |
| 3 | LLM03 Supply Chain: flags `require('openai')` without version pin | L1 | Finding with ruleId `OWASP-LLM03-001`, severity `medium` |
| 4 | LLM04 Data Poisoning: flags `fetch('http://scraped-data.json')` | L1 | Finding with ruleId `OWASP-LLM04-001`, severity `medium` |
| 5 | LLM05 Output Handling: flags `innerHTML = aiResponse` | L1 | Finding with ruleId `OWASP-LLM05-001`, severity `high` |
| 6 | LLM06 Excessive Agency: flags `exec(aiCommand)` | L1 | Finding with ruleId `OWASP-LLM06-001`, severity `high` |
| 7 | LLM07 System Prompt Leak: flags `role:'system', content: API_KEY` | L1 | Finding with ruleId `OWASP-LLM07-001`, severity `medium` |
| 8 | LLM08 Vector/Embedding: flags `embeddings.create({input: userInput})` without auth | L1 | Finding with ruleId `OWASP-LLM08-001`, severity `medium` |
| 9 | LLM09 Misinformation: flags `return aiResponse` without disclaimer in UI | L1 | Finding with ruleId `OWASP-LLM09-001`, severity `low` |
| 10 | LLM10 Unbounded Consumption: flags `max_tokens: 999999` | L1 | Finding with ruleId `OWASP-LLM10-001`, severity `high` |
| 11 | Suppression: `// simplebeacon-ignore owasp-llm` suppresses findings | L1 | 0 findings on suppressed lines |
| 12 | Skip dirs: node_modules, .git, dist, build are skipped | L1 | 0 findings from skipped dirs |
| 13 | Clean file: file with no LLM patterns produces 0 findings | L1 | 0 findings |
| 14 | Syntax check: `node -c owasp-llm-patterns.js` passes | L1 | Exit code 0 |

### EU AI Act Articles 9-27 Extension (`eu-ai-act-patterns.js`)

| # | Check-item | Level | Pass criteria |
|---|-----------|-------|---------------|
| 15 | Art. 9 Risk Management: flags AI system without risk register artifact | L1 | Finding with ruleId `EUAI-RM-001` |
| 16 | Art. 10 Data Governance: flags `fetch('http://dataset.json')` without validation | L1 | Finding with ruleId `EUAI-DG-001` |
| 17 | Art. 12 Record-keeping: flags AI decision route without logging | L1 | Finding with ruleId `EUAI-RK-001` |
| 18 | Art. 14 Human Oversight: flags `autoApprove()` without override | L1 | Finding with ruleId `EUAI-HO-002` |
| 19 | Art. 15 Robustness: flags missing model evaluation artifacts | L1 | Finding with ruleId `EUAI-RAS-001` |
| 20 | Art. 27 FRIA: flags high-risk AI without FRIA (high severity when Annex III detected) | L1 | Finding with ruleId `EUAI-FRIA-001`, severity `high` |
| 21 | Existing rules still pass: no regressions in EUAI-HR-001 through EUAI-LOG-001 | L1 | All existing tests pass |
| 22 | Syntax check: `node -c eu-ai-act-patterns.js` passes | L1 | Exit code 0 |

### Integration

| # | Check-item | Level | Pass criteria |
|---|-----------|-------|---------------|
| 23 | scan.js wires `owasp-llm-patterns` into SCANNER_REGISTRY | L1 | Scanner runs when enabled |
| 24 | Config toggle: `rules.owasp-llm-patterns.enabled: true` enables scanner | L1 | Scanner runs |
| 25 | Config toggle: `rules.owasp-llm-patterns.enabled: false` disables scanner | L1 | Scanner does not run |
| 26 | Full gate scan: `npx simplebeacon scan --gate` still passes | L1 | Gate PASS |
| 27 | Existing test suite: `npm test` in ai-platform still passes | L1 | All suites pass |

## Files, routes, commands

| Type | Path |
|------|------|
| New source | `packages/simplebeacon-cli/src/rules/owasp-llm-patterns.js` |
| Extended source | `packages/simplebeacon-cli/src/rules/eu-ai-act-patterns.js` |
| Extended source | `packages/simplebeacon-cli/src/scan.js` |
| New test | `packages/simplebeacon-cli/tests/owasp-llm-patterns.test.js` |
| New test | `packages/simplebeacon-cli/tests/eu-ai-act-compliance.test.js` |
| New fixtures | `packages/simplebeacon-cli/tests/fixtures/owasp-llm/*.js` |
| New fixtures | `packages/simplebeacon-cli/tests/fixtures/eu-ai-act/*.js` |
| Updated doc | `packages/simplebeacon-cli/docs/RULE-AUTHORING.md` |

## Commands

```powershell
node -c packages/simplebeacon-cli/src/rules/owasp-llm-patterns.js
node -c packages/simplebeacon-cli/src/rules/eu-ai-act-patterns.js
node --test packages/simplebeacon-cli/tests/owasp-llm-patterns.test.js
node --test packages/simplebeacon-cli/tests/eu-ai-act-compliance.test.js
cd ai-platform && npm test
npx simplebeacon scan --gate --format json
```
