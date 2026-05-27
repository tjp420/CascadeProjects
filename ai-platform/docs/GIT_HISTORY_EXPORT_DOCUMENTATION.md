# Git History Export Feature Documentation

## Overview

The Git History Export feature provides comprehensive repository analysis and reporting capabilities for the AI Coding Intelligence Dashboard. It supports integration with local Git repositories, GitHub, and GitLab, offering detailed insights into development activity, contributor statistics, and project health metrics.

## Features

### 🔍 **Repository Analysis**
- **Multi-provider Support**: Local Git, GitHub, GitLab
- **Commit History**: Detailed timeline with statistics
- **Branch Overview**: All branches with ahead/behind tracking
- **Contributor Analytics**: Comprehensive contributor statistics
- **Development Metrics**: Activity patterns and quality indicators

### 📊 **Reporting Capabilities**
- **Comprehensive Reports**: Complete repository analysis
- **Export Formats**: JSON, CSV, HTML, PDF
- **Visual Charts**: Activity timelines and contributor distributions
- **AI Insights**: Pattern recognition and recommendations
- **Health Scoring**: Repository health assessment

### 🚀 **Advanced Features**
- **Batch Processing**: Multiple repositories simultaneously
- **Real-time Analysis**: Live data updates
- **Custom Date Ranges**: Flexible time period filtering
- **Search Functionality**: Find commits by message, author, or file
- **Comparison Tools**: Branch and time period comparisons

## Architecture

### Core Components

#### 1. GitHistoryExporter Class
**Location**: `js/git-history-export.js`

The main class that handles Git repository analysis across different providers:

```javascript
const exporter = new GitHistoryExporter({
    provider: 'local', // 'github', 'gitlab', 'local'
    repoPath: './',
    branch: 'main',
    since: '2024-01-01',
    until: '2024-12-31'
});

const report = await exporter.exportHistoryReport();
```

**Key Methods**:
- `initialize()` - Set up connection to Git provider
- `exportHistoryReport()` - Generate comprehensive report
- `exportToFormat(report, format)` - Export to different formats
- `fetchCommits()` - Retrieve commit history
- `generateContributorStats()` - Analyze contributor data

#### 2. GitAPIIntegration Class
**Location**: `js/git-api-integration.js`

Provides unified API interface for Git operations:

```javascript
const api = new GitAPIIntegration(apiClient);
const metrics = await api.getMetrics({
    repoPath: './my-project',
    branch: 'main',
    includeInsights: true
});
```

**Key Methods**:
- `getCommits(options)` - Fetch commits with filtering
- `getContributors(options)` - Get contributor statistics
- `generateReport(options)` - Create comprehensive reports
- `batchExport(repositories, options)` - Process multiple repos
- `getHealthAssessment(repoPath)` - Repository health check

#### 3. GitHistoryServer Class
**Location**: `git-history-server.js`

Node.js server providing REST API endpoints:

```javascript
const server = new GitHistoryServer(8082);
server.start(); // Starts on port 8082
```

**Available Endpoints**:
- `GET /api/git/status` - Server status and capabilities
- `POST /api/git/repositories` - Repository information
- `GET /api/git/commits` - Commit history
- `POST /api/git/contributors` - Contributor statistics
- `POST /api/git/export` - Generate reports
- `POST /api/git/metrics` - Development metrics

### 4. Web Interface
**Location**: `git-history-export.html`

Modern web interface for repository analysis:

- **Configuration Panel**: Set up repository connections
- **Real-time Charts**: Interactive data visualization
- **Export Options**: Multiple format support
- **Insights Dashboard**: AI-powered recommendations

## Installation and Setup

### Prerequisites
- Node.js 16+ (for server component)
- Git installed (for local repository analysis)
- API tokens for GitHub/GitLab (optional)

### Quick Start

1. **Start the Git History Server**:
```bash
node git-history-server.js
```

2. **Open the Web Interface**:
```bash
# Open in browser
open git-history-export.html
```

3. **Configure Repository**:
   - Select provider (Local, GitHub, GitLab)
   - Enter repository details
   - Set date range and options

4. **Generate Report**:
   - Click "Generate Report"
   - View interactive results
   - Export in preferred format

### API Integration

#### Using the JavaScript Library

