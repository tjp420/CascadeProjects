# SimpleBeacon Behavioral Telemetry Engine — Technical Specification

> **Version:** 1.0  
> **Status:** Draft  
> **Owner:** Core Engineering  
> **Last Updated:** June 20, 2026

---

## 1. Overview

The Behavioral Telemetry Engine detects **how code arrived in the editor** — not just what the code is. This is SimpleBeacon's primary moat against GitHub/GitLab: we see the *behavioral context* of code insertion (paste velocity, keystroke patterns, burst timing) that static repo scanners cannot access.

---

## 2. Goals

| ID | Goal | Priority |
|----|------|----------|
| G1 | Detect large paste events (>50 lines in <2 seconds) with high confidence | P0 |
| G2 | Correlate paste events with AI-generated code patterns in scan findings | P0 |
| G3 | Flag files where >60% of content was inserted via paste vs. keystrokes | P1 |
| G4 | Store telemetry locally only — no cloud transmission | P0 |
| G5 | Zero perceptible IDE performance impact (<1ms per keystroke) | P0 |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension Host                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ TextDocument │  │ Keylogger    │  │ Paste Detector     │  │
│  │ Change Event │  │ (Decoration) │  │ (Clipboard + Diff) │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘  │
│         │                  │                    │             │
│         └──────────────────┼────────────────────┘             │
│                            ▼                                  │
│                   ┌──────────────────┐                         │
│                   │ Event Router   │                         │
│                   │ (Deduplicate)  │                         │
│                   └────────┬─────────┘                         │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         ▼                  ▼                  ▼              │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Local DB   │    │ Sidebar UI   │    │ Scan         │     │
│  │ (SQLite)   │    │ (Indicators) │    │ Correlator   │     │
│  └────────────┘    └──────────────┘    └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Components

### 4.1 TextDocument Change Listener

**Location:** `src/telemetry/documentTracker.ts` (new file)

**API:**
```typescript
interface TextChangeEvent {
  timestamp: number;        // Unix ms
  documentUri: string;    // file://...
  range: vscode.Range;     // start/end position
  text: string;           // inserted text
  textLength: number;     // chars inserted
  lineCount: number;      // lines inserted
  source: 'keyboard' | 'paste' | 'undo' | 'redo' | 'unknown';
}
```

**Detection Logic:**
```typescript
function classifySource(
  event: vscode.TextDocumentChangeEvent,
  prevTimestamp: number
): ChangeSource {
  const change = event.contentChanges[0];
  
  // Paste detection heuristics
  if (change.text.length > 200 && 
      change.text.includes('\n') && 
      event.timestamp - prevTimestamp < 50) {
    return 'paste';
  }
  
  // Undo/redo detection
  if (isUndoRedoInProgress()) return 'undo'; // VS Code has internal flag
  
  // Default
  return 'keyboard';
}
```

### 4.2 Keystroke Timing Buffer

**Location:** `src/telemetry/keystrokeBuffer.ts`

**Storage:** Circular buffer (max 10,000 events per file) in memory.
**Flush:** Every 30s to SQLite, or on document close.

```typescript
interface KeystrokeEvent {
  timestamp: number;
  char: string | null;     // null for paste
  delay: number;           // ms since previous keystroke
  isPaste: boolean;
  pasteSize: number;       // lines if paste, else 0
}
```

### 4.3 Paste Detector

**Heuristic Matrix:**

| Signal | Weight | Threshold |
|--------|--------|-----------|
| Insertion speed (>500 chars in <100ms) | 0.4 | Must exceed |
| Multi-line block (>5 lines at once) | 0.3 | Must exceed |
| No preceding keystrokes in previous 2s | 0.2 | Strong indicator |
| Clipboard access correlation | 0.1 | Bonus (if API available) |
| **Confidence Score** | **>0.7 = Paste** | **>0.9 = High-confidence paste** |

**Note:** VS Code does not expose clipboard origin directly. We infer from timing + size + context.

### 4.4 Local SQLite Schema

```sql
CREATE TABLE telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  event_type TEXT CHECK(event_type IN ('keystroke', 'paste', 'save', 'open')),
  timestamp INTEGER NOT NULL,
  line_count INTEGER DEFAULT 0,
  char_count INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0.0,
  session_id TEXT NOT NULL
);

CREATE TABLE file_telemetry_summary (
  file_path TEXT PRIMARY KEY,
  total_keystrokes INTEGER DEFAULT 0,
  total_paste_lines INTEGER DEFAULT 0,
  paste_event_count INTEGER DEFAULT 0,
  last_updated INTEGER
);

CREATE INDEX idx_events_file ON telemetry_events(file_path);
CREATE INDEX idx_events_time ON telemetry_events(timestamp);
```

