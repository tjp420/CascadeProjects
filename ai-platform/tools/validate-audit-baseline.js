#!/usr/bin/env node
/**
 * Compliance guard: validate audit baseline tracker artifacts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, '.simplebeacon', 'audit-baseline-tracker.json');
const MARKDOWN_PATH = path.join(ROOT, 'docs', 'reports', 'AUDIT_BASELINE_TRACKER.md');

const REQUIRED_METRICS = [
    'securityPosture',
    'testCountPassRate',
    'schemaCompliance',
    'scanQuality',
    'mockFileCount',
    'scanPathCount'
];

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function validateMetricShape(name, metric) {
    const errors = [];
    if (!metric || typeof metric !== 'object') {
        return [`metrics.${name} must be an object`];
    }
    if (!isFiniteNumber(metric.current)) {
        errors.push(`metrics.${name}.current must be a number`);
    }
    if (!isFiniteNumber(metric.target)) {
        errors.push(`metrics.${name}.target must be a number`);
    }
    if (metric.unit != null && typeof metric.unit !== 'string') {
        errors.push(`metrics.${name}.unit must be a string when present`);
    }
    return errors;
}

function validateTestMetricShape(metric) {
    const errors = [];
    if (!metric || typeof metric !== 'object') {
        return ['metrics.testCountPassRate must be an object'];
    }
    if (!isFiniteNumber(metric.currentCount) || !isFiniteNumber(metric.targetCount)) {
        errors.push('metrics.testCountPassRate current/target count must be numbers');
    }
    if (!isFiniteNumber(metric.currentPassRate) || !isFiniteNumber(metric.targetPassRate)) {
        errors.push('metrics.testCountPassRate current/target pass rate must be numbers');
    }
    return errors;
}

function main() {
    const errors = [];

    if (!fs.existsSync(JSON_PATH)) {
        errors.push(`Missing ${path.relative(ROOT, JSON_PATH).replace(/\\/g, '/')}`);
    }
    if (!fs.existsSync(MARKDOWN_PATH)) {
        errors.push(`Missing ${path.relative(ROOT, MARKDOWN_PATH).replace(/\\/g, '/')}`);
    }

    if (errors.length > 0) {
        console.error(errors.join('\n'));
        process.exit(1);
    }

    let payload;
    try {
        payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    } catch (error) {
        console.error(`Invalid JSON in ${JSON_PATH}: ${error.message}`);
        process.exit(1);
    }

    if (!payload.updatedAt) {
        errors.push('updatedAt is required');
    } else {
        const updatedAtMs = Date.parse(payload.updatedAt);
        if (!Number.isFinite(updatedAtMs)) {
            errors.push('updatedAt must be a valid ISO date');
        } else {
            const ageDays = (Date.now() - updatedAtMs) / (1000 * 60 * 60 * 24);
            if (ageDays > 10) {
                errors.push(`audit baseline stale (${ageDays.toFixed(1)} days old)`);
            }
        }
    }

    if (!payload.metrics || typeof payload.metrics !== 'object') {
        errors.push('metrics object is required');
    } else {
        for (const metric of REQUIRED_METRICS) {
            if (!(metric in payload.metrics)) {
                errors.push(`metrics.${metric} is required`);
            }
        }

        for (const metric of REQUIRED_METRICS.filter((name) => name !== 'testCountPassRate')) {
            if (payload.metrics[metric]) {
                errors.push(...validateMetricShape(metric, payload.metrics[metric]));
            }
        }
        if (payload.metrics.testCountPassRate) {
            errors.push(...validateTestMetricShape(payload.metrics.testCountPassRate));
        }
    }

    if (!Array.isArray(payload.weeklyReviewCommands) || payload.weeklyReviewCommands.length < 4) {
        errors.push('weeklyReviewCommands must list at least 4 commands');
    }

    const markdown = fs.readFileSync(MARKDOWN_PATH, 'utf8');
    if (!markdown.includes('Weekly Update Procedure')) {
        errors.push('AUDIT_BASELINE_TRACKER.md must include "Weekly Update Procedure"');
    }

    if (errors.length > 0) {
        console.error('Audit baseline validation failed:');
        for (const item of errors) {
            console.error(`- ${item}`);
        }
        process.exit(1);
    }

    console.log('Audit baseline artifacts valid');
    console.log(`Tracker: ${path.relative(ROOT, JSON_PATH).replace(/\\/g, '/')}`);
    console.log(`Summary: ${path.relative(ROOT, MARKDOWN_PATH).replace(/\\/g, '/')}`);
}

main();
