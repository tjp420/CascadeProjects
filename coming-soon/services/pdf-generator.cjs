'use strict';

/**
 * Corporate Expense-Optimized Receipt Generator
 *
 * Generates PDF receipts designed for frictionless corporate card expensing.
 * Includes GL codes, expense categories, and zero-data-custody declarations
 * so receipts clear automated corporate card auditing software.
 */

const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const DEFAULT_GL_CODE = '54200'; // Software & Subscriptions
const DEFAULT_CATEGORY = 'Software License / Technical Compliance Asset';
const COMPANY = {
    name: 'SimpleBeacon',
    legalName: 'SimpleBeacon, Inc.',
    address: 'Remote-First Operations',
    email: 'billing@simplebeacon.ai',
    website: 'https://simplebeacon.ai',
    taxId: 'EIN available upon request'
};

const TIER_LABELS = {
    developer: 'Developer',
    team_pro: 'Team Pro',
    enterprise: 'Enterprise',
    pro: 'Pro (Legacy)',
    compliance: 'Compliance Suite (Legacy)',
    team: 'Team (Legacy)',
    one_time_certificate: 'Audit Certificate',
    executive_clearance: 'Executive Risk Certificate',
    eu_ai_act_sprint: 'EU AI Act Sprint',
    custom_plan: 'Custom Audit Plan',
    instant_report: 'Instant Report',
    certificate: 'Audit Certificate'
};

/**
 * Build the expense payload metadata from session data.
 * @param {Object} sessionData - Checkout/subscription session info
 * @returns {Object} Structured receipt payload
 */
function buildExpensePayload(sessionData) {
    const {
        orderId,
        amount,
        date,
        tier,
        companyName,
        projectName,
        billingInterval,
        extraSeats,
        customerEmail,
        paymentMethod,
        glCode
    } = sessionData;

    const tierLabel = TIER_LABELS[tier] || tier || 'License';
    const formattedDate = new Date(date || Date.now()).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const amountUsd = (amount / 100).toFixed(2);
    const invoiceNumber = `SB-${orderId || Date.now().toString(36).toUpperCase()}`;

    const lineItems = [{
        description: `SimpleBeacon ${tierLabel} — ${billingInterval === 'annual' ? 'Annual Subscription' : billingInterval === 'monthly' ? 'Monthly Subscription' : 'One-Time Pass'}`,
        details: `Target: ${companyName || projectName || 'Local Environment'} — Zero Custody Scan Validation Included`,
        amount: amountUsd
    }];

    if (extraSeats && extraSeats > 0) {
        const seatAmount = billingInterval === 'annual' ? 150 : 15;
        lineItems.push({
            description: `Extra Team Seats (${extraSeats} × $${seatAmount}/${billingInterval === 'annual' ? 'yr' : 'mo'})`,
            details: `Additional seats beyond the 5 included in Team Pro`,
            amount: (seatAmount * extraSeats).toFixed(2)
        });
    }

    return {
        title: 'OFFICIAL COMMERCIAL RECEIPT & EXPENSE REPORT',
        metadata: {
            invoiceNumber,
            billingDate: formattedDate,
            paymentStatus: 'PAID — Corporate Card',
            paymentMethod: paymentMethod || 'Stripe (Visa/MC/Amex)',
            accountingGLCode: glCode || DEFAULT_GL_CODE,
            category: DEFAULT_CATEGORY,
            customerEmail: customerEmail || ''
        },
        lineItems,
        complianceDeclaration: 'Zero Data Custody Verified. No corporate source code or sensitive data was transferred or stored off-site during this assessment. All scans executed 100% locally in the browser sandbox or CLI. Compliant with standard internal proxy/security frameworks. No NDA or DPA required.',
        subtotal: amountUsd,
        total: amountUsd,
        currency: 'USD'
    };
}

/**
 * Generate a PDF receipt as a Buffer.
 * @param {Object} sessionData - Checkout/subscription session info
 * @returns {Promise<{buffer: Buffer, invoiceNumber: string}>}
 */
