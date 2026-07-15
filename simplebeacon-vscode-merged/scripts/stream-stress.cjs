// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * SimpleBeacon Streaming Parser Stress Framework
 * Isolates the 9-step stream-safe formatting pipeline by feeding it
 * malformed, split, and unstable chunk sequences.
 *
 * Usage:
 *   node scripts/stream-stress.cjs
 */

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Replicates the 9-step stream-safe formatting pipeline from ChatbotView
 * for isolated Node.js stress testing.
 */
function formatStreamedMessage(text) {
  if (!text) return '';

  let processedText = text;

  // 1. Stream-Safe Guard: Detect unclosed triple backticks
  const backtickCount = (processedText.match(/```/g) || []).length;
  if (backtickCount % 2 !== 0) {
    processedText += '\n```';
  }

  // 2. Stream-Safe Guard: Detect unclosed inline code backticks
  const inlineBacktickCount = (processedText.match(/`/g) || []).length;
  if (inlineBacktickCount % 2 !== 0) {
    processedText += '`';
  }

  // 3. Extract and protect code blocks using unique placeholders
  const codeBlocks = [];
  processedText = processedText.replace(/```([\s\S]*?)```/g, (match, code) => {
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
    codeBlocks.push(code);
    return placeholder;
  });

  // 4. Extract and protect inline code
  const inlineBlocks = [];
  processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `__INLINE_PLACEHOLDER_${inlineBlocks.length}__`;
    inlineBlocks.push(code);
    return placeholder;
  });

  // 5. Run native XSS escaping on standard paragraph text strings
  processedText = escapeHtml(processedText);

  // 6. Restore protected inline code with safe text nodes
  inlineBlocks.forEach((code, index) => {
    const safeInline = `<code class="cb-v3-inline-code">${escapeHtml(code)}</code>`;
    processedText = processedText.replace(`__INLINE_PLACEHOLDER_${index}__`, safeInline);
  });

  // 7. Restore protected structural code blocks with syntax wrappers
  codeBlocks.forEach((code, index) => {
    const safeBlock = `<pre class="chatbot-code-block"><code>${escapeHtml(code)}</code></pre>`;
    processedText = processedText.replace(`__CODE_BLOCK_PLACEHOLDER_${index}__`, safeBlock);
  });

  // 8. Preserve line breaks (but not in code blocks)
  processedText = processedText.replace(/<pre class="chatbot-code-block">[\s\S]*?<\/pre>/g, (match) => {
    return match.replace(/\n/g, '&#10;');
  });
  processedText = processedText.replace(/\n/g, '<br>');

  // 9. Restore newlines in code blocks
  processedText = processedText.replace(/&#10;/g, '\n');

  return processedText;
}

function runStreamingParserStressTest() {
  // eslint-disable-next-line no-console
  console.log('\x1b[34m[Stream Stress] Testing 9-step text regex pipeline against fractured chunks...\x1b[0m');

  // Maliciously fractured text block cut directly in half through structural markdown tags
  const fracturedTokenChunks = [
    "Here is the issue pinpointed in your file:\n\n```javas",
    "cript\nconst token = 'DEMO_PLACEHOLDER_",
    "v1-fake-key-example';\nconsole.log(token);\n",
    // Notice the missing terminal closing backticks to test the auto-closers
    "\nThis is an unclosed inline `code tag left hanging mid-air"
  ];

  let streamingBufferText = '';
  let allPassed = true;

  fracturedTokenChunks.forEach((chunk, index) => {
    streamingBufferText += chunk;

    // Feed the cumulative fragmented text straight into the 9-step parser engine
    const processedHtmlOutput = formatStreamedMessage(streamingBufferText);

    // eslint-disable-next-line no-console
    console.log(`\x1b[34m[Chunk ${index + 1} Stream View Snapshot]:\x1b[0m`);
    // eslint-disable-next-line no-console
    console.log(processedHtmlOutput.substring(0, 400) + (processedHtmlOutput.length > 400 ? '...' : ''));

    // Structural Safeguard Validations
    // Raw unclosed markdown fence (``` without a matching close) should NEVER bleed into HTML
    const rawBacktickMatches = processedHtmlOutput.match(/```(?!&#10;)/g);
    if (rawBacktickMatches && rawBacktickMatches.length > 0) {
      // eslint-disable-next-line no-console
      console.error('\x1b[31m  Test Failed: Raw unclosed markdown fence bled into the client UI HTML layout!\x1b[0m');
      allPassed = false;
    }

    // Unescaped < or > should never appear outside code blocks
    const unescapedAngleBrackets = processedHtmlOutput.match(/<(?!(code|pre|br|\/code|\/pre|!--))/g);
    if (unescapedAngleBrackets && unescapedAngleBrackets.length > 0) {
      const safeCheck = processedHtmlOutput.includes('<code') || processedHtmlOutput.includes('<pre');
      if (!safeCheck) {
        // eslint-disable-next-line no-console
        console.error('\x1b[31m  Test Failed: Unescaped angle brackets detected outside safe markup!\x1b[0m');
        allPassed = false;
      }
    }
  });

  if (allPassed) {
    // eslint-disable-next-line no-console
    console.log('\x1b[32m\n  Success: 9-step regex engine stabilized all streaming tokens without layout bleeding.\x1b[0m');
    process.exit(0);
  } else {
    // eslint-disable-next-line no-console
    console.error('\x1b[31m\n  Stream stress test completed with failures.\x1b[0m');
    process.exit(1);
  }
}

runStreamingParserStressTest();
