/**
 * Registry of supported languages and their ecosystem metadata.
 * Each entry maps file extensions to root/build artifacts.
 */
const LANGUAGE_REGISTRY = {
    javascript: {
        name: 'JavaScript / Node.js',
        extensions: ['js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx'],
        rootFiles: ['package.json', 'server.cjs', 'action.yml', 'action.yaml'],
        buildChecks: [
            { name: 'package.json', regex: /package\.json$/, critical: true },
            { name: 'Lockfile', regex: /package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|bun\.lock/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'CHANGELOG', regex: /changelog|changes|history/i, critical: false },
            { name: 'Tests', regex: /test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress/i, critical: true },
            { name: 'CI/CD', regex: /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|build\.yml|deploy\.yml/i, critical: true },
            { name: 'Docker', regex: /dockerfile|docker-compose|\.dockerignore/i, critical: false },
            { name: 'Linting/Formatting', regex: /eslint|prettier|\.editorconfig|lint-staged|husky/i, critical: false },
            { name: 'TypeScript Config', regex: /tsconfig|\.ts$/i, critical: false },
            { name: 'Build Tool Config', regex: /(webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile)/i, critical: false },
            { name: 'Dev Server / HMR', regex: /vite\.config|webpack\.dev|nodemon|live-reload|hmr/i, critical: false },
            { name: '.env.example', regex: /\.env\.example|\.env\.sample|\.env\.template/i, critical: true },
            { name: '.gitignore', regex: /\.gitignore/, critical: true },
            { name: 'Build artifacts ignored', regex: null, customCheck: (paths) => !paths.some(p => /\/(dist|build|\.next|out)\//.test(p) && !/node_modules\//.test(p)), critical: true },
            { name: 'Git LFS config', regex: /\.gitattributes/, critical: false },
            { name: 'Build cache config', regex: /\.eslintcache|\.parcel-cache|\.next\/cache/i, critical: false },
            { name: '.npmignore', regex: /\.npmignore/, critical: false }
        ]
    },
    python: {
        name: 'Python',
        extensions: ['py', 'pyw', 'pyi'],
        rootFiles: ['pyproject.toml', 'setup.py', 'requirements.txt'],
        buildChecks: [
            { name: 'pyproject.toml / setup.py', regex: /pyproject\.toml|setup\.py/, critical: true },
            { name: 'requirements.txt', regex: /requirements.*\.txt/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /test|spec|pytest|unittest|tox\.ini/, critical: true },
            { name: 'CI/CD', regex: /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis/i, critical: true },
            { name: 'Docker', regex: /dockerfile|docker-compose|\.dockerignore/i, critical: false },
            { name: 'Linting/Formatting', regex: /flake8|pylint|black|isort|mypy/, critical: false },
            { name: '.gitignore', regex: /\.gitignore/, critical: true },
            { name: 'Virtual env config', regex: /\.python-version|Pipfile|poetry\.lock/, critical: false }
        ]
    },
    java: {
        name: 'Java / JVM',
        extensions: ['java', 'kt', 'scala', 'groovy'],
        rootFiles: ['pom.xml', 'build.gradle'],
        buildChecks: [
            { name: 'pom.xml / build.gradle', regex: /pom\.xml|build\.gradle/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /test|spec|junit|testng/, critical: true },
            { name: 'CI/CD', regex: /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci/i, critical: true },
            { name: 'Docker', regex: /dockerfile|docker-compose/i, critical: false },
            { name: '.gitignore', regex: /\.gitignore/, critical: true }
        ]
    },
    go: {
        name: 'Go',
        extensions: ['go'],
        rootFiles: ['go.mod'],
        buildChecks: [
            { name: 'go.mod', regex: /go\.mod/, critical: true },
            { name: 'go.sum', regex: /go\.sum/, critical: true },
            { name: 'Makefile', regex: /makefile/i, critical: false },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /_test\.go$/, critical: true },
            { name: '.gitignore', regex: /\.gitignore/, critical: true }
        ]
    },
    rust: {
        name: 'Rust',
        extensions: ['rs'],
        rootFiles: ['Cargo.toml'],
        buildChecks: [
            { name: 'Cargo.toml', regex: /Cargo\.toml/, critical: true },
            { name: 'Cargo.lock', regex: /Cargo\.lock/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /#\[test\]|#\[cfg\(test\)\]/, critical: true },
            { name: '.gitignore', regex: /\.gitignore/, critical: true }
        ]
    },
    php: {
        name: 'PHP',
        extensions: ['php'],
        rootFiles: ['composer.json'],
        buildChecks: [
            { name: 'composer.json', regex: /composer\.json/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /test|spec|phpunit/, critical: true },
            { name: '.gitignore', regex: /\.gitignore/, critical: true }
        ]
    },
    ruby: {
        name: 'Ruby',
        extensions: ['rb'],
        rootFiles: ['Gemfile'],
        buildChecks: [
            { name: 'Gemfile', regex: /Gemfile/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /test|spec|rspec/, critical: true },
            { name: '.gitignore', regex: /\.gitignore/, critical: true }
        ]
    },
    dotnet: {
        name: '.NET',
        extensions: ['cs', 'vb'],
        rootFiles: ['.csproj', '.sln'],
        buildChecks: [
            { name: '.csproj / .sln', regex: /\.csproj|\.sln/, critical: true },
            { name: 'README', regex: /readme\.?/i, critical: true },
            { name: 'Tests', regex: /test|spec|xunit|nunit|mstest/, critical: true },
            { name: '.gitignore', regex: /\.gitignore/, critical: true }
        ]
    }
};

/**
 * Registry of analyzer patterns keyed by analyzer ID.
 * Each entry declares which languages it applies to and its detection rules.
 */
const PATTERN_REGISTRY = {
    aiIndicators: {
        id: 'aiIndicators',
        name: 'AI System Indicator',
        appliesTo: ['javascript'],
        severity: 'low',
        pattern: /\bnew\s+openai\b|\brequire\s*\(\s*['"]openai['"]\s*\)|\bimport\s+.*\bopenai\b|\bfrom\s+['"]openai['"]\b|\bfrom\s+['"]@anthropic\/[^'"]+['"]\b|\bnew\s+anthropic\b|\bimport\s+.*\blangchain\b|\bfrom\s+['"]langchain['"]\b|\brequire\s*\(\s*['"]langchain['"]\s*\)|\bfrom\s+['"]huggingface_hub['"]\b|\bimport\s+.*\bhuggingface_hub\b|\brequire\s*\(\s*['"]huggingface_hub['"]\s*\)|\b\.create\s*\(\s*\{\s*model\s*:\s*['"]gpt|\b\.create\s*\(\s*\{\s*model\s*:\s*['"]claude|\bcreateChatCompletion\s*\(|\bopenai\.chat\.completions\b|\banthropic\.messages\.create\b|\bazure\.openai\b/i,
        maxMatches: 5,
        selfReferenceFilter: /(?:const|let|var)\s+(?:aiPattern|AI_INDICATORS_PATTERNS)\b|{\s*id:\s*['"][^'"]+['"],\s*pattern:\s*\//,
        message: 'AI SDK usage detected. Review EU AI Act Article 6 applicability.'
    },
    credentials: {
        id: 'credentials',
        name: 'Credential Pattern',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /password\s*=\s*['"][^'"]{6,}|api[_-]?key\s*=\s*['"][a-z0-9]{12,}|secret[_-]?key\s*=\s*['"][a-z0-9]{12,}|private_key\s*=\s*['"][^'"]{8,}|aws_access_key_id\s*=\s*['"][A-Z0-9]{16,}|API_KEY\s*=\s*['"][A-Za-z0-9_\-]{16,}|SECRET\s*=\s*['"][A-Za-z0-9_\-]{12,}|AUTH_TOKEN\s*=\s*['"][A-Za-z0-9_\-]{12,}/i,
        maxMatches: 3,
        redact: true,
        selfReferenceFilter: /PATTERN_REGISTRY|TEST_CASES|shouldMatch|shouldNotMatch|test.*password|test.*api_key|mockFileContent|REDACTED|trello-board|test-all-patterns/i,
        contextFilter: (snippet, filePath) => {
            // Skip test files (*.test.js, *.spec.js, *.test.ts) — test fixtures are intentionally hardcoded
            if (filePath && /\.(test|spec)\.(js|ts|cjs|mjs)$/.test(filePath)) return false;
            // Skip token generation using crypto.randomBytes() — produces random tokens, not hardcoded secrets
            if (/crypto\.randomBytes|Math\.random|Date\.now|require\(['"]crypto['"]\)/.test(snippet)) return false;
            // Skip process.env assignments in test setup (test isolation patterns)
            if (/process\.env\.(JWT_SECRET|JWT_REFRESH_SECRET|SECRET|TOKEN)\s*=/.test(snippet)) return false;
            // Skip dynamic token generation with template literals
            if (/`[^`]*\$\{[^}]+\}[^`]*`/.test(snippet) && /token|secret|key/i.test(snippet)) return false;
            return true;
        },
        message: 'Potential hardcoded secret detected. Move to environment variables or secret manager.'
    },
    debugArtifacts: {
        id: 'debugArtifacts',
        name: 'Debug Artifact',
        appliesTo: ['javascript'],
        severity: 'low',
        pattern: /\bconsole\.(log|warn|error|info|debug|table|trace|dir|group)\s*\(|\bdebugger\b|\balert\s*\(|\bconfirm\s*\(/i,
        maxMatches: 3,
        selfReferenceFilter: /console\.error\(['"]\s*(?:Failed|Unhandled|Uncaught|Error|❌|⚠️)|console\.warn\(`?⚠️|console\.log\(['"]\[[Simplebeacon]|console\.log\(`?\[Simplebeacon\]|process\.on\(|Unhandled Rejection|Uncaught Exception|SIMPLEBEACON_LANDING|Auto-enabled|Auto-detected|Found|Scanning|Filtering|Excluding|Discovery|Progress|Stage|Hash|Token|Report|Certificate|Module|Dashboard|Audit|Copy|Upload|Export|Download|Generate|Restore|Clear|Reset|Loading|Done|Complete|Success|Pass|Fail|Error|Warn|Info|Debug|Todo|Fix|Note|Skip|Ignore|Merge|Split|Move|Rename|Delete|Create|Update|Insert|Append|Prepend|Push|Pop|Shift|Unshift|Sort|Filter|Map|Reduce|Find|Index|Slice|Splice|Join|Split|Trim|Replace|Match|Search|Test|Exec|Compile|Build|Deploy|Release|Version|Tag|Branch|Commit|Push|Pull|Fetch|Clone|Checkout|Reset|Revert|Stash|Apply|Drop|Clean|Status|Log|Diff|Blame|Show|Grep|Branch|Merge|Rebase|Cherry|Revert|Tag|Remote|Submodule|Worktree|Sparse|Index|Pack|Unpack|GC|FSCK|Reflog|Hook|Config|Attribute|Ignore|Mailmap|Repl|Bisect|Bugreport|Verify|Maintenance/i,
        contextFilter: (snippet, filePath) => {
            // Skip C++ confirm() function definitions and declarations (not JS confirm())
            if (/bool\s+confirm\s*\(/.test(snippet) || /confirm\s*\([^)]*\)\s*\{/.test(snippet)) return false;
            if (filePath && /\.(cpp|c|h|hpp|cc)$/.test(filePath) && /confirm\s*\(/.test(snippet)) return false;
            // Skip Python print() in SCons build scripts and test utilities
            if (filePath && /\.(py)$/.test(filePath) && /\bprint\s*\(/.test(snippet)) {
                if (/scons|build|test|packageUtils/.test(filePath) || /BUILD ERROR|Test is now looking|Basic checks for/.test(snippet)) return false;
            }
            // Skip CLI help text (console.error with 'Usage:')
            if (/console\.(error|warn|log)\s*\(['"`]\s*Usage:\s*node/.test(snippet)) return false;
            // Skip gated debug logging (if(DEBUG) console.log, if(PROCESSOR_DEBUG) console.log)
            if (/if\s*\(\s*DEBUG\s*\)|if\s*\(\s*PROCESSOR_DEBUG\s*\)/.test(snippet)) return false;
            // Skip error handling in catch blocks with console.error
            if (/catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/i.test(snippet)) return false;
            // Skip test files that test quality heuristics themselves
            if (filePath && /file-quality-heuristics\.test\.|test-all-patterns\./.test(filePath)) return false;
            // Skip simplebeacon-ignore comments
            if (/simplebeacon-ignore/.test(snippet)) return false;
            return true;
        },
        message: 'Development-only debug artifact. Remove before production builds.'
    },
    governance: {
        id: 'governance',
        name: 'License/Governance Marker',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /SPDX-License-Identifier|MIT License|Apache License|GNU General Public License|All rights reserved|Copyright \(c\)|License: /i,
        maxMatches: 1,
        selfReferenceFilter: /eslint\.config|jest\.config|\.config\.|\.test\.|[\"']SPDX-License-Identifier[\"']/,
        message: 'License or copyright marker detected. Verify open-source compatibility.'
    },
    pythonDebug: {
        id: 'pythonDebug',
        name: 'Python Debug Artifact',
        appliesTo: ['python'],
        severity: 'low',
        pattern: /\bprint\s*\(|\bpprint\s*\(|\blogging\.debug\s*\(|\bbreakpoint\s*\(/i,
        maxMatches: 3,
        message: 'Python debug artifact (print, pprint, breakpoint) detected. Remove before production builds.'
    },
    javaDebug: {
        id: 'javaDebug',
        name: 'Java Debug Artifact',
        appliesTo: ['java'],
        severity: 'low',
        pattern: /\bSystem\.(out|err)\.(print|println)\s*\(|\be\.printStackTrace\s*\(|\bjava\.util\.logging\./i,
        maxMatches: 3,
        message: 'Java debug artifact (System.out.print, e.printStackTrace) detected. Use logging framework in production.'
    },
    pythonFramework: {
        id: 'pythonFramework',
        name: 'Python Framework Config Issue',
        appliesTo: ['python'],
        severity: 'low',
        pattern: /\bDEBUG\s*=\s*True\b|\bapp\.run\s*\(\s*[^)]*debug\s*=\s*True/i,
        maxMatches: 3,
        message: 'Python framework running in debug mode (DEBUG=True). Disable before production deployment.'
    },
    javaFramework: {
        id: 'javaFramework',
        name: 'Java Framework Config Issue',
        appliesTo: ['java'],
        severity: 'medium',
        pattern: /spring\.datasource\.(password|url)\s*=\s*['"][^'"]{4,}|log4j.*CVE|log4shell|jndi:ldap/i,
        maxMatches: 3,
        redact: true,
        message: 'Java framework configuration issue: hardcoded datasource or log4j vulnerability reference detected.'
    },
    goDebug: {
        id: 'goDebug',
        name: 'Go Debug Artifact',
        appliesTo: ['go'],
        severity: 'low',
        pattern: /\bfmt\.Print(?:ln|f)?\s*\(|\blog\.Print(?:ln|f)?\s*\(|\blog\.Fatal(?:f|ln)?\s*\(|\bpanic\s*\(/i,
        maxMatches: 3,
        message: 'Go debug artifact (fmt.Print, log.Println, panic) detected. Use structured logging in production.'
    },
    goFramework: {
        id: 'goFramework',
        name: 'Go Framework Config Issue',
        appliesTo: ['go'],
        severity: 'low',
        pattern: /\bgin\.SetMode\s*\(\s*gin\.DebugMode|http\.ListenAndServe\s*\(\s*["'][^"']+["']\s*,\s*nil\s*\)/i,
        maxMatches: 3,
        message: 'Go framework config issue: debug mode or bare ListenAndServe without handler detected.'
    },
    rustDebug: {
        id: 'rustDebug',
        name: 'Rust Debug Artifact',
        appliesTo: ['rust'],
        severity: 'low',
        pattern: /\bprintln!\s*\(|\beprintln!\s*\(|\bdbg!\s*\(|\bprint!\s*\(|\bpanic!\s*\(/i,
        maxMatches: 3,
        message: 'Rust debug artifact (println!, dbg!, panic!) detected. Remove before production builds.'
    },
    rustFramework: {
        id: 'rustFramework',
        name: 'Rust Framework Anti-pattern',
        appliesTo: ['rust'],
        severity: 'medium',
        pattern: /\.unwrap\s*\(\s*\)(?:\s*\?\s*\.unwrap\s*\(\s*\))+|\.expect\s*\(\s*["']\s*["']\s*\)/i,
        maxMatches: 3,
        message: 'Rust anti-pattern: unwrap chain or empty expect message detected. Use proper error handling.'
    },
    phpDebug: {
        id: 'phpDebug',
        name: 'PHP Debug Artifact',
        appliesTo: ['php'],
        severity: 'low',
        pattern: /\becho\s+['"]|\bvar_dump\s*\(|\bprint_r\s*\(|\bdie\s*\(|\bexit\s*\(|\bdebug_backtrace\s*\(|\btrigger_error\s*\(/i,
        maxMatches: 3,
        message: 'PHP debug artifact (echo, var_dump, die, exit) detected. Remove before production builds.'
    },
    phpFramework: {
        id: 'phpFramework',
        name: 'PHP Framework Config Issue',
        appliesTo: ['php'],
        severity: 'medium',
        pattern: /APP_DEBUG\s*=>\s*true|APP_ENV\s*=>\s*['"]local['"]|DB::raw\s*\(|mysql_query\s*\(|mysqli_query\s*\(|PDO\s*::\s*query\s*\(/i,
        maxMatches: 3,
        message: 'PHP framework issue: debug mode or raw SQL detected. Review before production.'
    },
    dotnetDebug: {
        id: 'dotnetDebug',
        name: '.NET Debug Artifact',
        appliesTo: ['dotnet'],
        severity: 'low',
        pattern: /\bConsole\.Write(Line)?\s*\(|\bDebug\.Write(Line)?\s*\(|\bTrace\.Write(Line)?\s*\(|\bDebugger\.Break\s*\(/i,
        maxMatches: 3,
        message: '.NET debug artifact (Console.WriteLine, Debug.WriteLine, Debugger.Break) detected. Remove before production builds.'
    },
    dotnetFramework: {
        id: 'dotnetFramework',
        name: '.NET Framework Config Issue',
        appliesTo: ['dotnet'],
        severity: 'medium',
        pattern: /connectionString\s*=\s*["'][^"']{10,}|Integrated\s+Security\s*=\s*false|Server=localhost;|\.UseInMemoryDatabase\s*\(/i,
        maxMatches: 3,
        redact: true,
        message: '.NET framework issue: hardcoded connection string or in-memory database detected. Use secrets management.'
    },
    rubyDebug: {
        id: 'rubyDebug',
        name: 'Ruby Debug Artifact',
        appliesTo: ['ruby'],
        severity: 'low',
        pattern: /\bputs\s+['"]|\bp\s+['"]|\bdebugger\b|\bdebug\s+['"]|\bbinding\.irb\b|\bbinding\.pry\b|\bRails\.logger\.debug\s*\(/i,
        maxMatches: 3,
        message: 'Ruby debug artifact (puts, p, debugger, binding.irb) detected. Remove before production builds.'
    },
    rubyFramework: {
        id: 'rubyFramework',
        name: 'Ruby Framework Anti-pattern',
        appliesTo: ['ruby'],
        severity: 'medium',
        pattern: /\.permit!\s*\)|\bskip_before_action\b|\beval\s*\(|\bsend\s*\(\s*params\[/i,
        maxMatches: 3,
        message: 'Ruby framework anti-pattern: unsafe mass assignment, eval, or dynamic send detected. Review for security risks.'
    },
    aiResidueStub: {
        id: 'aiResidueStub',
        name: 'Stub Implementation',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*TODO|def\s+\w+\s*\([^)]*\):\s*pass\b|public\s+\w+\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*implement|TODO\s*:\s*implement|TODO\s*:\s*AI|TODO\s*:\s*generated|\/\/\s*AI\s+generated|\/\/\s*Generated\s+by\s+(ChatGPT|GPT|Claude|Copilot|Gemini|LLM)/i,
        maxMatches: 3,
        message: 'Stub or AI-generated placeholder detected. Replace with actual implementation before production.'
    },
    aiResidueSwallow: {
        id: 'aiResidueSwallow',
        name: 'Error Swallowing',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\([^)]*\)\s*\{\s*\/\/\s*ignore|catch\s*\([^)]*\)\s*\{\s*console\.(log|warn|error)\s*\(|except\s*[^:]+:\s*pass|catch\s*\([^)]*\)\s*\{\s*return\s*null|catch\s*\([^)]*\)\s*\{\s*return\s*;|rescue\s+=>\s*e\s*#\s*ignore/i,
        maxMatches: 3,
        message: 'Error swallowing anti-pattern detected. Empty catch blocks hide runtime failures.'
    },
    aiResidueDeprecated: {
        id: 'aiResidueDeprecated',
        name: 'Deprecated Pattern',
        appliesTo: ['javascript', 'python', 'java', 'php', 'ruby'],
        severity: 'low',
        pattern: /jQuery\s*\(|\.ajax\s*\(|componentWillMount\s*\(|componentWillReceiveProps\s*\(|shouldComponentUpdate\s*\(|React\.createClass\s*\(|\.getInitialState\s*\(|asyncio\.coroutine|@asyncio\.coroutine|urllib\.urlopen\s*\(|urllib2\.urlopen\s*\(|xrange\s*\(|raw_input\s*\(/i,
        maxMatches: 3,
        message: 'Deprecated API or legacy idiom detected. Modernize to current framework standards.'
    },
    aiResidueDeadCode: {
        id: 'aiResidueDeadCode',
        name: 'Dead Code Block',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /\/\*(?!\*)[\s\S]{80,}\*\/(?!\s*\n\s*(?:export|import|const|let|var|function|class|def|public|private|protected|static|if|for|while|switch|try|return))/,
        maxMatches: 2,
        message: 'Large commented-out code block detected. AI assistants often leave dead code behind. Remove or restore.'
    },
    perfNestedLoop: {
        id: 'perfNestedLoop',
        name: 'Performance Anti-Pattern',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /for\s*\([^)]*\)\s*\{[\s\S]{0,80}for\s*\(|for\s+\w+\s+in\s+\w+\s*:[\s\S]{0,80}for\s+\w+\s+in|while\s*\([^)]*\)\s*\{[\s\S]{0,80}while\s*\(/i,
        maxMatches: 3,
        message: 'Nested loops detected. Consider optimization to reduce O(n²) complexity.'
    },
    typeSafetyAny: {
        id: 'typeSafetyAny',
        name: 'Type Safety Gap',
        appliesTo: ['javascript', 'typescript'],
        severity: 'low',
        pattern: /:\s*any\b(?!\s*\[\])|@ts-ignore|@ts-nocheck|: \(\)\s*=>\s*any/i,
        maxMatches: 3,
        selfReferenceFilter: /pattern\s*:\s*\/[^/]+\/|severity.*vscode\.DiagnosticSeverity|fixSuggestion.*Replace any with specific types|scanner-patterns|extension\.ts|out\/extension\.js|postMessage\s*\(/i,
        contextFilter: (snippet, filePath) => {
            // Skip VS Code extension API callback signatures where any is standard
            if (/resolve:\s*\(value:\s*any\)\s*=>\s*void|reject:\s*\(reason\?:\s*any\)/.test(snippet)) return false;
            // Skip function parameters for generic post/utility functions
            if (/function\s+postJson\(.*payload:\s*any|private\s+async\s+_uploadReport\(.*data:\s*any/.test(snippet)) return false;
            // Skip buildHierarchy return type — dynamic tree structure
            if (/buildHierarchy.*:\s*any\s*\{/.test(snippet)) return false;
            // Skip scanner-engine.js or pattern files that document type safety
            if (filePath && /scanner-patterns|scanner-engine|ui-renderer/i.test(filePath)) return false;
            return true;
        },
        message: 'Type safety gap: any type, missing PropTypes, or excessive parameters detected.'
    },
    missingTest: {
        id: 'missingTest',
        name: 'Missing Test Coverage',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /test\.(todo|skip|xit|xtest)\s*\(|describe\.(skip|todo)\s*\(|it\.(skip|todo)\s*\(|pytest\.mark\.skip|^\s*@Disabled\b|func Test.*\{\s*\}/i,
        maxMatches: 3,
        message: 'Empty or skipped test detected. Ensure production code has active coverage.'
    },
    a11yGap: {
        id: 'a11yGap',
        name: 'Accessibility Gap',
        appliesTo: ['javascript', 'typescript', 'html'],
        severity: 'medium',
        pattern: /<img\b(?![^>]*\balt=)[^>]*>|<(input|textarea|select)\b(?![^>]*\b(?:aria-label|aria-labelledby|title|placeholder|hidden)=)[^>]*>|<button\b(?![^>]*\b(?:aria-label|aria-labelledby|title)=)[^>]*>\s*<\/button>|<div\b[^>]*\brole=["']button["'](?![^>]*\b(?:aria-label|aria-labelledby|tabindex))[^>]*>/i,
        maxMatches: 3,
        selfReferenceFilter: /<label[^>]*>\s*.*<(input|textarea|select)|\(\?![^)]*\)/i,
        contextFilter: (snippet) => {
            // Skip hidden inputs (display:none) that have associated labels
            if (/<input[^>]*style=["'][^"']*display:\s*none/i.test(snippet)) return false;
            if (/<input[^>]*type=["']file["'][^>]*style=["'][^"']*display:\s*none/i.test(snippet)) return false;
            // Skip inputs wrapped in labels
            if (/<label[^>]*>.*<input/i.test(snippet)) return false;
            return true;
        },
        message: 'Missing alt text, unlabeled input, or inaccessible button detected.'
    },
    i18nHardcoded: {
        id: 'i18nHardcoded',
        name: 'i18n Issue',
        appliesTo: ['javascript', 'typescript', 'html', 'vue', 'svelte'],
        severity: 'low',
        pattern: /innerHTML\s*=\s*[`'"][^`'"]{0,200}[A-Za-z\s]{5,}|textContent\s*=\s*[`'"][^`'"]{0,200}[A-Za-z\s]{5,}|document\.title\s*=\s*[`'"][^`'"]{0,200}[A-Za-z\s]{3,}/i,
        maxMatches: 3,
        selfReferenceFilter: /toLocaleDateString|toLocaleString|LocaleString|log\(|console\.|send.*email|email.*subject|invoice|Estimated revenue|class=|id=|style=|href=|src=|alt=|aria-|role=|detail-label|card-title|text-muted|page-title|settings-|gate-badge|analyze-|ai-transparency|upgrade-modal|scan-status|about-kicker|settings-value|settings-row|settings-label|pass|fail|warn|error|ok|success|danger|info|primary|secondary|light|dark|sm|md|lg|xl|xs|mb-|mt-|ml-|mr-|p-|px-|py-|m-|mx-|my-|gap-|flex-|grid-|col-|row-|container|wrapper|content|header|footer|sidebar|main|nav|section|article|aside|div|span|p|h1|h2|h3|h4|h5|h6|ul|ol|li|table|tr|td|th|thead|tbody|tfoot|form|input|button|select|textarea|label|option|optgroup|fieldset|legend|datalist|output|progress|meter|details|summary|dialog|menu|menuitem|template|slot|canvas|svg|math|video|audio|source|track|embed|object|param|iframe|frame|frameset|noframes|noscript|script|style|link|meta|base|title|head|body|html|DOCTYPE|charset|utf-8|lang|en|UTF-8|text\/html|application\/json|Content-Type|Authorization|Bearer|Bearer\s+/i,
        message: 'Hardcoded UI string or locale-naive formatting detected. Wrap with i18n function.'
    },
    sensitiveData: {
        id: 'sensitiveData',
        name: 'Sensitive Data Exposure',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'high',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{3}-\d{3}-\d{4}\b|console\.(log|warn|error|info)\s*\(\s*(?:user|customer|email|password|token|ssn|phone)|localStorage\.setItem\s*\(\s*['"](?:token|auth|session|password)/i,
        maxMatches: 3,
        redact: true,
        selfReferenceFilter: /\b(?:dev@simplebeacon\.ai|demo@simplebeacon\.ai|test@example\.com|alice@example\.com|trevor_punt@live\.com|audit@simplebeacon\.ai|@live\.com|noreply@|no-reply@|example\.com|placeholder.*@|you@company\.com|user@example\.com|localhost|127\.0\.0\.1|0\.0\.0\.0|::1|generate.*token|send.*email|email.*template|outreach|prospect|marketing|invoice|billing|payment|tier|sandbox|demo|test|fixture|mock|sample|dummy|fake|stub)\b/i,
        contextFilter: (snippet, filePath) => {
            // Skip OSS package maintainer emails in copyright/author headers
            if (/Copyright|Author:|maintainer_email|PACKAGE_BUGREPORT|license|@googlegroups\.com|@google\.com|@apache\.org|@mozilla\.org/.test(snippet)) return false;
            // Skip known vendor/third-party file paths
            if (filePath && /\/(jquery|modernizr|underscore|bootstrap|lodash|moment|react|vue|angular|protobuf|ossp|sphinxtogithub)\b|\.min\.js$|\.pack\.js$|(^|\/)(docs\/|doc\/|third_party\/|thirdparty\/|geedocs\/|vendor\/)\//i.test(filePath)) return false;
            return true;
        },
        message: 'Potential PII or sensitive data exposure in logs or storage detected.'
    },
    configDrift: {
        id: 'configDrift',
        name: 'Configuration Drift',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /localhost:\d+|127\.0\.0\.1:\d+|hardcoded.*url|password\s*=\s*['"]|secret\s*=\s*['"]|api_key\s*=\s*['"]/i,
        maxMatches: 3,
        redact: true,
        contextFilter: (snippet, filePath) => {
            // Skip VS Code configuration defaults and comments about hardcoded URLs
            if (/config\.get<|vscode\.workspace\.getConfiguration|\.get\(['"]\w+['"]\s*,\s*['"]/.test(snippet)) return false;
            if (/\/\/.*hardcoded|\/\*.*hardcoded|move hardcoded|configuration drift/i.test(snippet)) return false;
            // Skip findingConverter.ts rule definitions
            if (filePath && /findingConverter\.ts$/.test(filePath)) return false;
            // Skip localhost in comments and doc strings explaining default values
            if (/\/\/.*localhost|\/\*.*localhost|#.*localhost|default\s*=\s*['"]http:\/\/localhost/.test(snippet)) return false;
            // Skip localhost in Python argparse defaults and string replace calls (test URLs)
            if (/default\s*=\s*['"]http:\/\/localhost|\.replace\s*\(\s*['"]localhost/.test(snippet)) return false;
            // Skip scanner's own false-positive filter regexes in remediationProvider.ts and similar files
            if (/\/(hardcoded url|hardcoded secret)\/i\.test\(/.test(snippet)) return false;
            // Skip explanation text about hardcoded URLs in remediation/fix descriptions
            if (/(explanations|getSteps|fix:|message:).*(hardcoded|configuration values|deployments fragile)/i.test(snippet)) return false;
            // Skip remediation provider isCliFalsePositive method body
            if (/isCliFalsePositive|isBuildArtifact/.test(snippet) && /type\s*===|return true|return false/.test(snippet)) return false;
            return true;
        },
        message: 'Hardcoded URL, secret, or .env reference detected. Use environment-based configuration.'
    },
    securityHeaders: {
        id: 'securityHeaders',
        name: 'Missing Security Header',
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby'],
        severity: 'medium',
        pattern: /Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|Referrer-Policy| helmet\(\)|helmet\s*\.\w+/i,
        maxMatches: 2,
        contextFilter: (snippet, filePath) => {
            // Skip files that already HAVE CSP meta tags (they have security headers configured)
            if (/<meta[^>]*http-equiv=["']?Content-Security-Policy/i.test(snippet)) return false;
            // Skip CSP source variable references in webview code
            if (/cspSource|csp-source|origin\s*\+|['"]nonce-/i.test(snippet)) return false;
            // Skip scanner's own false-positive filter code (remediationProvider.ts, scanner-patterns.js, etc.)
            if (/(missing security header|security header|content-security-policy)/i.test(snippet) && /return true|return false|\.test\(|\.match\(|contextFilter/i.test(snippet)) return false;
            // Skip explanation text in remediation provider fix descriptions
            if (/Add helmet middleware|reverse proxy with CSP|configure reverse proxy/i.test(snippet)) return false;
            return true;
        },
        message: 'Review security header configuration. Ensure CSP, X-Frame-Options, HSTS, and Referrer-Policy are set.'
    },
    dbAntiPattern: {
        id: 'dbAntiPattern',
        name: 'Database Anti-Pattern',
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby'],
        severity: 'high',
        pattern: /SELECT\s+.*['"]\s*\+\s*['"]|query\s*\(\s*['"].*\+\s*['"]|raw\s*\(\s*['"].*\$\{|\.findAll\s*\(\s*\)(?!.*limit)|execute\s*\(\s*['"].*\+\s*['"]/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip jQuery DOM element creation misidentified as SQL concatenation
            if (/jQuery\s*\(\s*['"]<[^'"]+>['"]\s*\)|\.appendTo\s*\(\s*document\.body\s*\)|nodeName/.test(snippet)) return false;
            return true;
        },
        message: 'Raw SQL concatenation or unbounded query detected. Use parameterized queries and pagination.'
    },
    innerHtmlXss: {
        id: 'innerHtmlXss',
        name: 'innerHTML XSS Risk',
        appliesTo: ['javascript', 'typescript', 'html'],
        severity: 'medium',
        pattern: /\.innerHTML\s*=\s*[^'"]/i,
        maxMatches: 3,
        selfReferenceFilter: /scanner-patterns|scanner-engine|ui-renderer|token-manager|certificate-module|scan-worker|main\.js|contact\.js|roadmap\.html|upload\.html|server\.cjs|report\.json|explainability\.md|certificate\.html|certificate\.png|executive-summary\.md|remediation-checklist\.md|dev-report\.html|manifest\.json|findings\.md|site-config\.js|generate-token\.js|run-all-tier-scans|free-token|lib\/db|trello-roadmap-export|routes\/(certificates|checkout|subscriptions)|services\/email|modules\/|eslint-report|pattern-documentation|quick-actions|scan-utils|phase-registry|scan-directory|local-scanner-bridge|analyze-directory|count-all-files|count-files|test-all-patterns|run-cli-scan|update-cache|fix-|repair-|js\/dashboard\/utils|ai-slop-cop-report|full-audit-report|cascade-root-report|cli-test-report|coming-soon-report|coming-soon-final|ai-platform-report|report-gate-pass|New folder|simplebeacon-export-operator/i,
        contextFilter: (snippet, filePath) => {
            // Skip scanner/dashboard files that build static HTML templates (no user input)
            if (/scanner-patterns\.js|scanner-engine\.js|ui-renderer\.js|token-file-system\.js|certificate-module\.js|main\.js/i.test(filePath)) return false;
            // Skip VS Code extension webview panels
            if (/webviewPanel|web2Panel|dashboard2_0|enhancedDashboard|browserPreview|codeMapProvider|scanPanel|uploadPanel/i.test(filePath)) return false;
            // Skip static template assignments with no user-input interpolation
            // Safe if innerHTML = `...` contains only static HTML (no ${userInput} or ${data})
            if (/\.innerHTML\s*=\s*`[^`]*`/.test(snippet) && !/\$\{[^}]*\}/.test(snippet)) return false;
            // Skip dashboard view files that render static UI markup
            if (filePath && /\/views\/(Audit|Quality|Security|Trust|Profile|Chatbot|SignIn)View\.js$/i.test(filePath) && /container\.innerHTML|recoveryForm\.innerHTML/.test(snippet)) return false;
            return true;
        },
        message: 'innerHTML assignment detected. Ensure content is sanitized or from a trusted source to prevent XSS.'
    },
    prototypePollution: {
        id: 'prototypePollution',
        name: 'Prototype Pollution Risk',
        appliesTo: ['javascript'],
        severity: 'high',
        pattern: /Object\.prototype\.|__proto__\s*[:=]|\['__proto__'\]\s*:/i,
        maxMatches: 3,
        selfReferenceFilter: /Object\.prototype\.hasOwnProperty\.call|Object\.prototype\.toString\.call/i,
        message: 'Modifying Object.prototype or __proto__ — prototype pollution vulnerability. Use Object.create(null) or Map.'
    },
    unhandledPromise: {
        id: 'unhandledPromise',
        name: 'Unhandled Promise',
        appliesTo: ['javascript', 'typescript'],
        severity: 'medium',
        pattern: /\.then\s*\([^)]*\)(?!\s*\.(catch|finally))\s*;?\s*$/m,
        maxMatches: 3,
        selfReferenceFilter: /await\s+\w+\.then\s*\(/i,
        fix: { search: /(\.then\s*\([^)]*\))\s*;?\s*$/m, replace: '$1.catch(err => console.error(err));' },
        message: 'Promise chain missing .catch() handler — unhandled rejection. Add error handling.'
    },
    insecureRandom: {
        id: 'insecureRandom',
        name: 'Insecure Random for Security',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'high',
        pattern: /Math\.random\s*\(\)(?=.*(?:token|password|secret|salt|nonce|uuid|id|key))/i,
        maxMatches: 3,
        selfReferenceFilter: /scanner-patterns|scanner-engine|pattern-documentation|test-all-patterns/i,
        fix: { search: /Math\.random\s*\(\)/, replace: 'crypto.randomBytes(16).toString("hex")' },
        message: 'Math.random() used for crypto/security — predictable values. Use crypto.randomBytes().'
    },
    loggingSecrets: {
        id: 'loggingSecrets',
        name: 'Sensitive Data in Logs',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'high',
        pattern: /console\.(log|warn|error|info)\s*\([^)]*(?:password|token|secret|apiKey|api_key|privateKey|private_key|credential)/i,
        maxMatches: 3,
        selfReferenceFilter: /scanner-patterns|scanner-engine|pattern-documentation|test-all-patterns|fixRegistry|findingConverter/i,
        contextFilter: (snippet, filePath) => {
            // Exclude when sensitive word is only inside a string literal
            const hasVariable = /\b(?:token|password|secret|apiKey|api_key|privateKey|private_key|credential)\s*[,+)]/.test(snippet);
            const onlyInString = /['"][^'"]*(?:token|password|secret|apiKey|api_key|privateKey|private_key|credential)[^'"]*['"]/.test(snippet);
            if (!hasVariable && onlyInString) return false;
            // Exclude commented-out console.log lines
            if (/\/\/\s*console\.(log|error|warn)/i.test(snippet)) return false;
            // Exclude error handling in catch blocks
            if (/catch\s*\([^)]*\)\s*\{[^}]*console\.(error|warn)/i.test(snippet)) return false;
            return true;
        },
        message: 'Password, token, or secret value being logged. Remove secrets from log statements.'
    },
    evalDanger: {
        id: 'evalDanger',
        name: 'Dangerous eval() Usage',
        appliesTo: ['javascript', 'python', 'php', 'ruby'],
        severity: 'high',
        pattern: /\beval\s*\(|\bnew\s+Function\s*\(|\bsetTimeout\s*\(\s*['"`]|\bsetInterval\s*\(\s*['"`]|\bsystem\s*\(/i,
        maxMatches: 3,
        selfReferenceFilter: /new\s+RegExp\s*\(|RegExp\s*\(\s*['"`]|message:\s*['"]eval\(\)|severity.*warning.*eval-usage|scanner-patterns|scanner-engine|pattern-documentation/i,
        contextFilter: (snippet, filePath) => {
            // new RegExp() is safe regex construction
            if (/new\s+RegExp\s*\(/i.test(snippet)) return false;
            // Exclude 'system' when inside a string literal
            if (/['"][^'"]*system\s*\(/i.test(snippet) && !/[^'"]\)system\s*\(/.test(snippet)) return false;
            // Skip C++ CmdLine::System() process spawning (not JS eval)
            if (filePath && /\.(cpp|c|h|hpp|cc)$/.test(filePath) && /cmdline\.System|CmdLine::System|\.System\s*\(/.test(snippet)) return false;
            // Skip Python os.system() in build scripts
            if (filePath && /\.(py)$/.test(filePath) && /os\.system\s*\(/.test(snippet) && /build|version|update|test/.test(filePath)) return false;
            // Skip VS Code extension source files that define scanner patterns (not actual eval usage)
            if (filePath && /simplebeacon-vscode.*\/(?:realtimeMonitor|workspaceAnalyzer|enhancedAIProvider|enhancedDashboard2_0|findingConverter|remediationProvider)\.ts$/i.test(filePath)) return false;
            return true;
        },
        message: 'eval(), new Function(), or dynamic code execution — code injection risk. Use structured parsing instead.'
    },
    committedEnvFile: {
        id: 'committedEnvFile',
        name: 'Committed .env File',
        appliesTo: ['javascript', 'typescript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet'],
        severity: 'critical',
        pathPattern: /(^|[\\/])\.env$/,
        skipPathPattern: /\.env\.(example|sample|template|local\.example)$/,
        maxMatches: 1,
        message: '.env file committed to repository — environment secrets may be exposed. Use .env.example instead.'
    },
    secretInComment: {
        id: 'secretInComment',
        name: 'Secret in Comment',
        appliesTo: ['javascript', 'typescript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet'],
        severity: 'high',
        pattern: /(?:\/\/|\/\*|\*|#)\s*(?:api[_-]?key|secret|token|password|private[_-]?key|client[_-]?secret)\s*[:=]\s*['"`]?[a-zA-Z0-9_\-]{16,}/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip scanner's own pattern definitions
            if (filePath && /scanner-patterns|scanner-engine|pattern-documentation/i.test(filePath)) return false;
            return true;
        },
        message: 'Credential or secret value found in code comment. Remove before committing.'
    },
    weakCryptography: {
        id: 'weakCryptography',
        name: 'Weak Cryptography',
        appliesTo: ['javascript', 'typescript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet'],
        severity: 'high',
        pattern: /\bmd5\s*\(|\bsha1\s*\(|\bDES\b|\bRC4\b|\bTripleDES\b|\b3DES\b|\bcrypto\.createHash\s*\(\s*['"`][ms]d5['"`]|\bcrypto\.createHash\s*\(\s*['"`]sha1['"`]/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip when inside a comment describing the weakness
            if (/\/\/.*weak|deprecated|do not use|avoid/i.test(snippet)) return false;
            return true;
        },
        message: 'Weak hash/cipher (MD5, SHA1, DES, RC4) detected. Use SHA-256+ or AES.'
    },
    redosRisk: {
        id: 'redosRisk',
        name: 'ReDoS Risk',
        appliesTo: ['javascript', 'typescript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /\(\[\^\]\]\*\)\*|\(\[\^\]\]\+\)\+|\(\[\^\]\]\*\)\+|\(\[\^\]\]\+\)\*|\(\(\?:\[\^\]\]\*\)\+\)\*|\(\[\^\]\]\*\)\{[0-9,]*\}\*|\(\[\^\]\]\*\)\*\+|\(\[\^\]\]\+\)\*\+|\(\[\^\]\]\*\)\?\*|\(\[\^\]\]\+\)\?\*/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip when regex is a string literal (not constructed)
            if (/['"`]/.test(snippet) && !/new\s+RegExp/.test(snippet)) return false;
            return true;
        },
        message: 'Regular expression with nested quantifiers — potential ReDoS. Refactor to avoid catastrophic backtracking.'
    },
    cicdSecretExposure: {
        id: 'cicdSecretExposure',
        name: 'CI/CD Secret Exposure',
        appliesTo: ['javascript', 'typescript', 'python', 'java', 'go', 'php', 'ruby', 'dotnet'],
        severity: 'critical',
        pattern: /(?:GITHUB_TOKEN|GH_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|DOCKER_PASSWORD|NPM_TOKEN|SLACK_TOKEN|SONAR_TOKEN)\s*[:=]\s*['"`]?[^\s'"`]{8,}/i,
        maxMatches: 3,
        pathPattern: /\.(yml|yaml|json)$/,
        contextFilter: (snippet, filePath) => {
            // Only flag if it looks like a real value, not a placeholder or variable reference
            if (/\$\{\{|\$\w+|secrets\./i.test(snippet)) return false;
            if (/example|placeholder|your_|my_|change|replace/i.test(snippet)) return false;
            return true;
        },
        message: 'Hardcoded CI/CD secret in workflow/config file. Use repository secret variables instead.'
    },
    frameworkPractice: {
        id: 'frameworkPractice',
        name: 'Framework Practice Issue',
        appliesTo: ['javascript', 'typescript'],
        severity: 'low',
        pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]{0,60}\}\s*\)(?!.*,\s*\[)|useState\s*\(\s*\)\s*;(?=.*useState\s*\(\s*\))|this\.\$refs\.|ngOnInit\s*\(\s*\)[\s\S]{0,200}(?!.*ngOnDestroy)/i,
        maxMatches: 3,
        message: 'React hook misuse or missing Angular cleanup detected.'
    },
    apiContractDrift: {
        id: 'apiContractDrift',
        name: 'API Contract Drift',
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby'],
        severity: 'low',
        pattern: /@app\.|@router\.|openapi|swagger/i,
        maxMatches: 3,
        message: 'REST endpoint or OpenAPI reference detected. Verify frontend consumes all defined routes.'
    },
    complexityMetric: {
        id: 'complexityMetric',
        name: 'High Complexity',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{300,2000}?\}|def\s+\w+\s*\([^)]*\):[\s\S]{300,2000}?(?=\ndef |\nclass |\Z)|if\s*\([^)]*\)\s*\{[\s\S]{0,120}?if\s*\([^)]*\)\s*\{[\s\S]{0,120}?if\s*\(|try\s*\{[\s\S]{0,60}?try\s*\{|for\s*\([^)]*\)\s*\{[\s\S]{0,60}?for\s*\(/i,
        maxMatches: 3,
        message: 'Overly long function or deeply nested control flow detected. Consider refactoring.'
    },
    llmSlop: {
        id: 'llmSlop',
        name: 'LLM Slop / Placeholder',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'html', 'json', 'yaml', 'yml'],
        severity: 'medium',
        pattern: /YOUR_[A-Z0-9_]+_HERE|INSERT_[A-Z0-9_]+_HERE|\[Insert\s[^\]]+\]|\/\/\s*Handle\s+this\s+later|\/\/\s*AI\s+Generated\s+Placeholder|```(?:javascript|typescript|python|json)\s*$|```\s*$|99\.99\s*%?\s*Uptime|100\s*%?\s*Secure|Lorem\s+Ipsum\s+Dolor|9,999\s*Users/i,
        maxMatches: 5,
        selfReferenceFilter: /llm-slop-patterns|fiction-kpi|rejectedFiction|not model output|baseline false|scanner-patterns/i,
        // Enhanced context-aware filtering
        contextFilter: (snippet, filePath) => {
            // Skip template files and documentation
            if (/\.template\.|\.example\.|\.sample\.|_template\.|_example\./i.test(filePath)) return false;
            // Skip README and documentation files
            if (/readme|docs?|guide|tutorial|example/i.test(filePath)) return false;
            // Skip legitimate configuration placeholders
            if (/\.env\.example|config\.example|docker-compose\.example/i.test(filePath)) return false;
            // Skip test fixtures and mocks
            if (/fixture|mock|test-data|__tests__|spec/i.test(filePath)) return false;
            // Allow legitimate TODO comments in development
            if (/\/\/\s*TODO:?|\/\/\s*FIXME:?|#\s*TODO:?/i.test(snippet) && !/AI\s+Generated|Placeholder/i.test(snippet)) return false;
            // Skip legitimate markdown in documentation
            if (/\.md$|\.markdown$/i.test(filePath) && /```[a-z]+\s*$/.test(snippet)) return false;
            return true;
        },
        message: 'Unresolved LLM placeholder, markdown code fence leaked into source, or hardcoded AI-default metric copy detected.'
    },
    tokenBleed: {
        id: 'tokenBleed',
        name: 'Token Bleed Risk',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /(?:'(?:[^'\\]|\\.){2000,}'|"(?:[^"\\]|\\.){2000,}"|`(?:[^`\\]|\\.){2000,}`)/,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip minified Google Maps loader JS files
            if (filePath && /\/(mapfiles|poly|geometry|stats|usage|visualization|earthbuilder_impl)\.js$|\.pack\.js$|\.min\.js$/i.test(filePath)) return false;
            return true;
        },
        message: 'Very long string literal (>2000 chars) detected — risk of unchunked context overflow in LLM prompts.'
    },
    productionLeak: {
        id: 'productionLeak',
        name: 'Production Data Leak',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /['"`][^'"`]*(?:\/|\\)mock(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*(?:\/|\\)fixtures(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*(?:\/|\\)sample(?:\/|\\)[^'"`]+['"`]|['"`][^'"`]*web(?:\/|\\)data[^'"`]*['"`]|['"`][^'"`]*-sample\.json['"`]|['"`][^'"`]*(?:\/|\\)test-data(?:\/|\\)[^'"`]+['"`]/i,
        maxMatches: 3,
        selfReferenceFilter: /production-leak|llm-slop-patterns|fiction-kpi|rejectedFiction|scanner-patterns/i,
        // Enhanced context-aware filtering
        contextFilter: (snippet, filePath) => {
            // Allow test files to reference test data
            if (/test|spec|__tests__|\.test\.|\.spec\./i.test(filePath)) return false;
            // Allow fixture files to reference other fixtures
            if (/fixture|mock/i.test(filePath)) return false;
            // Skip configuration and example files
            if (/\.example\.|\.sample\.|\.template\.|config\.example/i.test(filePath)) return false;
            // Allow development and staging references
            if (/dev|staging|local|test/i.test(snippet)) return false;
            // Skip legitimate variable names containing 'sample' or 'mock' (not path references)
            if (/\b(?:const|let|var)\s+(?:sampleFiles|sampleUrl|sampleData|recentSamples|sampleCount|mockData|mockUrl)\b/.test(snippet)) return false;
            // Skip internal API imports (not production leaks)
            if (/require\(['"]\.\/.*stub-api['"]\)|setupDashboardStubAPIs/.test(snippet)) return false;
            // Skip error handling messages mentioning stub APIs
            if (/stub APIs|fallback|using stub/.test(snippet)) return false;
            return true;
        },
        message: 'Mock, fixture, or sample data path referenced in source code. Verify no test data leaks to production.'
    },
    fictionKpi: {
        id: 'fictionKpi',
        name: 'Hardcoded Fiction KPI',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'json'],
        severity: 'medium',
        pattern: /\b(?:totalFeatures|featuresTracked|aiOptimizationsApplied|issuesDetected|issuesFound|patternsIdentified|openIssues)\s*[:=]\s*["']?\d+\b|\b(?:aiConfidence|confidence|accuracy|completionRate)\s*[:=]\s*["']?\d{1,3}\b|\b\d{1,3}\s*%\s*(?:completion|accuracy|confidence|uptime|secure)\b/i,
        maxMatches: 3,
        selfReferenceFilter: /rejectedFiction|fiction-kpi|fictionRemoved|fictionVsReality|not model output|baseline false|progressMetrics|scanner-patterns/i,
        contextFilter: (snippet, filePath) => {
            // Skip uploadPanel.ts type detection functions — confidence is a classifier score, not a KPI
            if (filePath && /uploadPanel\.ts$/i.test(filePath) && /return\s*\{\s*type:\s*['"]/.test(snippet)) return false;
            // Skip type detection mapping where confidence identifies report format
            if (/detectReportType|classifyReport|identifyFormat|typeField.*confidence/.test(snippet)) return false;
            return true;
        },
        message: 'Hardcoded metric or KPI value detected. Verify data is real, not generated fiction.'
    },
    syncIo: {
        id: 'syncIo',
        name: 'Synchronous File Operation',
        appliesTo: ['javascript'],
        severity: 'medium',
        pattern: /\bfs\.(readFileSync|writeFileSync|appendFileSync|copyFileSync|mkdirSync|readdirSync|statSync)\s*\(/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (!filePath) return true;
            const p = filePath.toLowerCase();
            // CLI tools, scripts, and server bootstrap code legitimately use sync I/O
            if (/(?:^|\/)tools\//.test(p)) return false;
            if (/(?:^|\/)docs\//.test(p)) return false;
            if (/(?:^|\/)web\/data\//.test(p)) return false;
            if (/(?:^|\/)server\/(?:bootstrap|utils|services|routes)\//.test(p)) return false;
            if (/_find-|_restore-|auto-processor|simplebeacon-server/.test(p)) return false;
            // VS Code extension source files use sync fs for initialization, package.json reads, template loading
            if (/(?:^|\/)simplebeacon-vscode(?:-merged)?\/src\//.test(p)) return false;
            if (/(?:^|\/)ai-platform\/simplebeacon-vscode\/src\//.test(p)) return false;
            // Build scripts use sync fs for file copying and package generation
            if (/build-extension\.js|build-public\.js|replace-dashboard\.js/.test(p)) return false;
            // Skip extension.ts reads of package.json or report.json (initialization only)
            if (/extension\.ts.*readFileSync.*package\.json|extension\.ts.*readFileSync.*report\.json/.test(snippet)) return false;
            return true;
        },
        message: 'Synchronous fs read/write blocks the event loop. Use fs.promises instead. (fs.existsSync is excluded — it is a lightweight stat check.)'
    },
    magicNumber: {
        id: 'magicNumber',
        name: 'Magic Number',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        // Skip numbers already assigned to named constants (const FOO = 123) and common safe literals
        pattern: /(?<!\b(?:const|let|var)\s+\w+\s*=\s*)[<>!=]\s*\b\d{3,}\b|\b(?:timeout|delay|port|max|min|limit|size|count)\s*[:=]\s*\d{2,}\b/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip named constants (const FOO = 12345) — already properly named
            if (/\b(?:const|let|var)\s+\w+\s*=\s*\d+/.test(snippet)) return false;
            // Skip completion/status checks like progress === 100 or status === 200
            if (/\b(?:progress|status|code|length|size|count|total|index)\s*[<>=!]+\s*\d+/.test(snippet)) return false;
            // Skip display/ truncation limits like slice(0, 300)
            if (/\b(?:slice|substr|substring|limit|truncate|maxLength|padStart|padEnd)\s*\(\s*[^)]*\d{3,}/.test(snippet)) return false;
            // Skip price/cost constants (already named like PRICE_X = 4900)
            if (/\b(?:PRICE_|COST_|FEE_|RATE_|AMOUNT_)\w+\s*=\s*\d+/.test(snippet)) return false;
            // Skip timeout constants (already named like LOCK_HEARTBEAT_MS = 30000)
            if (/\b(?:_TIMEOUT_|_INTERVAL_|_HEARTBEAT_|_DELAY_|_MS|_SECONDS?)\w*\s*=\s*\d+/.test(snippet)) return false;
            return true;
        },
        message: 'Hardcoded numeric literal — extract to named constant (e.g., const MAX_RETRIES = 3).'
    },
    missingStrictMode: {
        id: 'missingStrictMode',
        name: 'Missing Strict Mode',
        appliesTo: ['javascript'],
        severity: 'low',
        // Only match the first non-blank, non-comment line of a .js file when it isn't 'use strict'
        pattern: /^\s*(?!\/\*\*)(?!\/\/)(?!\s*$)(?!\s*['"]use strict['"]).*/m,
        maxMatches: 1,
        contextFilter: (snippet, filePath) => {
            // Skip JSDoc comment continuation lines (lines starting with * inside a /** block)
            if (/^\s*\*/.test(snippet)) return false;
            // Skip files where 'use strict' appears later in the matched snippet or context
            if (/'use strict'/.test(snippet)) return false;
            return true;
        },
        message: "File does not start with 'use strict' — implicit globals and silent errors possible."
    },
    uninitializedRead: {
        id: 'uninitializedRead',
        name: 'Uninitialized Variable Read',
        appliesTo: ['javascript', 'typescript'],
        severity: 'medium',
        // Only match let/var declarations that have NO initializer (let x;), not let x = value;
        pattern: /\b(let|var)\s+(\w+)(?:\s*,\s*\w+)*\s*;(?!\s*=)/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath, context) => {
            // context is the 3-line surrounding context [prev, snippet, next]
            const ctx = Array.isArray(context) ? context.join('\n') : '';
            // Skip standard try/catch initialization patterns (let x; try { x = ... })
            if (/try\s*\{/.test(ctx)) return false;
            // Skip if the variable is assigned on the very next line
            if (/\b\w+\s*=\s*[^;]+;/.test(ctx)) return false;
            return true;
        },
        message: 'Variable declared without an initializer. Initialize at declaration if possible.'
    },
    unvalidatedRedirect: {
        id: 'unvalidatedRedirect',
        name: 'Unvalidated Redirect',
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby'],
        severity: 'high',
        pattern: /window\.location\s*=\s*[^'"]|window\.location\.href\s*=\s*[^'"]|window\.location\.replace\s*\(\s*[^'"]|res\.redirect\s*\(\s*[^'"]|res\.redirect\s*\(\s*req\.|location\.href\s*=\s*req\./i,
        maxMatches: 3,
        message: 'Redirect with user-controlled input — open redirect vulnerability. Whitelist destinations.'
    },
    missingRateLimit: {
        id: 'missingRateLimit',
        name: 'Missing Rate Limiting',
        appliesTo: ['javascript', 'python', 'java', 'go', 'php', 'ruby'],
        severity: 'medium',
        pattern: /app\.(get|post|put|delete|patch)\s*\([^)]*\)(?!.*rateLimit|.*throttle|.*limiter)/i,
        maxMatches: 3,
        message: 'API endpoint without rate limiting — DoS vulnerability. Add express-rate-limit or similar.'
    },
    architectureDrift: {
        id: 'architectureDrift',
        name: 'Architecture Drift',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /\b(hybrid|state-space|long-context)\b(?!.*\b(schema|validator|zod|ajv|json_schema|response_format)\b)/i,
        maxMatches: 3,
        selfReferenceFilter: /scanner-patterns|scanner-engine|simplebeacon-intelligence|architecture-drift|@simplebeacon\/intelligence/,
        contextFilter: (snippet, filePath) => {
            // Skip JSDoc / block-comment lines where hybrid is used descriptively
            if (/^\s*\*\s/.test(snippet)) return false;
            if (/\bhybrid\s+(?:intent|analysis|approach|modeling|system|platform)\b/i.test(snippet)) return false;
            if (!filePath) return true;
            const p = filePath.toLowerCase();
            if (/(?:^|\/)(scanner-patterns|scanner-engine|simplebeacon-intelligence)/.test(p)) return false;
            return true;
        },
        message: 'Hybrid or state-space model identifier without schema/validator guard. Add zod/ajv validation.'
    },
    hardcodedConfidence: {
        id: 'hardcodedConfidence',
        name: 'Hardcoded Confidence Score',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'json'],
        severity: 'low',
        pattern: /confidence\s*:\s*0\.\d+/i,
        maxMatches: 3,
        message: 'Hardcoded confidence score — replace with computed value.'
    },
    hardcodedCompletion: {
        id: 'hardcodedCompletion',
        name: 'Hardcoded Completion Rate',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet', 'json'],
        severity: 'low',
        pattern: /completionRate\s*:\s*\d+/i,
        maxMatches: 3,
        message: 'Hardcoded completion rate — replace with real metric.'
    },
    mockPathLeak: {
        id: 'mockPathLeak',
        name: 'Mock/Fixture Path in Production',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /['"`](mock\/|fixture\/|test\/data\/|web\/data)[^'"`]*['"`]/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip test files and fixture files
            if (filePath && /\.(test|spec)\.|fixture|mock|__tests__/.test(filePath)) return false;
            // Skip files that legitimately reference web/data (like app-links.js)
            if (/sampleReportUrl|data-sample-report/.test(snippet)) return false;
            return true;
        },
        message: 'Mock or fixture path referenced in production code. Remove mock references.'
    },
    sampleJsonRef: {
        id: 'sampleJsonRef',
        name: 'Sample JSON Reference',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /['"`][^'"`]*-sample\.json['"`]/i,
        maxMatches: 3,
        message: 'Sample JSON file referenced in production code. Replace with production data source.'
    },
    governanceMarker: {
        id: 'governanceMarker',
        name: 'License/Governance Marker',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /SPDX-License-Identifier|MIT License|Apache License|GNU General Public License|All rights reserved|Copyright \(c\)|License: /i,
        maxMatches: 1,
        selfReferenceFilter: /eslint\.config|jest\.config|\.config\.|\.test\.|[\"']SPDX-License-Identifier[\"']/,
        message: 'License or copyright marker detected. Verify open-source compatibility.'
    },
    aiPlaceholderComment: {
        id: 'aiPlaceholderComment',
        name: 'AI Placeholder Comment',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /\/\/\s*(TODO|FIXME|HACK|AI):?\s*(AI|implement|fix|add logic|placeholder|stub)/i,
        maxMatches: 3,
        message: 'Placeholder comment generated by AI. Replace with actual implementation.'
    },
    aiPlaceholderBlock: {
        id: 'aiPlaceholderBlock',
        name: 'AI Placeholder Block Comment',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /\/\*\s*(TODO|FIXME|HACK|AI).*?\*\//is,
        maxMatches: 3,
        message: 'Placeholder block comment. Remove or implement.'
    },
    markdownFenceLeak: {
        id: 'markdownFenceLeak',
        name: 'Markdown Fence in Code',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'medium',
        pattern: /^```\w*$/m,
        maxMatches: 3,
        message: 'Markdown code fence (```) leaked into source file. Remove fence lines.'
    },
    emptyStubFunction: {
        id: 'emptyStubFunction',
        name: 'Empty Stub Function',
        appliesTo: ['javascript', 'java', 'go', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            if (!filePath) return true;
            const p = filePath.toLowerCase();
            if (/(?:^|\/)(docs\/outreach|demo|fixture|mock|sample|test|stub|noop|placeholder)/.test(p)) return false;
            return true;
        },
        message: 'Function body is empty — likely AI-generated stub. Implement or remove.'
    },
    arrowStub: {
        id: 'arrowStub',
        name: 'Arrow Function Stub',
        appliesTo: ['javascript', 'typescript'],
        severity: 'low',
        pattern: /const\s+\w+\s*=\s*\(\)\s*=>\s*\(\{\}\)/,
        maxMatches: 3,
        message: 'Arrow function returns empty object — likely AI stub. Implement return value.'
    },
    roadmapMarker: {
        id: 'roadmapMarker',
        name: 'Roadmap Marker',
        appliesTo: ['javascript', 'python', 'java', 'go', 'rust', 'php', 'ruby', 'dotnet'],
        severity: 'low',
        pattern: /\b(HACK|XXX|WORKAROUND)\b(?!\s*[:;-]\s*\S{4,})/i,
        maxMatches: 3,
        contextFilter: (snippet, filePath) => {
            // Skip if the match is inside a regex literal
            if (/(\/[^\/]*(?:HACK|XXX|WORKAROUND)[^\/]*\/|new RegExp\()/i.test(snippet)) return false;
            if (!filePath) return true;
            const p = filePath.toLowerCase();
            // Skip scanner/engine files that define regex patterns for these markers
            if (/(?:^|\/)(scanner-patterns|scanner-engine|production-debug-guard|scan-github-repo|repository-scanner-api|index\.cjs)/.test(p)) return false;
            // Skip TODO/FIXME in test files and pattern documentation
            if (/\.(test|spec)\.|pattern-documentation|test-all-patterns/.test(filePath)) return false;
            return true;
        },
        message: 'Unresolved roadmap marker detected in source. Resolve or track in issue tracker.'
    }
};

/**
 * Schema overlay for each analyzer: category (for routing) and exclusion profile.
 * Adding a new analyzer only requires one line here instead of 15+ scattered edits.
 */
const ANALYZER_SCHEMA = {
    aiIndicators:     { category: 'aiIndicators',  exclusionProfile: 'aiIndicators' },
    credentials:      { category: 'credentials',   exclusionProfile: 'noArtifacts' },
    debugArtifacts:   { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    pythonDebug:      { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    javaDebug:        { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    pythonFramework:  { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    javaFramework:    { category: 'credentials',   exclusionProfile: 'noArtifacts' },
    goDebug:          { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    goFramework:      { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    rustDebug:        { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    rustFramework:    { category: 'credentials',   exclusionProfile: 'noArtifacts' },
    phpDebug:         { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    phpFramework:     { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    dotnetDebug:      { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    dotnetFramework:  { category: 'credentials',   exclusionProfile: 'noArtifacts' },
    rubyDebug:        { category: 'debug',         exclusionProfile: 'sourceCodeOnly' },
    rubyFramework:    { category: 'credentials',   exclusionProfile: 'noArtifacts' },
    aiResidueStub:    { category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' },
    aiResidueSwallow: { category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' },
    aiResidueDeprecated:{ category: 'aiResidue',    exclusionProfile: 'sourceCodeOnly' },
    aiResidueDeadCode:{ category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' },
    perfNestedLoop:   { category: 'performance',   exclusionProfile: 'noBuildArtifacts' },
    typeSafetyAny:    { category: 'typeSafety',    exclusionProfile: 'sourceCodeOnly' },
    missingTest:      { category: 'testCoverage',  exclusionProfile: 'sourceCodeOnly' },
    a11yGap:          { category: 'accessibility', exclusionProfile: 'sourceCodeOnly' },
    i18nHardcoded:    { category: 'i18n',          exclusionProfile: 'sourceCodeOnly' },
    sensitiveData:    { category: 'sensitiveData', exclusionProfile: 'sourceCodeOnly' },
    configDrift:      { category: 'configDrift',   exclusionProfile: 'sourceCodeOnly' },
    securityHeaders:  { category: 'securityHeaders', exclusionProfile: 'sourceCodeOnly' },
    dbAntiPattern:    { category: 'databasePatterns', exclusionProfile: 'sourceCodeOnly' },
    frameworkPractice:{ category: 'frameworkPractices', exclusionProfile: 'sourceCodeOnly' },
    unusedDep:        { category: 'unusedDeps',    exclusionProfile: 'sourceCodeOnly' },
    apiContractDrift: { category: 'apiContract',   exclusionProfile: 'sourceCodeOnly' },
    complexityMetric: { category: 'complexity',      exclusionProfile: 'noBuildArtifacts' },
    llmSlop:          { category: 'llmSlop',       exclusionProfile: 'sourceCodeOnly' },
    tokenBleed:       { category: 'tokenBleed',    exclusionProfile: 'sourceCodeOnly' },
    productionLeak:   { category: 'productionLeak',  exclusionProfile: 'sourceCodeOnly' },
    fictionKpi:       { category: 'fictionKpi',    exclusionProfile: 'sourceCodeOnly' },
    syncIo:           { category: 'performance',   exclusionProfile: 'sourceCodeOnly' },
    evalDanger:       { category: 'security',      exclusionProfile: 'sourceCodeOnly' },
    innerHtmlXss:     { category: 'security',      exclusionProfile: 'sourceCodeOnly' },
    prototypePollution:{ category: 'security',     exclusionProfile: 'sourceCodeOnly' },
    unhandledPromise: { category: 'quality',       exclusionProfile: 'sourceCodeOnly' },
    magicNumber:      { category: 'maintainability', exclusionProfile: 'sourceCodeOnly' },
    missingStrictMode:{ category: 'quality',       exclusionProfile: 'sourceCodeOnly' },
    uninitializedRead:{ category: 'quality',       exclusionProfile: 'sourceCodeOnly' },
    unvalidatedRedirect:{ category: 'security',    exclusionProfile: 'sourceCodeOnly' },
    missingRateLimit: { category: 'security',      exclusionProfile: 'sourceCodeOnly' },
    insecureRandom:   { category: 'security',      exclusionProfile: 'sourceCodeOnly' },
    loggingSecrets:   { category: 'security',      exclusionProfile: 'sourceCodeOnly' },
    architectureDrift:{ category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' },
    hardcodedConfidence:{ category: 'fictionKpi',  exclusionProfile: 'sourceCodeOnly' },
    hardcodedCompletion:{ category: 'fictionKpi',  exclusionProfile: 'sourceCodeOnly' },
    mockPathLeak:     { category: 'productionLeak', exclusionProfile: 'sourceCodeOnly' },
    sampleJsonRef:    { category: 'productionLeak', exclusionProfile: 'sourceCodeOnly' },
    governanceMarker: { category: 'governance',    exclusionProfile: 'sourceCodeOnly' },
    aiPlaceholderComment:{ category: 'aiResidue',  exclusionProfile: 'sourceCodeOnly' },
    aiPlaceholderBlock:{ category: 'aiResidue',   exclusionProfile: 'sourceCodeOnly' },
    markdownFenceLeak:{ category: 'llmSlop',       exclusionProfile: 'sourceCodeOnly' },
    emptyStubFunction:{ category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' },
    arrowStub:        { category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' },
    roadmapMarker:    { category: 'aiResidue',     exclusionProfile: 'sourceCodeOnly' }
};

/**
 * Exclusion rules keyed by profile name. Each receives a context object
 * and returns true when the file should be skipped for that analyzer.
 */
const EXCLUSION_RULES = {
    aiIndicators: (ctx) => ctx.isNodeModule || ctx.isTestOutput || ctx.isTestFile || ctx.isSimplebeaconCache || ctx.isScannerArtifact || ctx.isBuildArtifact,
    noArtifacts:    (ctx) => ctx.isNodeModule || ctx.isSampleOrTest || ctx.isTypeScriptDef || ctx.isScannerArtifact,
    noNodeModules:  (ctx) => ctx.isNodeModule || ctx.isSimplebeaconCache || ctx.isScannerArtifact,
    noBuildArtifacts: (ctx) => ctx.isNodeModule || ctx.isBuildArtifact || ctx.isSimplebeaconCache || ctx.isScannerArtifact || ctx.isTestFile || ctx.isSampleOrTest,
    sourceCodeOnly: (ctx) => !ctx.isSourceCode || ctx.isNodeModule || ctx.isCiWorkflow || ctx.isTestFile || ctx.isServerEntry || ctx.isSimplebeaconCache || ctx.isScannerArtifact || ctx.isBuildArtifact
};

if (typeof window !== 'undefined') {
    window.LANGUAGE_REGISTRY = LANGUAGE_REGISTRY;
    window.PATTERN_REGISTRY = PATTERN_REGISTRY;
    window.ANALYZER_SCHEMA = ANALYZER_SCHEMA;
    window.EXCLUSION_RULES = EXCLUSION_RULES;
}
