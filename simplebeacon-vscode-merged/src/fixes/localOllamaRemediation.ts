// simplebeacon-ignore: security — local remediation prompt data is user-selected code, not a secret
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getSbConfig } from '../utils/vscode';
import { buildRemediationPrompt as buildRemediationPromptText } from './localRemediationText';

export interface DiagnosticRemediationRequest {
  uri: vscode.Uri;
  range: vscode.Range;
  diagnosticCode: string;
  diagnosticMessage: string;
  snippet: string;
}

function getOllamaConfig(): { url: string; model: string } {
  const config = getSbConfig();
  return {
    url: config.get<string>('ollamaUrl') || process.env.OLLAMA_BASE_URL || process.env.LOCAL_AI_URL || 'http://localhost:11434',
    model: config.get<string>('ollamaModel') || process.env.AGENT_MODEL || 'llama3.2:latest'
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

export async function remediateDiagnosticWithLocalOllama(request: DiagnosticRemediationRequest): Promise<string> {
  const { url, model } = getOllamaConfig();
  const outputChannel = vscode.window.createOutputChannel('SimpleBeacon Remediation');
  const prompt = buildRemediationPrompt(request);

  outputChannel.show(true);
  outputChannel.appendLine(`[SimpleBeacon] Sending ${request.diagnosticCode} from ${path.basename(request.uri.fsPath || request.uri.path || 'untitled')} to local Ollama (${model})...`);

  const response = await fetch(`${url.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.0 }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as { response?: string };
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