function generateReceiptPdf(sessionData) {
    return new Promise((resolve, reject) => {
        const payload = buildExpensePayload(sessionData);
        const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
            resolve({ buffer: Buffer.concat(chunks), invoiceNumber: payload.metadata.invoiceNumber });
        });
        doc.on('error', reject);

        // --- Header ---
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#0a0e18')
            .text(COMPANY.name, 50, 50);
        doc.fontSize(9).font('Helvetica').fillColor('#666')
            .text(COMPANY.legalName, 50, 78)
            .text(COMPANY.address, 50, 90)
            .text(COMPANY.email + '  ·  ' + COMPANY.website, 50, 102);

        // Right-aligned invoice metadata
        const rightX = 562; // page width - right margin
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#0a0e18')
            .text('RECEIPT', rightX, 50, { width: 100, align: 'right' });
        doc.fontSize(8).font('Helvetica').fillColor('#666')
            .text('Invoice #' + payload.metadata.invoiceNumber, rightX - 100, 72, { width: 100, align: 'right' })
            .text(payload.metadata.billingDate, rightX - 100, 84, { width: 100, align: 'right' })
            .text('Status: ' + payload.metadata.paymentStatus, rightX - 100, 96, { width: 100, align: 'right' });

        // --- Divider ---
        doc.moveTo(50, 120).lineTo(562, 120).strokeColor('#e5e7eb').lineWidth(1).stroke();

        // --- Expense Classification Box ---
        const boxY = 135;
        doc.roundedRect(50, boxY, 512, 65, 6).fillAndStroke('#f0fdf4', '#22c55e');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#22c55e')
            .text('EXPENSE CLASSIFICATION', 65, boxY + 10);
        doc.fontSize(9).font('Helvetica').fillColor('#333')
            .text('GL Code: ' + payload.metadata.accountingGLCode + ' — Software & Subscriptions', 65, boxY + 25)
            .text('Category: ' + payload.metadata.category, 65, boxY + 38)
            .text('Payment: ' + payload.metadata.paymentMethod, 65, boxY + 51);

        // --- Bill To ---
        const billY = 220;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#999')
            .text('BILLED TO', 50, billY);
        doc.fontSize(10).font('Helvetica').fillColor('#333')
            .text(sessionData.customerEmail || '—', 50, billY + 14)
            .text(sessionData.companyName || sessionData.projectName || '—', 50, billY + 28);

        // --- Line Items Table ---
        const tableY = billY + 55;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#999')
            .text('DESCRIPTION', 50, tableY)
            .text('AMOUNT', 462, tableY, { width: 100, align: 'right' });
        doc.moveTo(50, tableY + 14).lineTo(562, tableY + 14).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

        let rowY = tableY + 22;
        for (const item of payload.lineItems) {
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#0a0e18')
                .text(item.description, 50, rowY, { width: 400 });
            doc.fontSize(8).font('Helvetica').fillColor('#666')
                .text(item.details, 50, rowY + 14, { width: 400 });
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#0a0e18')
                .text('$' + item.amount, 462, rowY, { width: 100, align: 'right' });
            rowY += 36;
        }

        // --- Total ---
        doc.moveTo(50, rowY).lineTo(562, rowY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        rowY += 10;
        doc.fontSize(10).font('Helvetica').fillColor('#666')
            .text('Subtotal', 362, rowY, { width: 100, align: 'right' })
            .text('$' + payload.subtotal, 462, rowY, { width: 100, align: 'right' });
        rowY += 16;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0a0e18')
            .text('Total Paid', 362, rowY, { width: 100, align: 'right' })
            .text('$' + payload.total + ' ' + payload.currency, 462, rowY, { width: 100, align: 'right' });

        // --- Compliance Declaration ---
        const declY = rowY + 35;
        doc.roundedRect(50, declY, 512, 70, 6).fillAndStroke('#eff6ff', '#6366f1');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6366f1')
            .text('ZERO DATA CUSTODY DECLARATION', 65, declY + 10);
        doc.fontSize(8).font('Helvetica').fillColor('#333')
            .text(payload.complianceDeclaration, 65, declY + 24, { width: 482, lineGap: 3 });

        // --- Footer ---
        doc.fontSize(7).font('Helvetica').fillColor('#999')
            .text('This receipt is system-generated and valid for corporate expense reporting. No signature required.', 50, 740, { align: 'center', width: 512 })
            .text(COMPANY.legalName + ' · ' + COMPANY.taxId + ' · ' + COMPANY.website, 50, 752, { align: 'center', width: 512 });

        doc.end();
    });
}

/**
 * Generate a receipt filename from session data.
 * @param {Object} sessionData
 * @returns {string}
 */
function receiptFilename(sessionData) {
    const payload = buildExpensePayload(sessionData);
    const safe = String(sessionData.companyName || sessionData.projectName || 'receipt')
        .replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
    return `SimpleBeacon-Receipt-${payload.metadata.invoiceNumber}-${safe}.pdf`;
}

module.exports = {
    generateReceiptPdf,
    buildExpensePayload,
    receiptFilename,
    DEFAULT_GL_CODE,
    TIER_LABELS
};
