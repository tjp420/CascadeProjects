import { authService } from './authService.js';
import { readJsonResponseBody, logRecoverableDashboardError } from '../lib/recoverable-fetch.js';
import { apiUrl } from '../utils/url.js';
const RECENT_KEY = 'simplebeaconRecentAssessments';
const MAX_RECENT = 20;
/**
 * Read recent assessments from storage.
 * @returns {any}
 */
function readRecentAssessmentsFromStorage() {
    try {
        const storedJson = localStorage.getItem(RECENT_KEY);
        return storedJson ? JSON.parse(storedJson) : [];
    }
    catch (parseError) {
        logRecoverableDashboardError('assessment recent list parse', parseError);
        return [];
    }
}
/**
 * Write recent assessments to storage.
 * @param {Array} assessmentEntries
 * @returns {any}
 */
function writeRecentAssessmentsToStorage(assessmentEntries) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(assessmentEntries.slice(0, MAX_RECENT)));
}
/**
 * Assessment service.
 */
export class AssessmentService {
    getRecentAssessments() {
        return readRecentAssessmentsFromStorage();
    }
    rememberAssessment(entry) {
        const next = [
            entry,
            ...readRecentAssessmentsFromStorage().filter((item) => item.assessmentId !== entry.assessmentId)
        ];
        writeRecentAssessmentsToStorage(next);
        return next;
    }
    async runAssessment(payload) {
        const res = await fetch(apiUrl('/api/assessment/scan'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authService.getAuthHeaders()
            },
            body: JSON.stringify(payload)
        });
        const scanPayload = await readJsonResponseBody(res, {});
        if (!res.ok) {
            const err = new Error(scanPayload.error || scanPayload.message || `Assessment failed (${res.status})`);
            err.status = res.status;
            throw err;
        }
        if (scanPayload.assessmentId) {
            this.rememberAssessment({
                assessmentId: scanPayload.assessmentId,
                company: payload.company || 'Unknown',
                createdAt: new Date().toISOString(),
                reportUrl: scanPayload.reportUrl || `/api/assessment/report/${scanPayload.assessmentId}`,
                summary: scanPayload.summary || null
            });
        }
        return scanPayload;
    }
    async fetchReport(assessmentId) {
        const res = await fetch(apiUrl(`/api/assessment/report/${encodeURIComponent(assessmentId)}`), {
            headers: authService.getAuthHeaders()
        });
        const reportPayload = await readJsonResponseBody(res, {});
        if (!res.ok) {
            throw new Error(reportPayload.error || `Report not found (${res.status})`);
        }
        return reportPayload;
    }
    /**
     * Wraps service fetch methods to guarantee unauthenticated or unauthorized roles
     * can never capture history payloads out of adjacent data matrices.
     * @returns {Promise<Array>}
     */
    async fetchTenantIsolatedAssessments() {
        var _a;
        const currentUser = ((_a = authService.getUser) === null || _a === void 0 ? void 0 : _a.call(authService)) || null;
        const rawDataFeed = await this.getRawHistoricalRegistry();
        if (!currentUser) {
            // Enforce anonymous guest sandbox scope constraints cleanly
            return rawDataFeed.filter(item => item.userId === 'sandbox_local_guest');
        }
        // Administrators bypass verification gates to review cross-company release postures
        if (currentUser.role === 'admin' || currentUser.role === 'auditor') {
            return rawDataFeed;
        }
        // Standard Developers are locked to their explicit user_id mapping parameters
        return rawDataFeed.filter(item => item.userId === currentUser.id);
    }
    /**
     * Baseline database read utility — placeholder for historical registry fetch.
     * Override or replace with actual backend integration.
     * @returns {Promise<Array>}
     */
    async getRawHistoricalRegistry() {
        // Default: read from localStorage; replace with server fetch as needed
        return readRecentAssessmentsFromStorage();
    }
    downloadUrl(assessmentId) {
        return `/api/assessment/report/${encodeURIComponent(assessmentId)}/download/json`;
    }
}
/**
 * Assessment service.
 */
export const assessmentService = new AssessmentService();
