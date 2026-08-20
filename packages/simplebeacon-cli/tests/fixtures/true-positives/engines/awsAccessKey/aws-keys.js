/**
 * True-Positive Fixture: awsAccessKey engine
 * Engine ID: awsAccessKey
 * Expected Finding: Credential Pattern (severity: high+)
 * Language: JavaScript
 *
 * Contains hardcoded AWS access keys using a non-allowlisted key
 * (AKIA followed by 16 non-example chars). The credential scanner
 * only scans .js/.mjs/.cjs/.ts/.tsx/.env/.yaml/.yml/.txt/.md files.
 */

const AWS = require("aws-sdk");

// Hardcoded AWS credentials — non-allowlisted key
const AWS_ACCESS_KEY_ID = "AKIAZ7QX4MNP2JKLRTUV";
const AWS_SECRET_ACCESS_KEY = "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";
const AWS_REGION = "us-east-1";

function getS3Client() {
  return new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION,
  });
}

module.exports = { getS3Client };
