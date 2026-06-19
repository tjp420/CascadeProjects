# Contributing to SimpleBeacon

Thank you for your interest in contributing! This document outlines the process for submitting changes, reporting issues, and proposing features.

## How to Contribute

### Reporting Bugs

- Check existing issues to avoid duplicates.
- Open a new issue with a clear title and description.
- Include steps to reproduce, expected vs. actual behavior, and environment details.
- Attach relevant logs, screenshots, or minimal reproductions when possible.

### Suggesting Features

- Open a new issue with the `enhancement` label.
- Describe the use case and proposed solution.
- Discuss with maintainers before starting large changes.

### Pull Requests

1. Fork the repository and create a feature branch (`git checkout -b feature/my-change`).
2. Follow existing code style and conventions.
3. Add or update tests for new functionality.
4. Ensure `npm test` passes and `npm audit` is clean.
5. Update relevant documentation.
6. Open a pull request with a clear description referencing any related issues.

## Development Setup

```bash
npm install
npm test
```

## Code Style

- Use ESLint and Prettier configurations already in the repository.
- Prefer minimal, focused changes over large refactors.
- Keep commits atomic with clear messages.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
