const path = require("path");
const fs = require("fs");
const filePath = path.join(__dirname, "data.json");
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
module.exports = data;
