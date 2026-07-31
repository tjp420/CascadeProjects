// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Regional AI Safety Mandate Guardrails — static pattern detection for
 * emerging regulatory frameworks beyond the EU AI Act.
 *
 * Frameworks covered:
 *   1. California AI Safety Bill (SB 1047 / AB 2013)
 *   2. NIST AI Risk Management Framework (AI RMF 1.0)
 *   3. Colorado AI Act (SB 24-205)
 *   4. Utah AI Policy Act (SB 149)
 *   5. NYC Local Law 144 (Automated Employment Decision Tools)
 *   6. Canada AIDA (Artificial Intelligence and Data Act)
 *   7. UK AI Safety Framework (DSIT)
 *   8. ISO/IEC 42001 (AI Management System)
 *   9. Singapore Model AI Governance Framework
 *  10. Brazil AI Bill (PL 2338/2023)
 *  11. EU AI Act — Prohibited Practices & High-Risk Classification
 *  12. Texas Responsible AI Governance Act (HB 4045)
 *  13. Illinois AI Video Interview Act (HB 2557)
 *  14. Japan METI AI Guidelines for Business
 *  15. Australia AI Ethics Framework
 *  16. South Korea AI Basic Act
 *  17. China Generative AI Interim Measures
 *  18. India Digital Personal Data Protection Act (DPDP)
 *  19. OECD AI Principles
 *
 * Static pattern scan only — not legal advice or formal conformity assessment.
 */

const fs = require('fs');
const path = require('path');
const { globMatch, walkProductionFiles } = require('./production-leak');

const DEFAULT_SOURCE_PATHS = ['server', 'src', 'web', 'lib', 'packages', 'app', 'api', 'config', 'docs'];
const DEFAULT_PRODUCTION_PATHS = ['server/', 'src/', 'app/', 'lib/', 'api/', 'web/'];
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.vue', '.svelte',
    '.json', '.md', '.yaml', '.yml', '.toml', '.txt'
]);
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
    '.simplebeacon', 'tests', 'test', '__tests__', 'fixtures', 'examples',
    'coming-soon', 'reports', 'security-reports', 'templates', 'data-central',
    'deployments', 'public', 'functions', 'cloudflare-deploy', 'temp', 'tests-legacy',
    '.github-sync', '.cursor', '.vscode', 'downloads', 'findings',
    'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures'
]);
const MAX_SCAN_BYTES = 512000;

// ── Rule Catalog ────────────────────────────────────────────────────────────

