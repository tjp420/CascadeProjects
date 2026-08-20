# AI Slop Cop - Configuration Guide

## Overview

AI Slop Cop can be configured through VSCode settings, command-line arguments, or configuration files.

## VSCode Settings

### Accessing Settings

1. Open VSCode Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "simplebeacon"
3. Configure individual settings

### Available Settings

#### simplebeacon.scanLocation

**Type:** String  
**Default:** "" (empty)  
**Description:** Custom scan location (absolute path). Leave empty to scan current workspace.

**Example:**

```json
{
  "simplebeacon.scanLocation": "/path/to/project"
}
```

#### simplebeacon.fullScan

**Type:** Boolean  
**Default:** false  
**Description:** Enable full directory scan (scans all files, not just source code). Slower but more comprehensive.

**Example:**

```json
{
  "simplebeacon.fullScan": true
}
```

#### simplebeacon.licenseToken

**Type:** String  
**Default:** "" (empty)  
**Description:** Your Pro/Enterprise license token. Required for Pro/Enterprise features.

**Example:**

```json
{
  "simplebeacon.licenseToken": "your-license-token-here"
}
```

#### simplebeacon.exclusions

**Type:** Array of strings  
**Default:**

```json
[
  "**/node_modules/**",
  "**/*.test.js",
  "**/*.spec.ts",
  "**/dist/**",
  "**/build/**"
]
```

**Description:** Glob patterns for files to exclude from scans.

**Example:**

```json
{
  "simplebeacon.exclusions": [
    "**/node_modules/**",
    "**/*.test.js",
    "**/dist/**",
    "**/generated/**",
    "**/vendor/**"
  ]
}
```

#### simplebeacon.severityOverrides

**Type:** Object  
**Default:** {}  
**Description:** Override rule severities by rule ID.

**Example:**

```json
{
  "simplebeacon.severityOverrides": {
    "debug-artifact": "info",
    "credential-leak": "error",
    "ai-residue-stub": "warning"
  }
}
```

**Available severities:** "error", "warning", "info"

## CLI Configuration

### Configuration File

Create `.simplebeacon/config.json` in your project root:

```json
{
  "profile": "standard",
  "scanPaths": ["web/data"],
  "productionPaths": ["server/", "src/"],
  "sampleDir": "web/data",
  "ignore": ["node_modules/**", "coverage/**", "dist/**", "build/**"],
  "rules": {
    "credentials": {
      "enabled": true,
      "scanProduction": true
    },
    "production-leak": {
      "enabled": true,
      "severity": "high"
    },
    "fiction-kpi-patterns": {
      "enabled": true,
      "severity": "medium"
    }
  },
  "gate": {
    "failOn": ["high"],
    "warnOn": ["medium", "low"]
  }
}
```

### Configuration Options

#### profile

**Values:** "minimal", "standard", "eu-ai-act", "cascade"  
**Default:** "standard"  
**Description:** Pre-configured rule profiles.

#### scanPaths

**Type:** Array of strings  
**Description:** Directories to scan for mock/sample data.

#### productionPaths

**Type:** Array of strings  
**Description:** Directories considered production code.

#### sampleDir

**Type:** String  
**Description:** Directory containing sample JSON files.

#### ignore

**Type:** Array of strings  
**Description:** Glob patterns to ignore during scanning.

#### rules

**Type:** Object  
**Description:** Individual rule configurations.

#### gate

**Type:** Object  
**Description:** Gate evaluation settings.

## Rule Configuration

### Enabling/Disabling Rules

In `.simplebeacon/config.json`:

```json
{
  "rules": {
    "credentials": {
      "enabled": true
    },
    "fiction-kpi-patterns": {
      "enabled": false
    }
  }
}
```

### Rule Severity

```json
{
  "rules": {
    "production-leak": {
      "enabled": true,
      "severity": "high"
    },
    "debug-artifact": {
      "enabled": true,
      "severity": "medium"
    }
  }
}
```

**Available severities:** "high", "medium", "low"

### Rule-Specific Options

Some rules have additional options:

