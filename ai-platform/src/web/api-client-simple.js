/**
 * Simple API Client for Dashboard
 * Self-contained version with no external dependencies
 */

class SimpleAPIClient {
    constructor() {
        this.baseUrl = window.location.origin || 'https://replace_with_real_api_base_url.com';
        this.token = localStorage.getItem('access_token') || null;
        this.isAuthenticated = false;
        this.user = null;
        console.log('🔧 SimpleAPIClient initialized with baseUrl:', this.baseUrl);
    }

    // Authentication methods
    async login(username, password) {
        console.log('🔐 Login attempt for:', username);
        // Simulate successful login for demo
        this.isAuthenticated = true;
        this.user = {
            email: username,
            fullName: 'Replace With Real User Name',
            isAuthenticated: true,
        };
        this.token = 'demo-token-' + Date.now();
        localStorage.setItem('access_token', this.token);
        return { success: true, user: this.user };
    }

    async register(email, password, fullName) {
        console.log('📝 Registration attempt for:', email);
        // Simulate successful registration for demo
        this.isAuthenticated = true;
        this.user = {
            email: email,
            fullName: fullName || 'Demo User',
            isAuthenticated: true,
        };
        this.token = 'demo-token-' + Date.now();
        localStorage.setItem('access_token', this.token);
        return { success: true, user: this.user };
    }

    async logout() {
        console.log('🚪 Logging out');
        this.isAuthenticated = false;
        this.user = null;
        this.token = null;
        localStorage.removeItem('access_token');
        return { success: true };
    }

    async getCurrentUser() {
        if (this.user) {
            return this.user;
        }
        // Return demo user if not authenticated
        return {
            email: 'demo@example.com',
            fullName: 'Replace With Real User Name',
            isAuthenticated: false,
        };
    }

    // Dashboard data methods - return mock data for demo
    async getProjectOverview() {
        return {
            totalFiles: 150,
            linesOfCode: 15678,
            languages: ['JavaScript', 'TypeScript', 'HTML', 'CSS'],
            lastScan: new Date().toISOString(),
        };
    }

    async getCodeAnalysisMetrics() {
        return {
            overall: { score: 82, grade: 'B' },
            metrics: {
                codeQuality: 78,
                testCoverage: 65,
                maintainability: 85,
                complexity: 72,
            },
        };
    }

    async getQualityMetrics() {
        return {
            overall: { score: 82, grade: 'B' },
            complexity: 5,
            duplication: 12,
            lines: 15678,
            functions: 234,
            classes: 45,
        };
    }

    async getTechnicalDebt() {
        return {
            totalDebt: 45,
            highPriority: 8,
            mediumPriority: 22,
            lowPriority: 15,
            estimatedHours: 120,
        };
    }

    async getPerformanceMetrics() {
        return {
            overall_score: 85,
            loadTime: 1.2,
            memoryUsage: 45,
            cpuUsage: 30,
            responseTime: 0.8,
        };
    }

    async getSecurityAnalysis() {
        return {
            overallScore: 85,
            vulnerabilities: [],
            securityHotspots: [],
            dependencyVulnerabilities: [],
        };
    }

    async getCodeStructure() {
        return {
            totalFiles: 150,
            totalDirectories: 25,
            maxDepth: 4,
            rootDirectory: './',
            languages: ['JavaScript', 'TypeScript', 'HTML', 'CSS'],
            frameworks: ['React', 'Node.js', 'Express'],
        };
    }

    async getRecommendations() {
        return [
            {
                category: 'code-quality',
                priority: 'high',
                title: 'Improve Code Quality',
                description: 'Focus on reducing code complexity',
                actions: ['Refactor complex functions', 'Improve documentation'],
            },
        ];
    }

    // Issues management
    async getIssues(projectId = null) {
        return {
            issues: [
                { id: 1, title: 'Fix memory leak', priority: 'high', status: 'open', type: 'bug' },
                { id: 2, title: 'Add unit tests', priority: 'medium', status: 'open', type: 'improvement' },
            ],
        };
    }

    async createIssue(issue) {
        return { success: true, issue: { ...issue, id: Date.now() } };
    }

    async updateIssue(issueId, updates) {
        return { success: true };
    }

    async resolveIssue(issueId) {
        return { success: true };
    }

    async deleteIssue(issueId) {
        return { success: true };
    }

    // Notifications
    async listNotifications() {
        return [];
    }

    async getUnreadCount() {
        return 0;
    }

    // Alias for compatibility
    async getCodeQuality() {
        return await this.getQualityMetrics();
    }
}

// Create global instance
console.log('📦 Creating simple API client...');
window.apiClient = new SimpleAPIClient();
window.APIClient = SimpleAPIClient;
console.log('✅ Simple API client created and available globally');
