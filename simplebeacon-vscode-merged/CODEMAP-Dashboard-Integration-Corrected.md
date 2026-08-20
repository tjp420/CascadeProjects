# VSCode Extension Dashboard Integration: Webview Communication & Real-time Updates

**Codemap ID:** `VSCode_Extension_Dashboard_Integration__Webview_Communication___Real-time_Updates_20260620_221430`

**Description:** This codemap traces the VSCode Extension Dashboard Integration architecture, covering webview panel creation, bidirectional message communication, real-time file monitoring with AI session detection, and data flow from report generation to HTML rendering.

**Last verified:** 2026-06-20 against `simplebeacon-vscode-merged/src/`

---

## Trace 1: Dashboard Panel Creation & Initialization

**Description:** Core dashboard system — triggered when user opens the dashboard via command or status bar click.

```
Dashboard Panel Creation Flow
├── Extension Activation
│   └── Command Registration <-- 1a
│       └── 'simplebeacon.showReport' handler <-- extension.ts:398
│           └── EnhancedDashboard.createOrShow() <-- 1b
│               └── Facade Layer (enhancedDashboard.ts)
│                   └── Delegate to v3.0 <-- 1c
│                       └── EnhancedDashboard30.createOrShow() <-- enhancedDashboard3_0.ts:24
│                           ├── Check existing panel <-- enhancedDashboard3_0.ts:44
│                           └── Create new panel <-- 1d
│                               └── new EnhancedDashboard30() <-- enhancedDashboard3_0.ts:53
│                                   ├── Setup message handler <-- enhancedDashboard3_0.ts:89
│                                   ├── Set HTML content <-- 1e
│                                   └── Sync to browser <-- 1f
```

| Location | Title                      | Description                                                    | Path:LineNumber               |
| -------- | -------------------------- | -------------------------------------------------------------- | ----------------------------- |
| 1a       | Command Registration       | `showReport` command registered in extension activation        | `extension.ts:398`            |
| 1b       | Dashboard Creation Invoked | Delegates to EnhancedDashboard facade with current report data | `extension.ts:402`            |
| 1c       | Facade Delegation          | Facade forwards to EnhancedDashboard30 implementation          | `enhancedDashboard.ts:14`     |
| 1d       | Webview Panel Created      | VSCode API creates new webview panel with scripts enabled      | `enhancedDashboard3_0.ts:48`  |
| 1e       | HTML Content Set           | Dashboard HTML generated and injected into webview             | `enhancedDashboard3_0.ts:177` |
| 1f       | Browser Preview Sync       | Syncs dashboard HTML to browser preview panel if open          | `enhancedDashboard3_0.ts:178` |

---

## Trace 2: Webview-to-Extension Message Flow

**Description:** Core dashboard system — bidirectional communication when user interacts with dashboard UI.

```
Webview-to-Extension Message Flow
├── Dashboard HTML (browser context)
│   ├── User clicks button in UI
│   ├── Event listener fires <-- enhancedDashboard2_0.ts:799
│   └── vscode.postMessage() <-- 2a
│
├── VSCode Webview API (IPC boundary)
│   └── Message sent to extension host
│
└── Extension Host (Node.js context)
    ├── Message handler setup <-- 2b
    ├── Command routing switch <-- 2c
    ├── Branch: scanWorkspace command <-- 2d
    │   └── vscode.commands.executeCommand()
    │       └── Triggers workspace scan
    └── Branch: openFile command <-- enhancedDashboard3_0.ts:90
        ├── Create file URI <-- 2e
        └── Open in editor <-- 2f
```

