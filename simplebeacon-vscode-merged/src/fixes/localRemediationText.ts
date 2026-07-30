import * as path from 'path';

export interface DiagnosticRemediationTextRequest {
  filePath: string;
  rangeStartLine: number;
  rangeStartCharacter: number;
  rangeEndLine: number;
  rangeEndCharacter: number;
  diagnosticCode: string;
  diagnosticMessage: string;
  snippet: string;
}

export function stripMarkdownFenceBlock(block: string): string {
  const lines = String(block || '').split(/\r?\n/);
  if (lines.length >= 3 && /^```/.test(lines[0]) && /^```\s*$/.test(lines[lines.length - 1])) {
    return lines.slice(1, -1).join('\n').trimEnd();
  }

  return String(block || '')
    .replace(/^```[a-zA-Z]*\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .trimEnd();
}

export function buildRemediationPrompt(request: DiagnosticRemediationTextRequest): string {
  const fileLabel = path.basename(request.filePath || 'untitled');
  return [
    'You are a local code-remediation assistant for SimpleBeacon.',
    'Return a concise, safe remediation suggestion that preserves the current behavior unless the finding is truly unsafe.',
    '',
    `Rule: ${request.diagnosticCode}`,
    `Message: ${request.diagnosticMessage}`,
    `File: ${fileLabel}`,
    `Range: ${request.rangeStartLine + 1}:${request.rangeStartCharacter + 1} - ${request.rangeEndLine + 1}:${request.rangeEndCharacter + 1}`,
    '',
    'Snippet:',
    request.snippet || '(no snippet provided)',
    '',
    'Output format:',
    '- A short explanation',
    '- A minimal safe edit proposal',
    '- If the finding is a false positive, say so explicitly',
  ].join('\n');
}
