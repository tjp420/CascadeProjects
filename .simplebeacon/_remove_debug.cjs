module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  const debugMethods = new Set(['log', 'warn', 'error', 'info', 'debug']);
  const alerting = new Set(['alert', 'confirm']);

  function isConsoleCall(node) {
    if (node.type !== 'CallExpression') return false;
    const c = node.callee;
    if (c.type === 'MemberExpression') {
      const obj = c.object;
      const prop = c.property;
      if (obj.type !== 'Identifier' || obj.name !== 'console') return false;
      if (prop.type === 'Identifier' && debugMethods.has(prop.name)) return true;
      if (prop.type === 'StringLiteral' || prop.type === 'Literal') {
        const v = prop.value;
        if (typeof v === 'string' && debugMethods.has(v)) return true;
      }
    }
    if (c.type === 'Identifier' && alerting.has(c.name)) return true;
    return false;
  }

  root.find(j.CallExpression, (n) => isConsoleCall(n)).forEach((p) => {
    if (p.parent.value.type === 'ExpressionStatement') {
      j(p.parent).remove();
    } else {
      j(p).replaceWith(j.unaryExpression('void', j.literal(0)));
    }
  });

  root.find(j.DebuggerStatement).remove();

  return root.toSource();
};
