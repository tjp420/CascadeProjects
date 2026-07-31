# Secrets Provisioning Matrix

This document lists the secrets and minimal permission scopes required to operate the SimpleBeacon CI/CD release pipelines.

## Required Secrets

- `NPM_TOKEN` — npm publish token (scope: `publish` for the specific package or organization). If your registry enforces 2FA, either add a token with `bypass-2fa` or provide `otp` at dispatch.
- `GPG_PRIVATE_KEY` — Base64-armored secret key used to make detached signatures for release artifacts. Store as a single-line base64 value.
- `GPG_PASSPHRASE` — Passphrase for the GPG key (if applicable).
- `GPG_KEY_ID` — Optional GPG key id used by the signing script.
- `VSCODE_PUBLISHER_PAT` — Personal Access Token for the Visual Studio Marketplace publisher with `Manage` and `Publish` rights.
- `VSCE_TOKEN` — Optional alternate token for `vsce` publishing workflow.

## Recommended Minimal GitHub Environments

- `production` — Protected environment used to gate the `publish` jobs. Configure environment rules to require an approval from a single user or team (AppSec or Release Manager).

## How to Add Secrets

1. In your repository, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret**.
3. Add each secret name and value from the list above.

## Notes

- Keep your `GPG_PRIVATE_KEY` offline and only inject it into CI as a base64 string.
- Rotate `NPM_TOKEN` periodically and remove publish rights from unused users.
- Use environment protection rules to require at least one human approver for `production` environment deployments.
