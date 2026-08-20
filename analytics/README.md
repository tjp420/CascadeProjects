# SimpleBeacon Analytics QA Testing

## Overview
This directory contains QA tools and documentation for testing and validating SimpleBeacon analytics event emission during the launch phase.

## Files

### test-events.js
A lightweight Node.js script that emits synthetic analytics events for local testing and validation.

**Features:**
- No external API keys or credentials required
- Synthetic data only - no real analytics data transmitted
- Multiple execution modes
- JSON payload validation
- PII hashing simulation (SHA-256)

### Running the Script

#### Default: Emit all test events
```bash
node analytics/test-events.js
```

#### Verbose mode: Show full JSON payloads
```bash
node analytics/test-events.js --verbose
```

#### Emit a single event
```bash
node analytics/test-events.js --event=signup_started
```

#### With debug output
```bash
ANALYTICS_DEBUG=true node analytics/test-events.js
```

#### Custom session ID
```bash
SESSION_ID=sess_custom123 node analytics/test-events.js
```

## Environment Variables

All environment variables are optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANALYTICS_ENDPOINT` | (none) | Analytics endpoint URL (optional, logs locally by default) |
| `ANALYTICS_DEBUG` | false | Enable verbose logging (same as --verbose flag) |
| `SESSION_ID` | auto-generated | Override default session ID for testing |

## Validation

The script validates:
- **Event Names:** Follow snake_case convention
- **Properties:** All required properties present
- **JSON Structure:** All payloads are valid JSON
- **Naming Conventions:** Session IDs, User IDs, etc. follow prefixes (sess_, usr_, sub_)
- **Timestamps:** ISO-8601 format
- **PII Hashing:** Sensitive data hashed with SHA-256 prefix

## Example Output

```
SimpleBeacon Analytics QA Test Suite
Session ID: sess_a1b2c3d4e5f6g7h8i9
User ID: usr_x9y8z7w6v5u4t3s2r1

✓ page_view
✓ signup_started
✓ signup_completed
✓ onboarding_step
✓ onboarding_step
✓ trial_started
✓ feature_use_api_access
✓ feature_use_custom_rules
✓ feature_use_export_report
✓ subscription_created
✓ demo_requested
✓ contact_submitted
✓ checkout_failed

✓ All test events emitted successfully
```

## Verbose Output Example

```
======================================================================
✓ Event: signup_completed
======================================================================
{
  "event": "signup_completed",
  "properties": {
    "session_id": "sess_a1b2c3d4e5f6g7h8i9",
    "timestamp": "2026-08-19T21:33:12.021Z",
    "user_id": "usr_5e7d9c1a2b4f6g8h3i",
    "email": "sha256_9f8a3c2b1e4d5f6g",
    "signup_method": "email",
    "account_type": "trial"
  }
}
------================================================================
```

## Integration Notes

1. **Development Testing:** Use this script to validate your analytics event emission code
2. **CI/CD:** Can be integrated into test pipelines with `node -c` syntax validation
3. **Local Development:** Run before commits to verify event structure
4. **GA4/Segment Mapping:** Refer to the analytics-events.md for mapping details

## Notes

- This script does NOT transmit real analytics data
- All identifiers are synthetically generated
- PII is hashed (simulated) for privacy
- JSON structure is validated before output
- Perfect for local development and QA testing

## Version

**v1.0** - 2026-08-19
Initial QA test script release
