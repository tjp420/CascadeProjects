#!/usr/bin/env node
'use strict';

/**
 * Enterprise Prospect Scraper — Builds target lists of Chief Legal Officers,
 * Chief Compliance Officers, and Chief Risk Officers from public data sources.
 *
 * Data sources (all public, rate-limited, respectful):
 *   - LinkedIn search URLs (manual export or API partner)
 *   - SEC EDGAR filings (executive listings for public companies)
 *   - Company "About" / "Leadership" page scrapers
 *   - Crunchbase API (optional, requires API key)
 *   - Apollo.io export ingestion
 *
 * Output: JSON prospect list with qualification scoring.
 *
 * Usage:
 *   node prospect-scraper.js --input ./sources.csv --output ./prospects.json
 *   node prospect-scraper.js --company "Acme Corp" --domain acme.com
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Persona Definitions ─────────────────────────────────────────────────────

const PERSONAS = {
  CLO: {
    id: 'CLO',
    label: 'Chief Legal Officer / General Counsel',
    titles: [
      'Chief Legal Officer', 'General Counsel', 'VP Legal', 'Deputy General Counsel',
      'Head of Legal', 'Legal Director',
    ],
    sequence: 'A',
    painPoint: 'Personal liability exposure under EU AI Act; board reporting obligations',
    budgetAuthority: '$50K-$500K (legal compliance budget)',
  },
  CCO: {
    id: 'CCO',
    label: 'Chief Compliance Officer / Head of Regulatory Affairs',
    titles: [
      'Chief Compliance Officer', 'Head of Compliance', 'Compliance Director',
      'Head of Regulatory Affairs', 'Compliance Manager', 'Regulatory Affairs Director',
    ],
    sequence: 'B',
    painPoint: 'Manual evidence collection across engineering teams; no automated audit trail',
    budgetAuthority: '$25K-$250K (compliance technology budget)',
  },
  CRO: {
    id: 'CRO',
    label: 'Chief Risk Officer / Head of Operational Risk',
    titles: [
      'Chief Risk Officer', 'Head of Operational Risk', 'VP Risk Management',
      'Risk Director', 'Head of Enterprise Risk', 'Operational Risk Manager',
    ],
    sequence: 'C',
    painPoint: 'AI-generated code introduces unquantified operational risk into production systems',
    budgetAuthority: '$50K-$500K (risk mitigation budget)',
  },
};

// ── Qualification Criteria ──────────────────────────────────────────────────

const QUALIFICATION_CRITERIA = {
  minDevelopers: 50,
  minRevenue: 50_000_000,
  requiredAiToolUsage: true,
  requiredRegulatoryExposure: true,
  targetSectors: [
    'fintech', 'banking', 'insurance', 'healthcare', 'pharmaceutical',
    'technology', 'telecommunications', 'energy', 'manufacturing',
    'government contractor', 'aerospace', 'automotive',
  ],
};

// ── Prospect Model ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} Prospect
 * @property {string} id - Unique prospect ID (SHA-256 of email+company)
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} email
 * @property {string} title
 * @property {string} persona - CLO, CCO, or CRO
 * @property {string} company
 * @property {string} domain
 * @property {string} linkedinUrl
 * @property {string} sector
 * @property {number} estimatedDevelopers
 * @property {number} estimatedRevenue
 * @property {boolean} usesAiTools
 * @property {boolean} hasRegulatoryExposure
 * @property {string} ciCdPlatform - 'azure-devops', 'github-actions', 'gitlab-ci', 'unknown'
 * @property {number} qualificationScore - 0-100
 * @property {string} status - 'new', 'qualified', 'contacted', 'replied', 'meeting', 'pilot', 'closed', 'disqualified'
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function generateProspectId(email, company) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${email}|${company}`).digest('hex').slice(0, 16);
}

function classifyPersona(title) {
  const normalized = title.toLowerCase();
  for (const [id, persona] of Object.entries(PERSONAS)) {
    if (persona.titles.some(t => normalized.includes(t.toLowerCase()))) {
      return id;
    }
  }
  return null;
}

function calculateQualificationScore(prospect) {
  let score = 0;

  if (prospect.estimatedDevelopers >= QUALIFICATION_CRITERIA.minDevelopers) score += 25;
  else if (prospect.estimatedDevelopers >= 20) score += 10;

  if (prospect.estimatedRevenue >= QUALIFICATION_CRITERIA.minRevenue) score += 25;
  else if (prospect.estimatedRevenue >= 10_000_000) score += 10;

  if (prospect.usesAiTools) score += 20;
  if (prospect.hasRegulatoryExposure) score += 15;
  if (QUALIFICATION_CRITERIA.targetSectors.includes(prospect.sector?.toLowerCase())) score += 15;

  return Math.min(100, score);
}

function isQualified(prospect) {
  return prospect.qualificationScore >= 60 &&
    prospect.estimatedDevelopers >= QUALIFICATION_CRITERIA.minDevelopers &&
    prospect.estimatedRevenue >= QUALIFICATION_CRITERIA.minRevenue;
}

// ── CSV Ingestion ───────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function ingestCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const prospects = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    const title = row.title || row.position || '';
    const persona = classifyPersona(title);
    if (!persona) continue;

    const email = row.email || '';
    const company = row.company || '';
    if (!email || !company) continue;

    const prospect = {
      id: generateProspectId(email, company),
      firstName: row.first_name || row.firstname || '',
      lastName: row.last_name || row.lastname || '',
      email,
      title,
      persona,
      company,
      domain: row.domain || row.website || '',
      linkedinUrl: row.linkedin || row.linkedin_url || '',
      sector: row.sector || row.industry || '',
      estimatedDevelopers: parseInt(row.developers || row.employees || '0', 10) || 0,
      estimatedRevenue: parseInt(row.revenue || '0', 10) || 0,
      usesAiTools: row.ai_tools === 'yes' || row.ai_tools === 'true',
      hasRegulatoryExposure: row.regulatory_exposure === 'yes' || row.regulatory_exposure === 'true',
      ciCdPlatform: row.cicd || row.ci_cd || 'unknown',
      qualificationScore: 0,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    prospect.qualificationScore = calculateQualificationScore(prospect);
    prospect.status = isQualified(prospect) ? 'qualified' : 'new';
    prospects.push(prospect);
  }

  return prospects;
}

// ── Company Enrichment (stub — plug in Apollo, Crunchbase, or Clearbit) ─────

async function enrichCompany(domain) {
  // Placeholder for company enrichment API integration
  // In production, wire up to:
  //   - Apollo.io API (company size, revenue, tech stack)
  //   - Crunchbase API (funding, sector)
  //   - Clearbit Logo API (company logo)
  //   - BuiltWith API (tech stack detection for CI/CD platform)
  return {
    domain,
    estimatedDevelopers: 0,
    estimatedRevenue: 0,
    sector: '',
    usesAiTools: false,
    hasRegulatoryExposure: false,
    ciCdPlatform: 'unknown',
    enrichedAt: new Date().toISOString(),
  };
}

// ── Output ──────────────────────────────────────────────────────────────────

function saveProspects(prospects, outputPath) {
  const output = {
    generatedAt: new Date().toISOString(),
    totalProspects: prospects.length,
    qualified: prospects.filter(p => p.status === 'qualified').length,
    byPersona: {
      CLO: prospects.filter(p => p.persona === 'CLO').length,
      CCO: prospects.filter(p => p.persona === 'CCO').length,
      CRO: prospects.filter(p => p.persona === 'CRO').length,
    },
    bySector: prospects.reduce((acc, p) => {
      const s = p.sector || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {}),
    prospects,
  };

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  return output;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.input) {
    console.log(`[prospect-scraper] Ingesting CSV: ${args.input}`);
    const prospects = ingestCsv(args.input);
    console.log(`[prospect-scraper] Parsed ${prospects.length} prospects`);
    console.log(`[prospect-scraper] Qualified: ${prospects.filter(p => p.status === 'qualified').length}`);

    const outputPath = args.output || path.join(path.dirname(args.input), 'prospects.json');
    const result = saveProspects(prospects, outputPath);
    console.log(`[prospect-scraper] Saved to ${outputPath}`);
    console.log(`[prospect-scraper] By persona: CLO=${result.byPersona.CLO}, CCO=${result.byPersona.CCO}, CRO=${result.byPersona.CRO}`);
    return;
  }

  if (args.company && args.domain) {
    console.log(`[prospect-scraper] Enriching company: ${args.company} (${args.domain})`);
    const enriched = await enrichCompany(args.domain);
    console.log(JSON.stringify(enriched, null, 2));
    return;
  }

  console.log(`
Usage:
  node prospect-scraper.js --input <csv-file> [--output <json-file>]
  node prospect-scraper.js --company "Acme Corp" --domain acme.com

CSV columns expected:
  first_name, last_name, email, title, company, domain, sector,
  developers, revenue, ai_tools, regulatory_exposure, cicd, linkedin

Supported persona titles:
  CLO: ${PERSONAS.CLO.titles.join(', ')}
  CCO: ${PERSONAS.CCO.titles.join(', ')}
  CRO: ${PERSONAS.CRO.titles.join(', ')}
`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[prospect-scraper] Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  PERSONAS,
  QUALIFICATION_CRITERIA,
  classifyPersona,
  calculateQualificationScore,
  isQualified,
  ingestCsv,
  enrichCompany,
  saveProspects,
  generateProspectId,
};
