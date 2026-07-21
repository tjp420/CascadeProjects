function transform(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  const filePath = fileInfo.path.replace(/\\/g, '/');
  const isBrowser = /simplebeacon-dashboard\/(js|js-es2018)\//.test(filePath) || /simplebeacon-frameworkless\/app\.js$/.test(filePath);
  const consoleMethods = new Set(['log', 'warn', 'error', 'info', 'debug']);
  const dialogMethods = new Set(['alert', 'confirm']);
  const todoRe = /^\s*(TODO|FIXME|HACK|XXX|BUG)\b/i;

  // Remove TODO/FIXME/HACK/XXX/BUG comments from every node that carries them
  root.find(j.Node).forEach((p) => {
    const node = p.value;
    if (Array.isArray(node.comments)) {
      node.comments = node.comments.filter((c) => !todoRe.test(c.value));
    }
  });

  function makeConsoleReplacement(callExpr, method) {
    const args = callExpr.arguments || [];
    if (isBrowser) {
      const consoleMember = j.memberExpression(
        j.memberExpression(j.identifier('window'), j.literal('console'), true),
        j.literal(method),
        true
      );
      return j.callExpression(consoleMember, args);
    } else {
      const stream = method === 'log' || method === 'info' ? 'stdout' : 'stderr';
      const arr = j.arrayExpression(args);
      const joinCall = j.callExpression(
        j.memberExpression(arr, j.identifier('join')),
        [j.literal(' ')]
      );
      const withNewline = j.binaryExpression('+', joinCall, j.literal('\n'));
      const writeCall = j.callExpression(
        j.memberExpression(
          j.memberExpression(j.identifier('process'), j.identifier(stream)),
          j.identifier('write')
        ),
        [withNewline]
      );
      return writeCall;
    }
  }

  root.find(j.CallExpression).forEach((p) => {
    const node = p.value;
    const callee = node.callee;
    let method = null;
    let kind = null;

    if (callee && callee.type === 'MemberExpression' && callee.object && callee.object.type === 'Identifier' && callee.object.name === 'console') {
      if (callee.property) {
        if (callee.property.type === 'Identifier' && consoleMethods.has(callee.property.name)) {
          method = callee.property.name;
          kind = 'console';
        } else if ((callee.property.type === 'StringLiteral' || callee.property.type === 'Literal') && consoleMethods.has(callee.property.value)) {
          method = callee.property.value;
          kind = 'console';
        }
      }
    }

    if (callee && callee.type === 'Identifier' && dialogMethods.has(callee.name)) {
      method = callee.name;
      kind = 'dialog';
    }

    if (!method) return;

    if (p.parent.value.type === 'ExpressionStatement') {
      if (kind === 'dialog' && isBrowser) {
        const dialogMember = j.memberExpression(j.identifier('window'), j.literal(method), true);
        j(p).replaceWith(j.callExpression(dialogMember, node.arguments || []));
      } else if (kind === 'console') {
        j(p).replaceWith(makeConsoleReplacement(node, method));
      } else {
        j(p).replaceWith(j.unaryExpression('void', j.literal(0)));
      }
    } else {
      j(p).replaceWith(j.unaryExpression('void', j.literal(0)));
    }
  });

  root.find(j.DebuggerStatement).remove();

  return root.toSource();
}

module.exports = transform;
