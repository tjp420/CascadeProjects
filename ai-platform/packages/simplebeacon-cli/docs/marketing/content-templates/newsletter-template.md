Subject: Simplebeacon scan results for {{projectName}}

Hi there,

Here is your monthly Simplebeacon hygiene summary for {{projectName}}:

**Overall health:** {{gatePass}} ({{qualityScore}}/100)
**Files scanned:** {{filesScanned}}
**Blocking issues:** {{blockingCount}}
**Warnings:** {{warningCount}}
{{#hasCredentialFindings}}**Credential findings:** {{credentialFindings}} — review recommended{{/hasCredentialFindings}}
{{#hasProductionLeaks}}**Production leaks:** {{productionLeakFindings}} — mock data in production paths{{/hasProductionLeaks}}
{{#hasEuAiAct}}**EU AI Act readiness:** {{euAiActScore}}/100{{/hasEuAiAct}}

Want the full report? Run: npx simplebeacon scan --gate in your repo root.

— The Simplebeacon Team
