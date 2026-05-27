const path = require('path');
const {
    resolveTrustHistoryPath,
    readTrustHistory,
    buildTrustTrend
} = require('../server/lib/trust-history-store');

function hasFlag(flag) {
    return process.argv.includes(flag);
}

function parseOption(prefix, fallback) {
    const arg = process.argv.find((item) => item.startsWith(`${prefix}=`));
    if (!arg) return fallback;
    const value = Number.parseInt(arg.split('=').slice(1).join('='), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function run() {
    const platformRoot = path.resolve(process.cwd());
    const historyPath = resolveTrustHistoryPath(platformRoot);
    const history = readTrustHistory(historyPath);
    const limit = parseOption('--limit', 30);
    const entries = history.entries.slice(0, limit);
    const trend = buildTrustTrend(entries, parseOption('--window', Math.min(limit, 30)));

    if (hasFlag('--json')) {
        console.log(JSON.stringify({
            success: true,
            historyPath,
            count: history.entries.length,
            trend,
            entries
        }, null, 2));
        return;
    }

    if (hasFlag('--trend')) {
        console.log(`Trust trend window: ${trend.window}`);
        console.log(`Snapshots: ${trend.snapshots}`);
        console.log(`Pass rate: ${trend.passRatePercent ?? 'n/a'}%`);
        console.log(`Avg quality: ${trend.avgQualityScore ?? 'n/a'}`);
        console.log(`Avg issues: ${trend.avgIssues ?? 'n/a'}`);
        console.log(`Issue delta: ${trend.issueDelta ?? 'n/a'}`);
        console.log(`Quality delta: ${trend.qualityDelta ?? 'n/a'}`);
        if (trend.latest) {
            console.log(`Latest: ${trend.latest.verificationId || 'n/a'} @ ${trend.latest.generatedAt || 'n/a'}`);
        }
        return;
    }

    console.log(`Trust history: ${historyPath}`);
    console.log(`Entries: ${history.entries.length}`);
    if (!entries.length) {
        console.log('No snapshots recorded yet. Run npm run trust:publish.');
        return;
    }
    console.log(`Showing latest ${entries.length}:`);
    for (const entry of entries.slice(0, 10)) {
        console.log(
            `- ${entry.generatedAt || entry.recordedAt || 'n/a'} | gate=${entry.gatePass} | quality=${entry.qualityScore} | issues=${entry.issues} | id=${entry.verificationId || 'n/a'}`
        );
    }
}

run();
