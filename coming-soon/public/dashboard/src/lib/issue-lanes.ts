/** Split scan findings into production risk vs test-suite health. */

const QUALITY_DIR =
  /(^|\/)(__tests__|tests?|spec|specs|fixtures?|mocks?|testdata|test-data|molecule|testinfra|e2e|cypress|playwright|stories|storybook|__mocks__)(\/|$)/i;

const QUALITY_FILE = /\.(test|spec|stories)\.[a-z0-9]+$/i;

const QUALITY_NAME =
  /(^|\/)(conftest|loaddata|factory|factories)(\.[a-z0-9]+)?$/i;

export type IssueLane = "production" | "test";

export function isTestSuitePath(filePath: string | undefined | null): boolean {
  const rel = String(filePath || "").replace(/\\/g, "/");
  if (!rel) return false;
  return (
    QUALITY_DIR.test(rel) || QUALITY_FILE.test(rel) || QUALITY_NAME.test(rel)
  );
}

function issuePath(issue: any): string {
  return String(issue?.filePath || issue?.file || issue?.path || "");
}

export function splitIssuesByLane(
  report: any,
  primaryIssues: any[] = [],
): { production: any[]; testSuite: any[] } {
  const qualityFromReport = Array.isArray(report?.qualityIssues)
    ? report.qualityIssues
    : [];
  if (qualityFromReport.length) {
    return {
      production: primaryIssues,
      testSuite: qualityFromReport,
    };
  }
  const production: any[] = [];
  const testSuite: any[] = [];
  for (const issue of primaryIssues) {
    if (issue?.lane === "quality" || isTestSuitePath(issuePath(issue))) {
      testSuite.push(issue);
    } else {
      production.push(issue);
    }
  }
  return { production, testSuite };
}
