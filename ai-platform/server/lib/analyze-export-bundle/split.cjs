/**
 * Large JSON splitting utilities for export bundles.
 * Splits oversized JSON arrays and objects into multiple smaller files.
 */

const logger = require('../app-logger.cjs');
const constants = require('../../config/constants.cjs');
const { safeStringify } = require('./utils.cjs');

const ONE_MB = constants.BYTES_PER_KB * constants.BYTES_PER_KB;

function splitLargeJsonParts(filePath, content) {
  const isJson = filePath.endsWith('.json');
  if (!isJson || Buffer.byteLength(content, 'utf8') <= ONE_MB) {
    return [{ path: filePath, content }];
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return splitTextParts(filePath, content);
  }

  if (Array.isArray(data) && data.length > 0) {
    return splitArrayParts(filePath, data);
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return splitObjectParts(filePath, data);
  }

  return splitTextParts(filePath, content);
}

function splitArrayParts(filePath, arr) {
  const base = filePath.replace(/\.json$/, '');
  const parts = [];
  let currentChunk = [];
  let currentSize = 2; // '[]'

  const itemSizes = arr.map((item) => Buffer.byteLength(JSON.stringify(item, null, 2), 'utf8'));

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const itemSize = itemSizes[i];

    if (
      itemSize > ONE_MB - constants.MAX_EXPORT_CHUNK &&
      item != null &&
      typeof item === 'object'
    ) {
      if (currentChunk.length > 0) {
        parts.push({ content: JSON.stringify(currentChunk, null, 2) });
        currentChunk = [];
        currentSize = 2;
      }
      const innerParts = splitLargeJsonParts(`${base}.json`, JSON.stringify(item, null, 2));
      for (const innerPart of innerParts) {
        let parsed;
        try {
          parsed = JSON.parse(innerPart.content);
        } catch (parseErr) {
          logger.warn(
            `[Export Bundle] splitArrayParts JSON.parse failed for ${filePath}: ${parseErr.message}. Content preview: ${String(innerPart.content).slice(0, 200)}`
          );
          parsed = {};
        }
        parts.push({ content: JSON.stringify([parsed], null, 2) });
      }
      continue;
    }

    const comma = currentChunk.length > 0 ? 1 : 0;
    if (
      currentSize + itemSize + comma > ONE_MB - constants.MAX_EXPORT_CHUNK &&
      currentChunk.length > 0
    ) {
      parts.push({ content: JSON.stringify(currentChunk, null, 2) });
      currentChunk = [item];
      currentSize = 2 + itemSize;
    } else {
      currentChunk.push(item);
      currentSize += itemSize + comma;
    }
  }

  if (currentChunk.length > 0) {
    parts.push({ content: JSON.stringify(currentChunk, null, 2) });
  }

  if (parts.length <= 1) {
    return [{ path: `${base}.json`, content: parts[0]?.content || '[]' }];
  }
  return parts.map((p, i) => ({
    path: i === 0 ? `${base}.json` : `${base}-part-${i + 1}.json`,
    content: p.content,
  }));
}

