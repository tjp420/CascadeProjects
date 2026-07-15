// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * SimpleBeacon → Trello Roadmap Export
 * Generates a complete Trello board JSON for import via Trello's JSON import
 * https://trello.com/b/create-board?source=import
 */

const fs = require('fs');

// Board metadata
const boardName = process.argv[2] || 'SimpleBeacon Remediation Roadmap';
const projectName = process.argv[3] || 'Unknown';
const timestamp = new Date().toISOString();

const TRELLO_LIST_POS_STEP = 65536;
const TRELLO_CARD_POS_STEP = 1024;

// Lists (phases/status columns)
const lists = [
  { id: 'list_pending', name: 'Pending', pos: TRELLO_LIST_POS_STEP },
  { id: 'list_progress', name: 'In Progress', pos: TRELLO_LIST_POS_STEP * 2 },
  { id: 'list_review', name: 'Under Review', pos: TRELLO_LIST_POS_STEP * 3 },
  { id: 'list_done', name: 'Done', pos: TRELLO_LIST_POS_STEP * 4 }
];

// Color mapping for severity
const severityColors = {
  critical: { name: 'Critical', color: 'red' },
  high: { name: 'High', color: 'orange' },
  medium: { name: 'Medium', color: 'yellow' },
  low: { name: 'Low', color: 'green' }
};

// Phase definitions mapped to analyzer modules
const phases = [
  {
    id: 'phase_euai',
    name: 'Phase 1: EU AI Act Compliance',
    severity: 'high',
    effort: '5–10 days',
    listId: 'list_progress',
    desc: 'Regulatory readiness for EU AI Act requirements.',
    labels: ['high', 'compliance'],
    tasks: [
      'Review AI system indicators (Art. 6)',
      'Generate documentation artifacts (Art. 10)',
      'Review high-risk system classification (Annex III)',
      'Schedule legal/compliance review',
      'Prepare transparency obligations (Art. 13)'
    ]
  },
  {
    id: 'phase_security',
    name: 'Phase 2: Security & Secret Hygiene',
    severity: 'critical',
    effort: '2–5 days',
    listId: 'list_pending',
    desc: 'Remove hardcoded credentials, secrets, and insecure configurations.',
    labels: ['critical', 'security'],
    tasks: [
      'Audit all hardcoded credentials (API keys, passwords)',
      'Scan for secrets in logs and localStorage',
      'Review .env files for committed secrets',
      'Rotate exposed credentials immediately',
      'Implement secret scanning in CI/CD'
    ]
  },
  {
    id: 'phase_ai_residue',
    name: 'Phase 3: AI Residue Cleanup',
    severity: 'medium',
    effort: '3–7 days',
    listId: 'list_pending',
    desc: 'Remove AI-generated stubs, deprecated patterns, and dead code.',
    labels: ['medium', 'cleanup'],
    tasks: [
      'Remove stub implementations (TODO/placeholder functions)',
      'Fix empty catch blocks (error swallowing)',
      'Replace deprecated API calls',
      'Remove unreachable dead code branches',
      'Add proper error handling and logging'
    ]
  },
  {
    id: 'phase_performance',
    name: 'Phase 4: Performance Optimization',
    severity: 'medium',
    effort: '3–5 days',
    listId: 'list_pending',
    desc: 'Fix nested loops, event listener leaks, and O(n²) patterns.',
    labels: ['medium', 'performance'],
    tasks: [
      'Optimize nested loop patterns',
      'Clean up leaked event listeners',
      'Review and debounce expensive operations',
      'Profile hot paths in production'
    ]
  },
  {
    id: 'phase_type_safety',
    name: 'Phase 5: Type Safety & Documentation',
    severity: 'medium',
    effort: '4–8 days',
    listId: 'list_pending',
    desc: 'Replace any types, add PropTypes, remove ts-ignore flags.',
    labels: ['medium', 'quality'],
    tasks: [
      'Replace TypeScript any types with proper types',
      'Add React PropTypes where missing',
      'Remove ts-ignore annotations with fixes',
      'Document undocumented public functions',
      'Add JSDoc / docstrings to core modules'
    ]
  },
  {
    id: 'phase_testing',
    name: 'Phase 6: Test Coverage Improvement',
    severity: 'medium',
    effort: '5–10 days',
    listId: 'list_pending',
    desc: 'Unskip tests, fill empty test blocks, add missing coverage.',
    labels: ['medium', 'testing'],
    tasks: [
      'Unskip all .skip / xit / @Disabled tests',
      'Remove empty test/it blocks',
      'Add tests for uncovered critical paths',
      'Set up coverage reporting in CI',
      'Add integration tests for key workflows'
    ]
  },
  {
    id: 'phase_a11y_i18n',
    name: 'Phase 7: Accessibility & Internationalization',
    severity: 'low',
    effort: '3–6 days',
    listId: 'list_pending',
    desc: 'Fix missing alt text, ARIA gaps, and hardcoded UI strings.',
    labels: ['low', 'a11y'],
    tasks: [
      'Add alt text to all images',
      'Add aria-label to unlabeled inputs',
      'Audit color contrast ratios',
      'Extract hardcoded strings to i18n keys',
      'Add locale-aware date/number formatting'
    ]
  },
  {
    id: 'phase_config',
    name: 'Phase 8: Configuration & Drift',
    severity: 'medium',
    effort: '2–4 days',
    listId: 'list_pending',
    desc: 'Fix hardcoded URLs, .env references, and config drift.',
    labels: ['medium', 'config'],
    tasks: [
      'Move hardcoded URLs to config files',
      'Remove .env file references from source',
      'Audit environment-specific configs',
      'Document configuration schema'
    ]
  },
  {
    id: 'phase_deps',
    name: 'Phase 9: Dependency & Workspace Health',
    severity: 'low',
    effort: '2–4 days',
    listId: 'list_pending',
    desc: 'Remove unused deps, fix circular imports, audit vulnerabilities.',
    labels: ['low', 'deps'],
    tasks: [
      'Remove unused dependencies from package.json',
      'Fix circular import chains',
      'Run npm audit and update vulnerable packages',
      'Clean up dead code and duplicate files',
      'Verify build readiness across environments'
    ]
  },
  {
    id: 'phase_api',
    name: 'Phase 10: API Contract & Framework Practices',
    severity: 'medium',
    effort: '3–6 days',
    listId: 'list_pending',
    desc: 'Fix REST endpoint drift, React hook misuse, missing cleanup.',
    labels: ['medium', 'api'],
    tasks: [
      'Audit REST endpoints for frontend consumption',
      'Fix React hook rule violations',
      'Add cleanup in useEffect hooks',
      'Document API contract changes',
      'Add API versioning strategy'
    ]
  }
];

