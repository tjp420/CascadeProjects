/**
 * Local browser scan worker for the AI platform dashboard.
 * Scans files selected by the user on their own hardware — no data is sent to the server.
 *
 * This version streams large files through a Rust/WebAssembly chunk analyzer (with a
 * pure-JS fallback) instead of loading the entire file into memory at once.
 */
import { analyzeFileChunks, findingsToIssues } from './scan-wasm-bridge.js?v=20260716cachefix1';
import { isIgnoredVirtualPath } from '../utils-lib/simplebeaconignore.browser.js?v=20260726ignorefix1';
const MAX_DISCOVERED_FILES = 999999999; // No cap — scan all files (matches legacy /audit page)
const MAX_ISSUES = 100000;
const SCAN_BATCH_SIZE = 400;
const YIELD_INTERVAL = 500; // yield back to main thread every N files
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const FILE_READ_TIMEOUT_MS = 30000;
const CHUNK_ANALYZE_TIMEOUT_MS = 120000;
const BINARY_EXTENSIONS =
  /\.(exe|dll|bin|so|dylib|wasm|zip|tar|gz|tgz|bz2|7z|rar|iso|img|dmg|pkg|deb|msi|apk|ipa|woff|woff2|ttf|otf|eot|png|jpg|jpeg|gif|bmp|ico|webp|avif|svg|mp3|mp4|wav|avi|mov|mkv|webm|pdf|doc|docx|xls|xlsx|ppt|pptx|sqlite|db|lock|scx|scm|sc2map|sc2data|chk|mix|vxl|shp|tmp|mpq|w3x|w3m|nif|bik|ogv|dat|vsix|pack|bundle|map|rlib|rmeta|gguf|cab|safetensors|onnx|pt|pth|bad|whl|pyc|pyo|class|jar|aar|nupkg|dmg|crx|xpi|snap|flatpak|AppImage|idx|s2ma|s2ml|s2gs|s2vh|bank|stormmap|stormmod|replay|mng|snp|tga|dds|anim|model|fx|s2ga|s2ua|s2sa|s2ta|s2wa|s2ih|s2rh|s2ph|s2ch|s2nh|s2mh|s2dh|s2oh|s2ee|s2sb|s2gb|s2mb|s2ab|s2vb|s2lb|s2hb|s2cb|s2nb|s2pb|s2tb|s2wb|s2yb|s2zb|s2fb|s2qb|s2rb|s2xb|s2jb|s2kb|s2ib|s2eb|s2ob|s2ub)$/i;
