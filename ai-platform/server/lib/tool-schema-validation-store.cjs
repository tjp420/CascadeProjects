"use strict";

/**
 * Tool Schema Validation Store — JSON schema enforcement for agent tool outputs
 *
 * Provides:
 *   - JSON schema registration per tool (request + response schemas)
 *   - Lightweight schema validation engine (type, required, properties, items, enum, min/max)
 *   - Tool output validation before passing results to inference pipeline
 *   - Violation tracking with detailed error paths and messages
 *   - Schema inference from sample payloads
 *   - Builtin schemas for all 8 builtin tools
 *
 * @module tool-schema-validation-store
 */

const fs = require("fs");
const path = require("path");
const logger = require("./app-logger.cjs");

const STORE_PATH = path.join(
  process.cwd(),
  ".simplebeacon",
  "tool-schemas.json",
);
const MAX_VIOLATIONS = 500;

// ── Builtin tool schemas ─────────────────────────────────────────────────────

const BUILTIN_SCHEMAS = {
  code_search: {
    request: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        maxResults: { type: "number", minimum: 1, maximum: 100 },
      },
    },
    response: {
      type: "object",
      required: ["results"],
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["filePath"],
            properties: {
              filePath: { type: "string" },
              lineStart: { type: "number" },
              lineEnd: { type: "number" },
              snippet: { type: "string" },
              score: { type: "number" },
            },
          },
        },
        totalFound: { type: "number" },
        query: { type: "string" },
      },
    },
  },
  file_read: {
    request: {
      type: "object",
      required: ["filePath"],
      properties: {
        filePath: { type: "string", minLength: 1 },
      },
    },
    response: {
      type: "object",
      required: ["content"],
      properties: {
        content: { type: "string" },
        filePath: { type: "string" },
        size: { type: "number" },
        encoding: { type: "string" },
      },
    },
  },
  web_search: {
    request: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        maxResults: { type: "number", minimum: 1, maximum: 50 },
      },
    },
    response: {
      type: "object",
      required: ["results"],
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "url"],
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              snippet: { type: "string" },
            },
          },
        },
        totalFound: { type: "number" },
      },
    },
  },
  code_execution: {
    request: {
      type: "object",
      required: ["language", "code"],
      properties: {
        language: {
          type: "string",
          enum: ["javascript", "python", "bash", "sql"],
        },
        code: { type: "string", minLength: 1 },
      },
    },
    response: {
      type: "object",
      required: ["stdout"],
      properties: {
        stdout: { type: "string" },
        stderr: { type: "string" },
        exitCode: { type: "number" },
        executionTimeMs: { type: "number" },
      },
    },
  },
  data_analysis: {
    request: {
      type: "object",
      required: ["data", "operation"],
      properties: {
        data: { type: "string" },
        operation: {
          type: "string",
          enum: ["summarize", "correlate", "aggregate", "filter", "sort"],
        },
      },
    },
    response: {
      type: "object",
      required: ["result"],
      properties: {
        result: { type: "string" },
        metrics: { type: "object" },
        rowCount: { type: "number" },
      },
    },
  },
  api_call: {
    request: {
      type: "object",
      required: ["url", "method"],
      properties: {
        url: { type: "string", minLength: 1 },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        },
        body: { type: "string" },
        headers: { type: "object" },
      },
    },
    response: {
      type: "object",
      required: ["statusCode"],
      properties: {
        statusCode: { type: "number", minimum: 100, maximum: 599 },
        body: { type: "string" },
        headers: { type: "object" },
        latencyMs: { type: "number" },
      },
    },
  },
  summarize: {
    request: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", minLength: 1 },
        maxLength: { type: "number", minimum: 10 },
      },
    },
    response: {
      type: "object",
      required: ["summary"],
      properties: {
        summary: { type: "string" },
        originalLength: { type: "number" },
        summaryLength: { type: "number" },
      },
    },
  },
  translate: {
    request: {
      type: "object",
      required: ["text", "to"],
      properties: {
        text: { type: "string", minLength: 1 },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
    response: {
      type: "object",
      required: ["translation"],
      properties: {
        translation: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
      },
    },
  },
};

// ── In-memory violation tracking ─────────────────────────────────────────────

const violations = [];

// ── Store I/O ────────────────────────────────────────────────────────────────

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH))
      return { schemas: {}, config: { strictMode: false } };
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { schemas: {}, config: { strictMode: false } };
  }
}

