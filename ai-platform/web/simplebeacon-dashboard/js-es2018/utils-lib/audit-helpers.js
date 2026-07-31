export function npmAuditSummary(audit) {
  const summary = audit?.summary || audit?.metadata?.vulnerabilities || {};
  const deps = audit?.dependencies || audit?.metadata?.dependencies || {};
  return {
    dependencies: summary.dependencies ?? deps.total ?? null,
    prod: summary.prodDependencies ?? deps.prod ?? null,
    dev: summary.devDependencies ?? deps.dev ?? null,
    critical: summary.critical ?? 0,
    high: summary.high ?? 0,
    moderate: summary.moderate ?? summary.medium ?? 0,
    low: summary.low ?? 0,
    vulnerabilityTotal:
      summary.vulnerabilityTotal ?? summary.total ?? audit?.vulnerabilities?.length ?? 0,
    generatedAt: audit?.generatedAt ?? null,
  };
}
