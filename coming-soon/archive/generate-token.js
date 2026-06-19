const jwt = require('jsonwebtoken');
const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || (() => { throw new Error('Set SIMPLEBEACON_LICENSE_SECRET env var'); })();

const tier = process.argv[2] || 'instant';
const tierConfig = {
    instant: { projectName: 'Instant Code Hygiene Report', label: 'Instant Code Hygiene Report Token' },
    executive: { projectName: 'Executive Risk Certificate', label: 'Executive Risk Certificate Token' },
    euai: { projectName: 'EU AI Act Sprint', label: 'EU AI Act Sprint Token' },
    universal: { projectName: 'Universal Shield', label: 'Universal Shield Token' },
    'ai-slop-cop-pro': { projectName: 'AI Slop Cop Pro', label: 'AI Slop Cop Pro Token', features: ['gate','llm-slop','codebase','reduction','data-quality','debug','mock','optimization'] },
    custom: { projectName: 'Custom Plan', label: 'Custom Plan Token', features: ['gate','consolidation','mock','roadmap','codebase','reduction','data-quality','debug','npm','compliance','euai','build'] },
    starter: { projectName: 'Starter Free', label: 'Starter Free Token', features: ['gate','llm-slop'], limits: { maxFilesPerScan: 50, maxFindingsShown: 5, showQualityScore: false } },
    pro: { projectName: 'Continuous Shield', label: 'Simplebeacon Pro Token', features: ['gate','consolidation','mock-data','roadmap','codebase','file-reduction','data-quality','cleanup','npm-audit','compliance','eu-ai-act','dependency-vulns','build-readiness','ai-indicators','governance','junk-files','ai-residue','performance','type-safety','documentation','test-coverage','accessibility','i18n','sensitive-data','config-drift','security-headers','database-patterns','framework-practices','workspace-health','unused-deps','api-contract','complexity','fix-preview','llm-slop','token-bleed','production-leak','fiction-kpi','architecture-drift'], limits: { maxFilesPerScan: null, maxFindingsShown: null, showQualityScore: true } },
    enterprise: { projectName: 'Compliance Suite', label: 'Compliance Suite Token', features: ['gate','consolidation','mock-data','roadmap','codebase','file-reduction','data-quality','cleanup','npm-audit','compliance','eu-ai-act','dependency-vulns','build-readiness','ai-indicators','governance','junk-files','ai-residue','performance','type-safety','documentation','test-coverage','accessibility','i18n','sensitive-data','config-drift','security-headers','database-patterns','framework-practices','workspace-health','unused-deps','api-contract','complexity','fix-preview','llm-slop','token-bleed','production-leak','fiction-kpi','architecture-drift','sync-io','eval-danger','inner-html-xss','prototype-pollution','unhandled-promise','magic-number','missing-strict-mode','uninitialized-read','unvalidated-redirect','missing-rate-limit','insecure-random','logging-secrets','hardcoded-confidence','hardcoded-completion','mock-path-leak','sample-json-ref','governance-marker','ai-placeholder-comment','ai-placeholder-block','markdown-fence-leak','empty-stub-function','arrow-stub','roadmap-marker'], limits: { maxFilesPerScan: null, maxFindingsShown: null, showQualityScore: true } }
};

const cfg = tierConfig[tier] || tierConfig.instant;
const payload = {
    email: 'user@simplebeacon.ai',
    tier: tier,
    features: cfg.features || [],
    limits: cfg.limits || null,
    clientName: 'User',
    projectName: cfg.projectName
};
const token = jwt.sign(payload, secret, { expiresIn: 7 * 24 * 60 * 60 });

console.log(cfg.label + ':');
console.log(token);

const fs = require('fs');
const path = require('path');
const outFile = path.join(__dirname, tier + '-token.txt');
fs.writeFileSync(outFile, token + '\n', 'utf8');
console.log('\nSaved to:', outFile);
