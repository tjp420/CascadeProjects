// Help Module
console.log('❓ Help module loading...');

// Mock help data
const helpData = {
    quickStart: {
        title: 'Quick Start Guide',
        description: 'Get started with the AI Dashboard in minutes',
        sections: [
            {
                id: 'getting-started',
                title: 'Getting Started',
                content: 'Welcome to the AI Dashboard! This comprehensive tool helps you analyze code complexity, track project performance, and manage technical debt.',
                steps: [
                    'Navigate to the Dashboard Overview to see key metrics',
                    'Use the Complexity Analysis to identify code issues',
                    'Set up automated backups for your projects',
                    'Configure notifications to stay informed'
                ]
            },
            {
                id: 'navigation',
                title: 'Navigation Guide',
                content: 'The dashboard is organized into logical sections for easy access to different features.',
                sections: [
                    'Technical Debt: Core analysis and metrics',
                    'Tools: Data upload, analysis, and debugging tools',
                    'Planning: Roadmap, team management, and reports',
                    'Settings: Configuration and system preferences'
                ]
            },
            {
                id: 'first-analysis',
                title: 'Running Your First Analysis',
                content: 'Start analyzing your codebase with these simple steps.',
                steps: [
                    'Click on "Directory Analyzer" in the Tools section',
                    'Select the directory you want to analyze',
                    'Choose analysis options (complexity, quality, security)',
                    'Click "Start Analysis" and wait for results',
                    'Review the detailed report and recommendations'
                ]
            }
        ]
    },
    documentation: {
        sections: [
            {
                id: 'overview',
                title: 'Dashboard Overview',
                icon: 'fas fa-chart-line',
                description: 'Main dashboard showing key metrics and system health',
                features: [
                    'Real-time performance metrics',
                    'Technical debt indicators',
                    'Project status overview',
                    'Quick access to all features'
                ]
            },
            {
                id: 'complexity-analysis',
                title: 'Complexity Analysis',
                icon: 'fas fa-code',
                description: 'Analyze code complexity and identify improvement areas',
                features: [
                    'Cyclomatic complexity metrics',
                    'Code quality scoring',
                    'Hotspot identification',
                    'Refactoring recommendations'
                ]
            },
            {
                id: 'performance-metrics',
                title: 'Performance Metrics',
                icon: 'fas fa-tachometer-alt',
                description: 'Monitor system and application performance',
                features: [
                    'Response time tracking',
                    'Resource utilization',
                    'Error rate monitoring',
                    'Performance trends'
                ]
            },
            {
                id: 'backup-manager',
                title: 'Backup Manager',
                icon: 'fas fa-database',
                description: 'Automated backup and recovery system',
                features: [
                    'Scheduled backups',
                    'Cloud storage integration',
                    'Encryption and compression',
                    'Restore functionality'
                ]
            },
            {
                id: 'reports',
                title: 'Reports',
                icon: 'fas fa-file-alt',
                description: 'Generate comprehensive reports and analytics',
                features: [
                    'Custom report templates',
                    'Automated scheduling',
                    'Multiple export formats',
                    'Interactive dashboards'
                ]
            }
        ]
    },
    tutorials: [
        {
            id: 'tutorial_001',
            title: 'Setting Up Your First Project',
            duration: '5 min',
            difficulty: 'beginner',
            description: 'Learn how to configure and analyze your first project',
            steps: [
                'Create a new project configuration',
                'Connect your code repository',
                'Configure analysis settings',
                'Run initial analysis',
                'Review results and set up monitoring'
            ],
            videoUrl: 'https://example.com/tutorial1.mp4'
        },
        {
            id: 'tutorial_002',
            title: 'Understanding Complexity Metrics',
            duration: '8 min',
            difficulty: 'intermediate',
            description: 'Deep dive into complexity analysis and interpretation',
            steps: [
                'What is cyclomatic complexity',
                'How to interpret complexity scores',
                'Identifying code hotspots',
                'Prioritizing refactoring efforts',
                'Best practices for reducing complexity'
            ],
            videoUrl: 'https://example.com/tutorial2.mp4'
        },
        {
            id: 'tutorial_003',
            title: 'Automated Backup Configuration',
            duration: '6 min',
            difficulty: 'beginner',
            description: 'Set up automated backups for peace of mind',
            steps: [
                'Choose backup storage location',
                'Configure backup schedule',
                'Set up encryption options',
                'Test backup and restore',
                'Monitor backup health'
            ],
            videoUrl: 'https://example.com/tutorial3.mp4'
        }
    ],
    faq: [
        {
            id: 'faq_001',
            category: 'General',
            question: 'What is the AI Dashboard?',
            answer: 'The AI Dashboard is a comprehensive tool for analyzing code complexity, tracking technical debt, and monitoring project performance. It provides real-time insights and automated analysis to help improve code quality.'
        },
        {
            id: 'faq_002',
            category: 'Analysis',
            question: 'How often should I run complexity analysis?',
            answer: 'We recommend running analysis after major code changes, weekly for active projects, or monthly for stable projects. You can also set up automated analysis on a schedule.'
        },
        {
            id: 'faq_003',
            category: 'Performance',
            question: 'What affects analysis performance?',
            answer: 'Analysis performance depends on codebase size, complexity, available system resources, and selected analysis options. Large projects may take several minutes to complete.'
        },
        {
            id: 'faq_004',
            category: 'Backups',
            question: 'Are my backups secure?',
            answer: 'Yes, all backups are encrypted using industry-standard AES-256 encryption. You can also configure additional security measures like custom encryption keys.'
        },
        {
            id: 'faq_005',
            category: 'Reports',
            question: 'Can I customize report templates?',
            answer: 'Yes, the dashboard provides a template editor where you can create custom report layouts, add your branding, and configure specific metrics to include.'
        },
        {
            id: 'faq_006',
            category: 'Integration',
            question: 'Does the dashboard integrate with other tools?',
            answer: 'Yes, we support integrations with popular tools like Slack, email services, and various APIs. Check the Settings > Integrations section for available options.'
        }
    ],
    troubleshooting: [
        {
            id: 'troubleshoot_001',
            category: 'Analysis Issues',
            title: 'Analysis is taking too long',
            symptoms: ['Analysis running for more than 30 minutes', 'System appears unresponsive'],
            causes: ['Large codebase size', 'Insufficient system resources', 'Complex analysis options selected'],
            solutions: [
                'Reduce analysis scope to specific directories',
                'Disable optional analysis features',
                'Increase system resources if possible',
                'Schedule analysis during off-peak hours'
            ]
        },
        {
            id: 'troubleshoot_002',
            category: 'Backup Problems',
            title: 'Backup failed to complete',
            symptoms: ['Backup error messages', 'Missing backup files'],
            causes: ['Insufficient storage space', 'Network connectivity issues', 'Permission problems'],
            solutions: [
                'Check available storage space',
                'Verify network connection to backup location',
                'Ensure proper read/write permissions',
                'Try manual backup to diagnose issue'
            ]
        },
        {
            id: 'troubleshoot_003',
            category: 'Performance',
            title: 'Dashboard loading slowly',
            symptoms: ['Slow page loads', 'Delayed data updates'],
            causes: ['Large dataset', 'Browser cache issues', 'Network problems'],
            solutions: [
                'Clear browser cache and cookies',
                'Check internet connection speed',
                'Reduce data refresh frequency',
                'Use browser with better performance'
            ]
        }
    ],
    support: {
        contact: {
            email: 'support@aidashboard.com',
            phone: '1-800-AI-DASH',
            chat: 'Available 24/7',
            responseTime: 'Within 2 hours'
        },
        resources: [
            {
                title: 'Community Forum',
                description: 'Connect with other users and share experiences',
                url: 'https://community.aidashboard.com'
            },
            {
                title: 'Video Tutorials',
                description: 'Step-by-step video guides for all features',
                url: 'https://tutorials.aidashboard.com'
            },
            {
                title: 'API Documentation',
                description: 'Complete API reference and examples',
                url: 'https://docs.aidashboard.com/api'
            },
            {
                title: 'Best Practices Guide',
                description: 'Industry best practices for code analysis',
                url: 'https://docs.aidashboard.com/best-practices'
            }
        ]
    }
};

