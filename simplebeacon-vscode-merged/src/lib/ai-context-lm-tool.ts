/**
 * Language Model Tool: agents invoke SimpleBeacon; JSON facts come back.
 * No-op when vscode.lm.registerTool is unavailable (older VS Code).
 */

import * as vscode from "vscode";
import {
  buildWorkspaceContextPayload,
  type WorkspaceContextInput,
} from "./ai-context-brief";

const TOOL_NAME = "simplebeacon_workspace_context";

type LmHost = {
  registerTool?: (name: string, tool: unknown) => vscode.Disposable;
  LanguageModelToolResult?: new (parts: unknown[]) => unknown;
  LanguageModelTextPart?: new (value: string) => unknown;
};

function jsonToolResult(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  const host = vscode as unknown as LmHost;
  if (host.LanguageModelToolResult && host.LanguageModelTextPart) {
    return new host.LanguageModelToolResult([
      new host.LanguageModelTextPart(json),
    ]);
  }
  return { content: [{ type: "text", value: json }] };
}

class SimpleBeaconWorkspaceTool {
  async prepareInvocation() {
    return {
      invocationMessage: "SimpleBeacon is analyzing workspace context",
      confirmationMessages: {
        title: "SimpleBeacon workspace context",
        message:
          "Return JSON facts: whether files and symbols exist, what this file imports, and which local files are relevant. No source is uploaded.",
      },
    };
  }

  async invoke(
    options: { input?: WorkspaceContextInput },
    _token?: vscode.CancellationToken,
  ) {
    const input = options.input || {};
    let document = vscode.window.activeTextEditor?.document;

    if (input.requestedFile) {
      const requested = vscode.Uri.file(input.requestedFile);
      try {
        document = await vscode.workspace.openTextDocument(requested);
      } catch {
        let fileExists = false;
        try {
          await vscode.workspace.fs.stat(requested);
          fileExists = true;
        } catch {
          fileExists = false;
        }
        return jsonToolResult(
          buildWorkspaceContextPayload({
            document: null,
            input,
            fileExists,
          }),
        );
      }
    }

    if (!document) {
      return jsonToolResult(
        buildWorkspaceContextPayload({ document: null, input }),
      );
    }

    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const payload = buildWorkspaceContextPayload({
      document,
      workspaceRoot: folder ? folder.uri.fsPath : null,
      input,
      lineCount: document.lineCount,
    });

    return jsonToolResult(payload);
  }
}

export function registerSimpleBeaconLmTools(
  context: vscode.ExtensionContext,
): void {
  const host = vscode as unknown as { lm?: LmHost };
  if (typeof host.lm?.registerTool !== "function") {
    console.log(
      "[SimpleBeacon] vscode.lm.registerTool unavailable — simplebeacon_workspace_context not registered",
    );
    return;
  }
  context.subscriptions.push(
    host.lm.registerTool(TOOL_NAME, new SimpleBeaconWorkspaceTool()),
  );
  console.log("[SimpleBeacon] simplebeacon_workspace_context registered");
}
