const { evaluateComplianceChecklist } = require('../packages/simplebeacon-cli/src/compliance-checklist.js');

const report = {
  projectRoot: 'C:/Users/Trevor/CascadeProjects',
  gate: { pass: true, blockingCount: 0 },
  credentialFindings: 0,
  productionLeakFindings: 0,
  schemaChecked: 0,
  consistencyChecked: 0,
  euAiActScanned: null,
  rawIssues: []
};

try {
  const result = evaluateComplianceChecklist(report, { projectRoot: 'C:/Users/Trevor/CascadeProjects' });
  console.log('SUCCESS:', JSON.stringify(result.summary));
} catch (e) {
  console.log('ERROR:', e.message);
  console.log(e.stack);
}
