import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const simplebeacon = require('./index.js');

export const version = simplebeacon.version;
export const Simplebeacon = simplebeacon.Simplebeacon;

// Barrel introspection
export const getExportNames = simplebeacon.getExportNames;
export const getNamespaceNames = simplebeacon.getNamespaceNames;
export const validateBarrelIntegrity = simplebeacon.validateBarrelIntegrity;
export const __barrel__ = simplebeacon.__barrel__;

// Config
export const loadSimplebeaconConfig = simplebeacon.loadSimplebeaconConfig;
export const loadSamplebeaconConfig = simplebeacon.loadSamplebeaconConfig;
export const resolveMockDataScanPaths = simplebeacon.resolveMockDataScanPaths;
export const getRepositoryAuditBaseline = simplebeacon.getRepositoryAuditBaseline;
export const getConsistencyAnchorSamples = simplebeacon.getConsistencyAnchorSamples;
export const validateConfig = simplebeacon.validateConfig;

// Scan & Gate
export const runScan = simplebeacon.runScan;
export const scanMockDataDirectories = simplebeacon.scanMockDataDirectories;
export const evaluateGate = simplebeacon.evaluateGate;

// Reporters
export const formatTextReport = simplebeacon.formatTextReport;
export const formatJsonReport = simplebeacon.formatJsonReport;
export const buildAssessmentReport = simplebeacon.buildAssessmentReport;

// Sanitizers
export const sanitizeScanReport = simplebeacon.sanitizeScanReport;
export const redactSecretsInString = simplebeacon.redactSecretsInString;

// Errors
export const SimplebeaconError = simplebeacon.SimplebeaconError;
export const ConfigError = simplebeacon.ConfigError;
export const ScanError = simplebeacon.ScanError;
export const PathError = simplebeacon.PathError;

// Utilities
export const sleep = simplebeacon.sleep;
export const retry = simplebeacon.retry;
export const memoize = simplebeacon.memoize;
export const camelCase = simplebeacon.camelCase;
export const noop = simplebeacon.noop;
export const hash = simplebeacon.hash;
export const randomId = simplebeacon.randomId;
export const debounce = simplebeacon.debounce;
export const once = simplebeacon.once;
export const formatNumber = simplebeacon.formatNumber;
export const isBlank = simplebeacon.isBlank;
export const isEmpty = simplebeacon.isEmpty;
export const ensureArray = simplebeacon.ensureArray;
export const deepEqual = simplebeacon.deepEqual;
export const sortBy = simplebeacon.sortBy;
export const flatten = simplebeacon.flatten;
export const range = simplebeacon.range;
export const unique = simplebeacon.unique;
export const partition = simplebeacon.partition;
export const chunk = simplebeacon.chunk;
export const times = simplebeacon.times;
export const get = simplebeacon.get;
export const set = simplebeacon.set;
export const seq = simplebeacon.seq;
export const identity = simplebeacon.identity;
export const constant = simplebeacon.constant;
export const random = simplebeacon.random;
export const delay = simplebeacon.delay;
export const parseJsonSafe = simplebeacon.parseJsonSafe;
export const tryFn = simplebeacon.tryFn;
export const pick = simplebeacon.pick;
export const omit = simplebeacon.omit;
export const compact = simplebeacon.compact;
export const groupBy = simplebeacon.groupBy;
export const keyBy = simplebeacon.keyBy;
export const zipObject = simplebeacon.zipObject;
export const kebabCase = simplebeacon.kebabCase;
export const snakeCase = simplebeacon.snakeCase;
export const padStart = simplebeacon.padStart;
export const padEnd = simplebeacon.padEnd;
export const escapeRegExp = simplebeacon.escapeRegExp;
export const formatDuration = simplebeacon.formatDuration;
export const assertNever = simplebeacon.assertNever;
export const capitalize = simplebeacon.capitalize;
export const pluralize = simplebeacon.pluralize;
export const truncate = simplebeacon.truncate;

// Async advanced
export const debounceAsync = simplebeacon.debounceAsync;
export const throttleAsync = simplebeacon.throttleAsync;
export const memoizeAsync = simplebeacon.memoizeAsync;

export default simplebeacon;
