const boto3 = require("boto3");
const client = boto3.client({
  aws_access_key_id: "AKIAZ9B4XMNP7JKLMNQR",
  aws_secret_access_key: "z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0",
  region_name: "us-west-2",
});
module.exports = client;
