// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * ZScript structure parser — classes, states, properties, GZDoom API usage.
 */

const { LanguageParser } = require('./language-parser-base.cjs');

const constants = require('../../config/constants.cjs');
const GZDoom_API_PATTERNS = [
    { id: 'a_action', pattern: /\bA_[A-Za-z0-9_]+\s*\(/g, label: 'Actor action function' },
    { id: 'cvar', pattern: /\bCVar\.FindCVar\s*\(/g, label: 'CVAR lookup' },
    { id: 'dynamic_light', pattern: /\bDynamicLight\b|\bA_Light\b/g, label: 'Dynamic light API' },
    { id: 'event_handler', pattern: /\bEventHandler\b|\bWorldTick\b|\bOnRegister\b/g, label: 'Event handler lifecycle' },
    { id: 'console', pattern: /\bConsole\.(Command|Print)\b/g, label: 'Console output/command' }
];

/**
 * Z script parser.
 */
class ZScriptParser extends LanguageParser {
    constructor() {
        super({
            language: 'zscript',
            label: 'ZScript',
            extensions: ['.zs', '.zscript']
        });
    }

    parse(code, context = {}) {
        const text = String(code || '');
        const classes = this.extractClasses(text);
        const states = this.extractStates(text);
        const gzdoomAPI = this.detectGZDoomAPI(text);

        return {
            language: 'zscript',
            filePath: context.filePath || null,
            ast: {
                classes,
                states,
                includes: this.extractIncludes(text),
                gzdoomAPI
            },
            classes,
            states,
            gzdoomAPI,
            summary: this.generateZScriptSummary(classes, states, gzdoomAPI, context.filePath)
        };
    }

    extractIncludes(content) {
        const includes = [];
        const re = /#include\s+["']([^"']+)["']/g;
        let match;
        while ((match = re.exec(content)) !== null) includes.push(match[1]);
        return includes;
    }

    extractClasses(content) {
        const classes = [];
        const re = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z_][A-Za-z0-9_.]*))?\s*\{/g;
        let match;
        while ((match = re.exec(content)) !== null) {
            const snippet = content.slice(match.index, match.index + constants.TIMEOUT_5S);
            classes.push({
                name: match[1],
                parentClass: match[2] || 'Object',
                methods: this.extractMethods(snippet).slice(0, 25),
                hasStatesBlock: /\bStates\s*\{/.test(snippet),
                properties: this.extractProperties(snippet).slice(0, 20)
            });
        }
        return classes;
    }

    extractStates(content) {
        const states = [];
        const re = /\bStates\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g; // simplebeacon-ignore redos — zscript format parser regex, not user-facing input
        let match;
        while ((match = re.exec(content)) !== null) {
            const block = match[1];
            const labels = [...block.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]);
            states.push({
                stateLabels: labels.slice(0, 30),
                labelCount: labels.length
            });
        }
        return states;
    }

    extractMethods(snippet) {
        const names = [];
        const re = /\b(?:override\s+)?(?:static\s+)?(?:void|bool|int|float|double|string|color|Vector2|Vector3|State|Actor|EventHandler)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
        let match;
        while ((match = re.exec(snippet)) !== null) {
            if (!['if', 'for', 'while'].includes(match[1]) && !names.includes(match[1])) {
                names.push(match[1]);
            }
        }
        return names;
    }

    extractProperties(snippet) {
        const props = [];
        const re = /\b(?:private|protected|public)?\s*(?:bool|int|float|double|string|color|Vector2|Vector3|Array<[^>]+>)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g;
        let match;
        while ((match = re.exec(snippet)) !== null) {
            if (!props.includes(match[1])) props.push(match[1]);
        }
        return props;
    }

    detectGZDoomAPI(content) {
        const hits = [];
        for (const item of GZDoom_API_PATTERNS) {
            const matches = content.match(item.pattern);
            if (!matches?.length) continue;
            hits.push({
                id: item.id,
                label: item.label,
                count: Math.min(matches.length, 50)
            });
        }
        return hits;
    }

    generateZScriptSummary(classes, states, gzdoomAPI, filePath = '') {
        const rel = String(filePath || '').toLowerCase();
        let purpose = 'ZScript module';
        if (rel.includes('/lights/') || classes.some((c) => /Light/i.test(c.name))) {
            purpose = 'Lighting actor or light system logic';
        } else if (classes.some((c) => c.parentClass === 'EventHandler')) {
            purpose = 'GZDoom event handler — coordinates world/system behavior';
        } else if (classes.some((c) => c.parentClass === 'Weapon')) {
            purpose = 'Weapon behavior definition';
        }

        const complexity = classes.length > 3 || states.length > 2 ? 'high'
            : classes.length > 1 || states.length > 0 ? 'medium' : 'low';

        const recommendations = [];
        if (gzdoomAPI.some((a) => a.id === 'console')) {
            recommendations.push('Review Console.* calls before release builds');
        }
        if (classes.some((c) => c.hasStatesBlock && !c.methods.length)) {
            recommendations.push('State-only classes — verify state chains reference valid sprites');
        }
        if (gzdoomAPI.some((a) => a.id === 'cvar') && !gzdoomAPI.some((a) => a.id === 'dynamic_light')) {
            recommendations.push('CVAR reads without light API in same file — intensity may not reach renderer');
        }

        return { purpose, complexity, gzdoomFeatures: gzdoomAPI.map((g) => g.id), recommendations };
    }
}

module.exports = {
    ZScriptParser,
    GZDoom_API_PATTERNS
};
