// Test fixture: Slack bot token (fake — matches SimpleBeacon regex but not a real token)
const Slack = require("@slack/web-api");
const token = "xoxb-aaaaaaaaaa-aaaaaaaaaa-aaaaaaaaaaaaaaaaaaaaaaaaaa";
const client = new Slack.WebClient(token);
module.exports = client;