// Show help
function showHelp(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-question-circle"></i> Help Center
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="contactSupport()">
                        <i class="fas fa-headset"></i> Contact Support
                    </button>
                    <button class="btn btn-secondary" onclick="searchHelp()">
                        <i class="fas fa-search"></i> Search
                    </button>
                </div>
            </div>
            
            <!-- Help Search -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <i class="fas fa-search" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                    <input type="text" placeholder="Search for help articles, tutorials, or FAQs..." style="flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <button class="btn btn-primary" onclick="performHelpSearch()">
                        Search
                    </button>
                </div>
            </div>
            
            <!-- Help Tabs -->
            <div class="help-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showHelpTab('quickstart')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Quick Start
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('documentation')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Documentation
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('tutorials')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Tutorials
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('faq')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        FAQ
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('troubleshooting')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Troubleshooting
                    </button>
                    <button class="tab-btn" onclick="showHelpTab('support')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Support
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="help-tab-content">
                ${getQuickStartContent()}
            </div>
        </div>
    `;
}

// Get quick start content
function getQuickStartContent() {
    return `
        <div class="quick-start">
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 2rem; margin-bottom: 2rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1rem;">${helpData.quickStart.title}</h3>
                    <p style="color: var(--text-secondary);">${helpData.quickStart.description}</p>
                </div>
                
                <div style="display: grid; gap: 2rem;">
                    ${helpData.quickStart.sections.map(section => `
                        <div style="border-left: 4px solid var(--primary-color); padding-left: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin-bottom: 1rem;">${section.title}</h4>
                            <p style="color: var(--text-secondary); margin-bottom: 1rem;">${section.content}</p>
                            ${section.steps ? `
                                <div style="display: grid; gap: 0.5rem;">
                                    ${section.steps.map((step, index) => `
                                        <div style="display: flex; align-items: flex-start; gap: 1rem;">
                                            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">
                                                ${index + 1}
                                            </div>
                                            <p style="color: var(--text-primary); margin: 0;">${step}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div style="text-align: center;">
                <button class="btn btn-primary" onclick="startInteractiveTour()">
                    <i class="fas fa-play"></i> Start Interactive Tour
                </button>
                <button class="btn btn-secondary" onclick="downloadQuickStartGuide()">
                    <i class="fas fa-download"></i> Download Guide
                </button>
            </div>
        </div>
    `;
}

// Get documentation content
function getDocumentationContent() {
    return `
        <div class="documentation">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                ${helpData.documentation.sections.map(doc => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="width: 48px; height: 48px; border-radius: 8px; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                                <i class="${doc.icon}" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${doc.title}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${doc.description}</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Key Features:</div>
                            <div style="display: grid; gap: 0.5rem;">
                                ${doc.features.map(feature => `
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <i class="fas fa-check-circle" style="color: var(--success-color); font-size: 0.9rem;"></i>
                                        <span style="color: var(--text-secondary); font-size: 0.9rem;">${feature}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="viewDocumentation('${doc.id}')">
                                <i class="fas fa-book"></i> View Docs
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="watchVideo('${doc.id}')">
                                <i class="fas fa-video"></i> Video
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get tutorials content
function getTutorialsContent() {
    return `
        <div class="tutorials">
            <div style="display: grid; gap: 1.5rem;">
                ${helpData.tutorials.map(tutorial => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items-start; margin-bottom: 1rem;">
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${tutorial.title}</h4>
                                <p style="color: var(--text-secondary); margin: 0.5rem 0;">${tutorial.description}</p>
                            </div>
                            <div style="text-align: right;">
                                <span class="difficulty-badge difficulty-${tutorial.difficulty}">${tutorial.difficulty}</span>
                                <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                                    <i class="fas fa-clock"></i> ${tutorial.duration}
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Steps:</div>
                            <div style="display: grid; gap: 0.5rem;">
                                ${tutorial.steps.map((step, index) => `
                                    <div style="display: flex; align-items: flex-start; gap: 1rem;">
                                        <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--bg-primary); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0;">
                                            ${index + 1}
                                        </div>
                                        <p style="color: var(--text-primary); margin: 0; font-size: 0.9rem;">${step}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-primary" onclick="startTutorial('${tutorial.id}')">
                                <i class="fas fa-play"></i> Start Tutorial
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="watchTutorialVideo('${tutorial.id}')">
                                <i class="fas fa-video"></i> Watch Video
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get FAQ content
function getFaqContent() {
    return `
        <div class="faq">
            <div style="margin-bottom: 1.5rem;">
                <select onchange="filterFAQ(this.value)" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="all">All Categories</option>
                    <option value="General">General</option>
                    <option value="Analysis">Analysis</option>
                    <option value="Performance">Performance</option>
                    <option value="Backups">Backups</option>
                    <option value="Reports">Reports</option>
                    <option value="Integration">Integration</option>
                </select>
            </div>
            
            <div style="display: grid; gap: 1rem;">
                ${helpData.faq.map(faq => `
                    <div class="faq-item" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                        <div style="padding: 1.5rem; cursor: pointer;" onclick="toggleFAQ('${faq.id}')">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span class="faq-category category-${faq.category}" style="margin-right: 0.5rem;">${faq.category}</span>
                                    <span style="color: var(--text-primary); font-weight: 500;">${faq.question}</span>
                                </div>
                                <i class="fas fa-chevron-down" id="faq-icon-${faq.id}" style="color: var(--text-secondary);"></i>
                            </div>
                        </div>
                        <div id="faq-answer-${faq.id}" style="display: none; padding: 0 1.5rem 1.5rem 1.5rem;">
                            <p style="color: var(--text-secondary); margin: 0;">${faq.answer}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get troubleshooting content
function getTroubleshootingContent() {
    return `
        <div class="troubleshooting">
            <div style="display: grid; gap: 1.5rem;">
                ${helpData.troubleshooting.map(issue => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--danger-color); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${issue.title}</h4>
                                <span style="color: var(--text-secondary); font-size: 0.9rem;">${issue.category}</span>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Symptoms:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${issue.symptoms.map(symptom => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${symptom}</span>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Possible Causes:</div>
                            <div style="display: grid; gap: 0.5rem;">
                                ${issue.causes.map(cause => `
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <i class="fas fa-arrow-right" style="color: var(--warning-color); font-size: 0.9rem;"></i>
                                        <span style="color: var(--text-secondary); font-size: 0.9rem;">${cause}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div>
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Solutions:</div>
                            <div style="display: grid; gap: 0.5rem;">
                                ${issue.solutions.map(solution => `
                                    <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                                        <i class="fas fa-check-circle" style="color: var(--success-color); font-size: 0.9rem; margin-top: 0.1rem;"></i>
                                        <span style="color: var(--text-primary); font-size: 0.9rem;">${solution}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get support content
function getSupportContent() {
    return `
        <div class="support">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <!-- Contact Information -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Contact Support</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <i class="fas fa-envelope" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Email</div>
                                <div style="color: var(--text-secondary);">${helpData.support.contact.email}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <i class="fas fa-phone" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Phone</div>
                                <div style="color: var(--text-secondary);">${helpData.support.contact.phone}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <i class="fas fa-comments" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Live Chat</div>
                                <div style="color: var(--text-secondary);">${helpData.support.contact.chat}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <i class="fas fa-clock" style="color: var(--primary-color); font-size: 1.2rem;"></i>
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">Response Time</div>
                                <div style="color: var(--text-secondary);">${helpData.support.contact.responseTime}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 1.5rem;">
                        <button class="btn btn-primary" onclick="openSupportTicket()">
                            <i class="fas fa-ticket-alt"></i> Open Support Ticket
                        </button>
                    </div>
                </div>
                
                <!-- Additional Resources -->
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                    <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Additional Resources</h3>
                    
                    <div style="display: grid; gap: 1rem;">
                        ${helpData.support.resources.map(resource => `
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items-center;">
                                    <div>
                                        <div style="color: var(--text-primary); font-weight: 500;">${resource.title}</div>
                                        <div style="color: var(--text-secondary); font-size: 0.9rem;">${resource.description}</div>
                                    </div>
                                    <button class="btn btn-sm btn-secondary" onclick="openResource('${resource.url}')">
                                        <i class="fas fa-external-link-alt"></i> Open
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function toggleFAQ(faqId) {
    const answer = document.getElementById(`faq-answer-${faqId}`);
    const icon = document.getElementById(`faq-icon-${faqId}`);
    
    if (answer.style.display === 'none') {
        answer.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        answer.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

// Tab switching
function showHelpTab(tabName) {
    const content = document.getElementById('help-tab-content');
    if (!content) {
        return;
    }
    
    // Update tab buttons
    document.querySelectorAll('.help-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });
    
    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';
    
    // Update content
    switch(tabName) {
    case 'quickstart':
        content.textContent = getQuickStartContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'documentation':
        content.textContent = getDocumentationContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'tutorials':
        content.textContent = getTutorialsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'faq':
        content.textContent = getFaqContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'troubleshooting':
        content.textContent = getTroubleshootingContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'support':
        content.textContent = getSupportContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function contactSupport() {
    console.log('Opening support contact...');
    
    // Create support contact modal
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
                <h3 style="color: var(--text-primary); margin: 0;">🎧 Contact Support</h3>
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Issue Type</label>
                    <select id="issueType" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="">Select issue type</option>
                        <option value="technical">Technical Issue</option>
                        <option value="billing">Billing Question</option>
                        <option value="feature">Feature Request</option>
                        <option value="bug">Bug Report</option>
                        <option value="general">General Question</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Priority</label>
                    <select id="issuePriority" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="">Select priority</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Subject</label>
                    <input type="text" id="issueSubject" placeholder="Enter issue subject" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Description</label>
                    <textarea id="issueDescription" placeholder="Describe your issue in detail" rows="4" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); resize: vertical;"></textarea>
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Email Address</label>
                    <input type="email" id="issueEmail" placeholder="your.email@example.com" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="confirmContactSupport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Submit Ticket
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

function confirmContactSupport() {
    const issueType = document.getElementById('issueType').value;
    const priority = document.getElementById('issuePriority').value;
    const subject = document.getElementById('issueSubject').value.trim();
    const description = document.getElementById('issueDescription').value.trim();
    const email = document.getElementById('issueEmail').value.trim();
    
    if (!issueType || !priority || !subject || !description || !email) {
        if (window.showNotification) {
            window.showNotification('Please fill in all required fields', 'warning');
        } else {
            alert('Please fill in all required fields');
        }
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (window.showNotification) {
            window.showNotification('Please enter a valid email address', 'warning');
        } else {
            alert('Please enter a valid email address');
        }
        return;
    }
    
    // Simulate submitting support ticket
    if (window.showNotification) {
        window.showNotification(`Support ticket created successfully! Ticket #${Date.now()} created`, 'success');
    } else {
        alert(`Support ticket created successfully! Ticket #${Date.now()} created`);
    }
    
    // Close modal
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
}

function searchHelp() {
    console.log('Opening help search...');
    
    // Create help search modal
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
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🔍 Search Help</h3>
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Search Query</label>
                    <input type="text" id="searchQuery" placeholder="Enter search terms..." style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Search Category</label>
                    <select id="searchCategory" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="">All Categories</option>
                        <option value="getting-started">Getting Started</option>
                        <option value="reports">Reports</option>
                        <option value="roadmap">Roadmap</option>
                        <option value="integrations">Integrations</option>
                        <option value="settings">Settings</option>
                        <option value="debug">Debug Tools</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Search Type</label>
                    <select id="searchType" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Content</option>
                        <option value="documentation">Documentation</option>
                        <option value="tutorials">Tutorials</option>
                        <option value="faq">FAQ</option>
                    </select>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="performHelpSearch()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Search
                </button>
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
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

function performHelpSearch() {
    console.log('Performing help search...');
    alert('Search results would be displayed here');
}

function startInteractiveTour() {
    console.log('Starting interactive tour...');
    alert('Interactive product tour would start here');
}

function downloadQuickStartGuide() {
    console.log('Downloading quick start guide...');
    alert('Quick start guide PDF would be downloaded here');
}

function viewDocumentation(docId) {
    console.log('Viewing documentation:', docId);
    alert(`Detailed documentation for ${docId} would be shown here`);
}

function watchVideo(docId) {
    console.log('Watching video for:', docId);
    alert(`Video tutorial for ${docId} would be played here`);
}

function startTutorial(tutorialId) {
    console.log('Starting tutorial:', tutorialId);
    alert(`Interactive tutorial ${tutorialId} would start here`);
}

function watchTutorialVideo(tutorialId) {
    console.log('Watching tutorial video:', tutorialId);
    alert(`Tutorial video ${tutorialId} would be played here`);
}

function filterFAQ(category) {
    console.log('Filtering FAQ by:', category);
    alert(`FAQ would be filtered to show only ${category} questions`);
}

function openSupportTicket() {
    console.log('Opening support ticket...');
    alert('Support ticket creation form would be shown here');
}

function openResource(url) {
    console.log('Opening resource:', url);
    alert(`Resource ${url} would be opened in a new tab`);
}

// Add styles for help badges
const style = document.createElement('style');
style.textContent = `
.difficulty-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.difficulty-beginner {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.difficulty-intermediate {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.difficulty-advanced {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.faq-category {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.category-General {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.category-Analysis {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.category-Performance {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.category-Backups {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.category-Reports {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-secondary);
}

.category-Integration {
    background: rgba(168, 85, 247, 0.1);
    color: var(--purple-color);
}

.faq-item:hover {
    border-color: var(--primary-color);
    cursor: pointer;
}

.faq-item:hover .faq-category {
    background: rgba(102, 126, 234, 0.2);
}

.troubleshooting:hover {
    border-color: var(--warning-color);
}

.support:hover {
    border-color: var(--primary-color);
}

#faq-icon {
    transition: transform 0.3s ease;
}
`;
document.head.appendChild(style);

console.log('✅ Help module loaded');
