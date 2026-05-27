# Signed-off upload bundle

This bundle is generated from the current repository state.

## What is included

- Landing/marketing files from `coming-soon/` (kept intact).
- Dashboard assets from `ai-platform/web/simplebeacon-dashboard/`.
- A dashboard entry page at `/signin/index.html`.

## Expected behavior

- `/` serves your current coming-soon landing.
- `/signin/` serves the signed-off dashboard copy.
- In `/signin/`, payment actions are intentionally disabled and appear grayed out.

## Upload notes

- Upload this folder as the website root.
- Ensure the host serves static files for nested paths (including `/simplebeacon-dashboard/*` and `/signin/*`).