const RULE_CATALOG = [
    // 1. California AI Safety Bill (SB 1047) — Frontier Model Safety
    {
        id: 'CA-SB1047-001',
        framework: 'California SB 1047',
        category: 'frontier-model-safety',
        type: 'CA AI Safety Bill — Critical Harm Risk',
        regex: /\b(?:frontier\s+model|critical\s+harm|catastrophic\s+harm|shutdown\s+(?:capability|protocol)|kill\s+switch|emergency\s+stop)\b/gi,
        severity: 'critical',
        description: 'Frontier AI model deployment without documented shutdown capability or critical harm assessment',
        fixTemplate: 'Implement and document a shutdown capability protocol for frontier models. Conduct a critical harm assessment before deployment. Maintain an audit trail of safety evaluations and ensure the model can be disabled remotely.'
    },
    {
        id: 'CA-SB1047-002',
        framework: 'California SB 1047',
        category: 'safety-evaluation',
        type: 'CA AI Safety Bill — Safety Evaluation Gap',
        regex: /\b(?:model\s+eval|safety\s+eval|red[-_\s]?team|adversarial\s+test|capability\s+test)\b(?![^]*\b(?:documented|logged|recorded|reported)\b)/gi,
        severity: 'high',
        description: 'AI model safety evaluation referenced without documented evidence of completion or logging',
        fixTemplate: 'Document all safety evaluations including date, evaluators, methodology, results, and remediation actions. Store evaluation records in a versioned repository with cryptographic integrity verification.'
    },

    // 2. NIST AI RMF 1.0 — Governance & Risk Management
    {
        id: 'NIST-AIRMF-001',
        framework: 'NIST AI RMF 1.0',
        category: 'ai-governance',
        type: 'NIST AI RMF — Missing Governance Documentation',
        regex: /\b(?:ai\s+governance|ai\s+risk\s+management|ai\s+rmf|nist\.ai600|ai\s+profile)\b/gi,
        severity: 'medium',
        description: 'AI governance or risk management referenced without corresponding NIST AI RMF profile documentation',
        fixTemplate: 'Create an AI RMF profile document mapping your AI systems to NIST AI RMF functions (Govern, Map, Measure, Manage). Document roles, responsibilities, and risk tolerance thresholds.'
    },
    {
        id: 'NIST-AIRMF-002',
        framework: 'NIST AI RMF 1.0',
        category: 'risk-mapping',
        type: 'NIST AI RMF — Missing Risk Mapping',
        regex: /\b(?:measure|assess|test|evaluate)\b(?![^]*(?:rmf|risk\s+map|ai\s+profile|govern))[^]*(?:model|ai|ml|llm|algorithm)/gi,
        severity: 'medium',
        description: 'AI model measurement or testing without NIST AI RMF risk mapping context',
        fixTemplate: 'Map each AI model to NIST AI RMF Measure function (MEASURE 1.1–2.12). Document characteristics, reliability, validity, robustness, and safety metrics in a structured risk register.'
    },

    // 3. Colorado AI Act (SB 24-205) — High-Risk AI Systems
    {
        id: 'CO-SB205-001',
        framework: 'Colorado SB 24-205',
        category: 'high-risk-ai',
        type: 'Colorado AI Act — High-Risk System Disclosure',
        regex: /\b(?:algorithmic\s+impact|consequential\s+decision|high[-_\s]?risk\s+(?:ai|system|algorithm)|automated\s+decision\s+(?:system|tool))\b/gi,
        severity: 'high',
        description: 'High-risk AI system detected without required Colorado AI Act impact assessment and disclosure documentation',
        fixTemplate: 'Conduct an algorithmic impact assessment documenting the system purpose, data used, potential harms, mitigation measures, and human oversight mechanisms. Provide consumer disclosure of AI usage in consequential decisions.'
    },

    // 4. Utah AI Policy Act (SB 149) — Transparency Requirements
    {
        id: 'UT-SB149-001',
        framework: 'Utah SB 149',
        category: 'ai-transparency',
        type: 'Utah AI Policy Act — Missing AI Disclosure',
        regex: /\b(?:chatbot|virtual\s+assistant|ai\s+agent|automated\s+(?:response|reply|message))\b(?![^]*\b(?:disclose|disclosure|notify|transparent|ai[-_\s]?generated)\b)/gi,
        severity: 'medium',
        description: 'AI-powered chatbot or virtual assistant without explicit AI disclosure to users',
        fixTemplate: 'Add explicit disclosure that users are interacting with an AI system. Display disclosure before or at the start of the interaction. Include contact information for human assistance alternatives.'
    },

    // 5. NYC Local Law 144 — Automated Employment Decision Tools
    {
        id: 'NYC-LL144-001',
        framework: 'NYC Local Law 144',
        category: 'employment-ai',
        type: 'NYC LL144 — Automated Employment Tool Without Bias Audit',
        regex: /\b(?:hire|candidate|applicant|resume\s+screen|job\s+match|employment\s+screen|candidate\s+(?:scor|rank|filter))\b[^]*(?:ai|ml|model|algorithm|automated)/gi,
        severity: 'high',
        description: 'Automated employment decision tool detected without documented bias audit or independent assessment',
        fixTemplate: 'Conduct an independent bias audit within 30 days of deployment. Document selection rates, impact ratios, and pass/fail rates across protected categories. Publish a summary of audit results on the employer website.'
    },

    // 6. Canada AIDA — High-Impact AI Systems
    {
        id: 'CA-AIDA-001',
        framework: 'Canada AIDA',
        category: 'high-impact-ai',
        type: 'Canada AIDA — High-Impact System Without Risk Mitigation',
        regex: /\b(?:high[-_\s]?impact\s+(?:ai|system|model)|harm\s+assessment|mitigation\s+measure|monitoring\s+obligation)\b/gi,
        severity: 'high',
        description: 'High-impact AI system identified without documented harm assessment and mitigation measures as required by AIDA',
        fixTemplate: 'Document a harm assessment identifying potential adverse outcomes. Implement mitigation measures including human oversight, monitoring protocols, and incident response procedures. Maintain records for the Minister of Innovation, Science and Economic Development.'
    },

    // 7. UK AI Safety Framework (DSIT) — Capability Assessment
    {
        id: 'UK-DSIT-001',
        framework: 'UK AI Safety Framework',
        category: 'capability-assessment',
        type: 'UK AI Safety — Missing Capability Assessment',
        regex: /\b(?:capability\s+assessment|model\s+capability|dangerous\s+capability|misuse\s+potential|dual[-_\s]?use)\b/gi,
        severity: 'medium',
        description: 'AI model with potential dangerous capabilities detected without UK DSIT capability assessment documentation',
        fixTemplate: 'Conduct a capability assessment evaluating the model for dangerous capabilities (CBRN, cyber, manipulation). Document evaluation methodology, results, and risk mitigation measures. Submit assessment to the AI Safety Institute for frontier models.'
    },

    // 8. ISO/IEC 42001 — AI Management System
    {
        id: 'ISO-42001-001',
        framework: 'ISO/IEC 42001',
        category: 'ai-management-system',
        type: 'ISO 42001 — Missing AI Management System Controls',
        regex: /\b(?:ai\s+management\s+system|aims|ai\s+policy|ai\s+lifecycle|ai\s+risk\s+(?:register|treatment|assessment))\b/gi,
        severity: 'medium',
        description: 'AI management system referenced without ISO/IEC 42001 control documentation',
        fixTemplate: 'Establish an AI management system (AIMS) aligned with ISO/IEC 42001. Document AI policy, risk register, lifecycle processes, and internal audit procedures. Define roles and responsibilities for AI governance.'
    },

    // 9. Singapore Model AI Governance Framework — Accountability
    {
        id: 'SG-MAIGF-001',
        framework: 'Singapore Model AI Governance',
        category: 'ai-accountability',
        type: 'Singapore MAIGF — Missing Accountability Structure',
        regex: /\b(?:accountability|responsibility\s+matrix|decision[-_\s]?making\s+authority|internal\s+review\s+board|ai\s+ethics\s+(?:board|committee|council))\b/gi,
        severity: 'medium',
        description: 'AI system deployed without documented accountability structure or internal review board as recommended by Singapore MAIGF',
        fixTemplate: 'Establish a clear accountability structure with named individuals responsible for AI system outcomes. Create an internal review board or AI ethics committee. Document decision-making authority and escalation procedures.'
    },

    // 10. Brazil AI Bill (PL 2338/2023) — Rights Protection
    {
        id: 'BR-PL2338-001',
        framework: 'Brazil PL 2338/2023',
        category: 'rights-protection',
        type: 'Brazil AI Bill — Missing Rights Impact Assessment',
        regex: /\b(?:rights\s+impact|affected\s+(?:individuals|persons|subjects)|right\s+to\s+(?:explanation|information|human\s+intervention)|contest(?:ation)?\s+right)\b/gi,
        severity: 'high',
        description: 'AI system affecting individual rights without documented rights impact assessment or contestation mechanism',
        fixTemplate: 'Conduct a rights impact assessment identifying affected individuals and potential rights violations. Implement a contestation mechanism allowing affected persons to challenge AI decisions. Provide a right to explanation and human intervention.'
    },

    // 11. EU AI Act — Prohibited Practices (Article 5)
    {
        id: 'EU-AIA-001',
        framework: 'EU AI Act',
        category: 'prohibited-practice',
        type: 'EU AI Act — Prohibited AI Practice Detected',
        regex: /\b(?:social\s+scoring|real[-_\s]?time\s+(?:biometric|facial)\s+(?:identification|id|categoriz)|subliminal\s+manipulation|exploit\s+vulnerab|predictive\s+policing|emotion\s+recognition\s+in\s+workplace)\b/gi,
        severity: 'critical',
        description: 'AI system exhibits patterns matching EU AI Act Article 5 prohibited practices (social scoring, real-time biometric identification, subliminal manipulation)',
        fixTemplate: 'Immediately halt deployment of the identified AI practice. EU AI Act Article 5 prohibits social scoring, real-time remote biometric identification in public spaces, subliminal manipulation, and exploitation of vulnerabilities. Document the removal and conduct a conformity assessment for remaining systems.'
    },

    // 12. EU AI Act — High-Risk Classification (Article 6 + Annex III)
    {
        id: 'EU-AIA-002',
        framework: 'EU AI Act',
        category: 'high-risk-classification',
        type: 'EU AI Act — High-Risk System Without Conformity Assessment',
        regex: /\b(?:essential\s+(?:public|private)\s+service|law\s+enforcement|migration\s+control|asylum\s+(?:processing|screening)|biometric\s+categorization|education\s+(?:admission|evaluation)|credit\s+scoring|insurance\s+(?:pricing|risk\s+assess))\b[^]*(?:ai|ml|model|algorithm|automated)/gi,
        severity: 'high',
        description: 'AI system in an EU AI Act Annex III high-risk domain without documented conformity assessment or CE marking',
        fixTemplate: 'Conduct a conformity assessment per EU AI Act Article 6 and Annex III. Implement risk management, data governance, technical documentation, human oversight, and accuracy/robustness requirements. Affix CE marking and register in the EU database before deployment.'
    },

    // 13. Texas Responsible AI Governance Act (HB 4045)
    {
        id: 'TX-HB4045-001',
        framework: 'Texas HB 4045',
        category: 'ai-impact-assessment',
        type: 'Texas AI Governance — Missing Impact Assessment',
        regex: /\b(?:automated\s+decision\s+system|ai\s+impact\s+(?:assessment|statement)|algorithmic\s+fairness|biases?\s+(?:audit|review|detect)|texa?s\s+ai\s+governance)\b/gi,
        severity: 'medium',
        description: 'Automated decision system deployed without Texas HB 4045 impact assessment documenting algorithmic fairness and bias review',
        fixTemplate: 'Conduct an AI impact assessment per Texas HB 4045 requirements. Document system purpose, data sources, algorithmic fairness evaluation, bias detection results, and mitigation measures. File the assessment with the Texas Department of Information Resources.'
    },

    // 14. Illinois AI Video Interview Act (HB 2557)
    {
        id: 'IL-AIVIA-001',
        framework: 'Illinois HB 2557',
        category: 'video-interview-ai',
        type: 'Illinois AI Video Interview Act — Missing Consent or Disclosure',
        regex: /\b(?:video\s+interview|ai[-_\s]?video\s+(?:analysis|screen|eval)|facial\s+(?:expression|emotion)\s+analysis|automated\s+interview\s+(?:scor|rank|evaluat))\b/gi,
        severity: 'high',
        description: 'AI-powered video interview analysis detected without documented consent, disclosure, or human review as required by Illinois HB 2557',
        fixTemplate: 'Obtain explicit consent from candidates before AI video analysis. Provide advance disclosure that AI will analyze the interview. Share assessment results upon request. Ensure human review of AI-generated evaluations. Retain records for 30 days per Illinois HB 2557.'
    },

    // 15. Japan METI AI Guidelines for Business
    {
        id: 'JP-METI-001',
        framework: 'Japan METI AI Guidelines',
        category: 'ai-business-governance',
        type: 'Japan METI — Missing AI Business Governance',
        regex: /\b(?:human[-_\s]?centric|ai\s+principles|safety\s+(?:principle|standard)|fairness|accountability|transparency|privacy\s+protection|japanese\s+ai\s+(?:guideline|governance))\b(?![^]*\b(?:documented|polic|framework|implement)\b)/gi,
        severity: 'medium',
        description: 'AI system deployed without Japan METI AI Guidelines for Business governance documentation covering human-centric principles, safety, and accountability',
        fixTemplate: 'Align AI governance with Japan METI AI Guidelines for Business. Document human-centric principles, safety measures, fairness, accountability, transparency, and privacy protection. Establish an AI governance committee and conduct regular impact assessments.'
    },

    // 16. Australia AI Ethics Framework
    {
        id: 'AU-AIEF-001',
        framework: 'Australia AI Ethics Framework',
        category: 'ai-ethics',
        type: 'Australia AI Ethics — Missing Ethics Impact Assessment',
        regex: /\b(?:ai\s+ethics|ethical\s+(?:impact|principle|assessment)|fairness|discrimination\s+(?:detect|prevent|monitor)|inclusive\s+(?:design|access)|australian\s+ai\s+ethics)\b/gi,
        severity: 'medium',
        description: 'AI system without Australia AI Ethics Framework impact assessment covering fairness, discrimination prevention, and inclusive design',
        fixTemplate: 'Conduct an AI Ethics Impact Assessment per the Australia AI Ethics Framework. Evaluate the system against all 8 ethical principles: human/social wellbeing, human-centred values, fairness, privacy protection, reliability/safety, transparency, contestability, and accountability.'
    },

    // 17. South Korea AI Basic Act
    {
        id: 'KR-AIBA-001',
        framework: 'South Korea AI Basic Act',
        category: 'ai-transparency-kr',
        type: 'Korea AI Basic Act — Missing Transparency or Impact Assessment',
        regex: /\b(?:high[-_\s]?impact\s+ai|ai\s+transparency|korean\s+ai\s+(?:act|law|regulation)|ai\s+committee|personal\s+information\s+protection|k[-_\s]?personal\s+data)\b/gi,
        severity: 'high',
        description: 'High-impact AI system without South Korea AI Basic Act transparency notice, impact assessment, or personal information protection measures',
        fixTemplate: 'Comply with South Korea AI Basic Act requirements: submit an AI impact assessment for high-impact systems, provide transparency notices to users, implement personal information protection measures, and report to the AI Committee. Designate an AI compliance officer.'
    },

    // 18. China Generative AI Interim Measures
    {
        id: 'CN-GENAI-001',
        framework: 'China GenAI Measures',
        category: 'generative-ai-cn',
        type: 'China GenAI — Missing Content Labeling or Security Assessment',
        regex: /\b(?:generative\s+ai|gen[-_\s]?ai|text\s+generation|image\s+generation|synthetic\s+(?:media|content|data)|deepfake|chinese\s+ai\s+(?:regulation|measure|law))\b/gi,
        severity: 'high',
        description: 'Generative AI system without China Interim Measures for Generative AI content labeling, security assessment, or training data documentation',
        fixTemplate: 'Comply with China Generative AI Interim Measures: conduct a security assessment before public release, label AI-generated content, document training data sources and legality, implement content filtering for prohibited content, and register with the Cyberspace Administration of China (CAC).'
    },

    // 19. India Digital Personal Data Protection Act (DPDP)
    {
        id: 'IN-DPDP-001',
        framework: 'India DPDP Act',
        category: 'data-protection-in',
        type: 'India DPDP — Missing Data Protection Impact Assessment',
        regex: /\b(?:personal\s+data|data\s+fiduciary|data\s+principal|consent\s+management|data\s+protection\s+(?:impact|assessment)|indian\s+(?:data|dpdp))\b/gi,
        severity: 'medium',
        description: 'AI system processing personal data without India DPDP Act consent management, data fiduciary obligations, or data protection impact assessment',
        fixTemplate: 'Implement India DPDP Act compliance: obtain explicit consent from data principals, register as a data fiduciary if processing significant volumes, conduct a Data Protection Impact Assessment, implement breach notification procedures, and appoint a Data Protection Officer.'
    },

    // 20. OECD AI Principles
    {
        id: 'OECD-AIP-001',
        framework: 'OECD AI Principles',
        category: 'oecd-principles',
        type: 'OECD AI Principles — Missing Well-being or Accountability Documentation',
        regex: /\b(?:human\s+well[-_\s]?being|sustainable|inclusive\s+growth|ai\s+(?:principle|value|standard)|oecd\s+ai|trustworthy\s+ai|responsible\s+ai)\b/gi,
        severity: 'low',
        description: 'AI system deployed without OECD AI Principles alignment documentation covering human well-being, sustainability, and trustworthy AI',
        fixTemplate: 'Document alignment with OECD AI Principles: invest in AI research for inclusive growth and well-being, foster human-centred AI values, ensure transparency and explainability, implement robustness and safety measures, and establish accountability mechanisms. Reference the OECD AI Policy Observatory.'
    },
];