```json
{
  "rules": {
    "llm-slop-patterns": {
      "enabled": true,
      "severity": "medium",
      "registryCheck": false
    },
    "production-leak": {
      "enabled": true,
      "severity": "high",
      "plainSampleJson": true,
      "intentClassification": true,
      "allowlistFiles": ["server/lib/sample-resolver.js"]
    }
  }
}
```

## Gate Configuration

### Gate Thresholds

```json
{
  "gate": {
    "failOn": ["high"],
    "warnOn": ["medium", "low"]
  }
}
```

- **failOn:** Severities that cause gate to fail
- **warnOn:** Severities that show warnings but don't fail

### Custom Thresholds

```json
{
  "gate": {
    "failOn": ["high", "medium"],
    "warnOn": ["low"],
    "errorThreshold": 5,
    "warningThreshold": 20
  }
}
```

## CLI Command-Line Options

### Basic Scan

```bash
npx simplebeacon scan
```

### Gate Scan

```bash
npx simplebeacon scan --gate
```

### Full Directory Scan

```bash
npx simplebeacon scan --full --gate
```

### Custom Configuration

```bash
npx simplebeacon scan --config .simplebeacon/config.json
```

### Custom Output Format

```bash
npx simplebeacon scan --format json --output report.json
```

### Custom Scan Location

```bash
npx simplebeacon scan /path/to/project
```

### Offline Mode

```bash
npx simplebeacon scan --offline
```

## Environment Variables

### SIMPLEBEACON_LICENSE_TOKEN

Set your license token via environment variable:

```bash
export SIMPLEBEACON_LICENSE_TOKEN="your-token-here"
npx simplebeacon scan --gate
```

### SIMPLEBEACON_CONFIG_PATH

Specify custom config path:

```bash
export SIMPLEBEACON_CONFIG_PATH="/path/to/config.json"
npx simplebeacon scan
```

## Workspace Settings vs User Settings

### Workspace Settings

Applied to current workspace only:

- Stored in `.vscode/settings.json`
- Shared with team via git
- Override user settings

### User Settings

Applied globally to all workspaces:

- Stored in VSCode user settings
- Not shared with team
- Default fallback

## Example Configurations

### Minimal Configuration

```json
{
  "simplebeacon.fullScan": false,
  "simplebeacon.exclusions": ["**/node_modules/**", "**/dist/**"]
}
```

### Strict Configuration

```json
{
  "simplebeacon.fullScan": true,
  "simplebeacon.licenseToken": "your-token",
  "simplebeacon.severityOverrides": {
    "debug-artifact": "error",
    "credential-leak": "error"
  },
  "simplebeacon.exclusions": ["**/node_modules/**", "**/dist/**", "**/build/**"]
}
```

### CI/CD Configuration

```json
{
  "profile": "standard",
  "scanPaths": ["."],
  "productionPaths": ["src/", "lib/"],
  "gate": {
    "failOn": ["high", "medium"],
    "warnOn": ["low"]
  }
}
```

## Troubleshooting

### Settings Not Applying

**Problem:** Configuration changes not taking effect

**Solution:**

1. Reload VSCode window (`Ctrl+Shift+P` → "Reload Window")
2. Check for syntax errors in JSON
3. Verify settings file location
4. Check for conflicting extensions

### CLI Config Not Loading

**Problem:** CLI not using custom config

**Solution:**

1. Verify config file path is correct
2. Check JSON syntax
3. Use `--config` flag explicitly
4. Check file permissions

### Gate Always Failing

**Problem:** Gate fails even with no issues

**Solution:**

1. Check gate thresholds
2. Verify rule severities
3. Review severity overrides
4. Check for hidden files being scanned

## Best Practices

1. **Use workspace settings** for team configurations
2. **Commit `.simplebeacon/config.json`** for consistent CI/CD
3. **Exclude generated files** to reduce false positives
4. **Adjust severity** based on project requirements
5. **Use profiles** for quick configuration
6. **Test gate configuration** before CI/CD integration

## Next Steps

- Read the [User Guide](user-guide.md)
- Review the [Rule Catalog](rule-catalog.md)
- Set up CI/CD integration
- Configure custom rules for your project
