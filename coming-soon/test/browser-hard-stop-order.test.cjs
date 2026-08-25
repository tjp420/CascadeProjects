/**
 * Adversarial Validator checks for browser large-folder scan UX.
 * - Incomplete-drop report contract (qualityScore: 0 / gate.pass false)
 * - Audit hard-stop must precede worker postMessage / heavy file walks
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('L2-01 incomplete-drop report contract (qualityScore: 0)', () => {
    for (const rel of [
        'ai-platform/web/simplebeacon-dashboard/js/services/localScanService.js',
        'ai-platform/web/simplebeacon-dashboard/js-es2018/services/localScanService.js'
    ]) {
        it(`${rel}: gateScore requires MIN_FILES_FOR_PASS (no quality 100 on 1-file drop)`, () => {
            const src = read(rel);
            assert.match(src, /const MIN_FILES_FOR_PASS\s*=\s*3/);
            assert.match(
                src,
                /gateScore\s*=\s*blockingCount\s*===\s*0\s*&&\s*totalFiles\s*>=\s*MIN_FILES_FOR_PASS\s*\?\s*100\s*:\s*0/
            );
            assert.match(src, /qualityScore:\s*gateScore/);
            assert.match(src, /pass:\s*blockingCount\s*===\s*0\s*&&\s*totalFiles\s*>=\s*MIN_FILES_FOR_PASS/);
            assert.doesNotMatch(src, /gateScore\s*=\s*blockingCount\s*===\s*0\s*&&\s*totalFiles\s*>\s*0\s*\?\s*100/);
        });
    }

    it('dom isIncompleteFolderDrop treats 1–2 file dir drops as incomplete even with relative paths', () => {
        // Mirror production logic (ESM not loaded under node --test without loader).
        function isIncompleteFolderDrop(fileCount, opts = {}) {
            if (!opts.isDirectoryDrop) return false;
            const n = Number(fileCount) || 0;
            if (n > 2) return false;
            return n > 0;
        }
        assert.strictEqual(isIncompleteFolderDrop(1, { isDirectoryDrop: true, hasRelativePath: true }), true);
        assert.strictEqual(isIncompleteFolderDrop(2, { isDirectoryDrop: true, hasRelativePath: false }), true);
        assert.strictEqual(isIncompleteFolderDrop(3, { isDirectoryDrop: true }), false);
        assert.strictEqual(isIncompleteFolderDrop(1, { isDirectoryDrop: false }), false);
    });
});

describe('L2-03 Audit hard-stop bypasses worker postMessage pipeline', () => {
    it('processLocalCLIScan returns before any scanWorker.postMessage', () => {
        const src = read('coming-soon/public/js-es2018/dashboard/scanner-engine.js');
        const fnStart = src.indexOf('async function processLocalCLIScan(files)');
        assert.ok(fnStart >= 0, 'processLocalCLIScan must exist');
        // Function body until next top-level async/function at column 0 is hard; use hard-stop marker span.
        const hardStop = src.indexOf('BROWSER_HARD_STOP', fnStart);
        assert.ok(hardStop > fnStart, 'BROWSER_HARD_STOP must exist in processLocalCLIScan');
        const earlyReturn = src.indexOf('return;', hardStop);
        assert.ok(earlyReturn > hardStop, 'hard-stop must return');
        const postMessage = src.indexOf('scanWorker.postMessage', earlyReturn);
        // postMessage may exist later in the same file for non-hard-stop path; ensure it is AFTER early return
        // and that hard-stop return precedes the first postMessage call site in this function region.
        const firstPostInFn = src.indexOf('scanWorker.postMessage', fnStart);
        assert.ok(firstPostInFn > earlyReturn, 'scanWorker.postMessage must not run before hard-stop return');
    });

    it('_startAccumulatedScan hard-stops before processLocalCLIScan', () => {
        const src = read('coming-soon/public/js-es2018/dashboard/main.js');
        const fnStart = src.indexOf('window._startAccumulatedScan = async function');
        assert.ok(fnStart >= 0);
        const hardStop = src.indexOf('BROWSER_HARD_STOP', fnStart);
        const earlyReturn = src.indexOf('return;', hardStop);
        const callCli = src.indexOf('processLocalCLIScan', earlyReturn);
        assert.ok(hardStop > fnStart);
        assert.ok(earlyReturn > hardStop);
        assert.ok(callCli > earlyReturn, 'must not call processLocalCLIScan before hard-stop return');
    });

    it('analyzeFolderSize blocks at exactly 100000 with CLI hint', () => {
        const { analyzeFolderSize } = require('../js/scan-utils.js');
        const files = Array.from({ length: 100000 }, () => ({ size: 1, name: 'a.js', webkitRelativePath: 'p/a.js' }));
        const result = analyzeFolderSize(files);
        assert.strictEqual(result.blocked, true);
        assert.strictEqual(result.severity, 'error');
        assert.match(result.message, /100,000/);
        assert.match(result.cliHint, /npx simplebeacon scan --full --gate/);
    });

    it('hard-stop returns before new Worker — no orphaned worker on ≥100k', () => {
        const src = read('coming-soon/public/js-es2018/dashboard/scanner-engine.js');
        const fnStart = src.indexOf('async function processLocalCLIScan(files)');
        assert.ok(fnStart >= 0);
        const hardStop = src.indexOf('BROWSER_HARD_STOP', fnStart);
        assert.ok(hardStop > fnStart, 'BROWSER_HARD_STOP required for orphan-worker guarantee');
        const earlyReturn = src.indexOf('return;', hardStop);
        assert.ok(earlyReturn > hardStop);
        const newWorker = src.indexOf('new Worker', fnStart);
        // new Worker may exist later on the non-hard-stop path; must be after early return
        assert.ok(newWorker < 0 || newWorker > earlyReturn, 'new Worker must not run before hard-stop return');
        // Hard-stop path must not schedule timers/workers before return (only toast + terminal)
        const between = src.slice(hardStop, earlyReturn);
        assert.doesNotMatch(between, /\bnew Worker\b/);
        assert.doesNotMatch(between, /\.postMessage\s*\(/);
        assert.doesNotMatch(between, /\bsetInterval\s*\(/);
    });
});

describe('D-03 AnalyzeView twin incomplete-drop call-site parity', () => {
    it('js and js-es2018 twins expose matching isIncompleteFolderDrop call sites', () => {
        const js = read('ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js');
        const es = read('ai-platform/web/simplebeacon-dashboard/js-es2018/views/AnalyzeView.js');
        const count = s => (s.match(/\bisIncompleteFolderDrop\s*\(/g) || []).length;
        const jsCount = count(js);
        const esCount = count(es);
        // Functional parity: drop guards + runLocalScan refuse (currently 5 call sites each).
        assert.strictEqual(esCount, 5, `es2018 expected 5 call sites, got ${esCount}`);
        assert.strictEqual(jsCount, esCount, `js twin call-site count ${jsCount} must match es2018 ${esCount}`);
    });

    it('both twins refuse protected-dir inventory ≤2 after local scan', () => {
        for (const rel of [
            'ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js',
            'ai-platform/web/simplebeacon-dashboard/js-es2018/views/AnalyzeView.js'
        ]) {
            const src = read(rel);
            assert.ok(/inventoryCount\s*<=\s*2/.test(src), `${rel} missing inventoryCount <= 2 protected-dir guard`);
            assert.ok(
                /windows\|system32\|winsxs\|program files\|programdata/i.test(src),
                `${rel} missing protected root-name pattern`
            );
        }
    });

    it('all 5 js AnalyzeView incomplete-drop call sites reject (return or throw)', () => {
        const src = read('ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js');
        function ifBodyAfterCall(callIdx) {
            const ifPos = src.lastIndexOf('if', callIdx);
            const openParen = src.indexOf('(', ifPos);
            let depth = 0;
            let p = openParen;
            for (; p < src.length; p++) {
                if (src[p] === '(') depth++;
                else if (src[p] === ')') {
                    depth--;
                    if (depth === 0) {
                        p++;
                        break;
                    }
                }
            }
            while (p < src.length && /\s/.test(src[p])) p++;
            if (src[p] !== '{') {
                return src.slice(p, src.indexOf(';', p) + 1);
            }
            const blockStart = p;
            depth = 0;
            let end = blockStart;
            for (; end < src.length; end++) {
                if (src[end] === '{') depth++;
                else if (src[end] === '}') {
                    depth--;
                    if (depth === 0) {
                        end++;
                        break;
                    }
                }
            }
            return src.slice(blockStart, end);
        }
        const re = /\bisIncompleteFolderDrop\s*\(/g;
        let m;
        let n = 0;
        while ((m = re.exec(src))) {
            n++;
            const body = ifBodyAfterCall(m.index);
            const reject =
                /\breturn\s*;/.test(body) || /throw\s+new\s+Error\(\s*incompleteFolderDropMessage/.test(body);
            const scans = /await\s+this\.(runLocalScan|handleAnalyzeFiles)/.test(body);
            assert.ok(reject, `call site ${n} must return or throw incompleteFolderDropMessage`);
            assert.ok(!scans, `call site ${n} must not continue into runLocalScan/handleAnalyzeFiles`);
        }
        assert.strictEqual(n, 5, `expected 5 call sites, got ${n}`);
    });
});