const LANGUAGE_REGISTRY = {
  javascript: { extensions: ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'] },
  python: { extensions: ['py', 'pyw', 'pyi'] },
  java: { extensions: ['java', 'kt', 'scala', 'groovy'] },
  go: { extensions: ['go'] },
  rust: { extensions: ['rs'] },
  php: { extensions: ['php'] },
  ruby: { extensions: ['rb'] },
  dotnet: { extensions: ['cs', 'vb'] },
  generic: {
    extensions: ['txt', 'ini', 'cfg', 'conf', 'env', 'json', 'xml', 'yaml', 'yml', 'md', 'log', 'properties', 'toml'],
  },
};
const PATTERN_REGISTRY = {
  debugArtifacts: {
    appliesTo: ['javascript'],
    pattern:
      /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|\bdebugger\b|\balert\s*\(|\bprompt\s*\(|\bconfirm\s*\(/gi,
  },
  todoMarkers: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /(?:\/\/\s*|\/\*\s*|#\s*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi,
  },
  credentials: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /(?:^|[^a-zA-Z0-9_-])(password|passwd|pwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|access_token|auth_token|refresh_token|bearer_token)\s*[:=]\s*['"`][^'"`\s]{8,}/gi,
  },
  euAiAct: {
    appliesTo: ['javascript', 'generic'],
    pattern: /ai_system|high_risk|transparency|conformity|bias_audit|data_governance/gi,
  },
  hardcodedIp: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
  pythonDebug: {
    appliesTo: ['python'],
    pattern: /\bprint\s*\(|\bpprint\s*\(|\blogging\.debug\s*\(|\bbreakpoint\s*\(/i,
  },
  javaDebug: {
    appliesTo: ['java'],
    pattern: /\bSystem\.(out|err)\.(print|println)\s*\(|\be\.printStackTrace\s*\(|\bjava\.util\.logging\./i,
  },
  pythonFramework: {
    appliesTo: ['python'],
    pattern: /\bDEBUG\s*=\s*True\b|\bapp\.run\s*\(\s*[^)]*debug\s*=\s*True/i,
  },
  javaFramework: {
    appliesTo: ['java'],
    pattern: /spring\.datasource\.(password|url)\s*=\s*['"][^'"]{4,}|log4j.*CVE|log4shell|jndi:ldap/i,
  },
  goDebug: {
    appliesTo: ['go'],
    pattern: /\bfmt\.Print(?:ln|f)?\s*\(|\blog\.Print(?:ln|f)?\s*\(|\blog\.Fatal(?:f|ln)?\s*\(|\bpanic\s*\(/i,
  },
  goFramework: {
    appliesTo: ['go'],
    pattern: /\bgin\.SetMode\s*\(\s*gin\.DebugMode|http\.ListenAndServe\s*\(\s*["'][^"']+["']\s*,\s*nil\s*\)/i,
  },
  rustDebug: {
    appliesTo: ['rust'],
    pattern: /\bprintln!\s*\(|\beprintln!\s*\(|\bdbg!\s*\(|\bprint!\s*\(|\bpanic!\s*\(/i,
  },
  rustFramework: {
    appliesTo: ['rust'],
    pattern: /\.unwrap\s*\(\s*\)(?:\s*\?\s*\.unwrap\s*\(\s*\))+|\.expect\s*\(\s*["']\s*["']\s*\)/i,
  },
  phpDebug: {
    appliesTo: ['php'],
    pattern:
      /\becho\s+['"]|\bvar_dump\s*\(|\bprint_r\s*\(|\bdie\s*\(|\bexit\s*\(|\bdebug_backtrace\s*\(|\btrigger_error\s*\(/i,
  },
  phpFramework: {
    appliesTo: ['php'],
    pattern:
      /APP_DEBUG\s*=>\s*true|APP_ENV\s*=>\s*['"]local['"]|DB::raw\s*\(|mysql_query\s*\(|mysqli_query\s*\(|PDO\s*::\s*query\s*\(|eval\s*\(/i,
  },
  dotnetDebug: {
    appliesTo: ['dotnet'],
    pattern:
      /\bConsole\.Write(Line)?\s*\(|\bDebug\.Write(Line)?\s*\(|\bTrace\.Write(Line)?\s*\(|\bDebugger\.Break\s*\(/i,
  },
  dotnetFramework: {
    appliesTo: ['dotnet'],
    pattern:
      /connectionString\s*=\s*["'][^"']{10,}|Integrated\s+Security\s*=\s*false|Server=localhost;|\.UseInMemoryDatabase\s*\(/i,
  },
  rubyDebug: {
    appliesTo: ['ruby'],
    pattern:
      /\bputs\s+['"]|\bp\s+['"]|\bdebugger\b|\bdebug\s+['"]|\bbinding\.irb\b|\bbinding\.pry\b|\bRails\.logger\.debug\s*\(/i,
  },
  rubyFramework: {
    appliesTo: ['ruby'],
    pattern: /\.permit!\s*\)|\bskip_before_action\b|\beval\s*\(|\bsend\s*\(\s*params\[/i,
  },
  // === Ported from legacy scanner-patterns.js for feature parity ===
  sensitiveData: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|console\.(log|warn|error|info)\s*\(\s*(?:user|customer|email|password|token|ssn|phone)|localStorage\.setItem\s*\(\s*['"](?:token|auth|session|password)/i,
    maxMatches: 3,
    selfReferenceFilter:
      /\b(?:dev@simplebeacon\.ai|demo@simplebeacon\.ai|test@example\.com|noreply@|no-reply@|example\.com|localhost|127\.0\.0\.1|generate.*token|send.*email|email.*template|outreach|prospect|marketing|invoice|billing|payment|tier|sandbox|demo|test|fixture|mock|sample|dummy|fake|stub)\b/i,
    contextFilter: (snippet, filePath) => {
      if (
        /Copyright|Author:|maintainer_email|PACKAGE_BUGREPORT|license|@googlegroups\.com|@google\.com|@apache\.org|@mozilla\.org/.test(
          snippet
        )
      )
        return false;
      if (
        filePath &&
        /\/(jquery|modernizr|underscore|bootstrap|lodash|moment|react|vue|angular)\b|\.min\.js$|\.pack\.js$|(^|\/)(docs\/|doc\/|third_party\/|thirdparty\/|vendor\/)\//i.test(
          filePath
        )
      )
        return false;
      return true;
    },
  },
  configDrift: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /localhost:\d+|127\.0\.0\.1:\d+|hardcoded.*url|password\s*=\s*['"]|secret\s*=\s*['"]|api_key\s*=\s*['"]/i,
    maxMatches: 3,
    contextFilter: (snippet, filePath) => {
      if (/config\.get<|vscode\.workspace\.getConfiguration|\.get\(['"]\w+['"]\s*,\s*['"]/.test(snippet)) return false;
      if (/\/\/.*hardcoded|\/\*.*hardcoded|move hardcoded|configuration drift/i.test(snippet)) return false;
      if (/\/\/.*localhost|\/\*.*localhost|#.*localhost|default\s*=\s*['"]http:\/\/localhost/.test(snippet))
        return false;
      return true;
    },
  },
  innerHtmlXss: {
    appliesTo: ['javascript', 'generic'],
    pattern: /\.innerHTML\s*=\s*[^'"]/i,
    maxMatches: 3,
    selfReferenceFilter: /scanner-patterns|scanner-engine|ui-renderer|scan-worker|main\.js|certificate-module/i,
    contextFilter: (snippet, filePath) => {
      if (/scanner-patterns\.js|scanner-engine\.js|ui-renderer\.js|main\.js/i.test(filePath)) return false;
      if (/\.innerHTML\s*=\s*`[^`]*`/.test(snippet) && !/\$\{[^}]*\}/.test(snippet)) return false;
      return true;
    },
  },
  prototypePollution: {
    appliesTo: ['javascript', 'generic'],
    pattern: /Object\.prototype\.|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
    maxMatches: 3,
    selfReferenceFilter: /Object\.prototype\.hasOwnProperty\.call|Object\.prototype\.toString\.call/i,
  },
  unhandledPromise: {
    appliesTo: ['javascript', 'generic'],
    pattern: /\.then\s*\([^)]*\)(?!\s*\.(catch|finally))\s*;?\s*$/m,
    maxMatches: 3,
    selfReferenceFilter: /await\s+\w+\.then\s*\(/i,
  },
  insecureRandom: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /Math\.random\s*\(\)(?=.*(?:token|password|secret|salt|nonce|uuid|id|key))/i,
    maxMatches: 3,
    selfReferenceFilter: /scanner-patterns|scanner-engine|pattern-documentation|test-all-patterns/i,
  },
  loggingSecrets: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /console\.(log|warn|error|info)\s*\([^)]*(?:password|token|secret|apiKey|api_key|privateKey|private_key|credential)/i,
    maxMatches: 3,
    selfReferenceFilter:
      /scanner-patterns|scanner-engine|pattern-documentation|test-all-patterns|fixRegistry|findingConverter/i,
    contextFilter: (snippet, filePath) => {
      const hasVariable = /\b(?:token|password|secret|apiKey|api_key|privateKey|private_key|credential)\s*[,+)]/.test(
        snippet
      );
      const onlyInString =
        /['"][^'"]*(?:token|password|secret|apiKey|api_key|privateKey|private_key|credential)[^'"]*['"]/.test(snippet);
      if (!hasVariable && onlyInString) return false;
      if (/\/\/\s*console\.(log|error|warn)/i.test(snippet)) return false;
      if (/catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/i.test(snippet)) return false;
      return true;
    },
  },
  evalDanger: {
    appliesTo: ['javascript', 'python', 'php', 'ruby', 'generic'],
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]/i,
    maxMatches: 3,
    selfReferenceFilter:
      /new\s+RegExp\s*\(|RegExp\s*\(\s*['"`]|message:\s*['"]eval\(\)|severity.*warning.*eval-usage|scanner-patterns|scanner-engine|pattern-documentation/i,
    contextFilter: (snippet, filePath) => {
      if (/new\s+RegExp\s*\(/i.test(snippet)) return false;
      return true;
    },
  },
  weakCryptography: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /\bmd5\s*\(|\bsha1\s*\(|\bDES\b|\bRC4\b|\bcrypto\.createHash\s*\(\s*['"`](?:md5|sha1)['"`]/i,
    maxMatches: 3,
    contextFilter: (snippet) => {
      if (/\/\/.*weak|deprecated|do not use|avoid/i.test(snippet)) return false;
      return true;
    },
  },
  secretInComment: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /(?:\/\/|\/\*|\*|#)\s*(?:api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`]?[a-zA-Z0-9_\-]{16,}/i,
    maxMatches: 3,
    contextFilter: (snippet, filePath) => {
      if (filePath && /scanner-patterns|scanner-engine|pattern-documentation/i.test(filePath)) return false;
      return true;
    },
  },
  llmSlop: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE|\[Insert\s[^\]]+\]|\/\/\s*AI\s+Generated\s+Placeholder|```(?:javascript|typescript|python|json)\s*$|```\s*$|99\.99\s*%?\s*Uptime|100\s*%?\s*Secure|Lorem\s+Ipsum|I have (written|implemented|created|updated) the .* as requested|Let me know if you need me to (adjust|update|change|modify)|AI Assistant Note:/i,
    maxMatches: 5,
    selfReferenceFilter: /llm-slop-patterns|fiction-kpi|rejectedFiction|scanner-patterns/i,
    contextFilter: (snippet, filePath) => {
      if (/\.template\.|\.example\.|\.sample\./i.test(filePath)) return false;
      if (/fixture|mock|test-data|__tests__|spec/i.test(filePath)) return false;
      if (/\.md$|\.markdown$/i.test(filePath) && /```[a-z]+\s*$/.test(snippet)) return false;
      return true;
    },
  },
  productionLeak: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /['"`][^'"`]*(?:\/|\\)mock(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*(?:\/|\\)fixtures(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*(?:\/|\\)sample(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*-sample\.json['"`]/i,
    maxMatches: 3,
    selfReferenceFilter: /production-leak|llm-slop-patterns|fiction-kpi|scanner-patterns/i,
    contextFilter: (snippet, filePath) => {
      if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
      if (/fixture|mock/i.test(filePath)) return false;
      if (/\.example\.|\.sample\.|\.template\./i.test(filePath)) return false;
      if (/dev|staging|local|test/i.test(snippet)) return false;
      return true;
    },
  },
  fictionKpi: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /\b(?:totalFeatures|featuresTracked|aiOptimizationsApplied|issuesDetected|issuesFound|patternsIdentified|openIssues)\s*[:=]\s*["']?\d+\b|\b(?:aiConfidence|confidence|accuracy|completionRate)\s*[:=]\s*["']?\d{1,3}\b|\b\d{1,3}\s*%\s*(?:completion|accuracy|confidence|uptime|secure)\b/i,
    maxMatches: 3,
    selfReferenceFilter:
      /rejectedFiction|fiction-kpi|fictionRemoved|fictionVsReality|not model output|baseline false|progressMetrics|scanner-patterns/i,
  },
  hardcodedConfidence: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /confidence\s*[:=]\s*(?:0\.\d+|\d{1,3})\b/i,
    maxMatches: 3,
    selfReferenceFilter:
      /rejectedFiction|fiction-kpi|scanner-patterns|confidence.*threshold|confidence.*score|confidence.*level/i,
  },
  hardcodedCompletion: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /completion(?:Rate)?\s*[:=]\s*(?:0\.\d+|\d{1,3})\b/i,
    maxMatches: 3,
    selfReferenceFilter: /rejectedFiction|fiction-kpi|scanner-patterns/i,
  },
  mockPathLeak: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /['"`][^'"`]*(?:\/|\\)mocks?(?:\/|\\)[^'"`]+['"`]/i,
    maxMatches: 3,
    contextFilter: (snippet, filePath) => {
      if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
      if (/fixture|mock/i.test(filePath)) return false;
      return true;
    },
  },
  sampleJsonRef: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /['"`][^'"`]*sample[^'"`]*\.json['"`]/i,
    maxMatches: 3,
    contextFilter: (snippet, filePath) => {
      if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
      if (/fixture|mock/i.test(filePath)) return false;
      return true;
    },
  },
  emptyStubFunction: {
    appliesTo: ['javascript', 'generic'],
    pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\}|(?:const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{\s*\}/i,
    maxMatches: 3,
    selfReferenceFilter: /scanner-patterns|scanner-engine|test-all-patterns/i,
  },
  roadmapMarker: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /(?:\/\/\s*|\/\*\s*|#\s*)\b(HACK|XXX|WORKAROUND)\b/gi,
    maxMatches: 3,
  },
  aiPlaceholderComment: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern:
      /\/\/\s*(?:TODO:?\s*Implement|TODO:?\s*Add|TODO:?\s*Replace|Placeholder for|Stub for|AI generated placeholder)/i,
    maxMatches: 3,
    selfReferenceFilter: /scanner-patterns|scanner-engine|pattern-documentation/i,
  },
  markdownFenceLeak: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
    pattern: /```(?:javascript|typescript|python|json)\s*$/i,
    maxMatches: 3,
    contextFilter: (snippet, filePath) => {
      if (/\.md$|\.markdown$|\.mdx$/i.test(filePath)) return false;
      return true;
    },
  },
  missingRateLimit: {
    appliesTo: ['javascript', 'generic'],
    pattern: /app\.(get|post|put|delete|patch)\s*\(\s*['"][^'"]+['"]/i,
    maxMatches: 3,
    selfReferenceFilter: /rateLimit|rate-limit|throttle|scanner-patterns/i,
    contextFilter: (snippet) => {
      if (/rateLimit|rate-limit|throttle/i.test(snippet)) return false;
      return true;
    },
  },
  dbAntiPattern: {
    appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby', 'generic'],
    pattern:
      /SELECT\s+.*['"]\s*\+\s*['"]|query\s*\(\s*['"].*\+\s*['"]|raw\s*\(\s*['"].*\$\{|\.findAll\s*\(\s*\)(?!.*limit)/i,
    maxMatches: 3,
  },
};
const SEVERITY_MAP = {
  credentials: 'critical',
  euAiAct: 'high',
  // Ported from legacy scanner-patterns.js
  sensitiveData: 'high',
  configDrift: 'medium',
  innerHtmlXss: 'medium',
  prototypePollution: 'high',
  unhandledPromise: 'medium',
  insecureRandom: 'high',
  loggingSecrets: 'high',
  evalDanger: 'high',
  weakCryptography: 'high',
  secretInComment: 'high',
  llmSlop: 'medium',
  productionLeak: 'medium',
  fictionKpi: 'medium',
  hardcodedConfidence: 'medium',
  hardcodedCompletion: 'medium',
  mockPathLeak: 'medium',
  sampleJsonRef: 'medium',
  emptyStubFunction: 'low',
  roadmapMarker: 'low',
  aiPlaceholderComment: 'low',
  markdownFenceLeak: 'low',
  missingRateLimit: 'medium',
  dbAntiPattern: 'high',
};
const CREDENTIAL_ALLOWLIST =
  /placeholder|changeme|example\.com|your-api-key|your-secret|dummy-token|test-secret|fake-api|mock-secret|not-a-real|hardcoded-secret-for-unit-test|secret-key-for-unit-test|sk_test_your|xxxxxxxx|replace_me|sample-token|template-secret|programmatically generated/i;
const IGNORE_LINE_RE = /simplebeacon-ignore\s+(?:credentials|credential-pattern|sensitive-data|euAiAct|eu-ai-act)/i;
const EU_AI_ACT_COMPLIANCE_LINE_RE =
  /EU AI Act Documentation Marker|Documentation Marker|Annex III|Article\s*50|Article\s*12|euAiActCompliance|euAiAct|transparency disclosure|buildTransparency|providerTransparency|ScopeTransparency|aiSystemDisclosure|humanInTheLoop|human-in-the-loop|humanInTheLoop|human oversight|inference events logged|Risk Level:|Limited risk|not legal conformity|technical readiness|transparencyGaps|highRiskIndicators|aiSystemIndicators|documentationArtifacts|legal conformity|Disclaimer:/i;
function isTestOrFixturePath(normalized) {
  return (
    /(?:^|\/)(__tests__|tests?|fixtures?|mocks?|simplebeacon-rule-tests)(?:\/|$)/i.test(normalized) ||
    /\.(test|spec)\.[a-z0-9]+$/i.test(normalized)
  );
}
function isComplianceToolingPath(normalized) {
  return (
    /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|lib|mcp|analyzers|reporters)\//i.test(normalized) ||
    /(?:^|\/)(?:coming-soon|simplebeacon-vscode-merged|simplebeacon-vscode)(?:\/|$)/i.test(normalized) ||
    /(?:^|\/)dashboard-web\//i.test(normalized) ||
    /public\/dashboard\//i.test(normalized) ||
    /web\/simplebeacon-dashboard\/js(?:-es2018)?\/(?:services|workers|views)\//i.test(normalized) ||
    /server\/routes\/(?:chatbot-api|flexible-analyze-api)\.cjs$/i.test(normalized) ||
    /src\/api\/trust-api\.cjs$/i.test(normalized) ||
    /eu-ai-act|scanner-patterns|scanner-engine|compliance-mapper|credential-pattern-scanner|enterprise-guardrail|llm-slop-catalog|aiProblemAnalyzerSuite|extendedAnalyzers/i.test(
      normalized
    )
  );
}
function shouldSkipAnalyzerLine(name, filePath, line) {
  const normalized = filePath.replace(/\\/g, '/');
  if (IGNORE_LINE_RE.test(line)) return true;
  if (name === 'credentials') {
    if (isTestOrFixturePath(normalized) || CREDENTIAL_ALLOWLIST.test(line)) return true;
  }
  if (name === 'euAiAct') {
    if (isComplianceToolingPath(normalized) || EU_AI_ACT_COMPLIANCE_LINE_RE.test(line)) return true;
  }
  if (name === 'hardcodedIp') {
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(line)) return true;
  }
  return false;
}
function shouldSkipAnalyzerFile(name, filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (isTestOrFixturePath(normalized)) return true;
  if (name === 'credentials' && /(?:^|\/)simplebeacon-rule-tests\//i.test(normalized)) return true;
  if (name === 'euAiAct' && isComplianceToolingPath(normalized)) return true;
  return false;
}
function detectFileLanguage(path) {
  const ext = (path.match(/\.([^.]+)$/) || [null, ''])[1].toLowerCase();
  for (const [langKey, config] of Object.entries(LANGUAGE_REGISTRY)) {
    if (config.extensions.includes(ext)) return langKey;
  }
  return null;
}
function getAnalyzersForLanguage(langKey) {
  return Object.entries(PATTERN_REGISTRY)
    .filter(([, entry]) => entry.appliesTo.includes(langKey))
    .map(([id]) => id);
}
function extractMatches(text, pattern, max = 3, lineFilter = null) {
  const matches = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && matches.length < max; i++) {
    const line = lines[i];
    if (lineFilter && lineFilter(line)) continue;
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      matches.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
    }
  }
  return matches;
}
function shouldSkipFile(path, deepScan, ignoreCtx) {
  const normalized = path.replace(/\\/g, '/');
  if (ignoreCtx?.patterns?.length && isIgnoredVirtualPath(normalized, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
    return true;
  }
  if (
    /(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo\/registry|\.cargo\/git)([\/]|$)/i.test(
      normalized
    )
  )
    return true;
  if (/complete-scan.*\.json$/i.test(normalized) || /simplebeacon-export.*\.json$/i.test(normalized)) return true;
  if (!deepScan && /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|mapfiles\/|vendor\/)/i.test(normalized))
    return true;
  if (!deepScan && /\.min\.js$|\.pack\.js$|\.bundle\.js$|\.map$/i.test(normalized)) return true;
  return false;
}
function isBinary(path) {
  return BINARY_EXTENSIONS.test(path);
}
function isBinaryOrLarge(path, size) {
  return isBinary(path) || size > LARGE_FILE_THRESHOLD;
}
function runAnalyzer(name, text, filePath) {
  const results = [];
  const reg = PATTERN_REGISTRY[name];
  if (shouldSkipAnalyzerFile(name, filePath)) return results;
  if (reg && reg.pattern) {
    const lineFilter = (line) => shouldSkipAnalyzerLine(name, filePath, line);
    const matches = extractMatches(text, reg.pattern, reg.maxMatches || 5, lineFilter);
    // Apply selfReferenceFilter and contextFilter (ported from legacy scanner-patterns.js)
    const filtered = matches.filter((m) => {
      if (reg.selfReferenceFilter && reg.selfReferenceFilter.test(m.snippet)) return false;
      if (reg.selfReferenceFilter && reg.selfReferenceFilter.test(filePath)) return false;
      if (reg.contextFilter && !reg.contextFilter(m.snippet, filePath)) return false;
      return true;
    });
    if (filtered.length > 0) {
      results.push({
        analyzer: name,
        filePath,
        matches: filtered,
        count: filtered.length,
      });
    }
  }
  return results;
}
async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s: ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function resolveFile(fileEntry) {
  const fileObj = fileEntry.fileObj || fileEntry;
  if (typeof fileObj.getFile === 'function') {
    return fileObj.getFile();
  }
  return fileObj;
}
async function analyzeWithTextPatterns(file, filePath) {
  const text = await withTimeout(file.text(), FILE_READ_TIMEOUT_MS, filePath);
  const fileLang = detectFileLanguage(filePath);
  if (!fileLang) return [];
  const analyzers = getAnalyzersForLanguage(fileLang);
  const issues = [];
  for (const name of analyzers) {
    const results = runAnalyzer(name, text, filePath);
    for (const r of results) {
      if (r.matches && r.matches.length > 0) {
        issues.push({
          severity: SEVERITY_MAP[name] || 'medium',
          filePath: r.filePath,
          rule: name,
          line: r.matches[0].line,
          impact: `${r.count} ${name} finding(s) detected`,
          fix: 'Review and remediate before next release.',
          count: r.count,
          matches: r.matches,
        });
      }
    }
  }
  return issues;
}
async function scanFiles(files, deepScan, state = null) {
  const allResults = state?.allResults || [];
  const issues = state?.issues || [];
  let processed = state?.processed || 0;
  let textErrors = state?.textErrors || 0;
  let chunkAnalyzed = state?.chunkAnalyzed || 0;
  let binarySkipped = state?.binarySkipped || 0;
  let ignoredDir = state?.ignoredDir || 0;
  let heavyVendor = state?.heavyVendor || 0;
  let ignoredByPattern = state?.ignoredByPattern || 0;
  let issuesTruncated = state?.issuesTruncated || false;
  const ignoreCtx = state?.ignoreCtx || null;
  const total = state?.totalFiles || files.length;
  /**
   * Post a progress message to the main thread.
   * Called from ALL file processing paths (binary, skipped, error, analyzed)
   * so the UI doesn't appear frozen on binary-heavy projects.
   */
  const postProgress = (currentFile) => {
    if (processed % 25 === 0) {
      self.postMessage({
        type: 'progress',
        processed,
        total,
        currentFile,
        ignoredDir,
        ignoredByPattern,
        heavyVendor,
        binarySkipped,
      });
    }
  };
  for (const file of files) {
    if (issues.length >= MAX_ISSUES) {
      issuesTruncated = true;
      break;
    }
    if (shouldSkipFile(file.path, deepScan, ignoreCtx)) {
      // classify skip reason for telemetry
      const normalized = file.path.replace(/\\/g, '/');
      const DIR_EXCLUDE_RE =
        /(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo\/registry|\.cargo\/git)([\/]|$)/i;
      if (
        DIR_EXCLUDE_RE.test(normalized) ||
        /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|vendor\/)/i.test(normalized)
      ) {
        ignoredDir++;
      } else {
        ignoredByPattern++;
      }
      processed++;
      postProgress(file.path);
      // yield occasionally to keep UI responsive
      if (processed % YIELD_INTERVAL === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      continue;
    }
    try {
      const fileObj = await withTimeout(resolveFile(file), FILE_READ_TIMEOUT_MS, file.path);
      if (!fileObj || typeof fileObj.slice !== 'function') {
        textErrors++;
        processed++;
        postProgress(file.path);
        continue;
      }
      const size = fileObj.size || 0;
      if (isBinary(file.path)) {
        binarySkipped += 1;
        // telemetry
        // also map to binaryFile counter
        processed++;
        postProgress(file.path);
        if (processed % YIELD_INTERVAL === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
        continue;
      }
      if (size > LARGE_FILE_THRESHOLD) {
        // If file is very large and likely from vendor directories, avoid full-text analysis
        const normalized = file.path.replace(/\\/g, '/');
        if (!deepScan && /(?:\b|\/)(?:vendor|third_party|thirdparty|node_modules)(?:\b|\/)/i.test(normalized)) {
          heavyVendor += 1;
          processed++;
          postProgress(file.path);
          if (processed % YIELD_INTERVAL === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
          continue;
        }
        let results = [];
        try {
          results = await withTimeout(analyzeFileChunks(fileObj, file.path), CHUNK_ANALYZE_TIMEOUT_MS, file.path);
          chunkAnalyzed += 1;
        } catch (err) {
          // chunk analyzer failed or timed out - skip to avoid OOM
          heavyVendor += 1;
          processed++;
          postProgress(file.path);
          if (processed % YIELD_INTERVAL === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
          continue;
        }
        const chunkIssues = findingsToIssues(results, file.path);
        if (chunkIssues.length > 0) {
          for (const issue of chunkIssues) {
            if (issues.length >= MAX_ISSUES) {
              issuesTruncated = true;
              break;
            }
            issues.push(issue);
          }
          allResults.push({
            analyzer: 'chunkAnalyzer',
            filePath: file.path,
            matches: chunkIssues.map((i) => ({ line: i.line, snippet: i.impact })),
            count: chunkIssues.length,
          });
        }
      } else if (detectFileLanguage(file.path)) {
        const textIssues = await analyzeWithTextPatterns(fileObj, file.path);
        for (const issue of textIssues) {
          if (issues.length >= MAX_ISSUES) {
            issuesTruncated = true;
            break;
          }
          issues.push(issue);
        }
      }
      processed++;
      postProgress(file.path);
      // yield occasionally to keep main thread responsive
      if (processed % YIELD_INTERVAL === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      textErrors++;
      processed++;
      postProgress(file.path);
      try {
        self.postMessage({
          type: 'file-error',
          scanId: self.scanState?.scanId || null,
          file: file.path,
          name: err && err.name ? err.name : null,
          message: err && err.message ? err.message : String(err),
          stack: err && err.stack ? err.stack : null,
        });
      } catch (_a) {}
    }
  }
  self.postMessage({
    type: 'progress',
    processed,
    total,
    currentFile: files.length ? files[files.length - 1].path : '',
    ignoredDir,
    ignoredByPattern,
    heavyVendor,
    binarySkipped,
  });
  return {
    processed,
    totalFiles: total,
    findings: allResults,
    issues,
    issueCount: issues.length,
    chunkAnalyzed,
    binarySkipped,
    ignoredDir,
    heavyVendor,
    ignoredByPattern,
    issuesTruncated,
    allResults,
    textErrors,
  };
}
self.onmessage = async (e) => {
  const { type, files, scanId, batchOffset, totalFiles, deepScan } = e.data;
  if (type === 'scan') {
    self.postMessage({ type: 'started', scanId, totalFiles: files.length });
    try {
      const results = await scanFiles(files, deepScan);
      self.postMessage({ type: 'complete', scanId, ...results });
    } catch (err) {
      self.postMessage({ type: 'error', scanId, error: err.message });
    }
    return;
  }
  if (type === 'scan-start') {
    self.scanState = {
      scanId,
      totalFiles: totalFiles || 0,
      allResults: [],
      issues: [],
      processed: 0,
      textErrors: 0,
      chunkAnalyzed: 0,
      binarySkipped: 0,
      issuesTruncated: false,
      deepScan: Boolean(deepScan),
      ignoreCtx: e.data.ignoreCtx || null,
    };
    self.postMessage({ type: 'started', scanId, totalFiles: self.scanState.totalFiles });
    return;
  }
  if (type === 'scan-batch') {
    const state = self.scanState;
    if (!state || state.scanId !== scanId) {
      self.postMessage({ type: 'error', scanId, error: 'Scan batch received before scan-start' });
      return;
    }
    try {
      const batch = Array.isArray(files) ? files : [];
      self.postMessage({
        type: 'batch-started',
        scanId,
        batchOffset: batchOffset || 0,
        batchSize: batch.length,
        processed: state.processed,
        total: state.totalFiles,
      });
      const results = await scanFiles(batch, state.deepScan, state);
      state.allResults = results.allResults;
      state.issues = results.issues;
      state.processed = results.processed;
      state.textErrors = results.textErrors;
      state.chunkAnalyzed = results.chunkAnalyzed;
      state.binarySkipped = results.binarySkipped;
      state.issuesTruncated = results.issuesTruncated;
      self.postMessage({
        type: 'batch-complete',
        scanId,
        batchOffset: batchOffset || 0,
        processed: state.processed,
        total: state.totalFiles,
      });
    } catch (err) {
      self.postMessage({ type: 'error', scanId, error: err.message });
    }
    return;
  }
  if (type === 'scan-finish') {
    const state = self.scanState;
    if (!state || state.scanId !== scanId) {
      self.postMessage({ type: 'error', scanId, error: 'Scan finish received before scan-start' });
      return;
    }
    self.postMessage({
      type: 'complete',
      scanId,
      processed: state.processed,
      totalFiles: state.totalFiles,
      findings: state.allResults,
      issues: state.issues,
      issueCount: state.issues.length,
      chunkAnalyzed: state.chunkAnalyzed,
      binarySkipped: state.binarySkipped,
      textErrors: state.textErrors,
      issuesTruncated: state.issuesTruncated,
    });
    self.scanState = null;
  }
};
