/**
 * Natural Language Query Service
 * 
 * Processes natural language queries and converts them to:
 * - Database queries
 * - API calls
 * - Dashboard interactions
 * - AI analysis requests
 */

const EventEmitter = require('events');
const natural = require('natural');
const compromise = require('compromise');

class NLQueryService extends EventEmitter {
    constructor() {
        super();
        
        this.tokenizer = new natural.WordTokenizer();
        this.stemmer = natural.PorterStemmer;
        this.classifier = new natural.BayesClassifier();
        
        // Intent patterns
        this.intentPatterns = {
            'show': /\b(show|display|view|list|get)\b/i,
            'analyze': /\b(analyze|examine|investigate|study|review)\b/i,
            'compare': /\b(compare|versus|vs|against|difference)\b/i,
            'generate': /\b(generate|create|build|make|produce)\b/i,
            'search': /\b(search|find|lookup|query)\b/i,
            'filter': /\b(filter|where|with|only|exclude)\b/i,
            'aggregate': /\b(count|sum|average|total|min|max)\b/i,
            'trend': /\b(trend|history|timeline|progression|over time)\b/i,
            'ranking': /\b(top|bottom|best|worst|highest|lowest)\b/i
        };
        
        // Entity patterns
        this.entityPatterns = {
            'time': /\b(today|yesterday|this week|last month|last 30 days|last quarter|this year)\b/i,
            'metrics': /\b(performance|quality|security|coverage|issues|bugs|errors)\b/i,
            'repositories': /\b(repo|repository|project|codebase)\b/i,
            'teams': /\b(team|developer|engineer|analyst)\b/i,
            'models': /\b(model|ai|ml|machine learning|neural network)\b/i,
            'data': /\b(data|dataset|database|table|records)\b/i
        };
        
        // Query templates
        this.queryTemplates = {
            'show_metrics': 'SELECT {metric} FROM metrics WHERE {time_filter}',
            'analyze_performance': 'CALL analyze_performance({repository}, {time_range})',
            'compare_entities': 'SELECT * FROM comparison WHERE entity1={entity1} AND entity2={entity2}',
            'trend_analysis': 'SELECT {metric}, timestamp FROM trends WHERE {time_filter} ORDER BY timestamp',
            'ranking_query': 'SELECT {entity}, {metric} FROM rankings ORDER BY {metric} {direction} LIMIT {limit}'
        };
        
        // Initialize classifier
        this.initializeClassifier();
    }
    
    /**
     * Initialize the intent classifier
     */
    initializeClassifier() {
        // Training data for intent classification
        const trainingData = [
            { text: 'show me code quality trends', intent: 'show_trend' },
            { text: 'display performance metrics', intent: 'show_metrics' },
            { text: 'analyze security issues', intent: 'analyze_security' },
            { text: 'compare repository A vs B', intent: 'compare_repos' },
            { text: 'generate a report', intent: 'generate_report' },
            { text: 'find all bugs', intent: 'search_issues' },
            { text: 'filter by critical issues', intent: 'filter_issues' },
            { text: 'count total commits', intent: 'aggregate_count' },
            { text: 'top performing repositories', intent: 'ranking_top' },
            { text: 'worst security scores', intent: 'ranking_bottom' }
        ];
        
        // Train the classifier
        trainingData.forEach(({ text, intent }) => {
            this.classifier.addDocument(text, intent);
        });
        
        this.classifier.train();
    }
    
    /**
     * Process natural language query
     */
    async processQuery(query, context = {}) {
        try {
            const startTime = Date.now();
            
            // Parse and classify query
            const parsed = await this.parseQuery(query, context);
            
            // Generate execution plan
            const plan = await this.generateExecutionPlan(parsed);
            
            // Execute query
            const result = await this.executeQuery(plan);
            
            // Format response
            const response = await this.formatResponse(result, parsed);
            
            const processingTime = Date.now() - startTime;
            
            this.emit('query-processed', {
                query,
                parsed,
                plan,
                processingTime,
                resultCount: Array.isArray(result) ? result.length : 1
            });
            
            return {
                success: true,
                query,
                intent: parsed.intent,
                entities: parsed.entities,
                response,
                processingTime,
                suggestions: await this.generateSuggestions(parsed)
            };
            
        } catch (error) {
            this.emit('query-error', { query, error });
            return {
                success: false,
                query,
                error: error.message,
                suggestions: await this.generateErrorSuggestions(query, error)
            };
        }
    }
    
    /**
     * Parse natural language query
     */
    async parseQuery(query, context) {
        const tokens = this.tokenizer.tokenize(query.toLowerCase());
        const doc = compromise(query);
        
        // Extract intent
        const intent = this.extractIntent(query, tokens);
        
        // Extract entities
        const entities = this.extractEntities(query, doc, tokens);
        
        // Extract time range
        const timeRange = this.extractTimeRange(query, entities);
        
        // Extract filters
        const filters = this.extractFilters(query, tokens);
        
        // Extract aggregations
        const aggregations = this.extractAggregations(tokens);
        
        return {
            original: query,
            tokens,
            intent,
            entities,
            timeRange,
            filters,
            aggregations,
            context
        };
    }
    
