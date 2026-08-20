Deploying the updated website (coming-soon)

This file describes how to deploy the website changes that include the updated VSIX download and release notes.

Repository paths of interest
- Website source: ai-platform/web/simplebeacon-dashboard/  (dev server used in E2E)
- Public website downloads path: coming-soon/public/downloads/simplebeacon.vsix
- Release notes / checksum: RELEASE.md at repo root

Common hosting targets and deploy steps

1) GitHub Pages (if the site is published from the repository)
- Build (if applicable): run any build step from the website package root.
  Example (if the site uses a static build):
    cd coming-soon
    npm ci
    npm run build
- Publish build output to gh-pages branch (example using gh-pages package):
    npm install --no-save gh-pages
    npx gh-pages -d build -b gh-pages
- Confirm gh-pages branch updated and site served at the Pages URL.

2) Netlify / Vercel
- Build locally or let provider build on push. Ensure the deploy output directory matches the provider settings (e.g., build -> build/).
- Push the site changes to the branch connected to the Netlify/Vercel site. The provider will build and deploy.
- Verify the deploy by visiting the site and checking the downloads page link to the new VSIX.

3) Manual upload to blob storage (S3 / R2 / other static host)
- Build the site locally (if required), then sync the static output to the bucket.
- Copy the VSIX to the downloads bucket/path and make sure it is publicly accessible.
- Update any CDN invalidation if needed.

Post-deploy checklist
- Confirm the downloads page link points to the new VSIX and that the SHA256 in RELEASE.md matches the downloaded file.
- Smoke test the VSIX download and local install.
- If the site uses a backend/API (ai-platform), ensure any environment variables required on the production server are present.

If you want, I can:
- Create a small GitHub Actions workflow that builds the site and deploys to gh-pages or uploads artifacts to the hosting provider (requires provider credentials/secrets).
- Or perform a manual deploy if you provide the necessary credentials.
