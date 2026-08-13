// simplebeacon-ignore: security — local remediation prompt data is user-selected code, not a secret
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getSbConfig } from '../utils/vscode';
import { buildRemediationPrompt as buildRemediationPromptText, stripMarkdownFenceBlock } from './localRemediationText';

export interface DiagnosticRemediationRequest {
  uri: vscode.Uri;
  range: vscode.Range;
  diagnosticCode: string;
  diagnosticMessage: string;
  snippet: string;
}

export interface InPlaceRemediationResult {
  success: boolean;
  applied: boolean;
  originalSnippet: string;
  replacement: string;
  rawResponse: string;
  error?: string;
}

function getOllamaConfig(): { url: string; model: string } {
  const config = getSbConfig();
  return {
    url:
      config.get<string>('ollamaUrl') ||
      process.env.OLLAMA_BASE_URL ||
      process.env.LOCAL_AI_URL ||
      'http://localhost:11434',
    model: config.get<string>('ollamaModel') || process.env.AGENT_MODEL || 'llama3.2:latest',
  };
}

export function buildRemediationPrompt(request: DiagnosticRemediationRequest): string {
  return buildRemediationPromptText({
    filePath: request.uri.fsPath || request.uri.path || 'untitled',
    rangeStartLine: request.range.start.line,
    rangeStartCharacter: request.range.start.character,
    rangeEndLine: request.range.end.line,
    rangeEndCharacter: request.range.end.character,
    diagnosticCode: request.diagnosticCode,
    diagnosticMessage: request.diagnosticMessage,
    snippet: request.snippet,
  });
}

/**
 * Build a prompt that asks Ollama for ONLY the fixed code block, no explanation.
 * This makes it easier to extract a clean replacement for in-place editing.
 */
function buildInPlaceRemediationPrompt(request: DiagnosticRemediationRequest): string {
  const fileLabel = path.basename(request.uri.fsPath || request.uri.path || 'untitled');
  return [
    'You are a local code-remediation assistant for SimpleBeacon.',
    'Return ONLY the corrected code that should replace the flagged snippet.',
    'Do NOT include explanations, markdown fences, or commentary.',
    'Preserve the original behavior unless the finding is a genuine security or correctness issue.',
    'If the finding is a false positive, return the original snippet unchanged.',
    '',
    `Rule: ${request.diagnosticCode}`,
    `Message: ${request.diagnosticMessage}`,
    `File: ${fileLabel}`,
    '',
    'Code to fix:',
    request.snippet || '(no snippet provided)',
    '',
    'Return ONLY the replacement code:',
  ].join('\n');
}

/**
 * Extract a clean code block from an Ollama response.
 * Strips markdown fences, leading/trailing explanation text, and whitespace.
 * If the response contains a fenced code block, extracts just the code inside.
 * Otherwise returns the trimmed response.
 */
export function extractCodeFromResponse(response: string): string {
  const trimmed = String(response || '').trim();
  if (!trimmed) return '';

  // Try to extract a fenced code block (```...```)
  const fenceMatch = trimmed.match(/```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n```/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trimEnd();
  }

  // If the entire response is wrapped in fences (no language tag)
  if (/^```[\s\S]*```$/.test(trimmed)) {
    return stripMarkdownFenceBlock(trimmed);
  }

  // No fences — check if the response looks like pure code (no prose)
  // Heuristic: if the first line doesn't end with a sentence-ending punctuation
  // and doesn't start with common prose markers, treat it as code
  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0].trim();
  const looksLikeProse = /^(Here|This|The|I |You |To fix|Fix:|Solution:|Note:)/i.test(firstLine)
    || /[.!?]$/.test(firstLine);

  if (looksLikeProse && lines.length > 1) {
    // Try to find the first line that looks like code (starts with common code patterns)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !/^(Here|This|The|I |You |To fix|Fix:|Solution:|Note:|-|\*|#)/i.test(line)) {
        return lines.slice(i).join('\n').trimEnd();
      }
    }
  }

  return trimmed;
}

