// simplebeacon-ignore: Security report generator — all findings are false positives in scanner source
/**
 * Security & Executive Compliance Clearance Report Generator
 *
 * Generates a polished PDF report entirely in the browser using jsPDF.
 * No scan data leaves the user's machine — Zero Data Custody.
 *
 * Report sections:
 * 1. Header with company branding and report metadata
 * 2. Executive Summary — gate status, quality score, file counts
 * 3. Severity Summary Bar — counts per tier with color coding
 * 4. Findings Table — grouped by severity with file path, rule, impact
 * 5. Compliance Declaration — Zero Data Custody statement
 * 6. Footer with timestamp and report ID
 */
(function () {
    'use strict';

    const COMPANY = {
        name: 'SimpleBeacon',
        legalName: 'SimpleBeacon, Inc.',
        website: 'https://simplebeacon.ai',
        email: 'compliance@simplebeacon.ai'
    };

    const SEVERITY_COLORS = {
        critical: { bg: [220, 38, 38], text: [255, 255, 255], light: [254, 226, 226] },
        high: { bg: [239, 68, 68], text: [255, 255, 255], light: [254, 242, 242] },
        medium: { bg: [245, 158, 11], text: [255, 255, 255], light: [254, 249, 195] },
        low: { bg: [96, 165, 250], text: [255, 255, 255], light: [219, 234, 254] }
    };

    const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
    const SEVERITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

    /**
     * Generate a compliance clearance PDF report from scan results.
     * @param {Object} scanResult - The result object from AuditScanService.scan()
     * @param {Object} options - Optional: { projectName, scanDate, customerName }
     * @returns {Promise<{blob: Blob, filename: string, reportId: string}>}
     */
    async function generateComplianceReport(scanResult, options = {}) {
        if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
            throw new Error(
                'jsPDF library not loaded. Include jsPDF from CDN before calling generateComplianceReport.'
            );
        }
        const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
        const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

        const pageWidth = 612; // 8.5in at 72dpi
        const pageHeight = 792;
        const margin = 50;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const reportId = 'SB-RPT-' + Date.now().toString(36).toUpperCase();
        const scanDate = options.scanDate ? new Date(options.scanDate) : new Date();
        const formattedDate = scanDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = scanDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const projectName = options.projectName || scanResult.scanId || 'Local Environment';
        const customerName = options.customerName || 'Engineering Team';

        // Group findings by severity
        const findings = scanResult.findings || scanResult.issues || [];
        const issuesBySeverity = { critical: [], high: [], medium: [], low: [] };
        for (const f of findings) {
            const sev = (f.severity || 'low').toLowerCase();
            if (issuesBySeverity[sev]) issuesBySeverity[sev].push(f);
            else issuesBySeverity.low.push(f);
        }
        const sevCounts = {
            critical: issuesBySeverity.critical.length,
            high: issuesBySeverity.high.length,
            medium: issuesBySeverity.medium.length,
            low: issuesBySeverity.low.length
        };
        const totalFindings = findings.length;
        const gatePass = sevCounts.critical === 0 && sevCounts.high === 0;
        const qualityScore =
            scanResult.qualityScore !== undefined
                ? scanResult.qualityScore
                : totalFindings === 0
                  ? 100
                  : Math.max(0, 100 - totalFindings * 2);

        // === Section 1: Header ===
        doc.setFillColor(10, 14, 24);
        doc.rect(0, 0, pageWidth, 80, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(COMPANY.name, margin, 35);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(180, 180, 190);
        doc.text(COMPANY.legalName + '  ·  ' + COMPANY.website, margin, 52);
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('SECURITY & EXECUTIVE COMPLIANCE', pageWidth - margin, 35, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 190);
        doc.text('CLEARANCE REPORT', pageWidth - margin, 52, { align: 'right' });

        y = 100;

        // Report metadata box
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(margin, y, contentWidth, 60, 4, 4, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(107, 114, 128);
        doc.text('REPORT ID', margin + 12, y + 14);
        doc.text('SCAN DATE', margin + 180, y + 14);
        doc.text('PROJECT', margin + 350, y + 14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(9);
        doc.text(reportId, margin + 12, y + 28);
        doc.text(formattedDate + ' ' + formattedTime, margin + 180, y + 28);
        doc.text(projectName.substring(0, 40), margin + 350, y + 28);
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        doc.text('Prepared for: ' + customerName, margin + 12, y + 46);
        doc.text(
            'Files scanned: ' + (scanResult.processed || 0) + ' / ' + (scanResult.totalFiles || 0),
            margin + 180,
            y + 46
        );
        if (scanResult.filesSkippedByHashCache > 0) {
            doc.text('Cache hits: ' + scanResult.filesSkippedByHashCache + ' (incremental scan)', margin + 350, y + 46);
        }

        y += 80;

        // === Section 2: Executive Summary ===
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(10, 14, 24);
        doc.text('EXECUTIVE SUMMARY', margin, y);
        y += 20;

        // Gate status box
        const gateColor = gatePass ? [16, 185, 129] : [220, 38, 38];
        const gateLabel = gatePass
            ? 'PASS — No blocking findings detected'
            : 'FAIL — Blocking findings require remediation';
        doc.setFillColor(gateColor[0], gateColor[1], gateColor[2]);
        doc.roundedRect(margin, y, contentWidth, 36, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('GATE STATUS: ' + gateLabel, margin + 12, y + 22);
        y += 50;

        // Quality score and metrics
        const metricsY = y;
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, y, contentWidth, 70, 4, 4, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(107, 114, 128);

        const colW = contentWidth / 4;
        const metrics = [
            {
                label: 'QUALITY SCORE',
                value: qualityScore + '/100',
                color: qualityScore >= 80 ? [16, 185, 129] : qualityScore >= 60 ? [245, 158, 11] : [220, 38, 38]
            },
            { label: 'TOTAL FINDINGS', value: String(totalFindings), color: [10, 14, 24] },
            { label: 'FILES SCANNED', value: String(scanResult.processed || 0), color: [10, 14, 24] },
            {
                label: 'BLOCKING',
                value: String(sevCounts.critical + sevCounts.high),
                color: sevCounts.critical + sevCounts.high > 0 ? [220, 38, 38] : [16, 185, 129]
            }
        ];

        for (let i = 0; i < metrics.length; i++) {
            const mx = margin + i * colW + 12;
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(metrics[i].label, mx, metricsY + 16);
            doc.setTextColor(metrics[i].color[0], metrics[i].color[1], metrics[i].color[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(metrics[i].value, mx, metricsY + 42);
            if (i > 0) {
                doc.setDrawColor(229, 231, 235);
                doc.line(margin + i * colW, metricsY + 10, margin + i * colW, metricsY + 60);
            }
        }
        y += 85;

        // === Section 3: Severity Summary ===
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(10, 14, 24);
        doc.text('SEVERITY DISTRIBUTION', margin, y);
        y += 18;

        // Severity bar — colored segments proportional to counts
        const barHeight = 28;
        const totalForBar = Math.max(totalFindings, 1);
        let barX = margin;
        for (const sev of SEVERITY_ORDER) {
            const count = sevCounts[sev];
            if (count === 0) continue;
            const segWidth = (count / totalForBar) * contentWidth;
            const colors = SEVERITY_COLORS[sev];
            doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
            doc.rect(barX, y, segWidth, barHeight, 'F');
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            if (segWidth > 40) {
                doc.text(SEVERITY_LABELS[sev] + ': ' + count, barX + 6, y + 18);
            }
            barX += segWidth;
        }
        if (totalFindings === 0) {
            doc.setFillColor(229, 231, 235);
            doc.rect(margin, y, contentWidth, barHeight, 'F');
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text('No findings — clean scan', margin + 12, y + 18);
        }
        y += barHeight + 12;

        // Severity legend
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let legendX = margin;
        for (const sev of SEVERITY_ORDER) {
            const colors = SEVERITY_COLORS[sev];
            doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
            doc.circle(legendX + 4, y + 4, 4, 'F');
            doc.setTextColor(55, 65, 81);
            doc.text(SEVERITY_LABELS[sev] + ' (' + sevCounts[sev] + ')', legendX + 14, y + 7);
            legendX += 110;
        }
        y += 20;

        // === Section 4: Findings Detail ===
        if (totalFindings > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(10, 14, 24);
            doc.text('FINDINGS DETAIL', margin, y);
            y += 18;

            for (const sev of SEVERITY_ORDER) {
                const items = issuesBySeverity[sev];
                if (items.length === 0) continue;
                const colors = SEVERITY_COLORS[sev];

                // Severity group header
                if (y > pageHeight - 100) {
                    doc.addPage();
                    y = margin;
                }
                doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
                doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
                doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
                doc.circle(margin + 8, y + 11, 4, 'F');
                doc.setTextColor(31, 41, 55);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(SEVERITY_LABELS[sev] + ' (' + items.length + ')', margin + 20, y + 15);
                y += 28;

                // Table header
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(107, 114, 128);
                doc.text('FILE', margin, y);
                doc.text('RULE', margin + 250, y);
                doc.text('IMPACT', margin + 350, y);
                y += 10;
                doc.setDrawColor(229, 231, 235);
                doc.line(margin, y, pageWidth - margin, y);
                y += 6;

                // Items
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                const maxItems = sev === 'critical' || sev === 'high' ? 30 : 15;
                const visibleItems = items.slice(0, maxItems);
                for (const item of visibleItems) {
                    if (y > pageHeight - 60) {
                        doc.addPage();
                        y = margin;
                    }
                    const filePath = (item.filePath || item.file || '').split('/').pop() || '—';
                    const fullPath = item.filePath || item.file || '';
                    const rule = item.rule || item.type || '—';
                    const impact = (item.impact || '').substring(0, 60);

                    doc.setTextColor(31, 41, 55);
                    doc.text(filePath, margin, y, { maxWidth: 240 });
                    if (fullPath.length > filePath.length) {
                        doc.setFontSize(6);
                        doc.setTextColor(107, 114, 128);
                        doc.text(fullPath.substring(0, 80), margin, y + 8, { maxWidth: 240 });
                        doc.setFontSize(7);
                        doc.setTextColor(31, 41, 55);
                    }
                    doc.setTextColor(55, 65, 81);
                    doc.text(rule, margin + 250, y, { maxWidth: 90 });
                    doc.setTextColor(107, 114, 128);
                    doc.text(impact, margin + 350, y, { maxWidth: 160 });
                    y += 16;
                }
                if (items.length > maxItems) {
                    doc.setTextColor(107, 114, 128);
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(7);
                    doc.text(
                        '+ ' +
                            (items.length - maxItems) +
                            ' more ' +
                            SEVERITY_LABELS[sev].toLowerCase() +
                            ' findings (see full report)',
                        margin,
                        y + 4
                    );
                    y += 14;
                }
                y += 10;
            }
        }

        // === Section 5: Compliance Declaration ===
        if (y > pageHeight - 120) {
            doc.addPage();
            y = margin;
        }
        y += 10;
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(99, 102, 241);
        doc.roundedRect(margin, y, contentWidth, 80, 4, 4, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(99, 102, 241);
        doc.text('ZERO DATA CUSTODY DECLARATION', margin + 12, y + 16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(31, 41, 55);
        const declText =
            'This report was generated entirely in the browser. No source code, file contents, or scan results were transmitted to any server. All pattern matching, hash computation, and PDF generation executed locally in the browser sandbox. This report is suitable for internal compliance review, security audits, and executive reporting without requiring data processing agreements (DPA) or non-disclosure agreements (NDA).';
        const splitDecl = doc.splitTextToSize(declText, contentWidth - 24);
        doc.text(splitDecl, margin + 12, y + 30, { lineHeight: 11 });

        y += 95;

        // === Section 6: Footer ===
        if (y > pageHeight - 50) {
            doc.addPage();
            y = margin;
        }
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y, pageWidth - margin, y);
        y += 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        doc.text(COMPANY.name + ' · ' + COMPANY.website + ' · ' + COMPANY.email, margin, y);
        doc.text(
            'Report ID: ' + reportId + ' · Generated: ' + formattedDate + ' ' + formattedTime,
            pageWidth - margin,
            y,
            { align: 'right' }
        );
        y += 10;
        doc.text(
            'This report is generated from a browser-local scan and does not constitute a legal certification. For formal compliance certification, contact ' +
                COMPANY.email +
                '.',
            margin,
            y,
            { maxWidth: contentWidth }
        );

        // Page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            doc.text('Page ' + i + ' of ' + pageCount, pageWidth - margin, pageHeight - 20, { align: 'right' });
        }

        const blob = doc.output('blob');
        const filename = 'simplebeacon-compliance-report-' + scanDate.toISOString().slice(0, 10) + '.pdf';
        return { blob, filename, reportId };
    }

    // Expose globally
    window.ComplianceReportGenerator = { generateComplianceReport };
})();
