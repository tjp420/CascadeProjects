/**
 * Token chain store and utils tests
 */

const assert = require('assert');
const path = require('path');

// Point DB to a test database
process.env.SIMPLEBEACON_TEST_DB = 'token-chain-test.db';

const {
  hashToken,
  createTokenChain,
  getTokenNode,
  getChain,
  activateToken,
  revokeToken,
  getChainStatus
} = require('../lib/token-chain-store.cjs');
const {
  validateChainToken,
  ensureTokenActive,
  getRemainingMinutes
} = require('../lib/token-chain-utils.cjs');

// Clean up test DB before run
const dbPath = path.join(__dirname, '..', '.simplebeacon', process.env.SIMPLEBEACON_TEST_DB);
const fs = require('fs');
try { fs.unlinkSync(dbPath); } catch { /* ignore */ }

console.log('Running token chain tests...\n');

// --- Test 1: Create a chain ---
const ownerJwt = 'jwt_owner_test_' + Date.now();
const attached1Jwt = 'jwt_attached1_test_' + Date.now();
const attached2Jwt = 'jwt_attached2_test_' + Date.now();

const chain = createTokenChain(
  'owner@example.com',
  { tier: 'team', features: ['scan'] },
  ownerJwt,
  60,
  [
    { email: 'dev1@example.com', tier: 'team' },
    { email: 'dev2@example.com', tier: 'team' }
  ],
  [attached1Jwt, attached2Jwt]
);

assert(chain.chainId, 'chainId should be set');
assert(chain.owner.tokenHash === hashToken(ownerJwt), 'owner hash should match');
assert(chain.attached.length === 2, 'should have 2 attached tokens');
console.log('✅ Test 1 passed: createTokenChain');

// --- Test 2: Owner and attached start pending ---
const ownerNode = getTokenNode(hashToken(ownerJwt));
assert(ownerNode.status === 'pending', 'owner should start pending');
assert(ownerNode.token_type === 'owner', 'owner type should be owner');

const attachedNode = getTokenNode(hashToken(attached1Jwt));
assert(attachedNode.status === 'pending', 'attached should start pending');
assert(attachedNode.token_type === 'attached', 'attached type should be attached');
assert(attachedNode.parent_id === ownerNode.id, 'attached parent should be owner');
console.log('✅ Test 2 passed: initial statuses');

// --- Test 3: Attached cannot activate before owner ---
const earlyActivate = activateToken(hashToken(attached1Jwt), 60);
assert(!earlyActivate.success, 'attached should fail to activate before owner');
assert(earlyActivate.error.includes('Parent token is not yet active'), 'should mention parent not active');
console.log('✅ Test 3 passed: lazy chain — attached blocked before owner');

// --- Test 4: Owner activates successfully ---
const ownerActivate = activateToken(hashToken(ownerJwt), 60);
assert(ownerActivate.success, 'owner should activate');
assert(ownerActivate.node.status === 'active', 'owner status should be active');
assert(ownerActivate.node.activated_at, 'owner should have activated_at');
assert(ownerActivate.node.clock_started_at, 'owner should have clock_started_at');
console.log('✅ Test 4 passed: owner activation');

// --- Test 5: Attached can activate after owner ---
const attachedActivate = activateToken(hashToken(attached1Jwt), 60);
assert(attachedActivate.success, 'attached should activate after owner');
assert(attachedActivate.node.status === 'active', 'attached status should be active');
assert(attachedActivate.node.clock_started_at, 'attached should have its own clock_started_at');
console.log('✅ Test 5 passed: lazy chain — attached activates after owner');

// --- Test 6: Chain validation ---
const validResult = validateChainToken(ownerJwt);
assert(validResult.chainValid, 'owner should validate');

const invalidResult = validateChainToken(attached2Jwt);
assert(!invalidResult.chainValid, 'unactivated attached should not validate');
console.log('✅ Test 6 passed: validateChainToken');

// --- Test 7: Revoke with cascade ---
const revokeResult = revokeToken(hashToken(ownerJwt), true);
assert(revokeResult.success, 'revoke should succeed');

const revokedOwner = getTokenNode(hashToken(ownerJwt));
assert(revokedOwner.status === 'revoked', 'owner should be revoked');

const revokedAttached = getTokenNode(hashToken(attached1Jwt));
assert(revokedAttached.status === 'revoked', 'attached should be revoked via cascade');
console.log('✅ Test 7 passed: cascade revoke');

// --- Test 8: Chain status summary ---
const summary = getChainStatus(chain.chainId);
assert(summary.chainId === chain.chainId, 'summary should have correct chainId');
assert(summary.owner.status === 'revoked', 'summary owner should reflect revoked');
assert(summary.attached.length === 2, 'summary should have 2 attached');
assert(summary.fullyActive === false, 'revoked chain should not be fully active');
console.log('✅ Test 8 passed: getChainStatus');

// --- Test 9: Remaining minutes ---
const remaining = getRemainingMinutes(ownerActivate.node);
assert(remaining > 0 && remaining <= 60, 'remaining minutes should be within 0-60');
console.log('✅ Test 9 passed: getRemainingMinutes');

console.log('\n✅ All token chain tests passed.');

// Cleanup
try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