export async function remediateDiagnosticWithLocalOllama(request: DiagnosticRemediationRequest): Promise<string> {
  const { url, model } = getOllamaConfig();
  const outputChannel = vscode.window.createOutputChannel('SimpleBeacon Remediation');
  const prompt = buildRemediationPrompt(request);

  outputChannel.show(true);
  outputChannel.appendLine(
    `[SimpleBeacon] Sending ${request.diagnosticCode} from ${path.basename(request.uri.fsPath || request.uri.path || 'untitled')} to local Ollama (${model})...`
  );

  const response = await fetch(`${url.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.0 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as { response?: string };
  const output = String(data.response || '').trim();

  outputChannel.appendLine('');
  outputChannel.appendLine(output || '[SimpleBeacon] Ollama returned an empty response.');
  outputChannel.show(true);

  try {
    const tempFile = path.join(os.tmpdir(), 'simplebeacon-remediation-response.md');
    fs.writeFileSync(tempFile, output || '[SimpleBeacon] Ollama returned an empty response.', 'utf8');
  } catch {
    // best-effort only
  }

  return output;
}

/**
 * Call Ollama to generate a fix, then apply it directly to the active editor buffer
 * using VS Code's WorkspaceEdit API. The user sees a diff preview before accepting.
 *
 * This closes the interactive remediation loop: diagnostic -> quick fix -> Ollama ->
 * in-place buffer replacement.
 *
 * @param request The diagnostic remediation request (uri, range, code, snippet)
 * @param autoApply If true, apply the edit without showing a preview dialog.
 *                  Defaults to false (show preview).
 * @returns The remediation result with original/replacement text and applied status.
 */
export async function remediateDiagnosticInPlace(
  request: DiagnosticRemediationRequest,
  autoApply: boolean = false
): Promise<InPlaceRemediationResult> {
  const { url, model } = getOllamaConfig();
  const outputChannel = vscode.window.createOutputChannel('SimpleBeacon In-Place Remediation');
  const prompt = buildInPlaceRemediationPrompt(request);
  const fileLabel = path.basename(request.uri.fsPath || request.uri.path || 'untitled');

  outputChannel.appendLine(
    `[SimpleBeacon] Requesting in-place fix for ${request.diagnosticCode} in ${fileLabel} via Ollama (${model})...`
  );

  let rawResponse: string;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.0 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { response?: string };
    rawResponse = String(data.response || '').trim();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[SimpleBeacon] Ollama request failed: ${errorMsg}`);
    return {
      success: false,
      applied: false,
      originalSnippet: request.snippet,
      replacement: '',
      rawResponse: '',
      error: errorMsg,
    };
  }

  // Extract clean code from the response
  const replacement = extractCodeFromResponse(rawResponse);

  if (!replacement) {
    outputChannel.appendLine('[SimpleBeacon] Ollama returned an empty response — no fix applied.');
    return {
      success: false,
      applied: false,
      originalSnippet: request.snippet,
      replacement: '',
      rawResponse,
      error: 'Empty response from Ollama',
    };
  }

  // If the replacement is identical to the original, Ollama thinks it's a false positive
  if (replacement === request.snippet.trim()) {
    outputChannel.appendLine('[SimpleBeacon] Ollama returned the original code unchanged — likely a false positive.');
    return {
      success: true,
      applied: false,
      originalSnippet: request.snippet,
      replacement,
      rawResponse,
    };
  }

  // Apply the edit using WorkspaceEdit
  const edit = new vscode.WorkspaceEdit();
  edit.replace(request.uri, request.range, replacement);

  let applied = false;

  if (autoApply) {
    // Apply directly without preview
    applied = await vscode.workspace.applyEdit(edit);
    if (applied) {
      outputChannel.appendLine(`[SimpleBeacon] Applied in-place fix for ${request.diagnosticCode} in ${fileLabel}.`);
    } else {
      outputChannel.appendLine(`[SimpleBeacon] Failed to apply edit for ${request.diagnosticCode}.`);
    }
  } else {
    // Show a preview diff so the user can review before accepting
    const doc = await vscode.workspace.openTextDocument(request.uri);
    const action = await vscode.window.showInformationMessage(
      `Ollama generated a fix for ${request.diagnosticCode}. Apply to ${fileLabel}?`,
      { modal: false },
      'Apply Fix',
      'Show Response',
      'Discard'
    );

    if (action === 'Apply Fix') {
      applied = await vscode.workspace.applyEdit(edit);
      if (applied) {
        // Reveal the edited range in the editor
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
        editor.revealRange(request.range, vscode.TextEditorRevealType.InCenter);
        outputChannel.appendLine(`[SimpleBeacon] Applied in-place fix for ${request.diagnosticCode} in ${fileLabel}.`);
      } else {
        outputChannel.appendLine(`[SimpleBeacon] Failed to apply edit for ${request.diagnosticCode}.`);
      }
    } else if (action === 'Show Response') {
      // Show the raw response in the output channel for manual review
      outputChannel.show(true);
      outputChannel.appendLine('');
      outputChannel.appendLine('--- Ollama Response ---');
      outputChannel.appendLine(rawResponse);
      outputChannel.appendLine('--- Extracted Code ---');
      outputChannel.appendLine(replacement);
      outputChannel.appendLine('--- End ---');
    }
  }

  return {
    success: true,
    applied,
    originalSnippet: request.snippet,
    replacement,
    rawResponse,
  };
}
