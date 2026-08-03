'use strict';

/**
 * Track 59: VDF and Time-Locked Enclave Puzzles tests.
 */
const crypto = require('crypto');
const {
  VdfTimeLockEngine,
  DEFAULT_OPTIONS,
  VDF_STATUS,
  PUZZLE_STATUS,
  PROOF_TYPE,
} = require('../vdf-time-lock-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 59: VdfTimeLockEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new VdfTimeLockEngine({
      maxDifficulty: 1000,
      minDifficulty: 1,
      maxPuzzles: 50,
      maxIterations: 1000,
    });
  });

  describe('createVdf', () => {
    test('creates a VDF instance', () => {
      const result = engine.createVdf({
        vdfId: 'v1',
        input: 5n,
        difficulty: 100,
      });
      expect(result.vdfId).toBe('v1');
      expect(result.status).toBe(VDF_STATUS.PENDING);
      expect(result.difficulty).toBe(100);
      expect(result.proofType).toBe(PROOF_TYPE.WESOLOWSKI);
    });

    test('accepts Pietrzak proof type', () => {
      const result = engine.createVdf({
        vdfId: 'v1',
        input: 5n,
        difficulty: 100,
        proofType: PROOF_TYPE.PIETRZAK,
      });
      expect(result.proofType).toBe(PROOF_TYPE.PIETRZAK);
    });

    test('rejects null config', () => {
      expect(() => engine.createVdf(null)).toThrow(HsmAdapterError);
    });

    test('rejects missing vdfId', () => {
      expect(() => engine.createVdf({ input: 5n, difficulty: 100 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects duplicate vdfId', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 100 });
      expect(() => engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 100 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects non-bigint input', () => {
      expect(() => engine.createVdf({ vdfId: 'v1', input: 'bad', difficulty: 100 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects zero input', () => {
      expect(() => engine.createVdf({ vdfId: 'v1', input: 0n, difficulty: 100 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects difficulty below minimum', () => {
      expect(() => engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 0 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects difficulty too high', () => {
      expect(() => engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10000 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects invalid proof type', () => {
      expect(() => engine.createVdf({
        vdfId: 'v1', input: 5n, difficulty: 100, proofType: 'invalid',
      })).toThrow(HsmAdapterError);
    });
  });

  describe('evaluateVdf', () => {
    test('evaluates a VDF and produces output', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      const result = engine.evaluateVdf('v1');
      expect(result.status).toBe(VDF_STATUS.COMPLETED);
      expect(result.output).toBeDefined();
      expect(result.proof).toBeDefined();
      expect(result.evalTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('rejects unknown VDF', () => {
      expect(() => engine.evaluateVdf('unknown')).toThrow(HsmAdapterError);
    });

    test('returns already-evaluated for re-evaluation', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      engine.evaluateVdf('v1');
      const result = engine.evaluateVdf('v1');
      expect(result.alreadyEvaluated).toBe(true);
    });

    test('rejects difficulty exceeding max iterations', () => {
      const bigEngine = new VdfTimeLockEngine({
        maxDifficulty: 100,
        maxIterations: 10,
      });
      bigEngine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 50 });
      expect(() => bigEngine.evaluateVdf('v1')).toThrow(HsmAdapterError);
    });
  });

  describe('verifyVdf', () => {
    test('verifies a valid VDF proof', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      engine.evaluateVdf('v1');
      const result = engine.verifyVdf('v1');
      expect(result.verified).toBe(true);
      expect(result.output).toBeDefined();
    });

    test('rejects unknown VDF', () => {
      expect(() => engine.verifyVdf('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects un-evaluated VDF', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      expect(() => engine.verifyVdf('v1')).toThrow(HsmAdapterError);
    });
  });

  describe('createPuzzle', () => {
    test('creates a time-locked puzzle', () => {
      const result = engine.createPuzzle({
        puzzleId: 'p1',
        secret: Buffer.from('top secret data'),
        difficulty: 100,
      });
      expect(result.puzzleId).toBe('p1');
      expect(result.status).toBe(PUZZLE_STATUS.LOCKED);
      expect(result.difficulty).toBe(100);
      expect(result.seed).toBeDefined();
    });

    test('rejects null config', () => {
      expect(() => engine.createPuzzle(null)).toThrow(HsmAdapterError);
    });

    test('rejects missing puzzleId', () => {
      expect(() => engine.createPuzzle({
        secret: Buffer.from('a'), difficulty: 100,
      })).toThrow(HsmAdapterError);
    });

    test('rejects duplicate puzzleId', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 100,
      });
      expect(() => engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 100,
      })).toThrow(HsmAdapterError);
    });

    test('rejects non-Buffer secret', () => {
      expect(() => engine.createPuzzle({
        puzzleId: 'p1', secret: 'not-a-buffer', difficulty: 100,
      })).toThrow(HsmAdapterError);
    });

    test('rejects empty secret', () => {
      expect(() => engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.alloc(0), difficulty: 100,
      })).toThrow(HsmAdapterError);
    });

    test('rejects difficulty below minimum', () => {
      expect(() => engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 0,
      })).toThrow(HsmAdapterError);
    });
  });

  describe('solvePuzzle', () => {
    test('solves a time-locked puzzle', () => {
      const secret = Buffer.from('top secret data');
      engine.createPuzzle({
        puzzleId: 'p1',
        secret,
        difficulty: 50,
      });
      const result = engine.solvePuzzle('p1');
      expect(result.status).toBe(PUZZLE_STATUS.SOLVED);
      expect(result.secret.equals(secret)).toBe(true);
      expect(result.solveTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('rejects unknown puzzle', () => {
      expect(() => engine.solvePuzzle('unknown')).toThrow(HsmAdapterError);
    });

    test('returns already-solved for re-solve', () => {
      const secret = Buffer.from('top secret');
      engine.createPuzzle({ puzzleId: 'p1', secret, difficulty: 10 });
      engine.solvePuzzle('p1');
      const result = engine.solvePuzzle('p1');
      expect(result.alreadySolved).toBe(true);
    });

    test('rejects expired puzzle', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      engine.expirePuzzle('p1');
      expect(() => engine.solvePuzzle('p1')).toThrow(HsmAdapterError);
    });
  });

  describe('verifyPuzzleSolution', () => {
    test('verifies a correct solution', () => {
      const secret = Buffer.from('the secret');
      engine.createPuzzle({ puzzleId: 'p1', secret, difficulty: 10 });
      const result = engine.verifyPuzzleSolution('p1', secret);
      expect(result.verified).toBe(true);
    });

    test('rejects incorrect solution', () => {
      engine.createPuzzle({
        puzzleId: 'p1',
        secret: Buffer.from('the secret'),
        difficulty: 10,
      });
      const result = engine.verifyPuzzleSolution('p1', Buffer.from('wrong'));
      expect(result.verified).toBe(false);
    });

    test('rejects unknown puzzle', () => {
      expect(() => engine.verifyPuzzleSolution('unknown', Buffer.from('a')))
        .toThrow(HsmAdapterError);
    });

    test('rejects non-Buffer solution', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      expect(() => engine.verifyPuzzleSolution('p1', 'not-a-buffer'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('expirePuzzle', () => {
    test('expires a puzzle', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      const result = engine.expirePuzzle('p1');
      expect(result.expired).toBe(true);
      const puzzle = engine.getPuzzle('p1');
      expect(puzzle.status).toBe(PUZZLE_STATUS.EXPIRED);
    });

    test('rejects unknown puzzle', () => {
      expect(() => engine.expirePuzzle('unknown')).toThrow(HsmAdapterError);
    });

    test('rejects already expired puzzle', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      engine.expirePuzzle('p1');
      expect(() => engine.expirePuzzle('p1')).toThrow(HsmAdapterError);
    });
  });

  describe('isPuzzleReady', () => {
    test('returns true for solved puzzle', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      engine.solvePuzzle('p1');
      expect(engine.isPuzzleReady('p1')).toBe(true);
    });

    test('returns false for unknown puzzle', () => {
      expect(engine.isPuzzleReady('unknown')).toBe(false);
    });
  });

  describe('getVdf', () => {
    test('returns VDF info', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      const info = engine.getVdf('v1');
      expect(info).not.toBeNull();
      expect(info.vdfId).toBe('v1');
      expect(info.difficulty).toBe(10);
    });

    test('returns null for unknown VDF', () => {
      expect(engine.getVdf('unknown')).toBeNull();
    });
  });

  describe('getPuzzle', () => {
    test('returns puzzle info', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      const info = engine.getPuzzle('p1');
      expect(info).not.toBeNull();
      expect(info.puzzleId).toBe('p1');
      expect(info.difficulty).toBe(10);
    });

    test('returns null for unknown puzzle', () => {
      expect(engine.getPuzzle('unknown')).toBeNull();
    });
  });

  describe('getPuzzles', () => {
    test('returns all puzzles', () => {
      engine.createPuzzle({ puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10 });
      engine.createPuzzle({ puzzleId: 'p2', secret: Buffer.from('b'), difficulty: 20 });
      expect(engine.getPuzzles().length).toBe(2);
    });
  });

  describe('getCompletedVdfs', () => {
    test('returns completed VDFs', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      engine.evaluateVdf('v1');
      expect(engine.getCompletedVdfs().length).toBe(1);
    });
  });

  describe('getCompletedPuzzles', () => {
    test('returns completed puzzles', () => {
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      engine.solvePuzzle('p1');
      expect(engine.getCompletedPuzzles().length).toBe(1);
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      const stats = engine.getStats();
      expect(stats.totalVdfs).toBe(1);
      expect(stats.totalPuzzles).toBe(1);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      engine.createVdf({ vdfId: 'v1', input: 5n, difficulty: 10 });
      engine.createPuzzle({
        puzzleId: 'p1', secret: Buffer.from('a'), difficulty: 10,
      });
      engine.reset();
      expect(engine.getStats().totalVdfs).toBe(0);
      expect(engine.getStats().totalPuzzles).toBe(0);
    });
  });

  describe('full VDF + puzzle flow', () => {
    test('complete create -> evaluate -> verify -> puzzle -> solve flow', () => {
      // Create and evaluate a VDF
      engine.createVdf({
        vdfId: 'consensus-vdf',
        input: 7n,
        difficulty: 50,
        proofType: PROOF_TYPE.WESOLOWSKI,
      });
      const evalResult = engine.evaluateVdf('consensus-vdf');
      expect(evalResult.status).toBe(VDF_STATUS.COMPLETED);
      expect(evalResult.output).toBeDefined();
      // Verify the VDF proof
      const verifyResult = engine.verifyVdf('consensus-vdf');
      expect(verifyResult.verified).toBe(true);
      // Create a time-locked puzzle
      const secret = Buffer.from('consensus-key-2026');
      engine.createPuzzle({
        puzzleId: 'consensus-puzzle',
        secret,
        difficulty: 30,
      });
      // Solve the puzzle
      const solveResult = engine.solvePuzzle('consensus-puzzle');
      expect(solveResult.status).toBe(PUZZLE_STATUS.SOLVED);
      expect(solveResult.secret.equals(secret)).toBe(true);
      // Verify the solution
      const verifySolution = engine.verifyPuzzleSolution('consensus-puzzle', secret);
      expect(verifySolution.verified).toBe(true);
      // Verify stats
      const stats = engine.getStats();
      expect(stats.totalVdfs).toBe(1);
      expect(stats.totalPuzzles).toBe(1);
      expect(stats.evalCount).toBe(1);
      expect(stats.verifyCount).toBe(1);
      expect(stats.puzzleSolveCount).toBe(1);
    });

    test('Pietrzak proof type works end-to-end', () => {
      engine.createVdf({
        vdfId: 'v1',
        input: 11n,
        difficulty: 20,
        proofType: PROOF_TYPE.PIETRZAK,
      });
      const evalResult = engine.evaluateVdf('v1');
      expect(evalResult.status).toBe(VDF_STATUS.COMPLETED);
      const verifyResult = engine.verifyVdf('v1');
      expect(verifyResult.verified).toBe(true);
    });
  });
});
