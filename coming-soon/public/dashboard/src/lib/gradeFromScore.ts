const PASSING_GRADES = ['A+', 'A', 'A-', 'B+', 'B'] as const;

/**
 * Maps a 0–100 quality score to a letter grade aligned with CLI report tiers.
 */
export function qualityScoreToLetterGrade(score: number | null | undefined): string {
    if (score == null || Number.isNaN(Number(score))) return '—';
    const s = Math.max(0, Math.min(100, Math.round(Number(score))));
    if (s >= 97) return 'A+';
    if (s >= 93) return 'A';
    if (s >= 90) return 'A-';
    if (s >= 87) return 'B+';
    if (s >= 83) return 'B';
    if (s >= 80) return 'B-';
    if (s >= 77) return 'C+';
    if (s >= 73) return 'C';
    if (s >= 70) return 'C-';
    if (s >= 67) return 'D+';
    if (s >= 63) return 'D';
    if (s >= 60) return 'D-';
    return 'F';
}

export function isPassingReferralGrade(grade: string | null | undefined): boolean {
    if (!grade) return false;
    return (PASSING_GRADES as readonly string[]).includes(grade);
}

export function resolveScanLetterGrade(
    qualityScore: number | null | undefined,
    fullReport?: { letterGrade?: string; letter_grade?: string } | null
): string {
    const fromReport = fullReport?.letterGrade || fullReport?.letter_grade;
    if (fromReport && typeof fromReport === 'string') return fromReport;
    return qualityScoreToLetterGrade(qualityScore);
}