// ── Documentation Markers ───────────────────────────────────────────────────

const DOCUMENTATION_MARKERS = [
    { id: 'ca-sb1047-safety-eval', pattern: /safety\s+evaluation|critical\s+harm\s+assessment|shutdown\s+protocol/i, label: 'CA SB 1047 Safety Evaluation' },
    { id: 'nist-airmf-profile', pattern: /ai\s+rmf\s+profile|nist\s+ai\s+rmf|risk\s+management\s+framework/i, label: 'NIST AI RMF Profile' },
    { id: 'co-sb205-impact', pattern: /algorithmic\s+impact\s+assessment|colorado\s+ai\s+act/i, label: 'Colorado AI Act Impact Assessment' },
    { id: 'ut-sb149-disclosure', pattern: /ai\s+disclosure|utah\s+ai\s+policy|ai\s+transparency\s+notice/i, label: 'Utah AI Disclosure' },
    { id: 'nyc-ll144-bias-audit', pattern: /bias\s+audit|local\s+law\s+144|employment\s+decision\s+tool/i, label: 'NYC LL144 Bias Audit' },
    { id: 'ca-aida-harm-assessment', pattern: /aida|harm\s+assessment|high[-_\s]?impact\s+ai/i, label: 'Canada AIDA Harm Assessment' },
    { id: 'uk-dsit-capability', pattern: /capability\s+assessment|uk\s+ai\s+safety|dsit/i, label: 'UK DSIT Capability Assessment' },
    { id: 'iso-42001-aims', pattern: /iso\s*\/?\s*iec\s*42001|ai\s+management\s+system|aims/i, label: 'ISO/IEC 42001 AIMS' },
    { id: 'sg-maigf-governance', pattern: /singapore\s+ai\s+governance|maigf|model\s+ai\s+governance/i, label: 'Singapore MAIGF Governance' },
    { id: 'br-pl2338-rights', pattern: /pl\s*2338|brazil\s+ai\s+bill|rights\s+impact\s+assessment/i, label: 'Brazil AI Bill Rights Assessment' },
    { id: 'eu-aia-prohibited', pattern: /eu\s+ai\s+act|article\s+5|prohibited\s+practice|social\s+scoring\s+ban/i, label: 'EU AI Act Prohibited Practices' },
    { id: 'eu-aia-high-risk', pattern: /annex\s+iii|conformity\s+assessment|ce\s+marking|high[-_\s]?risk\s+classification/i, label: 'EU AI Act High-Risk Classification' },
    { id: 'tx-hb4045-impact', pattern: /texas\s+ai\s+governance|hb\s*4045|algorithmic\s+fairness\s+assessment/i, label: 'Texas HB 4045 Impact Assessment' },
    { id: 'il-aivia-consent', pattern: /illinois\s+ai\s+video|hb\s*2557|video\s+interview\s+consent/i, label: 'Illinois AI Video Interview Consent' },
    { id: 'jp-meti-governance', pattern: /japan\s+ai\s+guideline|meti\s+ai|human[-_\s]?centric\s+ai/i, label: 'Japan METI AI Governance' },
    { id: 'au-aief-ethics', pattern: /australia\s+ai\s+ethics|ai\s+ethics\s+impact|inclusive\s+design\s+ai/i, label: 'Australia AI Ethics Assessment' },
    { id: 'kr-aiba-transparency', pattern: /korea\s+ai\s+basic\s+act|ai\s+committee|korean\s+ai\s+transparency/i, label: 'Korea AI Basic Act Transparency' },
    { id: 'cn-genai-measures', pattern: /china\s+generative\s+ai|cac\s+registration|synthetic\s+content\s+labeling/i, label: 'China GenAI Interim Measures' },
    { id: 'in-dpdp-assessment', pattern: /india\s+dpdp|data\s+fiduciary|data\s+protection\s+impact\s+assessment/i, label: 'India DPDP Data Protection' },
    { id: 'oecd-aip-principles', pattern: /oecd\s+ai\s+principles|trustworthy\s+ai|oecd\s+ai\s+policy\s+observatory/i, label: 'OECD AI Principles' },
];

