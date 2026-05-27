# Legitimate Patterns Documentation

This document outlines patterns that are intentionally preserved in the codebase and should not be flagged as mock data.

## UI Placeholders (Preserved)

### Purpose
Standard HTML input placeholders that provide user guidance and improve user experience.

### Examples
- "Enter your math problem here..."
- "Enter your question for the oracle system..."
- "Search..."
- "Email address"
- "Password"

### Files
- `src/javascript/AIServices.tsx` (lines 340, 402)
- `src/javascript/app_1_2.js` (lines 239, 244)
- `src/javascript/auth.ts` (line 16)

### Rationale
- Essential for user experience
- Standard web development practice
- Not mock data - they are UI elements
- Dynamic placeholders from field configurations

## Development Comments (Preserved)

### Purpose
Standard development documentation indicating future work or implementation notes.

### Types
- **TODO comments:** Future implementation tasks
- **NOTE comments:** Implementation guidance or reminders
- **FIXME comments:** Areas needing future improvement
- **DEBUG comments:** Development debugging aids

### Examples
- "NOTE: Implement settings modal"
- "TODO: Add error handling"
- "FIXME: Optimize this function"
- "DEBUG: console.log removed"

### Files
- `src/javascript/app_1_2.js` (5 NOTE comments)
- `src/javascript/basic-analyzer_external.js` (5 TODO comments)

### Rationale
- Standard industry practice
- Essential for code maintenance
- Not mock data - they are documentation
- Help developers understand implementation status

## Test Data (Preserved)

### Purpose
Legitimate test data used for automated testing.

### Patterns
- Generic test emails: `test@local`
- Generic test usernames: `test`, `invalid`
- Generic test passwords: `test`, `invalid`
- Environment variable fallbacks

### Files
- `src/javascript/auth.test.ts`
- `tests/integration/api-flows.test.js`
- `tests/unit/api/api-security.test.js`
- `web/__tests__/Authentication.test.js`

### Rationale
- Essential for automated testing
- Tests must run without environment variables
- Generic patterns reduce false positives
- Follow testing best practices

## Framework Code (Preserved)

### Purpose
Third-party framework and library code that should not be modified.

### Examples
- Next.js internal code
- Webpack bundle files
- Node modules
- Build artifacts

### Files
- `src/javascript/app-pages-internals.js`
- `node_modules/`
- `dist/`
- `build/`

### Rationale
- Third-party code should not be modified
- Automatically generated files
- Not part of application logic
- Modifying may break framework functionality

## Local Development Patterns (Preserved)

### Purpose
Standard local development configurations.

### Patterns
- `localhost`
- `127.0.0.1`
- `@local` domains
- Local service names

### Rationale
- Essential for local development
- Standard development practice
- Not used in production
- Environment variables override these in production

## Scanner Configuration

The `.mockscannerignore` file excludes these legitimate patterns from detection:

### Excluded Directories
- `node_modules/` - Third-party dependencies
- `tests/` - Test files with legitimate test data
- `__tests__/` - Test files with legitimate test data
- `dist/`, `build/` - Build artifacts

### Excluded Patterns
- UI placeholder text patterns
- Development comment patterns (TODO, NOTE, etc.)
- Framework code files
- Local development domains

## Maintenance

When adding new patterns to this list:
1. Ensure they serve a legitimate purpose
2. Document the rationale clearly
3. Update the `.mockscannerignore` file
4. Keep this documentation synchronized

## Review Process

Quarterly review of:
1. New patterns added to legitimate list
2. Patterns that can be removed from legitimate list
3. Scanner configuration effectiveness
4. False positive/negative rates