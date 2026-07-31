const traverse = require('@babel/traverse').default;

module.exports = {
  id: 'ENT-SEC-102',
  name: 'Insecure LLM Telemetry',
  severity: 'high',
  impact: 'high',
  likelihood: 'low',
  category: 'Telemetry',
  description: 'Detects code that enables cloud telemetry uploads in LLM client configuration.',
  guidance: 'Use offline/airgapped telemetry settings or the enterprise proxy gateway for approved uploads.',
  matcher: {
    type: 'ast',
    language: 'javascript',
    visitor: function ({ ast, file, report }) {
      // Find object properties named `telemetry` with value 'cloud_upload'
      traverse(ast, {
        ObjectProperty(path) {
          const key = path.node.key;
          const value = path.node.value;
          const keyName = key && key.name ? key.name : (key && key.value ? key.value : null);
          if (keyName === 'telemetry' && value && value.type === 'StringLiteral' && value.value === 'cloud_upload') {
            report({
              message: 'Detected telemetry:"cloud_upload" in configuration',
              file,
              node: path.node
            });
          }
        }
      });
    }
  },
  fix: {
    type: 'replace',
    // simple guidance replace: developer should examine and set to 'offline' instead
    pattern: /telemetry\s*:\s*['\"]cloud_upload['\"]/g,
    replacement: "telemetry: 'offline' // changed by SimpleBeacon remediation"
  }
};
