# Roadmap QA Bug Ticket Pack

Date: 2026-07-29
Target URL: https://simplebeacon.ai/roadmap
Build Context: Production site plus local source verification in coming-soon/public

---

## SB-ROADMAP-001
- Title: Sign in CTA routes to 404 endpoint
- Severity: High
- Area: Navigation/Auth
- Environment: Production
- Preconditions: Anonymous user on /roadmap
- Steps to Reproduce:
  1. Open https://simplebeacon.ai/roadmap.
  2. Click Sign in in the top navigation.
- Expected Result:
  - A valid sign-in experience opens (modal or live auth page).
- Actual Result:
  - Browser navigates to /dashboard/signin?returnTo=%2Froadmap and returns 404.
- Impact:
  - Blocks auth entry from a primary marketing page.
- Fix Hint:
  - Avoid hard-routing to non-existent /dashboard/signin from this page.
  - Open the existing sign-in modal flow directly as page-level fallback.
- Source/Implementation Status:
  - Fixed in workspace: roadmap sign-in now opens modal.

## SB-ROADMAP-002
- Title: Load Test Report action fails (404)
- Severity: High
- Area: Report Loader
- Environment: Production
- Preconditions: On /roadmap with no report loaded
- Steps to Reproduce:
  1. Click "Load Test Report".
- Expected Result:
  - A test report loads into the dashboard.
- Actual Result:
  - Status shows "Failed to load test-report.json: 404".
- Impact:
  - Demo/test flow is broken; users cannot evaluate the page quickly.
- Fix Hint:
  - Try multiple fixture paths and include an embedded fallback payload when hosted fixture is missing.
- Source/Implementation Status:
  - Fixed in workspace with multi-path fetch plus embedded fallback payload.

## SB-ROADMAP-003
- Title: Sign-in modal contains dead links
- Severity: Medium
- Area: Navigation/Auth Modal
- Environment: Production
- Preconditions: Sign-in modal visible
- Steps to Reproduce:
  1. Open sign-in modal.
  2. Click "View read-only demo".
  3. Click "About & install".
- Expected Result:
  - Both links resolve to valid pages.
- Actual Result:
  - /demo and /dashboard/about return 404.
- Impact:
  - Lowers trust and creates dead-end navigation in auth flow.
- Fix Hint:
  - Point to existing routes (for example /sample-report and /community).
- Source/Implementation Status:
  - Fixed in workspace by updating both links.

## SB-ROADMAP-004
- Title: Skip link targets hidden dashboard container instead of visible main content
- Severity: Medium
- Area: Accessibility/Keyboard Navigation
- Environment: Production
- Preconditions: Keyboard user on /roadmap
- Steps to Reproduce:
  1. Tab to "Skip to content".
  2. Activate it.
- Expected Result:
  - Focus jumps to visible primary content landmark.
- Actual Result:
  - Link points to #app, which is hidden before report load.
- Impact:
  - Keyboard and screen-reader users may land on hidden or non-useful target.
- Fix Hint:
  - Point skip link to visible main container and add explicit main landmark.
- Source/Implementation Status:
  - Fixed in workspace (#main-content + role=main).

## SB-ROADMAP-005
- Title: Form controls missing robust accessible naming in report input section
- Severity: Medium
- Area: Accessibility/Forms
- Environment: Production
- Preconditions: On /roadmap
- Steps to Reproduce:
  1. Inspect report URL input and JSON paste textarea accessibility tree.
- Expected Result:
  - Inputs expose reliable accessible names via explicit label association or aria-label.
- Actual Result:
  - Inputs rely on stylized labels/placeholders and were flagged as unnamed by automated heuristic checks.
- Impact:
  - Inconsistent AT labeling quality and reduced reliability across assistive tooling.
- Fix Hint:
  - Use explicit label for/id binding on report URL and JSON textarea; keep placeholders supplemental.
- Source/Implementation Status:
  - Fixed in workspace with explicit for/id label pairing.

## SB-SAMPLE-001
- Title: Runtime exception on /sample-report due to null DOM references
- Severity: High
- Area: Sample Report Runtime
- Environment: Production
- Preconditions: Visit /sample-report
- Steps to Reproduce:
  1. Open https://simplebeacon.ai/sample-report.
  2. Observe console/page errors.
- Expected Result:
  - Script completes without exceptions.
- Actual Result:
  - TypeError: Cannot set properties of null (setting 'textContent') in generateReport.
- Impact:
  - Runtime error on a primary linked page; can break rendering logic and trust.
- Fix Hint:
  - Guard optional DOM element lookups before text/style assignments.
- Source/Implementation Status:
  - Fixed in workspace with null-safe setters and guards.

## SB-ROADMAP-006
- Title: Embedded test-report fallback exposed latent exception (qs is not defined)
- Severity: High
- Area: Roadmap Generation
- Environment: Local source validation (would affect production once fallback is used)
- Preconditions: Load roadmap test report through fallback path
- Steps to Reproduce:
  1. Trigger fallback report load (fixture unavailable).
  2. Observe status/error toast.
- Expected Result:
  - Roadmap renders from fallback report.
- Actual Result:
  - Error: qs is not defined.
- Impact:
  - Prevents report rendering for fallback scenarios.
- Fix Hint:
  - Initialize qs from qualityScore in generateRoadmap.
- Source/Implementation Status:
  - Fixed in workspace across JS and ES2018 roadmap bundles.

---

## Non-Functional Audit Notes (Roadmap)
- Performance (cold-load surrogate):
  - TTFB: ~218ms
  - FCP: ~548ms
  - LCP: ~584ms
  - CLS: 0.000
  - Resource count: 7
- Accessibility:
  - Landmarks present (nav, main, footer)
  - Heading structure still jumps h1 -> h3 (advisory, low severity)
  - Skip-link target corrected in workspace
  - Form label semantics improved in workspace

---

## Deployment Note
All source fixes were applied locally in coming-soon files. Production behavior at https://simplebeacon.ai/roadmap will not change until deployment.