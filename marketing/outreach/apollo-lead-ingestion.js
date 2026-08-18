#!/usr/bin/env node
'use strict';

/**
 * Apollo Lead Ingestion — Queries Apollo.io REST API v2 for enterprise
 * compliance, legal, and risk targets (CLO / CCO / CRO) and feeds them
 * into the existing prospect-scraper.js + outreach-pipeline.js pipeline.
 *
 * Data flow:
 *   1. POST /organizations/search  — find companies by keywords/size/revenue
 *   2. POST /people/search         — find people by title at each company
 *   3. GET  /people/{id}           — enrich person details (email, linkedin)
 *   4. Map Apollo records → Prospect schema (prospect-scraper.js)
 *   5. Score + classify using prospect-scraper.js helpers
 *   6. Write marketing/outreach/prospects.json via saveProspects()
 *
 * Usage:
 *   node apollo-lead-ingestion.js --keywords="AI,compliance" --max-companies=50
 *   node apollo-lead-ingestion.js --keywords="fintech,regulatory" --max-companies=100 --max-people-per-company=5
 *   APOLLO_API_KEY=YOUR_APOLLO_KEY node apollo-lead-ingestion.js --keywords="compliance" --dry-run
 *
 * Env vars:
 *   APOLLO_API_KEY   (required) — Apollo.io API key
 *   APOLLO_API_BASE  (optional, default: https://api.apollo.io/v2)
 */

const path = require('path');
const https = require('https');

const {
  classifyPersona,
  calculateQualificationScore,
  isQualified,
  generateProspectId,
  saveProspects,
} = require('./prospect-scraper');

// ── Configuration ───────────────────────────────────────────────────────────

const APOLLO_API_BASE = process.env.APOLLO_API_BASE || 'https://api.apollo.io/v2';
const DEFAULT_MAX_COMPANIES = 50;
const DEFAULT_MAX_PEOPLE_PER_COMPANY = 5;
const DEFAULT_PAGE_SIZE = 25;
const RATE_LIMIT_REQUESTS_PER_MINUTE = 100;
const RATE_LIMIT_INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_REQUESTS_PER_MINUTE);

// Title patterns used when searching Apollo for people. These align with the
// persona definitions in prospect-scraper.js but are broadened to catch
// Apollo's free-text title variations.
const TARGET_TITLES = [
  // CLO
  'Chief Legal Officer', 'General Counsel', 'VP Legal', 'Deputy General Counsel',
  'Head of Legal', 'Legal Director',
  // CCO
  'Chief Compliance Officer', 'Head of Compliance', 'Compliance Director',
  'Head of Regulatory Affairs', 'Compliance Manager', 'VP Compliance',
  'Regulatory Affairs Director',
  // CRO
  'Chief Risk Officer', 'Head of Operational Risk', 'VP Risk Management',
  'Risk Director', 'Head of Enterprise Risk', 'Head of Risk',
  'Operational Risk Manager',
];

// Sectors that indicate regulatory exposure — used to set hasRegulatoryExposure.
const REGULATED_SECTORS = [
  'fintech', 'banking', 'insurance', 'healthcare', 'pharmaceutical',
  'financial services', 'energy', 'telecommunications', 'aerospace',
  'government contractor', 'automotive',
];

// ── Rate Limiter ────────────────────────────────────────────────────────────

let lastRequestTimestamp = 0;

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enforce a minimum interval between Apollo API requests so we stay under
 * the 100 requests/minute ceiling. Call before every outbound request.
 * @returns {Promise<void>}
 */
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (lastRequestTimestamp > 0 && elapsed < RATE_LIMIT_INTERVAL_MS) {
    await sleep(RATE_LIMIT_INTERVAL_MS - elapsed);
  }
  lastRequestTimestamp = Date.now();
}

// ── HTTP helpers (Node built-in https only) ─────────────────────────────────

/**
 * Build Apollo request headers including the API key.
 * @returns {{ 'Content-Type': string, 'X-Api-Key': string, 'Cache-Control': string }}
 */
function apolloHeaders() {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'APOLLO_API_KEY environment variable is required. ' +
      'Set it via `export APOLLO_API_KEY=YOUR_APOLLO_KEY` (Unix) or `set APOLLO_API_KEY=YOUR_APOLLO_KEY` (Windows).'
    );
  }
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Api-Key': apiKey,
  };
}