| Location | Title                 | Description                                                | Path:LineNumber               |
| -------- | --------------------- | ---------------------------------------------------------- | ----------------------------- |
| 2a       | Browser Message Sent  | JavaScript in webview sends command to extension host      | `enhancedDashboard2_0.ts:803` |
| 2b       | Message Handler Setup | Extension registers listener for webview messages          | `enhancedDashboard3_0.ts:89`  |
| 2c       | Command Routing       | Message command type determines action to execute          | `enhancedDashboard3_0.ts:93`  |
| 2d       | Command Execution     | VSCode command API invoked to trigger workspace scan       | `enhancedDashboard3_0.ts:94`  |
| 2e       | File Navigation       | `openFile` command opens specific file at line number      | `enhancedDashboard3_0.ts:91`  |
| 2f       | Editor Opens File     | VSCode editor API opens file with cursor at specified line | `enhancedDashboard3_0.ts:92`  |

---

## Trace 3: Real-time Monitoring & Live Issue Detection

**Description:** Real-time monitoring system — file watcher detects changes and analyzes code for issues.

```
Real-time Monitoring & Live Issue Detection
├── RealtimeMonitor.start() <-- realtimeMonitor.ts:185
│   └── setupFileWatchers() <-- realtimeMonitor.ts:224
│       └── createFileSystemWatcher() <-- 3a
│           └── onDidChange() handler <-- 3b
│               └── handleFileChange() <-- realtimeMonitor.ts:254
│                   └── debounceFileAnalysis() <-- 3c
│                       └── setTimeout(1000ms) <-- 3d
│                           └── analyzeFile() <-- 3e
│                               ├── readFile() <-- realtimeMonitor.ts:385
│                               ├── detectIssues() <-- 3f
│                               │   └── pattern matching <-- realtimeMonitor.ts:437
│                               ├── detectAISlop() <-- realtimeMonitor.ts:395
│                               └── onLiveFindingsCallback() <-- 3g
```

| Location | Title                   | Description                                                        | Path:LineNumber          |
| -------- | ----------------------- | ------------------------------------------------------------------ | ------------------------ |
| 3a       | File Watcher Created    | VSCode file system watcher monitors workspace for changes          | `realtimeMonitor.ts:230` |
| 3b       | Change Event Handler    | File change events trigger analysis pipeline                       | `realtimeMonitor.ts:231` |
| 3c       | Debounced Analysis      | Debounce prevents excessive analysis during rapid edits            | `realtimeMonitor.ts:275` |
| 3d       | Analysis Timer          | 1-second delay before triggering file analysis                     | `realtimeMonitor.ts:350` |
| 3e       | File Analysis Triggered | Analyzes file content for security and quality issues              | `realtimeMonitor.ts:351` |
| 3f       | Pattern Detection       | Runs regex patterns to detect hardcoded secrets, console.logs, etc | `realtimeMonitor.ts:392` |
| 3g       | Callback Invoked        | Notifies subscribers with detected issues for dashboard update     | `realtimeMonitor.ts:402` |

---

## Trace 4: Live Findings to Dashboard Update Flow

**Description:** Extension orchestration — real-time issues flow from monitor to dashboard panels.

```
Real-time Monitor → Extension → Dashboard
├── RealtimeMonitor.onLiveFindings() <-- realtimeMonitor.ts:805
│   └── Callback registered in extension.ts <-- 4a
│       ├── Transform issues to rawIssues <-- 4b
│       ├── Merge into report.rawIssues <-- 4c
│       ├── Update dashboard panel
│       │   └── EnhancedDashboard.updateCurrentPanel() <-- 4d
│       │       └── EnhancedDashboard30.updateIfOpen() <-- 4e
│       │           └── Regenerate webview HTML <-- 4f
│       └── Update sidebar provider <-- 4g
└── Multiple providers updated in parallel
    ├── modernSidebarProvider
    ├── scanProvider <-- extension.ts:305
    ├── enhancedScanProvider <-- extension.ts:306
    └── visualSidebarProvider <-- extension.ts:307
```