### 4.5 Scan Correlator

**Location:** `src/telemetry/scanCorrelator.ts`

**Function:** After a scan completes, correlate findings with paste events.

```typescript
interface CorrelatedFinding {
  finding: Finding;
  pasteEvents: PasteEvent[];
  confidence: 'likely-ai' | 'possibly-ai' | 'unknown';
}

function correlate(
  findings: Finding[],
  filePath: string,
  lookbackMinutes: number = 60
): CorrelatedFinding[] {
  const events = db.getPasteEvents(filePath, lookbackMinutes);
  return findings.map(f => {
    const nearbyPastes = events.filter(e => 
      Math.abs(e.timestamp - f.detectedAt) < 300000 // 5 min window
    );
    return {
      finding: f,
      pasteEvents: nearbyPastes,
      confidence: nearbyPastes.length > 0 ? 'likely-ai' : 'unknown'
    };
  });
}
```

---

## 5. Privacy & Security

| Principle | Implementation |
|-----------|---------------|
| **Local-only** | SQLite file in workspace `.simplebeacon/telemetry.db` |
| **No cloud** | Zero network calls; no telemetry upload endpoint |
| **Opt-out** | Setting `simplebeacon.telemetry.enabled: false` |
| **No code content** | Store only metadata (line count, timestamp), never the actual code |
| **Auto-purge** | Delete events older than 7 days by default |
| **Encrypted at rest** | Use SQLCipher if enterprise setting enabled |

---

## 6. Performance Budget

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Keystroke event processing | <1ms | `performance.now()` diff |
| Paste detection | <5ms | End-to-end classification |
| DB write (batched) | <50ms | Every 30s flush |
| Memory per file | <500KB | Circular buffer size |
| Total memory (10 open files) | <5MB | Chrome DevTools heap |

---

## 7. UI Indicators

### 7.1 Sidebar Paste Indicator

In `modernSidebarProvider.ts`, add to file tree nodes:
```typescript
if (fileSummary.pasteLineRatio > 0.6) {
  node.iconPath = new vscode.ThemeIcon('warning', 
    new vscode.ThemeColor('simplebeacon.aiSlop'));
  node.tooltip = `${Math.round(fileSummary.pasteLineRatio * 100)}% AI-suggested`;
}
```

### 7.2 Dashboard Paste Overlay

In `enhancedDashboard3_0.ts`, add paste heatmap overlay:
- Color-code findings: **orange** = correlated with paste event, **blue** = natural keystrokes
- Hover tooltip: "Detected via paste at 14:32 (confidence: 94%)"

---

## 8. Implementation Phases

### Phase 1: Core Tracker (Week 1)
- [ ] Create `src/telemetry/` directory
- [ ] Implement `documentTracker.ts` with `vscode.workspace.onDidChangeTextDocument`
- [ ] Implement paste heuristics (speed + size + timing)
- [ ] SQLite schema + basic writes

### Phase 2: Correlation (Week 2)
- [ ] `scanCorrelator.ts` — match findings to paste events
- [ ] Update dashboard to show correlated findings
- [ ] Add sidebar paste ratio indicators

### Phase 3: Polish (Week 3)
- [ ] Performance optimization (batch DB writes)
- [ ] Privacy settings UI
- [ ] Auto-purge cron
- [ ] Telemetry export (JSON for debugging)

---

## 9. Open Questions

1. **JetBrains parity:** JetBrains IDEs expose `DocumentEvent` but not keystroke timing. Do we skip telemetry on JetBrains or use a degraded heuristic?
2. **Remote SSH/WSL:** Should telemetry DB live on remote host or local machine?
3. **GitHub Copilot integration:** Can we detect Copilot ghost-text acceptance vs. manual typing?

---

## 10. Acceptance Criteria

- [ ] Pasting 100 lines of code triggers paste detection within 5 seconds
- [ ] Dashboard shows "likely AI-generated" badge on correlated findings
- [ ] No telemetry data leaves the local machine
- [ ] Extension host CPU usage <1% during normal typing
- [ ] SQLite DB size <10MB after 7 days of active use

---

*End of Specification*