```javascript
// Import the library
import { GitHistoryExporter } from './js/git-history-export.js';

// Initialize with configuration
const exporter = new GitHistoryExporter({
    provider: 'github',
    repoPath: 'owner/repository',
    apiToken: 'your-github-token',
    branch: 'main'
});

// Generate report
const report = await exporter.exportHistoryReport();

// Export to JSON
const jsonReport = await exporter.exportToFormat(report, 'json');
```

#### Using the REST API

```bash
# Get repository information
curl -X POST http://localhost:8082/api/git/repositories \
  -H "Content-Type: application/json" \
  -d '{"repo_path": "./my-project"}'

# Get commit history
curl "http://localhost:8082/api/git/commits?repo_path=./my-project&limit=50"

# Generate report
curl -X POST http://localhost:8082/api/git/export \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "./my-project",
    "branch": "main",
    "format": "json",
    "include_insights": true
  }'
```

## Configuration

### Local Repository Setup

For local Git repositories, ensure:

1. **Git Repository**: Directory must be a Git repository
2. **Permissions**: Read access to the repository
3. **Path**: Correct path to the repository

```javascript
const exporter = new GitHistoryExporter({
    provider: 'local',
    repoPath: '/path/to/your/repository',
    branch: 'main'
});
```

### GitHub Integration

1. **API Token**: Generate a GitHub personal access token
2. **Permissions**: Required scopes: `repo`, `read:org`
3. **Repository Format**: `owner/repository`

```javascript
const exporter = new GitHistoryExporter({
    provider: 'github',
    repoPath: 'owner/repository',
    apiToken: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    branch: 'main'
});
```

### GitLab Integration

1. **API Token**: Generate a GitLab personal access token
2. **Permissions**: Required scopes: `read_repository`, `read_api`
3. **Project ID**: Numeric ID or `group/project` path

```javascript
const exporter = new GitHistoryExporter({
    provider: 'gitlab',
    repoPath: '12345', // or 'group/project'
    apiToken: 'glpat-xxxxxxxxxxxxxxxxxxx',
    apiUrl: 'https://gitlab.com' // optional for self-hosted
});
```

## API Reference

### GitHistoryExporter Methods

#### `initialize()`
Initialize connection to the Git provider.

```javascript
await exporter.initialize();
```

**Returns**: `Promise<boolean>` - Success status

#### `exportHistoryReport()`
Generate comprehensive repository report.

```javascript
const report = await exporter.exportHistoryReport();
```

**Returns**: `Promise<Object>` - Complete report data

**Report Structure**:
```javascript
{
    metadata: {
        name: "repository-name",
        path: "/path/to/repo",
        provider: "local|github|gitlab",
        branch: "main"
    },
    timeline: [
        {
            hash: "abc123",
            message: "Commit message",
            author: {
                name: "Author Name",
                email: "author@example.com",
                date: "2024-01-01T12:00:00Z"
            },
            stats: {
                additions: 100,
                deletions: 20,
                total: 120
            }
        }
    ],
    branches: {
        total: 5,
        branches: [...],
        default: "main"
    },
    contributors: {
        total: 10,
        contributors: [...],
        topContributors: [...]
    },
    metrics: {
        overview: {...},
        activity: {...},
        codeQuality: {...},
        trends: {...}
    },
    insights: {
        healthScore: 85,
        patterns: [...],
        recommendations: [...],
        risks: [...],
        achievements: [...]
    }
}
```

#### `exportToFormat(report, format)`
Export report to specified format.

```javascript
const jsonReport = await exporter.exportToFormat(report, 'json');
const csvReport = await exporter.exportToFormat(report, 'csv');
const htmlReport = await exporter.exportToFormat(report, 'html');
```

**Parameters**:
- `report`: Object - Report data from `exportHistoryReport()`
- `format`: String - `'json'`, `'csv'`, `'html'`, `'pdf'`

**Returns**: `Promise<string|Blob>` - Exported data

### REST API Endpoints

#### `POST /api/git/repositories`
Get repository information.

**Request Body**:
```json
{
    "repo_path": "./my-project",
    "include_stats": true
}
```

**Response**:
```json
{
    "name": "my-project",
    "path": "./my-project",
    "remoteUrl": "https://github.com/owner/repo.git",
    "currentBranch": "main",
    "totalCommits": 1234,
    "isGitRepo": true
}
```