function writeStore(store) {
  var dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

function makeKey(orgId, toolId) {
  return orgId ? orgId + "::" + toolId : toolId;
}

// ── Schema CRUD ──────────────────────────────────────────────────────────────

function getSchema(toolId, orgId) {
  if (BUILTIN_SCHEMAS[toolId]) return BUILTIN_SCHEMAS[toolId];
  var store = readStore();
  return store.schemas[makeKey(orgId, toolId)] || null;
}

function getAllSchemas(orgId) {
  var store = readStore();
  var orgSchemas = {};
  for (var key in store.schemas) {
    if (store.schemas[key].orgId === orgId) {
      orgSchemas[store.schemas[key].toolId] = store.schemas[key];
    }
  }
  return { builtin: BUILTIN_SCHEMAS, custom: orgSchemas };
}

function registerSchema(toolId, schema, orgId) {
  var store = readStore();
  if (!store.schemas) store.schemas = {};
  var key = makeKey(orgId, toolId);
  store.schemas[key] = {
    toolId: toolId,
    orgId: orgId,
    request: schema.request || null,
    response: schema.response || null,
    strictMode: schema.strictMode !== undefined ? schema.strictMode : false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  logger.info("[ToolSchemaValidation] Schema registered for tool: " + toolId);
  return { success: true, schema: store.schemas[key] };
}

function updateSchema(toolId, updates, orgId) {
  var store = readStore();
  var key = makeKey(orgId, toolId);
  if (!store.schemas[key]) return { success: false, error: "Schema not found" };
  if (updates.request !== undefined)
    store.schemas[key].request = updates.request;
  if (updates.response !== undefined)
    store.schemas[key].response = updates.response;
  if (updates.strictMode !== undefined)
    store.schemas[key].strictMode = updates.strictMode;
  store.schemas[key].updatedAt = new Date().toISOString();
  writeStore(store);
  return { success: true, schema: store.schemas[key] };
}

function deleteSchema(toolId, orgId) {
  var store = readStore();
  var key = makeKey(orgId, toolId);
  if (!store.schemas[key]) return { success: false, error: "Schema not found" };
  delete store.schemas[key];
  writeStore(store);
  return { success: true };
}

function getConfig() {
  var store = readStore();
  return store.config || { strictMode: false };
}

function updateConfig(updates) {
  var store = readStore();
  if (!store.config) store.config = { strictMode: false };
  if (updates.strictMode !== undefined)
    store.config.strictMode = updates.strictMode;
  writeStore(store);
  return { success: true, config: store.config };
}

// ── Validation Engine ────────────────────────────────────────────────────────

/**
 * Validate a value against a JSON schema fragment.
 * Supports: type, required, properties, items, enum, minimum, maximum,
 * minLength, maxLength, minItems, maxItems.
 *
 * @param {*} value — The value to validate
 * @param {object} schema — The schema to validate against
 * @param {string} [path] — Current path for error reporting
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string}> }}
 */
function validateValue(value, schema, path) {
  path = path || "$";
  var errors = [];

  if (!schema) return { valid: true, errors: [] };

  // Type check
  if (schema.type) {
    var actualType = Array.isArray(value)
      ? "array"
      : value === null
        ? "null"
        : typeof value;
    if (
      schema.type === "integer" &&
      typeof value === "number" &&
      Number.isInteger(value)
    ) {
      // ok
    } else if (schema.type === "number" && typeof value === "number") {
      // ok
    } else if (actualType !== schema.type) {
      errors.push({
        path: path,
        message: "Expected type " + schema.type + " but got " + actualType,
      });
      return { valid: false, errors: errors };
    }
  }

  // Enum check
  if (schema.enum && schema.enum.indexOf(value) === -1) {
    errors.push({
      path: path,
      message: "Value not in enum: [" + schema.enum.join(", ") + "]",
    });
  }

  // String constraints
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path: path,
        message:
          "String length " +
          value.length +
          " is less than minLength " +
          schema.minLength,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path: path,
        message:
          "String length " +
          value.length +
          " exceeds maxLength " +
          schema.maxLength,
      });
    }
  }

  // Number constraints
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path: path,
        message: "Value " + value + " is less than minimum " + schema.minimum,
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path: path,
        message: "Value " + value + " exceeds maximum " + schema.maximum,
      });
    }
  }

  // Object validation
  if (
    schema.type === "object" &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value !== null
  ) {
    // Required properties
    if (schema.required) {
      for (var i = 0; i < schema.required.length; i++) {
        var reqProp = schema.required[i];
        if (value[reqProp] === undefined) {
          errors.push({
            path: path + "." + reqProp,
            message: "Required property missing",
          });
        }
      }
    }
    // Property validation
    if (schema.properties) {
      for (var prop in schema.properties) {
        if (value[prop] !== undefined) {
          var propResult = validateValue(
            value[prop],
            schema.properties[prop],
            path + "." + prop,
          );
          errors = errors.concat(propResult.errors);
        }
      }
    }
    // Additional properties check (if additionalProperties is false)
    if (schema.additionalProperties === false && schema.properties) {
      for (var key in value) {
        if (!schema.properties[key]) {
          errors.push({
            path: path + "." + key,
            message: "Additional property not allowed",
          });
        }
      }
    }
  }

  // Array validation
  if (schema.type === "array" && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path: path,
        message:
          "Array length " +
          value.length +
          " is less than minItems " +
          schema.minItems,
      });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path: path,
        message:
          "Array length " +
          value.length +
          " exceeds maxItems " +
          schema.maxItems,
      });
    }
    if (schema.items) {
      for (var j = 0; j < value.length; j++) {
        var itemResult = validateValue(
          value[j],
          schema.items,
          path + "[" + j + "]",
        );
        errors = errors.concat(itemResult.errors);
      }
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate a tool request (input arguments) against its registered schema.
 */
function validateRequest(toolId, request, orgId) {
  var schema = getSchema(toolId, orgId);
  if (!schema || !schema.request)
    return { valid: true, errors: [], skipped: true };
  var result = validateValue(request, schema.request, "$request");
  if (!result.valid) recordViolation(toolId, orgId, "request", result.errors);
  return result;
}

/**
 * Validate a tool response (output) against its registered schema.
 */
function validateResponse(toolId, response, orgId) {
  var schema = getSchema(toolId, orgId);
  if (!schema || !schema.response)
    return { valid: true, errors: [], skipped: true };
  var result = validateValue(response, schema.response, "$response");
  if (!result.valid) recordViolation(toolId, orgId, "response", result.errors);
  return result;
}

// ── Violation Tracking ───────────────────────────────────────────────────────

function recordViolation(toolId, orgId, direction, errors) {
  var entry = {
    id: "viol-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    toolId: toolId,
    orgId: orgId,
    direction: direction,
    errors: errors,
    errorCount: errors.length,
  };
  violations.push(entry);
  if (violations.length > MAX_VIOLATIONS) violations.shift();
  logger.warn(
    "[ToolSchemaValidation] " +
      direction +
      " violation for tool " +
      toolId +
      ": " +
      errors.length +
      " errors",
  );
  return entry;
}

function getViolations(limit) {
  limit = limit || 50;
  return violations.slice().reverse().slice(0, limit);
}

function clearViolations() {
  var count = violations.length;
  violations.length = 0;
  return { success: true, cleared: count };
}

function getViolationStats() {
  var byTool = {};
  var byDirection = { request: 0, response: 0 };
  var totalErrors = 0;
  for (var i = 0; i < violations.length; i++) {
    var v = violations[i];
    byTool[v.toolId] = (byTool[v.toolId] || 0) + 1;
    byDirection[v.direction] = (byDirection[v.direction] || 0) + 1;
    totalErrors += v.errorCount;
  }
  return {
    totalViolations: violations.length,
    totalErrors: totalErrors,
    byTool: byTool,
    byDirection: byDirection,
  };
}

// ── Schema Inference ─────────────────────────────────────────────────────────

/**
 * Infer a JSON schema from a sample payload.
 * Useful for auto-generating schemas from example tool outputs.
 */
function inferSchema(value, path) {
  path = path || "";
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    var itemSchema = value.length > 0 ? inferSchema(value[0]) : {};
    return { type: "array", items: itemSchema, minItems: 1 };
  }
  if (typeof value === "object") {
    var properties = {};
    var required = [];
    for (var key in value) {
      properties[key] = inferSchema(value[key]);
      required.push(key);
    }
    return { type: "object", required: required, properties: properties };
  }
  if (typeof value === "string") return { type: "string" };
  if (typeof value === "number")
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return {};
}

// ── Stats ────────────────────────────────────────────────────────────────────

function getStats() {
  var store = readStore();
  var customCount = Object.keys(store.schemas || {}).length;
  var builtinCount = Object.keys(BUILTIN_SCHEMAS).length;
  var config = getConfig();
  return {
    builtinSchemaCount: builtinCount,
    customSchemaCount: customCount,
    totalSchemaCount: builtinCount + customCount,
    strictMode: config.strictMode,
    totalViolations: violations.length,
    violationStats: getViolationStats(),
  };
}

module.exports = {
  BUILTIN_SCHEMAS: BUILTIN_SCHEMAS,
  getSchema: getSchema,
  getAllSchemas: getAllSchemas,
  registerSchema: registerSchema,
  updateSchema: updateSchema,
  deleteSchema: deleteSchema,
  getConfig: getConfig,
  updateConfig: updateConfig,
  validateValue: validateValue,
  validateRequest: validateRequest,
  validateResponse: validateResponse,
  recordViolation: recordViolation,
  getViolations: getViolations,
  clearViolations: clearViolations,
  getViolationStats: getViolationStats,
  inferSchema: inferSchema,
  getStats: getStats,
};
