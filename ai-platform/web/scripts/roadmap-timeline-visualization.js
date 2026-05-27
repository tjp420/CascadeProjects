/**
 * Roadmap Timeline Visualization
 * Interactive timeline component for development phases
 * Provides animated progress indicators and interactive elements
 */

class RoadmapTimelineVisualization {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            animateOnLoad: true,
            showProgressBars: true,
            interactivePhases: true,
            theme: 'dark',
            ...options
        };
        this.phases = [];
        this.currentPhase = 0;
        this.animationDuration = 1000;
        
        this.init();
    }

    /**
     * Initialize the timeline visualization
     */
    init() {
        if (!this.container) {
            console.error('Container element not found');
            return;
        }

        this.setupStyles();
        this.createTimelineStructure();
        this.bindEvents();
    }

    /**
     * Setup CSS styles for the timeline
     */
    setupStyles() {
        const styleId = 'roadmap-timeline-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .roadmap-timeline {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 12px;
                    padding: 2rem;
                    margin: 1rem 0;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(148, 163, 184, 0.1);
                }

                .timeline-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .timeline-title {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .timeline-subtitle {
                    color: #94a3b8;
                    font-size: 1.1rem;
                }

                .timeline-container {
                    position: relative;
                    padding: 1rem 0;
                }

                .timeline-line {
                    position: absolute;
                    top: 50%;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
                    border-radius: 2px;
                    transform: translateY(-50%);
                    z-index: 1;
                }

                .timeline-progress {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
                    border-radius: 2px;
                    transition: width 1s ease-in-out;
                    z-index: 2;
                }

                .timeline-phases {
                    display: flex;
                    justify-content: space-between;
                    position: relative;
                    z-index: 3;
                    margin: 0 1rem;
                }

                .timeline-phase {
                    flex: 1;
                    text-align: center;
                    position: relative;
                    cursor: pointer;
                    transition: transform 0.3s ease, margin-top 0.3s ease;
                }

                .timeline-phase:hover {
                    transform: translateY(-5px);
                    margin-top: -5px;
                }

                .timeline-phase.active {
                    transform: translateY(-10px);
                    margin-top: -10px;
                }

                .phase-marker {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #1e293b;
                    border: 4px solid #3b82f6;
                    margin: 0 auto 1rem;
                    position: relative;
                    transition: all 0.3s ease;
                }

                .timeline-phase.completed .phase-marker {
                    background: #10b981;
                    border-color: #10b981;
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
                }

                .timeline-phase.in-progress .phase-marker {
                    background: #f59e0b;
                    border-color: #f59e0b;
                    box-shadow: 0 0 20px rgba(245, 158, 11, 0.5);
                    animation: pulse 2s infinite;
                }

                .timeline-phase.planned .phase-marker {
                    background: #64748b;
                    border-color: #64748b;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }

                .phase-content {
                    background: rgba(30, 41, 59, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 0 0.5rem;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }

                .timeline-phase:hover .phase-content {
                    background: rgba(30, 41, 59, 0.95);
                    border-color: #3b82f6;
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                }

                .phase-number {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #3b82f6;
                    margin-bottom: 0.5rem;
                }

                .phase-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                    margin-bottom: 0.5rem;
                }

                .phase-status {
                    display: inline-block;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
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

                .phase-date {
                    font-size: 0.9rem;
                    color: #64748b;
                    margin-bottom: 0.5rem;
                }

                .phase-description {
                    font-size: 0.9rem;
                    color: #94a3b8;
                    line-height: 1.4;
                    margin-bottom: 0.5rem;
                }

                .phase-metrics {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 0.5rem;
                    padding-top: 0.5rem;
                    border-top: 1px solid rgba(148, 163, 184, 0.1);
                }

                .metric {
                    text-align: center;
                }

                .metric-value {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #f8fafc;
                }

                .metric-label {
                    font-size: 0.7rem;
                    color: #64748b;
                    text-transform: uppercase;
                }

                .phase-details {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }

                .timeline-phase.active .phase-details {
                    max-height: 500px;
                }

                .deliverables {
                    margin-top: 0.5rem;
                }

                .deliverable {
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 4px;
                    padding: 0.25rem 0.5rem;
                    margin: 0.25rem 0;
                    font-size: 0.8rem;
                    color: #93c5fd;
                }

                @media (max-width: 768px) {
                    .roadmap-timeline {
                        padding: 1rem;
                    }

                    .timeline-phases {
                        flex-direction: column;
                        gap: 2rem;
                    }

                    .timeline-line {
                        width: 4px;
                        height: 100%;
                        top: 0;
                        left: 50%;
                        transform: translateX(-50%);
                    }

                    .timeline-progress {
                        width: 100%;
                        height: auto;
                    }

                    .phase-content {
                        margin: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create the basic timeline structure
     */
    createTimelineStructure() {
        this.container.textContent = `
            <div class="roadmap-timeline">
                <div class="timeline-header">
                    <h2 class="timeline-title">Development Roadmap Timeline</h2>
                    <p class="timeline-subtitle">Interactive visualization of project phases</p>
                </div>
                <div class="timeline-container">
                    <div class="timeline-line">
                        <div class="timeline-progress" id="timeline-progress"></div>
                    </div>
                    <div class="timeline-phases" id="timeline-phases"></div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
    }

    /**
     * Load phases data and render timeline
     */
    async loadPhases(phasesData) {
        this.phases = phasesData;
        this.renderPhases();
        
        if (this.options.animateOnLoad) {
            this.animateOnLoad();
        }
        
        this.updateProgress();
    }

    /**
     * Render all phases in the timeline
     */
    renderPhases() {
        const phasesContainer = document.getElementById('timeline-phases');
        phasesContainer.textContent = '' /* Replaced innerHTML with textContent for safety */

        this.phases.forEach((phase, index) => {
            const phaseElement = this.createPhaseElement(phase, index);
            phasesContainer.appendChild(phaseElement);
        });
    }

    /**
     * Create individual phase element
     */
    createPhaseElement(phase, index) {
        const phaseDiv = document.createElement('div');
        phaseDiv.className = `timeline-phase ${phase.status}`;
        phaseDiv.dataset.phaseIndex = index;

        const deliverables = phase.deliverables.map(deliverable => 
            `<div class="deliverable">${deliverable}</div>`
        ).join('');

        phaseDiv.textContent = `
            <div class="phase-marker"></div>
            <div class="phase-content">
                <div class="phase-number">Phase ${phase.phase}</div>
                <div class="phase-title">${phase.title}</div>
                <div class="phase-status status-${phase.status}">${this.formatStatus(phase.status)}</div>
                <div class="phase-date">${this.formatDate(phase.date)}</div>
                <div class="phase-description">${phase.description}</div>
                <div class="phase-metrics">
                    <div class="metric">
                        <div class="metric-value">${phase.metrics.completion}</div>
                        <div class="metric-label">Complete</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${phase.metrics.teamSize}</div>
                        <div class="metric-label">Team</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${phase.metrics.milestones}</div>
                        <div class="metric-label">Milestones</div>
                    </div>
                </div>
                <div class="phase-details">
                    <div class="deliverables">
                        <strong>Deliverables:</strong>
                        ${deliverables}
                    </div>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */

        return phaseDiv;
    }

    /**
     * Bind interactive events
     */
    bindEvents() {
        const phasesContainer = document.getElementById('timeline-phases');
        
        phasesContainer.addEventListener('click', (e) => {
            const phaseElement = e.target.closest('.timeline-phase');
            if (phaseElement && this.options.interactivePhases) {
                this.togglePhaseDetails(phaseElement);
            }
        });

        // Keyboard navigation
        phasesContainer.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.navigatePhases(e.key === 'ArrowRight' ? 1 : -1);
            }
        });
    }

    /**
     * Toggle phase details visibility
     */
    togglePhaseDetails(phaseElement) {
        const wasActive = phaseElement.classList.contains('active');
        
        // Remove active class from all phases
        document.querySelectorAll('.timeline-phase').forEach(phase => {
            phase.classList.remove('active');
        });

        // Add active class to clicked phase if it wasn't active
        if (!wasActive) {
            phaseElement.classList.add('active');
            this.currentPhase = parseInt(phaseElement.dataset.phaseIndex);
        }
    }

    /**
     * Navigate between phases with keyboard
     */
    navigatePhases(direction) {
        this.currentPhase = Math.max(0, Math.min(this.phases.length - 1, this.currentPhase + direction));
        const phaseElement = document.querySelector(`[data-phase-index="${this.currentPhase}"]`);
        if (phaseElement) {
            this.togglePhaseDetails(phaseElement);
            phaseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Animate timeline on load
     */
    animateOnLoad() {
        const phases = document.querySelectorAll('.timeline-phase');
        phases.forEach((phase, index) => {
            phase.style.opacity = '0';
            phase.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                phase.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                phase.style.opacity = '1';
                phase.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }

    /**
     * Update overall progress bar
     */
    updateProgress() {
        const progressBar = document.getElementById('timeline-progress');
        const completedPhases = this.phases.filter(phase => phase.status === 'completed').length;
        const inProgressPhases = this.phases.filter(phase => phase.status === 'in-progress').length;
        const totalPhases = this.phases.length;
        
        // Calculate progress (completed phases + 50% for in-progress)
        const progress = ((completedPhases + (inProgressPhases * 0.5)) / totalPhases) * 100;
        
        setTimeout(() => {
            progressBar.style.width = `${progress}%`;
        }, 100);
    }

    /**
     * Format status text
     */
    formatStatus(status) {
        return status.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    /**
     * Update phases data
     */
    updatePhases(newPhases) {
        this.phases = newPhases;
        this.renderPhases();
        this.updateProgress();
    }

    /**
     * Get current phase data
     */
    getCurrentPhase() {
        return this.phases[this.currentPhase] || null;
    }

    /**
     * Destroy timeline and cleanup
     */
    destroy() {
        this.container.textContent = '' /* Replaced innerHTML with textContent for safety */
        const styleElement = document.getElementById('roadmap-timeline-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoadmapTimelineVisualization;
} else if (typeof window !== 'undefined') {
    window.RoadmapTimelineVisualization = RoadmapTimelineVisualization;
}