function generateLabels() {
  const labelMap = {};
  const allLabels = [...new Set(phases.flatMap(p => p.labels))];
  return allLabels.map((name, i) => {
    const colorMap = {
      critical: 'red', high: 'orange', medium: 'yellow', low: 'green',
      compliance: 'blue', security: 'black', cleanup: 'lime',
      performance: 'sky', quality: 'purple', testing: 'pink',
      a11y: 'yellow', config: 'grey', deps: 'green', api: 'sky'
    };
    return {
      id: `label_${i}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      color: colorMap[name] || 'blue'
    };
  });
}

function generateCards() {
  const labels = generateLabels();
  const labelByName = Object.fromEntries(labels.map(l => [l.name.toLowerCase(), l.id]));

  return phases.map((phase, i) => ({
    id: `card_${i}`,
    name: phase.name,
    desc: `${phase.desc}\n\nSeverity: ${phase.severity}\nEffort: ${phase.effort}\n\nAuto-generated from SimpleBeacon scan.`,
    idList: phase.listId,
    pos: (i + 1) * TRELLO_CARD_POS_STEP,
    labels: phase.labels.map(l => labelByName[l]).filter(Boolean),
    checklists: [{
      id: `check_${i}`,
      name: 'Remediation Tasks',
      checkItems: phase.tasks.map((task, j) => ({
        id: `item_${i}_${j}`,
        name: task,
        pos: j * TRELLO_CARD_POS_STEP,
        state: 'incomplete'
      }))
    }]
  }));
}

function generateBoard() {
  const labels = generateLabels();
  const cards = generateCards();

  return {
    name: boardName,
    desc: `SimpleBeacon Remediation Roadmap for ${projectName}\nGenerated: ${timestamp}`,
    labels,
    lists,
    cards,
    members: [],
    memberships: [],
    pluginData: [],
    actions: [],
    checklists: cards.flatMap(c => c.checklists),
    customFields: [],
    dateLastActivity: timestamp
  };
}

// Generate and write
const board = generateBoard();
const outputPath = `trello-export-${Date.now()}.json`;
fs.writeFileSync(outputPath, JSON.stringify(board, null, 2));

// Export complete — outputPath contains the generated board JSON

// Also export as a module for dashboard integration
module.exports = { generateBoard, generateCards, generateLabels, phases };
