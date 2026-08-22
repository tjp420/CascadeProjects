/**
 * Shared types for the AI Slop Cop real-time monitoring system.
 * Extracted to break circular dependencies between realtimeMonitor.ts
 * and the classifier/customRule modules.
 */

import { FileRole } from './classifiers/fileRoleClassifier';

export interface RealtimeIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  suggestion?: string;
  timestamp: Date;
  /** File role classification (Milestone 1) — undefined for issues created before classification */
  fileRole?: FileRole;
  /** Whether this finding was severity-calibrated (downshifted from its original severity) */
  calibrated?: boolean;
}
