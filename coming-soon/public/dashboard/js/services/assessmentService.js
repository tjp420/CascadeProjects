import { authService } from './authService.js';
import { readJsonResponseBody, logRecoverableDashboardError } from '../lib/recoverable-fetch.js';

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
  } catch (parseError) {
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
    const res = await fetch('/api/assessment/scan', {
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
    const res = await fetch(`/api/assessment/report/${encodeURIComponent(assessmentId)}`, {
      headers: authService.getAuthHeaders()
    });
    const reportPayload = await readJsonResponseBody(res, {});
    if (!res.ok) {
      throw new Error(reportPayload.error || `Report not found (${res.status})`);
    }
    return reportPayload;
  }

  downloadUrl(assessmentId) {
    return `/api/assessment/report/${encodeURIComponent(assessmentId)}/download/json`;
  }
}

/**
 * Assessment service.
 */
export const assessmentService = new AssessmentService();
