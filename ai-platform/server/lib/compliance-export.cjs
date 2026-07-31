'use strict';

/**
 * Compliance Export Engine — Generates deterministic CSV matrix tables
 * and signed PDF compliance documentation from audit log data.
 *
 * CSV exports produce deterministic, sorted output for reproducible audits.
 * PDF exports include HMAC-SHA256 signature metadata for tamper-evident
 * compliance documentation.
 *
 * @module compliance-export
 */

const crypto = require('crypto');
const auditLogger = require('./audit-logger.cjs');

// ── CSV helpers ─────────────────────────────────────────────────────────────

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(fields) {
  return fields.map(csvEscape).join(',');
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function sortObjectByValue(obj) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
}

// ── CSV Compliance Matrix ───────────────────────────────────────────────────

/**
 * Generate a deterministic CSV compliance matrix from audit log data.
 * Includes: metadata header, summary tables (by action, entity, actor, day),
 * chain verification status, and a detailed entry matrix.
 *
 * @param {string} orgId
 * @param {object} opts — { startDate, endDate }
 * @returns {string} CSV content
 */
function generateComplianceCsv(orgId, opts = {}) {
  const scopedOrgId = orgId || 'default';
  const report = auditLogger.generateComplianceReport(scopedOrgId, {
    startDate: opts.startDate || '',
    endDate: opts.endDate || '',
  });
  const chainResult = auditLogger.verifyChain(scopedOrgId);
  const entries = sortEntries(
    auditLogger.query({
      orgId: scopedOrgId,
      startDate: opts.startDate || '',
      endDate: opts.endDate || '',
      limit: 10000,
      offset: 0,
    }).entries
  );

  const lines = [];

  // Section 1: Metadata
  lines.push('# SimpleBeacon Compliance Export');
  lines.push(`# Organization,${csvEscape(scopedOrgId)}`);
  lines.push(`# Generated At,${csvEscape(report.generatedAt)}`);
  lines.push(`# Date Range Start,${csvEscape(opts.startDate || 'all')}`);
  lines.push(`# Date Range End,${csvEscape(opts.endDate || 'all')}`);
  lines.push(`# Total Entries,${report.totalEntries}`);
  lines.push(`# Critical Actions,${report.criticalActionCount}`);
  lines.push(`# Chain Valid,${chainResult.valid}`);
  lines.push(`# Chain Verified Entries,${chainResult.verifiedEntries}`);
  lines.push(`# Chain Broken At,${csvEscape(chainResult.brokenAt || '')}`);
  lines.push(`# Chain Failure Reason,${csvEscape(chainResult.reason || '')}`);
  lines.push('');

  // Section 2: Summary — By Action
  lines.push('## Summary by Action');
  lines.push(csvRow(['Action', 'Count']));
  for (const { key, value } of sortObjectByValue(report.summary.byAction)) {
    lines.push(csvRow([key, value]));
  }
  lines.push('');

  // Section 3: Summary — By Entity
  lines.push('## Summary by Entity');
  lines.push(csvRow(['Entity', 'Count']));
  for (const { key, value } of sortObjectByValue(report.summary.byEntity)) {
    lines.push(csvRow([key, value]));
  }
  lines.push('');

  // Section 4: Summary — By Actor
  lines.push('## Summary by Actor');
  lines.push(csvRow(['Actor ID', 'Count']));
  for (const { key, value } of sortObjectByValue(report.summary.byActor)) {
    lines.push(csvRow([key, value]));
  }
  lines.push('');

  // Section 5: Summary — By Day
  lines.push('## Summary by Day');
  lines.push(csvRow(['Date', 'Count']));
  const byDaySorted = Object.entries(report.summary.byDay).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  for (const [day, count] of byDaySorted) {
    lines.push(csvRow([day, count]));
  }
  lines.push('');

  // Section 6: Top Actors
  lines.push('## Top 10 Actors');
  lines.push(csvRow(['Actor ID', 'Entry Count']));
  for (const a of report.topActors) {
    lines.push(csvRow([a.actorId, a.count]));
  }
  lines.push('');

  // Section 7: Top Entities
  lines.push('## Top 10 Entities');
  lines.push(csvRow(['Entity', 'Entry Count']));
  for (const e of report.topEntities) {
    lines.push(csvRow([e.entity, e.count]));
  }
  lines.push('');

  // Section 8: Detailed Entry Matrix
  lines.push('## Detailed Audit Entry Matrix');
  lines.push(
    csvRow([
      'Timestamp',
      'ID',
      'Action',
      'Entity',
      'Entity ID',
      'Actor ID',
      'Actor Email',
      'Previous Hash',
      'Hash',
      'Changes',
    ])
  );
  for (const e of entries) {
    const changes = (e.changes || [])
      .map((c) => `${c.field}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.newValue)}`)
      .join('; ');
    lines.push(
      csvRow([
        e.timestamp,
        e.id,
        e.action,
        e.entity,
        e.entityId,
        e.actorId,
        e.actorEmail,
        e.previousHash || '',
        e.hash || '',
        changes,
      ])
    );
  }

  // Section 9: Cryptographic Signature
  const csvContent = lines.join('\n');
  const signingKey = getSigningKey();
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(csvContent)
    .digest('hex');

  lines.push('');
  lines.push('## Cryptographic Signature');
  lines.push(csvRow(['Algorithm', 'HMAC-SHA256']));
  lines.push(csvRow(['Signature', signature]));
  lines.push(csvRow(['Signed At', new Date().toISOString()]));

  return lines.join('\n');
}

