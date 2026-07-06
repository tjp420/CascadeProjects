import { apiUrl } from '../utils.js';
import { authService } from './authService.js';

const EARNINGS_KEY = 'simplebeacon_monetization_earnings';
const SETTINGS_KEY = 'simplebeacon_monetization_settings';
const PLATFORM_FEE_PCT = 0.20;

function readEarnings() {
    try {
        const raw = localStorage.getItem(EARNINGS_KEY);
        return raw ? JSON.parse(raw) : { totalEarned: 0, totalAssessments: 0, history: [] };
    } catch {
        return { totalEarned: 0, totalAssessments: 0, history: [] };
    }
}

function writeEarnings(data) {
    localStorage.setItem(EARNINGS_KEY, JSON.stringify(data));
}

function readSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? JSON.parse(raw) : { whiteLabel: false, auditorName: '', auditorEmail: '', hourlyRate: 0 };
    } catch {
        return { whiteLabel: false, auditorName: '', auditorEmail: '', hourlyRate: 0 };
    }
}

function writeSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function formatCurrency(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function generateInvoiceNumber() {
    const date = new Date();
    const prefix = 'SB-' + date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return prefix + '-' + random;
}

/**
 * Monetization service for agency/auditor earnings.
 */
export class MonetizationService {
    constructor() {
        this.earnings = readEarnings();
        this.settings = readSettings();
    }

    getSettings() {
        return { ...this.settings };
    }

    updateSettings(partial) {
        this.settings = { ...this.settings, ...partial };
        writeSettings(this.settings);
        return this.settings;
    }

    getEarnings() {
        return { ...this.earnings };
    }

    /**
     * Record a paid assessment.
     * @param {{assessmentId:string, clientName:string, clientEmail:string, amountCents:number}} entry
     */
    recordAssessment(entry) {
        const platformFee = Math.round(entry.amountCents * PLATFORM_FEE_PCT);
        const netEarnings = entry.amountCents - platformFee;
        const record = {
            id: generateInvoiceNumber(),
            assessmentId: entry.assessmentId,
            clientName: entry.clientName,
            clientEmail: entry.clientEmail,
            grossAmount: entry.amountCents,
            platformFee,
            netEarnings,
            createdAt: new Date().toISOString()
        };
        this.earnings.history.unshift(record);
        this.earnings.totalEarned += netEarnings;
        this.earnings.totalAssessments += 1;
        writeEarnings(this.earnings);
        return record;
    }

    /**
     * Generate a plain-text invoice.
     * @param {{assessmentId:string, clientName:string, clientEmail:string, amountCents:number, lineItems?:Array<{label:string,amountCents:number}>}} params
     * @returns {string} Invoice text content
     */
    generateInvoiceText(params) {
        const settings = this.settings;
        const user = authService.getUser?.() || {};
        const auditorName = settings.auditorName || user.name || user.email || 'Independent Auditor';
        const auditorEmail = settings.auditorEmail || user.email || '';
        const invoiceNum = generateInvoiceNumber();
        const date = new Date().toLocaleDateString();
        const subtotal = params.amountCents;
        const platformFee = Math.round(subtotal * PLATFORM_FEE_PCT);
        const total = subtotal;

        let lines = [];
        lines.push('INVOICE');
        lines.push('');
        lines.push('Invoice #: ' + invoiceNum);
        lines.push('Date: ' + date);
        lines.push('');
        lines.push('From:');
        lines.push('  ' + auditorName);
        if (auditorEmail) lines.push('  ' + auditorEmail);
        lines.push('  via SimpleBeacon Assessment Platform');
        lines.push('');
        lines.push('Bill To:');
        lines.push('  ' + (params.clientName || 'Client'));
        if (params.clientEmail) lines.push('  ' + params.clientEmail);
        lines.push('');
        lines.push('Description of Services:');
        lines.push('  Security & Compliance Assessment');
        lines.push('  Assessment ID: ' + (params.assessmentId || 'N/A'));
        lines.push('');
        lines.push('Line Items:');
        if (params.lineItems && params.lineItems.length) {
            params.lineItems.forEach(item => {
                lines.push('  ' + item.label + ' .............. ' + formatCurrency(item.amountCents));
            });
        } else {
            lines.push('  Assessment Fee .............. ' + formatCurrency(subtotal));
        }
        lines.push('');
        lines.push('Subtotal: ' + formatCurrency(subtotal));
        lines.push('Platform Fee (20%): ' + formatCurrency(platformFee));
        lines.push('');
        lines.push('Total Amount Due: ' + formatCurrency(total));
        lines.push('');
        lines.push('Payment is due within 30 days of invoice date.');
        lines.push('Thank you for your business.');

        return lines.join('\n');
    }

    downloadInvoice(params, filename) {
        const text = this.generateInvoiceText(params);
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'invoice.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    isWhiteLabelEnabled() {
        return Boolean(this.settings.whiteLabel);
    }
}

export const monetizationService = new MonetizationService();
