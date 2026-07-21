module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root.find(j.AssignmentExpression).forEach(path => {
    const node = path.node;
    if (!node.left || node.left.type !== 'MemberExpression') return;

    const prop = node.left.property;
    const isInner = (!node.left.computed && ((prop.type === 'Identifier' && prop.name === 'innerHTML') || (prop.type === 'Literal' && prop.value === 'innerHTML'))) ||
                    (node.left.computed && prop.type === 'Literal' && prop.value === 'innerHTML');
    if (!isInner) return;

    const right = node.right;
    let literalNode = null;

    if (right.type === 'Literal' || right.type === 'StringLiteral') {
      literalNode = right;
    } else if (right.type === 'TemplateLiteral' && right.expressions.length === 0 && right.quasis && right.quasis.length === 1) {
      literalNode = j.literal(right.quasis[0].value.cooked);
    } else {
      return; // skip non-literal or interpolated template literals
    }

    const leftObject = node.left.object;
    if (!leftObject) return;

    const call = j.callExpression(
      j.memberExpression(j.identifier('window'), j.identifier('setSafeHTML')),
      [leftObject, literalNode]
    );

    j(path).replaceWith(j.expressionStatement(call));
  });

  return root.toSource({ quote: 'single' });
};
