// simplebeacon-ignore: test fixtures, dev-only
// Unit test for the terminal line escaping logic in coming-soon/js/dashboard/main.js
// Tests the escapeHtml function and the safe-text/safe-html gating pattern
// without requiring jsdom (the terminal functions use document.createElement).

const fs = require("fs");
const path = require("path");

// Extract the escapeHtml function from main.js by evaluating it in a sandbox
// that provides a no-op document, then testing the terminal logic.
const mainJsPath = path.resolve(
  __dirname,
  "../../coming-soon/js/dashboard/main.js",
);
const mainJsSource = fs.readFileSync(mainJsPath, "utf8");

// Minimal stub: extract just the escapeHtml function definition
const escapeHtmlMatch = mainJsSource.match(
  /function escapeHtml\(str\)\s*\{[^}]+\}/,
);
if (!escapeHtmlMatch) {
  throw new Error("Could not extract escapeHtml from main.js");
}
// eslint-disable-next-line no-eval
const escapeHtml = new Function(escapeHtmlMatch[0] + "; return escapeHtml;")();

describe("Terminal line HTML escaping", () => {
  test("escapeHtml escapes angle brackets, quotes, and ampersands", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHtml("it's")).toBe("it&#039;s");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("escapeHtml returns empty string for falsy input", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml("")).toBe("");
  });

  test("escapeHtml passes through safe text unchanged", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
    expect(escapeHtml("Scan complete — 42 files")).toBe(
      "Scan complete — 42 files",
    );
  });

  test("appendTerminalLine pattern: isHtml=false escapes text", () => {
    // Simulate the safeText logic: isHtml ? text : escapeHtml(text)
    const safeText = (isHtml, text) => (isHtml ? text : escapeHtml(text));
    expect(safeText(false, "<img src=x onerror=alert(1)>")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
    expect(safeText(false, "Normal message")).toBe("Normal message");
  });

  test("appendTerminalLine pattern: isHtml=true passes through trusted HTML", () => {
    const safeText = (isHtml, text) => (isHtml ? text : escapeHtml(text));
    const html = '<span style="color:#10B981;">&#10003; SUCCESS:</span> Done';
    expect(safeText(true, html)).toBe(html);
  });

  test("appendLocalScannerLine pattern: type !== html escapes", () => {
    // Simulate the safeHtml logic: type === 'html' ? html : escapeHtml(html)
    const safeHtml = (type, html) =>
      type === "html" ? html : escapeHtml(html);
    expect(safeHtml("info", "<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(safeHtml("error", "File not found")).toBe("File not found");
  });

  test("appendLocalScannerLine pattern: type === html passes through", () => {
    const safeHtml = (type, html) =>
      type === "html" ? html : escapeHtml(html);
    const html = '<span style="color:#34D399;">&#10004;</span> Scan complete';
    expect(safeHtml("html", html)).toBe(html);
  });

  test("XSS payload is neutralized by escapeHtml", () => {
    const payloads = [
      "<script>document.cookie</script>",
      '"><script>alert(1)</script>',
      "<svg onload=alert(1)>",
      "javascript:alert(1)//",
      "<iframe src=javascript:alert(1)>",
    ];
    for (const payload of payloads) {
      const escaped = escapeHtml(payload);
      // After escaping, no raw HTML tags remain — angle brackets are entities
      expect(escaped).not.toContain("<script");
      expect(escaped).not.toContain("<svg");
      expect(escaped).not.toContain("<iframe");
      expect(escaped).not.toContain("<img");
      // Payloads with angle brackets must have them escaped to entities
      if (payload.includes("<")) {
        expect(escaped).toContain("&lt;");
      }
      if (payload.includes(">")) {
        expect(escaped).toContain("&gt;");
      }
    }
  });
});
