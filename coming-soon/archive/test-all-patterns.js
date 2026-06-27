// Test suite for all 32 SimpleBeacon analyzer patterns
// Run with: node test-all-patterns.js

const { test } = require('node:test');
const assert = require('node:assert');

// --- Inline pattern registry (synced with scanner-engine.js) ---
const PATTERN_REGISTRY = {
    credentials: {
        pattern: /password\s*=\s*['"][^'"]{4,}['"]|api_key\s*=\s*['"][A-Za-z0-9_\-]{16,}['"]|secret_key\s*=\s*['"][A-Za-z0-9_\-]{16,}['"]|AWS_ACCESS_KEY_ID\s*=\s*['"][A-Z0-9]{20}['"]/i
    },
    aiIndicators: {
        pattern: /import\s+\{\s*OpenAI\s*\}|from\s+['"]openai['"]|import\s+\{\s*Anthropic\s*\}|from\s+['"]@anthropic\/sdk['"]|import\s+.*LangChain|from\s+['"]langchain['"]|import\s+.*HuggingFace|from\s+['"]@huggingface\/inference['"]|ollama|chatgpt|gpt-4|claude-3|gemini-pro|new\s+OpenAI\(|new\s+ChatOpenAI|createCompletion|createChatCompletion|generateText|streamText|embeddings|vectorStore|pinecone|weaviate|chromadb|qdrant|tensorflow\.js|tf\.layers|torch\.nn|sklearn|transformers|pipeline\s*\(\s*['"]text-generation['"]\)/i
    },
    debugArtifacts: {
        pattern: /console\.(log|warn|error|info|debug)\s*\(|debugger;?|alert\s*\(|prompt\s*\(|confirm\s*\(|TODO|FIXME|HACK|XXX|BUG|console\.table\s*\(|console\.dir\s*\(/i
    },
    pythonDebug: {
        pattern: /print\s*\(|pdb\.set_trace\(\)|import\s+pdb|breakpoint\(\)|logging\.debug|logging\.info|TODO|FIXME|HACK|XXX|pass\s*#\s*debug/i
    },
    javaDebug: {
        pattern: /System\.out\.print(ln)?\s*\(|System\.err\.print(ln)?\s*\(|TODO|FIXME|HACK|XXX|Logger\.getLogger|log\.debug|log\.info/i
    },
    pythonFramework: {
        pattern: /from\s+flask\s+import|import\s+flask|from\s+django\s+import|import\s+django|from\s+fastapi\s+import|import\s+fastapi|from\s+tornado\s+import|import\s+tornado|from\s+bottle\s+import|import\s+bottle|from\s+pyramid\s+import|import\s+pyramid|from\s+cherrypy\s+import|import\s+cherrypy|from\s+web2py\s+import|import\s+web2py|from\s+webpy\s+import|import\s+webpy|from\s+turbogears\s+import|import\s+turbogears|from\s+zope\s+import|import\s+zope/i
    },
    goDebug: {
        pattern: /fmt\.Print(ln|f)?\s*\(|log\.Print(ln|f)?\s*\(|TODO|FIXME|HACK|XXX|\.Log\(\)|\.Debug\(\)|\.Info\(\)/i // simplebeacon-ignore redos — test fixture pattern, not user input
    },
    goFramework: {
        pattern: /import\s+\(\s*["']github\.com\/gin-gonic\/gin["']|import\s+\(\s*["']github\.com\/labstack\/echo["']|import\s+\(\s*["']github\.com\/gorilla\/mux["']|import\s+\(\s*["']github\.com\/go-chi\/chi["']|import\s+\(\s*["']github\.com\/beego\/beego["']|import\s+\(\s*["']github\.com\/kataras\/iris["']|import\s+\(\s*["']github\.com\/gofiber\/fiber["']|import\s+\(\s*["']github\.com\/go-kratos\/kratos["']|import\s+\(\s*["']github\.com\/micro\/go-micro["']|import\s+\(\s*["']github\.com\/go-kit\/kit["']|import\s+\(\s*["']github\.com\/valyala\/fasthttp["']|import\s+\(\s*["']github\.com\/julienschmidt\/httprouter["']|import\s+\(\s*["']github\.com\/go-chi\/chi["']/i
    },
    rustDebug: {
        pattern: /println!?\s*\(|eprintln!?\s*\(|dbg!\s*\(|TODO|FIXME|HACK|XXX|log::debug!|log::info!/i
    },
    rustFramework: {
        pattern: /\.unwrap\s*\(\s*\)(?:\s*\?\s*\.unwrap\s*\(\s*\))+|\.expect\s*\(\s*["']\s*["']\s*\)/i
    },
    aiResidueStub: {
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*TODO|def\s+\w+\s*\([^)]*\):\s*pass\b|public\s+\w+\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*implement|TODO\s*:\s*implement|TODO\s*:\s*AI|TODO\s*:\s*generated|not\s+implemented|place\s*holder|stub\s*implementation|\/\/\s*AI\s+generated|\/\/\s*Generated\s+by\s+(ChatGPT|GPT|Claude|Copilot|Gemini|LLM)/i
    },
    aiResidueSwallow: {
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\([^)]*\)\s*\{\s*\/\/\s*ignore|catch\s*\([^)]*\)\s*\{\s*\/\/\s*TODO|except\s+.*:\s*pass|except\s*:\s*pass|rescue\s+=>\s*\w+\s*#\s*ignore|rescue\s*\{\s*\}|\.catch\s*\(\s*\)\s*\{\s*\}|\.catch\s*\(\s*\)\s*=>\s*\{\s*\}/i
    },
    aiResidueDeprecated: {
        pattern: /var\s+\w+\s*=\s*require\s*\(|jQuery\s*\(|\.ajax\s*\(|componentWillMount\s*\(|componentWillReceiveProps\s*\(|shouldComponentUpdate\s*\(|React\.createClass\s*\(|\.getInitialState\s*\(|asyncio\.coroutine|@asyncio\.coroutine|urllib\.urlopen\s*\(|urllib2\.urlopen\s*\(|xrange\s*\(|raw_input\s*\(|apply\s*\(|execfile\s*\(|file\s*\(|print\s+\w+/i
    },
    aiResidueDeadCode: {
        pattern: /\/\*[\s\S]{80,}\*\/(?!\s*\n\s*(?:export|import|const|let|var|function|class|def|public|private|protected|static|if|for|while|switch|try|return))/i
    },
    perfNestedLoop: {
        pattern: /for\s*\([^)]*\)\s*\{[\s\S]{0,80}for\s*\(|for\s+\w+\s+in\s+\w+\s*:[\s\S]{0,80}for\s+\w+\s+in|while\s*\([^)]*\)\s*\{[\s\S]{0,80}while\s*\(|\.addEventListener\s*\([^,]+,[^)]+\)(?!.*\.removeEventListener)|\.on\s*\(\s*['"]\w+['"]\s*,\s*(?!.*\.off\s*\()/i
    },
    typeSafetyAny: {
        pattern: /:\s*any\b(?!\s*\[\])|PropTypes\.|@ts-ignore|@ts-nocheck|: \(\)\s*=>\s*any|function\s*\w*\s*\([^)]{60,}\)/i
    },
    missingDoc: {
        pattern: /^(?!\s*\/\*\*|\s*\/\/|\s*#|\s*\*|\s*"""|\s*@).{40,}$/m
    },
    missingTest: {
        pattern: /test\.(todo|skip|xit|xtest)\s*\(|describe\.(skip|todo)\s*\(|it\.(skip|todo)\s*\(|pytest\.mark\.skip|@Disabled|func Test.*\{\s*\}/i
    },
    a11yGap: {
        pattern: /<img\s+[^>]*(?!(?:.*alt=))[^>]*>|<(input|textarea|select)\s+[^>]*(?!(?:.*(?:aria-label|aria-labelledby|title|placeholder)))[^>]*>|<button\s+[^>]*(?!(?:.*(?:aria-label|aria-labelledby|title)))[^>]*>\s*<\/button>|<div\s+[^>]*(?:role=["']button["'])[^>]*(?!(?:.*(?:aria-label|aria-labelledby|tabindex)))[^>]*>/i
    },
    i18nHardcoded: {
        pattern: /['"][A-Z][a-zA-Z\s]{2,30}['"]\s*\+|innerHTML\s*=\s*['"][A-Za-z\s]{5,}|textContent\s*=\s*['"][A-Za-z\s]{5,}|document\.title\s*=\s*['"][A-Za-z\s]{3,}|\.toLocaleString\s*\(|new\s+Date\s*\(\s*\)\.toLocale/i
    },
    sensitiveData: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{3}-\d{3}-\d{4}\b|console\.(log|warn|error|info)\s*\(\s*(?:user|customer|email|password|token|ssn|phone)|localStorage\.setItem\s*\(\s*['"](?:token|auth|session|password)/i
    },
    configDrift: {
        pattern: /\.env\b|localhost:\d+|127\.0\.0\.1:\d+|hardcoded.*url|password\s*=\s*['"]|secret\s*=\s*['"]|api_key\s*=\s*['"]/i
    },
    securityHeaders: {
        pattern: /Content-Security-Policy|X-Frame-Options|Strict-Transport-Security|Referrer-Policy| helmet\(\)|helmet\s*\.\w+/i
    },
    dbAntiPattern: {
        pattern: /SELECT\s+.*\+\s*['"]\s*\+|query\s*\(\s*['"].*\+\s*['"]|raw\s*\(\s*['"].*\$\{|\.findAll\s*\(\s*\)(?!.*limit)|\.all\s*\(\s*\)(?!.*limit)|execute\s*\(\s*['"].*\+\s*['"]/i
    },
    frameworkPractice: {
        pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]{0,60}\}\s*\)(?!.*,\s*\[)|useState\s*\(\s*\)\s*;(?=.*useState\s*\(\s*\))|document\.getElementById\s*\(|document\.querySelector\s*\(|this\.\$refs\.|ngOnInit\s*\(\s*\)[\s\S]{0,200}(?!.*ngOnDestroy)/i
    },
    circularImport: {
        pattern: /import\s+.*\bfrom\s+['"]\.\/|require\s*\(\s*['"]\.\/|from\s+['"]\.\.\/|require\s*\(\s*['"]\.\.\//i
    },
    unusedDep: {
        pattern: /package\.json|dependencies|devDependencies/i
    },
    apiContractDrift: {
        pattern: /app\.(get|post|put|delete|patch)\s*\(\s*['"]\/|router\.(get|post|put|delete|patch)\s*\(\s*['"]\/|@app\.|@router\.|openapi|swagger/i
    },
    complexityMetric: {
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{300,}\}|def\s+\w+\s*\([^)]*\):[\s\S]{300,}(?=\ndef |\nclass |\Z)|if\s*\([^)]*\)\s*\{[\s\S]{0,80}if\s*\(|if\s*\([^)]*\):[\s\S]{0,80}if\s*\(|try\s*\{[\s\S]{0,60}try\s*\{|for\s*\([^)]*\)\s*\{[\s\S]{0,60}for\s*\(/i
    }
};

// --- Test cases: each analyzer gets positive and negative samples ---
const TEST_CASES = {
    credentials: {
        shouldMatch: [
            "const password = 'secret123'", // simplebeacon-ignore credential — test fixture dummy data
            "api_key = 'ak_live_51HxZ9l2eZvKYlo2C'", // simplebeacon-ignore credential — test fixture dummy data
            "AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE'"
        ],
        shouldNotMatch: [
            "// password field",
            "import { api_key } from './types'"
        ]
    },
    aiIndicators: {
        shouldMatch: [
            "import { OpenAI } from 'openai'",
            "const model = new ChatOpenAI({ temperature: 0.7 })",
            "import { OpenAI } from 'langchain'"
        ],
        shouldNotMatch: [
            "// open source project",
            "const openness = true"
        ]
    },
    debugArtifacts: {
        shouldMatch: [
            "console.log(user)",
            "debugger;",
            "alert('hello')"
        ],
        shouldNotMatch: [
            "// console output is redirected",
            "const console = { log: () => {} }"
        ]
    },
    aiResidueStub: {
        shouldMatch: [
            "function process() { // TODO: implement", // simplebeacon-ignore maintainability-pattern — test fixture string
            "def foo(): pass",
            "// Generated by ChatGPT"
        ],
        shouldNotMatch: [
            "// TODO: review with team", // simplebeacon-ignore maintainability-pattern — test fixture string
            "function complete() { return 42; }"
        ]
    },
    aiResidueSwallow: {
        shouldMatch: [
            "catch (e) {}",
            "except: pass",
            "rescue => e # ignore"
        ],
        shouldNotMatch: [
            "catch (e) { log.error(e); }",
            "except ValueError as e: print(e)"
        ]
    },
    aiResidueDeprecated: {
        shouldMatch: [
            "React.createClass({})",
            "componentWillMount() {}"
        ],
        shouldNotMatch: [
            "import { createElement } from 'react'",
            "const require = () => {}"
        ]
    },
    perfNestedLoop: {
        shouldMatch: [
            "for (let i=0; i<n; i++) { for (let j=0; j<m; j++) { } }",
            "element.addEventListener('click', handler)"
        ],
        shouldNotMatch: [
            "for (let i=0; i<n; i++) { single(); }",
            "element.addEventListener('click', handler); cleanup() { element.removeEventListener('click', handler); }"
        ]
    },
    typeSafetyAny: {
        shouldMatch: [
            "let x: any",
            "@ts-ignore",
            "PropTypes.string"
        ],
        shouldNotMatch: [
            "let x: string",
            "// any type of value"
        ]
    },
    missingTest: {
        shouldMatch: [
            "test.todo('needs test')",
            "it.skip('broken', () => {})",
            "func TestFoo() { }"
        ],
        shouldNotMatch: [
            "// todo: write tests", // simplebeacon-ignore maintainability-pattern — test fixture string
            "function test() { }"
        ]
    },
    a11yGap: {
        shouldMatch: [
            "<img src='logo.png'>",
            "<button class='btn'></button>"
        ],
        shouldNotMatch: [
            "<div>nothing here</div>"
        ]
    },
    i18nHardcoded: {
        shouldMatch: [
            "document.title = 'Dashboard'",
            "el.innerHTML = 'Hello World'"
        ],
        shouldNotMatch: [
            "document.title = i18n('dashboard_title')",
            "el.innerHTML = ''"
        ]
    },
    sensitiveData: {
        shouldMatch: [
            "user@example.com",
            "123-45-6789",
            "console.log(user)",
            "localStorage.setItem('token', t)"
        ],
        shouldNotMatch: [
            "// email validation",
            "const phone = ''"
        ]
    },
    configDrift: {
        shouldMatch: [
            ".env.local",
            "localhost:3000",
            "password = 'secret'",
            "api_key = 'abc'"
        ],
        shouldNotMatch: [
            "// env variable docs",
            "const localhost = false"
        ]
    },
    securityHeaders: {
        shouldMatch: [
            "Content-Security-Policy: default-src 'self'",
            "X-Frame-Options: DENY",
            " app.use( helmet() )"
        ],
        shouldNotMatch: [
            "// CSP is handled by CDN",
            "const content = 'policy'"
        ]
    },
    dbAntiPattern: {
        shouldMatch: [
            "query('SELECT * FROM users WHERE id = ' + 'x')",
            "Model.findAll()",
            "db.execute('SELECT ' + 'cols')"
        ],
        shouldNotMatch: [
            "SELECT * FROM users WHERE id = ?",
            "Model.findAll({ limit: 10 })"
        ]
    },
    frameworkPractice: {
        shouldMatch: [
            "useEffect(() => { fetch() })",
            "document.getElementById('root')",
            "ngOnInit() { } // no ngOnDestroy"
        ],
        shouldNotMatch: [
            "useEffect(() => { fetch() }, [id])",
            "useRef(null)"
        ]
    },
    circularImport: {
        shouldMatch: [
            "import { foo } from './bar'",
            "const x = require('../baz')"
        ],
        shouldNotMatch: [
            "import { foo } from 'lodash'",
            "const x = require('/absolute/path')"
        ]
    },
    apiContractDrift: {
        shouldMatch: [
            "app.get('/api/users', (req, res) => { })",
            "router.post('/login', handler)",
            "openapi: '3.0.0'"
        ],
        shouldNotMatch: [
            "// GET request",
            "const app = { get: () => {} }"
        ]
    },
    complexityMetric: {
        shouldMatch: [
            "function foo() {" + "x++;".repeat(150) + "}",
            "if (a) { if (b) { if (c) { } } }"
        ],
        shouldNotMatch: [
            "function foo() { return 1; }",
            "if (a) { return; }"
        ]
    }
};

// Add tests for analyzers without explicit cases (they should at least compile)
for (const id of Object.keys(PATTERN_REGISTRY)) {
    if (!TEST_CASES[id]) {
        TEST_CASES[id] = { shouldMatch: [], shouldNotMatch: ["// no test case"] };
    }
}

let passed = 0;
let failed = 0;

for (const [id, { pattern }] of Object.entries(PATTERN_REGISTRY)) {
    const tests = TEST_CASES[id];
    for (const str of tests.shouldMatch) {
        if (!pattern.test(str)) {
            console.log(`FAIL: ${id} should match: ${str.substring(0, 60)}`);
            failed++;
        } else {
            passed++;
        }
    }
    for (const str of tests.shouldNotMatch) {
        if (pattern.test(str)) {
            console.log(`FAIL: ${id} should NOT match: ${str.substring(0, 60)}`);
            failed++;
        } else {
            passed++;
        }
    }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('All pattern tests passed.');
