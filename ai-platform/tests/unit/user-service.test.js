const fs = require('fs');
const {
    authenticateWithDemoFile,
    loadDemoUsers,
    authenticateUser,
    toAuthUser
} = require('../../server/services/user-service');
const { hashPassword } = require('../../server/middleware/auth');
const { clearJsonFileCache } = require('../../server/lib/json-file-cache');

describe('user service demo authentication', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        clearJsonFileCache();
    });

    test('loadDemoUsers returns seeded accounts', () => {
        const users = loadDemoUsers();
        expect(users.length).toBeGreaterThanOrEqual(2);
        expect(users.some((user) => user.email === 'dev@simplebeacon.ai')).toBe(true);
    });

    test('authenticateWithDemoFile accepts valid demo credentials', async () => {
        const user = await authenticateWithDemoFile('dev@simplebeacon.ai', 'demo123');
        expect(user).toBeTruthy();
        expect(user.email).toBe('dev@simplebeacon.ai');
        expect(user.trustLevel).toBe('silver');
    });

    test('authenticateWithDemoFile rejects invalid password', async () => {
        const user = await authenticateWithDemoFile('dev@simplebeacon.ai', 'wrong-password');
        expect(user).toBeNull();
    });

    test('authenticateWithDemoFile rejects unknown email', async () => {
        const user = await authenticateWithDemoFile('unknown@example.com', 'demo123');
        expect(user).toBeNull();
    });

    test('loadDemoUsers returns empty array when file cannot be read', () => {
        const realExistsSync = fs.existsSync;
        jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
            if (String(filePath).includes('demo-users.json')) return false;
            return realExistsSync.call(fs, filePath);
        });
        const users = loadDemoUsers();
        expect(users).toEqual([]);
    });

    test('authenticateWithDemoFile supports passwordHash entries', async () => {
        const passwordHash = await hashPassword('topsecret');
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: Date.now(), size: 128 });
        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify([
            {
                id: 'u-hash',
                email: 'hash@simplebeacon.ai',
                passwordHash,
                name: 'Hash User'
            }
        ]));

        const user = await authenticateWithDemoFile('hash@simplebeacon.ai', 'topsecret');
        expect(user).toBeTruthy();
        expect(user.email).toBe('hash@simplebeacon.ai');
    });

    test('authenticateUser returns database source when db auth succeeds', async () => {
        const fakeDb = {
            query: jest.fn().mockResolvedValue({
                rows: [{
                    id: 'db-user',
                    email: 'db@simplebeacon.ai',
                    password_hash: await hashPassword('dbpass'),
                    name: 'DB User',
                    trust_level: 'gold'
                }]
            })
        };

        const result = await authenticateUser(fakeDb, 'db@simplebeacon.ai', 'dbpass');
        expect(result).toBeTruthy();
        expect(result.source).toBe('database');
        expect(result.user.email).toBe('db@simplebeacon.ai');
    });

    test('toAuthUser fills defaults for missing optional fields', () => {
        const mapped = toAuthUser({
            id: 'row-1',
            email: 'row@simplebeacon.ai',
            name: 'Row User'
        });
        expect(mapped.trustLevel).toBe('bronze');
        expect(mapped.successfulAnalyses).toBe(0);
        expect(mapped.securityIncidents).toBe(0);
        expect(mapped.communityContributions).toBe(0);
        expect(mapped.verificationStatus).toBe('email');
        expect(mapped.createdAt).toBeTruthy();
    });
});
