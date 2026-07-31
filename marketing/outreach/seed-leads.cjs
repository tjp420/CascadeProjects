#!/usr/bin/env node
'use strict';

/**
 * Mock Lead Seed Script — Generates realistic sample prospects (CLO/CCO/CRO
 * personas) with varied qualification scores, sectors, and statuses, then
 * writes them to prospects.json using the existing saveProspects function.
 *
 * Usage:
 *   node seed-leads.cjs --count=50 --output=./prospects.json
 *   node seed-leads.cjs --count=10 --seed=12345
 *
 * Exports:
 *   generateMockProspect, generateMockProspects, seedDatabase
 */

const path = require('path');
const {
  PERSONAS,
  QUALIFICATION_CRITERIA,
  classifyPersona,
  calculateQualificationScore,
  isQualified,
  saveProspects,
  generateProspectId,
} = require('./prospect-scraper');

// ── Name Pools ───────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James',
  'Mary',
  'Robert',
  'Patricia',
  'John',
  'Jennifer',
  'Michael',
  'Linda',
  'David',
  'Elizabeth',
  'William',
  'Barbara',
  'Richard',
  'Susan',
  'Joseph',
  'Jessica',
  'Thomas',
  'Sarah',
  'Charles',
  'Karen',
  'Christopher',
  'Nancy',
  'Daniel',
  'Lisa',
  'Matthew',
  'Margaret',
  'Anthony',
  'Sandra',
  'Mark',
  'Ashley',
  'Donald',
  'Kimberly',
  'Steven',
  'Emily',
  'Paul',
  'Donna',
  'Andrew',
  'Michelle',
  'Joshua',
  'Carol',
  'Kenneth',
  'Amanda',
  'Kevin',
  'Melissa',
  'Brian',
  'Deborah',
  'George',
  'Stephanie',
  'Edward',
  'Rebecca',
  'Ronald',
  'Laura',
  'Timothy',
  'Sharon',
  'Jason',
  'Cynthia',
  'Jeffrey',
  'Kathleen',
  'Ryan',
  'Amy',
  'Jacob',
  'Shirley',
  'Gary',
  'Angela',
  'Nicholas',
  'Helen',
  'Eric',
  'Anna',
  'Jonathan',
  'Brenda',
  'Stephen',
  'Pamela',
  'Larry',
  'Nicole',
  'Justin',
  'Emma',
  'Scott',
  'Samantha',
  'Brandon',
  'Katherine',
  'Benjamin',
  'Christine',
  'Samuel',
  'Debra',
  'Gregory',
  'Rachel',
  'Frank',
  'Catherine',
  'Alexander',
  'Carolyn',
  'Raymond',
  'Janet',
  'Patrick',
  'Ruth',
  'Jack',
  'Maria',
  'Dennis',
  'Heather',
  'Jerry',
  'Diane',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
  'Gomez',
  'Phillips',
  'Evans',
  'Turner',
  'Diaz',
  'Parker',
  'Cruz',
  'Edwards',
  'Collins',
  'Reyes',
  'Stewart',
  'Morris',
  'Morales',
  'Murphy',
  'Cook',
  'Rogers',
  'Gutierrez',
  'Ortiz',
  'Morgan',
  'Cooper',
  'Peterson',
  'Bailey',
  'Reed',
  'Kelly',
  'Howard',
  'Ramos',
  'Kim',
  'Cox',
  'Ward',
  'Richardson',
  'Watson',
  'Brooks',
  'Chavez',
  'Wood',
  'James',
  'Bennett',
  'Gray',
  'Mendoza',
  'Ruiz',
  'Hughes',
  'Price',
  'Alvarez',
  'Castillo',
  'Sanders',
  'Patel',
  'Myers',
  'Long',
  'Ross',
  'Foster',
  'Jimenez',
  'Powell',
  'Jenkins',
  'Perry',
  'Russell',
  'Sullivan',
];

// ── Company Name Components ──────────────────────────────────────────────────

