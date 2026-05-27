/**
 * Roadmap Progress Tracker
 * Animated progress indicators and real-time progress tracking
 * Provides visual feedback for project completion and milestone tracking
 */

class RoadmapProgressTracker {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            animateProgress: true,
            showPercentages: true,
            showLabels: true,
            realTimeUpdates: true,
            updateInterval: 5000, // 5 seconds
            theme: 'dark',
            ...options
        };
        this.progressData = {};
        this.animationFrames = {};
        this.updateTimer = null;
        
        this.init();
    }

    /**
     * Initialize the progress tracker
     */
    init() {
        if (!this.container) {
            console.error('Progress tracker container not found');
            return;
        }

        this.setupStyles();
        this.createProgressStructure();
        this.bindEvents();
        
        if (this.options.realTimeUpdates) {
            this.startRealTimeUpdates();
        }
    }

    /**
     * Setup CSS styles for progress tracking
     */
    setupStyles() {
        const styleId = 'roadmap-progress-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .roadmap-progress-tracker {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .progress-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .progress-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .progress-subtitle {
                    color: #94a3b8;
                    font-size: 1rem;
                }

                .overall-progress {
                    margin-bottom: 2rem;
                }

                .overall-progress-bar {
                    background: rgba(30, 41, 59, 0.8);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                }

                .overall-progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .overall-progress-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .overall-progress-percentage {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #10b981;
                    text-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
                }

                .progress-bar-container {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 8px;
                    height: 24px;
                    overflow: hidden;
            position: relative;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%);
                    border-radius: 8px;
                    transition: width 1s ease-in-out;
                    position: relative;
                    overflow: hidden;
                }

                .progress-bar::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                    animation: shimmer 2s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .progress-segments {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                    margin-top: 2rem;
                }

                .progress-segment {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1.5rem;
                    transition: all 0.3s ease;
                }

                .progress-segment:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .segment-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .segment-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .segment-percentage {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #3b82f6;
                }

                .segment-progress-bar {
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 6px;
                    height: 12px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                }

                .segment-progress-fill {
                    height: 100%;
                    border-radius: 6px;
                    transition: width 1s ease-in-out;
                }

                .segment-progress-fill.completed {
                    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                }

                .segment-progress-fill.in-progress {
                    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
                }

                .segment-progress-fill.planned {
                    background: linear-gradient(90deg, #64748b 0%, #475569 100%);
                }

                .segment-details {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .segment-status {
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }

                .status-completed {
                    background: rgba(16, 185, 129, 0.2);
                    color: #10b981;
                    border: 1px solid #10b981;
                }

                .status-in-progress {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                    border: 1px solid #f59e0b;
                }

                .status-planned {
                    background: rgba(100, 116, 139, 0.2);
                    color: #94a3b8;
                    border: 1px solid #64748b;
                }

                .milestone-tracker {
                    margin-top: 2rem;
                }

                .milestone-header {
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 1rem;
                }

                .milestone-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .milestone-item {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    text-align: center;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }

                .milestone-item:hover {
                    transform: translateY(-2px);
                    border-color: #3b82f6;
                }

                .milestone-item.completed {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.1);
                }

                .milestone-item.in-progress {
                    border-color: #f59e0b;
                    background: rgba(245, 158, 11, 0.1);
                }

                .milestone-icon {
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                }

                .milestone-title {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.25rem;
                }

                .milestone-date {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .progress-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .stat-item {
                    text-align: center;
                    padding: 1rem;
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #3b82f6;
                    margin-bottom: 0.25rem;
                }

                .stat-label {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                }

                .animated-number {
                    display: inline-block;
                    transition: all 0.3s ease;
                }

                @keyframes countUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .progress-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                    animation: pulse 2s infinite;
                }

                .indicator-completed {
                    background: #10b981;
                }

                .indicator-in-progress {
                    background: #f59e0b;
                }

                .indicator-planned {
                    background: #64748b;
                }

                @media (max-width: 768px) {
                    .roadmap-progress-tracker {
                        padding: 1rem;
                    }

                    .progress-segments {
                        grid-template-columns: 1fr;
                    }

                    .milestone-grid {
                        grid-template-columns: 1fr;
                    }

                    .progress-stats {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the progress tracking structure
     */
    createProgressStructure() {
        this.container.textContent = `
            <div class="roadmap-progress-tracker">
                <div class="progress-header">
                    <h2 class="progress-title">Progress Tracking</h2>
                    <p class="progress-subtitle">Real-time project progress and milestone tracking</p>
                </div>

                <div class="overall-progress">
                    <div class="overall-progress-bar">
                        <div class="overall-progress-header">
                            <div class="overall-progress-title">Overall Project Progress</div>
                            <div class="overall-progress-percentage" id="overall-percentage">0%</div>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" id="overall-progress-bar" style="width: 0%"></div>
                        </div>
                    </div>
                </div>

                <div class="progress-segments" id="progress-segments">
                    <!-- Progress segments will be rendered here -->
                </div>

                <div class="milestone-tracker">
                    <div class="milestone-header">Key Milestones</div>
                    <div class="milestone-grid" id="milestone-grid">
                        <!-- Milestones will be rendered here -->
                    </div>
                </div>

                <div class="progress-stats" id="progress-stats">
                    <!-- Progress statistics will be rendered here -->
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load progress data and update display
     */
    async loadProgressData(roadmapData) {
        this.progressData = this.calculateProgress(roadmapData);
        this.updateOverallProgress();
        this.renderProgressSegments();
        this.renderMilestones();
        this.renderStats();
        
        if (this.options.animateProgress) {
            this.animateProgressBars();
        }
    }

    /**
     * Calculate progress from roadmap data
     */
    calculateProgress(roadmapData) {
        const phases = roadmapData.developmentPhases || [];
        const milestones = roadmapData.keyMilestones || [];
        const featureCategories = roadmapData.featureCategories || [];

        // Calculate overall progress
        const completedPhases = phases.filter(p => p.status === 'completed').length;
        const inProgressPhases = phases.filter(p => p.status === 'in-progress').length;
        const totalPhases = phases.length;
        
        const overallProgress = ((completedPhases + (inProgressPhases * 0.5)) / totalPhases) * 100;

        // Calculate category progress
        const categoryProgress = featureCategories.map(category => ({
            name: category.category,
            completed: category.completedFeatures,
            total: category.totalFeatures,
            percentage: category.completionRate,
            description: category.description
        }));

        return {
            overall: overallProgress,
            phases: phases,
            categories: categoryProgress,
            milestones: milestones,
            stats: {
                totalFeatures: featureCategories.reduce((sum, cat) => sum + cat.totalFeatures, 0),
                completedFeatures: featureCategories.reduce((sum, cat) => sum + cat.completedFeatures, 0),
                inProgressFeatures: featureCategories.reduce((sum, cat) => sum + (cat.totalFeatures - cat.completedFeatures), 0),
                completedMilestones: milestones.filter(m => m.status === 'completed').length,
                totalMilestones: milestones.length
            }
        };
    }

    /**
     * Update overall progress display
     */
    updateOverallProgress() {
        const percentageElement = document.getElementById('overall-percentage');
        const progressBar = document.getElementById('overall-progress-bar');
        
        if (percentageElement && progressBar) {
            const percentage = Math.round(this.progressData.overall);
            
            if (this.options.animateProgress) {
                this.animateNumber(percentageElement, 0, percentage, '%');
                setTimeout(() => {
                    progressBar.style.width = `${percentage}%`;
                }, 100);
            } else {
                percentageElement.textContent = `${percentage}%`;
                progressBar.style.width = `${percentage}%`;
            }
        }
    }

    /**
     * Render progress segments for categories
     */
    renderProgressSegments() {
        const segmentsContainer = document.getElementById('progress-segments');
        if (!segmentsContainer) return;

        segmentsContainer.textContent = '' /* Replaced innerHTML with textContent for safety */

        this.progressData.categories.forEach((category, index) => {
            const segmentElement = this.createProgressSegment(category, index);
            segmentsContainer.appendChild(segmentElement);
        });
    }

    /**
     * Create individual progress segment
     */
    createProgressSegment(category, index) {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'progress-segment';

        const statusClass = this.getProgressStatusClass(category.percentage);
        
        segmentDiv.textContent = `
            <div class="segment-header">
                <div class="segment-title">${category.name}</div>
                <div class="segment-percentage">${category.percentage}%</div>
            </div>
            <div class="segment-progress-bar">
                <div class="segment-progress-fill ${statusClass}" style="width: 0%" data-target-width="${category.percentage}%"></div>
            </div>
            <div class="segment-details">
                <span>${category.completed} / ${category.total} features</span>
                <span class="segment-status status-${statusClass}">${this.getProgressStatus(category.percentage)}</span>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        return segmentDiv;
    }

    /**
     * Render milestones
     */
    renderMilestones() {
        const milestoneGrid = document.getElementById('milestone-grid');
        if (!milestoneGrid) return;

        milestoneGrid.textContent = '' /* Replaced innerHTML with textContent for safety */

        this.progressData.milestones.forEach((milestone, index) => {
            const milestoneElement = this.createMilestoneItem(milestone, index);
            milestoneGrid.appendChild(milestoneElement);
        });
    }

    /**
     * Create milestone item
     */
    createMilestoneItem(milestone, index) {
        const milestoneDiv = document.createElement('div');
        milestoneDiv.className = `milestone-item ${milestone.status}`;

        const icon = this.getMilestoneIcon(milestone.status);

        milestoneDiv.textContent = `
            <div class="milestone-icon">${icon}</div>
            <div class="milestone-title">${milestone.milestone}</div>
            <div class="milestone-date">${this.formatDate(milestone.date)}</div>
        ` /* Replaced innerHTML with textContent for safety */

        return milestoneDiv;
    }

    /**
     * Render progress statistics
     */
    renderStats() {
        const statsContainer = document.getElementById('progress-stats');
        if (!statsContainer) return;

        const stats = this.progressData.stats;
        
        statsContainer.textContent = `
            <div class="stat-item">
                <div class="stat-value animated-number" data-target="${stats.totalFeatures}">0</div>
                <div class="stat-label">Total Features</div>
            </div>
            <div class="stat-item">
                <div class="stat-value animated-number" data-target="${stats.completedFeatures}">0</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-item">
                <div class="stat-value animated-number" data-target="${stats.inProgressFeatures}">0</div>
                <div class="stat-label">In Progress</div>
            </div>
            <div class="stat-item">
                <div class="stat-value animated-number" data-target="${stats.completedMilestones}">0</div>
                <div class="stat-label">Milestones</div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        if (this.options.animateProgress) {
            this.animateStats();
        }
    }

    /**
     * Animate progress bars
     */
    animateProgressBars() {
        setTimeout(() => {
            const progressFills = document.querySelectorAll('.segment-progress-fill');
            progressFills.forEach(fill => {
                const targetWidth = fill.dataset.targetWidth;
                setTimeout(() => {
                    fill.style.width = targetWidth;
                }, Math.random() * 500);
            });
        }, 100);
    }

    /**
     * Animate numbers
     */
    animateNumber(element, start, end, suffix = '') {
        const duration = 1000;
        const startTime = Date.now();
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (end - start) * progress);
            element.textContent = current + suffix;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    /**
     * Animate statistics
     */
    animateStats() {
        const statNumbers = document.querySelectorAll('.animated-number');
        statNumbers.forEach((element, index) => {
            const target = parseInt(element.dataset.target);
            setTimeout(() => {
                this.animateNumber(element, 0, target);
            }, index * 100);
        });
    }

    /**
     * Get progress status class
     */
    getProgressStatusClass(percentage) {
        if (percentage >= 100) return 'completed';
        if (percentage > 0) return 'in-progress';
        return 'planned';
    }

    /**
     * Get progress status text
     */
    getProgressStatus(percentage) {
        if (percentage >= 100) return 'Completed';
        if (percentage > 0) return 'In Progress';
        return 'Planned';
    }

    /**
     * Get milestone icon
     */
    getMilestoneIcon(status) {
        switch (status) {
            case 'completed': return '✅';
            case 'in-progress': return '🔄';
            case 'planned': return '⏳';
            default: return '📍';
        }
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(async () => {
            try {
                // Refresh data and update display
                const roadmapService = new RoadmapDataService();
                const roadmapData = await roadmapService.loadRoadmapData('gguf');
                await this.loadProgressData(roadmapData);
            } catch (error) {
                console.error('Failed to update progress data:', error);
            }
        }, this.options.updateInterval);
    }

    /**
     * Stop real-time updates
     */
    stopRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Add click handlers for milestones
        this.container.addEventListener('click', (e) => {
            const milestoneItem = e.target.closest('.milestone-item');
            if (milestoneItem) {
                this.handleMilestoneClick(milestoneItem);
            }
        });
    }

    /**
     * Handle milestone click
     */
    handleMilestoneClick(milestoneElement) {
        // Add visual feedback
        milestoneElement.style.transform = 'scale(0.95)';
        setTimeout(() => {
            milestoneElement.style.transform = '';
        }, 150);
    }

    /**
     * Update progress data
     */
    async updateProgress() {
        try {
            const roadmapService = new RoadmapDataService();
            const roadmapData = await roadmapService.loadRoadmapData('gguf');
            await this.loadProgressData(roadmapData);
        } catch (error) {
            console.error('Failed to update progress:', error);
        }
    }

    /**
     * Destroy progress tracker and cleanup
     */
    destroy() {
        this.stopRealTimeUpdates();
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        
        const styleElement = document.getElementById('roadmap-progress-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoadmapProgressTracker;
} else if (typeof window !== 'undefined') {
    window.RoadmapProgressTracker = RoadmapProgressTracker;
}