function splitObjectParts(filePath, obj) {
  const base = filePath.replace(/\.json$/, '');
  const keys = Object.keys(obj);
  const parts = [];
  let currentChunk = {};
  let currentSize = 2; // '{}'

  const keySizes = new Map();
  for (const key of keys) {
    const value = obj[key];
    const valueStr = JSON.stringify(value, null, 2);
    const valueSize = Buffer.byteLength(valueStr, 'utf8');
    const keyLabelSize = Buffer.byteLength(`"${key}": `, 'utf8');
    keySizes.set(key, { value, valueStr, valueSize, keyLabelSize });
  }

  for (const key of keys) {
    const { value, valueStr, valueSize, keyLabelSize } = keySizes.get(key);

    if (
      valueSize > ONE_MB - constants.MAX_EXPORT_CHUNK &&
      value != null &&
      typeof value === 'object'
    ) {
      if (Object.keys(currentChunk).length > 0) {
        parts.push({ content: JSON.stringify(currentChunk, null, 2) });
        currentChunk = {};
        currentSize = 2;
      }
      const innerParts = splitLargeJsonParts(`${base}.json`, valueStr);
      for (const innerPart of innerParts) {
        let parsed;
        try {
          parsed = JSON.parse(innerPart.content);
        } catch (parseErr) {
          logger.warn(
            `[Export Bundle] splitObjectParts JSON.parse failed for ${filePath} key=${key}: ${parseErr.message}. Content preview: ${String(innerPart.content).slice(0, 200)}`
          );
          parsed = {};
        }
        parts.push({
          content: JSON.stringify({ [key]: parsed }, null, 2),
        });
      }
      continue;
    }

    const comma = Object.keys(currentChunk).length > 0 ? 2 : 0;
    const entrySize = keyLabelSize + valueSize + comma;
    if (
      currentSize + entrySize > ONE_MB - constants.MAX_EXPORT_CHUNK &&
      Object.keys(currentChunk).length > 0
    ) {
      parts.push({ content: JSON.stringify(currentChunk, null, 2) });
      currentChunk = { [key]: value };
      currentSize = 2 + keyLabelSize + valueSize;
    } else {
      currentChunk[key] = value;
      currentSize += entrySize;
    }
  }

  if (Object.keys(currentChunk).length > 0) {
    parts.push({ content: JSON.stringify(currentChunk, null, 2) });
  }

  let changed = true;
  let result = parts.slice();
  while (changed) {
    changed = false;
    const newResult = [];
    for (const part of result) {
      const partSize = Buffer.byteLength(part.content, 'utf8');
      if (partSize > ONE_MB) {
        let partData;
        try {
          partData = JSON.parse(part.content);
        } catch (parseErr) {
          logger.warn(
            `[Export Bundle] splitObjectParts re-split JSON.parse failed for ${filePath}: ${parseErr.message}. Content preview: ${String(part.content).slice(0, 200)}`
          );
          newResult.push(part);
          continue;
        }
        const partKeys = Object.keys(partData);
        if (partKeys.length === 1) {
          const key = partKeys[0];
          const val = partData[key];
          if (val != null && typeof val === 'object') {
            const innerParts = splitLargeJsonParts(`${base}.json`, JSON.stringify(val, null, 2));
            for (const innerPart of innerParts) {
              let parsed;
              try {
                parsed = JSON.parse(innerPart.content);
              } catch (parseErr) {
                logger.warn(
                  `[Export Bundle] splitObjectParts re-split inner JSON.parse failed for ${filePath} key=${key}: ${parseErr.message}. Content preview: ${String(innerPart.content).slice(0, 200)}`
                );
                parsed = {};
              }
              newResult.push({
                content: JSON.stringify({ [key]: parsed }, null, 2),
              });
            }
            changed = true;
            continue;
          }
        }
      }
      newResult.push(part);
    }
    result = newResult;
  }

  if (result.length <= 1) {
    return [{ path: `${base}.json`, content: result[0]?.content || '{}' }];
  }
  return result.map((p, i) => ({
    path: i === 0 ? `${base}.json` : `${base}-part-${i + 1}.json`,
    content: p.content,
  }));
}

function splitTextParts(filePath, text) {
  const base = filePath.replace(/\.json$/, '');
  const total = Buffer.byteLength(text, 'utf8');
  const chunkCount = Math.ceil(total / ONE_MB) || 1;
  const charCount = text.length;
  const perChunk = Math.max(1, Math.ceil(charCount / chunkCount));
  const parts = [];
  for (let i = 0; i < charCount; i += perChunk) {
    const slice = text.slice(i, i + perChunk);
    const suffix = i === 0 ? '' : `-part-${Math.ceil((i + 1) / perChunk)}`;
    parts.push({
      path: `${base}${suffix}.json`,
      content: slice,
    });
  }
  return parts;
}

module.exports = {
  splitLargeJsonParts,
  splitArrayParts,
  splitObjectParts,
  splitTextParts,
};
