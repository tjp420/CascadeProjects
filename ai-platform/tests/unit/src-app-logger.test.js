const logger = require('../../src/lib/app-logger');

describe('src/lib/app-logger', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('debug is suppressed when LOG_LEVEL is warn', () => {
        process.env.LOG_LEVEL = 'warn';
        jest.resetModules();
        const log = require('../../src/lib/app-logger');
        log.debug('hidden');
        expect(console.log).not.toHaveBeenCalled();
        log.warn('visible');
        expect(console.warn).toHaveBeenCalledWith('visible');
    });

    test('error always logs', () => {
        process.env.LOG_LEVEL = 'error';
        jest.resetModules();
        const log = require('../../src/lib/app-logger');
        log.error('fail');
        expect(console.error).toHaveBeenCalledWith('fail');
    });
});
