/**
 * One-command developer onboarding: Cursor rule, GitHub Action workflow.
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');
const CURSOR_RULE_TEMPLATE = path.join(PACKAGE_ROOT, 'examples', 'cursor', 'simplebeacon-scan-workflow.mdc');
const CI_WORKFLOW_TEMPLATE = path.join(PACKAGE_ROOT, 'examples', 'github-action', 'simplebeacon.yml');
const ENTERPRISE_CI_WORKFLOW_TEMPLATE = path.join(
    PACKAGE_ROOT,
    'examples',
    'github-action',
    'simplebeacon-enterprise.yml'
);

function writeIfAbsentOrForce(filePath, content, options = {}) {
    const force = Boolean(options.force);
    const dryRun = Boolean(options.dryRun);

    if (fs.existsSync(filePath) && !force) {
        return { skipped: true, path: filePath };
    }

    if (dryRun) {
        return { dryRun: true, path: filePath, wouldWrite: content };
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { created: true, path: filePath };
}

function installCursorRule(projectRoot, options = {}) {
    const target = path.join(path.resolve(projectRoot), '.cursor', 'rules', 'simplebeacon-scan-workflow.mdc');
    const content = fs.readFileSync(CURSOR_RULE_TEMPLATE, 'utf8');
    return writeIfAbsentOrForce(target, content, options);
}

function installCiWorkflow(projectRoot, options = {}) {
    const useEnterprise = options.ciProfile === 'enterprise';
    const templatePath = options.ciWorkflowTemplate
        || (useEnterprise ? ENTERPRISE_CI_WORKFLOW_TEMPLATE : CI_WORKFLOW_TEMPLATE);
    const workflowName = useEnterprise ? 'simplebeacon-enterprise.yml' : 'simplebeacon.yml';
    const target = path.join(path.resolve(projectRoot), '.github', 'workflows', workflowName);
    const content = fs.readFileSync(templatePath, 'utf8');
    return writeIfAbsentOrForce(target, content, options);
}

function installDeveloperStack(projectRoot, options = {}) {
    const results = {
        cursorRule: null,
        ciWorkflow: null
    };

    if (options.withCursorRule) {
        results.cursorRule = installCursorRule(projectRoot, options);
    }

    if (options.withCi) {
        results.ciWorkflow = installCiWorkflow(projectRoot, options);
    }

    return results;
}

module.exports = {
    installCursorRule,
    installCiWorkflow,
    installDeveloperStack,
    CURSOR_RULE_TEMPLATE,
    CI_WORKFLOW_TEMPLATE,
    ENTERPRISE_CI_WORKFLOW_TEMPLATE
};
