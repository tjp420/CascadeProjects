Release Guidelines — Semantic Versioning for SimpleBeacon

Overview
- This project uses semantic versioning tags `vMAJOR.MINOR.PATCH` generated automatically by the release-tagger workflow on merges to `main`.

Commit Message Markers
- Use `feat:` or `feature:` in the merge commit to request a MINOR version bump.
- Use `breaking:` or `MAJOR:` in the merge commit to request a MAJOR version bump.
- Default behavior: any other changes increment the PATCH version.

Practices
- Keep PRs small and add a short scope marker in the PR merge commit message when the change is a feature or breaking change.
- Release notes are auto-generated; include human-friendly summaries in PR descriptions to make the generated release notes useful.

If you need a manual override
- For exceptional cases, maintainers can create a tag manually and push it to `main` before or after a merge.
