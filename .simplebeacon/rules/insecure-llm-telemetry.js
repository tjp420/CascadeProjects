let traverse = null;
try {
  traverse = require('@babel/traverse').default;
} catch {
  // @babel/traverse not available — visitor will degrade gracefully
}

module.exports = {
  id: 'ENT-SEC-102',
  name: 'Insecure LLM Telemetry',
  severity: 'high',
  impact: 'high',
  likelihood: 'medium',
  category: 'Telemetry',
  description:
    'Detected telemetry: "cloud_upload" in LLM client configuration. ' +
    'This bypasses local sandboxing and sends usage data to external servers, ' +
    'violating enterprise data-sovereignty requirements.',
  guidance:
    'Use telemetry: "offline" or route through the enterprise proxy gateway ' +
    'for approved, audited telemetry uploads. Cloud upload mode is prohibited ' +
    'under enterprise data-isolation policies.',
  tags: ['security', 'telemetry', 'llm', 'data-sovereignty', 'air-gap', 'enterprise'],

  matcher: {
    type: 'ast',
    language: 'javascript',
    fileGlobs: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.ts', '**/*.tsx', '**/*.jsx'],
    visitor: function ({ ast, file, report }) {
      if (!traverse || !ast) return;

      traverse(ast, {
        // Match { telemetry: "cloud_upload" } in object literals
        ObjectProperty(path) {
          const key = path.node.key;
          const value = path.node.value;
          const keyName = key && key.name ? key.name : (key && key.value ? key.value : null);

          if (keyName === 'telemetry' && value && value.type === 'StringLiteral' && value.value === 'cloud_upload') {
            report({
              message: 'telemetry: "cloud_upload" bypasses local sandboxing — use "offline" or enterprise proxy gateway',
              file,
              node: path.node,
              line: path.node.loc ? path.node.loc.start.line : null,
              fix: {
                type: 'replace-node',
                replacement: "telemetry: 'offline'",
              },
            });
          }
        },

        // Match telemetry = "cloud_upload" assignments
        AssignmentExpression(path) {
          const left = path.node.left;
          const right = path.node.right;
          const leftName = left && left.property && left.property.name
            ? left.property.name
            : (left && left.name ? left.name : null);

          if (leftName === 'telemetry' && right && right.type === 'StringLiteral' && right.value === 'cloud_upload') {
            report({
              message: 'Assignment telemetry = "cloud_upload" bypasses local sandboxing',
              file,
              node: path.node,
              line: path.node.loc ? path.node.loc.start.line : null,
              fix: {
                type: 'replace-node',
                replacement: "'offline'",
              },
            });
          }
        },

        // Match const telemetry = "cloud_upload" declarations
        VariableDeclarator(path) {
          const id = path.node.id;
          const init = path.node.init;
          const varName = id && id.name ? id.name : null;

          if (varName === 'telemetry' && init && init.type === 'StringLiteral' && init.value === 'cloud_upload') {
            report({
              message: 'Variable telemetry = "cloud_upload" bypasses local sandboxing',
              file,
              node: path.node,
              line: path.node.loc ? path.node.loc.start.line : null,
              fix: {
                type: 'replace-node',
                replacement: "'offline'",
              },
            });
          }
        },
      });
    },
  },

  fix: {
    type: 'string-replace',
    description:
      'Replace telemetry: "cloud_upload" with telemetry: "offline" to enforce ' +
      'air-gapped mode. Route approved telemetry through the enterprise proxy gateway.',
    find: /telemetry\s*:\s*(['"])cloud_upload\1/g,
    replace: "telemetry: 'offline'",
    language: 'js',
  },

  examples: [
    {
      bad: 'const client = new OpenAI({ apiKey, telemetry: "cloud_upload" });',
      good: "const client = new OpenAI({ apiKey, telemetry: 'offline' });",
    },
    {
      bad: 'config.telemetry = "cloud_upload";',
      good: "config.telemetry = 'offline';",
    },
    {
      bad: 'const telemetry = "cloud_upload";',
      good: "const telemetry = 'offline';",
    },
  ],
};
