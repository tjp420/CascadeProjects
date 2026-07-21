const fs = require('fs');
const path = require('path');
const basePath = path.resolve(process.cwd(), '.simplebeacon', 'report.json');
const parts = [
  path.resolve(process.cwd(), '.simplebeacon', 'report.json'),
  path.resolve(process.cwd(), '.simplebeacon', 'report-server.json'),
  path.resolve(process.cwd(), '.simplebeacon', 'report-ai-platform-src.json')
];
function readSafe(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch(e){ return null; } }
const reports = parts.map(readSafe).filter(Boolean);
if(reports.length===0){ console.error('No reports found'); process.exit(1); }
// Start with first report as base
const merged = JSON.parse(JSON.stringify(reports[0]));
const num = reports.length;
function sumField(field){ merged[field] = reports.reduce((s,r)=> s + (Number(r[field])||0), 0); }
// Numeric fields to sum (if present)
const numericFields = ['totalFiles','totalLines','ruleScopedFilesAnalyzed','repositoryFilesTotal','repositoryFoldersTotal','filesAnalyzed','totalSizeBytes','issueCount','invalidJson','emptyFiles'];
numericFields.forEach(f=> merged[f] = reports.reduce((s,r)=> s + (Number(r[f])||0), 0));
// severityCounts
merged.severityCounts = {critical:0,high:0,medium:0,low:0};
reports.forEach(r=>{ if(r.severityCounts){ merged.severityCounts.critical += r.severityCounts.critical||0; merged.severityCounts.high += r.severityCounts.high||0; merged.severityCounts.medium += r.severityCounts.medium||0; merged.severityCounts.low += r.severityCounts.low||0; }});
// Merge arrays and de-duplicate simple lists
function concatUnique(key){ const acc = []; reports.forEach(r=>{ if(Array.isArray(r[key])) r[key].forEach(i=>{ if(!acc.includes(i)) acc.push(i); }); }); merged[key]=acc; }
concatUnique('scanPaths');
concatUnique('sampleFiles');
// Merge detectedIssues and rawIssues
merged.detectedIssues = ([]).concat(...reports.map(r=>r.detectedIssues||[]));
merged.rawIssues = ([]).concat(...reports.map(r=>r.rawIssues||[]));
// gate
merged.gate = merged.gate || {pass:true,blockingCount:0,warningCount:0,blockingIssues:[],warningIssues:[]};
merged.gate.blockingCount = reports.reduce((s,r)=> s + ((r.gate && r.gate.blockingCount)||0), 0);
merged.gate.warningCount = reports.reduce((s,r)=> s + ((r.gate && r.gate.warningCount)||0), 0);
merged.gate.blockingIssues = ([]).concat(...reports.map(r=> (r.gate && r.gate.blockingIssues) || []));
merged.gate.warningIssues = ([]).concat(...reports.map(r=> (r.gate && r.gate.warningIssues) || []));
merged.gate.pass = merged.gate.blockingCount===0;
// scan_summary counts
merged.scan_summary = merged.scan_summary || {};
merged.scan_summary.total_risks_found = (reports.reduce((s,r)=> s + ((r.scan_summary && r.scan_summary.total_risks_found)||0),0));
merged.scan_summary.high_severity_count = merged.severityCounts.high || 0;
merged.scan_summary.medium_severity_count = merged.severityCounts.medium || 0;
merged.scan_summary.low_severity_count = merged.severityCounts.low || 0;
// timestamps: use latest
const latest = reports.reduce((a,r)=>{ const t = new Date(r.generatedAt||r.scan_summary&&r.scan_summary.timestamp||0); return t>a? t: a; }, new Date(0));
merged.generatedAt = new Date(Math.max(...reports.map(r=> new Date(r.generatedAt||0)))).toISOString();
merged.scan_summary.timestamp = merged.generatedAt;
// projectRoot/platformRoot: set to workspace root
merged.projectRoot = path.resolve(process.cwd());
merged.platformRoot = path.resolve(process.cwd());
// write file
fs.writeFileSync(basePath, JSON.stringify(merged,null,2),'utf8');
console.log('Merged', reports.length, 'reports ->', basePath); 
console.log('generatedAt:', merged.generatedAt);
