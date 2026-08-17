/**
 * AiAgentController — programmatic facade for AI agents (matches docs/API-REFERENCE.md).
 */

const path = require('path');
const { runScan } = require('../scan');
const { loadSimplebeaconConfig } = require('../config');
const { readGateStatus, scanSnippetContent } = require('./snippet-scanner');
const { resolveAgentTier, getAgentCapabilities } = require('./agent-tier-capabilities');
const { formatAgentBrief, writeAgentBrief } = require('./agent-brief');
const { readAgentSession, buildNextAction } = require('./agent-session');
const { attachGateMetadata, ENGINE_VERSION } = require('./gate-parity');

class AiAgentController {
    /**
     * @param {string} projectRoot
     * @param {{ offline?: boolean, licenseToken?: string }} [options]
     */
    constructor(projectRoot, options = {}) {
        this.projectRoot = path.resolve(projectRoot);
        this.options = options;
        if (options.licenseToken) {
            process.env.SIMPLEBEACON_LICENSE_TOKEN = options.licenseToken;
        }
        this._tierCtx = resolveAgentTier();
    }

    _refreshTier() {
        this._tierCtx = resolveAgentTier();
        return this._tierCtx;
    }

    async scan(scanOptions = {}) {
        const config = loadSimplebeaconConfig(this.projectRoot);
        if (scanOptions.gate) {
            config.gate = config.gate || {};
            config.gate.enabled = true;
        }
        if (scanOptions.fullDirectoryScan) {
            config.fullDirectoryScan = true;
        }
        const report = await runScan(this.projectRoot, {
            config,
            offline: this.options.offline !== false,
            gate: scanOptions.gate
        });
        this._lastReport = report;
        return report;
    }

    getGateStatus() {
        const status = readGateStatus(this.projectRoot);
        return {
            pass: status.gatePass === true,
            blockingCount: status.blockingCount ?? 0,
            warningCount: status.warningCount ?? 0,
            engineVersion: ENGINE_VERSION
        };
    }

    getSummary() {
        const report = this._lastReport;
        const gate = this.getGateStatus();
        const tier = this._refreshTier();
        return {
            gatePass: gate.pass,
            blockingCount: gate.blockingCount,
            qualityScore: report?.qualityScore ?? null,
            topIssues: (report?.detectedIssues || []).slice(0, 5),
            tier: tier.tier,
            paid: tier.paid,
            agentExperience: getAgentCapabilities(tier).agentExperience,
            engineVersion: ENGINE_VERSION
        };
    }

    suggestFixes(maxFixes = 5) {
        const report = this._lastReport;
        if (!report) {
            return { total: 0, all: [], error: 'Run scan() first' };
        }
        const tier = this._refreshTier();
        const cap = tier.paid ? maxFixes : 1;
        const { buildCodeSuggestions } = require('./code-suggestions');
        const codePayload = report.codeSuggestions || buildCodeSuggestions(report, { maxSuggestions: cap });
        const issues = (report.detectedIssues || []).filter(
            (i) => i.severity === 'critical' || i.severity === 'high'
        );
        const fromCode = (codePayload.suggestions || []).slice(0, cap);
        if (fromCode.length) {
            const all = fromCode.map((item, idx) => ({
                priority: idx + 1,
                severity: item.severity,
                type: item.category || item.patternId,
                filePath: item.filePath,
                line: item.line,
                recommendedAction: item.suggestion,
                codeHint: item.codeHint,
                autoFixable: item.autoFixable
            }));
            return { total: codePayload.totalCandidates || issues.length, all, quickWins: codePayload.quickWins };
        }
        const all = issues.slice(0, cap).map((issue, idx) => ({
            priority: idx + 1,
            severity: issue.severity,
            type: issue.type || issue.rule,
            filePath: issue.filePath || issue.path,
            recommendedAction: issue.fix || issue.recommendedAction || 'Manual review'
        }));
        return { total: issues.length, all };
    }

    checkHandoffReadiness() {
        const gate = this.getGateStatus();
        const session = readAgentSession(this.projectRoot);
        const open = session.openFindings || [];
        const ready = gate.pass && open.length === 0;
        return {
            ready,
            gatePass: gate.pass,
            openFindings: open.length,
            nextAction: buildNextAction(session, { gatePass: gate.pass }),
            engineVersion: ENGINE_VERSION
        };
    }

    generateMarketing(channel = 'blog') {
        if (!this._lastReport) {
            throw new Error('Run scan() first');
        }
        const { generateMarketingContent } = require('./marketing/marketing-content-generator');
        return generateMarketingContent(this._lastReport, { channel });
    }

    exportReport(outPath) {
        const fs = require('fs');
        if (!this._lastReport) {
            throw new Error('Run scan() first');
        }
        const target = path.isAbsolute(outPath)
            ? outPath
            : path.join(this.projectRoot, outPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(this._lastReport, null, 2), 'utf8');
        return target;
    }

    scanSnippet(content, filePath = 'snippet.txt') {
        const result = scanSnippetContent(content, {
            filePath,
            projectRoot: this.projectRoot
        });
        const tier = this._refreshTier();
        if (!tier.paid) {
            const { applyFreeSnippetLimits } = require('./agent-tier-capabilities');
            return applyFreeSnippetLimits(result);
        }
        return attachGateMetadata(result, { blockingCount: result.blockingCount });
    }

    writeAgentBrief() {
        const tier = this._refreshTier();
        return writeAgentBrief(this.projectRoot, this._lastReport || {}, { paid: tier.paid });
    }

    /** One-call supercharge briefing for any coding agent plugin */
    getSupercharge(options = {}) {
        const { buildAgentSupercharge, writeAgentSupercharge } = require('./agent-supercharge');
        const tier = this._refreshTier();
        if (options.writeDisk) {
            return writeAgentSupercharge(this.projectRoot, {
                ...options,
                report: this._lastReport,
                paid: tier.paid,
                tierCtx: tier
            });
        }
        return buildAgentSupercharge(this.projectRoot, {
            ...options,
            report: this._lastReport,
            paid: tier.paid,
            tierCtx: tier
        });
    }

    /** Wire SimpleBeacon into Cursor, Windsurf, Continue, Cline, Copilot, Aider, etc. */
    installAgentPlugin(options = {}) {
        const { installAgentHosts } = require('./agent-host-adapters');
        return installAgentHosts(this.projectRoot, {
            hosts: options.hosts || 'all',
            supercharge: options.supercharge !== false,
            force: options.force,
            paidTier: this._refreshTier().paid
        });
    }

    getAgentCapabilities() {
        return getAgentCapabilities(this._refreshTier());
    }
}

module.exports = { AiAgentController };
