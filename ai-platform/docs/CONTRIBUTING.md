# Contributing to Simplebeacon

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment: `cp .env.v1-internal.example .env.v1-internal`
4. Start infrastructure: `docker compose -f docker-compose.phase2.yml up -d`
5. Run tests: `npm test`

## Development Workflow

1. Create a feature branch
2. Make changes with tests
3. Run full test suite: `npm run test:coverage`
4. Submit PR with description

## Code Standards

- Use CommonJS (.cjs) for backend code
- Use ES modules (.js) for frontend code
- Follow existing code style
- Add tests for new features
- Update documentation

## Testing

```bash
# Unit tests
npm test

# Coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## Commit Messages

Follow conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `refactor:` code change
- `security:` security fix
