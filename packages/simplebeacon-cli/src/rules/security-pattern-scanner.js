// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Security pattern scanner — ports browser security patterns to CLI.
 * Detects eval, XSS, prototype pollution, unvalidated redirects,
 * missing rate limits, insecure random, and secret logging.
 */

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".php",
  ".rb",
  ".go",
  ".java",
  ".json",
  ".yaml",
  ".yml",
  ".env",
  ".sh",
  ".bash",
  ".dockerfile",
  ".tf",
  ".cfg",
  ".conf",
  ".ini",
  ".xml",
  ".gradle",
  ".cs",
  ".mod",
]);

const { resolveMaxScanBytes } = require("../config");
const { classifyPath } = require("../lib/path-context");
const { getStandardsForFinding } = require("../lib/standards-map");

const RULE_TYPE_MAP = {
  "SB-SEC-001": "eval-danger",
  "SB-SEC-002": "inner-html-xss",
  "SB-SEC-003": "prototype-pollution",
  "SB-SEC-004": "unhandled-promise",
  "SB-SEC-005": "unvalidated-redirect",
  "SB-SEC-006": "missing-rate-limit",
  "SB-SEC-007": "insecure-random",
  "SB-SEC-008": "logging-secrets",
  "SB-SEC-009": "config-drift",
  "SB-SEC-010": "sensitive-data",
  "SB-SEC-011": "insecure-random",
  "SB-SEC-012": "performance",
  "SB-SEC-013": "sensitive-data",
  "SB-SEC-014": "gcp-service-account",
  "SB-SEC-015": "azure-key",
  "SB-SEC-016": "oauth-token",
  "SB-SEC-017": "docker-privileged",
  "SB-SEC-018": "docker-root-user",
  "SB-SEC-019": "docker-exposed-secrets",
  "SB-SEC-020": "docker-no-healthcheck",
  "SB-SEC-021": "suspicious-package",
  "SB-SEC-022": "postinstall-script",
  "SB-SEC-023": "unpinned-dependency",
  "SB-SEC-024": "gcp-sa-impersonation",
  "SB-SEC-025": "gcp-iam-privilege",
  "SB-SEC-026": "command-injection-rce",
  "SB-SEC-027": "supply-chain-curl-pipe",
  "SB-SEC-028": "llm-unconstrained-exec",
  "SB-SEC-029": "chromium-sandbox-disable",
  "SB-SEC-030": "cloud-metadata-token",
  "SB-SEC-031": "insecure-deserialization",
  "SB-SEC-032": "sql-injection",
  "SB-SEC-033": "broken-object-reference",
  "SB-SEC-034": "insecure-session-cookie",
  "SB-SEC-035": "copyleft-license",
  "SB-SEC-036": "log4j-dependency",
  "SB-SEC-037": "ai-guardrail-disabled",
  "SB-SEC-038": "jwt-unverified",
  "SB-SEC-039": "oauth-open-redirect",
  "SB-SEC-040": "imagemagick-unsanitized",
  "SB-SEC-041": "unrestricted-file-upload",
  "SB-SEC-042": "weak-password-hash",
  "SB-SEC-043": "payment-state-skip",
  "SB-SEC-044": "tls-verify-disabled",
  "SB-SEC-045": "permissive-cors",
};

