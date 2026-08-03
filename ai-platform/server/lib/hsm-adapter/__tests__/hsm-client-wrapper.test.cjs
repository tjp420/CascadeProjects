const { HsmClientWrapper, HsmCircuitBreakerError, listInstances, findInstanceByName } = require('../hsm-client-wrapper.cjs');

describe('HSM Circuit Breaker Abstraction Layer', () => {
  let mockHsm;

  beforeEach(() => {
    mockHsm = {
      sign: jest.fn().mockResolvedValue('sig_valid'),
      failuresAllowedBeforeRecovery: 0,
      currentCalls: 0,
      simulateTransientDrop(failCount) {
        this.failuresAllowedBeforeRecovery = failCount;
        this.currentCalls = 0;
        this.sign = jest.fn().mockImplementation(async () => {
          this.currentCalls++;
          if (this.currentCalls <= this.failuresAllowedBeforeRecovery) {
            throw new Error('ERR_HARDWARE_DROPOUT: Physical PCIe card disconnected.');
          }
          return 'sig_recovered';
        });
      }
    };
  });

  test('should pass requests transparently in CLOSED state under nominal workloads', async () => {
    const wrapper = new HsmClientWrapper(mockHsm, { failureThreshold: 2 });
    const result = await wrapper.execute('sign', 'data');
    expect(result).toBe('sig_valid');
    expect(wrapper.state).toBe('CLOSED');
  });

  test('should trip to OPEN state and fast-fail once failure threshold bounds are broken', async () => {
    mockHsm.sign = jest.fn().mockRejectedValue(new Error('DEVICE_MALFUNCTION'));
    const wrapper = new HsmClientWrapper(mockHsm, { failureThreshold: 2, baseDelaySec: 1 });

    await expect(wrapper.execute('sign')).rejects.toThrow('DEVICE_MALFUNCTION');
    await expect(wrapper.execute('sign')).rejects.toThrow('DEVICE_MALFUNCTION');

    // After two failures (threshold=2) circuit should be OPEN
    expect(wrapper.state).toBe('OPEN');

    // Third call must fast-fail without invoking the underlying client
    const prevCalls = mockHsm.sign.mock.calls.length;
    await expect(wrapper.execute('sign')).rejects.toThrow('Hardware communication is isolated');
    // underlying client should not have been called again
    expect(mockHsm.sign.mock.calls.length).toBe(prevCalls);
  });

  test('should recover to CLOSED after HALF-OPEN probe succeeds', async () => {
    // simulate two transient failures then recovery
    mockHsm.simulateTransientDrop(2);
    const wrapper = new HsmClientWrapper(mockHsm, { failureThreshold: 2, baseDelaySec: 0 });

    // cause two failures to open the circuit
    await expect(wrapper.execute('sign')).rejects.toThrow(/ERR_HARDWARE_DROPOUT/);
    await expect(wrapper.execute('sign')).rejects.toThrow(/ERR_HARDWARE_DROPOUT/);
    expect(wrapper.state).toBe('OPEN');

    // force nextAttemptTime to now so it goes HALF-OPEN
    wrapper.nextAttemptTime = Date.now() - 1;
    wrapper._evaluateStateTransition();
    expect(wrapper.state).toBe('HALF-OPEN');

    // the next probe should recover (simulateTransientDrop(2) fails twice then recovers)
    const probe = await wrapper.execute('sign');
    expect(probe).toBe('sig_recovered');
    // success in HALF-OPEN transitions back to CLOSED
    expect(wrapper.state).toBe('CLOSED');
  });

  test('registry should track instances and allow operator overrides', async () => {
    const name = `registry-test-${Date.now()}`;
    const wrapper = new HsmClientWrapper(mockHsm, { failureThreshold: 2, componentName: name });

    // findInstanceByName should return the same instance and initial state CLOSED
    const found = findInstanceByName(name);
    expect(found).toBeTruthy();
    expect(found.componentName).toBe(name);
    expect(found.state).toBe('CLOSED');

    // listInstances should include our named instance
    const list = listInstances();
    const names = list.map(i => i.componentName);
    expect(names).toContain(name);

    // Force open via instance and verify registry reflects change
    found.forceOpen();
    expect(found.state).toBe('OPEN');

    // Force close and verify
    found.forceClose();
    expect(found.state).toBe('CLOSED');
  });
});
