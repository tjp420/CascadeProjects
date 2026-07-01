const fs = require('fs');
const path = require('path');
const { sanitizePath } = require('./path-sanitizer');
const { getInitTemplates } = require('../config');
const { withTransactionSync } = require('./transaction-manager');
const { writeManagedFileSync } = require('./safe-write');
const { validateJSON, validateNotEmpty } = require('./file-validator');

function buildInitDryRunPlan(root, templates, options = {}) {
    const simplebeaconDir = path.join(root, '.simplebeacon');
    const configPath = path.join(simplebeaconDir, 'config.json');
    const baselinePath = path.join(simplebeaconDir, 'baseline.json');
    const force = Boolean(options.force);

    const plannedActions = [
        { action: 'mkdir', path: simplebeaconDir }
    ];

    const configExists = fs.existsSync(configPath);
    const baselineExists = fs.existsSync(baselinePath);

    plannedActions.push({
        action: configExists ? (force ? 'overwrite' : 'skip') : 'create',
        path: configPath
    });
    plannedActions.push({
        action: baselineExists ? (force ? 'overwrite' : 'skip') : 'create',
        path: baselinePath
    });

    return {
        dryRun: true,
        configPath,
        baselinePath,
        simplebeaconDir,
        profile: templates.profile,
        detected: templates.detected,
        plannedActions,
        configCreated: !configExists || force,
        configSkipped: configExists && !force,
        baselineCreated: !baselineExists || force,
        baselineSkipped: baselineExists && !force
    };
}

function initSimplebeacon(baseDir, options = {}) {
    const root = path.resolve(sanitizePath(baseDir));
    const templates = getInitTemplates(root, options);
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);

    if (dryRun) {
        return buildInitDryRunPlan(root, templates, options);
    }

    return withTransactionSync((transaction) => {
        const simplebeaconDir = path.join(root, '.simplebeacon');
        fs.mkdirSync(simplebeaconDir, { recursive: true });

        const configPath = path.join(simplebeaconDir, 'config.json');
        const baselinePath = path.join(simplebeaconDir, 'baseline.json');
        const configContent = `${JSON.stringify(templates.config, null, 2)}\n`;
        const baselineContent = `${JSON.stringify(templates.baseline, null, 2)}\n`;

        const configWrite = writeManagedFileSync(configPath, configContent, {
            skipIfExists: !force,
            force,
            transaction,
            validators: [validateJSON, validateNotEmpty]
        });

        const baselineWrite = writeManagedFileSync(baselinePath, baselineContent, {
            skipIfExists: !force,
            force,
            transaction,
            validators: [validateJSON, validateNotEmpty]
        });

        return {
            configPath,
            baselinePath,
            simplebeaconDir,
            profile: templates.profile,
            detected: templates.detected,
            configCreated: !configWrite.skipped,
            configSkipped: Boolean(configWrite.skipped),
            baselineCreated: !baselineWrite.skipped,
            baselineSkipped: Boolean(baselineWrite.skipped),
            backups: [configWrite.backupPath, baselineWrite.backupPath].filter(Boolean)
        };
    });
}

module.exports = { buildInitDryRunPlan, initSimplebeacon };
