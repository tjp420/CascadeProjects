// simplebeacon-ignore credentials — deploy script, uses env vars for real credentials, placeholders in comments only
/**
 * Upload the Unbreakable Oracle GGUF to Cloudflare R2 via S3 multipart upload.
 *
 * Usage:
 *   1. Create R2 API token in Cloudflare Dashboard:
 *      R2 → Manage API Tokens → Create API Token
 *      Permissions: Object Read & Write
 *      Bucket: simplebeacon-models
 *
 *   2. Set environment variables (PowerShell):
 *      $env:R2_ACCESS_KEY_ID = "<R2_ACCESS_KEY_ID>" // placeholder; do NOT commit real keys
 *      $env:R2_SECRET_ACCESS_KEY = "<R2_SECRET_ACCESS_KEY>" // placeholder; do NOT commit real keys
 *      $env:R2_ACCOUNT_ID = "<R2_ACCOUNT_ID>"
 *
 *   3. Run:
 *      node upload-oracle-to-r2.cjs
 */

const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const BUCKET = 'simplebeacon-models';
const KEY = 'unbreakable-oracle.gguf';
const FILE_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.ollama',
  'models',
  'blobs',
  'sha256-9293878fb6938c7051a7c5f7a609e41e185be8926b6b7c9dd355d95cdac817ad'
);
const PART_SIZE = 100 * 1024 * 1024; // 100MB per part (well under 5GB limit)
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '<R2_ACCOUNT_ID>'; // require env override for real deploys; placeholder kept to avoid accidental leakage
const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

async function main() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.error('ERROR: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY environment variables required.');
    console.error('');
    console.error('Set them in PowerShell:');
    console.error('  $env:R2_ACCESS_KEY_ID = "<your-access-key-id>"'); // placeholder guidance, do not commit real keys
    console.error('  $env:R2_SECRET_ACCESS_KEY = "<your-secret-access-key>"'); // placeholder guidance, do not commit real keys
    console.error('  $env:R2_ACCOUNT_ID = "<your-account-id>"');
    process.exit(1);
  }

  // Verify file exists
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`ERROR: File not found: ${FILE_PATH}`);
    console.error('Expected the unbreakable-oracle GGUF blob at this path.');
    process.exit(1);
  }

  const stat = fs.statSync(FILE_PATH);
  const totalSize = stat.size;
  const totalParts = Math.ceil(totalSize / PART_SIZE);

  console.log('=== Unbreakable Oracle R2 Upload ===');
  console.log(`File:   ${FILE_PATH}`);
  console.log(`Size:   ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB (${totalSize} bytes)`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Key:    ${KEY}`);
  console.log(`Parts:  ${totalParts} x ${(PART_SIZE / 1024 / 1024)}MB`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log('');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // Verify bucket exists
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`✓ Bucket "${BUCKET}" exists and is accessible`);
  } catch (err) {
    console.error(`✗ Cannot access bucket "${BUCKET}": ${err.message}`);
    console.error('Make sure your R2 API token has Object Read & Write permission for this bucket.');
    process.exit(1);
  }

  // Start multipart upload
  console.log('Starting multipart upload...');
  const createResp = await s3.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: KEY,
    ContentType: 'application/octet-stream',
    Metadata: {
      'model-name': 'unbreakable-oracle-final',
      'model-family': 'llama3.2',
      'parameters': '3.2B',
      'quantization': 'Q4_K_M',
    },
  }));
  const uploadId = createResp.UploadId;
  console.log(`Upload ID: ${uploadId}`);
  console.log('');

  // Upload parts
  const parts = [];
  const fileHandle = fs.openSync(FILE_PATH, 'r');
  const startTime = Date.now();

  for (let i = 0; i < totalParts; i++) {
    const partNumber = i + 1;
    const start = i * PART_SIZE;
    const end = Math.min(start + PART_SIZE, totalSize);
    const chunkSize = end - start;
    const buffer = Buffer.alloc(chunkSize);
    fs.readSync(fileHandle, buffer, 0, chunkSize, start);

    const partStart = Date.now();
    console.log(`  Uploading part ${partNumber}/${totalParts} (${(chunkSize / 1024 / 1024).toFixed(1)}MB)...`);

    const uploadResp = await s3.send(new UploadPartCommand({
      Bucket: BUCKET,
      Key: KEY,
      PartNumber: partNumber,
      UploadId: uploadId,
      Body: buffer,
    }));

    parts.push({
      PartNumber: partNumber,
      ETag: uploadResp.ETag,
    });

    const partDuration = ((Date.now() - partStart) / 1000).toFixed(1);
    const overallProgress = ((end / totalSize) * 100).toFixed(1);
    console.log(`    ✓ Done in ${partDuration}s (${overallProgress}% complete)`);
  }

  fs.closeSync(fileHandle);

  // Complete multipart upload
  console.log('');
  console.log('Completing multipart upload...');
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: KEY,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  }));

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('=== UPLOAD COMPLETE ===');
  console.log(`Time: ${totalDuration}s`);
  console.log(`File: ${KEY}`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`URL: ${ENDPOINT}/${BUCKET}/${KEY}`);
  console.log('');
  console.log('Next: Create a public bucket URL or Worker to serve this file to users.');
}

main().catch((err) => {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
