/**
 * E2E tests for the Advanced Telemetry dashboard view.
 *
 * Verifies that:
 *  - Free-tier users see the Team Pro paywall (EU AI Act mapping gate)
 *  - Team Pro users see the full telemetry dashboard with all three sections
 *  - Batch execution stat cards render with correct data
 *  - Compliance trend chart renders
 *  - Issue resolution tracking renders
 *  - Empty state shows when no telemetry data exists
 *
 * Run with:  npx playwright test tests/telemetry-e2e.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const TELEMETRY_URL = '/#/telemetry';

// ─── Mock telemetry data ────────────────────────────────────────────────

const MOCK_BATCH_HISTORY = [
    {
        scanId: 'scan-001',
        date: '2026-08-01T10:00:00Z',
        totalFiles: 50,
        totalChunks: 12,
        totalBatches: 3,
        totalTokensEstimated: 175000,
        durationMs: 45000,
        avgChunkTokens: 14583,
        errors: 0
    },
    {
        scanId: 'scan-002',
        date: '2026-08-05T14:00:00Z',
        totalFiles: 120,
        totalChunks: 28,
        totalBatches: 6,
        totalTokensEstimated: 420000,
        durationMs: 92000,
        avgChunkTokens: 15000,
        errors: 1
    },
    {
        scanId: 'scan-003',
        date: '2026-08-10T09:00:00Z',
        totalFiles: 85,
        totalChunks: 20,
        totalBatches: 4,
        totalTokensEstimated: 297500,
        durationMs: 68000,
        avgChunkTokens: 14875,
        errors: 0
    }
];

const MOCK_COMPLIANCE_HISTORY = [
    {
        scanId: 'scan-001',
        date: '2026-08-01T10:00:00Z',
        euAiActScore: 72,
        soc2Score: 85,
        gateScore: 90,
        overallScore: 82
    },
    {
        scanId: 'scan-002',
        date: '2026-08-05T14:00:00Z',
        euAiActScore: 78,
        soc2Score: 88,
        gateScore: 95,
        overallScore: 87
    },
    {
        scanId: 'scan-003',
        date: '2026-08-10T09:00:00Z',
        euAiActScore: 85,
        soc2Score: 92,
        gateScore: 98,
        overallScore: 92
    }
];

const MOCK_RESOLUTION_HISTORY = [
    {
        scanId: 'scan-002',
        date: '2026-08-05T14:00:00Z',
        newIssues: 15,
        resolvedIssues: 8,
        netChange: 7,
        openTotal: 22
    },
    {
        scanId: 'scan-003',
        date: '2026-08-10T09:00:00Z',
        newIssues: 5,
        resolvedIssues: 12,
        netChange: -7,
        openTotal: 15
    }
];

// ─── Helpers ────────────────────────────────────────────────────────────

interface InjectOptions {
    plan: 'free' | 'developer' | 'team_pro';
    batchHistory?: object[];
    complianceHistory?: object[];
    resolutionHistory?: object[];
}

async function injectAuth(page: Page, opts: InjectOptions) {
    await page.addInitScript((args: InjectOptions) => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({ exp: 99999999999, email: 'test@simplebeacon.ai' }));
        const token = `${header}.${payload}.dummy-signature`;

        localStorage.setItem('sb_token', token);
        localStorage.setItem(
            'sb_user',
            JSON.stringify({
                plan: args.plan,
                role: 'user',
                email: 'test@simplebeacon.ai'
            })
        );

        if (args.batchHistory) {
            localStorage.setItem('sb_telemetry_batches', JSON.stringify(args.batchHistory));
        }
        if (args.complianceHistory) {
            localStorage.setItem('sb_telemetry_compliance', JSON.stringify(args.complianceHistory));
        }
        if (args.resolutionHistory) {
            localStorage.setItem('sb_telemetry_resolution', JSON.stringify(args.resolutionHistory));
        }
    }, opts);
}

// ─── Tests ──────────────────────────────────────────────────────────────

test.describe('Advanced Telemetry — Free-tier paywall', () => {
    test('1. Free-tier user sees Team Pro paywall on telemetry page', async ({ page }) => {
        await injectAuth(page, { plan: 'free' });
        await page.goto(TELEMETRY_URL);

        // The EU AI Act paywall should be visible (canMapEuAiAct is false for free tier)
        await expect(page.getByText('EU AI Act Mapping is a Team Pro Feature')).toBeVisible();
    });

    test('2. Free-tier user does NOT see batch execution stats', async ({ page }) => {
        await injectAuth(page, { plan: 'free' });
        await page.goto(TELEMETRY_URL);

        // The batch execution section should NOT be visible
        await expect(page.getByText('Multi-File Batch Execution')).not.toBeVisible();
    });
});

test.describe('Advanced Telemetry — Team Pro full access', () => {
    test('3. Team Pro user sees the full telemetry dashboard', async ({ page }) => {
        await injectAuth(page, {
            plan: 'team_pro',
            batchHistory: MOCK_BATCH_HISTORY,
            complianceHistory: MOCK_COMPLIANCE_HISTORY,
            resolutionHistory: MOCK_RESOLUTION_HISTORY
        });
        await page.goto(TELEMETRY_URL);

        // The page title should be visible
        await expect(page.getByRole('heading', { name: 'Advanced Telemetry' })).toBeVisible();

        // The batch execution section should be visible
        await expect(page.getByText('Multi-File Batch Execution')).toBeVisible();
    });

    test('4. Batch execution stat cards show correct values', async ({ page }) => {
        await injectAuth(page, {
            plan: 'team_pro',
            batchHistory: MOCK_BATCH_HISTORY,
            complianceHistory: MOCK_COMPLIANCE_HISTORY,
            resolutionHistory: MOCK_RESOLUTION_HISTORY
        });
        await page.goto(TELEMETRY_URL);

        // Avg sweep duration = (45000 + 92000 + 68000) / 3 = 68333ms ≈ 68.3s
        await expect(page.getByText('Avg Sweep Duration')).toBeVisible();
        // Total files = 50 + 120 + 85 = 255 — use regex to handle locale formatting
        await expect(page.getByText('Total Files Processed')).toBeVisible();
        // Total chunks = 12 + 28 + 20 = 60
        await expect(page.getByText('Total Chunks')).toBeVisible();
        // Chunk errors = 0 + 1 + 0 = 1
        await expect(page.getByText('Chunk Errors')).toBeVisible();
    });

    test('5. Compliance trend section renders with score cards', async ({ page }) => {
        await injectAuth(page, {
            plan: 'team_pro',
            batchHistory: MOCK_BATCH_HISTORY,
            complianceHistory: MOCK_COMPLIANCE_HISTORY,
            resolutionHistory: MOCK_RESOLUTION_HISTORY
        });
        await page.goto(TELEMETRY_URL);

        // The compliance section should be visible
        await expect(page.getByText('Historical Compliance Scores')).toBeVisible();

        // Avg overall = (82 + 87 + 92) / 3 = 87
        await expect(page.getByText('Avg Overall Score')).toBeVisible();
        await expect(page.getByText('87%')).toBeVisible();

        // EU AI Act avg = (72 + 78 + 85) / 3 = 78
        await expect(page.getByText('Avg EU AI Act')).toBeVisible();
        await expect(page.getByText('78%')).toBeVisible();
    });

    test('6. Issue resolution tracking renders with resolution rate', async ({ page }) => {
        await injectAuth(page, {
            plan: 'team_pro',
            batchHistory: MOCK_BATCH_HISTORY,
            complianceHistory: MOCK_COMPLIANCE_HISTORY,
            resolutionHistory: MOCK_RESOLUTION_HISTORY
        });
        await page.goto(TELEMETRY_URL);

        // The resolution section should be visible
        await expect(page.getByText('Issue Resolution Tracking')).toBeVisible();

        // Total new = 15 + 5 = 20
        await expect(page.getByText('Total New Issues')).toBeVisible();
        // Total resolved = 8 + 12 = 20, resolution rate = 20/20 = 100%
        await expect(page.getByText('Resolution Rate')).toBeVisible();
        await expect(page.getByText('100%')).toBeVisible();
    });

    test('7. Batch history table shows recent executions', async ({ page }) => {
        await injectAuth(page, {
            plan: 'team_pro',
            batchHistory: MOCK_BATCH_HISTORY,
            complianceHistory: MOCK_COMPLIANCE_HISTORY,
            resolutionHistory: MOCK_RESOLUTION_HISTORY
        });
        await page.goto(TELEMETRY_URL);

        // The batch history table should be visible
        await expect(page.getByText('Recent Batch Executions')).toBeVisible();
        // Table headers should be present
        await expect(page.getByText('Chunks', { exact: true })).toBeVisible();
        await expect(page.getByText('Batches', { exact: true })).toBeVisible();
        await expect(page.getByText('Duration', { exact: true })).toBeVisible();
    });

    test('8. Team Pro user with no telemetry data sees empty state', async ({ page }) => {
        await injectAuth(page, { plan: 'team_pro' });
        await page.goto(TELEMETRY_URL);

        // The empty state message should be visible
        await expect(page.getByText('No telemetry data yet')).toBeVisible();
        // The "Run First Scan" button should be present
        await expect(page.getByRole('button', { name: 'Run First Scan' })).toBeVisible();
    });
});
