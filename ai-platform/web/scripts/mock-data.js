// Mock Data Analysis Module
console.log('📊 Mock Data Analysis module loading...');

// Mock data analysis data
const mockDataAnalysis = {
    systemVersion: '2.0.0',
    lastUpdated: '2026-05-20T13:30:00.000Z',
    totalFilesScanned: 461,
    totalMockDataInstances: 871,
    totalGenerationFunctions: 190,

    datasets: [
        {
            id: 'dataset_001',
            name: 'E-commerce Sales Data',
            type: 'Sales',
            size: '2.5GB',
            records: 150000,
            columns: 12,
            lastGenerated: '2024-05-20T10:30:00',
            description:
        'Realistic e-commerce sales data with customer information, products, and transactions.',
            schema: [
                'order_id',
                'customer_id',
                'product_id',
                'quantity',
                'price',
                'timestamp',
                'category',
                'region',
                'payment_method',
                'status',
                'shipping_method',
                'discount_applied',
            ],
            version: '1.2.0',
            validationStatus: 'valid',
            usesTemplate: false,
            templateUsed: null,
            tags: ['sales', 'ecommerce', 'transactions'],
        },
        {
            id: 'dataset_002',
            name: 'User Activity Logs',
            type: 'Analytics',
            size: '1.8GB',
            records: 250000,
            columns: 8,
            lastGenerated: '2024-05-20T09:15:00',
            description:
        'User behavior and activity tracking data with session information and interaction patterns.',
            schema: [
                'user_id',
                'session_id',
                'timestamp',
                'action',
                'page_url',
                'device_type',
                'browser',
                'duration_seconds',
            ],
            version: '1.1.0',
            validationStatus: 'valid',
            usesTemplate: false,
            templateUsed: null,
            tags: ['analytics', 'user-behavior', 'sessions'],
        },
        {
            id: 'dataset_003',
            name: 'Financial Transactions',
            type: 'Financial',
            size: '3.2GB',
            records: 500000,
            columns: 15,
            lastGenerated: '2024-05-20T08:45:00',
            description:
        'Banking and financial transaction data with comprehensive audit trail and compliance information.',
            schema: [
                'transaction_id',
                'account_id',
                'amount',
                'currency',
                'transaction_type',
                'timestamp',
                'status',
                'risk_score',
                'compliance_flag',
                'ip_address',
                'device_id',
                'location',
                'merchant_category',
                'authorization_code',
                'settlement_date',
            ],
            version: '1.0.0',
            validationStatus: 'valid',
            usesTemplate: false,
            templateUsed: null,
            tags: ['financial', 'transactions', 'compliance'],
        },
        {
            id: 'dataset_004',
            name: 'Project Management Data',
            type: 'Management',
            size: '1.5GB',
            records: 300000,
            columns: 10,
            lastGenerated: '2024-05-20T13:30:00',
            description:
        'Project and task management data with team assignments, progress tracking, and resource allocation.',
            schema: [
                'project_id',
                'project_name',
                'task_id',
                'task_title',
                'assignee_id',
                'status',
                'priority',
                'due_date',
                'estimated_hours',
                'actual_hours',
            ],
            version: '1.0.0',
            validationStatus: 'valid',
            usesTemplate: true,
            templateUsed: 'createProjectTemplate',
            tags: ['management', 'projects', 'tasks'],
        },
        {
            id: 'dataset_005',
            name: 'Team Performance Metrics',
            type: 'Analytics',
            size: '0.8GB',
            records: 150000,
            columns: 8,
            lastGenerated: '2024-05-20T14:00:00',
            description:
        'Team member performance data with productivity metrics, quality scores, and collaboration indicators.',
            schema: [
                'member_id',
                'member_name',
                'productivity',
                'quality',
                'collaboration',
                'innovation',
                'department',
                'period',
            ],
            version: '1.0.0',
            validationStatus: 'valid',
            usesTemplate: true,
            templateUsed: 'createUserTemplate',
            tags: ['analytics', 'performance', 'team'],
        },
    ],
    analysisResults: [
        {
            datasetId: 'dataset_001',
            analysisType: 'statistical',
            timestamp: '2024-05-20T11:00:00',
            duration: '2.3s',
            results: {
                summary: {
                    totalRecords: 150000,
                    totalRevenue: 2456789.5,
                    averageOrderValue: 16.38,
                    conversionRate: 3.2,
                    uniqueCustomers: 45000,
                },
                distributions: {
                    salesByCategory: {
                        Electronics: 890234.2,
                        Clothing: 567890.1,
                        'Home & Garden': 432567.3,
                        Sports: 345678.9,
                        Books: 220418.97,
                    },
                    salesByRegion: {
                        'North America': 1234567.8,
                        Europe: 678901.2,
                        Asia: 345678.5,
                        Other: 197642.0,
                    },
                },
                trends: {
                    dailySales: [
                        { date: '2024-05-14', sales: 45678.9 },
                        { date: '2024-05-15', sales: 52345.6 },
                        { date: '2024-05-16', sales: 48901.2 },
                        { date: '2024-05-17', sales: 61234.7 },
                        { date: '2024-05-18', sales: 58907.3 },
                        { date: '2024-05-19', sales: 67234.8 },
                        { date: '2024-05-20', sales: 71234.5 },
                    ],
                },
            },
        },
        {
            datasetId: 'dataset_002',
            analysisType: 'behavioral',
            timestamp: '2024-05-20T10:30:00',
            duration: '1.8s',
            results: {
                summary: {
                    totalSessions: 85000,
                    averageSessionDuration: 245.6,
                    bounceRate: 42.3,
                    pagesPerSession: 3.8,
                },
                userSegments: {
                    'New Users': 25000,
                    'Returning Users': 60000,
                    'Power Users': 15000,
                },
                topPages: [
                    { page: '/home', views: 45000 },
                    { page: '/products', views: 38000 },
                    { page: '/cart', views: 22000 },
                    { page: '/checkout', views: 15000 },
                    { page: '/account', views: 12000 },
                ],
            },
        },
    ],
    generators: [
        {
            id: 'generator_001',
            name: 'E-commerce Data Generator',
            description:
        'Generate realistic e-commerce data including customers, products, orders, and transactions.',
            parameters: [
                { name: 'records', type: 'number', default: 100000, min: 1000, max: 1000000 },
                { name: 'dateRange', type: 'daterange', default: '30days' },
                {
                    name: 'categories',
                    type: 'multiselect',
                    options: ['Electronics', 'Clothing', 'Home', 'Sports', 'Books'],
                    default: ['Electronics', 'Clothing'],
                },
                {
                    name: 'regions',
                    type: 'multiselect',
                    options: ['North America', 'Europe', 'Asia', 'Other'],
                    default: ['North America', 'Europe'],
                },
            ],
        },
        {
            id: 'generator_002',
            name: 'User Activity Generator',
            description: 'Create realistic user behavior and activity tracking data.',
            parameters: [
                { name: 'users', type: 'number', default: 50000, min: 1000, max: 500000 },
                { name: 'sessions', type: 'number', default: 200000, min: 10000, max: 1000000 },
                { name: 'dateRange', type: 'daterange', default: '30days' },
                {
                    name: 'deviceTypes',
                    type: 'multiselect',
                    options: ['Desktop', 'Mobile', 'Tablet'],
                    default: ['Desktop', 'Mobile'],
                },
            ],
        },
        {
            id: 'generator_003',
            name: 'Financial Data Generator',
            description: 'Generate banking and financial transaction data with compliance features.',
            parameters: [
                { name: 'transactions', type: 'number', default: 500000, min: 10000, max: 2000000 },
                { name: 'dateRange', type: 'daterange', default: '30days' },
                { name: 'amountRange', type: 'range', default: '1-10000' },
                {
                    name: 'transactionTypes',
                    type: 'multiselect',
                    options: ['Purchase', 'Transfer', 'Withdrawal', 'Deposit'],
                    default: ['Purchase', 'Transfer'],
                },
            ],
        },
    ],
    templates: [
        {
            id: 'template_001',
            name: 'Sales Performance Dashboard',
            description: 'Complete sales analysis with KPIs, trends, and regional breakdowns.',
            category: 'Business',
            charts: ['line', 'bar', 'pie', 'heatmap'],
            metrics: ['revenue', 'orders', 'customers', 'conversion_rate'],
            datasets: ['dataset_001'],
        },
        {
            id: 'template_002',
            name: 'User Behavior Analysis',
            description: 'Comprehensive user activity and engagement analysis.',
            category: 'Analytics',
            charts: ['funnel', 'sankey', 'scatter', 'histogram'],
            metrics: ['sessions', 'duration', 'bounce_rate', 'pages_per_session'],
            datasets: ['dataset_002'],
        },
        {
            id: 'template_003',
            name: 'Financial Risk Assessment',
            description: 'Financial transaction analysis with risk scoring and compliance monitoring.',
            category: 'Financial',
            charts: ['treemap', 'waterfall', 'radar', 'gauge'],
            metrics: ['transaction_volume', 'risk_score', 'fraud_rate', 'compliance_score'],
            datasets: ['dataset_003'],
        },
    ],
};

