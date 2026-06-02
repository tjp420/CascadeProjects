/**
 * Deliverable tier manifests for Analyze ZIP export bundles.
 */

function artifact(id, filename, label) {
  return { id, filename, label };
}

const A = {
  publicSummary: artifact('public-summary', 'json/public-summary.json', 'Public gate summary'),
  simplebeaconGate: artifact('simplebeacon-gate', 'json/simplebeacon-gate.json', 'SimpleBeacon gate report'),
  fictionDigest: artifact('fiction-digest', 'json/fiction-digest.json', 'Fiction KPI digest'),
  complianceChecklist: artifact('compliance-checklist', 'json/compliance-checklist.json', 'Compliance checklist'),
  completeScanBundle: artifact('complete-scan-bundle', 'json/complete-scan.json', 'Complete scan bundle'),
  consolidation: artifact('consolidation', 'json/consolidation.json', 'Consolidation report'),
  codebaseSummary: artifact('codebase-summary', 'json/codebase-summary.json', 'Codebase summary'),
  fileReduction: artifact('file-reduction', 'json/file-reduction.json', 'File reduction scan'),
  dataQuality: artifact('data-quality', 'json/data-quality.json', 'Data quality scan'),
  cleanupBrief: artifact('cleanup-brief', 'json/cleanup-brief.json', 'Cleanup assistant brief'),
  npmAudit: artifact('npm-audit', 'json/npm-audit.json', 'npm audit summary'),
  roadmap: artifact('roadmap', 'json/roadmap.json', 'Roadmap advisory'),
  euAiActSprint: artifact('eu-ai-act-sprint', 'json/eu-ai-act-sprint.json', 'EU AI Act sprint bundle'),
  executiveAudit: artifact('executive-audit', 'reports/executive-audit.html', 'Executive audit PDF source'),
  euAiActAudit: artifact('eu-ai-act-audit', 'reports/eu-ai-act-audit.html', 'EU AI Act audit PDF source'),
  agencyCertificate: artifact('agency-certificate', 'reports/agency-certificate.html', 'Agency milestone certificate'),
  reAttestationReadme: artifact('re-attestation-readme', 'json/re-attestation-note.json', 'Re-attestation cover letter metadata')
};

const ENGINE_ARTIFACTS = [
  A.consolidation,
  A.codebaseSummary,
  A.fileReduction,
  A.dataQuality,
  A.cleanupBrief,
  A.npmAudit,
  A.roadmap
];

const DELIVERABLE_TIERS = {
  community: {
    id: 'community',
    label: 'Community gate export',
    productSku: 'community',
    requiresCompleteScan: false,
    minScanKind: ['complete', 'simplebeacon-report', 'unknown'],
    artifacts: [A.publicSummary, A.simplebeaconGate]
  },
  clearance499: {
    id: 'clearance499',
    label: 'Executive clearance ($499)',
    productSku: 'clearance499',
    requiresCompleteScan: true,
    minScanKind: ['complete'],
    artifacts: [
      A.publicSummary,
      A.simplebeaconGate,
      A.fictionDigest,
      A.complianceChecklist,
      A.executiveAudit
    ]
  },
  agency999: {
    id: 'agency999',
    label: 'Agency Project Pack ($999)',
    productSku: 'agency999',
    requiresCompleteScan: true,
    minScanKind: ['complete'],
    artifacts: [
      A.simplebeaconGate,
      A.fictionDigest,
      A.complianceChecklist,
      A.completeScanBundle,
      ...ENGINE_ARTIFACTS,
      A.executiveAudit,
      A.agencyCertificate
    ]
  },
  agency1499: {
    id: 'agency1499',
    label: 'Agency Growth Pack ($1,499)',
    productSku: 'agency1499',
    requiresCompleteScan: true,
    minScanKind: ['complete'],
    artifacts: [
      A.simplebeaconGate,
      A.fictionDigest,
      A.complianceChecklist,
      A.completeScanBundle,
      ...ENGINE_ARTIFACTS,
      A.executiveAudit,
      A.agencyCertificate,
      A.reAttestationReadme
    ]
  },
  euai2499: {
    id: 'euai2499',
    label: 'EU AI Act Readiness Sprint ($2,499)',
    productSku: 'euai2499',
    requiresCompleteScan: true,
    minScanKind: ['complete', 'eu-ai-act'],
    artifacts: [
      A.simplebeaconGate,
      A.complianceChecklist,
      A.euAiActSprint,
      A.euAiActAudit,
      A.executiveAudit
    ]
  },
  warranty199: {
    id: 'warranty199',
    label: 'Post-handoff re-scan ($199)',
    productSku: 'warranty199',
    requiresCompleteScan: true,
    minScanKind: ['complete'],
    artifacts: [
      A.simplebeaconGate,
      A.complianceChecklist,
      A.executiveAudit,
      A.reAttestationReadme
    ]
  },
  operator: {
    id: 'operator',
    label: 'Operator vault export',
    productSku: 'operator',
    requiresCompleteScan: false,
    minScanKind: ['complete', 'simplebeacon-report', 'eu-ai-act', 'unknown'],
    artifacts: [
      A.publicSummary,
      A.simplebeaconGate,
      A.fictionDigest,
      A.complianceChecklist,
      A.completeScanBundle,
      ...ENGINE_ARTIFACTS,
      A.euAiActSprint,
      A.executiveAudit,
      A.euAiActAudit,
      A.agencyCertificate,
      A.reAttestationReadme
    ]
  }
};

function getTierManifest(tierId) {
  const tier = DELIVERABLE_TIERS[tierId];
  if (!tier) return null;
  return {
    id: tier.id,
    label: tier.label,
    productSku: tier.productSku,
    artifacts: tier.artifacts.map((entry) => ({ ...entry }))
  };
}

function resolveDeliverableTier(options = {}) {
  const requested = String(options.requestedSku || options.deliverableSku || '').trim().toLowerCase();

  if (options.internalDashboard) {
    if (!requested || requested === 'operator' || requested === 'custom') {
      return 'operator';
    }
    if (DELIVERABLE_TIERS[requested]) return requested;
    return 'operator';
  }

  if (requested && DELIVERABLE_TIERS[requested] && requested !== 'operator') {
    return requested;
  }

  if (options.cloudTeamsActive && DELIVERABLE_TIERS.agency999) {
    return 'agency999';
  }

  if (options.hasAuditDeliverableAccess && !options.publicGateLocked) {
    return requested || 'clearance499';
  }

  return 'community';
}

module.exports = {
  DELIVERABLE_TIERS,
  getTierManifest,
  resolveDeliverableTier
};
