/**
 * Positive Test Case: Token Bleed Patterns
 * Expected Behavior: FAIL — should trigger unbounded API call finding
 * Reason: openai.chat.completions.create without max_tokens parameter
 * simplebeacon:token-bleed-patterns: test-positive-case
 */

export async function generateResponse(messages) {
  return openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
  });
}

export async function summarizeText(text) {
  return openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: `Summarize: ${text}` }],
  });
}
