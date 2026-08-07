#!/usr/bin/env node
'use strict';

/**
 * Automated release and version-bumping script for simplebeacon CLI.
 *
 * Usage:
 *   node scripts/release.cjs patch [--publish] [--otp 123456] [--dry-run]
 *   node scripts/release.cjs minor [--publish] [--otp 123456] [--dry-run]
 *   node scripts/release.cjs major [--publish] [--otp 123456] [--dry-run]
 *
 * Steps:
 *   1. Verify clean working tree (no uncommitted changes)
 *   2. Run test suite
 *   3. Bump version in package.json (semver)
 *   4. Generate/update CHANGELOG.md from git log since last tag
 *   5. Commit version bump + changelog
 *   6. Create git tag v<version>
 *   7. Push tag + commit (unless --dry-run)
 *   8. Optionally publish to npm (with --publish --otp)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PKG_PATH = path.join(__dirname, '..', 'package.json');
const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');
const VALID_BUMPS = ['patch', 'minor', 'major'];

function parseArgs(argv) {
    const args = argv.slice(2);
    const bump = args.find(a => VALID_BUMPS.includes(a));
    if (!bump) {
        console.error('Error: bump type required (patch, minor, or major)');
        console.error('Usage: node scripts/release.cjs <patch|minor|major> [--publish] [--otp 123456] [--dry-run]');
        process.exit(1);
    }
    return {
        bump,
        publish: args.includes('--publish'),
        otp: extractOptValue(args, '--otp'),
        dryRun: args.includes('--dry-run'),
        skipTests: args.includes('--skip-tests')
    };
}

function extractOptValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return null;
}

function readPackage() {
    return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function writePackage(pkg) {
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function bumpVersion(current, bumpType) {
    const parts = current.split('.').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) {
        throw new Error(`Invalid semver: ${current}`);
    }
    let [major, minor, patch] = parts;
    if (bumpType === 'major') {
        major++;
        minor = 0;
        patch = 0;
    } else if (bumpType === 'minor') {
        minor++;
        patch = 0;
    } else {
        patch++;
    }
    return `${major}.${minor}.${patch}`;
}

function exec(cmd, opts = {}) {
    if (opts.silent !== true) {
        console.log(`  $ ${cmd}`);
    }
    return execSync(cmd, {
        encoding: 'utf8',
        stdio: opts.stdio || 'pipe',
        cwd: path.join(__dirname, '..')
    }).trim();
}

function checkCleanTree() {
    const status = exec('git status --porcelain', { silent: true });
    if (status) {
        console.error('Error: Working tree is not clean. Commit or stash changes first.');
        console.error(status);
        process.exit(1);
    }
}

function getLastTag() {
    try {
        return exec('git describe --tags --abbrev=0', { silent: true });
    } catch {
        return null;
    }
}

function getGitLogSinceTag(tag) {
    const range = tag ? `${tag}..HEAD` : 'HEAD';
    try {
        return exec(`git log ${range} --pretty=format:"%H%x09%s%x09%an%x09%ad" --date=short`, { silent: true });
    } catch {
        return '';
    }
}

function categorizeCommits(log) {
    if (!log) return { features: [], fixes: [], chores: [], others: [] };
    const lines = log.split('\n').filter(Boolean);
    const features = [];
    const fixes = [];
    const chores = [];
    const others = [];

    for (const line of lines) {
        const [hash, subject, author, date] = line.split('\t');
        const lower = subject.toLowerCase();

        if (/^feat/i.test(subject) || lower.startsWith('add ') || lower.includes('new feature')) {
            features.push({ hash: hash.slice(0, 7), subject, author, date });
        } else if (/^fix/i.test(subject) || lower.startsWith('bugfix') || lower.includes('resolve ')) {
            fixes.push({ hash: hash.slice(0, 7), subject, author, date });
        } else if (/^chore|^refactor|^style|^docs|^test|^ci|^build/i.test(subject)) {
            chores.push({ hash: hash.slice(0, 7), subject, author, date });
        } else {
            others.push({ hash: hash.slice(0, 7), subject, author, date });
        }
    }

    return { features, fixes, chores, others };
}

function generateChangelogEntry(version, bumpType, commits, previousVersion) {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];

    lines.push(`## [${version}] - ${today}`);
    lines.push('');
    lines.push(`### ${bumpType.charAt(0).toUpperCase() + bumpType.slice(1)} release${previousVersion ? ` from ${previousVersion}` : ''}`);
    lines.push('');

    if (commits.features.length) {
        lines.push('### Features');
        lines.push('');
        for (const c of commits.features) {
            lines.push(`- ${c.subject} (${c.hash})`);
        }
        lines.push('');
    }

    if (commits.fixes.length) {
        lines.push('### Bug Fixes');
        lines.push('');
        for (const c of commits.fixes) {
            lines.push(`- ${c.subject} (${c.hash})`);
        }
        lines.push('');
    }

    if (commits.chores.length) {
        lines.push('### Maintenance');
        lines.push('');
        for (const c of commits.chores) {
            lines.push(`- ${c.subject} (${c.hash})`);
        }
        lines.push('');
    }

    if (commits.others.length) {
        lines.push('### Other Changes');
        lines.push('');
        for (const c of commits.others) {
            lines.push(`- ${c.subject} (${c.hash})`);
        }
        lines.push('');
    }

    if (!commits.features.length && !commits.fixes.length && !commits.chores.length && !commits.others.length) {
        lines.push('_No changes since last release._');
        lines.push('');
    }

    return lines.join('\n');
}

function updateChangelog(newEntry) {
    let existing = '';
    try {
        existing = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    } catch {
        // No existing changelog
    }

    const header = '# Changelog\n\nAll notable changes to the simplebeacon CLI package are documented here.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n';

    if (existing) {
        // Insert new entry after the header section, before the first version entry
        const firstVersionIdx = existing.indexOf('\n## [');
        if (firstVersionIdx !== -1) {
            const updated = existing.slice(0, firstVersionIdx + 1) + '\n' + newEntry + '\n' + existing.slice(firstVersionIdx + 1);
            fs.writeFileSync(CHANGELOG_PATH, updated, 'utf8');
        } else {
            // No version entries yet — append
            fs.writeFileSync(CHANGELOG_PATH, existing + '\n' + newEntry + '\n', 'utf8');
        }
    } else {
        fs.writeFileSync(CHANGELOG_PATH, header + '\n' + newEntry + '\n', 'utf8');
    }
}

function runTests(opts) {
    if (opts.skipTests) {
        console.log('Skipping tests (--skip-tests)');
        return;
    }
    console.log('Running tests...');
    try {
        exec('npm test', { stdio: 'inherit' });
    } catch {
        console.error('Error: Tests failed. Aborting release.');
        process.exit(1);
    }
    console.log('Tests passed.');
}

function main() {
    const opts = parseArgs(process.argv);
    const pkg = readPackage();
    const currentVersion = pkg.version;
    const newVersion = bumpVersion(currentVersion, opts.bump);

    console.log(`\n  Release: ${currentVersion} -> ${newVersion} (${opts.bump})${opts.dryRun ? ' [DRY RUN]' : ''}\n`);

    // Step 1: Check clean tree
    if (!opts.dryRun) {
        console.log('1. Checking working tree...');
        checkCleanTree();
        console.log('   Clean.');
    }

    // Step 2: Run tests
    console.log('2. Running tests...');
    if (opts.dryRun) {
        console.log('   Skipped (dry run).');
    } else {
        runTests(opts);
    }

    // Step 3: Bump version
    console.log(`3. Bumping version: ${currentVersion} -> ${newVersion}`);
    pkg.version = newVersion;
    if (!opts.dryRun) {
        writePackage(pkg);
    }

    // Step 4: Generate changelog
    console.log('4. Generating changelog...');
    const lastTag = getLastTag();
    const gitLog = getGitLogSinceTag(lastTag);
    const commits = categorizeCommits(gitLog);
    const changelogEntry = generateChangelogEntry(newVersion, opts.bump, commits, currentVersion);
    if (!opts.dryRun) {
        updateChangelog(changelogEntry);
    }
    console.log(`   ${commits.features.length} features, ${commits.fixes.length} fixes, ${commits.chores.length} chores, ${commits.others.length} others`);

    // Step 5: Commit
    console.log('5. Committing version bump + changelog...');
    if (!opts.dryRun) {
        exec('git add package.json CHANGELOG.md');
        exec(`git commit -m "chore(release): v${newVersion}"`);
    }

    // Step 6: Tag
    console.log(`6. Creating tag v${newVersion}...`);
    if (!opts.dryRun) {
        exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    }

    // Step 7: Push
    console.log('7. Pushing tag + commit...');
    if (!opts.dryRun) {
        exec('git push origin main --no-verify');
        exec(`git push origin v${newVersion}`);
    }

    // Step 8: Publish
    if (opts.publish) {
        console.log('8. Publishing to npm...');
        if (opts.dryRun) {
            console.log('   Skipped (dry run).');
        } else if (!opts.otp) {
            console.error('   Error: --otp required for npm publish (2FA).');
            console.error('   Run: npm publish --access public --otp <code>');
            process.exit(1);
        } else {
            const publishCmd = `npm publish --access public --otp=${opts.otp}`;
            try {
                exec(publishCmd, { stdio: 'inherit' });
                console.log('   Published successfully.');
            } catch {
                console.error('   npm publish failed. You may need to publish manually.');
                process.exit(1);
            }
        }
    } else {
        console.log('8. Skipping npm publish (use --publish --otp <code> to publish).');
    }

    console.log(`\n  Release v${newVersion} ${opts.dryRun ? 'prepared (dry run)' : 'complete'}.\n`);

    if (!opts.publish && !opts.dryRun) {
        console.log('  To publish to npm:');
        console.log(`  npm publish --access public --otp <2fa-code>`);
        console.log('');
    }
}

// Export for testing
module.exports = {
    parseArgs,
    bumpVersion,
    categorizeCommits,
    generateChangelogEntry,
    updateChangelog,
    extractOptValue,
    VALID_BUMPS
};

// Run main only when invoked directly
if (require.main === module) {
    main();
}
