const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractFunctionsFromTree } = require('../src/tree-sitter-queries');

test('extractFunctionsFromTree walks mock function nodes', () => {
  const mockNode = {
    type: 'function_declaration',
    startIndex: 0,
    endIndex: 80,
    startPosition: { row: 0 },
    childCount: 2,
    child: (i) =>
      i === 0
        ? { type: 'identifier', text: 'fetchData', startIndex: 9, endIndex: 18 }
        : {
            type: 'statement_block',
            startIndex: 22,
            endIndex: 80,
            text: '{\n  const data = 1;\n  return data;\n}',
          },
    childForFieldName: (field) =>
      field === 'name'
        ? { type: 'identifier', text: 'fetchData', startIndex: 9, endIndex: 18 }
        : {
            type: 'statement_block',
            startIndex: 22,
            endIndex: 80,
          },
    namedChildren: [
      { type: 'identifier', text: 'fetchData', startIndex: 9, endIndex: 18 },
      { type: 'statement_block', startIndex: 22, endIndex: 80 },
    ],
  };

  const content = 'function fetchData() {\n  const data = 1;\n  return data;\n}';
  const functions = extractFunctionsFromTree(mockNode, content, 'javascript');
  assert.equal(functions.length, 1);
  assert.equal(functions[0].name, 'fetchData');
  assert.equal(functions[0].startLine, 1);
  assert.ok(functions[0].body.includes('const data'));
});