| Location | Title                 | Description                                                | Path:LineNumber               |
| -------- | --------------------- | ---------------------------------------------------------- | ----------------------------- |
| 4a       | Callback Registration | Extension registers handler for live findings from monitor | `extension.ts:246`            |
| 4b       | Issue Transformation  | Converts RealtimeIssue format to rawIssues format          | `extension.ts:251`            |
| 4c       | Report Merge          | Live issues merged into current report data structure      | `extension.ts:267`            |
| 4d       | Dashboard Update      | Triggers dashboard panel refresh with updated report       | `extension.ts:302`            |
| 4e       | Update Delegation     | Facade delegates to EnhancedDashboard30 implementation     | `enhancedDashboard.ts:6`      |
| 4f       | HTML Regeneration     | Dashboard HTML regenerated with new findings data          | `enhancedDashboard3_0.ts:192` |
| 4g       | Sidebar Update        | Sidebar provider also updated with latest report data      | `extension.ts:308`            |

---

## Trace 5: AI Session Detection & Dashboard Notification

**Description:** Real-time monitoring system — tracks AI editing sessions and notifies dashboard when complete.

```
AI Session Detection & Dashboard Notification
├── File Change Detection
│   └── handleFileChange() <-- realtimeMonitor.ts:254
│       └── trackAiSession(filePath) <-- 5a
│           ├── aiEditedFiles.add(filePath) <-- 5b
│           ├── Start session if not active <-- realtimeMonitor.ts:282
│           └── Reset inactivity timer <-- realtimeMonitor.ts:289
│               └── setTimeout(5 seconds) <-- 5c
│                   └── endAiSession() <-- 5d
│                       ├── Collect modified files <-- realtimeMonitor.ts:302
│                       └── onAiSessionEndCallback?.(files) <-- 5e
└── Extension Event Handler
    └── realtimeMonitor.onAiSessionEnd() <-- 5f
        ├── Log AI session completion <-- extension.ts:313
        └── EnhancedDashboard.postMessage() <-- 5g
            └── Notify webview of AI edits <-- extension.ts:315
```

| Location | Title                 | Description                                        | Path:LineNumber          |
| -------- | --------------------- | -------------------------------------------------- | ------------------------ |
| 5a       | Session Tracking      | File changes tracked to detect AI editing patterns | `realtimeMonitor.ts:272` |
| 5b       | File Tracking         | Modified files accumulated during AI session       | `realtimeMonitor.ts:279` |
| 5c       | Session End Timer     | 5-second inactivity timer to detect session end    | `realtimeMonitor.ts:294` |
| 5d       | Session End Triggered | Timer fires when no changes detected for 5 seconds | `realtimeMonitor.ts:295` |
| 5e       | Callback Invoked      | Notifies extension with list of AI-modified files  | `realtimeMonitor.ts:315` |
| 5f       | Extension Handler     | Extension receives AI session end notification     | `extension.ts:312`       |
| 5g       | Dashboard Message     | Posts `aiSessionEnd` message to dashboard webview  | `extension.ts:315`       |

---

## Trace 6: Sidebar Webview Command Handling

**Description:** Sidebar system — user interactions in sidebar webview trigger extension commands.

```
VSCode Extension Activation
└── activate(context) <-- extension.ts:215
    └── Sidebar Provider Registration <-- 6a
        └── modernSidebarProvider <-- extension.ts:346
            └── resolveWebviewView() <-- modernSidebarProvider.ts:34
                └── Message Handler Setup <-- 6b
                    └── Command Router (switch) <-- 6c
                        ├── case 'scan' <-- 6d
                        │   ├── executeCommand() <-- 6e
                        │   └── relayCommand() <-- 6f
                        ├── case 'report' <-- modernSidebarProvider.ts:149
                        │   └── executeCommand() <-- modernSidebarProvider.ts:150
                        ├── case 'settings' <-- modernSidebarProvider.ts:136
                        │   └── executeCommand() <-- modernSidebarProvider.ts:137
                        └── case 'openDashboard' <-- modernSidebarProvider.ts:183
                            └── vscode.env.openExternal() <-- modernSidebarProvider.ts:190
```

