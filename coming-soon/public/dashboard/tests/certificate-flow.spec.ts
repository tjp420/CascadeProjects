import { test, expect } from '@playwright/test';

test('CertificateModal accessibility and generate flow (visibility + escape)', async ({ page }) => {
  // simulate executive clearance and a local user so the Generate button is shown
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sb_executive_clearance', '1');
      localStorage.setItem('sb_user', JSON.stringify({ email: 'dev@local', plan: 'executive_clearance' }));
    } catch {}
  });

  // Try common preview bases: default vite port and the project's preview base
  const candidates = ['http://localhost:5173/', 'http://localhost:4173/dashboard/'];
  let opened = false;
  for (const url of candidates) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3000 });
      if (resp && resp.ok()) {
        opened = true;
        break;
      }
    } catch {
      // try next
    }
  }
  if (!opened) {
    // final try without checking response to surface helpful error
    await page.goto(candidates[candidates.length - 1]);
  }

  // Wait for the Generate / Download Certificate button to appear and click it
  const genTrigger = page.getByRole('button', { name: /Generate \/ Download Certificate/i });
  await expect(genTrigger).toBeVisible({ timeout: 10_000 });
  await genTrigger.click();

  // Dialog should be present
  const dialog = page.getByRole('dialog', { name: /Certificate generation dialog/i });
  await expect(dialog).toBeVisible();

  // Generate button inside dialog should exist
  const generateButton = dialog.getByRole('button', { name: /^Generate$/i });
  await expect(generateButton).toBeVisible();

  // Click Generate and assert that the UI shows a pending state
  await generateButton.click();
  await expect(dialog.getByText(/Generating…/i)).toBeVisible();

  // Close with Escape and ensure dialog is removed
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
