/**
 * Negative Test Case: Token Bleed Patterns
 * Expected Behavior: PASS — should NOT trigger token bleed finding
 * Reason: All API calls include max_tokens parameter
 * simplebeacon:token-bleed-patterns: test-negative-case
 */

export async function generateResponse(messages) {
  return openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 400,
  });
}

export async function summarizeText(text) {
  return openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Summarize: ${text}` }],
    max_tokens: 200,
  });
}
