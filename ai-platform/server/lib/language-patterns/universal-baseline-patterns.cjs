/**
 * Tier-1 baseline patterns shared across registry languages (by family + universal).
 */

const UNIVERSAL_TECH_DEBT = [
    { id: 'todo-marker', pattern: /\bTODO\b/i, label: 'TODO marker' },
    { id: 'fixme-marker', pattern: /\bFIXME\b/i, label: 'FIXME marker' },
    { id: 'hack-marker', pattern: /\bHACK\b/i, label: 'HACK marker' },
    { id: 'xxx-marker', pattern: /\bXXX\b/i, label: 'XXX marker' },
    { id: 'stub-marker', pattern: /\b(?:stub|not\s+implemented|unimplemented)\b/i, label: 'Stub / not implemented marker' }
];

const UNIVERSAL_PLACEHOLDERS = [
    { id: 'lorem-ipsum', pattern: /\blorem\s+ipsum\b/i, label: 'Lorem ipsum placeholder text' },
    { id: 'placeholder-token', pattern: /\b(?:placeholder|changeme|replace-?me|your-?api-?key)\b/i, label: 'Placeholder token' },
    { id: 'example-domain', pattern: /\bexample\.(?:com|org|net)\b/i, label: 'example.* domain placeholder' }
];

const FAMILY_DEBUG_PATTERNS = {
    web: [
        { id: 'console-log', pattern: /\bconsole\.(?:log|debug|info|trace)\s*\(/g, label: 'Console logging call' },
        { id: 'debugger-statement', pattern: /\bdebugger\s*;/g, label: 'Debugger statement' }
    ],
    systems: [
        { id: 'c-printf', pattern: /\bprintf\s*\(/g, label: 'C printf debug output' },
        { id: 'rust-dbg', pattern: /\bdb!?\s*\(/g, label: 'Rust dbg!/debug macro' },
        { id: 'rust-println', pattern: /\b(?:println!|eprintln!)\s*\(/g, label: 'Rust println/eprintln' },
        { id: 'go-fmt-print', pattern: /\bfmt\.Print(?:ln|f)?\s*\(/g, label: 'Go fmt.Print* debug output' }
    ],
    game: [
        { id: 'lua-print', pattern: /\bprint\s*\(/gi, label: 'Print statement' },
        { id: 'glsl-debug-color', pattern: /\bfragColor\s*=\s*vec4\s*\(\s*1\.0\s*,\s*0\.0/gi, label: 'GLSL debug color output' }
    ],
    mobile: [
        { id: 'android-log', pattern: /\bLog\.[deiwv]\s*\(/g, label: 'Android Log.* call' },
        { id: 'swift-print', pattern: /\bprint\s*\(/g, label: 'Swift print call' },
        { id: 'kotlin-println', pattern: /\bprintln\s*\(/g, label: 'Kotlin println call' }
    ],
    data: [
        { id: 'python-print', pattern: /\bprint\s*\(/g, label: 'Python print call' },
        { id: 'python-pdb', pattern: /\bpdb\.set_trace\s*\(/g, label: 'Python pdb breakpoint' },
        { id: 'r-print', pattern: /\bprint\s*\(/g, label: 'R print call' }
    ],
    devops: [
        { id: 'shell-echo-debug', pattern: /\becho\s+["']?(?:DEBUG|TRACE|TODO)/gi, label: 'Shell debug echo' }
    ],
    scripting: [
        { id: 'script-print', pattern: /\b(?:print|Write-Host|echo)\s*\(?/gi, label: 'Script debug output' },
        { id: 'ruby-puts', pattern: /\b(?:puts|p)\s+/g, label: 'Ruby puts/p debug output' },
        { id: 'php-var-dump', pattern: /\b(?:var_dump|print_r|dd)\s*\(/gi, label: 'PHP dump helper' }
    ],
    domain: [
        { id: 'domain-print', pattern: /\b(?:print|printf|display)\s*\(/gi, label: 'Debug print call' }
    ]
};

const FAMILY_BEST_PRACTICES = {
    systems: [
        { id: 'rust-unwrap', pattern: /\.unwrap\s*\(\s*\)/g, label: 'Rust unwrap() — prefer explicit error handling' },
        { id: 'c-unsafe', pattern: /\bunsafe\s*\{/g, label: 'C/C++ unsafe block' }
    ],
    data: [
        { id: 'python-bare-except', pattern: /except\s*:/g, label: 'Python bare except clause' }
    ],
    devops: [
        { id: 'terraform-count', pattern: /\bcount\s*=\s*0\b/g, label: 'Terraform count=0 (disabled resource pattern)' }
    ]
};

const UNIVERSAL_DEBUG = [
    { id: 'debug-comment', pattern: /\/\/\s*DEBUG\b|#\s*DEBUG\b|\/\*\s*DEBUG\b/i, label: 'DEBUG comment marker' }
];

function getBaselinePatternsForFamily(family) {
    const key = String(family || 'domain').toLowerCase();
    return {
        techDebt: [...UNIVERSAL_TECH_DEBT],
        debug: [
            ...UNIVERSAL_DEBUG,
            ...(FAMILY_DEBUG_PATTERNS[key] || FAMILY_DEBUG_PATTERNS.domain)
        ],
        placeholders: [...UNIVERSAL_PLACEHOLDERS],
        bestPractices: [...(FAMILY_BEST_PRACTICES[key] || [])]
    };
}

module.exports = {
    UNIVERSAL_TECH_DEBT,
    UNIVERSAL_PLACEHOLDERS,
    UNIVERSAL_DEBUG,
    FAMILY_DEBUG_PATTERNS,
    getBaselinePatternsForFamily
};
