const octokit = require("@octokit/rest");
const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD";
const client = new octokit.Octokit({ auth: token });
module.exports = client;
