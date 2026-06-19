# Demo GIF Script: AI Slop Cop Catching a Placeholder

**Goal:** 2-minute silent demo showing the VS Code extension catching AI-generated slop in real time.

**Tooling:** Use [Screen Studio](https://screenstudio.rocks/) (macOS) or OBS + [KeyCastr](https://github.com/keycastr/keycastr) for keystroke display. Output as 1080p60 MP4, convert to GIF with `ffmpeg -i demo.mp4 -vf "fps=30,scale=1080:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse" -loop 0 demo.gif`

---

## Scene 1: Setup (0:00–0:10)

**Visual:** Clean VS Code window, dark theme, empty `src/config.js` file open.

**Action:** Type a comment at the top of the file:

```javascript
// placeholder: implement actual API endpoint
```

**On-screen text overlay:** "You're coding with AI assistance. Everything looks fine..."

---

## Scene 2: The AI Suggestion (0:10–0:35)

**Visual:** Start typing a function. Cursor blinking after `function getConfig() {`.

**Action:** Trigger Copilot/inline suggestion with `Ctrl+Enter`. Accept the suggestion.

```javascript
function getConfig() {
  return {
    apiUrl: 'https://api.example.com', // placeholder: update with real endpoint
    healthCheck: 'Lorem ipsum dolor sit amet',
    confidence: 0.95,
    debug: true
  };
}
```

**On-screen text overlay:** "Copilot suggests this. Looks reasonable. You accept it."

**KeyCastr:** Show `Tab` keypress for accepting the suggestion.

---

## Scene 3: The Catch (0:35–0:55)

**Visual:** The moment the file is saved (`Ctrl+S`), red and yellow squiggles appear under multiple lines.

**Action:** Save the file. Extension diagnostics populate instantly.

**Highlighted lines:**
- `// placeholder: update with real endpoint` → yellow squiggle: "AI Placeholder Comment"
- `'Lorem ipsum dolor sit amet'` → red squiggle: "AI Default Metric (SB-FICTION-004)"
- `confidence: 0.95` → yellow squiggle: "Hardcoded Confidence Score"
- `debug: true` → yellow squiggle: "Debug Artifact"

**On-screen text overlay:** "AI Slop Cop caught 4 issues in 0.3 seconds."

---

## Scene 4: Hover for Details (0:55–1:15)

**Visual:** Mouse hovers over the red squiggle on `'Lorem ipsum dolor sit amet'`.

**Action:** Hover. A rich tooltip appears:

```
AI Default Metric (SB-FICTION-004)
Hardcoded AI-default UI metric or placeholder Latin filler copy.
Fix: Replace with real metrics or remove placeholder copy
Rule tier: free | Auto-fixable: no
```

**Then hover over** `confidence: 0.95`:

```
Hardcoded Confidence Score
Hardcoded confidence score — replace with computed value.
Fix: Replace with dynamic metric
Rule tier: team | Auto-fixable: no
```

**On-screen text overlay:** "Hover for context. Know exactly what's wrong and how to fix it."

---

## Scene 5: Quick Fix (1:15–1:30)

**Visual:** Click the lightbulb on `// placeholder: update with real endpoint`.

**Action:** Open quick fix menu. Select "Remove placeholder comment" or "Replace with real implementation".

The comment disappears. The squiggle vanishes. Gate status bar updates.

**On-screen text overlay:** "One-click fixes for auto-fixable issues."

---

## Scene 6: Gate Status & Dashboard (1:30–1:50)

**Visual:** Click the AI Slop Cop icon in the Activity Bar.

**Action:** Sidebar opens showing:
- Tier badge: "Free"
- Total Issues: 3 (1 fixed)
- Errors: 0 | Warnings: 2 | Infos: 1
- Gate Status: ⚠️ FAIL (warnings exceed threshold)
- Upgrade banner: "Unlock Team tier for credential leak detection"

**On-screen text overlay:** "Full dashboard. Export reports. Upgrade when you're ready."

---

## Scene 7: Set License Token (1:50–2:00)

**Visual:** Press `Ctrl+Shift+P` → type "Set License Token" → paste a demo token → hit Enter.

**Action:** The sidebar refreshes. Tier badge changes to "Team". New rule "Credential Leak" appears in the list. The gate re-evaluates.

**On-screen text overlay:** "Paste your license token. Pro rules unlock instantly. No restart."

**Final frame:** SimpleBeacon logo + URL: `simplebeacon.ai`

---

## Post-Production Notes

- **No audio** — GIFs are silent. Text overlays carry the narrative.
- **Cursor highlight** — use Screen Studio's cursor glow or a VS Code extension like [Cursor Glow](https://marketplace.visualstudio.com/items?itemName=MrChetan.cursor-glow) so viewers can follow easily.
- **Speed** — 1.2x playback feels snappier without losing comprehension.
- **Export sizes:** MP4 ~8MB, GIF ~4MB. For social media, use the MP4 (most platforms auto-loop video better than GIF).

## Platform Variants

| Platform | Format | Length | Caption |
|----------|--------|--------|---------|
| Twitter/X | MP4 loop, 1080x1080 square | 60s cut | "Your AI assistant just suggested Latin placeholder text. My extension caught it in 0.3s." |
| LinkedIn | MP4, 1080x1920 vertical | Full 2min | "This is what AI slop looks like in production code — and how we catch it before merge." |
| Dev.to | GIF embed in blog post | Full 2min | Inline with the case study article |
| GitHub README | GIF, 800px wide | 30s cut (Scene 3–5 only) | Below the install badge |
