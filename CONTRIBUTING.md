# Contributing to CascadeProjects

Thank you for your interest in contributing to CascadeProjects! This document provides a high-level overview of how to contribute. For detailed development guidelines, please see [web/CONTRIBUTING.md](web/CONTRIBUTING.md).

## Quick Start

### Prerequisites
- Node.js 16 or higher
- Python 3.9 or higher (for API server)
- Git

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd CascadeProjects
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the development server:
```bash
cd web
npm run serve
```

## Project Structure

```
CascadeProjects/
├── web/                    # Main web dashboard application
│   ├── dashboard.html      # Dashboard UI
│   ├── dashboard_components/  # JavaScript components
│   ├── css/               # Stylesheets
│   ├── api/               # Python API server
│   └── tests/             # Test files
├── src/                   # Python source code
├── tests/                 # Python test files
├── tools/                 # Utility scripts
├── docs/                  # Documentation
├── config/                # Configuration files
└── scripts/               # Build/deployment scripts
```

## Development Workflow

### Code Quality

This project uses ESLint and Prettier for code quality:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Pre-commit Hooks

The project uses Husky and lint-staged to automatically check code quality before commits:

- Pre-commit: Runs linting and formatting
- Pre-push: Runs full test suite and build validation

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `API_HOST` - API server host (default: localhost)
- `API_PORT` - API server port (default: 8081)
- `NODE_ENV` - Environment (development/production)
- `ENABLE_AI_ANALYSIS` - Enable AI features (default: true)

### ESLint Configuration

ESLint is configured via `.eslintrc.json` at the root. It includes:
- JavaScript/ES6 support
- Import ordering rules
- Promise handling rules
- Prettier integration

### Prettier Configuration

Prettier is configured via `.prettierrc.json` at the root. It includes:
- 100 character line width
- 2-space indentation
- Single quotes
- Trailing commas (ES5)

## Contribution Guidelines

### Commit Messages

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance tasks

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Commit with conventional commit message
5. Push and create a Pull Request
6. Address review feedback

### Code Review

- Ensure all tests pass
- Follow code style guidelines
- Update documentation as needed
- Request review from maintainers

## Getting Help

- See [web/CONTRIBUTING.md](web/CONTRIBUTING.md) for detailed development guide
- Check existing issues on GitHub
- Contact maintainers for support

## License

See LICENSE file for details.