/**
 * Low-level Apollo API request wrapper. Handles JSON serialization,
 * rate limiting, HTTP error codes, and response buffering.
 *
 * @param {string} method - HTTP method ('GET' or 'POST').
 * @param {string} endpoint - Path relative to APOLLO_API_BASE (e.g. '/people/search').
 * @param {Object} [body] - Request body for POST requests (serialized as JSON).
 * @param {Object} [query] - Query string params for GET requests.
 * @returns {Promise<Object>} Parsed JSON response.
 */
async function apolloRequest(method, endpoint, body, query) {
  await rateLimit();

  const url = new URL(APOLLO_API_BASE + endpoint);
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const payload = body ? JSON.stringify(body) : null;
  const headers = apolloHeaders();
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const snippet = data.slice(0, 500);
          reject(new Error(
            `Apollo API ${method} ${endpoint} returned ${res.statusCode}: ${snippet}`
          ));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Apollo API ${endpoint} returned non-JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Apollo API request failed: ${err.message}`)));

    if (payload) req.write(payload);
    req.end();
  });
}

// ── Apollo API functions ────────────────────────────────────────────────────

/**
 * Search Apollo for organizations matching the given keywords and filters.
 * Handles cursor-based pagination and returns a flattened array of orgs.
 *
 * @param {string[]} keywords - Search keywords (e.g. ['AI', 'compliance']).
 * @param {Object} [options] - Search options.
 * @param {number} [options.maxResults=50] - Maximum orgs to return.
 * @param {number} [options.pageSize=25] - Results per page.
 * @param {string[]} [options.revenueMin] - Minimum revenue range buckets (Apollo-specific).
 * @param {string[]} [options.employeeMin] - Minimum employee range buckets.
 * @returns {Promise<Object[]>} Array of Apollo organization objects.
 */
async function searchOrganizations(keywords, options = {}) {
  const maxResults = options.maxResults || DEFAULT_MAX_COMPANIES;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const orgs = [];
  let cursor = null;
  const keywordStr = Array.isArray(keywords) ? keywords.join(' ') : String(keywords);

  while (orgs.length < maxResults) {
    const body = {
      q_organization_keyword_list: keywordStr.split(/\s*,\s*|\s+/).filter(Boolean),
      per_page: Math.min(pageSize, maxResults - orgs.length),
    };
    if (options.revenueMin) body.revenue_range_min = options.revenueMin;
    if (options.employeeMin) body.employee_range_min = options.employeeMin;
    if (cursor) body.page = cursor;

    let response;
    try {
      response = await apolloRequest('POST', '/organizations/search', body);
    } catch (err) {
      console.warn(`[apollo] organizations/search failed: ${err.message}`);
      break;
    }

    const pageOrgs = response.organizations || [];
    if (pageOrgs.length === 0) break;

    for (const org of pageOrgs) {
      orgs.push(org);
      if (orgs.length >= maxResults) break;
    }

    // Apollo cursor pagination — stop when no more pages.
    cursor = response.pagination && response.pagination.next_cursor
      ? response.pagination.next_cursor
      : null;
    if (!cursor || pageOrgs.length < pageSize) break;
  }

  console.log(`[apollo] Found ${orgs.length} organization(s) for keywords: ${keywordStr}`);
  return orgs;
}

/**
 * Search Apollo for people at a given organization matching target titles.
 * Handles cursor-based pagination and respects maxPeoplePerCompany.
 *
 * @param {string} orgId - Apollo organization ID.
 * @param {string[]} [titles] - Title patterns to search for. Defaults to TARGET_TITLES.
 * @param {Object} [options] - Search options.
 * @param {number} [options.maxPeople=5] - Maximum people to return per company.
 * @param {number} [options.pageSize=25] - Results per page.
 * @returns {Promise<Object[]>} Array of Apollo person objects.
 */
async function searchPeople(orgId, titles, options = {}) {
  const titleList = titles && titles.length ? titles : TARGET_TITLES;
  const maxPeople = options.maxPeople || DEFAULT_MAX_PEOPLE_PER_COMPANY;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const people = [];
  let cursor = null;

  while (people.length < maxPeople) {
    const body = {
      organization_ids: [orgId],
      person_titles: titleList,
      per_page: Math.min(pageSize, maxPeople - people.length),
    };
    if (cursor) body.page = cursor;

    let response;
    try {
      response = await apolloRequest('POST', '/people/search', body);
    } catch (err) {
      console.warn(`[apollo] people/search failed for org ${orgId}: ${err.message}`);
      break;
    }

    const pagePeople = response.people || [];
    if (pagePeople.length === 0) break;

    for (const person of pagePeople) {
      people.push(person);
      if (people.length >= maxPeople) break;
    }

    cursor = response.pagination && response.pagination.next_cursor
      ? response.pagination.next_cursor
      : null;
    if (!cursor || pagePeople.length < pageSize) break;
  }

  return people;
}

/**
 * Enrich a person record via Apollo's GET /people/{id} endpoint. Returns the
 * full person object with email, LinkedIn URL, and other details.
 *
 * @param {string} personId - Apollo person ID.
 * @returns {Promise<Object|null>} Enriched person object, or null on failure.
 */
async function enrichPerson(personId) {
  try {
    const response = await apolloRequest('GET', `/people/${personId}`, null, { id: personId });
    // Apollo returns the person under different keys depending on version.
    return response.person || response.people || response;
  } catch (err) {
    console.warn(`[apollo] enrichPerson failed for ${personId}: ${err.message}`);
    return null;
  }
}

// ── Mapping: Apollo record → Prospect schema ────────────────────────────────

/**
 * Parse an Apollo revenue string (e.g. "$100M-$500M") into a numeric estimate.
 * Returns the lower bound; falls back to 0 if unparseable.
 * @param {string} revenueStr - Apollo revenue range string.
 * @returns {number}
 */
function parseRevenue(revenueStr) {
  if (!revenueStr || typeof revenueStr !== 'string') return 0;
  const match = revenueStr.match(/\$?([\d.]+)\s*([MK]?)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'M') return Math.round(value * 1_000_000);
  if (unit === 'K') return Math.round(value * 1_000);
  return Math.round(value);
}

/**
 * Estimate the number of developers at a company from Apollo employee count.
 * Uses a conservative 20% heuristic — not all employees are engineers.
 * @param {number} employeeCount - Total employees from Apollo.
 * @returns {number}
 */
function estimateDevelopers(employeeCount) {
  if (!employeeCount || employeeCount <= 0) return 0;
  return Math.round(employeeCount * 0.2);
}

/**
 * Infer CI/CD platform from Apollo tech stack keywords. Falls back to 'unknown'.
 * @param {string[]} [techStack] - Array of technology names from Apollo.
 * @returns {'azure-devops'|'github-actions'|'gitlab-ci'|'unknown'}
 */
function inferCiCdPlatform(techStack) {
  if (!Array.isArray(techStack) || techStack.length === 0) return 'unknown';
  const stack = techStack.map(t => (t || '').toLowerCase());
  if (stack.some(t => t.includes('azure devops') || t.includes('azure-devops'))) return 'azure-devops';
  if (stack.some(t => t.includes('github actions') || t.includes('github-actions'))) return 'github-actions';
  if (stack.some(t => t.includes('gitlab') && t.includes('ci'))) return 'gitlab-ci';
  return 'unknown';
}

/**
 * Determine whether a company uses AI tools based on Apollo tech stack signals.
 * @param {string[]} [techStack] - Array of technology names from Apollo.
 * @param {string[]} [keywords] - Search keywords that may indicate AI usage.
 * @returns {boolean}
 */
function detectAiToolUsage(techStack, keywords) {
  const stack = (techStack || []).map(t => (t || '').toLowerCase());
  const aiSignals = ['openai', 'gpt', 'copilot', 'anthropic', 'hugging face', 'huggingface', 'ai', 'ml'];
  if (stack.some(t => aiSignals.some(s => t.includes(s)))) return true;
  const kw = (keywords || []).map(k => (k || '').toLowerCase());
  if (kw.some(k => k.includes('ai') || k.includes('machine learning') || k.includes('ml'))) return true;
  return false;
}

/**
 * Determine whether a company has regulatory exposure based on its sector.
 * @param {string} sector - Company sector/industry.
 * @returns {boolean}
 */
function hasRegulatoryExposureBySector(sector) {
  if (!sector) return false;
  const normalized = sector.toLowerCase();
  return REGULATED_SECTORS.some(s => normalized.includes(s));
}

/**
 * Map an Apollo person + organization pair to the Prospect schema defined in
 * prospect-scraper.js. Uses classifyPersona and calculateQualificationScore
 * from prospect-scraper.js for consistency with the rest of the pipeline.
 *
 * @param {Object} apolloPerson - Person object from Apollo /people/search or /people/{id}.
 * @param {Object} apolloOrg - Organization object from Apollo /organizations/search.
 * @returns {Object|null} Prospect object, or null if email/company missing or persona unclassified.
 */
function apolloToProspect(apolloPerson, apolloOrg) {
  if (!apolloPerson || !apolloOrg) return null;

  const email = apolloPerson.email || '';
  const company = apolloOrg.name || '';
  if (!email || !company) return null;

  const title = apolloPerson.title || apolloPerson.headline || '';
  const persona = classifyPersona(title);
  if (!persona) return null;

  const sector = apolloOrg.industry || apolloOrg.sector || '';
  const employeeCount = apolloOrg.employees_count || apolloOrg.employee_count || 0;
  const revenueStr = apolloOrg.revenue_range || apolloOrg.estimated_revenue || '';
  const techStack = apolloOrg.tech_stack || apolloOrg.technologies || [];

  const now = new Date().toISOString();
  const prospect = {
    id: generateProspectId(email, company),
    firstName: apolloPerson.first_name || '',
    lastName: apolloPerson.last_name || '',
    email,
    title,
    persona,
    company,
    domain: apolloOrg.website_url || apolloOrg.domain || '',
    linkedinUrl: apolloPerson.linkedin_url || '',
    sector,
    estimatedDevelopers: estimateDevelopers(employeeCount),
    estimatedRevenue: parseRevenue(revenueStr),
    usesAiTools: detectAiToolUsage(techStack),
    hasRegulatoryExposure: hasRegulatoryExposureBySector(sector),
    ciCdPlatform: inferCiCdPlatform(techStack),
    qualificationScore: 0,
    status: 'new',
    createdAt: now,
    updatedAt: now,
  };

  prospect.qualificationScore = calculateQualificationScore(prospect);
  prospect.status = isQualified(prospect) ? 'qualified' : 'new';
  return prospect;
}

// ── Main Orchestration ──────────────────────────────────────────────────────

/**
 * Main orchestration: search Apollo for organizations → search people at each
 * org → enrich person records → convert to Prospect schema → save prospects.json.
 *
 * @param {Object} options - Ingestion options.
 * @param {string[]} options.keywords - Search keywords for organizations.
 * @param {number} [options.maxCompanies=50] - Max organizations to process.
 * @param {number} [options.maxPeoplePerCompany=5] - Max people per org.
 * @param {boolean} [options.dryRun=false] - If true, do not write prospects.json.
 * @param {string} [options.outputPath] - Override output path for prospects.json.
 * @returns {Promise<Object[]>} Array of converted Prospect objects.
 */
async function ingestFromApollo(options = {}) {
  const keywords = options.keywords || [];
  if (!keywords.length) {
    throw new Error('ingestFromApollo: options.keywords is required and must be a non-empty array');
  }

  const maxCompanies = options.maxCompanies || DEFAULT_MAX_COMPANIES;
  const maxPeoplePerCompany = options.maxPeoplePerCompany || DEFAULT_MAX_PEOPLE_PER_COMPANY;
  const dryRun = options.dryRun || false;
  const outputPath = options.outputPath || path.join(__dirname, 'prospects.json');

  console.log(`[apollo] Starting ingestion — keywords: [${keywords.join(', ')}], maxCompanies: ${maxCompanies}, maxPeople: ${maxPeoplePerCompany}, dryRun: ${dryRun}`);

  // 1. Search organizations
  const orgs = await searchOrganizations(keywords, { maxResults: maxCompanies });
  if (orgs.length === 0) {
    console.warn('[apollo] No organizations found — nothing to ingest.');
    return [];
  }

  // 2. Search people at each org + 3. Enrich
  const prospects = [];
  const seenIds = new Set();

  for (const org of orgs) {
    const orgId = org.id || org._id;
    const orgName = org.name || '(unknown)';
    if (!orgId) {
      console.warn(`[apollo] Skipping org without ID: ${orgName}`);
      continue;
    }

    let people;
    try {
      people = await searchPeople(orgId, TARGET_TITLES, { maxPeople: maxPeoplePerCompany });
    } catch (err) {
      console.warn(`[apollo] Failed to search people for ${orgName} (${orgId}): ${err.message}`);
      continue;
    }

    if (people.length === 0) {
      console.log(`[apollo] No matching people at ${orgName} — skipping.`);
      continue;
    }

    console.log(`[apollo] ${orgName}: found ${people.length} candidate(s)`);

    for (const person of people) {
      const personId = person.id || person._id;
      let enriched = person;

      // Enrich if the search result lacks an email (Apollo often hides it).
      if (personId && !person.email) {
        const enrichedRecord = await enrichPerson(personId);
        if (enrichedRecord) {
          // Merge enriched fields without losing search-result fields.
          enriched = { ...person, ...enrichedRecord };
        }
      }

      const prospect = apolloToProspect(enriched, org);
      if (!prospect) {
        if (!enriched.email) {
          console.warn(`[apollo] Skipping person without email at ${orgName}: ${enriched.first_name || ''} ${enriched.last_name || ''}`);
        }
        continue;
      }

      if (seenIds.has(prospect.id)) {
        console.warn(`[apollo] Duplicate prospect skipped: ${prospect.email} @ ${prospect.company}`);
        continue;
      }
      seenIds.add(prospect.id);
      prospects.push(prospect);
      console.log(`[apollo] + ${prospect.persona} ${prospect.firstName} ${prospect.lastName} @ ${prospect.company} (score ${prospect.qualificationScore}, ${prospect.status})`);
    }
  }

  console.log(`[apollo] Collected ${prospects.length} prospect(s) from ${orgs.length} organization(s)`);
  const qualifiedCount = prospects.filter(p => p.status === 'qualified').length;
  console.log(`[apollo] Qualified: ${qualifiedCount}/${prospects.length}`);

  // 4. Save (unless dry-run)
  if (dryRun) {
    console.log('[apollo] Dry-run mode — skipping saveProspects.');
  } else {
    const result = saveProspects(prospects, outputPath);
    console.log(`[apollo] Saved ${result.totalProspects} prospect(s) to ${outputPath}`);
    console.log(`[apollo] By persona: CLO=${result.byPersona.CLO}, CCO=${result.byPersona.CCO}, CRO=${result.byPersona.CRO}`);
  }

  return prospects;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

/**
 * Parse CLI args of the form --key="value" or --key value.
 * @param {string[]} argv - process.argv slice.
 * @returns {Object} Parsed args map.
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const stripped = token.slice(2);
      const eqIdx = stripped.indexOf('=');
      if (eqIdx >= 0) {
        args[stripped.slice(0, eqIdx)] = stripped.slice(eqIdx + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          args[stripped] = next;
          i++;
        } else {
          args[stripped] = 'true';
        }
      }
    }
  }
  return args;
}

/**
 * CLI entry point. Parses args, validates the API key, and runs ingestFromApollo.
 */
async function main() {
  const args = parseArgs(process.argv);

  if (!process.env.APOLLO_API_KEY) {
    console.error('[apollo] ERROR: APOLLO_API_KEY environment variable is required.');
    console.error('[apollo] Set it via: export APOLLO_API_KEY=YOUR_APOLLO_KEY  (Unix)  or  set APOLLO_API_KEY=YOUR_APOLLO_KEY  (Windows)');
    process.exit(1);
  }

  if (!args.keywords) {
    console.error(`[apollo] ERROR: --keywords is required.
Usage:
  node apollo-lead-ingestion.js --keywords="AI,compliance" --max-companies=50
  node apollo-lead-ingestion.js --keywords="fintech,regulatory" --max-companies=100 --max-people-per-company=5
  APOLLO_API_KEY=YOUR_APOLLO_KEY node apollo-lead-ingestion.js --keywords="compliance" --dry-run
`);
    process.exit(1);
  }

  const keywords = String(args.keywords).split(',').map(k => k.trim()).filter(Boolean);
  const maxCompanies = parseInt(args['max-companies'] || String(DEFAULT_MAX_COMPANIES), 10) || DEFAULT_MAX_COMPANIES;
  const maxPeoplePerCompany = parseInt(args['max-people-per-company'] || String(DEFAULT_MAX_PEOPLE_PER_COMPANY), 10) || DEFAULT_MAX_PEOPLE_PER_COMPANY;
  const dryRun = args['dry-run'] === 'true' || args['dry-run'] === true;
  const outputPath = args.output || path.join(__dirname, 'prospects.json');

  await ingestFromApollo({
    keywords,
    maxCompanies,
    maxPeoplePerCompany,
    dryRun,
    outputPath,
  });
}

if (require.main === module) {
  main().catch(err => {
    console.error('[apollo] Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  searchOrganizations,
  searchPeople,
  enrichPerson,
  apolloToProspect,
  ingestFromApollo,
  // Exposed for testing / reuse
  parseRevenue,
  estimateDevelopers,
  inferCiCdPlatform,
  detectAiToolUsage,
  hasRegulatoryExposureBySector,
  rateLimit,
  TARGET_TITLES,
  APOLLO_API_BASE,
};
