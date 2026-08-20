#!/usr/bin/env node
/**
 * SimpleBeacon Analytics QA Test Script
 * Emits sample analytics events locally for testing and validation
 * 
 * Usage:
 *   node analytics/test-events.js
 *   node analytics/test-events.js --verbose
 *   node analytics/test-events.js --event signup_started
 * 
 * Environment Variables (optional):
 *   ANALYTICS_ENDPOINT  - Analytics endpoint URL (default: none, logs locally)
 *   ANALYTICS_DEBUG     - Enable verbose logging (default: false)
 *   SESSION_ID          - Override default session ID (default: generated)
 * 
 * No external API keys required - all events are synthetic and not transmitted
 */

const crypto = require('crypto');

/**
 * Configuration
 */
const CONFIG = {
  verbose: process.argv.includes('--verbose') || process.env.ANALYTICS_DEBUG === 'true',
  sessionId: process.env.SESSION_ID || `sess_${generateId(16)}`,
  userId: `usr_${generateId(16)}`,
  subscriptionId: `sub_${generateId(16)}`,
  endpoint: process.env.ANALYTICS_ENDPOINT || null, // null = log only, no transmission
};

/**
 * Generate a random alphanumeric ID segment
 * @param {number} length - Length of ID to generate
 * @returns {string}
 */
function generateId(length) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Hash a value (simulated SHA-256 for PII)
 * @param {string} value - Value to hash
 * @returns {string}
 */
function hashPii(value) {
  return `sha256_${crypto.createHash('sha256').update(value).digest('hex').substring(0, 16)}`;
}

/**
 * Log an event with formatting
 * @param {Object} event - The event object
 */
function logEvent(event) {
  const timestamp = new Date().toISOString();
  
  if (CONFIG.verbose) {
    console.log('\n' + '='.repeat(70));
    console.log(`✓ Event: ${event.event}`);
    console.log('='.repeat(70));
    console.log(JSON.stringify(event, null, 2));
    console.log('-'.repeat(70));
  } else {
    console.log(`✓ ${event.event}`);
  }
}

/**
 * Emit an analytics event
 * @param {Object} eventData - Event data to emit
 */
function emitEvent(eventData) {
  const event = {
    event: eventData.event,
    properties: {
      session_id: CONFIG.sessionId,
      timestamp: new Date().toISOString(),
      ...eventData.properties,
    },
  };

  // Validate JSON structure
  try {
    JSON.stringify(event);
  } catch (error) {
    console.error(`✗ Invalid JSON for event ${event.event}: ${error.message}`);
    process.exit(1);
  }

  logEvent(event);

  // Note: In production, this would send to analytics endpoint
  // For QA purposes, we only log to console
  if (CONFIG.endpoint) {
    console.log(`  (Would transmit to: ${CONFIG.endpoint})`);
  }
}

/**
 * Emit all test events
 */
