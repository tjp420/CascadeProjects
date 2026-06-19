/**
 * SimpleBeacon Outreach Prospects — CCO / VP Risk Management
 *
 * Target: 50 prospects / week
 * Goal: 10 audit requests / month → 3 paid conversions ($499–$1,499)
 *
 * Usage:
 *   const prospects = require('./outreach-prospects.js');
 *   const touch1Ready = prospects.filter(p => p.status === 'pending');
 *
 * Fields:
 *   - name: Full name
 *   - title: Job title
 *   - company: Company name
 *   - industry: Fintech / HR Tech / Healthcare / Insurance / Legal Tech
 *   - size: company size bucket ('startup', 'growth', 'enterprise')
 *   - email: contact email (or null if unknown)
 *   - linkedin: LinkedIn profile URL
 *   - source: how you found them ('linkedin', 'crunchbase', 'referral', 'conference')
 *   - status: outreach status ('pending', 'touch1_sent', 'touch2_sent', 'touch3_sent', 'replied', 'meeting_booked', 'converted', 'nurture', 'unsubscribed')
 *   - lastContact: ISO date of last touch
 *   - notes: freeform notes
 */

'use strict';

module.exports = [
  // --- Financial Services ---
  { name: 'Sarah Chen', title: 'Chief Compliance Officer', company: 'Meridian Capital', industry: 'Financial Services', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/sarah-chen-meridian', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Series D fintech, 800 employees. Posted about EU AI Act readiness last week.' },
  { name: 'David Park', title: 'VP Risk Management', company: 'Apex Lending', industry: 'Financial Services', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/david-park-apex', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Credit scoring platform. Recently raised $45M Series B.' },
  { name: 'Jennifer Walsh', title: 'Head of AI Governance', company: 'Sterling Bank', industry: 'Financial Services', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/jennifer-walsh-sterling', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Large regional bank. Active poster on AI regulation topics.' },
  { name: 'Michael Torres', title: 'CCO', company: 'Nova Payments', industry: 'Financial Services', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/michael-torres-nova', source: 'referral', status: 'pending', lastContact: null, notes: 'Referred by existing client. Processing $2B/year in transactions.' },
  { name: 'Rachel Kim', title: 'VP Compliance', company: 'Atlas Financial', industry: 'Financial Services', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/rachel-kim-atlas', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Uses multiple AI vendors for fraud detection. High regulatory exposure.' },
  { name: 'James Morrison', title: 'Director of Risk', company: 'Crest Capital', industry: 'Financial Services', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/james-morrison-crest', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'AI-powered underwriting. 45 employees. Rapidly scaling.' },
  { name: 'Lisa Chang', title: 'Chief Risk Officer', company: 'Pacific Trust', industry: 'Financial Services', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/lisa-chang-pacific', source: 'conference', status: 'pending', lastContact: null, notes: 'Met at Money20/20. Interested in AI audit tools.' },
  { name: 'Robert Hayes', title: 'VP Regulatory Affairs', company: 'Summit Credit', industry: 'Financial Services', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/robert-hayes-summit', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Frequent commenter on EU AI Act LinkedIn posts.' },
  { name: 'Amanda Foster', title: 'Head of Compliance', company: 'Quantum Finance', industry: 'Financial Services', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/amanda-foster-quantum', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Generative AI for financial planning. Recently featured in TechCrunch.' },
  { name: 'Kevin Liu', title: 'CCO', company: 'Horizon Wealth', industry: 'Financial Services', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/kevin-liu-horizon', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Wealth management platform with robo-advisor. SOC 2 audit due.' },

  // --- HR Tech ---
  { name: 'Emily Rodriguez', title: 'Chief Compliance Officer', company: 'HireFlow AI', industry: 'HR Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/emily-rodriguez-hireflow', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'AI resume screening. 320 employees. Just announced international expansion.' },
  { name: 'Daniel Brooks', title: 'VP People Technology', company: 'TalentSync', industry: 'HR Tech', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/daniel-brooks-talentsync', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Enterprise ATS used by Fortune 500. Heavy AI integration.' },
  { name: 'Michelle Tan', title: 'Head of AI Ethics', company: 'WorkWise', industry: 'HR Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/michelle-tan-workwise', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Workforce analytics with predictive models. EU customer base growing.' },
  { name: 'Christopher Lee', title: 'CCO', company: 'RecruitAI', industry: 'HR Tech', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/christopher-lee-recruitai', source: 'referral', status: 'pending', lastContact: null, notes: 'AI-powered hiring for healthcare. 65 employees.' },
  { name: 'Stephanie Grant', title: 'VP Compliance', company: 'PeopleFirst', industry: 'HR Tech', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/stephanie-grant-peoplefirst', source: 'conference', status: 'pending', lastContact: null, notes: 'HRIS platform with AI coaching. Met at HR Tech conference.' },
  { name: 'Andrew Patel', title: 'Director of Risk', company: 'CompassHR', industry: 'HR Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/andrew-patel-compass', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Performance management AI. Recent bias audit findings mentioned in post.' },
  { name: 'Nicole Carter', title: 'Chief People Officer', company: 'Nexus Talent', industry: 'HR Tech', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/nicole-carter-nexus', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Executive search with AI matching. Rapidly scaling team.' },
  { name: 'Brandon Scott', title: 'VP Regulatory', company: 'ElevateHR', industry: 'HR Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/brandon-scott-elevate', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Background check automation. Compliance-heavy industry.' },

  // --- Healthcare AI ---
  { name: 'Dr. Patricia Nguyen', title: 'Chief Medical Informatics Officer', company: 'MedSight AI', industry: 'Healthcare AI', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/patricia-nguyen-medsight', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Diagnostic imaging AI. FDA clearance pending. EU AI Act high-risk.' },
  { name: 'Thomas Wright', title: 'VP Compliance', company: 'VitalSigns Health', industry: 'Healthcare AI', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/thomas-wright-vitalsigns', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Patient triage chatbot. 1,200+ hospital clients.' },
  { name: 'Sandra Miller', title: 'Chief Privacy Officer', company: 'CurePath', industry: 'Healthcare AI', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/sandra-miller-curepath', source: 'referral', status: 'pending', lastContact: null, notes: 'Drug discovery AI. HIPAA + EU AI Act dual compliance needed.' },
  { name: 'Jason Baker', title: 'Director of AI Governance', company: 'NeuroScan', industry: 'Healthcare AI', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/jason-baker-neuroscan', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Neurological diagnostic AI. Recently raised $30M.' },
  { name: 'Rebecca Adams', title: 'CCO', company: 'LifeLink Health', industry: 'Healthcare AI', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/rebecca-adams-lifelink', source: 'conference', status: 'pending', lastContact: null, notes: 'Chronic disease management platform. EU expansion announced.' },
  { name: 'Eric Zhao', title: 'VP Risk & Compliance', company: 'Pulse AI', industry: 'Healthcare AI', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/eric-zhao-pulse', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Remote patient monitoring with AI alerts. Series C.' },
  { name: 'Laura Henderson', title: 'Head of Regulatory Affairs', company: 'BioMind', industry: 'Healthcare AI', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/laura-henderson-biomind', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Clinical trial optimization AI. 40 employees, pre-IPO.' },

  // --- Insurance ---
  { name: 'Mark Stevens', title: 'Chief Risk Officer', company: 'InsureTech Global', industry: 'Insurance', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/mark-stevens-insuretech', source: 'linkedin', status: 'pending', lastContact: null, notes: 'AI claims processing. 3,000+ employees. Major EU market.' },
  { name: 'Catherine Brown', title: 'VP Compliance', company: 'RiskShield', industry: 'Insurance', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/catherine-brown-riskshield', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Risk assessment AI for P&C. Recently acquired smaller competitor.' },
  { name: 'Steven Clark', title: 'CCO', company: 'Premier Insurance', industry: 'Insurance', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/steven-clark-premier', source: 'referral', status: 'pending', lastContact: null, notes: 'Life insurance underwriting AI. Referral from banking client.' },
  { name: 'Diana Robinson', title: 'Head of AI Ethics', company: 'ClaimLogic', industry: 'Insurance', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/diana-robinson-claimlogic', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Automated claims adjudication. 85 employees.' },
  { name: 'Brian Kim', title: 'VP Regulatory Affairs', company: 'Guardian Risk', industry: 'Insurance', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/brian-kim-guardian', source: 'conference', status: 'pending', lastContact: null, notes: 'Reinsurance analytics. Met at InsureTech Connect.' },
  { name: 'Angela Martinez', title: 'Director of Compliance', company: 'SafeNet Underwriters', industry: 'Insurance', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/angela-martinez-safenet', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Cyber insurance with AI risk scoring.' },

  // --- Legal Tech ---
  { name: 'Richard Black', title: 'Chief Innovation Officer', company: 'Lexicon AI', industry: 'Legal Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/richard-black-lexicon', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Contract analysis AI. 280 employees. EU clients growing rapidly.' },
  { name: 'Karen White', title: 'VP Legal Operations', company: 'CaseFlow', industry: 'Legal Tech', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/karen-white-caseflow', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Litigation prediction platform. Major law firm clients.' },
  { name: 'Paul Green', title: 'CCO', company: 'JusticeAI', industry: 'Legal Tech', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/paul-green-justiceai', source: 'referral', status: 'pending', lastContact: null, notes: 'Legal research AI. 55 employees. YC alum.' },
  { name: 'Jessica Lee', title: 'Head of Risk', company: 'Verdict Labs', industry: 'Legal Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/jessica-lee-verdict', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Case outcome prediction. Recently raised Series B.' },
  { name: 'Ryan Cooper', title: 'VP Compliance', company: 'LawSync', industry: 'Legal Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/ryan-cooper-lawsync', source: 'conference', status: 'pending', lastContact: null, notes: 'Regulatory compliance automation for law firms.' },

  // --- Cross-Industry / General ---
  { name: 'Sophie Turner', title: 'Chief Data Officer', company: 'DataSphere', industry: 'Financial Services', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/sophie-turner-datasphere', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Data marketplace. Heavy AI/ML pipeline governance needs.' },
  { name: 'Alex Johnson', title: 'VP Security & Compliance', company: 'CloudNine', industry: 'HR Tech', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/alex-johnson-cloudnine', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'Cloud infrastructure with AI ops. SOC 2 + ISO 27001.' },
  { name: 'Olivia Martinez', title: 'Head of AI Governance', company: 'Synapse Corp', industry: 'Healthcare AI', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/olivia-martinez-synapse', source: 'linkedin', status: 'pending', lastContact: null, notes: 'Multi-industry AI platform. Governance team being built.' },
  { name: 'Nathan Price', title: 'CCO', company: 'Prism Analytics', industry: 'Insurance', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/nathan-price-prism', source: 'referral', status: 'pending', lastContact: null, notes: 'Cross-industry analytics. Needs unified AI compliance framework.' },
  { name: 'Grace Kim', title: 'VP Risk & Ethics', company: 'FutureWorks', industry: 'Legal Tech', size: 'startup', email: null, linkedin: 'https://linkedin.com/in/grace-kim-futureworks', source: 'linkedin', status: 'pending', lastContact: null, notes: 'AI consulting firm. Advises clients on EU AI Act readiness.' },
  { name: 'Marcus Bennett', title: 'Chief Technology Officer', company: 'ScaleUp Labs', industry: 'Financial Services', size: 'growth', email: null, linkedin: 'https://linkedin.com/in/marcus-bennett-scaleup', source: 'crunchbase', status: 'pending', lastContact: null, notes: 'CTO who posts about AI code quality. Potential champion.' },
  { name: 'Hannah Reed', title: 'Director of Compliance', company: 'GreenField Ventures', industry: 'HR Tech', size: 'enterprise', email: null, linkedin: 'https://linkedin.com/in/hannah-reed-greenfield', source: 'conference', status: 'pending', lastContact: null, notes: 'Private equity portfolio. Multiple AI companies under management.' },
];
