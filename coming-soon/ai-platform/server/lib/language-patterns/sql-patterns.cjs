/**
 * SQL-specific analysis patterns (Tier 2).
 */

const { getBaselinePatternsForFamily } = require('./universal-baseline-patterns.cjs');

const baseline = getBaselinePatternsForFamily('data');

module.exports = {
    techDebt: [
        ...baseline.techDebt,
        { id: 'sql-todo-comment', pattern: /--\s*TODO\b/gi, label: 'SQL TODO comment' },
        { id: 'sql-fixme-comment', pattern: /--\s*FIXME\b/gi, label: 'SQL FIXME comment' }
    ],
    debug: [
        { id: 'sql-select-star', pattern: /\bSELECT\s+\*\s+FROM\b/gi, label: 'SELECT * query' }
    ],
    placeholders: [
        ...baseline.placeholders,
        { id: 'sql-placeholder-table', pattern: /\b(?:temp|tmp|staging)_\w+/gi, label: 'Temporary/staging table name' }
    ],
    bestPractices: [
        { id: 'sql-drop-table', pattern: /\bDROP\s+TABLE\b/gi, label: 'DROP TABLE statement' },
        { id: 'sql-truncate', pattern: /\bTRUNCATE\s+TABLE\b/gi, label: 'TRUNCATE TABLE statement' }
    ],
    productionLeak: [
        { id: 'sql-seed-data', pattern: /\b(?:INSERT\s+INTO|seed|fixture)_/gi, label: 'Seed/fixture SQL pattern' }
    ]
};
