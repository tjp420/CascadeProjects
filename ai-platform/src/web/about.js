// About Module
console.log('ℹ️ About module loading...');

// Mock about data
const aboutData = {
    product: {
        name: 'AI Coding Intelligence Dashboard',
        version: '2.1.0',
        build: '2024.05.20.1342',
        releaseDate: '2024-05-20',
        description: 'A comprehensive AI-powered dashboard for code analysis, technical debt tracking, and project performance monitoring.',
        tagline: 'Transform Your Code with Intelligent Insights',
        category: 'Development Tools',
        license: 'MIT License',
        platform: 'Web Application',
        architecture: 'Microservices-based',
        technologies: [
            'JavaScript', 'React', 'Node.js', 'Python', 'FastAPI',
            'Chart.js', 'Font Awesome', 'CSS Variables', 'REST API'
        ]
    },
    features: [
        {
            id: 'feature_001',
            name: 'Code Complexity Analysis',
            description: 'Advanced algorithms analyze code complexity, identify hotspots, and provide actionable insights for code improvement.',
            icon: 'fas fa-code',
            category: 'Analysis',
            status: 'active'
        },
        {
            id: 'feature_002',
            name: 'Technical Debt Tracking',
            description: 'Monitor and manage technical debt with visual indicators and prioritized refactoring recommendations.',
            icon: 'fas fa-chart-line',
            category: 'Monitoring',
            status: 'active'
        },
        {
            id: 'feature_003',
            name: 'Performance Metrics',
            description: 'Real-time performance monitoring with detailed metrics, trends, and optimization suggestions.',
            icon: 'fas fa-tachometer-alt',
            category: 'Performance',
            status: 'active'
        },
        {
            id: 'feature_004',
            name: 'Automated Backups',
            description: 'Secure, automated backup system with cloud integration and encryption.',
            icon: 'fas fa-database',
            category: 'Security',
            status: 'active'
        },
        {
            id: 'feature_005',
            name: 'Team Collaboration',
            description: 'Collaborative features for team-based development with role-based access control.',
            icon: 'fas fa-users',
            category: 'Collaboration',
            status: 'active'
        },
        {
            id: 'feature_006',
            name: 'Custom Reports',
            description: 'Generate comprehensive reports with customizable templates and automated scheduling.',
            icon: 'fas fa-file-alt',
            category: 'Reporting',
            status: 'active'
        }
    ],
    statistics: {
        totalUsers: '10,000+',
        projectsAnalyzed: '50,000+',
        linesOfCode: '100M+',
        bugsPrevented: '25,000+',
        uptime: '99.9%',
        responseTime: '< 200ms',
        supportedLanguages: 15,
        integrations: 25
    },
    team: [
        {
            id: 'team_001',
            name: 'Alex Chen',
            role: 'Lead Developer',
            department: 'Engineering',
            avatar: 'AC',
            bio: 'Full-stack developer with expertise in AI/ML integration and system architecture.',
            contributions: ['Core Architecture', 'AI Integration', 'Performance Optimization'],
            github: 'alexchen',
            linkedin: 'alexchen-dev'
        },
        {
            id: 'team_002',
            name: 'Sarah Rodriguez',
            role: 'Product Manager',
            department: 'Product',
            avatar: 'SR',
            bio: 'Product strategist focused on user experience and feature development.',
            contributions: ['Product Strategy', 'User Research', 'Feature Design'],
            github: 'sarahrodriguez',
            linkedin: 'sarah-rodriguez-pm'
        },
        {
            id: 'team_003',
            name: 'Michael Park',
            role: 'UI/UX Designer',
            department: 'Design',
            avatar: 'MP',
            bio: 'Creative designer specializing in intuitive interfaces and user experience.',
            contributions: ['UI Design', 'User Experience', 'Design System'],
            github: 'michaelpark',
            linkedin: 'michael-park-design'
        },
        {
            id: 'team_004',
            name: 'Emily Johnson',
            role: 'Backend Engineer',
            department: 'Engineering',
            avatar: 'EJ',
            bio: 'Backend specialist with expertise in APIs, databases, and cloud infrastructure.',
            contributions: ['API Development', 'Database Design', 'Cloud Integration'],
            github: 'emilyjohnson',
            linkedin: 'emily-johnson-eng'
        }
    ],
    roadmap: [
        {
            phase: 'Q3 2024',
            status: 'planned',
            features: [
                'AI-Powered Code Suggestions',
                'Advanced Security Scanning',
                'Mobile Application',
                'Enterprise Features'
            ]
        },
        {
            phase: 'Q4 2024',
            status: 'planned',
            features: [
                'Machine Learning Models',
                'Advanced Analytics',
                'Multi-tenant Support',
                'API v2.0'
            ]
        },
        {
            phase: 'Q1 2025',
            status: 'future',
            features: [
                'Real-time Collaboration',
                'Advanced Integrations',
                'Custom Plugins',
                'Performance AI'
            ]
        }
    ],
    testimonials: [
        {
            id: 'testimonial_001',
            name: 'David Thompson',
            company: 'TechCorp Solutions',
            role: 'CTO',
            quote: 'The AI Dashboard has transformed our development process. We\'ve reduced technical debt by 40% and improved code quality significantly.',
            rating: 5
        },
        {
            id: 'testimonial_002',
            name: 'Lisa Chen',
            company: 'Digital Innovations',
            role: 'Lead Developer',
            quote: 'The complexity analysis features are incredible. It helps us identify potential issues before they become problems.',
            rating: 5
        },
        {
            id: 'testimonial_003',
            name: 'James Wilson',
            company: 'StartupHub',
            role: 'Founder',
            quote: 'As a startup, we needed tools that could scale with us. The AI Dashboard provides enterprise-level insights at an affordable price.',
            rating: 4
        }
    ],
    partners: [
        {
            name: 'GitHub',
            logo: 'fab fa-github',
            description: 'Integration with GitHub for seamless code analysis and repository management.',
            tier: 'strategic'
        },
        {
            name: 'AWS',
            logo: 'fab fa-aws',
            description: 'Cloud infrastructure partner for scalable hosting and services.',
            tier: 'strategic'
        },
        {
            name: 'Microsoft',
            logo: 'fab fa-microsoft',
            description: 'Technology partner for development tools and platforms.',
            tier: 'technology'
        },
        {
            name: 'Google',
            logo: 'fab fa-google',
            description: 'AI and machine learning technology collaboration.',
            tier: 'technology'
        }
    ],
    awards: [
        {
            name: 'Best Development Tool 2024',
            organization: 'Tech Awards',
            date: '2024-03-15',
            category: 'Development Tools'
        },
        {
            name: 'Innovation in AI',
            organization: 'AI Conference',
            date: '2024-01-20',
            category: 'Artificial Intelligence'
        },
        {
            name: 'User Choice Award',
            organization: 'Dev Community',
            date: '2023-11-10',
            category: 'Community Choice'
        }
    ]
};

