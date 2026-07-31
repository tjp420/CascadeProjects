/**
 * Rule registration for file-reduction and data-quality scanners.
 */

const { BuildArtifactScanner } = require('../analyzers/file-reduction/build-artifact-scanner');
const {
  AssetConsolidationScanner,
} = require('../analyzers/file-reduction/asset-consolidation-scanner');
const { UnusedFileDetector } = require('../analyzers/file-reduction/unused-file-detector');
const {
  SupplyChainSecurityScanner,
} = require('../analyzers/file-reduction/supply-chain-security-scanner');
const { DeadCodeScanner } = require('../analyzers/file-reduction/dead-code-scanner');
const { GitHygieneScanner } = require('../analyzers/file-reduction/git-hygiene-scanner');
const {
  ConfigManagementAnalyzer,
  DependencyHealthAnalyzer,
  EnvironmentVariableAnalyzer,
  DataFreshnessAnalyzer,
  DataAccessPatternAnalyzer,
  DataPrivacyAnalyzer,
  DataLineageAnalyzer,
  DataConsistencyAnalyzer,
} = require('../analyzers/data-cleanup');

module.exports = {
  id: 'file-reduction',
  name: 'File Reduction & Data Quality Analysis',
  version: '1.1.0',
  scanners: [
    { id: 'build-artifacts', class: BuildArtifactScanner, enabled: false, priority: 1 },
    { id: 'asset-consolidation', class: AssetConsolidationScanner, enabled: false, priority: 2 },
    { id: 'unused-files', class: UnusedFileDetector, enabled: false, priority: 3 },
    { id: 'supply-chain-security', class: SupplyChainSecurityScanner, enabled: true, priority: 4 },
    { id: 'dead-code', class: DeadCodeScanner, enabled: false, priority: 5 },
    { id: 'git-hygiene', class: GitHygieneScanner, enabled: true, priority: 6 },
    { id: 'config-management', class: ConfigManagementAnalyzer, enabled: true, priority: 7 },
    { id: 'dependency-health', class: DependencyHealthAnalyzer, enabled: true, priority: 8 },
    {
      id: 'environment-variables',
      class: EnvironmentVariableAnalyzer,
      enabled: false,
      priority: 9,
    },
    { id: 'data-freshness', class: DataFreshnessAnalyzer, enabled: true, priority: 10 },
    { id: 'data-access-patterns', class: DataAccessPatternAnalyzer, enabled: true, priority: 11 },
    { id: 'data-privacy', class: DataPrivacyAnalyzer, enabled: true, priority: 12 },
    { id: 'data-lineage', class: DataLineageAnalyzer, enabled: true, priority: 13 },
    { id: 'data-consistency', class: DataConsistencyAnalyzer, enabled: true, priority: 14 },
  ],
  severityMapping: {
    'build-artifact': 'low',
    'asset-duplicate': 'low',
    'unused-file': 'medium',
    'config-sprawl': 'medium',
    'env-secret': 'high',
    'unused-dependency': 'low',
    'version-drift': 'medium',
    'stale-data': 'low',
    'data-access-pattern': 'medium',
    'data-privacy': 'high',
    'orphaned-data': 'low',
    'data-shape-drift': 'medium',
    'supply-chain-typosquat': 'high',
    'supply-chain-compromised': 'critical',
    'supply-chain-suspicious-script': 'high',
    'dead-export': 'low',
    'orphaned-export': 'low',
    'git-sensitive-file': 'high',
    'git-large-file': 'medium',
    'git-large-blob': 'medium',
    'git-sensitive-commit': 'high',
    'git-hygiene-warning': 'low',
  },
};
