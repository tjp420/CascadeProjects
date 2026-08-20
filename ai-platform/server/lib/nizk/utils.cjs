const crypto = require("crypto");

function canonicalize(value) {
  // Deterministic JSON serializer: sort object keys recursively
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize(value[k]))
      .join(",") +
    "}"
  );
}

function sha256HexFromObject(obj) {
  const s = canonicalize(obj);
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

module.exports = { canonicalize, sha256HexFromObject };