const SECURITY_RULES = [
  {
    id: "SB-SEC-001",
    name: "Dangerous eval() Usage",
    regex:
      /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]|child_process\.exec\s*\(|shell\.exec\s*\(|\bsystem\s*\(/i,
    severity: "high",
    skipFiles:
      /security-pattern-scanner\.js$|enhancedAIProvider\.ts$|realtimeMonitor\.ts$|workspaceAnalyzer\.ts$|findingConverter\.ts$|remediationProvider\.ts$|coming-soon|AnalyzeView\.js$|AnalyzeResultsPanel\.js$/i,
    description:
      "eval(), new Function(), or dynamic code execution — code injection risk",
  },
  {
    id: "SB-SEC-002",
    name: "innerHTML XSS Risk",
    regex: /\.innerHTML\s*=\s*[^'"]/i,
    severity: "medium",
    skipFiles:
      /codeMapTreeProvider\.(ts|js)$|simplebeacon-dashboard\/(?:js|js-es2018)\/.*\.js$/i,
    description: "Assigning to innerHTML without sanitization — XSS risk",
  },
  {
    id: "SB-SEC-003",
    name: "Prototype Pollution Risk",
    regex:
      /Object\.prototype\s*=\s*[^=]|Object\.prototype\.[a-zA-Z_$][\w$]*\s*=\s*[^=]|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
    severity: "high",
    description:
      "Modifying Object.prototype or __proto__ — prototype pollution vulnerability",
  },
  {
    id: "SB-SEC-004",
    name: "Unhandled Promise Rejection",
    regex:
      /\.(then|finally)\s*\((?:[^()\n]|\([^)\n]*\))*\)(?!\s*\.(catch|then|finally))\s*;?\s*\}?$/m,
    severity: "medium",
    description: "Promise chain missing .catch() handler — unhandled rejection",
  },
  {
    id: "SB-SEC-005",
    name: "Unvalidated Redirect",
    regex:
      /window\.location\s*=\s*[^'"\s]|window\.location\.href\s*=\s*[^'"\s]|window\.location\.replace\s*\(\s*[^'"\s]|res\.redirect\s*\(\s*(?:\d+\s*,\s*)?[^'"\s]|res\.redirect\s*\(\s*req\.(body|query|params)\.|location\.href\s*=\s*req\./i,
    severity: "high",
    description:
      "Redirect with user-controlled input — open redirect vulnerability",
  },
  {
    id: "SB-SEC-006",
    name: "Missing Rate Limiting",
    regex:
      /app\.(get|post|put|delete|patch)\s*\([^)]*\)(?!.*rateLimit|.*throttle|.*limiter)/is,
    severity: "medium",
    skipFiles: /local-agent\/agent\.js$|server\/routes\//i,
    description: "API endpoint without rate limiting — DoS vulnerability",
  },
  {
    id: "SB-SEC-007",
    name: "Insecure Random for Security",
    regex:
      /Math\.random\s*\(\)(?=.*(?:token|password|secret|salt|nonce|uuid|id|key))/i,
    severity: "high",
    description: "Math.random() used for crypto/security — predictable values",
    skipFiles:
      /(?:security-pattern-scanner|weak-crypto-scanner|scanner-patterns)\.(?:js|mjs|cjs)$/i,
  },
  {
    id: "SB-SEC-008",
    name: "Sensitive Data in Logs",
    regex:
      /console\.(log|warn|error|info)\s*\([^)]*(?:password\s*[:=]|secret\s*[:=]|apiKey\s*[:=]|api_key\s*[:=]|privateKey\s*[:=]|private_key\s*[:=]|credential\s*[:=]|token\s*[:=])/i,
    severity: "high",
    description: "Password, token, or secret value being logged",
  },
  {
    id: "SB-SEC-009",
    name: "Committed .env File",
    regex: /./,
    severity: "critical",
    description:
      ".env file committed to repository — environment secrets exposed",
    skipFiles:
      /\.env\.example$|\.env\.sample$|\.env\.template$|\.env\.local\.example$/i,
    pathOnly: true,
    pathRegex: /(^|[\\/])\.env$/,
  },
  {
    id: "SB-SEC-010",
    name: "Secret in Comment",
    regex:
      /(?:\/\/|\/\*|\*|#)\s*(?:api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`]?[a-zA-Z0-9_\-]{16,}/i,
    severity: "high",
    description: "Credential or secret value found in code comment",
  },
  {
    id: "SB-SEC-011",
    name: "Weak Cryptography",
    regex:
      /\bmd5\s*\(|\bsha1\s*\(|\bDES\b|\bRC4\b|\bTripleDES\b|\b3DES\b|\bcrypto\.createHash\s*\(\s*['"`][ms]d5['"`]|\bcrypto\.createHash\s*\(\s*['"`]sha1['"`]/i,
    severity: "high",
    skipFiles: /security-pattern-scanner\.js$/i,
    description: "Weak hash/cipher (MD5, SHA1, DES, RC4) — use SHA-256+ or AES",
  },
  {
    id: "SB-SEC-012",
    name: "ReDoS Risk",
    regex:
      /\(\[\^\]\]\*\)\*|\(\[\^\]\]\+\)\+|\(\[\^\]\]\*\)\+|\(\[\^\]\]\+\)\*|\(\(\?:\[\^\]\]\*\)\+\)\*|\(\[\^\]\]\*\)\{[0-9,]*\}\*|\(\[\^\]\]\*\)\*\+|\(\[\^\]\]\+\)\*\+|\(\[\^\]\]\*\)\?\*|\(\[\^\]\]\+\)\?\*/i,
    severity: "medium",
    description: "Regular expression with nested quantifiers — potential ReDoS",
  },
  {
    id: "SB-SEC-013",
    name: "CI/CD Secret Exposure",
    regex:
      /(?:GITHUB_TOKEN|GH_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|DOCKER_PASSWORD|NPM_TOKEN|SLACK_TOKEN|SONAR_TOKEN)\s*[:=]\s*['"`]?[^\s'"`]{8,}/i,
    severity: "critical",
    description: "Hardcoded CI/CD secret in workflow/config file",
    pathRegex: /\.(yml|yaml|json)$/,
  },
  // === Advanced Cloud IAM & Secret Detection (ported from browser scanner) ===
  {
    id: "SB-SEC-014",
    name: "GCP Service Account Key (Cloud VRP Tier-1)",
    regex:
      /"type"\s*:\s*"service_account"|"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----|projects\/\d+\/secrets\/|GOOGLE_APPLICATION_CREDENTIALS\s*[:=]\s*['"`][^'"`]+['"`]/i,
    severity: "critical",
    description:
      "CRITICAL: Hardcoded GCP service account configuration matches Google Cloud VRP Tier-1 impersonation/credential-theft signature. A leaked JSON key lets an attacker act as that identity.",
    recommendedAction:
      "Rotate and disable the key in IAM, move credentials to Secret Manager or Workload Identity, and purge the file from git history.",
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder|template/i,
  },
  {
    id: "SB-SEC-015",
    name: "Azure Storage Key",
    regex:
      /AccountKey\s*=\s*[A-Za-z0-9+/=]{88}|DefaultEndpointsProtocol.*AccountKey\s*=\s*[A-Za-z0-9+/=]{50,}|AZURE_CLIENT_SECRET\s*[:=]\s*['"`][A-Za-z0-9_\-]{34,}['"`]/i,
    severity: "critical",
    description:
      "Azure storage account key or client secret detected in source",
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder|template/i,
  },
  {
    id: "SB-SEC-016",
    name: "OAuth Token in Source",
    regex:
      /(?:access_token|refresh_token|oauth_token)\s*[:=]\s*['"`](?:ya29\.|gh[opsu]_|xox[bpoa]-|sk_live_|rk_live_)[A-Za-z0-9_\-]{10,}/i,
    severity: "high",
    description:
      "Hardcoded OAuth access/refresh token from Google, GitHub, Slack, or Stripe",
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder|template/i,
  },
  // === Docker / Container Misconfiguration ===
  {
    id: "SB-SEC-017",
    name: "Docker Privileged Mode",
    regex: /privileged\s*:\s*true|--privileged/i,
    severity: "high",
    description:
      "Container running in privileged mode — grants full host access",
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /docker-compose|compose\.ya?ml|Dockerfile|\.docker/i,
  },
  {
    id: "SB-SEC-018",
    name: "Docker Root User",
    regex: /USER\s+root\b(?!.*(?:\s+#|\s*&&))/i,
    severity: "medium",
    description: "Container running as root user — privilege escalation risk",
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /Dockerfile|dockerfile|\.docker/i,
  },
  {
    id: "SB-SEC-019",
    name: "Docker Exposed Secrets",
    regex:
      /(?:ENV|environment)\s+(?:[A-Z_]*SECRET|[A-Z_]*PASSWORD|[A-Z_]*KEY|[A-Z_]*TOKEN)\s*=\s*['"]?[A-Za-z0-9_\-]{8,}['"]?(?!\s*\$\{)/i,
    severity: "critical",
    description:
      "Hardcoded secret in Docker ENV directive — visible in image layers",
    skipFiles: /test|spec|fixture|mock|example|sample|placeholder/i,
    snippetExclusions:
      /changeme|example|placeholder|your-secret|replace_me|XXXX/i,
  },
  {
    id: "SB-SEC-020",
    name: "Docker Missing Health Check",
    regex: /FROM\s+/i,
    severity: "low",
    description:
      "Dockerfile has no HEALTHCHECK instruction — orchestrator cannot monitor container health",
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /Dockerfile|dockerfile/i,
    negativeRegex: /HEALTHCHECK\s+/i,
  },
  // === Supply Chain Checks ===
  {
    id: "SB-SEC-021",
    name: "Suspicious Package Install",
    regex:
      /(?:from\s+['"]|require\s*\(\s*['"]|import\s+['"])(?:[^'"]*npm[^'"]*|[^'"]*typosquat)[^'"]*['"]|(?:npm|yarn|pnpm)\s+install\s+[@a-z0-9_\-]+(?:[a-z0-9_\-]*\.js|\.nodejs|nodejs|nodjs|nodel|node-js)/i,
    severity: "high",
    description:
      "Suspicious npm package name — possible typosquat or malicious package",
    skipFiles:
      /test|spec|fixture|mock|example|package\.json|package-lock\.json|yarn\.lock/i,
  },
  {
    id: "SB-SEC-022",
    name: "Malicious postinstall Script",
    regex:
      /"postinstall"\s*:\s*['"`](?:curl|wget|node\s+-e|python\s+-c|bash\s+-c|powershell|sh\s+-c)/i,
    severity: "high",
    description:
      "postinstall script executes network call or dynamic code — supply chain attack vector",
    skipFiles: /test|spec|fixture|mock|example/i,
  },
  {
    id: "SB-SEC-023",
    name: "Unpinned Dependency Version",
    regex:
      /"(?:dependencies|devDependencies)"\s*:\s*\{[^}]*"[a-z@][^"]*"\s*:\s*['"`](?:\^|~|latest|\*|>=)/i,
    severity: "medium",
    description:
      "Dependency uses unpinned version (^, ~, latest, *) — reproducibility and supply chain risk",
    skipFiles: /test|spec|fixture|mock|example/i,
    pathRegex: /package\.json$/i,
  },
  {
    id: "SB-SEC-024",
    name: "GCP Service Account Impersonation",
    regex:
      /impersonate[_-]?service[_-]?account|ImpersonatedCredentials|generateAccessToken|roles\/iam\.serviceAccountTokenCreator|roles\/iam\.serviceAccountUser|--impersonate-service-account/i,
    severity: "high",
    description:
      "HIGH: GCP service-account impersonation API or IAM role (serviceAccountTokenCreator / generateAccessToken). Cloud VRP scores this as a privilege-escalation delta — a low-priv identity can mint tokens for a higher-priv SA.",
    recommendedAction:
      "Restrict TokenCreator/User bindings, require IAM Conditions, and prefer Workload Identity over key-based impersonation.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-025",
    name: "GCP Public or Primitive IAM Role",
    regex:
      /members?\s*[:=]\s*\[?\s*["']allUsers["']|["']allAuthenticatedUsers["']|roles\/(owner|editor)\b/i,
    severity: "high",
    description:
      "HIGH: IAM grants allUsers/allAuthenticatedUsers or primitive Owner/Editor roles. This is a Cloud VRP-class privilege gap: unauthenticated or overly broad identities reach admin-equivalent access.",
    recommendedAction:
      "Replace primitive roles with predefined/custom roles, remove allUsers on data/admin resources, and use IAM Conditions.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
    pathRegex: /\.(tf|json|ya?ml)$|iam|policy|bindings/i,
  },
  {
    id: "SB-SEC-026",
    name: "Command Injection / RCE Sink",
    regex:
      /child_process\.(exec|execSync)\s*\(\s*[`'"][^`'"]*\$\{|child_process\.(exec|execSync)\s*\(\s*[^'"\s].*(?:req\.|request\.|params\.|query\.|body\.)|subprocess\.(run|Popen|call)\s*\([^)]*shell\s*=\s*True|os\.system\s*\(\s*(?:f["']|["'][^"']*\{)/i,
    severity: "critical",
    description:
      "CRITICAL: User-influenced or interpolated shell execution (command injection / RCE class). Google Cloud VRP pays top tier for unauthenticated RCE on in-scope services.",
    recommendedAction:
      "Use argv arrays (execFile/spawn without shell), never interpolate untrusted input into a shell string, and sandbox subprocesses.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-027",
    name: "Supply-Chain Curl-Pipe Install",
    regex:
      /curl\s+[^\n|;]*\|\s*(?:sudo\s+)?(?:bash|sh)\b|wget\s+[^\n|;]*\|\s*(?:sudo\s+)?(?:bash|sh)\b|pip\s+install\s+[^\n]*--trusted-host/i,
    severity: "high",
    description:
      "HIGH: Install pipeline pipes remote content into a shell (or pip --trusted-host). OSS/supply-chain VRP class — a compromised URL injects into every downstream build.",
    recommendedAction:
      "Pin installer checksums, use package managers with lockfiles, and never pipe curl to sh in CI or Docker.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-028",
    name: "LLM Agent Unconstrained Shell Tool",
    regex:
      /(?:function_call|tool_call|agent_tool|tools?\s*[:=]).{0,120}(?:child_process|os\.system|subprocess|execSync)|(?:run_shell_command|execute_shell|exec_command)\s*[:=]/i,
    severity: "high",
    description:
      "HIGH: LLM/agent tool can run a shell. AI VRP in-scope is structural compromise (rogue tool actions / data exfil), not jailbreak prose. Unallowlisted exec lets a prompt injection run host commands.",
    recommendedAction:
      "Allowlist tools, never expose a raw shell to the model, and require human approval for side-effecting actions.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-029",
    name: "Chromium/Electron Sandbox Disabled",
    regex:
      /nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false|webSecurity\s*:\s*false|enableRemoteModule\s*:\s*true|allowRunningInsecureContent\s*:\s*true/i,
    severity: "high",
    description:
      "HIGH: Electron/Chromium sandbox controls are disabled (nodeIntegration, contextIsolation, webSecurity). Chrome VRP values sandbox-escape stepping stones even before full data theft.",
    recommendedAction:
      "Keep contextIsolation true, nodeIntegration false, webSecurity true, and load renderer code only from app origin.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-030",
    name: "Cloud Metadata Token Fetch",
    regex:
      /(?:169\.254\.169\.254|metadata\.google\.internal)[^\n]{0,80}(?:token|service-accounts)/i,
    severity: "high",
    description:
      "HIGH: Code talks to the cloud instance metadata service for tokens. Combined with SSRF this is a Cloud VRP-class service-account hijack (default compute SA).",
    recommendedAction:
      "Block IMDS from user-controlled URLs, require Metadata-Flavor headers only on trusted paths, and use least-privilege attached SAs.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-031",
    name: "Insecure Deserialization (OWASP)",
    regex:
      /pickle\.load(?:s)?\s*\(|yaml\.unsafe_load\s*\(|yaml\.load\s*\((?![\s\S]{0,80}SafeLoader)|unserialize\s*\(\s*\$_(?:COOKIE|POST|GET|REQUEST)|unserialize\s*\(\s*(?:req\.|request\.)|new\s+ObjectInputStream\s*\(|BinaryFormatter|Marshal\.load\s*\(|JSON\.parse\s*\(\s*(?:req\.|request\.)/i,
    severity: "critical",
    productionOnly: true,
    description:
      "CRITICAL: Untrusted input is deserialized with pickle, yaml.load, unserialize, or equivalent. CWE-502 — replace with schema-checked JSON or a safe loader.",
    recommendedAction:
      "Do not deserialize request, cookie, or file bytes with pickle/unsafe YAML/PHP unserialize. Use JSON Schema or yaml.safe_load, and reject unexpected types.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-032",
    name: "SQL Injection Concatenation (OWASP)",
    regex:
      /(?:execute|query|raw)\s*\(\s*(?:f["']|(?:["'`][^"'`]*["'`]\s*\+)|[`"'][^`"']*\$\{)|(?:SELECT|INSERT|UPDATE|DELETE)\s+[^;]{0,60}["'`]\s*\+\s*(?:req\.|request\.|params\.|user)/i,
    severity: "critical",
    description:
      "CRITICAL: SQL built by concatenation or interpolation with request data. OWASP A03 / SANS Top 25 — multi-tenant enterprise APIs lose data isolation.",
    recommendedAction:
      "Use parameterized queries/bind variables only; never concatenate user input into SQL.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-033",
    name: "Broken Object Reference (IDOR)",
    regex:
      /(?:findById|findOne|findByPk|getById|find_by_id|get_object_or_404)\s*\(\s*(?:req|request)\.(?:params|query|body)|findOne\s*\(\s*\{\s*_?id\s*:\s*(?:req|request)\.|User\.(?:find|get|query)\s*\(\s*(?:req|request)\.(?:params|query)|(?:User|Account|Order)\.query\.get\s*\(\s*request\.(?:args|GET)|::find\s*\(\s*\$_GET/i,
    severity: "high",
    productionOnly: true,
    windowLines: 4,
    // Heuristic only: mute when a tenant/session principal appears in a ±4 line window.
    // Not an AST; a check 20 lines away or in middleware still flags.
    windowExclusions:
      /(?:req|request)\.user\.(?:id|tenantId|orgId|organizationId|workspaceId|accountId|companyId)|(?:req|request)\.(?:session|auth)\.|tenantId\s*[:=]|orgId\s*[:=]|organizationId\s*[:=]|workspaceId\s*[:=]|tenant_id\s*[:=]|org_id\s*[:=]|current_user(?:\.id|\s*==)|request\.user\.|\$_SESSION|belongsTo(?:User|Tenant)|PermissionDenied/i,
    description:
      "HIGH: Record load uses a client-supplied id with no tenant/session token in a ±4 line window (regex heuristic, not an AST). CWE-862 / CWE-639 — authorize the resource against the authenticated principal before returning it.",
    recommendedAction:
      "Load by session user/tenant first, or compare the requested id to req.user.id (or equivalent) in the same handler and return 403 on mismatch. Do not trust client ids alone.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-034",
    name: "Insecure Session Cookie Flags",
    regex:
      /cookie\s*:\s*\{[^}]{0,200}(?:secure\s*:\s*false|httpOnly\s*:\s*false)/i,
    severity: "high",
    description:
      "HIGH: Session cookie sets secure or httpOnly to false. IBM-style session hardening: cookies must not be readable by XSS or sent over HTTP.",
    recommendedAction:
      "Set httpOnly and secure true, use SameSite=Strict or Lax, and expire admin sessions tightly.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-035",
    name: "Restricted Copyleft License in Package",
    regex:
      /"license"\s*:\s*"(?:AGPL|GPL-3(?:\.0)?|SSPL|BUSL|Commons-Clause)[^"]*"/i,
    severity: "high",
    description:
      "HIGH: Package license is AGPL, GPL-3, SSPL, or Commons Clause. Enterprise license governance — these terms can force source disclosure or block commercial cloud runtimes.",
    recommendedAction:
      "Legal review before shipping; replace the dependency or isolate it behind an approved exception.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
    pathRegex: /package\.json$/i,
  },
  {
    id: "SB-SEC-036",
    name: "Log4j / Nested CVE-Class Dependency",
    regex: /log4j-core|org\.apache\.logging\.log4j|log4j-api/i,
    severity: "high",
    description:
      "HIGH: Log4j family dependency present. Enterprise SBOM concern after Log4Shell — nested unpatched logging stacks are IBM/Red Hat supply-chain priority.",
    recommendedAction:
      "Generate an SBOM, pin a patched Log4j 2.17.1+ (or the current vendor advisory), and block vulnerable transitive versions in CI.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
    pathRegex: /pom\.xml$|\.gradle$|build\.gradle/i,
  },
  {
    id: "SB-SEC-037",
    name: "AI Safety Guardrails Disabled",
    regex:
      /BLOCK_NONE|moderation\s*:\s*false|disable_content_filter|skip_safety_check|safety_settings\s*[:=][^;\n]{0,80}BLOCK_NONE/i,
    severity: "high",
    description:
      "HIGH: Model safety/moderation filters are turned off in code. Enterprise AI guardrail gap (Granite-class): unconstrained generation, not a creative jailbreak write-up.",
    recommendedAction:
      "Keep vendor safety filters on, add output allowlists, and require human review for tool actions.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-038",
    name: "Unverified JWT / alg none",
    regex:
      /jwt\.decode\s*\(|jsonwebtoken\.decode\s*\(|algorithms?\s*:\s*\[\s*['"]none['"]|['"]alg['"]\s*:\s*['"]none['"]|verify\s*:\s*false.{0,40}jwt|jwt.{0,40}verify\s*:\s*false/i,
    severity: "critical",
    description:
      "CRITICAL: JWT is decoded without verification or explicitly allows alg none. Gatekeeper HVT — forged tokens become admin impersonation.",
    recommendedAction:
      "Use jwt.verify with an explicit algorithm allowlist (RS256/ES256/HS256). Never jwt.decode for authz. Reject alg none.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-039",
    name: "OAuth redirect_uri from Request",
    regex:
      /redirect_uri\s*[:=]\s*(?:req\.|request\.|query\.|params\.|body\.)|redirectUri\s*[:=]\s*req\.(?:query|body|params)/i,
    severity: "high",
    description:
      "HIGH: OAuth/webhook redirect_uri taken from the request. Callback HVT — an attacker can steal authorization codes by pointing the redirect at their server.",
    recommendedAction:
      "Allowlist redirect URIs in config; never bind redirect_uri to query/body.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-040",
    name: "Unsanitized ImageMagick / convert",
    regex:
      /(?:imagemagick|gm\s+convert|\bconvert\s+-[^\n]{0,40}(?:req\.|upload))|exec(?:File|Sync)?\s*\(\s*['"](?:convert|magick|gm)['"]/i,
    severity: "critical",
    description:
      "CRITICAL: ImageMagick/GraphicsMagick convert invoked from an upload/request path. Ingestion HVT — malformed images historically yield RCE (ImageTragick-class).",
    recommendedAction:
      "Use a memory-safe decoder, disable MVG/HTTPS delegates, and never shell out to convert with user filenames.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-041",
    name: "Unrestricted File Upload",
    regex:
      /multer\s*\(\s*\{(?![^}]{0,300}fileFilter)|fileFilter\s*:\s*(?:undefined|null|false)|accept\s*=\s*["']\*\/\*["']/i,
    severity: "high",
    description:
      "HIGH: Upload middleware has no fileFilter (or accepts */*). Ingestion HVT — extension checks that only look at the name miss polyglot payloads.",
    recommendedAction:
      "Allowlist MIME + magic bytes, store outside webroot, and scan with a safe decoder—not the original filename.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-042",
    name: "Weak Password Hash (MD5/SHA-1)",
    regex:
      /(?:password|passwd|pwd).{0,60}(?:createHash\s*\(\s*['"](?:md5|sha1)['"]|\.digest\s*\(\s*['"]hex['"].{0,20}md5|md5\s*\(|sha1\s*\()|createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)[^;\n]{0,80}(?:password|passwd|pwd)/i,
    severity: "critical",
    description:
      "CRITICAL: Password hashed with MD5 or SHA-1. Identity HVT — a dump is offline-crackable; use a salted KDF (Argon2id, bcrypt, scrypt).",
    recommendedAction:
      "Hash with Argon2id or bcrypt (work factor ≥10) and unique per-user salts. Never MD5/SHA-1 for passwords.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-043",
    name: "Payment / Checkout State Skip",
    regex:
      /(?:skip|bypass)[_-]?(?:payment|checkout|billing)|forcePaid\s*[:=]\s*true|markPaid\s*\(|status\s*[:=]\s*['"]paid['"]\s*[,\n].{0,40}(?:req\.|query\.)/i,
    severity: "high",
    description:
      "HIGH: Business-logic flag skips payment or marks paid from request state. State-machine HVT — clients can jump to Complete Payment without authorization.",
    recommendedAction:
      "Drive status only from a verified payment provider webhook; never accept paid/skip from the client.",
    skipFiles:
      /test|spec|fixture|mock|example|sample|placeholder|template|security-pattern-scanner/i,
  },
  {
    id: "SB-SEC-044",
    name: "Disabled TLS Certificate Validation",
    regex:
      /verify\s*=\s*False|check\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"`]?0['"`]?|CURLOPT_SSL_VERIFYPEER.{0,20}[,\s]0|InsecureSkipVerify\s*:\s*true/i,
    severity: "high",
    productionOnly: true,
    description:
      "TLS certificate validation is disabled in production-path code. CWE-295 — restore verification; do not ship verify=False or rejectUnauthorized:false.",
    recommendedAction:
      "Enable certificate verification. Use a pinned CA store or platform trust; do not set verify=False, check=False, rejectUnauthorized:false, or NODE_TLS_REJECT_UNAUTHORIZED=0 in deployed code.",
    skipFiles:
      /security-pattern-scanner\.js$|finding-context\.js$|standards-map\.js$/i,
  },
  {
    id: "SB-SEC-045",
    name: "Permissive CORS (all origins)",
    regex:
      /Access-Control-Allow-Origin['"\s:=]+(?:\*['"]|['"]\*['"])|cors\s*\(\s*\{[^}]{0,120}origin\s*:\s*(?:true|['"]\*['"])|allow_cors_all|CORS_ALLOW_ALL_ORIGINS\s*=\s*True/i,
    severity: "high",
    productionOnly: true,
    description:
      "HIGH: CORS allows any origin. CWE-942 — restrict Access-Control-Allow-Origin to known frontends; do not combine * with credentialed cookies.",
    recommendedAction:
      "Allowlist exact frontend origins. Avoid origin: true / CORS_ALLOW_ALL_ORIGINS in production APIs.",
    skipFiles:
      /security-pattern-scanner\.js$/i,
  },
];

function lineNumberAt(content, index) {
  return content.slice(0, Math.max(0, index)).split("\n").length;
}

function extractLineWindow(content, matchIndex, radius) {
  const n = Number(radius);
  const lineRadius = Number.isFinite(n) && n >= 0 ? n : 4;
  let start = content.lastIndexOf("\n", Math.max(0, matchIndex - 1)) + 1;
  if (start < 1) start = 0;
  for (let i = 0; i < lineRadius; i++) {
    if (start <= 0) {
      start = 0;
      break;
    }
    const prev = content.lastIndexOf("\n", start - 2);
    start = prev < 0 ? 0 : prev + 1;
  }
  let end = content.indexOf("\n", matchIndex);
  if (end < 0) end = content.length;
  for (let i = 0; i < lineRadius; i++) {
    const next = content.indexOf("\n", end + 1);
    if (next < 0) {
      end = content.length;
      break;
    }
    end = next;
  }
  return content.slice(start, end);
}

function scanSecurityPatterns(relativePath, content, ext, options = {}) {
  const issues = [];
  if (!SCANNABLE_EXTENSIONS.has(ext)) return issues;
  if (content.length > resolveMaxScanBytes(options)) return issues;
  if (/simplebeacon-ignore/i.test(content.substring(0, 500))) return issues;

  const rel = String(relativePath).replace(/\\/g, "/");
  const pathInfo = classifyPath(rel);
  for (const rule of SECURITY_RULES) {
    if (rule.productionOnly && pathInfo.lane === "quality") continue;
    if (rule.skipFiles && rule.skipFiles.test(rel)) {
      if (!(pathInfo.lane === "quality" && !pathInfo.internalTooling)) {
        continue;
      }
    }
    if (rule.pathRegex && !rule.pathRegex.test(rel)) continue;
    // negativeRegex: skip file if the negative pattern IS present (e.g., HEALTHCHECK exists)
    if (rule.negativeRegex && rule.negativeRegex.test(content)) continue;
    const matches = [];
    let match;
    if (rule.pathOnly) {
      matches.push({ line: 1, snippet: relativePath });
    } else {
      const regex = new RegExp(
        rule.regex.source,
        rule.regex.flags.replace("g", "") + "g",
      );
      while ((match = regex.exec(content)) !== null) {
        const line = lineNumberAt(content, match.index);
        const snippet = content
          .slice(match.index, match.index + 120)
          .split("\n")[0];
        // Skip if snippet matches exclusion pattern (e.g., changeme, placeholder)
        if (rule.snippetExclusions && rule.snippetExclusions.test(snippet))
          continue;
        if (rule.windowExclusions) {
          const window = extractLineWindow(
            content,
            match.index,
            rule.windowLines,
          );
          if (rule.windowExclusions.test(window)) continue;
        }
        matches.push({ line, snippet });
        if (matches.length >= 3) break;
      }
    }
    if (matches.length > 0) {
      const draft = {
        id: `${rule.id}-${relativePath}`,
        severity: rule.severity,
        type: RULE_TYPE_MAP[rule.id] || rule.name,
        filePath: relativePath,
        count: matches.length,
        description: `${relativePath}: ${rule.description}`,
        recommendedAction:
          rule.recommendedAction || "Review and remediate the security issue",
        message: rule.description,
        affectedFiles: [relativePath],
        matches,
        lane: pathInfo.lane,
        pathClass: pathInfo.class,
        reachabilityHint: pathInfo.reachabilityHint,
      };
      const standards = getStandardsForFinding(draft);
      issues.push({
        ...draft,
        cwe: standards.cwe,
        cweTitle: standards.cweTitle,
        owasp: standards.owasp,
        asvs: standards.asvs,
      });
    }
  }
  return issues;
}

module.exports = { scanSecurityPatterns, SECURITY_RULES };
