// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
'use strict';

jest.mock('../../../server/lib/simplebeacon-proxy.cjs', () => ({
  verifyLicenseToken: jest.fn(),
  generateLicenseToken: jest.fn()
}));
jest.mock('../../../server/lib/simplebeacon-subscription-store.cjs', () => ({
  readStore: jest.fn()
}));
jest.mock('../../../server/lib/code-hygiene-certificate.cjs', () => ({
  buildCertificateModel: jest.fn(),
  renderCertificateHtml: jest.fn()
}));
jest.mock('../../../server/lib/complete-scan-audit-report.cjs', () => ({
  buildCompleteAuditReport: jest.fn()
}));
jest.mock('../../../server/lib/analyze-export-bundle.cjs', () => ({
  buildAnalyzeExportZipStream: jest.fn()
}));
jest.mock('../../../server/lib/agency-branding-store.cjs', () => ({
  loadAgencyBranding: jest.fn()
}));

const { buildReportBundle } = require('../../../src/api/billing/report-bundle-builder.cjs');
const { verifyLicenseToken } = require('../../../server/lib/simplebeacon-proxy.cjs');
const { readStore } = require('../../../server/lib/simplebeacon-subscription-store.cjs');
const { renderCertificateHtml } = require('../../../server/lib/code-hygiene-certificate.cjs');
const { buildCompleteAuditReport } = require('../../../server/lib/complete-scan-audit-report.cjs');

describe('report-bundle-builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SIMPLEBEACON_LICENSE_SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET || 'test-secret';
  });
  afterEach(() => { delete process.env.SIMPLEBEACON_LICENSE_SECRET; });

  test('exports buildReportBundle function', () => {
    expect(typeof buildReportBundle).toBe('function');
  });

  test('throws 401 error on invalid license token when not in store', async () => {
    readStore.mockResolvedValue({ subscriptions: {} });
    verifyLicenseToken.mockReturnValue(null);
    await expect(buildReportBundle('bad-token', {})).rejects.toMatchObject({ statusCode: 401 });
  });

  test('uses store record when license token is found', async () => {
    const record = {
      licenseToken: 'good-token',
      licenseTier: 'executive',
      email: 'test@example.com',
      features: ['audit'],
      certClientName: 'Client',
      certProjectName: 'Project'
    };
    readStore.mockResolvedValue({ subscriptions: { 'sub-1': record } });
    renderCertificateHtml.mockReturnValue('<html>cert</html>');
    buildCompleteAuditReport.mockReturnValue('<html>audit</html>');

    const result = await buildReportBundle('good-token', { qualityScore: 95, scan_summary: { status: 'PASSED' } });
    expect(result.record).toBe(record);
    expect(result.email).toBe('test@example.com');
    expect(result.certificateHtml).toBe('<html>cert</html>');
    expect(result.auditReportHtml).toBe('<html>audit</html>');
    expect(result.deliveryId).toBeDefined();
  });
});