const DOCUMENTATION_FILE_NAMES = [
    'ca-sb1047-safety-evaluation.md',
    'nist-airmf-profile.md',
    'colorado-ai-act-impact-assessment.md',
    'utah-ai-disclosure.md',
    'nyc-ll144-bias-audit.md',
    'canada-aida-harm-assessment.md',
    'uk-dsit-capability-assessment.md',
    'iso-42001-aims.md',
    'singapore-maigf-governance.md',
    'brazil-ai-bill-rights-assessment.md',
    'eu-aia-prohibited-practices.md',
    'eu-aia-high-risk-classification.md',
    'texas-hb4045-impact-assessment.md',
    'illinois-aivia-consent-disclosure.md',
    'japan-meti-ai-governance.md',
    'australia-ai-ethics-assessment.md',
    'korea-aiba-transparency.md',
    'china-genai-interim-measures.md',
    'india-dpdp-data-protection.md',
    'oecd-ai-principles.md',
];

// ── Scan Helpers ────────────────────────────────────────────────────────────

function isExcludedPath(relativePath) {
    const parts = relativePath.split(/[\\/]/);
    return parts.some((p) => SKIP_DIRS.has(p));
}

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).replace(/\\/g, '/');
}

function scanCatalogPatterns(relativePath, content, catalog, severityDefault) {
    const issues = [];
    const lines = content.split(/\r?\n/);

    for (const rule of catalog) {
        const seen = new Set();
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > 10000) continue;
            const match = rule.regex.exec(lines[i]);
            if (match && !seen.has(i)) {
                seen.add(i);
                issues.push({
                    id: rule.id,
                    severity: rule.severity || severityDefault || 'medium',
                    type: rule.type,
                    filePath: relativePath,
                    lineNumber: i + 1,
                    count: 1,
                    description: rule.description,
                    recommendedAction: rule.fixTemplate,
                    evidence: lines[i].trim().substring(0, 200),
                    affectedFiles: [relativePath],
                    metadata: {
                        patternId: rule.id,
                        framework: rule.framework,
                        category: rule.category,
                    },
                });
            }
            // Reset regex lastIndex for global flag
            if (rule.regex.global) rule.regex.lastIndex = 0;
        }
    }

    return issues;
}

