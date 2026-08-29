const jwt = require("jsonwebtoken");
// Token is generated at runtime, not hardcoded
const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET, { expiresIn: "1h" });
module.exports = token;
