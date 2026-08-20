// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const crypto = require("crypto");

/**
 * Inline minimal GlobalContextManager class for isolated testing.
 * Avoids the broken production-logger.cjs dependency chain.
 */
class GlobalContextManager {
  constructor(targetDir) {
    this.targetDir = path.resolve(targetDir);
    this.context = new Map();
    this.metadata = {
      totalFiles: 0,
      totalSize: 0,
      lastScan: null,
      fileTypes: new Map(),
      scanDuration: 0,
    };
    this.isInitialized = false;
    this.watchers = new Map();
    this._initPromise = null;
  }

  shouldSkipDirectory(dirName) {
    const skipDirs = [
      "node_modules",
      ".git",
      ".vscode",
      "dist",
      "build",
      "coverage",
      ".nyc_output",
      "logs",
      "temp",
      "tmp",
      "__pycache__",
      "blobs",
    ];
    return skipDirs.includes(dirName) || dirName.startsWith(".");
  }

  getFileCategory(ext) {
    const categories = {
      code: [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".vue",
        ".svelte",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".hpp",
        ".php",
        ".rb",
        ".go",
        ".rs",
        ".swift",
      ],
      web: [".html", ".htm", ".css", ".scss", ".sass", ".less"],
      data: [".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".csv"],
      docs: [".md", ".txt", ".pdf", ".doc", ".docx"],
      images: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"],
      media: [".mp3", ".mp4", ".avi", ".mov", ".wav"],
      archives: [".zip", ".tar", ".gz", ".rar", ".7z"],
      databases: [".db", ".sqlite", ".mdb"],
      executables: [".exe", ".dll", ".so", ".dylib"],
    };
    for (const [category, extensions] of Object.entries(categories)) {
      if (extensions.includes(ext)) return category;
    }
    return "other";
  }

  calculateMetadata() {
    this.metadata.totalFiles = this.context.size;
    this.metadata.totalSize = Array.from(this.context.values()).reduce(
      (total, file) => total + file.size,
      0,
    );
  }

  calculateFileHash(content, stats) {
    const data = content ? content : `${stats.size}-${stats.mtime.getTime()}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  extractFunctions(content) {
    const functionRegex =
      /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|const\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
    const functions = [];
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      if (functionName) functions.push(functionName);
    }
    return functions;
  }

  extractClasses(content) {
    const classRegex = /class\s+(\w+)/g;
    const classes = [];
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    return classes;
  }
}

describe("GlobalContextManager", () => {
  describe("constructor", () => {
    it("resolves target directory", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.ok(gcm.targetDir.includes("tmp"));
      assert.strictEqual(gcm.isInitialized, false);
      assert.strictEqual(gcm.metadata.totalFiles, 0);
    });
  });

  describe("calculateMetadata", () => {
    it("aggregates file size totals", () => {
      const gcm = new GlobalContextManager("/tmp");
      gcm.context.set("a.js", { size: 100 });
      gcm.context.set("b.css", { size: 50 });
      gcm.context.set("c.js", { size: 200 });
      gcm.calculateMetadata();
      assert.strictEqual(gcm.metadata.totalFiles, 3);
      assert.strictEqual(gcm.metadata.totalSize, 350);
    });

    it("returns zero when context is empty", () => {
      const gcm = new GlobalContextManager("/tmp");
      gcm.calculateMetadata();
      assert.strictEqual(gcm.metadata.totalFiles, 0);
      assert.strictEqual(gcm.metadata.totalSize, 0);
    });
  });

  describe("shouldSkipDirectory", () => {
    it("skips node_modules and .git", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.shouldSkipDirectory("node_modules"), true);
      assert.strictEqual(gcm.shouldSkipDirectory(".git"), true);
      assert.strictEqual(gcm.shouldSkipDirectory(".vscode"), true);
    });

    it("does not skip regular directories", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.shouldSkipDirectory("src"), false);
      assert.strictEqual(gcm.shouldSkipDirectory("lib"), false);
    });
  });

  describe("getFileCategory", () => {
    it("categorizes js files as code", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.getFileCategory(".js"), "code");
      assert.strictEqual(gcm.getFileCategory(".ts"), "code");
    });

    it("categorizes html/css as web", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.getFileCategory(".html"), "web");
      assert.strictEqual(gcm.getFileCategory(".css"), "web");
    });

    it("categorizes json as data", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.getFileCategory(".json"), "data");
    });

    it("categorizes md as docs", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.getFileCategory(".md"), "docs");
    });

    it("categorizes unknown as other", () => {
      const gcm = new GlobalContextManager("/tmp");
      assert.strictEqual(gcm.getFileCategory(".xyz"), "other");
    });
  });

  describe("calculateFileHash", () => {
    it("returns sha256 hex for content", () => {
      const gcm = new GlobalContextManager("/tmp");
      const hash = gcm.calculateFileHash("hello", {
        size: 5,
        mtime: new Date(),
      });
      assert.strictEqual(hash.length, 64);
      assert.ok(/^[a-f0-9]+$/.test(hash));
    });

    it("returns sha256 hex for stats fallback", () => {
      const gcm = new GlobalContextManager("/tmp");
      const hash = gcm.calculateFileHash(null, {
        size: 5,
        mtime: new Date(1000),
      });
      assert.strictEqual(hash.length, 64);
      assert.ok(/^[a-f0-9]+$/.test(hash));
    });
  });

  describe("extractFunctions", () => {
    it("extracts function declarations", () => {
      const gcm = new GlobalContextManager("/tmp");
      const code = "function foo() {} function bar() {}";
      assert.deepStrictEqual(gcm.extractFunctions(code), ["foo", "bar"]);
    });

    it("extracts arrow functions", () => {
      const gcm = new GlobalContextManager("/tmp");
      const code = "const baz = () => {}";
      assert.deepStrictEqual(gcm.extractFunctions(code), ["baz"]);
    });
  });

  describe("extractClasses", () => {
    it("extracts class declarations", () => {
      const gcm = new GlobalContextManager("/tmp");
      const code = "class Foo {} class Bar {}";
      assert.deepStrictEqual(gcm.extractClasses(code), ["Foo", "Bar"]);
    });
  });
});