    /**
     * Extract intent from query
     */
    extractIntent(query, _tokens) {
        // Use classifier for primary intent
        const classifiedIntent = this.classifier.classify(query);
        
        // Use pattern matching for verification
        for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
            if (pattern.test(query)) {
                return `${intent}_${classifiedIntent}`;
            }
        }
        
        return classifiedIntent;
    }
    
    /**
     * Extract entities from query
     */
    extractEntities(query, doc, tokens) {
        const entities = {};
        
        // Time entities
        entities.time = this.extractTimeEntities(doc);
        
        // Metric entities
        entities.metrics = this.extractMetricEntities(tokens);
        
        // Repository entities
        entities.repositories = this.extractRepositoryEntities(doc);
        
        // Team entities
        entities.teams = this.extractTeamEntities(doc);
        
        // Model entities
        entities.models = this.extractModelEntities(tokens);
        
        // Data entities
        entities.data = this.extractDataEntities(tokens);
        
        return entities;
    }
    
    /**
     * Extract time range
     */
    extractTimeRange(query, _entities) {
        const timePatterns = {
            'today': { start: 'today', end: 'today' },
            'yesterday': { start: 'yesterday', end: 'yesterday' },
            'this week': { start: 'monday', end: 'sunday' },
            'last week': { start: 'last monday', end: 'last sunday' },
            'last 30 days': { start: '30 days ago', end: 'today' },
            'last month': { start: 'last month start', end: 'last month end' },
            'last quarter': { start: 'last quarter start', end: 'last quarter end' },
            'this year': { start: 'jan 1', end: 'dec 31' }
        };
        
        for (const [pattern, range] of Object.entries(timePatterns)) {
            if (query.toLowerCase().includes(pattern)) {
                return range;
            }
        }
        
        return { start: '30 days ago', end: 'today' }; // Default
    }
    
    /**
     * Extract filters from query
     */
    extractFilters(query, _tokens) {
        const filters = {};
        
        // Status filters
        if (query.includes('critical') || query.includes('high')) {
            filters.severity = 'critical';
        } else if (query.includes('low') || query.includes('minor')) {
            filters.severity = 'low';
        }
        
        // State filters
        if (query.includes('open') || query.includes('active')) {
            filters.state = 'open';
        } else if (query.includes('closed') || query.includes('resolved')) {
            filters.state = 'closed';
        }
        
        // Type filters
        if (query.includes('bug') || query.includes('issue')) {
            filters.type = 'bug';
        } else if (query.includes('feature') || query.includes('enhancement')) {
            filters.type = 'feature';
        }
        
        return filters;
    }
    
    /**
     * Extract aggregations from query
     */
    extractAggregations(tokens) {
        const aggregations = [];
        
        if (tokens.includes('count') || tokens.includes('total')) {
            aggregations.push('count');
        }
        
        if (tokens.includes('sum') || tokens.includes('total')) {
            aggregations.push('sum');
        }
        
        if (tokens.includes('average') || tokens.includes('avg')) {
            aggregations.push('average');
        }
        
        if (tokens.includes('min') || tokens.includes('minimum')) {
            aggregations.push('min');
        }
        
        if (tokens.includes('max') || tokens.includes('maximum')) {
            aggregations.push('max');
        }
        
        return aggregations;
    }
    
    /**
     * Generate execution plan
     */
    async generateExecutionPlan(parsed) {
        const plan = {
            intent: parsed.intent,
            steps: [],
            dataSources: [],
            operations: []
        };
        
        // Determine data sources based on entities
        if (parsed.entities.metrics) {
            plan.dataSources.push('metrics_db');
        }
        
        if (parsed.entities.repositories) {
            plan.dataSources.push('repository_api');
        }
        
        if (parsed.entities.models) {
            plan.dataSources.push('model_registry');
        }
        
        // Generate execution steps
        switch (parsed.intent) {
            case 'show_trend':
                plan.steps.push({
                    type: 'query',
                    operation: 'time_series',
                    params: {
                        metric: parsed.entities.metrics?.[0] || 'performance',
                        timeRange: parsed.timeRange
                    }
                });
                break;
                
            case 'analyze_security':
                plan.steps.push({
                    type: 'query',
                    operation: 'security_analysis',
                    params: {
                        filters: parsed.filters,
                        timeRange: parsed.timeRange
                    }
                });
                break;
                
            case 'compare_repos':
                plan.steps.push({
                    type: 'query',
                    operation: 'comparison',
                    params: {
                        entities: parsed.entities.repositories,
                        metrics: parsed.entities.metrics
                    }
                });
                break;
                
            default:
                plan.steps.push({
                    type: 'query',
                    operation: 'generic',
                    params: parsed
                });
        }
        
        return plan;
    }
    
    /**
     * Execute query plan
     */
    async executeQuery(plan) {
        const results = [];
        
        for (const step of plan.steps) {
            try {
                const result = await this.executeStep(step);
                results.push(result);
            } catch (error) {
                console.error(`[NL Query] Step execution failed:`, error);
                results.push({ error: error.message });
            }
        }
        
        return results;
    }
    
    /**
     * Execute individual step
     */
    async executeStep(step) {
        // This would integrate with your actual data sources
        // For now, return mock data
        
        switch (step.operation) {
            case 'time_series':
                return this.generateMockTimeSeries(step.params);
                
            case 'security_analysis':
                return this.generateMockSecurityAnalysis(step.params);
                
            case 'comparison':
                return this.generateMockComparison(step.params);
                
            default:
                return this.generateMockResponse(step.params);
        }
    }
    
    /**
     * Format response
     */
    async formatResponse(results, parsed) {
        const response = {
            type: parsed.intent,
            summary: this.generateSummary(results, parsed),
            data: results,
            visualizations: this.generateVisualizations(results, parsed),
            insights: this.generateInsights(results, parsed)
        };
        
        return response;
    }
    
    /**
     * Generate suggestions
     */
    async generateSuggestions(parsed) {
        const suggestions = [];
        
        // Suggest follow-up queries
        if (parsed.intent === 'show_trend') {
            suggestions.push('Show me the detailed breakdown');
            suggestions.push('Compare with previous period');
        }
        
        if (parsed.intent === 'analyze_security') {
            suggestions.push('Show me the most critical issues');
            suggestions.push('Filter by repository');
        }
        
        return suggestions;
    }
    
    /**
     * Generate error suggestions
     */
    async generateErrorSuggestions(_query, _error) {
        return [
            'Try rephrasing your query',
            'Check if the entities exist',
            'Use more specific terms'
        ];
    }
    
    // Mock data generators (replace with real implementations)
    
    generateMockTimeSeries(_params) {
        const data = [];
        const days = 30;
        
        for (let i = 0; i < days; i++) {
            data.push({
                date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                value: Math.random() * 100
            });
        }
        
        return { type: 'time_series', data };
    }
    
    generateMockSecurityAnalysis(_params) {
        return {
            type: 'security_analysis',
            data: {
                critical: Math.floor(Math.random() * 10),
                high: Math.floor(Math.random() * 20),
                medium: Math.floor(Math.random() * 30),
                low: Math.floor(Math.random() * 40)
            }
        };
    }
    
    generateMockComparison(_params) {
        return {
            type: 'comparison',
            data: {
                entity1: { score: Math.random() * 100 },
                entity2: { score: Math.random() * 100 }
            }
        };
    }
    
    generateMockResponse(params) {
        return {
            type: 'generic',
            data: { message: 'Query processed successfully', params }
        };
    }
    
    generateSummary(results, parsed) {
        return `Found ${results.length} results for ${parsed.intent} query`;
    }
    
    generateVisualizations(results, parsed) {
        const visualizations = [];
        
        if (parsed.intent.includes('trend')) {
            visualizations.push({
                type: 'line_chart',
                title: 'Trend Analysis',
                data: results[0]?.data || []
            });
        }
        
        if (parsed.intent.includes('analyze')) {
            visualizations.push({
                type: 'bar_chart',
                title: 'Analysis Results',
                data: results[0]?.data || []
            });
        }
        
        return visualizations;
    }
    
    generateInsights(results, _parsed) {
        const insights = [];
        
        if (results[0]?.data) {
            insights.push('Data shows interesting patterns');
            insights.push('Consider investigating further');
        }
        
        return insights;
    }
    
    // Helper entity extraction methods
    
    extractTimeEntities(doc) {
        const dates = doc.dates().out('array');
        return dates.map(date => ({ type: 'date', value: date }));
    }
    
    extractMetricEntities(tokens) {
        const metrics = ['performance', 'quality', 'security', 'coverage', 'bugs', 'issues'];
        return tokens.filter(token => metrics.includes(token))
                   .map(token => ({ type: 'metric', value: token }));
    }
    
    extractRepositoryEntities(doc) {
        // Look for repository names or patterns
        const repos = doc.match('#Repository').out('array');
        return repos.map(repo => ({ type: 'repository', value: repo }));
    }
    
    extractTeamEntities(doc) {
        const teams = doc.match('#Person').out('array');
        return teams.map(team => ({ type: 'team', value: team }));
    }
    
    extractModelEntities(tokens) {
        const models = ['model', 'ai', 'ml', 'neural', 'network'];
        return tokens.filter(token => models.some(model => token.includes(model)))
                   .map(token => ({ type: 'model', value: token }));
    }
    
    extractDataEntities(tokens) {
        const data = ['data', 'dataset', 'database', 'table', 'record'];
        return tokens.filter(token => data.includes(token))
                   .map(token => ({ type: 'data', value: token }));
    }
}

module.exports = NLQueryService;