#### `GET /api/git/commits`
Get commit history.

**Query Parameters**:
- `repo_path`: Repository path
- `branch`: Branch name (default: main)
- `limit`: Number of commits (default: 100)
- `since`: Start date (ISO format)
- `until`: End date (ISO format)
- `include_stats`: Include statistics (true/false)
- `include_files`: Include file list (true/false)

**Response**:
```json
{
    "commits": [
        {
            "hash": "abc123",
            "author": {...},
            "committer": {...},
            "message": "Commit message",
            "stats": {...},
            "files": ["file1.js", "file2.js"]
        }
    ]
}
```

#### `POST /api/git/contributors`
Get contributor statistics.

**Request Body**:
```json
{
    "repo_path": "./my-project",
    "branch": "main",
    "since": "2024-01-01",
    "until": "2024-12-31",
    "include_details": true
}
```

**Response**:
```json
{
    "total": 5,
    "contributors": [...],
    "topContributors": [...],
    "summary": {
        "avgCommitsPerContributor": 246.8,
        "totalAdditions": 15000,
        "totalDeletions": 3000,
        "totalChanges": 18000
    }
}
```

#### `POST /api/git/export`
Generate comprehensive report.

**Request Body**:
```json
{
    "repo_path": "./my-project",
    "branch": "main",
    "since": "2024-01-01",
    "until": "2024-12-31",
    "format": "json",
    "include_insights": true,
    "include_recommendations": true
}
```

**Response**: Complete report object (same structure as `exportHistoryReport()`)

## Data Models

### Commit Object
```javascript
{
    hash: "string",           // Commit SHA
    message: "string",        // Commit message
    author: {
        name: "string",       // Author name
        email: "string",      // Author email
        date: "string"         // Author date (ISO format)
    },
    committer: {
        name: "string",       // Committer name
        email: "string",      // Committer email
        date: "string"         // Committer date (ISO format)
    },
    stats: {
        additions: "number",   // Lines added
        deletions: "number",   // Lines deleted
        total: "number"        // Total lines changed
    },
    files: ["string"]         // List of changed files (optional)
}
```

### Contributor Object
```javascript
{
    name: "string",           // Contributor name
    email: "string",          // Contributor email
    commits: "number",        // Number of commits
    additions: "number",      // Lines added
    deletions: "number",      // Lines deleted
    firstCommit: "string",    // First commit date
    lastCommit: "string",     // Last commit date
    files: "number",          // Number of files modified
    daysActive: "number",     // Number of active days
    avgCommitsPerDay: "number", // Average commits per day
    totalChanges: "number",    // Total lines changed
    netChange: "number"        // Net change (additions - deletions)
}
```

### Metrics Object
```javascript
{
    overview: {
        totalCommits: "number",
        totalContributors: "number",
        dateRange: {
            first: "string",
            last: "string"
        },
        activeDays: "number"
    },
    activity: {
        commitsByMonth: "object",
        commitsByDay: "object",
        commitsByHour: "object",
        commitsByWeekday: "object"
    },
    codeQuality: {
        avgCommitsPerDay: "number",
        avgFilesPerCommit: "number",
        avgChangesPerCommit: "number",
        mergeRate: "number"
    },
    trends: {
        growthRate: "string",
        activityTrend: "string",
        contributorTrend: "string"
    }
}
```

## Examples

### Basic Usage Example

```javascript
// Initialize exporter
const exporter = new GitHistoryExporter({
    provider: 'local',
    repoPath: './my-project',
    branch: 'main'
});

// Generate report
try {
    await exporter.initialize();
    const report = await exporter.exportHistoryReport();
    
    console.log(`Repository: ${report.metadata.name}`);
    console.log(`Total commits: ${report.metrics.overview.totalCommits}`);
    console.log(`Contributors: ${report.contributors.total}`);
    console.log(`Health score: ${report.insights.healthScore}`);
    
    // Export to JSON
    const jsonReport = await exporter.exportToFormat(report, 'json');
    console.log('Report exported successfully');
} catch (error) {
    console.error('Error:', error.message);
}
```

### Advanced Example with Custom Analysis

