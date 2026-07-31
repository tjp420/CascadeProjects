const fs = require('fs');
let traverse;
try {
  // prefer default export, but tolerate both shapes
  traverse = require('@babel/traverse').default || require('@babel/traverse');
} catch (e) {
  traverse = null;
}

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
      // If @babel/traverse is available, perform a robust AST walk.
      if (traverse && ast) {
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
        return;
      }

      // Fallback: if traverse isn't available (lightweight environments), do a regex advisory scan on file text.
      try {
        let text = null;
        if (typeof file === 'string') {
          // file is a path
          text = fs.readFileSync(file, 'utf8');
        }
        // If `file` is an object with `text` or `contents`, try those too
        if (!text && file && typeof file === 'object') {
          text = file.text || file.contents || null;
        }
        if (text && /telemetry\s*:\s*['\"]cloud_upload['\"]/i.test(text)) {
          report({
            message: 'Detected telemetry:"cloud_upload" (regex advisory fallback)',
            file
          });
        }
      } catch (err) {
        // Swallow errors in lightweight validation; emit no-op so validator doesn't crash
      }
    }
  },
  fix: {
    type: 'replace',
    // simple guidance replace: developer should examine and set to 'offline' instead
    pattern: /telemetry\s*:\s*['\"]cloud_upload['\"]/g,
    replacement: "telemetry: 'offline' // changed by SimpleBeacon remediation"
  }
};
