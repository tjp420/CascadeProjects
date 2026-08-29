// Base64-encoded non-secret data
const encodedConfig = Buffer.from(JSON.stringify({ timeout: 5000 })).toString("base64");
const decoded = Buffer.from(encodedConfig, "base64").toString("utf8");
module.exports = { encodedConfig, decoded };