function emitAllEvents() {
  console.log('\nSimpleBeacon Analytics QA Test Suite');
  console.log(`Session ID: ${CONFIG.sessionId}`);
  console.log(`User ID: ${CONFIG.userId}\n`);

  // 1. page_view
  emitEvent({
    event: 'page_view',
    properties: {
      page_path: '/dashboard',
      page_title: 'SimpleBeacon Dashboard',
      referrer: 'https://google.com',
    },
  });

  // 2. signup_started
  emitEvent({
    event: 'signup_started',
    properties: {
      signup_method: 'email',
    },
  });

  // 3. signup_completed
  emitEvent({
    event: 'signup_completed',
    properties: {
      user_id: CONFIG.userId,
      email: hashPii('user@example.com'),
      signup_method: 'email',
      account_type: 'trial',
    },
  });

  // 4. onboarding_step
  emitEvent({
    event: 'onboarding_step',
    properties: {
      step_name: 'configure_first_scan',
      step_number: 1,
      total_steps: 5,
      completed: true,
      user_id: CONFIG.userId,
    },
  });

  // 5. onboarding_step (step 2)
  emitEvent({
    event: 'onboarding_step',
    properties: {
      step_name: 'select_scanning_targets',
      step_number: 2,
      total_steps: 5,
      completed: true,
      user_id: CONFIG.userId,
    },
  });

  // 6. trial_started
  emitEvent({
    event: 'trial_started',
    properties: {
      user_id: CONFIG.userId,
      trial_duration_days: 14,
      trial_end_date: '2026-09-02',
      features_enabled: ['advanced_scanning', 'custom_rules', 'api_access'],
    },
  });

  // 7. feature_use_api_access
  emitEvent({
    event: 'feature_use_api_access',
    properties: {
      user_id: CONFIG.userId,
      feature_name: 'api_access',
      feature_category: 'integration',
      duration_ms: 5230,
      result_status: 'success',
    },
  });

  // 8. feature_use_custom_rules
  emitEvent({
    event: 'feature_use_custom_rules',
    properties: {
      user_id: CONFIG.userId,
      feature_name: 'custom_rules',
      feature_category: 'scanning',
      duration_ms: 8450,
      result_status: 'success',
    },
  });

  // 9. feature_use_export_report
  emitEvent({
    event: 'feature_use_export_report',
    properties: {
      user_id: CONFIG.userId,
      feature_name: 'export_report',
      feature_category: 'reporting',
      duration_ms: 2100,
      result_status: 'success',
    },
  });

  // 10. subscription_created
  emitEvent({
    event: 'subscription_created',
    properties: {
      user_id: CONFIG.userId,
      subscription_id: CONFIG.subscriptionId,
      plan_name: 'Professional Monthly',
      plan_tier: 'professional',
      amount: 9900,
      currency: 'USD',
      billing_cycle: 'monthly',
    },
  });

  // 11. demo_requested
  emitEvent({
    event: 'demo_requested',
    properties: {
      user_id: CONFIG.userId,
      email: hashPii('contact@example.com'),
      company_size: '100-500',
      use_case: 'vulnerability_scanning',
      preferred_datetime: '2026-08-25T14:00:00Z',
    },
  });

  // 12. contact_submitted
  emitEvent({
    event: 'contact_submitted',
    properties: {
      user_id: CONFIG.userId,
      email: hashPii('support@example.com'),
      contact_type: 'support',
      subject: 'hash_of_subject_line',
      message_length: 256,
    },
  });

  // 13. checkout_failed (optional error scenario)
  emitEvent({
    event: 'checkout_failed',
    properties: {
      user_id: CONFIG.userId,
      plan_tier: 'professional',
      amount: 9900,
      error_code: 'card_declined',
      error_message: 'Card was declined',
      retry_eligible: true,
    },
  });

  console.log('\n✓ All test events emitted successfully\n');
}

/**
 * Emit a single event by name
 * @param {string} eventName - Name of event to emit
 */
function emitSingleEvent(eventName) {
  const eventMap = {
    'page_view': () => emitEvent({
      event: 'page_view',
      properties: {
        page_path: '/dashboard',
        page_title: 'SimpleBeacon Dashboard',
      },
    }),
    'signup_started': () => emitEvent({
      event: 'signup_started',
      properties: {
        signup_method: 'email',
      },
    }),
    'signup_completed': () => emitEvent({
      event: 'signup_completed',
      properties: {
        user_id: CONFIG.userId,
        email: hashPii('user@example.com'),
        signup_method: 'email',
        account_type: 'trial',
      },
    }),
    'trial_started': () => emitEvent({
      event: 'trial_started',
      properties: {
        user_id: CONFIG.userId,
        trial_duration_days: 14,
        trial_end_date: '2026-09-02',
        features_enabled: ['advanced_scanning'],
      },
    }),
    'subscription_created': () => emitEvent({
      event: 'subscription_created',
      properties: {
        user_id: CONFIG.userId,
        subscription_id: CONFIG.subscriptionId,
        plan_name: 'Professional Monthly',
        plan_tier: 'professional',
        amount: 9900,
        currency: 'USD',
        billing_cycle: 'monthly',
      },
    }),
  };

  if (eventMap[eventName]) {
    console.log(`\nSimpleBeacon Analytics QA - Single Event Test`);
    console.log(`Event: ${eventName}\n`);
    eventMap[eventName]();
  } else {
    console.error(`Unknown event: ${eventName}`);
    console.error(`Available events: ${Object.keys(eventMap).join(', ')}`);
    process.exit(1);
  }
}

/**
 * Main execution
 */
function main() {
  const singleEventArg = process.argv.find(arg => arg.startsWith('--event='));
  
  if (singleEventArg) {
    const eventName = singleEventArg.split('=')[1];
    emitSingleEvent(eventName);
  } else {
    emitAllEvents();
  }
}

// Execute
main();
