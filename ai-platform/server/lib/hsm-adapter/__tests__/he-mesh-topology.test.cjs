'use strict';

/**
 * Track 51: Homomorphic Encryption Over Mesh Topologies tests.
 */
const {
  HeMeshTopology,
  DEFAULT_OPTIONS,
  NODE_STATUS,
  QUERY_STATUS,
  HE_OPERATION,
} = require('../he-mesh-topology.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 51: HeMeshTopology', () => {
  let mesh;

  beforeEach(() => {
    mesh = new HeMeshTopology({
      maxNodes: 16,
      maxHops: 8,
      requireAttestation: false,
      queryTimeoutMs: 60000,
    });
  });

  describe('registerNode', () => {
    test('registers a node with default scheme', () => {
      mesh.registerNode('n1');
      const nodes = mesh.getNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe('n1');
      expect(nodes[0].schemes).toContain('additive');
    });

    test('registers with custom schemes', () => {
      mesh.registerNode('n1', { schemes: ['paillier', 'bfv'] });
      const nodes = mesh.getNodes();
      expect(nodes[0].schemes).toContain('paillier');
      expect(nodes[0].schemes).toContain('bfv');
    });

    test('rejects empty ID', () => {
      expect(() => mesh.registerNode('')).toThrow(HsmAdapterError);
    });

    test('rejects duplicate', () => {
      mesh.registerNode('n1');
      expect(() => mesh.registerNode('n1')).toThrow(HsmAdapterError);
    });

    test('enforces max nodes', () => {
      const small = new HeMeshTopology({ maxNodes: 2 });
      small.registerNode('n1');
      small.registerNode('n2');
      expect(() => small.registerNode('n3')).toThrow(HsmAdapterError);
    });

    test('rejects unsupported scheme', () => {
      expect(() => mesh.registerNode('n1', { schemes: ['unknown-scheme'] }))
        .toThrow(HsmAdapterError);
    });
  });

  describe('unregisterNode', () => {
    test('removes a node', () => {
      mesh.registerNode('n1');
      mesh.unregisterNode('n1');
      expect(mesh.getNodes().length).toBe(0);
    });

    test('removes edges when node is removed', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      mesh.unregisterNode('n1');
      expect(mesh.getEdges().length).toBe(0);
    });

    test('rejects unknown node', () => {
      expect(() => mesh.unregisterNode('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('addEdge', () => {
    test('adds an edge between two nodes', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2', { latency: 5, bandwidth: 1000, trust: 0.95 });
      const edges = mesh.getEdges();
      expect(edges.length).toBe(1);
      expect(edges[0].latency).toBe(5);
    });

    test('rejects self-loop', () => {
      mesh.registerNode('n1');
      expect(() => mesh.addEdge('n1', 'n1')).toThrow(HsmAdapterError);
    });

    test('rejects duplicate edge', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      expect(() => mesh.addEdge('n1', 'n2')).toThrow(HsmAdapterError);
    });

    test('rejects unregistered nodes', () => {
      expect(() => mesh.addEdge('n1', 'n2')).toThrow(HsmAdapterError);
    });
  });

  describe('removeEdge', () => {
    test('removes an edge', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      mesh.removeEdge('n1', 'n2');
      expect(mesh.getEdges().length).toBe(0);
    });

    test('rejects unknown edge', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      expect(() => mesh.removeEdge('n1', 'n2')).toThrow(HsmAdapterError);
    });
  });

  describe('findShortestPath', () => {
    test('finds direct path', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const path = mesh.findShortestPath('n1', 'n2');
      expect(path).toEqual(['n1', 'n2']);
    });

    test('finds multi-hop path', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.registerNode('n3');
      mesh.addEdge('n1', 'n2', { latency: 10 });
      mesh.addEdge('n2', 'n3', { latency: 10 });
      const path = mesh.findShortestPath('n1', 'n3');
      expect(path).toEqual(['n1', 'n2', 'n3']);
    });

    test('chooses shortest path by latency', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.registerNode('n3');
      mesh.registerNode('n4');
      mesh.addEdge('n1', 'n2', { latency: 100 });
      mesh.addEdge('n1', 'n3', { latency: 10 });
      mesh.addEdge('n3', 'n2', { latency: 10 });
      mesh.addEdge('n2', 'n4', { latency: 100 });
      mesh.addEdge('n3', 'n4', { latency: 10 });
      const path = mesh.findShortestPath('n1', 'n4');
      expect(path).toEqual(['n1', 'n3', 'n4']);
    });

    test('returns null when no path exists', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      // No edge between n1 and n2
      const path = mesh.findShortestPath('n1', 'n2');
      expect(path).toBeNull();
    });

    test('returns single-node path for same source/dest', () => {
      mesh.registerNode('n1');
      const path = mesh.findShortestPath('n1', 'n1');
      expect(path).toEqual(['n1']);
    });

    test('rejects unknown nodes', () => {
      expect(() => mesh.findShortestPath('unknown', 'n2')).toThrow(HsmAdapterError);
    });

    test('skips offline nodes', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.registerNode('n3');
      mesh.addEdge('n1', 'n2', { latency: 10 });
      mesh.addEdge('n2', 'n3', { latency: 10 });
      mesh.updateNodeStatus('n2', NODE_STATUS.OFFLINE);
      const path = mesh.findShortestPath('n1', 'n3');
      expect(path).toBeNull();
    });
  });

  describe('createQueryPlan', () => {
    test('creates a query plan', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1, 2, 3],
        operations: [{ type: HE_OPERATION.ADD, operand: 5 }],
      });
      expect(plan.queryId).toBeDefined();
      expect(plan.path).toEqual(['n1', 'n2']);
      expect(plan.hopCount).toBe(2);
      expect(plan.operationCount).toBe(1);
    });

    test('rejects invalid config', () => {
      expect(() => mesh.createQueryPlan(null)).toThrow(HsmAdapterError);
    });

    test('rejects missing nodes', () => {
      expect(() => mesh.createQueryPlan({
        encryptedData: [1],
        operations: [],
      })).toThrow(HsmAdapterError);
    });

    test('rejects empty data', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      expect(() => mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [],
        operations: [],
      })).toThrow(HsmAdapterError);
    });

    test('rejects too many operations', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const ops = new Array(20).fill({ type: HE_OPERATION.ADD, operand: 1 });
      expect(() => mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: ops,
      })).toThrow(HsmAdapterError);
    });

    test('rejects invalid operation type', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      expect(() => mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [{ type: 'invalid-op' }],
      })).toThrow(HsmAdapterError);
    });

    test('rejects unsupported scheme', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      expect(() => mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [],
        scheme: 'unknown-scheme',
      })).toThrow(HsmAdapterError);
    });

    test('rejects when no path exists', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      // No edge
      expect(() => mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [],
      })).toThrow(HsmAdapterError);
    });

    test('rejects when node does not support scheme', () => {
      mesh.registerNode('n1', { schemes: ['paillier'] });
      mesh.registerNode('n2', { schemes: ['paillier'] });
      mesh.addEdge('n1', 'n2');
      expect(() => mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [],
        scheme: 'additive',
      })).toThrow(HsmAdapterError);
    });
  });

  describe('executeQuery', () => {
    test('executes a simple add operation', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1, 2, 3],
        operations: [{ type: HE_OPERATION.ADD, operand: 5 }],
      });
      const result = mesh.executeQuery(plan.queryId);
      expect(result.status).toBe(QUERY_STATUS.COMPLETED);
      expect(result.result).toEqual([6, 7, 8]);
    });

    test('executes scalar multiply', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1, 2, 3],
        operations: [{ type: HE_OPERATION.SCALAR_MUL, operand: 3 }],
      });
      const result = mesh.executeQuery(plan.queryId);
      expect(result.status).toBe(QUERY_STATUS.COMPLETED);
      expect(result.result).toEqual([3, 6, 9]);
    });

    test('executes subtract', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [10, 20, 30],
        operations: [{ type: HE_OPERATION.SUBTRACT, operand: 5 }],
      });
      const result = mesh.executeQuery(plan.queryId);
      expect(result.result).toEqual([5, 15, 25]);
    });

    test('executes multi-hop with multiple operations', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.registerNode('n3');
      mesh.addEdge('n1', 'n2');
      mesh.addEdge('n2', 'n3');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n3',
        encryptedData: [1, 2, 3],
        operations: [
          { type: HE_OPERATION.ADD, operand: 5 },
          { type: HE_OPERATION.SCALAR_MUL, operand: 2 },
        ],
      });
      const result = mesh.executeQuery(plan.queryId);
      expect(result.status).toBe(QUERY_STATUS.COMPLETED);
      // [1+5, 2+5, 3+5] = [6,7,8], then *2 = [12,14,16]
      expect(result.result).toEqual([12, 14, 16]);
      expect(result.hopsExecuted).toBe(2);
    });

    test('executes compare operation', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1, 5, 10],
        operations: [{ type: HE_OPERATION.COMPARE, operand: 4 }],
      });
      const result = mesh.executeQuery(plan.queryId);
      expect(result.result).toEqual([0, 1, 1]);
    });

    test('fails when node is offline', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [{ type: HE_OPERATION.ADD, operand: 1 }],
      });
      mesh.updateNodeStatus('n2', NODE_STATUS.OFFLINE);
      const result = mesh.executeQuery(plan.queryId);
      expect(result.status).toBe(QUERY_STATUS.FAILED);
    });

    test('rejects unknown query', () => {
      expect(() => mesh.executeQuery('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects non-pending query', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [{ type: HE_OPERATION.ADD, operand: 1 }],
      });
      mesh.executeQuery(plan.queryId);
      // Already completed — not in _queries anymore, so should throw not found
      expect(() => mesh.executeQuery(plan.queryId)).toThrow(HsmAdapterError);
    });
  });

  describe('getQuery', () => {
    test('returns active query', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [],
      });
      const query = mesh.getQuery(plan.queryId);
      expect(query).not.toBeNull();
      expect(query.queryId).toBe(plan.queryId);
    });

    test('returns completed query from history', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [{ type: HE_OPERATION.ADD, operand: 1 }],
      });
      mesh.executeQuery(plan.queryId);
      const query = mesh.getQuery(plan.queryId);
      expect(query).not.toBeNull();
    });

    test('returns null for unknown query', () => {
      expect(mesh.getQuery('unknown')).toBeNull();
    });
  });

  describe('getActiveQueries', () => {
    test('returns active queries', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [],
      });
      expect(mesh.getActiveQueries().length).toBe(1);
    });
  });

  describe('getCompletedQueries', () => {
    test('returns completed queries', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [{ type: HE_OPERATION.ADD, operand: 1 }],
      });
      mesh.executeQuery(plan.queryId);
      expect(mesh.getCompletedQueries().length).toBe(1);
    });
  });

  describe('checkExpiredQueries', () => {
    test('expires queries past timeout', () => {
      const fast = new HeMeshTopology({ queryTimeoutMs: 50 });
      fast.registerNode('n1');
      fast.registerNode('n2');
      fast.addEdge('n1', 'n2');
      const plan = fast.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n2',
        encryptedData: [1],
        operations: [],
      });
      return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        const expired = fast.checkExpiredQueries();
        expect(expired.length).toBe(1);
        expect(expired[0]).toBe(plan.queryId);
      });
    });
  });

  describe('updateNodeStatus', () => {
    test('updates node status', () => {
      mesh.registerNode('n1');
      mesh.updateNodeStatus('n1', NODE_STATUS.DEGRADED);
      const nodes = mesh.getNodes();
      expect(nodes[0].status).toBe(NODE_STATUS.DEGRADED);
    });

    test('rejects unknown node', () => {
      expect(() => mesh.updateNodeStatus('unknown', NODE_STATUS.ACTIVE)).toThrow(HsmAdapterError);
    });

    test('rejects invalid status', () => {
      mesh.registerNode('n1');
      expect(() => mesh.updateNodeStatus('n1', 'invalid')).toThrow(HsmAdapterError);
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      const stats = mesh.getStats();
      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(1);
      expect(stats.activeNodes).toBe(2);
    });
  });

  describe('getNodes', () => {
    test('returns all nodes with neighbor count', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.registerNode('n3');
      mesh.addEdge('n1', 'n2');
      mesh.addEdge('n1', 'n3');
      const nodes = mesh.getNodes();
      const n1 = nodes.find(n => n.id === 'n1');
      expect(n1.neighborCount).toBe(2);
    });
  });

  describe('getEdges', () => {
    test('returns all edges', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2', { latency: 5, bandwidth: 100, trust: 0.9 });
      const edges = mesh.getEdges();
      expect(edges.length).toBe(1);
      expect(edges[0].latency).toBe(5);
      expect(edges[0].bandwidth).toBe(100);
      expect(edges[0].trust).toBe(0.9);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      mesh.registerNode('n1');
      mesh.registerNode('n2');
      mesh.addEdge('n1', 'n2');
      mesh.reset();
      expect(mesh.getNodes().length).toBe(0);
      expect(mesh.getEdges().length).toBe(0);
    });
  });

  describe('full mesh query flow', () => {
    test('complete mesh setup -> query -> execute flow', () => {
      // Build a 4-node mesh: n1 -> n2 -> n3 -> n4
      mesh.registerNode('n1', { schemes: ['additive', 'paillier'] });
      mesh.registerNode('n2', { schemes: ['additive'] });
      mesh.registerNode('n3', { schemes: ['additive'] });
      mesh.registerNode('n4', { schemes: ['additive', 'bfv'] });
      mesh.addEdge('n1', 'n2', { latency: 5 });
      mesh.addEdge('n2', 'n3', { latency: 5 });
      mesh.addEdge('n3', 'n4', { latency: 5 });
      // Create query with 3 operations (one per hop)
      const plan = mesh.createQueryPlan({
        sourceNode: 'n1',
        destinationNode: 'n4',
        encryptedData: [10, 20, 30],
        operations: [
          { type: HE_OPERATION.ADD, operand: 5 },      // [15, 25, 35]
          { type: HE_OPERATION.SCALAR_MUL, operand: 2 }, // [30, 50, 70]
          { type: HE_OPERATION.SUBTRACT, operand: 10 },  // [20, 40, 60]
        ],
      });
      const result = mesh.executeQuery(plan.queryId);
      expect(result.status).toBe(QUERY_STATUS.COMPLETED);
      expect(result.result).toEqual([20, 40, 60]);
      expect(result.hopsExecuted).toBe(3);
      const stats = mesh.getStats();
      expect(stats.completedQueries).toBe(1);
    });
  });
});
