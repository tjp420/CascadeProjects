// Hex hash of a file — not a secret
const FILE_HASH = "sha256:9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";
const checksum = FILE_HASH.split(":")[1];
module.exports = checksum;