const COMPANY_PREFIXES = {
  fintech: ['Pay', 'Fin', 'Lend', 'Vault', 'Ledger', 'Coin', 'Swift', 'Clear'],
  banking: [
    'Trust',
    'Capital',
    'Mercantile',
    'Union',
    'Federal',
    'Heritage',
    'Pioneer',
    'Sterling',
  ],
  insurance: ['Shield', 'Guardian', 'Safe', 'Mutual', 'Assure', 'Sentinel', 'Pillar', 'Haven'],
  healthcare: ['Med', 'Care', 'Health', 'Vital', 'Bio', 'Therapy', 'Wellness', 'Cure'],
  pharmaceutical: ['Pharma', 'Bio', 'Thera', 'Gen', 'Nova', 'Celsus', 'Vax', 'Mereo'],
  technology: ['Nex', 'Cyber', 'Quantum', 'Data', 'Cloud', 'Byte', 'Logic', 'Apex'],
  telecommunications: ['Tele', 'Signal', 'Connect', 'Wave', 'Link', 'Pulse', 'Band', 'Stream'],
  energy: ['Power', 'Energy', 'Grid', 'Solar', 'Volt', 'Flux', 'Atlas', 'Terra'],
  manufacturing: [
    'Iron',
    'Forge',
    'Industrial',
    'Precision',
    'Craft',
    'Works',
    'Titan',
    'Vanguard',
  ],
  'government contractor': [
    'Defense',
    'Aerospace',
    'Systems',
    'Federal',
    'Strategic',
    'Allied',
    'Sentinel',
    'Liberty',
  ],
  aerospace: ['Aero', 'Orbit', 'Jet', 'Stellar', 'Apex', 'Vector', 'Nova', 'Horizon'],
  automotive: ['Auto', 'Motor', 'Drive', 'Velocity', 'Gear', 'Motive', 'Precision', 'Apex'],
};

const COMPANY_SUFFIXES = [
  'Systems',
  'Corp',
  'Group',
  'Labs',
  'Partners',
  'Holdings',
  'Solutions',
  'Technologies',
  'Industries',
  'Networks',
];

const CI_CD_PLATFORMS = ['azure-devops', 'github-actions', 'gitlab-ci', 'unknown'];

const PROSPECT_STATUSES = [
  'new',
  'qualified',
  'contacted',
  'replied',
  'meeting',
  'pilot',
  'closed',
  'disqualified',
];

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

/**
 * Create a seeded pseudo-random number generator (mulberry32).
 *
 * @param {number} seed - 32-bit integer seed.
 * @returns {function(): number} PRNG function returning floats in [0, 1).
 */
function createPrng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a string seed into a 32-bit integer hash.
 *
 * @param {string} str - String to hash.
 * @returns {number} 32-bit unsigned integer.
 */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Random Helpers ───────────────────────────────────────────────────────────

/**
 * Pick a random element from an array using the provided PRNG.
 *
 * @param {Array<T>} arr - Source array.
 * @param {function(): number} rand - PRNG function.
 * @returns {T} Randomly selected element.
 * @template T
 */
function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Pick a random integer in [min, max] inclusive using the provided PRNG.
 *
 * @param {number} min - Minimum value (inclusive).
 * @param {number} max - Maximum value (inclusive).
 * @param {function(): number} rand - PRNG function.
 * @returns {number} Random integer.
 */
function randInt(min, max, rand) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/**
 * Return true with the given probability using the provided PRNG.
 *
 * @param {number} probability - Float in [0, 1].
 * @param {function(): number} rand - PRNG function.
 * @returns {boolean} True with the given probability.
 */
function chance(probability, rand) {
  return rand() < probability;
}

// ── Mock Data Generators ─────────────────────────────────────────────────────

/**
 * Generate a developer count bucket: ~40% qualified (50+), ~30% partial (20-49),
 * ~30% unqualified (<20).
 *
 * @param {function(): number} rand - PRNG function.
 * @returns {number} Estimated developer count.
 */
function generateDeveloperCount(rand) {
  const bucket = rand();
  if (bucket < 0.4) return randInt(50, 500, rand);
  if (bucket < 0.7) return randInt(20, 49, rand);
  return randInt(5, 19, rand);
}

