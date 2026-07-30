const fs = require('fs');
const { verifyPolicySignature } = require('./signature-verifier');

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeParsePolicy(rawJson) {
    const parsed = JSON.parse(rawJson);
    if (isPlainObject(parsed)) {
        delete parsed.integrity_signatures;
    }
    return parsed;
}

function mergeRuleDefinitions(baseRules, overrideRules) {
    const merged = Array.isArray(baseRules) ? baseRules.map((rule) => ({ ...rule })) : [];
    const seenIds = new Set(merged.map((rule) => String(rule && rule.id ? rule.id : '')));

    for (const rule of Array.isArray(overrideRules) ? overrideRules : []) {
        const ruleId = String(rule && rule.id ? rule.id : '');
        if (ruleId && seenIds.has(ruleId)) {
            const index = merged.findIndex((entry) => String(entry && entry.id ? entry.id : '') === ruleId);
            merged[index] = mergePolicies(merged[index], rule);
            continue;
        }
        merged.push(isPlainObject(rule) ? { ...rule } : rule);
        if (ruleId) {
            seenIds.add(ruleId);
        }
    }

    return merged;
}

function mergePolicies(basePolicy, overridePolicy) {
    if (!isPlainObject(basePolicy)) {
        return isPlainObject(overridePolicy) ? { ...overridePolicy } : overridePolicy;
    }
    if (!isPlainObject(overridePolicy)) {
        return { ...basePolicy };
    }

    const merged = { ...basePolicy };

    for (const [key, overrideValue] of Object.entries(overridePolicy)) {
        if (key === 'integrity_signatures') {
            continue;
        }

        if (key === 'policy_id' && basePolicy.policy_id !== undefined) {
            continue;
        }

        const baseValue = merged[key];

        if (key === 'rule_definitions') {
            merged[key] = mergeRuleDefinitions(baseValue, overrideValue);
            continue;
        }

        if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
            merged[key] = mergePolicies(baseValue, overrideValue);
            continue;
        }

        if (Array.isArray(overrideValue)) {
            merged[key] = overrideValue.map((item) => (isPlainObject(item) ? { ...item } : item));
            continue;
        }

        merged[key] = isPlainObject(overrideValue) ? { ...overrideValue } : overrideValue;
    }

    return merged;
}

function readJsonFile(filePath, label) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error(`[AUDIT FAILURE] Unable to read ${label}: ${filePath}`);
        process.exit(78);
    }
}

function orchestratePolicyPipeline(orgPolicyPath, repoPolicyPath, trustStore) {
    if (!orgPolicyPath || !fs.existsSync(orgPolicyPath)) {
        console.error(`[CRITICAL] Fail-closed: root organization policy file missing at ${orgPolicyPath}`);
        process.exit(78);
    }

    const rawOrgContent = readJsonFile(orgPolicyPath, 'organization policy');
    const orgVerification = verifyPolicySignature(rawOrgContent, trustStore);
    console.log(orgVerification.auditMessage);

    if (!orgVerification.isValid) {
        process.exit(orgVerification.exitCode);
    }

    let resolvedPolicy = safeParsePolicy(rawOrgContent);

    if (repoPolicyPath && fs.existsSync(repoPolicyPath)) {
        const rawRepoContent = readJsonFile(repoPolicyPath, 'repository policy');
        const repoVerification = verifyPolicySignature(rawRepoContent, trustStore);
        console.log(repoVerification.auditMessage);

        if (!repoVerification.isValid) {
            process.exit(repoVerification.exitCode);
        }

        const repoPolicy = safeParsePolicy(rawRepoContent);
        resolvedPolicy = mergePolicies(resolvedPolicy, repoPolicy);
    }

    return resolvedPolicy;
}

module.exports = {
    orchestratePolicyPipeline,
    safeParsePolicy,
    mergePolicies
};