const logger = require('../../server/lib/app-logger');

describe('app-logger', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('error always logs regardless of LOG_LEVEL', () => {
        process.env.LOG_LEVEL = 'error';
        jest.resetModules();
        const log = require('../../server/lib/app-logger');
        log.error('fail');
        expect(console.error).toHaveBeenCalledWith('fail');
    });

    test('debug suppressed when LOG_LEVEL is info', () => {
        process.env.LOG_LEVEL = 'info';
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        const log = require('../../server/lib/app-logger');
        log.debug('hidden');
        expect(console.log).not.toHaveBeenCalled();
        log.info('visible');
        expect(console.info).toHaveBeenCalledWith('visible');
    });
});