/**
 * Generate a revenue bucket: ~40% qualified ($50M+), ~30% partial ($10M-$50M),
 * ~30% unqualified (<$10M).
 *
 * @param {function(): number} rand - PRNG function.
 * @returns {number} Estimated annual revenue in USD.
 */
function generateRevenue(rand) {
  const bucket = rand();
  if (bucket < 0.4) return randInt(50, 500, rand) * 1_000_000;
  if (bucket < 0.7) return randInt(10, 49, rand) * 1_000_000;
  return randInt(1, 9, rand) * 1_000_000;
}

/**
 * Build a realistic company name from a sector prefix and a suffix word.
 *
 * @param {string} sector - Target sector key.
 * @param {function(): number} rand - PRNG function.
 * @returns {string} Company name.
 */
function generateCompanyName(sector, rand) {
  const prefixes = COMPANY_PREFIXES[sector] || ['Acme'];
  const prefix = pick(prefixes, rand);
  const suffix = pick(COMPANY_SUFFIXES, rand);
  return `${prefix}${suffix}`;
}

/**
 * Derive a domain from a company name.
 *
 * @param {string} company - Company name.
 * @returns {string} Lowercased domain with no spaces.
 */
function deriveDomain(company) {
  return company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}

/**
 * Determine a prospect status. Qualified prospects get 'qualified' or a later
 * pipeline stage; unqualified prospects get 'new' or occasionally 'disqualified'.
 *
 * @param {Object} prospect - Prospect object (score + flags already set).
 * @param {function(): number} rand - PRNG function.
 * @returns {string} Status string.
 */
function determineStatus(prospect, rand) {
  if (isQualified(prospect)) {
    // Qualified: mostly 'qualified', some progressed further.
    const roll = rand();
    if (roll < 0.55) return 'qualified';
    if (roll < 0.7) return 'contacted';
    if (roll < 0.8) return 'replied';
    if (roll < 0.88) return 'meeting';
    if (roll < 0.93) return 'pilot';
    if (roll < 0.98) return 'closed';
    return 'new';
  }
  // Unqualified: mostly 'new', a few disqualified.
  const roll = rand();
  if (roll < 0.85) return 'new';
  if (roll < 0.95) return 'contacted';
  return 'disqualified';
}

/**
 * Generate a single realistic mock prospect.
 *
 * @param {Object} [options] - Generation options.
 * @param {string} [options.persona] - Force a specific persona ('CLO'|'CCO'|'CRO').
 * @param {string} [options.sector] - Force a specific sector.
 * @param {function(): number} [options.rand] - PRNG function (defaults to Math.random).
 * @returns {Object} Prospect object matching the Prospect schema.
 */
function generateMockProspect(options) {
  const opts = options || {};
  const rand = opts.rand || Math.random;
  const sectors = QUALIFICATION_CRITERIA.targetSectors;
  const sector = opts.sector || pick(sectors, rand);
  const personaId = opts.persona || pick(['CLO', 'CCO', 'CRO'], rand);
  const persona = PERSONAS[personaId];
  const title = pick(persona.titles, rand);

  const firstName = pick(FIRST_NAMES, rand);
  const lastName = pick(LAST_NAMES, rand);
  const company = generateCompanyName(sector, rand);
  const domain = deriveDomain(company);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
  const linkedinUrl = `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`;

  const estimatedDevelopers = generateDeveloperCount(rand);
  const estimatedRevenue = generateRevenue(rand);
  const usesAiTools = chance(0.7, rand);
  const hasRegulatoryExposure = chance(0.6, rand);
  const ciCdPlatform = pick(CI_CD_PLATFORMS, rand);

  const now = new Date().toISOString();

  const prospect = {
    id: generateProspectId(email, company),
    firstName,
    lastName,
    email,
    title,
    persona: personaId,
    company,
    domain,
    linkedinUrl,
    sector,
    estimatedDevelopers,
    estimatedRevenue,
    usesAiTools,
    hasRegulatoryExposure,
    ciCdPlatform,
    qualificationScore: 0,
    status: 'new',
    createdAt: now,
    updatedAt: now,
  };

  prospect.qualificationScore = calculateQualificationScore(prospect);
  prospect.status = determineStatus(prospect, rand);

  return prospect;
}

