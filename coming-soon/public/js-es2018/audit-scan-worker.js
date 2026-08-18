// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Audit Page Scan Worker — ports the dashboard's scan-worker.js approach.
 *
 * Key improvements over the legacy audit page worker:
 * 1. Reads files via FileSystemFileHandle.getFile() — actual file content access in the worker
 * 2. Supports batched scanning (scan-start / scan-batch / scan-finish protocol)
 * 3. Computes file hashes for IndexedDB cache lookups
 * 4. Streams findings back per-batch instead of accumulating all in memory
 * 5. Respects .simplebeaconignore patterns passed from the main thread
 *
 * No file contents are ever sent to the server — all scanning happens in the browser.
 */
const MAX_DISCOVERED_FILES = 999999999; // No cap — scan all files
const MAX_ISSUES = 100000;
const SCAN_BATCH_SIZE = 400;
const YIELD_INTERVAL = 500; // yield back to main thread every N files
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const FILE_READ_TIMEOUT_MS = 30000;
const CHUNK_ANALYZE_TIMEOUT_MS = 120000;
const BINARY_EXTENSIONS = /\.(exe|dll|bin|so|dylib|wasm|zip|tar|gz|tgz|bz2|7z|rar|iso|img|dmg|pkg|deb|msi|apk|ipa|woff|woff2|ttf|otf|eot|png|jpg|jpeg|gif|bmp|ico|webp|avif|svg|mp3|mp4|wav|avi|mov|mkv|webm|pdf|doc|docx|xls|xlsx|ppt|pptx|sqlite|db|lock|scx|scm|sc2map|sc2data|chk|mix|vxl|shp|tmp|mpq|w3x|w3m|nif|bik|ogv|dat|vsix|pack|bundle|map|rlib|rmeta|gguf|cab|safetensors|onnx|pt|pth|bad|whl|pyc|pyo|class|jar|aar|nupkg|dmg|crx|xpi|snap|flatpak|AppImage|idx|s2ma|s2ml|s2gs|s2vh|bank|stormmap|stormmod|replay|mng|snp|tga|dds|anim|model|fx|s2ga|s2ua|s2sa|s2ta|s2wa|s2ih|s2rh|s2ph|s2ch|s2nh|s2mh|s2dh|s2oh|s2ee|s2sb|s2gb|s2mb|s2ab|s2vb|s2lb|s2hb|s2cb|s2nb|s2pb|s2tb|s2wb|s2yb|s2zb|s2fb|s2qb|s2rb|s2xb|s2jb|s2kb|s2ib|s2eb|s2ob|s2ub)$/i;
const LANGUAGE_REGISTRY = {
    javascript: { extensions: ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'] },
    python: { extensions: ['py', 'pyw', 'pyi'] },
    java: { extensions: ['java', 'kt', 'scala', 'groovy'] },
    go: { extensions: ['go'] },
    rust: { extensions: ['rs'] },
    php: { extensions: ['php'] },
    ruby: { extensions: ['rb'] },
    dotnet: { extensions: ['cs', 'vb'] },
    generic: { extensions: ['txt', 'ini', 'cfg', 'conf', 'env', 'json', 'xml', 'yaml', 'yml', 'md', 'log', 'properties', 'toml'] }
};
const PATTERN_REGISTRY = {
    debugArtifacts: {
        appliesTo: ['javascript'],
        pattern: /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|\bdebugger\b|\balert\s*\(|\bprompt\s*\(|\bconfirm\s*\(/gi
    },
    todoMarkers: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /(?:\/\/\s*|\/\*\s*|#\s*)\b(TODO|FIXME|HACK|XXX|BUG)\b/gi
    },
    credentials: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /(?:^|[^a-zA-Z0-9_-])(password|passwd|pwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|access_token|auth_token|refresh_token|bearer_token)\s*[:=]\s*['"`][^'"`\s]{8,}/gi
    },
    euAiAct: {
        appliesTo: ['javascript', 'generic'],
        pattern: /ai_system|high_risk|transparency|conformity|bias_audit|data_governance/gi
    },
    hardcodedIp: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
    },
    pythonDebug: {
        appliesTo: ['python'],
        pattern: /\bprint\s*\(|\bpprint\s*\(|\blogging\.debug\s*\(|\bbreakpoint\s*\(/i
    },
    javaDebug: {
        appliesTo: ['java'],
        pattern: /\bSystem\.(out|err)\.(print|println)\s*\(|\be\.printStackTrace\s*\(|\bjava\.util\.logging\./i
    },
    pythonFramework: {
        appliesTo: ['python'],
        pattern: /\bDEBUG\s*=\s*True\b|\bapp\.run\s*\(\s*[^)]*debug\s*=\s*True/i
    },
    javaFramework: {
        appliesTo: ['java'],
        pattern: /spring\.datasource\.(password|url)\s*=\s*['"][^'"]{4,}|log4j.*CVE|log4shell|jndi:ldap/i
    },
    goDebug: {
        appliesTo: ['go'],
        pattern: /\bfmt\.Print(?:ln|f)?\s*\(|\blog\.Print(?:ln|f)?\s*\(|\blog\.Fatal(?:f|ln)?\s*\(|\bpanic\s*\(/i
    },
    goFramework: {
        appliesTo: ['go'],
        pattern: /\bgin\.SetMode\s*\(\s*gin\.DebugMode|http\.ListenAndServe\s*\(\s*["'][^"']+["']\s*,\s*nil\s*\)/i
    },
    rustDebug: {
        appliesTo: ['rust'],
        pattern: /\bprintln!\s*\(|\beprintln!\s*\(|\bdbg!\s*\(|\bprint!\s*\(|\bpanic!\s*\(/i
    },
    rustFramework: {
        appliesTo: ['rust'],
        pattern: /\.unwrap\s*\(\s*\)(?:\s*\?\s*\.unwrap\s*\(\s*\))+|\.expect\s*\(\s*["']\s*["']\s*\)/i
    },
    phpDebug: {
        appliesTo: ['php'],
        pattern: /\becho\s+['"]|\bvar_dump\s*\(|\bprint_r\s*\(|\bdie\s*\(|\bexit\s*\(|\bdebug_backtrace\s*\(|\btrigger_error\s*\(/i
    },
    phpFramework: {
        appliesTo: ['php'],
        pattern: /APP_DEBUG\s*=>\s*true|APP_ENV\s*=>\s*['"]local['"]|DB::raw\s*\(|mysql_query\s*\(|mysqli_query\s*\(|PDO\s*::\s*query\s*\(|eval\s*\(/i
    },
    dotnetDebug: {
        appliesTo: ['dotnet'],
        pattern: /\bConsole\.Write(Line)?\s*\(|\bDebug\.Write(Line)?\s*\(|\bTrace\.Write(Line)?\s*\(|\bDebugger\.Break\s*\(/i
    },
    dotnetFramework: {
        appliesTo: ['dotnet'],
        pattern: /connectionString\s*=\s*["'][^"']{10,}|Integrated\s+Security\s*=\s*false|Server=localhost;|\.UseInMemoryDatabase\s*\(/i
    },
    rubyDebug: {
        appliesTo: ['ruby'],
        pattern: /\bputs\s+['"]|\bp\s+['"]|\bdebugger\b|\bdebug\s+['"]|\bbinding\.irb\b|\bbinding\.pry\b|\bRails\.logger\.debug\s*\(/i
    },
    rubyFramework: {
        appliesTo: ['ruby'],
        pattern: /\.permit!\s*\)|\bskip_before_action\b|\beval\s*\(|\bsend\s*\(\s*params\[/i
    },
    sensitiveData: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|console\.(log|warn|error|info)\s*\(\s*(?:user|customer|email|password|token|ssn|phone)|localStorage\.setItem\s*\(\s*['"](?:token|auth|session|password)/i,
        maxMatches: 3,
        selfReferenceFilter: /\b(?:dev@simplebeacon\.ai|demo@simplebeacon\.ai|test@example\.com|noreply@|no-reply@|example\.com|localhost|127\.0\.0\.1|generate.*token|send.*email|email.*template|outreach|prospect|marketing|invoice|billing|payment|tier|sandbox|demo|test|fixture|mock|sample|dummy|fake|stub)\b/i,
        contextFilter: (snippet, filePath) => {
            if (/Copyright|Author:|maintainer_email|PACKAGE_BUGREPORT|license|@googlegroups\.com|@google\.com|@apache\.org|@mozilla\.org/.test(snippet)) return false;
            if (filePath && /\/(jquery|modernizr|underscore|bootstrap|lodash|moment|react|vue|angular)\b|\.min\.js$|\.pack\.js$|(^|\/)(docs\/|doc\/|third_party\/|thirdparty\/|vendor\/)\//i.test(filePath)) return false;
            return true;
        }
    },
    configDrift: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /localhost:\d+|127\.0\.0\.1:\d+|hardcoded.*url|password\s*=\s*['"]|secret\s*=\s*['"]|api_key\s*=\s*['"]/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (/config\.get<|vscode\.workspace\.getConfiguration|\.get\(['"]\w+['"]\s*,\s*['"]/.test(snippet)) return false;
            if (/\/\/.*hardcoded|\/\*.*hardcoded|move hardcoded|configuration drift/i.test(snippet)) return false;
            if (/\/\/.*localhost|\/\*.*localhost|#.*localhost|default\s*=\s*['"]http:\/\/localhost/.test(snippet)) return false;
            return true;
        }
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
        }
    },
    prototypePollution: {
        appliesTo: ['javascript', 'generic'],
        pattern: /Object\.prototype\.|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
        maxMatches: 3,
        selfReferenceFilter: /Object\.prototype\.hasOwnProperty\.call|Object\.prototype\.toString\.call/i
    },
    unhandledPromise: {
        appliesTo: ['javascript', 'generic'],
        pattern: /\.then\s*\([^)]*\)(?!\s*\.(catch|finally))\s*;?\s*$/m,
        maxMatches: 3,
        selfReferenceFilter: /await\s+\w+\.then\s*\(/i
    },
    insecureRandom: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /Math\.random\s*\(\)(?=.*(?:token|password|secret|salt|nonce|uuid|id|key))/i,
        maxMatches: 3,
        selfReferenceFilter: /scanner-patterns|scanner-engine|pattern-documentation|test-all-patterns/i
    },
    loggingSecrets: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /console\.(log|warn|error|info)\s*\([^)]*(?:password|token|secret|apiKey|api_key|privateKey|private_key|credential)/i,
        maxMatches: 3,
        selfReferenceFilter: /scanner-patterns|scanner-engine|pattern-documentation|test-all-patterns|fixRegistry|findingConverter/i,
        contextFilter: (snippet, filePath) => {
            const hasVariable = /\b(?:token|password|secret|apiKey|api_key|privateKey|private_key|credential)\s*[,+)]/.test(snippet);
            const onlyInString = /['"][^'"]*(?:token|password|secret|apiKey|api_key|privateKey|private_key|credential)[^'"]*['"]/.test(snippet);
            if (!hasVariable && onlyInString) return false;
            if (/\/\/\s*console\.(log|error|warn)/i.test(snippet)) return false;
            if (/catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/i.test(snippet)) return false;
            return true;
        }
    },
    evalDanger: {
        appliesTo: ['javascript', 'python', 'php', 'ruby', 'generic'],
        pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]/i,
        maxMatches: 3,
        selfReferenceFilter: /new\s+RegExp\s*\(|RegExp\s*\(\s*['"`]|message:\s*['"]eval\(\)|severity.*warning.*eval-usage|scanner-patterns|scanner-engine|pattern-documentation/i,
        contextFilter: (snippet, filePath) => {
            if (/new\s+RegExp\s*\(/i.test(snippet)) return false;
            return true;
        }
    },
    weakCryptography: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /\bmd5\s*\(|\bsha1\s*\(|\bDES\b|\bRC4\b|\bcrypto\.createHash\s*\(\s*['"`](?:md5|sha1)['"`]/i,
        maxMatches: 3,
        contextFilter: (snippet) => {
            if (/\/\/.*weak|deprecated|do not use|avoid/i.test(snippet)) return false;
            return true;
        }
    },
    secretInComment: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /(?:\/\/|\/\*|\*|#)\s*(?:api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`]?[a-zA-Z0-9_\-]{16,}/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (filePath && /scanner-patterns|scanner-engine|pattern-documentation/i.test(filePath)) return false;
            return true;
        }
    },
    llmSlop: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE|\[Insert\s[^\]]+\]|\/\/\s*AI\s+Generated\s+Placeholder|```(?:javascript|typescript|python|json)\s*$|```\s*$|99\.99\s*%?\s*Uptime|100\s*%?\s*Secure|Lorem\s+Ipsum|I have (written|implemented|created|updated) the .* as requested|Let me know if you need me to (adjust|update|change|modify)|AI Assistant Note:/i,
        maxMatches: 5,
        selfReferenceFilter: /llm-slop-patterns|fiction-kpi|rejectedFiction|scanner-patterns/i,
        contextFilter: (snippet, filePath) => {
            if (/\.template\.|\.example\.|\.sample\./i.test(filePath)) return false;
            if (/fixture|mock|test-data|__tests__|spec/i.test(filePath)) return false;
            if (/\.md$|\.markdown$/i.test(filePath) && /```[a-z]+\s*$/.test(snippet)) return false;
            return true;
        }
    },
    productionLeak: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /['"`][^'"`]*(?:\/|\\)mock(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*(?:\/|\\)fixtures(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*(?:\/|\\)sample(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*-sample\.json['"`]/i,
        maxMatches: 3,
        selfReferenceFilter: /production-leak|llm-slop-patterns|fiction-kpi|scanner-patterns/i,
        contextFilter: (snippet, filePath) => {
            if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
            if (/fixture|mock/i.test(filePath)) return false;
            if (/\.example\.|\.sample\.|\.template\./i.test(filePath)) return false;
            if (/dev|staging|local|test/i.test(snippet)) return false;
            return true;
        }
    },
    fictionKpi: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /\b(?:99\.9|99\.99|100)\s*%?\s*(?:uptime|availability|accuracy|success\s*rate|coverage|pass\s*rate|reliability)|\b(?:revenue|users?|customers?|downloads?|requests?|transactions?)\s*(?:=|:)\s*(?:["']?\d{4,}["']?|\d{4,}\s*(?:M|B|K|million|billion|thousand))|\b(?:TODO|FIXME)\b.*(?:fictional|placeholder|mock|sample|dummy|fake)\s+(?:data|numbers?|metrics?|kpi)/i,
        maxMatches: 3,
        selfReferenceFilter: /fiction-kpi|llm-slop-patterns|rejectedFiction|scanner-patterns|pricing\.html|site-config/i,
        contextFilter: (snippet, filePath) => {
            if (/pricing\.html|site-config\.js|\.simplebeaconignore/i.test(filePath)) return false;
            if (/fixture|mock|test|sample|demo/i.test(filePath)) return false;
            if (/(?:TODO|FIXME).*(?:fictional|placeholder|mock|sample|dummy|fake)/i.test(snippet)) return true;
            if (/\/\/.*(fictional|placeholder|mock|sample|dummy|fake|not.*real|demo|example)/i.test(snippet)) return false;
            return true;
        }
    },
    hardcodedConfidence: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /confidence\s*[:=]\s*(?:0\.\d+|["']?\d{1,3}["']?\s*%)/i,
        maxMatches: 3,
        contextFilter: (snippet) => {
            if (/config|getConfidence|default|threshold|min|max|option/i.test(snippet)) return false;
            return true;
        }
    },
    hardcodedCompletion: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /completion\s*[:=]\s*(?:0\.\d+|["']?\d{1,3}["']?\s*%)/i,
        maxMatches: 3,
        contextFilter: (snippet) => {
            if (/config|getCompletion|default|threshold|min|max|option/i.test(snippet)) return false;
            return true;
        }
    },
    mockPathLeak: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /['"`](?:[^'"`]*\/)?mock-?data\/|['"`](?:[^'"`]*\/)?test-?fixtures\/|['"`](?:[^'"`]*\/)?sample-?data\//i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
            return true;
        }
    },
    sampleJsonRef: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /['"`][^'"`]*sample[^'"`]*\.json['"`]|['"`][^'"`]*mock[^'"`]*\.json['"`]/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
            return true;
        }
    },
    emptyStubFunction: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\}|=>\s*\{\s*\}|def\s+\w+\s*\([^)]*\)\s*:\s*pass\b|\bpass\b\s*$/m,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (/test|spec|__tests__|\.test\.|\.spec\.|fixture|mock|stub|interface|abstract|protocol|trait/i.test(filePath)) return false;
            if (/\/\/\s*(?:stub|placeholder|todo|implement later|not yet implemented)/i.test(snippet)) return true;
            if (/export\s+(?:async\s+)?function|export\s+const|export\s+default|module\.exports/i.test(snippet)) return false;
            return true;
        }
    },
    roadmapMarker: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /\/\/\s*(?:ROADMAP|PLANNED|FUTURE|NEXT|BACKLOG|LATER)\b|\/\*\s*(?:ROADMAP|PLANNED|FUTURE|NEXT|BACKLOG|LATER)\b|#\s*(?:ROADMAP|PLANNED|FUTURE|NEXT|BACKLOG|LATER)\b/i,
        maxMatches: 3
    },
    aiPlaceholderComment: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /\/\/\s*(?:AI\s+generated|Generated\s+by\s+(?:AI|Copilot|ChatGPT|Claude|GPT)|This\s+code\s+was\s+generated|Auto-generated|Do\s+not\s+edit|This\s+file\s+was\s+auto)/i,
        maxMatches: 3
    },
    markdownFenceLeak: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'generic'],
        pattern: /```(?:javascript|typescript|python|json)\s*$/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (/\.md$|\.markdown$|\.mdx$/i.test(filePath)) return false;
            return true;
        }
    },
    missingRateLimit: {
        appliesTo: ['javascript', 'generic'],
        pattern: /app\.(get|post|put|delete|patch)\s*\(\s*['"][^'"]+['"]/i,
        maxMatches: 3,
        selfReferenceFilter: /rateLimit|rate-limit|throttle|scanner-patterns/i,
        contextFilter: (snippet) => {
            if (/rateLimit|rate-limit|throttle/i.test(snippet)) return false;
            return true;
        }
    },
    dbAntiPattern: {
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby', 'generic'],
        pattern: /SELECT\s+.*['"]\s*\+\s*['"]|query\s*\(\s*['"].*\+\s*['"]|raw\s*\(\s*['"].*\$\{|\.findAll\s*\(\s*\)(?!.*limit)/i,
        maxMatches: 3
    }
};
const SEVERITY_MAP = {
    credentials: 'critical',
    euAiAct: 'high',
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
    dbAntiPattern: 'high'
};
const CREDENTIAL_ALLOWLIST = /placeholder|changeme|example\.com|your-api-key|your-secret|dummy-token|test-secret|fake-api|mock-secret|not-a-real|hardcoded-secret-for-unit-test|secret-key-for-unit-test|sk_test_your|xxxxxxxx|replace_me|sample-token|template-secret|programmatically generated/i;
const IGNORE_LINE_RE = /simplebeacon-ignore\s+(?:credentials|credential-pattern|sensitive-data|euAiAct|eu-ai-act)/i;
const EU_AI_ACT_COMPLIANCE_LINE_RE = /EU AI Act Documentation Marker|Documentation Marker|Annex III|Article\s*50|Article\s*12|euAiActCompliance|euAiAct|transparency disclosure|buildTransparency|providerTransparency|ScopeTransparency|aiSystemDisclosure|humanInTheLoop|human-in-the-loop|humanInTheLoop|human oversight|inference events logged|Risk Level:|Limited risk|not legal conformity|technical readiness|transparencyGaps|highRiskIndicators|aiSystemIndicators|documentationArtifacts|legal conformity|Disclaimer:/i;

// === Inline .simplebeaconignore support (self-contained — no ES module imports) ===
const _globRegexCache = new Map();
function globToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    let regex = '^';
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        if (c === '*' && pattern[i + 1] === '*') {
            i++;
            if (pattern[i + 1] === '/') { regex += '(?:.*/)?'; i++; }
            else { regex += '.*'; }
        } else if (c === '*') {
            regex += '[^/]*';
        } else if (c === '?') {
            regex += '[^/]';
        } else {
            regex += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    regex += '$';
    try { return new RegExp(regex); } catch { return /(?!)/; }
}
function cachedGlobToRegex(pattern) {
    if (typeof pattern !== 'string') return /(?!)/;
    if (_globRegexCache.has(pattern)) return _globRegexCache.get(pattern);
    const re = globToRegex(pattern);
    _globRegexCache.set(pattern, re);
    return re;
}
function pathMatchCandidates(virtualPath, scanRootName) {
    const normalized = String(virtualPath).replace(/\\/g, '/');
    const candidates = [normalized];
    if (scanRootName && normalized.startsWith(scanRootName + '/')) {
        candidates.push(normalized.slice(scanRootName.length + 1));
    }
    if (normalized.startsWith('./')) {
        candidates.push(normalized.slice(2));
    }
    return candidates;
}
function isIgnoredVirtualPath(virtualPath, scanRootName, ignorePatterns) {
    if (!ignorePatterns || !ignorePatterns.length) return false;
    const candidates = pathMatchCandidates(virtualPath, scanRootName);
    for (const pattern of ignorePatterns) {
        if (!pattern || pattern.startsWith('#')) continue;
        const isNegation = pattern.startsWith('!');
        const cleanPattern = isNegation ? pattern.slice(1) : pattern;
        const regex = cachedGlobToRegex(cleanPattern);
        for (const candidate of candidates) {
            if (regex.test(candidate)) {
                if (isNegation) return false;
                return true;
            }
        }
    }
    return false;
}

function isTestOrFixturePath(normalized) {
    return /(?:^|\/)(__tests__|tests?|fixtures?|mocks?|simplebeacon-rule-tests)(?:\/|$)/i.test(normalized)
        || /\.(test|spec)\.[a-z0-9]+$/i.test(normalized);
}
function isComplianceToolingPath(normalized) {
    return /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|lib|mcp|analyzers|reporters)\//i.test(normalized)
        || /(?:^|\/)(?:coming-soon|simplebeacon-vscode-merged|simplebeacon-vscode)(?:\/|$)/i.test(normalized)
        || /(?:^|\/)dashboard-web\//i.test(normalized)
        || /public\/dashboard\//i.test(normalized)
        || /web\/simplebeacon-dashboard\/js(?:-es2018)?\/(?:services|workers|views)\//i.test(normalized)
        || /server\/routes\/(?:chatbot-api|flexible-analyze-api)\.cjs$/i.test(normalized)
        || /src\/api\/trust-api\.cjs$/i.test(normalized)
        || /eu-ai-act|scanner-patterns|scanner-engine|compliance-mapper|credential-pattern-scanner|enterprise-guardrail|llm-slop-catalog|aiProblemAnalyzerSuite|extendedAnalyzers/i.test(normalized);
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
function extractMatches(text, pattern, max, lineFilter) {
    const matches = [];
    const lines = text.split('\n');
    const MAX_LINE_LEN = 5000;
    for (let i = 0; i < lines.length && matches.length < max; i++) {
        let line = lines[i];
        if (line.length > MAX_LINE_LEN) {
            if (/\{2000,\}/.test(pattern.source || pattern)) {
                if (!pattern.test(line.slice(0, MAX_LINE_LEN))) continue;
            } else {
                continue;
            }
        }
        if (lineFilter && lineFilter(line)) continue;
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
            matches.push({
                line: i + 1,
                snippet: line.trim().slice(0, 120),
                context: [
                    lines[Math.max(0, i - 1)]?.trim().slice(0, 100) || null,
                    line.trim().slice(0, 120),
                    lines[Math.min(lines.length - 1, i + 1)]?.trim().slice(0, 100) || null
                ].filter(Boolean)
            });
        }
    }
    return matches;
}
function shouldSkipFile(path, deepScan, ignoreCtx) {
    const normalized = path.replace(/\\/g, '/');
    if (ignoreCtx && ignoreCtx.patterns && ignoreCtx.patterns.length && isIgnoredVirtualPath(normalized, ignoreCtx.scanRootName, ignoreCtx.patterns)) {
        return true;
    }
    if (/(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo\/registry|\.cargo\/git)([\/]|$)/i.test(normalized))
        return true;
    if (!deepScan && /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|vendor\/)/i.test(normalized))
        return true;
    if (!deepScan && /\.min\.js$|\.pack\.js$|\.bundle\.js$|\.map$/i.test(normalized))
        return true;
    return false;
}
function isBinary(path) {
    return BINARY_EXTENSIONS.test(path);
}
function runAnalyzer(name, text, filePath) {
    const results = [];
    const reg = PATTERN_REGISTRY[name];
    if (shouldSkipAnalyzerFile(name, filePath)) return results;
    if (reg && reg.pattern) {
        const lineFilter = (line) => shouldSkipAnalyzerLine(name, filePath, line);
        const matches = extractMatches(text, reg.pattern, reg.maxMatches || 5, lineFilter);
        const filtered = matches.filter(m => {
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
                count: filtered.length
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
            })
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
                    matches: r.matches
                });
            }
        }
    }
    return issues;
}

// Simple hash for cache key — fast, non-crypto
async function simpleHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return 'h' + (hash >>> 0).toString(36);
}

// === Batched scan state ===
// Supports scan-start / scan-batch / scan-finish protocol for multi-batch scanning
async function scanFiles(files, deepScan, state) {
    const allResults = state ? state.allResults : [];
    const issues = state ? state.issues : [];
    let processed = state ? state.processed : 0;
    let textErrors = state ? state.textErrors : 0;
    let binarySkipped = state ? state.binarySkipped : 0;
    let ignoredDir = state ? state.ignoredDir : 0;
    let heavyVendor = state ? state.heavyVendor : 0;
    let ignoredByPattern = state ? state.ignoredByPattern : 0;
    let issuesTruncated = state ? state.issuesTruncated : false;
    const ignoreCtx = state ? state.ignoreCtx : null;
    const total = state ? state.totalFiles : files.length;
    const fileHashes = state ? state.fileHashes : []; // collected for IndexedDB cache
    const postProgress = (currentFile) => {
        if (processed % 25 === 0) {
            self.postMessage({ type: 'progress', processed, total, currentFile, ignoredDir, ignoredByPattern, heavyVendor, binarySkipped });
        }
    };
    for (const file of files) {
        if (issues.length >= MAX_ISSUES) {
            issuesTruncated = true;
            break;
        }
        if (shouldSkipFile(file.path, deepScan, ignoreCtx)) {
            const normalized = file.path.replace(/\\/g, '/');
            const DIR_EXCLUDE_RE = /(^|[\/])(node_modules|\.git|\.github|\.husky|dist|build|\.next|out|coverage|frontend-build|\.github-sync|github-cache|\.simplebeacon|\.cursor|\.windsurf|deployments|backups|\.vscode-test|\.vsix-patch-temp|logs|cache|\.cache|tmp|temp|target|\.wrangler|\.cargo\/registry|\.cargo\/git)([\/]|$)/i;
            if (DIR_EXCLUDE_RE.test(normalized) || /(^|[\/])(docs\/|doc\/|third_party\/|thirdparty\/|vendor\/)/i.test(normalized)) {
                ignoredDir++;
            } else {
                ignoredByPattern++;
            }
            processed++;
            postProgress(file.path);
            if (processed % YIELD_INTERVAL === 0) await new Promise(r => setTimeout(r, 0));
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
                processed++;
                postProgress(file.path);
                if (processed % YIELD_INTERVAL === 0) await new Promise(r => setTimeout(r, 0));
                continue;
            }
            // Read text and compute hash for cache lookup
            const text = await withTimeout(fileObj.text(), FILE_READ_TIMEOUT_MS, file.path);
            const hash = await simpleHash(text);
            fileHashes.push({ path: file.path, hash, size });

            // Post hash back to main thread for IndexedDB cache check
            self.postMessage({ type: 'file-hash', scanId: self.scanState ? self.scanState.scanId : null, path: file.path, hash, size });

            const fileLang = detectFileLanguage(file.path);
            if (fileLang) {
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
            if (processed % YIELD_INTERVAL === 0) await new Promise(r => setTimeout(r, 0));
        } catch (err) {
            textErrors++;
            processed++;
            postProgress(file.path);
            try {
                self.postMessage({
                    type: 'file-error',
                    scanId: self.scanState ? self.scanState.scanId : null,
                    file: file.path,
                    name: err && err.name ? err.name : null,
                    message: err && err.message ? err.message : String(err)
                });
            } catch (_) {}
        }
    }
    self.postMessage({ type: 'progress', processed, total, currentFile: files.length ? files[files.length - 1].path : '', ignoredDir, ignoredByPattern, heavyVendor, binarySkipped });
    return {
        processed, totalFiles: total, findings: allResults, issues,
        issueCount: issues.length, binarySkipped, ignoredDir, heavyVendor,
        ignoredByPattern, issuesTruncated, allResults, textErrors, fileHashes
    };
}

// === Message handler ===
self.onmessage = async (e) => {
    const { type, files, scanId, batchOffset, totalFiles, deepScan } = e.data;
    if (type === 'scan') {
        // Legacy single-shot scan mode
        self.postMessage({ type: 'started', scanId, totalFiles: files.length });
        try {
            const results = await scanFiles(files, deepScan, null);
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
            binarySkipped: 0,
            issuesTruncated: false,
            deepScan: Boolean(deepScan),
            ignoreCtx: e.data.ignoreCtx || null,
            fileHashes: []
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
            self.postMessage({ type: 'batch-started', scanId, batchOffset: batchOffset || 0, batchSize: batch.length, processed: state.processed, total: state.totalFiles });
            const results = await scanFiles(batch, state.deepScan, state);
            state.allResults = results.allResults;
            state.issues = results.issues;
            state.processed = results.processed;
            state.textErrors = results.textErrors;
            state.binarySkipped = results.binarySkipped;
            state.issuesTruncated = results.issuesTruncated;
            state.fileHashes = results.fileHashes;
            self.postMessage({
                type: 'batch-complete',
                scanId,
                batchOffset: batchOffset || 0,
                processed: state.processed,
                total: state.totalFiles,
                issueCount: state.issues.length,
                // Stream findings back per-batch to avoid accumulating everything in worker memory
                batchIssues: results.issues.slice(-(results.issues.length - (state._lastIssueCount || 0)))
            });
            state._lastIssueCount = state.issues.length;
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
            binarySkipped: state.binarySkipped,
            ignoredDir: state.ignoredDir,
            heavyVendor: state.heavyVendor,
            ignoredByPattern: state.ignoredByPattern,
            issuesTruncated: state.issuesTruncated,
            textErrors: state.textErrors,
            fileHashes: state.fileHashes
        });
        self.scanState = null;
        return;
    }
};