| Location | Title                 | Description                                             | Path:LineNumber                |
| -------- | --------------------- | ------------------------------------------------------- | ------------------------------ |
| 6a       | Provider Registration | Sidebar webview provider registered with VSCode         | `extension.ts:346`             |
| 6b       | Message Listener      | Sidebar sets up message handler for user interactions   | `modernSidebarProvider.ts:65`  |
| 6c       | Command Router        | Routes incoming commands to appropriate handlers        | `modernSidebarProvider.ts:102` |
| 6d       | Scan Command          | User clicked scan button in sidebar                     | `modernSidebarProvider.ts:103` |
| 6e       | Command Execution     | Delegates to registered extension command               | `modernSidebarProvider.ts:104` |
| 6f       | Browser Relay         | Also forwards command to browser preview via HTTP relay | `modernSidebarProvider.ts:105` |

---

## Trace 7: Report Data Extraction & HTML Generation

**Description:** Core dashboard system — transforms report data into dashboard HTML with charts and tables.

```
Dashboard HTML Generation Flow
├── update() method called <-- enhancedDashboard3_0.ts:181
│   └── getEnhancedHtml() invoked <-- enhancedDashboard3_0.ts:256
│       ├── extractCategories(report) <-- 7a
│       │   └── Format detection logic <-- 7c
│       │       ├── ScanResult format branch <-- enhancedDashboard2_0.ts:839
│       │       └── CLI report format branch <-- enhancedDashboard2_0.ts:848
│       ├── extractAllFindings(report) <-- 7b
│       │   └── Flattens nested structures <-- enhancedDashboard2_0.ts:910
│       ├── JSON.stringify(findings) <-- 7d
│       │   └── Escapes HTML in data <-- enhancedDashboard3_0.ts:283
│       └── HTML template string <-- 7e
│           ├── Injects serialized data <-- enhancedDashboard2_0.ts:676
│           ├── Embeds CSS styles <-- enhancedDashboard3_0.ts:306
│           └── Includes JavaScript <-- enhancedDashboard2_0.ts:673
│               └── acquireVsCodeApi() <-- 7f
│                   └── Enables postMessage <-- enhancedDashboard2_0.ts:803
└── panel.webview.html = result <-- enhancedDashboard3_0.ts:192
    └── Webview renders dashboard
```

| Location | Title                  | Description                                                   | Path:LineNumber               |
| -------- | ---------------------- | ------------------------------------------------------------- | ----------------------------- |
| 7a       | Category Extraction    | Parses report to extract issue categories with counts         | `enhancedDashboard3_0.ts:280` |
| 7b       | Findings Extraction    | Flattens nested report structure into findings array          | `enhancedDashboard3_0.ts:281` |
| 7c       | Format Detection       | Detects ScanResult vs CLI report format for parsing           | `enhancedDashboard2_0.ts:827` |
| 7d       | JSON Serialization     | Serializes findings for injection into dashboard JavaScript   | `enhancedDashboard3_0.ts:283` |
| 7e       | HTML Template          | Generates complete HTML with embedded data and styles         | `enhancedDashboard3_0.ts:301` |
| 7f       | VSCode API Acquisition | Webview JavaScript acquires API for postMessage communication | `webviewPanel.ts:377`         |

---

## Summary of Corrections (vs. Original Codemap)

| Trace | Location | Old Line | New Line | File                      |
| ----- | -------- | -------- | -------- | ------------------------- |
| 1     | 1a       | 412      | **398**  | `extension.ts`            |
| 1     | 1b       | 416      | **402**  | `extension.ts`            |
| 5     | 5f       | 316      | **312**  | `extension.ts`            |
| 5     | 5g       | 319      | **315**  | `extension.ts`            |
| 6     | 6a       | 360      | **346**  | `extension.ts`            |
| 7     | 7a       | 278      | **280**  | `enhancedDashboard3_0.ts` |
| 7     | 7b       | 279      | **281**  | `enhancedDashboard3_0.ts` |
| 7     | 7d       | 282      | **283**  | `enhancedDashboard3_0.ts` |
| 7     | 7e       | 299      | **301**  | `enhancedDashboard3_0.ts` |

All other locations matched the source code exactly.