/**
 * Generate a batch of mock prospects with varied personas, sectors, and sizes.
 *
 * @param {number} count - Number of prospects to generate.
 * @param {Object} [options] - Generation options.
 * @param {function(): number} [options.rand] - PRNG function (defaults to Math.random).
 * @returns {Array<Object>} Array of Prospect objects.
 */
function generateMockProspects(count, options) {
  const opts = options || {};
  const rand = opts.rand || Math.random;
  const sectors = QUALIFICATION_CRITERIA.targetSectors;
  const personas = ['CLO', 'CCO', 'CRO'];

  // Distribute personas roughly evenly: ~17/17/16 for count=50.
  const personaCounts = { CLO: 0, CCO: 0, CRO: 0 };
  const personaTargets = {};
  const base = Math.floor(count / 3);
  personaTargets.CLO = base;
  personaTargets.CCO = base;
  personaTargets.CRO = count - base * 2;

  const prospects = [];
  for (let i = 0; i < count; i++) {
    // Pick the persona that is most behind its target.
    let personaId = personas[0];
    let maxDeficit = -1;
    for (const p of personas) {
      const deficit = personaTargets[p] - personaCounts[p];
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        personaId = p;
      }
    }
    personaCounts[personaId]++;

    // Rotate sectors so all target sectors are represented.
    const sector = sectors[i % sectors.length];

    const prospect = generateMockProspect({ persona: personaId, sector, rand });
    prospects.push(prospect);
  }

  return prospects;
}

/**
 * Seed the prospects database (JSON file) with mock prospects.
 *
 * @param {Object} [options] - Seed options.
 * @param {number} [options.count=50] - Number of prospects to generate.
 * @param {string} [options.output] - Output file path.
 * @param {number|string} [options.seed] - Random seed for reproducibility.
 * @returns {Object} The saveProspects result object.
 */
function seedDatabase(options) {
  const opts = options || {};
  const count = parseInt(opts.count, 10) || 50;
  const output = opts.output || path.join(__dirname, 'prospects.json');

  let rand = Math.random;
  if (opts.seed !== undefined) {
    const seedNum = typeof opts.seed === 'number' ? opts.seed : hashSeed(String(opts.seed));
    rand = createPrng(seedNum);
  }

  const prospects = generateMockProspects(count, { rand });
  const result = saveProspects(prospects, output);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`[seed-leads] Generated ${result.totalProspects} prospects`);
  console.log(`[seed-leads] Qualified: ${result.qualified}`);
  console.log(
    `[seed-leads] By persona: CLO=${result.byPersona.CLO}, CCO=${result.byPersona.CCO}, CRO=${result.byPersona.CRO}`
  );
  console.log(`[seed-leads] By sector:`);
  for (const [sector, n] of Object.entries(result.bySector).sort()) {
    console.log(`  ${sector}: ${n}`);
  }
  console.log(`[seed-leads] Saved to ${output}`);

  return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments of the form --key=value or --key value.
 *
 * @param {string[]} argv - process.argv slice.
 * @returns {Object} Parsed arguments map.
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (arg.includes('=')) {
        const eqIdx = arg.indexOf('=');
        args[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          args[key] = next;
          i++;
        } else {
          args[key] = 'true';
        }
      }
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`
Usage:
  node seed-leads.cjs --count=<n> --output=<path> --seed=<value>

Options:
  --count   Number of prospects to generate (default: 50)
  --output  Output file path (default: ./prospects.json)
  --seed    Random seed for reproducibility (optional)
  --help    Show this help message
`);
    return;
  }

  seedDatabase({
    count: args.count,
    output: args.output,
    seed: args.seed,
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  generateMockProspect,
  generateMockProspects,
  seedDatabase,
};