// Show about
function showAbout(container) {
    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <i class="fas fa-info-circle"></i> About
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="contactSales()">
                        <i class="fas fa-phone"></i> Contact Sales
                    </button>
                    <button class="btn btn-secondary" onclick="downloadBrochure()">
                        <i class="fas fa-download"></i> Download Brochure
                    </button>
                </div>
            </div>
            
            <!-- Product Overview -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 2rem; margin-bottom: 2rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h1 style="color: var(--text-primary); margin-bottom: 0.5rem;">${aboutData.product.name}</h1>
                    <p style="color: var(--text-secondary); font-size: 1.2rem; margin-bottom: 1rem;">${aboutData.product.tagline}</p>
                    <p style="color: var(--text-secondary); max-width: 800px; margin: 0 auto;">${aboutData.product.description}</p>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                        <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">Version ${aboutData.product.version}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Current Release</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                        <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">${aboutData.product.build}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Build Number</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                        <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">${aboutData.product.license}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">License</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                        <div style="color: var(--text-primary); font-weight: bold; font-size: 1.2rem;">${formatDate(aboutData.product.releaseDate)}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Release Date</div>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Technologies</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                        ${aboutData.product.technologies.map(tech => `
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${tech}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- About Tabs -->
            <div class="about-tabs" style="margin-bottom: 2rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button class="tab-btn active" onclick="showAboutTab('features')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--primary-color); border-bottom: 2px solid var(--primary-color); cursor: pointer;">
                        Features
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('statistics')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Statistics
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('team')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Team
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('roadmap')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Roadmap
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('testimonials')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Testimonials
                    </button>
                    <button class="tab-btn" onclick="showAboutTab('partners')" style="padding: 0.75rem 1.5rem; background: none; border: none; color: var(--text-secondary); cursor: pointer;">
                        Partners
                    </button>
                </div>
            </div>
            
            <!-- Tab Content -->
            <div id="about-tab-content">
                ${getFeaturesContent()}
            </div>
        </div>
    `;
}

// Get features content
function getFeaturesContent() {
    return `
        <div class="features">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
                ${aboutData.features.map(feature => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="width: 48px; height: 48px; border-radius: 8px; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                                <i class="${feature.icon}" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${feature.name}</h4>
                                <span class="feature-category category-${feature.category}">${feature.category}</span>
                            </div>
                        </div>
                        
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${feature.description}</p>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="feature-status status-${feature.status}">${feature.status}</span>
                            <button class="btn btn-sm btn-secondary" onclick="learnMore('${feature.id}')">
                                <i class="fas fa-info-circle"></i> Learn More
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get statistics content
function getStatisticsContent() {
    return `
        <div class="statistics">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                ${Object.entries(aboutData.statistics).map(([key, value]) => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                        <div style="color: var(--primary-color); font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem;">${value}</div>
                        <div style="color: var(--text-secondary);">${formatStatLabel(key)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get team content
function getTeamContent() {
    return `
        <div class="team">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                ${aboutData.team.map(member => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div class="team-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--success-color)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                                ${member.avatar}
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${member.name}</h4>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${member.role}</p>
                                <p style="color: var(--text-secondary); margin: 0; font-size: 0.8rem;">${member.department}</p>
                            </div>
                        </div>
                        
                        <p style="color: var(--text-secondary); margin-bottom: 1rem;">${member.bio}</p>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Key Contributions:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${member.contributions.map(contribution => `
                                    <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px;">${contribution}</span>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm btn-secondary" onclick="openSocial('github', '${member.github}')">
                                <i class="fab fa-github"></i>
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="openSocial('linkedin', '${member.linkedin}')">
                                <i class="fab fa-linkedin"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get roadmap content
function getRoadmapContent() {
    return `
        <div class="roadmap">
            <div style="display: grid; gap: 1.5rem;">
                ${aboutData.roadmap.map(phase => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="color: var(--text-primary); margin: 0;">${phase.phase}</h4>
                            <span class="roadmap-status status-${phase.status}">${phase.status}</span>
                        </div>
                        
                        <div style="display: grid; gap: 0.5rem;">
                            ${phase.features.map(feature => `
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-rocket" style="color: var(--primary-color); font-size: 0.9rem;"></i>
                                    <span style="color: var(--text-primary);">${feature}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get testimonials content
function getTestimonialsContent() {
    return `
        <div class="testimonials">
            <div style="display: grid; gap: 1.5rem;">
                ${aboutData.testimonials.map(testimonial => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            ${Array(testimonial.rating).fill(0).map(() => '<i class="fas fa-star" style="color: var(--warning-color);"></i>').join('')}
                        </div>
                        
                        <p style="color: var(--text-primary); font-style: italic; margin-bottom: 1rem;">"${testimonial.quote}"</p>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">${testimonial.name}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">${testimonial.role} at ${testimonial.company}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Get partners content
function getPartnersContent() {
    return `
        <div class="partners">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                ${aboutData.partners.map(partner => `
                    <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="width: 48px; height: 48px; border-radius: 8px; background: var(--bg-primary); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
                                <i class="${partner.logo}" style="font-size: 1.5rem;"></i>
                            </div>
                            <div>
                                <h4 style="color: var(--text-primary); margin: 0;">${partner.name}</h4>
                                <span class="partner-tier tier-${partner.tier}">${partner.tier}</span>
                            </div>
                        </div>
                        
                        <p style="color: var(--text-secondary);">${partner.description}</p>
                    </div>
                `).join('')}
            </div>
            
            <!-- Awards Section -->
            <div style="margin-top: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Awards & Recognition</h3>
                <div style="display: grid; gap: 1rem;">
                    ${aboutData.awards.map(award => `
                        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 6px;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--warning-color); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="fas fa-trophy"></i>
                            </div>
                            <div style="flex: 1;">
                                <div style="color: var(--text-primary); font-weight: 500;">${award.name}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">${award.organization} • ${formatDate(award.date)}</div>
                            </div>
                            <span style="color: var(--text-secondary); font-size: 0.8rem; background: var(--card-bg); padding: 0.25rem 0.5rem; border-radius: 4px;">${award.category}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatStatLabel(key) {
    const labels = {
        totalUsers: 'Total Users',
        projectsAnalyzed: 'Projects Analyzed',
        linesOfCode: 'Lines of Code',
        bugsPrevented: 'Bugs Prevented',
        uptime: 'Uptime',
        responseTime: 'Response Time',
        supportedLanguages: 'Supported Languages',
        integrations: 'Integrations'
    };
    return labels[key] || key;
}

// Tab switching
function showAboutTab(tabName) {
    const content = document.getElementById('about-tab-content');
    if (!content) {
        return;
    }
    
    // Update tab buttons
    document.querySelectorAll('.about-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottom = 'none';
    });
    
    event.target.classList.add('active');
    event.target.style.color = 'var(--primary-color)';
    event.target.style.borderBottom = '2px solid var(--primary-color)';
    
    // Update content
    switch(tabName) {
    case 'features':
        content.textContent = getFeaturesContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'statistics':
        content.textContent = getStatisticsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'team':
        content.textContent = getTeamContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'roadmap':
        content.textContent = getRoadmapContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'testimonials':
        content.textContent = getTestimonialsContent() /* Replaced innerHTML with textContent for safety */
        break;
    case 'partners':
        content.textContent = getPartnersContent() /* Replaced innerHTML with textContent for safety */
        break;
    }
}

// Action functions
function contactSales() {
    console.log('Contacting sales...');
    
    // Create sales contact modal
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
                <h3 style="color: var(--text-primary); margin: 0;">📞 Contact Sales</h3>
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Company Name</label>
                    <input type="text" id="companyName" placeholder="Enter your company name" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Your Name</label>
                    <input type="text" id="contactName" placeholder="Enter your name" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Email Address</label>
                    <input type="email" id="contactEmail" placeholder="your.email@example.com" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Phone Number</label>
                    <input type="tel" id="contactPhone" placeholder="+1 (555) 123-4567" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Product Interest</label>
                    <select id="productInterest" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="">Select product tier</option>
                        <option value="starter">Starter Plan</option>
                        <option value="professional">Professional Plan</option>
                        <option value="enterprise">Enterprise Plan</option>
                        <option value="custom">Custom Solution</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Message</label>
                    <textarea id="salesMessage" placeholder="Tell us about your needs and how we can help..." rows="4" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); resize: vertical;"></textarea>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="confirmContactSales()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Submit Inquiry
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

function confirmContactSales() {
    const companyName = document.getElementById('companyName').value.trim();
    const contactName = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();
    const productInterest = document.getElementById('productInterest').value;
    const message = document.getElementById('salesMessage').value.trim();
    
    if (!companyName || !contactName || !email || !message) {
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
    
    // Simulate submitting sales inquiry
    if (window.showNotification) {
        window.showNotification('Sales inquiry submitted successfully! Our team will contact you within 24 hours.', 'success');
    } else {
        alert('Sales inquiry submitted successfully! Our team will contact you within 24 hours.');
    }
    
    // Close modal
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) {
        modal.remove();
    }
}

function downloadBrochure() {
    console.log('Downloading brochure...');
    
    // Create brochure data
    const brochureData = {
        title: 'AI Dashboard - Product Brochure',
        version: '2.0.0',
        date: new Date().toISOString(),
        company: {
            name: 'AI Dashboard Solutions',
            website: 'www.aidashboard.com',
            email: 'info@aidashboard.com',
            phone: '+1 (555) 123-4567'
        },
        products: [
            {
                name: 'Starter Plan',
                price: '$99/month',
                features: [
                    'Basic Analytics Dashboard',
                    '5 User Accounts',
                    'Email Support',
                    'Monthly Reports',
                    '1GB Storage'
                ],
                description: 'Perfect for small teams getting started with AI-powered analytics.'
            },
            {
                name: 'Professional Plan',
                price: '$299/month',
                features: [
                    'Advanced Analytics Dashboard',
                    '25 User Accounts',
                    'Priority Email Support',
                    'Weekly Reports',
                    '10GB Storage',
                    'API Access',
                    'Custom Integrations'
                ],
                description: 'Ideal for growing businesses needing comprehensive analytics solutions.'
            },
            {
                name: 'Enterprise Plan',
                price: 'Custom Pricing',
                features: [
                    'Unlimited Analytics Dashboard',
                    'Unlimited User Accounts',
                    '24/7 Phone Support',
                    'Real-time Reports',
                    'Unlimited Storage',
                    'Full API Access',
                    'Custom Integrations',
                    'Dedicated Account Manager',
                    'On-premise Deployment Option'
                ],
                description: 'Tailored solutions for large enterprises with specific requirements.'
            }
        ],
        features: [
            'Real-time Data Processing',
            'Machine Learning Insights',
            'Customizable Dashboards',
            'Multi-channel Data Integration',
            'Advanced Security Features',
            'Scalable Architecture',
            '24/7 Monitoring',
            'Comprehensive Support'
        ],
        testimonials: [
            {
                company: 'TechCorp Solutions',
                quote: 'AI Dashboard has transformed how we analyze our data. The insights are invaluable.',
                author: 'John Smith, CTO'
            },
            {
                company: 'Global Analytics Inc.',
                quote: 'The most comprehensive analytics platform we\'ve ever used. Highly recommended.',
                author: 'Sarah Johnson, Data Science Lead'
            }
        ],
        contact: {
            sales: 'sales@aidashboard.com',
            support: 'support@aidashboard.com',
            phone: '+1 (555) 123-4567',
            website: 'www.aidashboard.com'
        }
    };
    
    // Create and download PDF-like JSON file
    const jsonString = JSON.stringify(brochureData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-dashboard-brochure-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Show success message
    if (window.showNotification) {
        window.showNotification('Product brochure downloaded successfully!', 'success');
    } else {
        alert('Product brochure downloaded successfully!');
    }
}

function learnMore(featureId) {
    console.log('Learning more about feature:', featureId);
    alert(`Detailed information for feature ${featureId} would be shown here`);
}

function openSocial(platform, username) {
    console.log('Opening social profile:', platform, username);
    alert(`${platform} profile for ${username} would be opened in a new tab`);
}

// Add styles for about badges
const aboutStyle = document.createElement('style');
aboutStyle.textContent = `
.feature-category {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.category-Analysis {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.category-Monitoring {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.category-Performance {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.category-Security {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.category-Collaboration {
    background: rgba(168, 85, 247, 0.1);
    color: var(--purple-color);
}

.category-Reporting {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-secondary);
}

.feature-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-active {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.status-planned {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-future {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-secondary);
}

.roadmap-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.partner-tier {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.tier-strategic {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.tier-technology {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.tier-premium {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success-color);
}

.team-avatar:hover {
    cursor: pointer;
    opacity: 0.8;
}

.features:hover {
    border-color: var(--primary-color);
}

.statistics:hover {
    border-color: var(--primary-color);
}

.team:hover {
    border-color: var(--primary-color);
}

.roadmap:hover {
    border-color: var(--primary-color);
}

.testimonials:hover {
    border-color: var(--primary-color);
}

.partners:hover {
    border-color: var(--primary-color);
}
`;
document.head.appendChild(aboutStyle);

console.log('✅ About module loaded');
