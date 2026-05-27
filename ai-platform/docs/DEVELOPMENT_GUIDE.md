# Development Guide

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development setup:
   ```bash
   npm run dev:setup
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev:setup` - Run enhanced development setup
- `npm run dev:validate` - Validate code (lint, format, test)
- `npm run dev:fix` - Fix linting and formatting issues
- `npm run dev:watch` - Run tests in watch mode
- `npm run dev:coverage` - Generate test coverage report
- `npm run dev:clean` - Clean all generated files
- `npm run dev:build` - Build for production
- `npm run dev:deploy` - Deploy to production

## Code Quality

- ESLint: Run `npm run lint` to check code quality
- Prettier: Run `npm run format` to format code
- Jest: Run `npm test` to run tests
- Coverage: Run `npm run dev:coverage` for coverage report

## Git Hooks

Pre-commit hooks automatically run:
- ESLint
- Prettier
- Tests

## IDE Setup

Install recommended VSCode extensions:
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-python.python
```

## Troubleshooting

If you encounter issues:
1. Run `npm run dev:clean` to clean and reinstall
2. Check Node.js version (>=14.0.0 required)
3. Check Python version (>=3.7.0 required)
4. Verify all dependencies are installed