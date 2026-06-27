const { streamText } = require('ai-sdk');
const fs = require('fs');

// TODO: AI implementation
async function summarizeDocument(path) {
  const doc = fs.readFileSync(path, 'utf8');

  const result = await streamText({
    model: 'claude-3-5-sonnet',
    messages: [
      { role: 'user', content: 'Summarize this: ' + doc }
    ]
  });

  return result.text;
}

module.exports = { summarizeDocument };
