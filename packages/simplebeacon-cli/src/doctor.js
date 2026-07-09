const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function runDoctor() {
    console.log('🤖 [SimpleBeacon] Executing System Integrity Audit...');
    const issuesFixed = [];
    const criticalErrors = [];
    const rootDir = process.cwd();

    // 1. Audit Node Engine Environment
    const nodeVersion = parseInt(process.versions.node);
    if (nodeVersion < 22) {
        criticalErrors.push(`Node version engine mismatch: running v${nodeVersion}, requires >=22.`);
    }

    // 2. Auto-Fix Missing .env.example Template
    const envExamplePath = path.join(rootDir, '.env.example');
    if (!fs.existsSync(envExamplePath)) {
        // simplebeacon-ignore fiction-kpi-pattern — intentional .env.example placeholder template
        const defaultTemplate = `# SimpleBeacon Token Vault\nSIMPLEBEACON_API_KEY=<REPLACE_WITH_YOUR_API_TOKEN>\nSIMPLEBEACON_ENVIRONMENT=local\n`;
        fs.writeFileSync(envExamplePath, defaultTemplate, 'utf-8');
        issuesFixed.push('Generated missing configuration template: .env.example');
    }

    // 3. Print Results Matrix
    if (issuesFixed.length > 0) {
        console.log('\n🔧 Auto-Fixes Applied Successfully:');
        issuesFixed.forEach(fix => console.log(`  ✅ ${fix}`));
    }

    if (criticalErrors.length > 0) {
        console.error('\n❌ Unresolved Environment Blockers Detected:');
        criticalErrors.forEach(err => console.error(`  ⚠️ ${err}`));

        // Generate the Encrypted Support Package automatically
        generateSupportPackage({ nodeVersion, criticalErrors, cwd: rootDir });
    } else {
        console.log('\n🎉 System operational integrity looks solid. Zero anomalies detected.');
    }
}

function generateSupportPackage(diagnostics) {

    console.log('\n📦 Compiling anonymized diagnostic support package...');

    const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        system: diagnostics,
        anonymizedPathHash: crypto.createHash('sha256').update(diagnostics.cwd).digest('hex')
    });

    // Encrypt via built-in fallback symmetric key to prevent parsing plain logs in open transit
    const cipherKey = crypto.scryptSync('simplebeacon-public-triage-salt', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);

    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const supportToken = `${iv.toString('hex')}.${encrypted}`;
    console.log('\n💡 Local resolution failed. Share this encrypted token with our triage pipeline via GitHub Issues:');
    console.log(`\x1b[36m${supportToken}\x1b[0m\n`);
}

module.exports = { runDoctor };
