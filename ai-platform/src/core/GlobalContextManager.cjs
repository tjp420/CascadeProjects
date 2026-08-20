// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
const logger = require("../lib/production-logger.cjs");
/**
 * Global Context Manager - Analyzes directory contents and provides global access
 * Reads all files in a target directory and makes the data available across the entire website
 */

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

/**
 * Global context manager.
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

  /**
   * Initialize the context manager by scanning the target directory
   */
  async initialize(options = {}) {
    if (this.isInitialized) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initializeOnce(options);
    try {
      await this._initPromise;
    } catch (error) {
      this._initPromise = null;
      throw error;
    }
  }

  async _initializeOnce(options = {}) {
    logger.debug(
      `🚀 Initializing Global Context Manager for: ${this.targetDir}`,
    );

    const startTime = Date.now();

    try {
      // Verify directory exists
      await fs.access(this.targetDir);

      // Scan all files and build context
      await this.scanDirectory();

      // Calculate metadata
      this.calculateMetadata();

      const watchEnabled =
        options.watch === true ||
        (options.watch !== false &&
          process.env.SIMPLEBEACON_CONTEXT_WATCH === "true");
      if (watchEnabled) {
        await this.setupFileWatchers();
      }

      this.metadata.lastScan = new Date().toISOString();
      this.metadata.scanDuration = Date.now() - startTime;
      this.isInitialized = true;

      logger.debug(
        `✅ Global Context initialized: ${this.metadata.totalFiles} files scanned in ${this.metadata.scanDuration}ms`,
      );
    } catch (error) {
      console.error("❌ Failed to initialize Global Context Manager:", error);
      throw error;
    }
  }

  /**
   * Scan the target directory recursively and analyze all files
   */
  async scanDirectory() {
    const files = await this.getAllFiles(this.targetDir);

    for (const filePath of files) {
      try {
        await this.analyzeFile(filePath);
      } catch (error) {
        console.warn(`⚠️ Failed to analyze file: ${filePath}`, error.message);
      }
    }
  }

  /**
   * Get all files in directory recursively
   */
  async getAllFiles(dir) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip certain directories for performance
          if (!this.shouldSkipDirectory(entry.name)) {
            const subFiles = await this.getAllFiles(fullPath);
            files.push(...subFiles);
          }
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to read directory: ${dir}`, error.message);
    }

    return files;
  }

  /**
   * Check if directory should be skipped during scanning
   */
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

  /**
   * Analyze a single file and extract its content
   */
  async analyzeFile(filePath) {
    const relativePath = path.relative(this.targetDir, filePath);
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();

    try {
      let content = null;
      let analysis = null;

      // Read file content based on type
      if (this.isTextFile(ext)) {
        content = await fs.readFile(filePath, "utf8");
        analysis = await this.analyzeTextContent(content, ext);
      } else if (this.isBinaryFile(ext)) {
        analysis = await this.analyzeBinaryFile(filePath, stats);
      }

      // Store in context
      const fileData = {
        path: relativePath,
        absolutePath: filePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        type: ext,
        category: this.getFileCategory(ext),
        content,
        analysis,
        hash: this.calculateFileHash(content, stats),
      };

      this.context.set(relativePath, fileData);

      // Update file type statistics
      const currentCount = this.metadata.fileTypes.get(ext) || 0;
      this.metadata.fileTypes.set(ext, currentCount + 1);
    } catch (error) {
      console.warn(`⚠️ Failed to process file: ${relativePath}`, error.message);
    }
  }

  /**
   * Check if file is a text file
   */
  isTextFile(ext) {
    const textExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".vue",
      ".svelte",
      ".html",
      ".htm",
      ".css",
      ".scss",
      ".sass",
      ".less",
      ".json",
      ".xml",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".md",
      ".txt",
      ".csv",
      ".log",
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
      ".sql",
      ".sh",
      ".bat",
      ".ps1",
      ".env",
      ".gitignore",
      ".dockerfile",
    ];

    return textExtensions.includes(ext);
  }

  /**
   * Check if file is a binary file
   */
  isBinaryFile(ext) {
    const binaryExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".webp",
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".zip",
      ".tar",
      ".gz",
      ".rar",
      ".7z",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".mp3",
      ".mp4",
      ".avi",
      ".mov",
      ".wav",
      ".db",
      ".sqlite",
      ".mdb",
    ];

    return binaryExtensions.includes(ext);
  }

  /**
   * Analyze text content and extract meaningful information
   */
  async analyzeTextContent(content, ext) {
    const analysis = {
      lines: content.split("\n").length,
      characters: content.length,
      words: content.split(/\s+/).filter((word) => word.length > 0).length,
      encoding: "utf8",
    };

    // Extract specific information based on file type
    switch (ext) {
      case ".js":
      case ".jsx":
      case ".ts":
      case ".tsx":
        analysis.functions = this.extractFunctions(content);
        analysis.classes = this.extractClasses(content);
        analysis.imports = this.extractImports(content);
        analysis.exports = this.extractExports(content);
        break;

      case ".json":
        try {
          const jsonData = JSON.parse(content);
          analysis.jsonStructure = this.analyzeJsonStructure(jsonData);
          analysis.keys = this.extractJsonKeys(jsonData);
        } catch (error) {
          analysis.invalidJson = true;
        }
        break;

      case ".md":
        analysis.headings = this.extractMarkdownHeadings(content);
        analysis.codeBlocks = this.extractMarkdownCodeBlocks(content);
        analysis.links = this.extractMarkdownLinks(content);
        break;

      case ".html":
      case ".htm":
        analysis.tags = this.extractHtmlTags(content);
        analysis.forms = this.extractHtmlForms(content);
        analysis.scripts = this.extractHtmlScripts(content);
        break;

      case ".css":
      case ".scss":
      case ".sass":
        analysis.selectors = this.extractCssSelectors(content);
        analysis.rules = this.extractCssRules(content);
        analysis.variables = this.extractCssVariables(content);
        break;
    }

    return analysis;
  }

  /**
   * Analyze binary file (metadata only)
   */
  async analyzeBinaryFile(filePath, stats) {
    // simplebeacon-ignore dead-code — function body return
    return {
      type: "binary",
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      // Add more binary analysis as needed
    };
  }

  /**
   * Extract functions from JavaScript/TypeScript code
   */
  extractFunctions(content) {
    const functionRegex =
      /(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|const\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g;
    const functions = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      if (functionName) {
        functions.push(functionName);
      }
    }

    return functions;
  }

  /**
   * Extract classes from JavaScript/TypeScript code
   */
  extractClasses(content) {
    const classRegex = /class\s+(\w+)/g;
    const classes = [];
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  /**
   * Extract imports from JavaScript/TypeScript code
   */
  extractImports(content) {
    const importRegex =
      /import\s+(?:(?:\*\s+as\s+(\w+))|(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    const imports = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        name: match[1] || match[2] || match[3],
        source: match[4],
      });
    }

    return imports;
  }

  /**
   * Extract exports from JavaScript/TypeScript code
   */
  extractExports(content) {
    const exportRegex =
      /export\s+(?:(?:default\s+(?:class|function|const|let|var)\s+(\w+))|(?:\{([^}]+)\})|(?:class|function|const|let|var)\s+(\w+))/g;
    const exports = [];
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1] || match[2] || match[3]);
    }

    return exports;
  }

  /**
   * Analyze JSON structure
   */
  analyzeJsonStructure(jsonData) {
    /**
     * Analyze.
     * @param {any} obj
     * @param {any} depth
     * @returns {any}
     */
    const analyze = (obj, depth = 0) => {
      if (depth > 5) return "deep";

      if (Array.isArray(obj)) {
        return obj.length > 0 ? analyze(obj[0], depth + 1) : "empty-array";
      } else if (typeof obj === "object" && obj !== null) {
        const keys = Object.keys(obj);
        return keys.length > 0
          ? analyze(obj[keys[0]], depth + 1)
          : "empty-object";
      } else {
        return typeof obj;
      }
    };

    return analyze(jsonData);
  }

  /**
   * Extract all keys from JSON object recursively
   */
  extractJsonKeys(obj, prefix = "") {
    const keys = [];

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        keys.push(...this.extractJsonKeys(item, `${prefix}[${index}]`));
      });
    } else if (typeof obj === "object" && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);
        keys.push(...this.extractJsonKeys(obj[key], fullKey));
      });
    }

    return keys;
  }

  /**
   * Extract headings from markdown
   */
  extractMarkdownHeadings(content) {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }

    return headings;
  }

  /**
   * Extract code blocks from markdown
   */
  extractMarkdownCodeBlocks(content) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || "text",
        code: match[2],
      });
    }

    return codeBlocks;
  }

  /**
   * Extract links from markdown
   */
  extractMarkdownLinks(content) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
      });
    }

    return links;
  }

  /**
   * Extract HTML tags
   */
  extractHtmlTags(content) {
    const tagRegex = /<(\w+)(?:\s+[^>]*)?>/g;
    const tags = new Set();
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      tags.add(match[1].toLowerCase());
    }

    return Array.from(tags);
  }

  /**
   * Extract HTML forms
   */
  extractHtmlForms(content) {
    const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
    const forms = [];
    let match;

    while ((match = formRegex.exec(content)) !== null) {
      forms.push({
        action: this.extractAttribute(match[0], "action"),
        method: this.extractAttribute(match[0], "method"),
        content: match[1],
      });
    }

    return forms;
  }

  /**
   * Extract HTML scripts
   */
  extractHtmlScripts(content) {
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let match;

    while ((match = scriptRegex.exec(content)) !== null) {
      scripts.push({
        src: this.extractAttribute(match[0], "src"),
        content: match[1],
      });
    }

    return scripts;
  }

  /**
   * Extract CSS selectors
   */
  extractCssSelectors(content) {
    const selectorRegex = /([^{]+)\s*{/g;
    const selectors = [];
    let match;

    while ((match = selectorRegex.exec(content)) !== null) {
      selectors.push(match[1].trim());
    }

    return selectors;
  }

  /**
   * Extract CSS rules
   */
  extractCssRules(content) {
    const ruleRegex = /([^{}]+)\s*\{\s*([^{}]*)\s*\}/g;
    const rules = [];
    let match;

    while ((match = ruleRegex.exec(content)) !== null) {
      rules.push({
        selector: match[1].trim(),
        properties: match[2].trim(),
      });
    }

    return rules;
  }

  /**
   * Extract CSS variables
   */
  extractCssVariables(content) {
    const variableRegex = /--([\w-]+):\s*([^;]+);/g;
    const variables = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      variables.push({
        name: match[1],
        value: match[2].trim(),
      });
    }

    return variables;
  }

  /**
   * Extract attribute from HTML tag
   */
  extractAttribute(tag, attrName) {
    const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`);
    const match = tag.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Get file category based on extension
   */
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
      if (extensions.includes(ext)) {
        return category;
      }
    }

    return "other";
  }

  /**
   * Calculate file hash for change detection
   */
  calculateFileHash(content, stats) {
    const data = content ? content : `${stats.size}-${stats.mtime.getTime()}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Calculate metadata statistics
   */
  calculateMetadata() {
    this.metadata.totalFiles = this.context.size;
    this.metadata.totalSize = Array.from(this.context.values()).reduce(
      (total, file) => total + file.size,
      0,
    );
  }

  /**
   * Setup file watchers for real-time updates
   */
  async setupFileWatchers() {
    try {
      const chokidar = require("chokidar");

      const watcher = chokidar.watch(this.targetDir, {
        ignored: [
          /(^|[/\\])\../,
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/coverage/**",
          "**/htmlcov/**",
          "**/__pycache__/**",
          "**/blobs/**",
        ],
        persistent: true,
        ignoreInitial: true,
      });

      // simplebeacon-ignore memory-leak — watcher is stored in this.watchers and closed via close()
      watcher.on("change", async (filePath) => {
        await this.handleFileChange(filePath, "changed");
      });

      watcher.on("add", async (filePath) => {
        await this.handleFileChange(filePath, "added");
      });

      watcher.on("unlink", async (filePath) => {
        await this.handleFileChange(filePath, "deleted");
      });

      this.watchers.set(this.targetDir, watcher);
      logger.debug("👁️ File watchers enabled for real-time updates");
    } catch (error) {
      console.warn(
        "⚠️ Could not setup file watchers (chokidar not available):",
        error.message,
      );
    }
  }

  /**
   * Handle file changes
   */
  async handleFileChange(filePath, changeType) {
    const relativePath = path.relative(this.targetDir, filePath);
    const verbose = process.env.SIMPLEBEACON_CONTEXT_WATCH_LOG === "true";

    try {
      if (changeType === "deleted") {
        this.context.delete(relativePath);
        if (verbose) logger.debug(`🗑️ File deleted: ${relativePath}`);
      } else {
        await this.analyzeFile(filePath);
        if (verbose) logger.debug(`📝 File ${changeType}: ${relativePath}`);
      }

      this.calculateMetadata();
      this.metadata.lastScan = new Date().toISOString();
    } catch (error) {
      console.warn(
        `⚠️ Failed to handle file change: ${relativePath}`,
        error.message,
      );
    }
  }

  /**
   * Get context data for middleware injection
   */
  getContext() {
    return {
      files: Object.fromEntries(this.context),
      metadata: this.metadata,
      isInitialized: this.isInitialized,
      targetDir: this.targetDir,
    };
  }

  /**
   * Search through context for specific content
   */
  search(query, options = {}) {
    const results = [];
    const searchTerm = query.toLowerCase();
    const { fileTypes, categories, limit = 50 } = options;

    for (const [relativePath, fileData] of this.context) {
      // Filter by file type if specified
      if (fileTypes && !fileTypes.includes(fileData.type)) continue;
      if (categories && !categories.includes(fileData.category)) continue;

      // Search in content
      if (
        fileData.content &&
        fileData.content.toLowerCase().includes(searchTerm)
      ) {
        results.push({
          path: relativePath,
          type: fileData.type,
          category: fileData.category,
          matches: this.findContentMatches(fileData.content, searchTerm),
          score: this.calculateRelevanceScore(fileData.content, searchTerm),
        });
      }

      // Search in analysis data
      if (fileData.analysis) {
        const analysisMatches = this.searchInAnalysis(
          fileData.analysis,
          searchTerm,
        );
        if (analysisMatches.length > 0) {
          results.push({
            path: relativePath,
            type: fileData.type,
            category: fileData.category,
            matches: analysisMatches,
            score: this.calculateRelevanceScore(
              JSON.stringify(fileData.analysis),
              searchTerm,
            ),
          });
        }
      }
    }

    // Sort by relevance score and limit results
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Find content matches with context
   */
  findContentMatches(content, searchTerm) {
    const matches = [];
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchTerm)) {
        matches.push({
          lineNumber: index + 1,
          content: line.trim(),
          context: this.getLineContext(lines, index, 2),
        });
      }
    });

    return matches;
  }

  /**
   * Get line context around a match
   */
  getLineContext(lines, centerIndex, contextLines) {
    const start = Math.max(0, centerIndex - contextLines);
    const end = Math.min(lines.length - 1, centerIndex + contextLines);

    return lines.slice(start, end + 1).map((line, index) => ({
      lineNumber: start + index + 1,
      content: line,
      isMatch: start + index === centerIndex,
    }));
  }

  /**
   * Search in analysis data
   */
  searchInAnalysis(analysisPayload, searchTerm) {
    const matchedEntries = [];
    const normalizedSearch = searchTerm.toLowerCase();

    for (const [sectionKey, sectionValue] of Object.entries(analysisPayload)) {
      if (Array.isArray(sectionValue)) {
        sectionValue.forEach((entryText) => {
          if (
            typeof entryText === "string" &&
            entryText.toLowerCase().includes(normalizedSearch)
          ) {
            matchedEntries.push({ type: sectionKey, value: entryText });
          }
        });
      } else if (
        typeof sectionValue === "string" &&
        sectionValue.toLowerCase().includes(normalizedSearch)
      ) {
        matchedEntries.push({ type: sectionKey, value: sectionValue });
      }
    }

    return matchedEntries;
  }

  /**
   * Calculate relevance score for search results
   */
  calculateRelevanceScore(content, searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    const contentLower = content.toLowerCase();

    // Count occurrences
    const occurrences = (contentLower.match(new RegExp(searchLower, "g")) || [])
      .length;

    // Calculate score based on occurrences and content length
    const score = (occurrences / contentLower.length) * 1000;

    return Math.round(score * 100) / 100;
  }

  /**
   * Get files by category
   */
  getFilesByCategory(category) {
    const files = [];

    for (const [_relativePath, fileData] of this.context) {
      if (fileData.category === category) {
        files.push(fileData);
      }
    }

    return files;
  }

  /**
   * Get files by type
   */
  getFilesByType(type) {
    const files = [];

    for (const [_relativePath, fileData] of this.context) {
      if (fileData.type === type) {
        files.push(fileData);
      }
    }

    return files;
  }

  /**
   * Get statistics about the context
   */
  getStatistics() {
    const stats = {
      ...this.metadata,
      categories: {},
      types: {},
    };

    // Calculate category statistics
    for (const fileData of this.context.values()) {
      stats.categories[fileData.category] =
        (stats.categories[fileData.category] || 0) + 1;
      stats.types[fileData.type] = (stats.types[fileData.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Close all file watchers
   */
  async close() {
    for (const [_path, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
    logger.debug("🛑 File watchers closed");
  }
}

module.exports = GlobalContextManager;