```javascript
const exporter = new GitHistoryExporter({
    provider: 'github',
    repoPath: 'owner/repository',
    apiToken: process.env.GITHUB_TOKEN,
    branch: 'develop',
    since: '2024-01-01',
    until: '2024-06-30'
});

await exporter.initialize();

// Get specific data
const commits = await exporter.fetchCommits();
const contributors = await exporter.generateContributorStats();
const metrics = await exporter.generateDevelopmentMetrics();

// Custom analysis
const avgCommitsPerContributor = contributors.summary.avgCommitsPerContributor;
const mostActiveDay = Object.keys(metrics.activity.commitsByWeekday)
    .reduce((a, b) => metrics.activity.commitsByWeekday[a] > metrics.activity.commitsByWeekday[b] ? a : b);

console.log(`Average commits per contributor: ${avgCommitsPerContributor}`);
console.log(`Most active day: ${mostActiveDay}`);

// Generate insights
const insights = await exporter.generateInsights();
console.log('Recommendations:', insights.recommendations);
```

### Server API Example

```javascript
// Using fetch with the REST API
const response = await fetch('http://localhost:8082/api/git/export', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        repo_path: './my-project',
        branch: 'main',
        include_insights: true
    })
});

const report = await response.json();
console.log('Generated report:', report);
```

## Troubleshooting

### Common Issues

#### 1. "Not a Git repository" Error
**Cause**: The specified path is not a Git repository
**Solution**: Ensure the path points to a valid Git repository with `.git` directory

#### 2. GitHub API Authentication Failed
**Cause**: Invalid or missing API token
**Solution**: 
- Generate a new personal access token
- Ensure token has `repo` scope
- Check token is correctly passed to the exporter

#### 3. Git Command Not Found
**Cause**: Git is not installed or not in PATH
**Solution**: Install Git or add to system PATH

#### 4. Permission Denied
**Cause**: Insufficient permissions to access repository
**Solution**: Check file/directory permissions and Git repository access

### Debug Mode

Enable debug logging:

```javascript
const exporter = new GitHistoryExporter({
    provider: 'local',
    repoPath: './my-project',
    debug: true // Enable debug logging
});
```

### Performance Optimization

For large repositories:

1. **Limit Date Range**: Use specific date ranges instead of full history
2. **Reduce Data**: Disable file lists and detailed stats when not needed
3. **Caching**: Enable caching for repeated requests
4. **Pagination**: Use pagination for large commit sets

```javascript
const exporter = new GitHistoryExporter({
    provider: 'local',
    repoPath: './my-project',
    since: '2024-01-01', // Limit to recent commits
    includeFiles: false,   // Exclude file lists
    cacheTimeout: 600000   // 10 minute cache
});
```

## Security Considerations

### API Tokens
- Store API tokens securely (environment variables, secure storage)
- Use minimal required scopes
- Rotate tokens regularly
- Never commit tokens to version control

### Local Repository Access
- Validate repository paths to prevent directory traversal
- Check file permissions before accessing
- Use sandboxed environments when possible

### Data Privacy
- Sensitive data (commit messages, author info) may be included
- Consider data retention policies
- Implement access controls for shared repositories

## Contributing

### Development Setup

1. **Clone Repository**: `git clone <repository-url>`
2. **Install Dependencies**: `npm install`
3. **Run Tests**: `npm test`
4. **Start Development Server**: `npm run dev`

### Adding New Features

1. **Create Feature Branch**: `git checkout -b feature/new-feature`
2. **Implement Feature**: Add code and tests
3. **Update Documentation**: Update this README
4. **Submit Pull Request**: Create PR with description

### Code Style

- Use ES6+ syntax
- Follow existing naming conventions
- Add JSDoc comments for public methods
- Include error handling and validation

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues and questions:

1. **Documentation**: Check this README and inline code comments
2. **Issues**: Create an issue on the project repository
3. **Discussions**: Start a discussion for questions
4. **Email**: Contact the maintainers directly

## Changelog

### Version 1.0.0
- Initial release
- Support for local, GitHub, and GitLab repositories
- Comprehensive reporting and analytics
- Web interface with interactive charts
- REST API server
- Multiple export formats

### Future Roadmap

- [ ] Real-time WebSocket updates
- [ ] Advanced visualization options
- [ ] Custom report templates
- [ ] Integration with CI/CD systems
- [ ] Mobile-responsive interface
- [ ] Advanced search and filtering
- [ ] Team collaboration features
