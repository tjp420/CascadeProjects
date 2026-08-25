/**
 * Parse GZDoom runtime log lines into structured findings for correlation.
 */

const LOG_PATTERNS = Object.freeze([
  {
    id: "GZ-LOG-001",
    kind: "unknown-sprite",
    regex: /Unknown sprite (\S+) in model definition for (\S+)/i,
    severity: "high",
    map: (m) => ({ sprite: m[1], modelName: m[2] }),
  },
  {
    id: "GZ-LOG-002",
    kind: "unknown-class",
    regex: /Unknown class name '([^']+)' of type 'Actor'/i,
    severity: "high",
    map: (m) => ({ className: m[1] }),
  },
  {
    id: "GZ-LOG-003",
    kind: "duplicate-class",
    regex: /Tried to define class '([^']+)' more than once/i,
    severity: "high",
    map: (m) => ({ className: m[1] }),
  },
  {
    id: "GZ-LOG-004",
    kind: "replaces-conflict",
    regex: /(?:Can't|Cannot) replace actor '([^']+)'/i,
    severity: "high",
    map: (m) => ({ replacedClass: m[1] }),
  },
  {
    id: "GZ-LOG-005",
    kind: "script-error",
    regex: /Script error,\s*"([^"]+)"\s+line\s+(\d+):\s*(.*)/i,
    severity: "high",
    map: (m) => ({
      filePath: m[1],
      line: Number(m[2]),
      message: (m[3] || "").trim(),
    }),
  },
  {
    id: "GZ-LOG-006",
    kind: "missing-string",
    regex: /Missing string \(unexpected end of file\)/i,
    severity: "high",
    map: () => ({ message: "Missing string (unexpected end of file)" }),
  },
  {
    id: "GZ-LOG-007",
    kind: "parse-error",
    regex:
      /Parse error(?: in)?(?: file)?(?: "([^"]+)")?(?:,)? line (\d+):\s*(.+)/i,
    severity: "high",
    map: (m) => ({
      filePath: m[1] || null,
      line: Number(m[2]),
      message: (m[3] || "").trim(),
    }),
  },
]);

/**
 * @param {string} content Raw log file text.
 * @returns {Array<{id:string,kind:string,severity:string,line:number,text:string,details:Object}>}
 */
function parseGzdoomLog(content) {
  const entries = [];
  if (typeof content !== "string" || !content.trim()) return entries;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    for (const pattern of LOG_PATTERNS) {
      const match = pattern.regex.exec(text);
      if (!match) continue;
      entries.push({
        id: pattern.id,
        kind: pattern.kind,
        severity: pattern.severity,
        line: i + 1,
        text: text.trim(),
        details: pattern.map(match),
      });
      break;
    }
  }
  return entries;
}

module.exports = {
  LOG_PATTERNS,
  parseGzdoomLog,
};
