const fs = require('fs');
const path = require('path');

module.exports = function evaluateProductionAuthProfile(rule, { productionProfile, report }) {
    if (!productionProfile) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'skip', evidence: 'Production profile not evaluated' };
    }
    if (!fs.existsSync(path.join(path.resolve(report.projectRoot || ''), '.env.production'))) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'skip', evidence: '.env.production not present (local/dev repo)' };
    }
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: productionProfile.configured ? 'pass' : 'fail',
        evidence: productionProfile.reason
    };
};
