const { OpenAI } = require("openai");
const client = new OpenAI({ apiKey: "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz" });
module.exports = client;
