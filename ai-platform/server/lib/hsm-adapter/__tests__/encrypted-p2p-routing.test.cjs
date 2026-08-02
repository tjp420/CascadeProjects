'use strict';

const crypto = require('crypto');
const {
  EncryptedP2PRoutingEngine,
  RouteTable,
  OnionEncryption,
  ROUTE_STATE,
  VALID_TRANSITIONS,
} = require('../encrypted-p2p-routing-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

// Generate a random 32-byte AES-256 key (hex)
function _genKey() {
  return crypto.randomBytes(32).toString('hex');
}

describe('EncryptedP2PRoutingEngine — Track 38 Encrypted P2P Routing', () => {
  beforeEach(() => { hsmMetrics.reset(); });

  const NODES = ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'];
  const KEYS = {};
  for (const n of NODES) KEYS[n] = _genKey();

  // ── L2.01: Full happy-path ──
  describe('L2.01: happy-path P2P routing lifecycle', () => {
    test('discover → establish → encrypt → relay → deliver', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });

      // Build topology: a-b-c-d (linear chain)
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      engine.addPeer('node-d', KEYS['node-d']);
      engine.addEdge('node-a', 'node-b');
      engine.addEdge('node-b', 'node-c');
      engine.addEdge('node-c', 'node-d');

      const discovery = engine.discoverRoute('node-d');
      expect(discovery.state).toBe(ROUTE_STATE.DISCOVERY);
      expect(discovery.route).toEqual(['node-a', 'node-b', 'node-c', 'node-d']);
      expect(discovery.hopCount).toBe(4);

      engine.establishRoute(discovery.routeId);
      expect(engine.getRouteState(discovery.routeId).state).toBe(ROUTE_STATE.ESTABLISHED);

      const bundle = engine.encryptMessage(discovery.routeId, 'hello world');
      expect(engine.getRouteState(discovery.routeId).state).toBe(ROUTE_STATE.ENCRYPTING);
      expect(bundle.layers.length).toBe(3); // 3 hops (b, c, d)

      engine.relayMessage(bundle);
      expect(engine.getRouteState(discovery.routeId).state).toBe(ROUTE_STATE.RELAYING);

      engine.markDelivered(discovery.routeId);
      expect(engine.getRouteState(discovery.routeId).state).toBe(ROUTE_STATE.DELIVERED);
    });
  });

  // ── L2.02: RouteTable BFS ──
  describe('L2.02: RouteTable BFS shortest path', () => {
    test('finds direct route', () => {
      const table = new RouteTable();
      table.addEdge('a', 'b');
      expect(table.findRoute('a', 'b')).toEqual(['a', 'b']);
    });

    test('finds multi-hop route', () => {
      const table = new RouteTable();
      table.addEdge('a', 'b');
      table.addEdge('b', 'c');
      table.addEdge('c', 'd');
      expect(table.findRoute('a', 'd')).toEqual(['a', 'b', 'c', 'd']);
    });

    test('finds shortest path when multiple exist', () => {
      const table = new RouteTable();
      table.addEdge('a', 'b');
      table.addEdge('b', 'd');
      table.addEdge('a', 'c');
      table.addEdge('c', 'd');
      const route = table.findRoute('a', 'd');
      expect(route.length).toBe(3); // a → b → d or a → c → d
      expect(route[0]).toBe('a');
      expect(route[2]).toBe('d');
    });

    test('returns null when no route exists', () => {
      const table = new RouteTable();
      table.addEdge('a', 'b');
      table.addEdge('c', 'd');
      expect(table.findRoute('a', 'd')).toBeNull();
    });

    test('returns null for unknown nodes', () => {
      const table = new RouteTable();
      expect(table.findRoute('unknown', 'also-unknown')).toBeNull();
    });

    test('returns single-node route for source === destination', () => {
      const table = new RouteTable();
      table.addEdge('a', 'b');
      expect(table.findRoute('a', 'a')).toEqual(['a']);
    });
  });

  // ── L2.03: Onion encryption ──
  describe('L2.03: OnionEncryption', () => {
    test('encrypts message with per-hop layers', () => {
      const route = ['node-a', 'node-b', 'node-c'];
      const peerKeys = new Map([
        ['node-b', KEYS['node-b']],
        ['node-c', KEYS['node-c']],
      ]);
      const bundle = OnionEncryption.encrypt('secret message', route, peerKeys);
      expect(bundle.layers.length).toBe(2); // 2 hops (b, c)
      expect(bundle.source).toBe('node-a');
      expect(bundle.destination).toBe('node-c');
      expect(bundle.messageHash).toHaveLength(64); // SHA-256
    });

    test('decryptLayer peels one layer at relay node', () => {
      const route = ['node-a', 'node-b', 'node-c'];
      const peerKeys = new Map([
        ['node-b', KEYS['node-b']],
        ['node-c', KEYS['node-c']],
      ]);
      const bundle = OnionEncryption.encrypt('secret message', route, peerKeys);

      // First relay (node-b) decrypts its layer
      const result = OnionEncryption.decryptLayer(bundle, 'node-b', KEYS['node-b']);
      expect(result.nextHop).toBe('node-c');
      expect(result.isFinal).toBe(false);
    });

    test('decryptLayer at destination reveals isFinal', () => {
      const route = ['node-a', 'node-b'];
      const peerKeys = new Map([['node-b', KEYS['node-b']]]);
      const bundle = OnionEncryption.encrypt('secret', route, peerKeys);

      const result = OnionEncryption.decryptLayer(bundle, 'node-b', KEYS['node-b']);
      expect(result.isFinal).toBe(true);
      expect(result.nextHop).toBeNull();
    });

    test('decryptLayer fails with wrong key', () => {
      const route = ['node-a', 'node-b'];
      const peerKeys = new Map([['node-b', KEYS['node-b']]]);
      const bundle = OnionEncryption.encrypt('secret', route, peerKeys);

      const wrongKey = _genKey();
      expect(() => OnionEncryption.decryptLayer(bundle, 'node-b', wrongKey)).toThrow(HsmAdapterError);
    });

    test('encrypt throws for missing peer key', () => {
      const route = ['node-a', 'node-b'];
      expect(() => OnionEncryption.encrypt('secret', route, new Map())).toThrow(HsmAdapterError);
    });

    test('encrypt throws for route with < 2 nodes', () => {
      expect(() => OnionEncryption.encrypt('secret', ['node-a'], new Map())).toThrow(HsmAdapterError);
    });
  });

  // ── L2.04: Relay forwarding ──
  describe('L2.04: relay node forwarding', () => {
    test('relay decrypts layer to find next hop without seeing payload', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      engine.addEdge('node-a', 'node-b');
      engine.addEdge('node-b', 'node-c');

      const discovery = engine.discoverRoute('node-c');
      engine.establishRoute(discovery.routeId);
      const bundle = engine.encryptMessage(discovery.routeId, 'hidden payload');

      // Relay at node-b decrypts its layer
      const relayResult = engine.decryptAtRelay(bundle, 'node-b');
      expect(relayResult.nextHop).toBe('node-c');
      expect(relayResult.isFinal).toBe(false);
      // The relay result contains encrypted payload, not the plaintext
      expect(relayResult.remainingPayload).not.toBe('hidden payload');
    });
  });

  // ── L2.05: State machine ──
  describe('L2.05: state machine transitions', () => {
    test('cannot establish without discovery', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');
      const d = engine.discoverRoute('node-b');
      // Can't skip to encrypting
      expect(() => engine.encryptMessage(d.routeId, 'msg')).toThrow(HsmAdapterError);
    });

    test('cannot relay without encrypting', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');
      const d = engine.discoverRoute('node-b');
      engine.establishRoute(d.routeId);
      expect(() => engine.relayMessage({ routeId: d.routeId })).toThrow(HsmAdapterError);
    });

    test('cannot deliver without relaying', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');
      const d = engine.discoverRoute('node-b');
      engine.establishRoute(d.routeId);
      const b = engine.encryptMessage(d.routeId, 'msg');
      expect(() => engine.markDelivered(d.routeId)).toThrow(HsmAdapterError);
    });

    test('delivered state is terminal', () => {
      expect(VALID_TRANSITIONS[ROUTE_STATE.DELIVERED]).toEqual([]);
    });

    test('revoked state is terminal', () => {
      expect(VALID_TRANSITIONS[ROUTE_STATE.REVOKED]).toEqual([]);
    });
  });

  // ── L2.06: Policy validation ──
  describe('L2.06: policy validation', () => {
    test('CryptoPolicyEngine includes encryptedP2PRouting block', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy('default');
      expect(policy.encryptedP2PRouting).toBeDefined();
      expect(policy.encryptedP2PRouting.maxHopCount).toBe(16);
      expect(policy.encryptedP2PRouting.requireAntiReplay).toBe(true);
      expect(policy.encryptedP2PRouting.requireOnionEncryption).toBe(true);
    });

    test('tenant policy can override encryptedP2PRouting settings', () => {
      const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { 'tenant-a': { encryptedP2PRouting: { maxHopCount: 8 } } },
      });
      const policy = engine.getPolicy('tenant-a');
      expect(policy.encryptedP2PRouting.maxHopCount).toBe(8);
    });
  });

  // ── L2.07: Multi-hop routing ──
  describe('L2.07: multi-hop routing across 3+ nodes', () => {
    test('routes across 4-hop path', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      engine.addPeer('node-d', KEYS['node-d']);
      engine.addPeer('node-e', KEYS['node-e']);
      engine.addEdge('node-a', 'node-b');
      engine.addEdge('node-b', 'node-c');
      engine.addEdge('node-c', 'node-d');
      engine.addEdge('node-d', 'node-e');

      const d = engine.discoverRoute('node-e');
      expect(d.route).toEqual(['node-a', 'node-b', 'node-c', 'node-d', 'node-e']);
      expect(d.hopCount).toBe(5);

      engine.establishRoute(d.routeId);
      const bundle = engine.encryptMessage(d.routeId, 'multi-hop message');
      expect(bundle.layers.length).toBe(4); // 4 hops (b, c, d, e)
    });
  });

  // ── L2.08: Peer join/leave ──
  describe('L2.08: peer join/leave updates topology', () => {
    test('adding peer creates new route', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');

      // Initially no route to node-c
      engine.addPeer('node-c', KEYS['node-c']);
      expect(() => engine.discoverRoute('node-c')).toThrow(HsmAdapterError);

      // Add edge b-c, now route exists
      engine.addEdge('node-b', 'node-c');
      const d = engine.discoverRoute('node-c');
      expect(d.route).toEqual(['node-a', 'node-b', 'node-c']);
    });

    test('removing peer breaks route', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      engine.addEdge('node-a', 'node-b');
      engine.addEdge('node-b', 'node-c');

      // Route exists
      const d = engine.discoverRoute('node-c');
      expect(d.route).toEqual(['node-a', 'node-b', 'node-c']);

      // Remove node-b breaks the route
      engine.removePeer('node-b');
      expect(() => engine.discoverRoute('node-c')).toThrow(HsmAdapterError);
    });
  });

  // ── L3.01: Anti-replay ──
  describe('L3.01: anti-replay protection', () => {
    test('replayed nonce rejected', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');

      const d = engine.discoverRoute('node-b');
      engine.establishRoute(d.routeId);
      const bundle = engine.encryptMessage(d.routeId, 'message 1');
      engine.relayMessage(bundle);

      // Reset route for second message
      // Can't reuse same route — need a new one
      const d2 = engine.discoverRoute('node-b');
      engine.establishRoute(d2.routeId);
      const bundle2 = engine.encryptMessage(d2.routeId, 'message 2');

      // Try to replay bundle2's nonce
      const replayedBundle = { ...bundle2, nonce: bundle.nonce };
      expect(() => engine.relayMessage(replayedBundle)).toThrow(HsmAdapterError);
    });

    test('expired timestamp rejected', () => {
      const engine = new EncryptedP2PRoutingEngine({
        localNodeId: 'node-a',
        replayWindowMs: 100, // 100ms window
      });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');

      const d = engine.discoverRoute('node-b');
      engine.establishRoute(d.routeId);
      const bundle = engine.encryptMessage(d.routeId, 'old message');
      bundle.timestamp = Date.now() - 1000; // 1 second ago (expired)

      expect(() => engine.relayMessage(bundle)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.02: Tampered message ──
  describe('L3.02: tampered message rejected', () => {
    test('tampered onion layer fails decryption', () => {
      const route = ['node-a', 'node-b', 'node-c'];
      const peerKeys = new Map([
        ['node-b', KEYS['node-b']],
        ['node-c', KEYS['node-c']],
      ]);
      const bundle = OnionEncryption.encrypt('secret', route, peerKeys);

      // Tamper with the encrypted data
      const tamperedBundle = { ...bundle, layers: [{ ...bundle.layers[0], encrypted: 'tampered' }] };
      expect(() => OnionEncryption.decryptLayer(tamperedBundle, 'node-b', KEYS['node-b'])).toThrow(HsmAdapterError);
    });
  });

  // ── L3.03: Route revocation ──
  describe('L3.03: route revocation', () => {
    test('revoke active route', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');

      const d = engine.discoverRoute('node-b');
      engine.establishRoute(d.routeId);
      engine.revokeRoute(d.routeId, 'compromised');
      expect(engine.getRouteState(d.routeId).state).toBe(ROUTE_STATE.REVOKED);
    });

    test('cannot revoke delivered route', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');

      const d = engine.discoverRoute('node-b');
      engine.establishRoute(d.routeId);
      const b = engine.encryptMessage(d.routeId, 'msg');
      engine.relayMessage(b);
      engine.markDelivered(d.routeId);
      expect(() => engine.revokeRoute(d.routeId)).toThrow(HsmAdapterError);
    });

    test('cannot revoke already revoked route', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addEdge('node-a', 'node-b');

      const d = engine.discoverRoute('node-b');
      engine.revokeRoute(d.routeId);
      expect(() => engine.revokeRoute(d.routeId)).toThrow(HsmAdapterError);
    });

    test('blacklisted peer excluded from routes', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      engine.addEdge('node-a', 'node-b');
      engine.addEdge('node-b', 'node-c');

      // Route exists through node-b
      expect(engine.discoverRoute('node-c').route).toEqual(['node-a', 'node-b', 'node-c']);

      // Blacklist node-b
      engine.blacklistPeer('node-b', 'compromised');
      expect(() => engine.discoverRoute('node-c')).toThrow(HsmAdapterError);
    });
  });

  // ── L3.04: Cannot relay without established route ──
  describe('L3.04: cannot relay without route', () => {
    test('discoverRoute throws when no route exists', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      // No edge between a and b
      expect(() => engine.discoverRoute('node-b')).toThrow(HsmAdapterError);
    });

    test('route too long rejected', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a', maxHopCount: 2 });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      engine.addPeer('node-d', KEYS['node-d']);
      engine.addEdge('node-a', 'node-b');
      engine.addEdge('node-b', 'node-c');
      engine.addEdge('node-c', 'node-d');

      // Route a → b → c → d has 4 nodes (3 hops), max is 2
      expect(() => engine.discoverRoute('node-d')).toThrow(HsmAdapterError);
    });
  });

  // ── Metrics ──
  describe('metrics counters', () => {
    test('hsm-metrics includes p2p counters', () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty('hsm_p2p_route_discovered_total', 0);
      expect(metrics).toHaveProperty('hsm_p2p_message_encrypted_total', 0);
      expect(metrics).toHaveProperty('hsm_p2p_message_relayed_total', 0);
      expect(metrics).toHaveProperty('hsm_p2p_message_delivered_total', 0);
      expect(metrics).toHaveProperty('hsm_p2p_route_revoked_total', 0);
      expect(metrics).toHaveProperty('hsm_p2p_replay_blocked_total', 0);
      expect(metrics).toHaveProperty('hsm_p2p_active_routes', 0);
    });

    test('incrementCounter works for p2p counters', () => {
      hsmMetrics.incrementCounter('hsm_p2p_route_discovered_total', 5);
      hsmMetrics.incrementCounter('hsm_p2p_message_delivered_total', 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_p2p_route_discovered_total).toBe(5);
      expect(metrics.hsm_p2p_message_delivered_total).toBe(3);
    });

    test('Prometheus output includes p2p metrics', () => {
      hsmMetrics.incrementCounter('hsm_p2p_route_discovered_total', 1);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain('# HELP hsm_p2p_route_discovered_total');
      expect(output).toContain('# TYPE hsm_p2p_route_discovered_total counter');
      expect(output).toContain('hsm_p2p_route_discovered_total 1');
    });
  });

  // ── Engine state telemetry ──
  describe('getEngineState telemetry', () => {
    test('returns correct initial state', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      const state = engine.getEngineState();
      expect(state.localNodeId).toBe('node-a');
      expect(state.peerCount).toBe(0);
      expect(state.activeRoutes).toBe(0);
    });

    test('tracks peer count', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      engine.addPeer('node-b', KEYS['node-b']);
      engine.addPeer('node-c', KEYS['node-c']);
      expect(engine.getEngineState().peerCount).toBe(2);
    });
  });

  // ── Error cases ──
  describe('error cases', () => {
    test('constructor throws for missing localNodeId', () => {
      expect(() => new EncryptedP2PRoutingEngine({})).toThrow(HsmAdapterError);
    });

    test('getRouteState throws for unknown route', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      expect(() => engine.getRouteState('unknown')).toThrow(HsmAdapterError);
    });

    test('decryptAtRelay throws for unknown peer key', () => {
      const engine = new EncryptedP2PRoutingEngine({ localNodeId: 'node-a' });
      const fakeBundle = { layers: [{ iv: '00', encrypted: '00', authTag: '00' }] };
      expect(() => engine.decryptAtRelay(fakeBundle, 'unknown')).toThrow(HsmAdapterError);
    });
  });
});