function collapsePatternIssuesByFile(issues, relativePath) {
    const byRule = new Map();
    for (const issue of issues) {
        const key = issue.id;
        if (!byRule.has(key)) {
            byRule.set(key, { ...issue, count: 1, affectedFiles: [relativePath] });
        } else {
            const existing = byRule.get(key);
            existing.count += 1;
        }
    }
    return Array.from(byRule.values());
}

function detectDocumentationArtifacts(baseDir) {
    const found = [];
    for (const fileName of DOCUMENTATION_FILE_NAMES) {
        const candidate = path.join(baseDir, 'docs', fileName);
        try {
            if (fs.existsSync(candidate)) {
                found.push({ id: fileName.replace(/\.md$/, ''), path: candidate, label: fileName });
            }
        } catch {
            // ignore
        }
    }
    return found;
}

// ── Main Scan Function ──────────────────────────────────────────────────────

async function scanRegionalAiSafetyPatterns(baseDir, options = {}) {
    const {
        sourcePaths = DEFAULT_SOURCE_PATHS,
        ignoreGlobs = [],
        severityDefault = 'medium',
    } = options;

    const files = await walkProductionFiles(baseDir, sourcePaths, SCANNABLE_EXTENSIONS);

    const uniqueFiles = [];
    const seen = new Set();
    for (const file of files) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        uniqueFiles.push(file);
    }

    const issues = [];
    let scanned = 0;
    const frameworkHits = {};
    const categoryHits = {};

    for (const file of uniqueFiles) {
        const relativePath = normalizeRel(baseDir, file.path);
        if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
        if (isExcludedPath(relativePath)) continue;

        let content;
        try {
            const stat = await fs.promises.stat(file.path);
            if (stat.size > MAX_SCAN_BYTES) continue;
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        if (/simplebeacon-ignore/i.test(content.substring(0, 500))) continue;

        scanned += 1;
        const ruleIssues = scanCatalogPatterns(relativePath, content, RULE_CATALOG, severityDefault);
        for (const issue of ruleIssues) {
            const fw = issue.metadata?.framework || 'unknown';
            const cat = issue.metadata?.category || 'unknown';
            frameworkHits[fw] = (frameworkHits[fw] || 0) + 1;
            categoryHits[cat] = (categoryHits[cat] || 0) + 1;
        }
        issues.push(...collapsePatternIssuesByFile(ruleIssues, relativePath));
    }

    // Check for missing documentation artifacts
    const docsFound = detectDocumentationArtifacts(baseDir);
    const docsFoundIds = new Set(docsFound.map((d) => d.id));
    for (const marker of DOCUMENTATION_MARKERS) {
        if (!docsFoundIds.has(marker.id)) {
            issues.push({
                id: `${marker.id}-missing`,
                severity: 'low',
                type: 'Regional AI Safety — Missing Documentation',
                filePath: '(repository-root)',
                lineNumber: undefined,
                count: 1,
                description: `Missing documentation artifact: ${marker.label}`,
                recommendedAction: `Create a documentation file covering ${marker.label} requirements. Place it in the docs/ directory.`,
                evidence: `No documentation file found for ${marker.id}`,
                affectedFiles: [],
                metadata: {
                    patternId: `${marker.id}-missing`,
                    category: 'documentation-gap',
                },
            });
        }
    }

    const summary = {
        frameworksCovered: [
            'California SB 1047',
            'NIST AI RMF 1.0',
            'Colorado SB 24-205',
            'Utah SB 149',
            'NYC Local Law 144',
            'Canada AIDA',
            'UK AI Safety Framework',
            'ISO/IEC 42001',
            'Singapore MAIGF',
            'Brazil PL 2338/2023',
            'EU AI Act',
            'Texas HB 4045',
            'Illinois HB 2557',
            'Japan METI AI Guidelines',
            'Australia AI Ethics Framework',
            'South Korea AI Basic Act',
            'China GenAI Measures',
            'India DPDP Act',
            'OECD AI Principles',
        ],
        frameworksDetected: Object.keys(frameworkHits),
        frameworkHits,
        categoryHits,
        totalRules: RULE_CATALOG.length,
        documentationArtifactsFound: docsFound.length,
        documentationArtifactsExpected: DOCUMENTATION_FILE_NAMES.length,
    };

    return {
        scanned,
        findings: issues.length,
        issues,
        summary,
        patterns: RULE_CATALOG.map((r) => r.id),
    };
}

module.exports = {
    RULE_CATALOG,
    DOCUMENTATION_MARKERS,
    DOCUMENTATION_FILE_NAMES,
    scanRegionalAiSafetyPatterns,
    detectDocumentationArtifacts,
    DEFAULT_SOURCE_PATHS,
    DEFAULT_PRODUCTION_PATHS,
};
