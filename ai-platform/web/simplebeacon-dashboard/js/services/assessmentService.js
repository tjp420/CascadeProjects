import { authService } from './authService.js';

const RECENT_KEY = 'simplebeaconRecentAssessments';
const MAX_RECENT = 20;

function readRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRecent(entries) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
}

export class AssessmentService {
  getRecentAssessments() {
    return readRecent();
  }

  rememberAssessment(entry) {
    const next = [
      entry,
      ...readRecent().filter((item) => item.assessmentId !== entry.assessmentId)
    ];
    writeRecent(next);
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

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.message || `Assessment failed (${res.status})`);
      err.status = res.status;
      throw err;
    }

    if (data.assessmentId) {
      this.rememberAssessment({
        assessmentId: data.assessmentId,
        company: payload.company || 'Unknown',
        createdAt: new Date().toISOString(),
        reportUrl: data.reportUrl || `/api/assessment/report/${data.assessmentId}`,
        summary: data.summary || null
      });
    }

    return data;
  }

  async fetchReport(assessmentId) {
    const res = await fetch(`/api/assessment/report/${encodeURIComponent(assessmentId)}`, {
      headers: authService.getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Report not found (${res.status})`);
    }
    return data;
  }

  downloadUrl(assessmentId) {
    return `/api/assessment/report/${encodeURIComponent(assessmentId)}/download/json`;
  }
}

export const assessmentService = new AssessmentService();
