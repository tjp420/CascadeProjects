const openai = require("openai");
const client = new openai.OpenAI({ apiKey: "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz" });
module.exports = client;
