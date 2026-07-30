'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isPublicRegistrationAllowed,
  registrationRequiresApproval
} = require('./registration-policy.cjs');

test('public registration is enabled by common truthy env values', () => {
  const original = process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION;
  try {
    process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION = '1';
    assert.equal(isPublicRegistrationAllowed(), true);

    process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION = 'YES';
    assert.equal(isPublicRegistrationAllowed(), true);
  } finally {
    if (original === undefined) {
      delete process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION;
    } else {
      process.env.SIMPLEBEACON_ALLOW_PUBLIC_REGISTRATION = original;
    }
  }
});

test('approval is skipped for common truthy auto-activate values', () => {
  const original = process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE;
  try {
    process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE = 'on';
    assert.equal(registrationRequiresApproval(), false);
  } finally {
    if (original === undefined) {
      delete process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE;
    } else {
      process.env.SIMPLEBEACON_REGISTRATION_AUTO_ACTIVATE = original;
    }
  }
});
