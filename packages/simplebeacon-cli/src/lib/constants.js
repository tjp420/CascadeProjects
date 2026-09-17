"use strict";

const MS_PER_SECOND = 1000;
const ONE_MINUTE_MS = 60 * MS_PER_SECOND;
const TIMEOUT_5S = 5 * 1000;
const BYTES_PER_KB = 1024;
const DEFAULT_PORT = 3003;
/** MCP scan_file/scan_snippet cap — matches VS Code interceptor, not a 50KB fiction. */
const MAX_MCP_SCAN_BYTES = 400 * BYTES_PER_KB;
const MCP_FILE_SCAN_CACHE_TTL_MS = 5 * ONE_MINUTE_MS;
const MCP_FILE_SCAN_CACHE_MAX = 256;

module.exports = Object.freeze({
  MS_PER_SECOND,
  ONE_MINUTE_MS,
  TIMEOUT_5S,
  BYTES_PER_KB,
  DEFAULT_PORT,
  MAX_MCP_SCAN_BYTES,
  MCP_FILE_SCAN_CACHE_TTL_MS,
  MCP_FILE_SCAN_CACHE_MAX,
});
