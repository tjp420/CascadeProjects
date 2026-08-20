SimpleBeacon VS Code Extension — Release Notes & Publish Instructions

Release artifact
- VSIX: simplebeacon-vscode-3.0.498.vsix
- Location (in repo working tree): simplebeacon-vscode-merged/simplebeacon-vscode-3.0.498.vsix
- SHA256 (hex): EDE24505B5B8E09C52823F760E1D13A01C62C19A03467FFEC9739254B3F26722

Publish to Visual Studio Marketplace (manual)

Requirements
- A Personal Access Token (PAT) for the VS Code Marketplace publisher (publisher name and token). Store the PAT in a secure place; do not commit it.
- Node.js & npm installed locally (to use vsce or microsoft/vs marketplace publisher tooling).

Manual publish steps (using vsce)
1. Install vsce (if not installed):
   npm install -g vsce

2. Verify the VSIX file and checksum locally:
   # on Windows PowerShell
   Get-FileHash -Path simplebeacon-vscode-merged\simplebeacon-vscode-3.0.498.vsix -Algorithm SHA256
   # Confirm the hex matches the SHA256 above.

3. Publish (interactive) using vsce:
   # vsce will prompt for publisher ID and PAT if not set in env
   vsce publish --packagePath simplebeacon-vscode-merged\simplebeacon-vscode-3.0.498.vsix

4. Or publish using the vs marketplace publisher (azured CLI style) with env var:
   setx VSCODE_MARKETPLACE_PAT "<YOUR_PAT>"
   vsce publish --packagePath simplebeacon-vscode-merged\simplebeacon-vscode-3.0.498.vsix

Automated publish (GitHub Actions)
- A workflow can publish on tag or release events by setting a repository secret like VSCODE_MARKETPLACE_PAT. Example uses "vsce package/publish" or the official microsoft/azure-devops extensions.
- I can prepare a GitHub Actions workflow that publishes on creation of a GitHub Release or a semver tag; it will require you to add the PAT as a repository secret (name: VSCODE_MARKETPLACE_PAT).

Post-publish verification
- After publishing, install the extension from the Marketplace and confirm the extension version matches 3.0.498 and activates correctly.
- Verify the downloaded VSIX matches the SHA256 published here.

Notes & safety
- The PAT is sensitive. Do not paste it in PRs or issue comments. If you want me to publish automatically, provide the PAT securely (add as repository secret) or perform the final publish step locally.

If you want, I can:
- Prepare a GitHub Actions workflow that publishes on a new Release and uses a repository secret for the PAT (I will not add the secret). 
- Or prepare a short checklist of exact commands for you to run locally to publish (safer if you prefer to keep the PAT local).
