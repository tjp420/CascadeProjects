/**
 * Data Persistence Manager for AI Coding Dashboard
 * Handles data storage, retrieval, and synchronization
 */

class DataManager {
    constructor() {
        this.dbName = 'ai_dashboard_db';
        this.dbVersion = 1;
        this.db = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            this.db = await this.openDatabase();
            this.isInitialized = true;
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
            // Fallback to localStorage if IndexedDB fails
            this.useLocalStorageFallback = true;
        }
    }

    // Open IndexedDB database
    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('email', 'email', { unique: true });
                }

                if (!db.objectStoreNames.contains('projects')) {
                    const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
                    projectStore.createIndex('userId', 'userId', { unique: false });
                    projectStore.createIndex('name', 'name', { unique: false });
                }

                if (!db.objectStoreNames.contains('analyses')) {
                    const analysisStore = db.createObjectStore('analyses', { keyPath: 'id' });
                    analysisStore.createIndex('projectId', 'projectId', { unique: false });
                    analysisStore.createIndex('userId', 'userId', { unique: false });
                    analysisStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('teams')) {
                    const teamStore = db.createObjectStore('teams', { keyPath: 'id' });
                    teamStore.createIndex('ownerId', 'ownerId', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    // Generic method to perform database operations
    async performOperation(storeName, mode, operation) {
        if (this.useLocalStorageFallback) {
            return this.performLocalStorageOperation(storeName, operation);
        }

        if (!this.isInitialized) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            
            const request = operation(store);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // Save user data
    async saveUser(userData) {
        return this.performOperation('users', 'readwrite', (store) => {
            return store.put({
                ...userData,
                updatedAt: new Date().toISOString()
            });
        });
    }

    // Get user by ID
    async getUser(userId) {
        return this.performOperation('users', 'readonly', (store) => {
            return store.get(userId);
        });
    }

    // Get user by email
    async getUserByEmail(email) {
        return this.performOperation('users', 'readonly', (store) => {
            const index = store.index('email');
            return index.get(email);
        });
    }

    // Save project data
    async saveProject(projectData) {
        const project = {
            ...projectData,
            id: projectData.id || this.generateId(),
            createdAt: projectData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return this.performOperation('projects', 'readwrite', (store) => {
            return store.put(project);
        });
    }

    // Get projects for a user
    async getUserProjects(userId) {
        return this.performOperation('projects', 'readonly', (store) => {
            const index = store.index('userId');
            return index.getAll(userId);
        });
    }

    // Get project by ID
    async getProject(projectId) {
        return this.performOperation('projects', 'readonly', (store) => {
            return store.get(projectId);
        });
    }

    // Delete project
    async deleteProject(projectId) {
        return this.performOperation('projects', 'readwrite', (store) => {
            return store.delete(projectId);
        });
    }

    // Save code analysis data
    async saveAnalysis(analysisData) {
        const analysis = {
            ...analysisData,
            id: analysisData.id || this.generateId(),
            timestamp: analysisData.timestamp || new Date().toISOString()
        };

        return this.performOperation('analyses', 'readwrite', (store) => {
            return store.put(analysis);
        });
    }

    // Get analyses for a project
    async getProjectAnalyses(projectId, limit = 50) {
        return this.performOperation('analyses', 'readonly', (store) => {
            const index = store.index('projectId');
            return index.getAll(projectId);
        }).then(results => {
            return results
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);
        });
    }

    // Get analyses for a user
    async getUserAnalyses(userId, limit = 100) {
        return this.performOperation('analyses', 'readonly', (store) => {
            const index = store.index('userId');
            return index.getAll(userId);
        }).then(results => {
            return results
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);
        });
    }

    // Save team data
    async saveTeam(teamData) {
        const team = {
            ...teamData,
            id: teamData.id || this.generateId(),
            createdAt: teamData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return this.performOperation('teams', 'readwrite', (store) => {
            return store.put(team);
        });
    }

    // Get team by ID
    async getTeam(teamId) {
        return this.performOperation('teams', 'readonly', (store) => {
            return store.get(teamId);
        });
    }

    // Get teams for a user
    async getUserTeams(userId) {
        return this.performOperation('teams', 'readonly', (store) => {
            const index = store.index('ownerId');
            return index.getAll(userId);
        });
    }

    // Save user settings
    async saveSettings(key, value) {
        const setting = {
            key,
            value,
            updatedAt: new Date().toISOString()
        };

        return this.performOperation('settings', 'readwrite', (store) => {
            return store.put(setting);
        });
    }

    // Get user settings
    async getSettings(key) {
        return this.performOperation('settings', 'readonly', (store) => {
            return store.get(key);
        });
    }

    // Export all user data
    async exportUserData(userId) {
        const [user, projects, analyses, teams] = await Promise.all([
            this.getUser(userId),
            this.getUserProjects(userId),
            this.getUserAnalyses(userId),
            this.getUserTeams(userId)
        ]);

        return {
            user,
            projects,
            analyses,
            teams,
            exportedAt: new Date().toISOString()
        };
    }

    // Import user data
    async importUserData(data) {
        const operations = [];

        if (data.user) {
            operations.push(this.saveUser(data.user));
        }

        if (data.projects) {
            data.projects.forEach(project => {
                operations.push(this.saveProject(project));
            });
        }

        if (data.analyses) {
            data.analyses.forEach(analysis => {
                operations.push(this.saveAnalysis(analysis));
            });
        }

        if (data.teams) {
            data.teams.forEach(team => {
                operations.push(this.saveTeam(team));
            });
        }

        return Promise.all(operations);
    }

    // Clear all data for a user
    async clearUserData(userId) {
        const projects = await this.getUserProjects(userId);
        const analyses = await this.getUserAnalyses(userId);
        const teams = await this.getUserTeams(userId);

        const operations = [];

        projects.forEach(project => {
            operations.push(this.deleteProject(project.id));
        });

        analyses.forEach(analysis => {
            operations.push(this.performOperation('analyses', 'readwrite', (store) => {
                return store.delete(analysis.id);
            }));
        });

        teams.forEach(team => {
            operations.push(this.performOperation('teams', 'readwrite', (store) => {
                return store.delete(team.id);
            }));
        });

        return Promise.all(operations);
    }

    // LocalStorage fallback methods
    performLocalStorageOperation(storeName, operation) {
        const key = `${this.dbName}_${storeName}`;
        const data = JSON.parse(localStorage.getItem(key) || '{}');

        try {
            const result = operation({
                get: (id) => Promise.resolve(data[id] || undefined),
                getAll: () => Promise.resolve(Object.values(data)),
                put: (item) => {
                    data[item.id || item.key] = item;
                    localStorage.setItem(key, JSON.stringify(data));
                    return Promise.resolve(item);
                },
                delete: (id) => {
                    delete data[id];
                    localStorage.setItem(key, JSON.stringify(data));
                    return Promise.resolve();
                },
                index: (name) => ({
                    get: (value) => {
                        const items = Object.values(data).filter(item => item[name] === value);
                        return Promise.resolve(items[0] || undefined);
                    },
                    getAll: (value) => {
                        const items = Object.values(data).filter(item => item[name] === value);
                        return Promise.resolve(items);
                    }
                })
            });
            return result;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Get database statistics
    async getStats() {
        if (this.useLocalStorageFallback) {
            return this.getLocalStorageStats();
        }

        const stores = ['users', 'projects', 'analyses', 'teams', 'settings'];
        const stats = {};

        for (const storeName of stores) {
            try {
                const count = await this.performOperation(storeName, 'readonly', (store) => {
                    return store.count();
                });
                stats[storeName] = count;
            } catch (error) {
                stats[storeName] = 0;
            }
        }

        return stats;
    }

    getLocalStorageStats() {
        const stats = {};
        const stores = ['users', 'projects', 'analyses', 'teams', 'settings'];

        stores.forEach(storeName => {
            const key = `${this.dbName}_${storeName}`;
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            stats[storeName] = Object.keys(data).length;
        });

        return stats;
    }

    // Backup data to server (in production)
    async backupToServer(userId) {
        const userData = await this.exportUserData(userId);
        
        try {
            const response = await fetch('/api/backup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    data: userData
                })
            });

            if (!response.ok) {
                throw new Error('Backup failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Backup error:', error);
            throw error;
        }
    }

    // Restore data from server (in production)
    async restoreFromServer(userId) {
        try {
            const response = await fetch(`/api/backup/${userId}`);
            
            if (!response.ok) {
                throw new Error('Restore failed');
            }

            const data = await response.json();
            await this.importUserData(data.data);
            
            return data;
        } catch (error) {
            console.error('Restore error:', error);
            throw error;
        }
    }
}

// Initialize data manager
window.dataManager = new DataManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
