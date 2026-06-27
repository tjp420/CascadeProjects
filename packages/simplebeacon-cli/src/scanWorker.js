const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');

const { files, rules } = workerData;
const findings = [];

files.forEach((filePath) => {
    try {
        const text = fs.readFileSync(filePath, 'utf-8');

        rules.forEach((rule) => {
            const regex = new RegExp(rule.pattern, 'g');
            let match;

            while ((match = regex.exec(text)) !== null) {
                findings.push({
                    file: filePath,
                    ruleId: rule.id,
                    index: match.index
                });
            }
        });
    } catch (e) {
        // Suppress file permission reading exceptions safely
    }
});

parentPort.postMessage(findings);