// ── Signed PDF Compliance Report ────────────────────────────────────────────

function getSigningKey() {
  const secret =
    process.env.AUDIT_CHAIN_SECRET ||
    process.env.SIMPLEBEACON_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'simplebeacon-compliance-export-dev';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Escape a string for PDF text content.
 */
function pdfEscape(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Generate a signed PDF compliance report.
 * Produces a self-contained PDF with HMAC-SHA256 signature metadata.
 *
 * @param {string} orgId
 * @param {object} opts — { startDate, endDate }
 * @returns {Buffer} PDF content
 */
function generateCompliancePdf(orgId, opts = {}) {
  const scopedOrgId = orgId || 'default';
  const report = auditLogger.generateComplianceReport(scopedOrgId, {
    startDate: opts.startDate || '',
    endDate: opts.endDate || '',
  });
  const chainResult = auditLogger.verifyChain(scopedOrgId);
  const entries = sortEntries(
    auditLogger.query({
      orgId: scopedOrgId,
      startDate: opts.startDate || '',
      endDate: opts.endDate || '',
      limit: 500,
      offset: 0,
    }).entries
  );

  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10);

  // Build PDF content as text lines
  const contentLines = [];
  contentLines.push('SimpleBeacon Compliance Report');
  contentLines.push('');
  contentLines.push(`Organization: ${scopedOrgId}`);
  contentLines.push(`Generated: ${now}`);
  contentLines.push(`Date Range: ${opts.startDate || 'all'} to ${opts.endDate || 'all'}`);
  contentLines.push('');
  contentLines.push('--- Executive Summary ---');
  contentLines.push(`Total Audit Entries: ${report.totalEntries}`);
  contentLines.push(`Critical Actions: ${report.criticalActionCount}`);
  contentLines.push(`Chain Integrity: ${chainResult.valid ? 'VALID' : 'BROKEN'}`);
  contentLines.push(`Chain Verified Entries: ${chainResult.verifiedEntries} / ${chainResult.totalEntries}`);
  if (!chainResult.valid && chainResult.reason) {
    contentLines.push(`Chain Failure: ${chainResult.reason}`);
  }
  contentLines.push('');
  contentLines.push('--- Actions Breakdown ---');
  for (const { key, value } of sortObjectByValue(report.summary.byAction)) {
    contentLines.push(`  ${key}: ${value}`);
  }
  contentLines.push('');
  contentLines.push('--- Entities Breakdown ---');
  for (const { key, value } of sortObjectByValue(report.summary.byEntity)) {
    contentLines.push(`  ${key}: ${value}`);
  }
  contentLines.push('');
  contentLines.push('--- Top 10 Actors ---');
  for (const a of report.topActors) {
    contentLines.push(`  ${a.actorId}: ${a.count} entries`);
  }
  contentLines.push('');
  contentLines.push('--- Daily Activity ---');
  for (const [day, count] of Object.entries(report.summary.byDay).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    contentLines.push(`  ${day}: ${count}`);
  }
  contentLines.push('');
  contentLines.push('--- Recent Audit Entries (last 500) ---');
  for (const e of entries) {
    contentLines.push(
      `  ${e.timestamp} | ${e.action} | ${e.entity}:${e.entityId} | ${e.actorEmail || e.actorId}`
    );
  }
  contentLines.push('');
  contentLines.push('--- Cryptographic Signature ---');
  contentLines.push('Algorithm: HMAC-SHA256');

  // Compute signature over the text content
  const textContent = contentLines.join('\n');
  const signingKey = getSigningKey();
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(textContent)
    .digest('hex');

  contentLines.push(`Signature: ${signature}`);
  contentLines.push(`Signed At: ${now}`);

  // Build a minimal valid PDF
  const pdf = buildPdf(
    [
      `SimpleBeacon Compliance Report`,
      `Organization: ${scopedOrgId}`,
      `Date: ${dateStr}`,
      '',
      `Total Entries: ${report.totalEntries}`,
      `Critical Actions: ${report.criticalActionCount}`,
      `Chain Integrity: ${chainResult.valid ? 'VALID' : 'BROKEN'}`,
      `Verified: ${chainResult.verifiedEntries}/${chainResult.totalEntries}`,
      '',
      `Actions Breakdown:`,
      ...sortObjectByValue(report.summary.byAction)
        .slice(0, 10)
        .map(({ key, value }) => `  ${key}: ${value}`),
      '',
      `Top Actors:`,
      ...report.topActors
        .slice(0, 10)
        .map((a) => `  ${a.actorId}: ${a.count}`),
      '',
      `Recent Entries (showing ${Math.min(entries.length, 50)} of ${entries.length}):`,
      ...entries.slice(0, 50).map(
        (e) => `  ${e.timestamp} | ${e.action} | ${e.entity}:${e.entityId} | ${e.actorEmail || e.actorId}`
      ),
      '',
      `Cryptographic Signature:`,
      `  Algorithm: HMAC-SHA256`,
      `  Signature: ${signature.slice(0, 32)}...`,
      `  Signed: ${now}`,
    ],
    {
      title: `SimpleBeacon Compliance Report - ${scopedOrgId} - ${dateStr}`,
      author: 'SimpleBeacon Compliance Engine',
      subject: 'Compliance Audit Report with HMAC-SHA256 Signature',
    }
  );

  return pdf;
}

/**
 * Build a minimal valid PDF from an array of text lines.
 * @param {string[]} lines
 * @param {object} info — PDF document info (title, author, subject)
 * @returns {Buffer}
 */
function buildPdf(lines, info = {}) {
  const fontSize = 10;
  const lineHeight = 14;
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  const pages = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }
  if (pages.length === 0) pages.push(['']);

  const objects = [];
  let objNum = 0;

  function addObj(content) {
    objNum++;
    objects.push({ num: objNum, content });
    return objNum;
  }

  // Object 1: Catalog
  const catalogNum = addObj(null);
  // Object 2: Pages
  const pagesNum = addObj(null);
  // Object 3: Font
  const fontNum = addObj(null);

  const pageObjNums = [];
  for (const pageLines of pages) {
    const contentNum = addObj(null);
    const pageObj = addObj(null);
    pageObjNums.push(pageObj);
  }

  // Build content
  let contentStream = '';
  contentStream += `BT\n/F1 ${fontSize} Tf\n${margin} ${pageHeight - margin} Td\n${lineHeight} TL\n`;
  for (const line of pages[0] || ['']) {
    contentStream += `(${pdfEscape(line)}) Tj\nT*\n`;
  }
  contentStream += 'ET\n';

  // Now build the actual PDF bytes
  const parts = [];
  parts.push(Buffer.from('%PDF-1.4\n'));

  // Helper to write an object
  function writeObj(num, body) {
    parts.push(Buffer.from(`${num} 0 obj\n${body}\nendobj\n`));
  }

  // Catalog
  writeObj(
    1,
    `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`
  );

  // Pages
  const pageRefs = pageObjNums.map((n) => `${n} 0 R`).join(' ');
  writeObj(
    2,
    `<< /Type /Pages /Count ${pageObjNums.length} /Kids [${pageRefs}] >>`
  );

  // Font
  writeObj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`);

  // Page objects and content streams
  let contentObjNum = 4;
  let pageObjIdx = 0;
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p];
    let stream = `BT\n/F1 ${fontSize} Tf\n${margin} ${pageHeight - margin} Td\n${lineHeight} TL\n`;
    for (const line of pageLines) {
      stream += `(${pdfEscape(line)}) Tj\nT*\n`;
    }
    stream += 'ET\n';

    const streamBytes = Buffer.from(stream);
    writeObj(
      contentObjNum,
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`
    );

    const pageObjNumber = pageObjNums[pageObjIdx];
    writeObj(
      pageObjNumber,
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> >>`
    );

    contentObjNum++;
    pageObjIdx++;
  }

  // Info object
  const infoObjNum = contentObjNum;
  writeObj(
    infoObjNum,
    `<< /Title (${pdfEscape(info.title || '')}) /Author (${pdfEscape(info.author || '')}) /Subject (${pdfEscape(info.subject || '')}) /Creator (SimpleBeacon Compliance Engine) /Producer (SimpleBeacon) /CreationDate (D:${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}00) >>`
  );

  // Cross-reference table
  const xrefOffset = Buffer.concat(parts).length;
  const totalObjs = infoObjNum;
  parts.push(Buffer.from('xref\n'));
  parts.push(Buffer.from(`0 ${totalObjs + 1}\n`));
  parts.push(Buffer.from('0000000000 65535 f \n'));

  // We need to track offsets — rebuild with offsets
  // Actually, let's compute offsets properly
  const allParts = [];
  allParts.push(Buffer.from('%PDF-1.4\n'));

  const offsets = [];
  let currentOffset = allParts[0].length;

  function writeObjWithOffset(num, body) {
    offsets[num] = currentOffset;
    const buf = Buffer.from(`${num} 0 obj\n${body}\nendobj\n`);
    allParts.push(buf);
    currentOffset += buf.length;
  }

  // Reset and rebuild
  allParts.length = 0;
  allParts.push(Buffer.from('%PDF-1.4\n'));
  currentOffset = allParts[0].length;
  offsets.length = 0;

  writeObjWithOffset(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  writeObjWithOffset(2, `<< /Type /Pages /Count ${pageObjNums.length} /Kids [${pageRefs}] >>`);
  writeObjWithOffset(3, `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`);

  let cn = 4;
  let pi = 0;
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p];
    let stream = `BT\n/F1 ${fontSize} Tf\n${margin} ${pageHeight - margin} Td\n${lineHeight} TL\n`;
    for (const line of pageLines) {
      stream += `(${pdfEscape(line)}) Tj\nT*\n`;
    }
    stream += 'ET\n';

    writeObjWithOffset(cn, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);

    const pon = pageObjNums[pi];
    writeObjWithOffset(
      pon,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cn} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    );
    cn++;
    pi++;
  }

  const infoNum = cn;
  const now = new Date();
  writeObjWithOffset(
    infoNum,
    `<< /Title (${pdfEscape(info.title || '')}) /Author (${pdfEscape(info.author || '')}) /Subject (${pdfEscape(info.subject || '')}) /Creator (SimpleBeacon Compliance Engine) /Producer (SimpleBeacon) /CreationDate (D:${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}00) >>`
  );

  // xref
  const xrefPos = Buffer.concat(allParts).length;
  allParts.push(Buffer.from('xref\n'));
  allParts.push(Buffer.from(`0 ${infoNum + 1}\n`));
  allParts.push(Buffer.from('0000000000 65535 f \n'));
  for (let i = 1; i <= infoNum; i++) {
    allParts.push(Buffer.from(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`));
  }

  // trailer
  allParts.push(Buffer.from('trailer\n'));
  allParts.push(Buffer.from(`<< /Size ${infoNum + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\n`));
  allParts.push(Buffer.from('startxref\n'));
  allParts.push(Buffer.from(`${xrefPos}\n`));
  allParts.push(Buffer.from('%%EOF\n'));

  return Buffer.concat(allParts);
}

module.exports = {
  generateComplianceCsv,
  generateCompliancePdf,
};