// Show mock data analysis
function showMockDataAnalysis(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-database"></i> Mock Data Analysis
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="generateNewData()">
                        <i class="fas fa-plus"></i> Generate Data
                    </button>
                    <button class="btn btn-secondary" onclick="runAnalysis()">
                        <i class="fas fa-chart-bar"></i> Run Analysis
                    </button>
                    <button class="btn btn-secondary" onclick="exportResults()">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <!-- Overview Stats -->
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.datasets.length}</div>
                    <div class="stat-label">Active Datasets</div>
                    <div class="stat-change">+2 this week</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">System v${mockDataAnalysis.systemVersion}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.datasets.reduce((sum, ds) => sum + ds.records, 0).toLocaleString()}</div>
                    <div class="stat-label">Total Records</div>
                    <div class="stat-change">+450K this week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.analysisResults.length}</div>
                    <div class="stat-label">Analysis Results</div>
                    <div class="stat-change">+3 completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.datasets
        .reduce((sum, ds) => {
            const sizeNum = parseFloat(ds.size);
            const sizeUnit = ds.size.replace(/[0-9.]/g, '');
            if (sizeUnit === 'GB') {
                return sum + sizeNum;
            }
            if (sizeUnit === 'MB') {
                return sum + sizeNum / 1000;
            }
            return sum;
        }, 0)
        .toFixed(1)}GB</div>
                    <div class="stat-label">Total Storage</div>
                    <div class="stat-change">+2.6GB this week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.datasets.filter((ds) => ds.validationStatus === 'valid').length}/${mockDataAnalysis.datasets.length}</div>
                    <div class="stat-label">Validated</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${mockDataAnalysis.datasets.filter((ds) => ds.usesTemplate).length} use templates</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.totalFilesScanned}</div>
                    <div class="stat-label">Files Scanned</div>
                    <div class="stat-change">+129 this week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.totalMockDataInstances}</div>
                    <div class="stat-label">Mock Instances</div>
                    <div class="stat-change">+471 this week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${mockDataAnalysis.totalGenerationFunctions}</div>
                    <div class="stat-label">Generation Functions</div>
                    <div class="stat-change">+140 this week</div>
                </div>
            </div>
            
            <!-- Mock Data Tabs -->
            <div class="mock-data-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showMockDataTab('datasets', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Datasets
                    </button>
                    <button class="tab-btn" onclick="showMockDataTab('generators', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Generators
                    </button>
                    <button class="tab-btn" onclick="showMockDataTab('analysis', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Analysis
                    </button>
                    <button class="tab-btn" onclick="showMockDataTab('templates', event)" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Templates
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="mock-data-tab-content">
                ${getDatasetsContent()}
            </div>
        </div>
    `;
}

// Get datasets content
function getDatasetsContent() {
    return `
        <div class="datasets">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Available Datasets</h3>
                <div>
                    <select onchange="filterDatasets(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Types</option>
                        <option value="Sales">Sales</option>
                        <option value="Analytics">Analytics</option>
                        <option value="Financial">Financial</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" onclick="refreshDatasets()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div style="display: grid; gap: 1.5rem;">
                ${mockDataAnalysis.datasets
        .map(
            (dataset) => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items-start; margin-bottom: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${dataset.name}</h4>
                                    <span class="dataset-type type-${dataset.type}">${dataset.type}</span>
                                </div>
                                <p style="color: var(--text-secondary); margin: 0;">${dataset.description}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: var(--text-primary); font-weight: bold;">${dataset.size}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Size</div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                            <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold;">${dataset.records.toLocaleString()}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Records</div>
                            </div>
                            <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold;">${dataset.columns}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Columns</div>
                            </div>
                            <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold;">${formatDateTime(dataset.lastGenerated)}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Generated</div>
                            </div>
                            <div style="text-align: center; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="color: var(--text-primary); font-weight: bold;">v${dataset.version}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Version</div>
                            </div>
                            <div style="text-align: center; padding: 0.75rem; background: ${dataset.validationStatus === 'valid' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; border-radius: 6px;">
                                <div style="color: ${dataset.validationStatus === 'valid' ? 'var(--success-color)' : 'var(--warning-color)'}; font-weight: bold;">${dataset.validationStatus}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">Validation</div>
                            </div>
                        </div>
                        
                        ${
    dataset.usesTemplate
        ? `
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Template Used:</div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: var(--primary-color); font-size: 0.8rem; background: rgba(102, 126, 234, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">
                                    ${dataset.templateUsed}
                                </span>
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">• New template system</span>
                            </div>
                        </div>
                        `
        : ''
}
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Tags:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${dataset.tags
        .map(
            (tag) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">#${tag}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Schema:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${dataset.schema
        .map(
            (column) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${column}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="viewDataset('${dataset.id}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="analyzeDataset('${dataset.id}')">
                                <i class="fas fa-chart-bar"></i> Analyze
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="downloadDataset('${dataset.id}')">
                                <i class="fas fa-download"></i> Download
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="refreshDataset('${dataset.id}')">
                                <i class="fas fa-sync-alt"></i> Refresh
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get generators content
function getGeneratorsContent() {
    return `
        <div class="generators">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Data Generators</h3>
                <button class="btn btn-primary" onclick="createCustomGenerator()">
                    <i class="fas fa-plus"></i> Custom Generator
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                ${mockDataAnalysis.generators
        .map(
            (generator) => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">${generator.name}</h4>
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${generator.description}</p>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Parameters:</div>
                            <div style="display: grid; gap: 0.5rem;">
                                ${generator.parameters
        .map(
            (param) => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-primary); border-radius: 4px;">
                                        <span style="color: var(--text-primary); font-size: 0.9rem;">${param.name}</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem;">${param.type}: ${param.default}</span>
                                    </div>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="configureGenerator('${generator.id}')">
                                <i class="fas fa-cog"></i> Configure
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="previewGenerator('${generator.id}')">
                                <i class="fas fa-eye"></i> Preview
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="runGenerator('${generator.id}')">
                                <i class="fas fa-play"></i> Run
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get analysis content
function getAnalysisContent() {
    return `
        <div class="analysis">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Analysis Results</h3>
                <div>
                    <select onchange="filterAnalysis(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Types</option>
                        <option value="statistical">Statistical</option>
                        <option value="behavioral">Behavioral</option>
                        <option value="predictive">Predictive</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" onclick="runNewAnalysis()">
                        <i class="fas fa-plus"></i> New Analysis
                    </button>
                </div>
            </div>
            
            <div style="display: grid; gap: 1.5rem;">
                ${mockDataAnalysis.analysisResults
        .map(
            (analysis) => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items-center; margin-bottom: 1rem;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <h4 style="color: var(--text-primary); margin: 0;">${getDatasetName(analysis.datasetId)} Analysis</h4>
                                    <span class="analysis-type type-${analysis.analysisType}">${analysis.analysisType}</span>
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                                    Completed: ${formatDateTime(analysis.timestamp)} • Duration: ${analysis.duration}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <button class="btn btn-sm btn-primary" onclick="viewAnalysis('${analysis.datasetId}')">
                                    <i class="fas fa-chart-line"></i> View Details
                                </button>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                            ${Object.entries(analysis.results.summary)
        .map(
            ([key, value]) => `
                                <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                                    <div style="color: var(--text-primary); font-weight: bold; font-size: 1.1rem;">${formatMetricValue(key, value)}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatMetricLabel(key)}</div>
                                </div>
                            `
        )
        .join('')}
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-secondary" onclick="exportAnalysis('${analysis.datasetId}')">
                                <i class="fas fa-download"></i> Export
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="shareAnalysis('${analysis.datasetId}')">
                                <i class="fas fa-share"></i> Share
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="rerunAnalysis('${analysis.datasetId}')">
                                <i class="fas fa-redo"></i> Rerun
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Get templates content
function getTemplatesContent() {
    return `
        <div class="templates">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">Analysis Templates</h3>
                <button class="btn btn-primary" onclick="createTemplate()">
                    <i class="fas fa-plus"></i> Create Template
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                ${mockDataAnalysis.templates
        .map(
            (template) => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <h4 style="color: var(--text-primary); margin: 0;">${template.name}</h4>
                            <span class="template-category category-${template.category}">${template.category}</span>
                        </div>
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${template.description}</p>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Charts:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${template.charts
        .map(
            (chart) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${chart}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Metrics:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${template.metrics
        .map(
            (metric) => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${metric}</span>
                                `
        )
        .join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="useTemplate('${template.id}')">
                                <i class="fas fa-play"></i> Use Template
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="editTemplate('${template.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="duplicateTemplate('${template.id}')">
                                <i class="fas fa-copy"></i> Duplicate
                            </button>
                        </div>
                    </div>
                `
        )
        .join('')}
            </div>
        </div>
    `;
}

// Helper functions
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function getDatasetName(datasetId) {
    const dataset = mockDataAnalysis.datasets.find((ds) => ds.id === datasetId);
    return dataset ? dataset.name : 'Unknown Dataset';
}

function formatMetricValue(key, value) {
    if (typeof value === 'number') {
        if (key.includes('Rate') || key.includes('rate')) {
            return (value * 100).toFixed(1) + '%';
        } else if (key.includes('Value') || key.includes('Revenue')) {
            return '$' + value.toLocaleString();
        } else {
            return value.toLocaleString();
        }
    }
    return value;
}

function formatMetricLabel(key) {
    const labels = {
        totalRecords: 'Total Records',
        totalRevenue: 'Total Revenue',
        averageOrderValue: 'Avg Order Value',
        conversionRate: 'Conversion Rate',
        uniqueCustomers: 'Unique Customers',
        totalSessions: 'Total Sessions',
        averageSessionDuration: 'Avg Session Duration',
        bounceRate: 'Bounce Rate',
        pagesPerSession: 'Pages/Session',
    };
    return labels[key] || key;
}

// Tab switching
function showMockDataTab(tabName, _event) {
    const content = document.getElementById('mock-data-tab-content');
    if (!content) {
        return;
    }

    // Update tab buttons
    document.querySelectorAll('.mock-data-tabs .tab-btn').forEach((btn) => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });

    // Find and highlight the clicked button
    const clickedBtn = document.querySelector(`.mock-data-tabs .tab-btn[onclick*="'${tabName}'"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
        clickedBtn.style.color = 'var(--primary-color)';
        clickedBtn.style.borderBottom = '2px solid var(--primary-color)';
    }

    // Update content
    switch (tabName) {
    case 'datasets':
        content.textContent = getDatasetsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'generators':
        content.textContent = getGeneratorsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'analysis':
        content.textContent = getAnalysisContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'templates':
        content.textContent = getTemplatesContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
// Define openDataGenerationWizard first to ensure it's available when called
function openDataGenerationWizard() {
    console.log('Opening data generation wizard...');
    alert(
        'Data generation wizard would open with configuration options for generating mock datasets'
    );
}

// Make it globally available
window.openDataGenerationWizard = openDataGenerationWizard;

function generateNewData() {
    console.log('Generating new data...');
    openDataGenerationWizard();
}

function runAnalysis() {
    console.log('Running analysis...');
    runAnalysisConfiguration();
}

function runAnalysisConfiguration() {
    console.log('Running analysis configuration...');
    alert('Analysis configuration would be executed with current mock data settings');
}

function exportResults() {
    console.log('Exporting results...');
    exportAnalysisResults();
}

function exportAnalysisResults() {
    console.log('Exporting analysis results...');
    alert('Analysis results would be exported in the selected format (JSON, CSV, or PDF)');
}

function filterDatasets(filter) {
    console.log('Filtering datasets:', filter);
    alert(`Datasets would be filtered to show only ${filter} type datasets`);
}

function _refreshDatasets() {
    console.log('Refreshing datasets...');
    alert('Dataset list would be refreshed from the system');
}

function viewDataset(datasetId) {
    console.log('Viewing dataset:', datasetId);

    // Handle different ID formats - try ID first, then name
    let dataset = mockDataAnalysis.datasets.find((d) => d.id === datasetId);

    if (!dataset) {
    // Try to find by name or other identifier
        if (datasetId === 'ecommerce') {
            dataset = mockDataAnalysis.datasets.find((d) => d.id === 'dataset_001');
        } else if (datasetId === 'user-activity') {
            dataset = mockDataAnalysis.datasets.find((d) => d.id === 'dataset_002');
        } else if (datasetId === 'financial') {
            dataset = mockDataAnalysis.datasets.find((d) => d.id === 'dataset_003');
        }
    }

    if (!dataset) {
        console.error('Dataset not found:', datasetId);
        if (window.showNotification) {
            window.showNotification('Dataset not found', 'error');
        } else {
            alert('Dataset not found: ' + datasetId);
        }
        return;
    }

    // Display dataset details
    showDatasetDetails(dataset);
}

function showDatasetDetails(dataset) {
    if (!dataset) {
        console.error('Dataset not found');
        return;
    }

    // Create modal to show dataset details
    const modal = document.createElement('div');
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

    modal.textContent = `
    <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0;">Dataset Details: ${dataset.name}</h3>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
          ✕
        </button>
      </div>
      
      <div style="display: grid; gap: 1rem;">
        <div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">ID</div>
          <div style="color: var(--text-primary);">${dataset.id}</div>
        </div>
        
        <div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Size</div>
          <div style="color: var(--text-primary);">${dataset.size.toLocaleString()} records</div>
        </div>
        
        <div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Type</div>
          <div style="color: var(--text-primary);">${dataset.type}</div>
        </div>
        
        <div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Created</div>
          <div style="color: var(--text-primary);">${new Date(dataset.created).toLocaleString()}</div>
        </div>
        
        <div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Status</div>
          <div style="color: var(--text-primary);">${dataset.status}</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          Close
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Show modal
    setTimeout(() => {
        modal.style.display = 'flex';
    }, 100);
}

function analyzeDataset(datasetId) {
    console.log('Analyzing dataset:', datasetId);
    alert(`Dataset ${datasetId} analysis would be performed with comprehensive data analysis tools`);
}

function downloadDataset(datasetId) {
    console.log('Downloading dataset:', datasetId);
    alert(`Dataset ${datasetId} would be downloaded in selected format (JSON, CSV, or Excel)`);
}

function refreshDataset(datasetId) {
    console.log('Refreshing dataset:', datasetId);
    alert(`Dataset ${datasetId} would be refreshed with updated mock data`);
}

function createCustomGenerator() {
    console.log('Creating custom generator...');
    alert('Custom generator creation wizard would be shown here');
}

function configureGenerator(generatorId) {
    console.log('Configuring generator:', generatorId);
    alert(`Parameter configuration for generator ${generatorId} would be shown here`);
}

function _previewGenerator(generatorId) {
    console.log('Previewing generator:', generatorId);
    alert(`Preview of data generated by ${generatorId} would be shown here`);
}

function _runGenerator(generatorId) {
    console.log('Running generator:', generatorId);
    alert(`Generator ${generatorId} would be executed with current parameters`);
}

function _filterAnalysis(filter) {
    console.log('Filtering analysis:', filter);
    alert(`Analysis results would be filtered to show only ${filter} type analyses`);
}

function _runNewAnalysis() {
    console.log('Running new analysis...');
    alert('New analysis configuration dialog would be shown here');
}

function _viewAnalysis(datasetId) {
    console.log('Viewing analysis:', datasetId);
    alert(`Detailed analysis results for dataset ${datasetId} would be shown here`);
}

function exportAnalysis(datasetId) {
    console.log('Exporting analysis:', datasetId);
    alert(`Analysis results for dataset ${datasetId} would be exported`);
}

function shareAnalysis(datasetId) {
    console.log('Sharing analysis:', datasetId);
    alert(`Analysis results for dataset ${datasetId} would be shared with team members`);
}

function rerunAnalysis(datasetId) {
    console.log('Rerunning analysis:', datasetId);
    alert(`Analysis for dataset ${datasetId} would be rerun with current parameters`);
}

function createTemplate() {
    console.log('Creating template...');
    alert('Template creation wizard would be shown here');
}

function _useTemplate(templateId) {
    console.log('Using template:', templateId);
    alert(`Template ${templateId} would be applied to current analysis`);
}

function _editTemplate(templateId) {
    console.log('Editing template:', templateId);
    alert(`Template ${templateId} editing interface would be shown here`);
}

function _duplicateTemplate(templateId) {
    console.log('Duplicating template:', templateId);
    alert(`Template ${templateId} would be duplicated as a new template`);
}

// Add styles for mock data badges
if (!document.getElementById('mock-data-styles')) {
    const style = document.createElement('style');
    style.id = 'mock-data-styles';
    style.textContent = `
.dataset-type {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.type-Sales {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.type-Analytics {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.type-Financial {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.analysis-type {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.type-statistical {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.type-behavioral {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.type-predictive {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.template-category {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.category-Business {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.category-Analytics {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.category-Financial {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.datasets:hover {
    border-color: var(--primary-color);
}

.generators:hover {
    border-color: var(--primary-color);
}

.analysis:hover {
    border-color: var(--primary-color);
}

.templates:hover {
    border-color: var(--primary-color);
}
`;
    document.head.appendChild(style);
}

// Make functions globally available for navigation
window.showMockDataAnalysis = showMockDataAnalysis;
window.showMockDataTab = showMockDataTab;
window.generateNewData = generateNewData;
window.openDataGenerationWizard = openDataGenerationWizard;
window.runAnalysis = runAnalysis;
window.runAnalysisConfiguration = runAnalysisConfiguration;
window.exportResults = exportResults;
window.exportAnalysisResults = exportAnalysisResults;
window.filterDatasets = filterDatasets;
window.viewDataset = viewDataset;
window.analyzeDataset = analyzeDataset;
window.downloadDataset = downloadDataset;
window.refreshDataset = refreshDataset;
window.createCustomGenerator = createCustomGenerator;
window.configureGenerator = configureGenerator;
window.createTemplate = createTemplate;
window.exportAnalysis = exportAnalysis;
window.shareAnalysis = shareAnalysis;
window.rerunAnalysis = rerunAnalysis;

console.log('✅ Mock Data Analysis module loaded');
