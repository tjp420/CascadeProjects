/**
 * True-Positive Fixture: tokenBleed engine
 * Engine ID: tokenBleed
 * Expected Finding: Token Bleed (severity: medium)
 * Language: JavaScript
 *
 * Contains fs.readFileSync within 10 lines of an openai.chat.completions.create
 * call without max_tokens — classic token bleed pattern (SB-TB-001, SB-TB-005).
 */

const fs = require("fs");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyzeLogFile() {
  // Read entire file without chunking — token bleed risk (SB-TB-001)
  const logContent = fs.readFileSync("/var/log/app.log", "utf8");

  // LLM call without max_tokens limit — token bleed (SB-TB-005)
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "Analyze this log file." },
      { role: "user", content: logContent },
    ],
  });

  return response.choices[0].message.content;
}

module.exports = { analyzeLogFile };
