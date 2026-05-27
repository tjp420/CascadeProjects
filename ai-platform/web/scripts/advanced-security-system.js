/**
 * Advanced Security System
 * Comprehensive security overhaul and compliance implementation
 * 
 * Features:
 * - Zero-trust security model
 * - Advanced threat detection
 * - Real-time security monitoring
 * - Compliance management
 * - Security automation
 * - Incident response system
 * - Security analytics and reporting
 */

class AdvancedSecuritySystem {
    constructor() {
        this.isInitialized = false;
        this.securityConfig = {
            zeroTrustEnabled: true,
            threatDetectionEnabled: true,
            complianceEnabled: true,
            automationEnabled: true,
            monitoringEnabled: true
        };
        
        this.threatLevel = 'low';
        this.securityScore = 100;
        this.incidents = [];
        this.threats = [];
        this.complianceStatus = {};
        this.securityPolicies = new Map();
        this.accessControl = new Map();
        this.auditTrail = [];
        this.securityMetrics = {
            threatsBlocked: 0,
            vulnerabilitiesFixed: 0,
            complianceScore: 0,
            riskScore: 0,
            incidentsResolved: 0,
            securityEvents: 0
        };
        
        // Security thresholds
        this.thresholds = {
            critical: 90,
            high: 75,
            medium: 50,
            low: 25
        };
        
        // Compliance frameworks
        this.complianceFrameworks = {
            GDPR: { enabled: true, score: 0 },
            SOC2: { enabled: true, score: 0 },
            ISO27001: { enabled: true, score: 0 },
            HIPAA: { enabled: false, score: 0 },
            PCI_DSS: { enabled: false, score: 0 }
        };
        
        this.init();
    }

    /**
     * Initialize the advanced security system
     */
    async init() {
        console.log('🛡️ Initializing Advanced Security System...');
        
        try {
            // Initialize zero-trust model
            await this.initializeZeroTrust();
            
            // Setup threat detection
            await this.setupThreatDetection();
            
            // Initialize compliance management
            await this.initializeCompliance();
            
            // Setup security monitoring
            await this.setupSecurityMonitoring();
            
            // Initialize incident response
            await this.initializeIncidentResponse();
            
            // Setup security automation
            await this.setupSecurityAutomation();
            
            this.isInitialized = true;
            console.log('✅ Advanced Security System initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Advanced Security System:', error);
        }
    }

    /**
     * Initialize zero-trust security model
     */
    async initializeZeroTrust() {
        console.log('🔐 Initializing Zero-Trust Security Model...');
        
        // Setup identity verification
        this.setupIdentityVerification();
        
        // Implement principle of least privilege
        this.setupLeastPrivilege();
        
        // Setup continuous authentication
        this.setupContinuousAuth();
        
        // Implement micro-segmentation
        this.setupMicroSegmentation();
    }

    /**
     * Setup identity verification
     */
    setupIdentityVerification() {
        // Multi-factor authentication
        this.mfaConfig = {
            enabled: true,
            methods: ['totp', 'sms', 'biometric'],
            requiredFor: ['admin', 'sensitive_operations']
        };
        
        // Identity verification methods
        this.verificationMethods = {
            password: this.verifyPassword.bind(this),
            totp: this.verifyTOTP.bind(this),
            biometric: this.verifyBiometric.bind(this),
            hardware_token: this.verifyHardwareToken.bind(this)
        };
    }

    /**
     * Setup principle of least privilege
     */
    setupLeastPrivilege() {
        // Define role-based access control
        this.roles = {
            super_admin: {
                permissions: ['*'],
                access_level: 100
            },
            admin: {
                permissions: ['read', 'write', 'delete', 'manage_users'],
                access_level: 80
            },
            developer: {
                permissions: ['read', 'write'],
                access_level: 60
            },
            analyst: {
                permissions: ['read'],
                access_level: 40
            },
            viewer: {
                permissions: ['read_limited'],
                access_level: 20
            }
        };
        
        // Setup permission checking
        this.checkPermission = (userRole, requiredPermission) => {
            const role = this.roles[userRole];
            if (!role) return false;
            
            return role.permissions.includes('*') || 
                   role.permissions.includes(requiredPermission);
        };
    }

    /**
     * Setup continuous authentication
     */
    setupContinuousAuth() {
        // Behavioral biometrics
        this.behavioralProfile = {
            typingPattern: {},
            mouseMovement: {},
            usagePattern: {}
        };
        
        // Continuous risk assessment
        this.riskAssessment = {
            currentScore: 0,
            factors: ['location', 'device', 'behavior', 'time'],
            thresholds: {
                low: 30,
                medium: 60,
                high: 80,
                critical: 95
            }
        };
        
        // Start continuous monitoring
        this.startContinuousMonitoring();
    }

    /**
     * Setup micro-segmentation
     */
    setupMicroSegmentation() {
        // Define security zones
        this.securityZones = {
            public: {
                access_level: 0,
                restrictions: ['no_sensitive_data'],
                monitoring: 'basic'
            },
            internal: {
                access_level: 40,
                restrictions: ['authenticated_only'],
                monitoring: 'standard'
            },
            confidential: {
                access_level: 70,
                restrictions: ['mfa_required', 'privileged_access'],
                monitoring: 'enhanced'
            },
            restricted: {
                access_level: 90,
                restrictions: ['mfa_required', 'privileged_access', 'approval_needed'],
                monitoring: 'comprehensive'
            }
        };
    }

    /**
     * Setup threat detection
     */
    async setupThreatDetection() {
        console.log('🔍 Setting up Threat Detection...');
        
        // Initialize threat intelligence
        await this.initializeThreatIntelligence();
        
        // Setup anomaly detection
        this.setupAnomalyDetection();
        
        // Initialize malware detection
        await this.initializeMalwareDetection();
        
        // Setup phishing detection
        this.setupPhishingDetection();
        
        // Initialize behavioral analysis
        this.setupBehavioralAnalysis();
    }

    /**
     * Initialize threat intelligence
     */
    async initializeThreatIntelligence() {
        this.threatIntelligence = {
            sources: ['internal', 'external', 'community'],
            feeds: [],
            signatures: [],
            iocs: [] // Indicators of compromise
        };
        
        // Load threat feeds
        await this.loadThreatFeeds();
        
        // Update threat database
        this.updateThreatDatabase();
    }

    /**
     * Load threat feeds
     */
    async loadThreatFeeds() {
        // Mock implementation - in production, integrate with real threat feeds
        const mockThreatFeeds = [
            {
                id: 'cve_2024_001',
                type: 'vulnerability',
                severity: 'high',
                description: 'Remote code execution vulnerability',
                affected: ['web_server', 'api_gateway']
            },
            {
                id: 'malware_2024_001',
                type: 'malware',
                severity: 'critical',
                description: 'Advanced persistent threat detected',
                indicators: ['ip_ranges', 'domains', 'file_hashes']
            }
        ];
        
        this.threatIntelligence.feeds = mockThreatFeeds;
    }

    /**
     * Update threat database
     */
    updateThreatDatabase() {
        setInterval(async () => {
            await this.loadThreatFeeds();
            this.logSecurityEvent('THREAT_DB_UPDATED', {
                feeds_count: this.threatIntelligence.feeds.length,
                timestamp: new Date().toISOString()
            });
        }, 300000); // Update every 5 minutes
    }

    /**
     * Setup anomaly detection
     */
    setupAnomalyDetection() {
        this.anomalyDetection = {
            algorithms: ['statistical', 'machine_learning', 'rule_based'],
            models: {},
            thresholds: {
                network: 0.8,
                behavior: 0.7,
                system: 0.75
            }
        };
        
        // Initialize detection models
        this.initializeDetectionModels();
        
        // Start anomaly monitoring
        this.startAnomalyMonitoring();
    }

    /**
     * Initialize detection models
     */
    initializeDetectionModels() {
        // Network traffic analysis
        this.anomalyDetection.models.network = {
            baseline: this.collectNetworkBaseline(),
            algorithm: 'statistical',
            sensitivity: 0.8
        };
        
        // User behavior analysis
        this.anomalyDetection.models.behavior = {
            baseline: this.collectBehaviorBaseline(),
            algorithm: 'machine_learning',
            sensitivity: 0.7
        };
        
        // System performance analysis
        this.anomalyDetection.models.system = {
            baseline: this.collectSystemBaseline(),
            algorithm: 'rule_based',
            sensitivity: 0.75
        };
    }

    /**
     * Collect network baseline
     */
    collectNetworkBaseline() {
        return {
            avg_request_rate: 100,
            avg_response_time: 200,
            avg_bandwidth: 1000000,
            normal_ports: [80, 443, 8080],
            normal_protocols: ['http', 'https', 'ws']
        };
    }

    /**
     * Collect behavior baseline
     */
    collectBehaviorBaseline() {
        return {
            avg_session_duration: 1800, // 30 minutes
            avg_requests_per_session: 50,
            normal_hours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // 9am-5pm
            typical_locations: ['office', 'home']
        };
    }

    /**
     * Collect system baseline
     */
    collectSystemBaseline() {
        return {
            avg_cpu_usage: 30,
            avg_memory_usage: 40,
            avg_disk_usage: 60,
            normal_processes: ['node', 'nginx', 'mongodb']
        };
    }

    /**
     * Start anomaly monitoring
     */
    startAnomalyMonitoring() {
        setInterval(() => {
            this.detectAnomalies();
        }, 10000); // Check every 10 seconds
    }

    /**
     * Detect anomalies
     */
    detectAnomalies() {
        const anomalies = [];
        
        // Check network anomalies
        const networkAnomaly = this.detectNetworkAnomaly();
        if (networkAnomaly) {
            anomalies.push(networkAnomaly);
        }
        
        // Check behavior anomalies
        const behaviorAnomaly = this.detectBehaviorAnomaly();
        if (behaviorAnomaly) {
            anomalies.push(behaviorAnomaly);
        }
        
        // Check system anomalies
        const systemAnomaly = this.detectSystemAnomaly();
        if (systemAnomaly) {
            anomalies.push(systemAnomaly);
        }
        
        // Process detected anomalies
        if (anomalies.length > 0) {
            this.processAnomalies(anomalies);
        }
    }

    /**
     * Detect network anomaly
     */
    detectNetworkAnomaly() {
        // Mock implementation
        const currentMetrics = this.getCurrentNetworkMetrics();
        const baseline = this.anomalyDetection.models.network.baseline;
        
        const anomalyScore = this.calculateAnomalyScore(currentMetrics, baseline);
        
        if (anomalyScore > this.anomalyDetection.thresholds.network) {
            return {
                type: 'network',
                score: anomalyScore,
                details: currentMetrics,
                severity: this.getAnomalySeverity(anomalyScore)
            };
        }
        
        return null;
    }

    /**
     * Detect behavior anomaly
     */
    detectBehaviorAnomaly() {
        // Mock implementation
        const currentBehavior = this.getCurrentBehavior();
        const baseline = this.anomalyDetection.models.behavior.baseline;
        
        const anomalyScore = this.calculateAnomalyScore(currentBehavior, baseline);
        
        if (anomalyScore > this.anomalyDetection.thresholds.behavior) {
            return {
                type: 'behavior',
                score: anomalyScore,
                details: currentBehavior,
                severity: this.getAnomalySeverity(anomalyScore)
            };
        }
        
        return null;
    }

    /**
     * Detect system anomaly
     */
    detectSystemAnomaly() {
        // Mock implementation
        const currentSystem = this.getCurrentSystemMetrics();
        const baseline = this.anomalyDetection.models.system.baseline;
        
        const anomalyScore = this.calculateAnomalyScore(currentSystem, baseline);
        
        if (anomalyScore > this.anomalyDetection.thresholds.system) {
            return {
                type: 'system',
                score: anomalyScore,
                details: currentSystem,
                severity: this.getAnomalySeverity(anomalyScore)
            };
        }
        
        return null;
    }

    /**
     * Calculate anomaly score
     */
    calculateAnomalyScore(current, baseline) {
        let score = 0;
        let factors = 0;
        
        Object.keys(current).forEach(key => {
            if (baseline[key]) {
                const deviation = Math.abs(current[key] - baseline[key]) / baseline[key];
                score += deviation;
                factors++;
            }
        });
        
        return factors > 0 ? score / factors : 0;
    }

    /**
     * Get anomaly severity
     */
    getAnomalySeverity(score) {
        if (score >= 0.9) return 'critical';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        return 'low';
    }

    /**
     * Process detected anomalies
     */
    processAnomalies(anomalies) {
        anomalies.forEach(anomaly => {
            this.logSecurityEvent('ANOMALY_DETECTED', anomaly);
            
            // Create security incident if severity is high or critical
            if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
                this.createSecurityIncident('ANOMALY', anomaly);
            }
            
            // Update threat level
            this.updateThreatLevel(anomaly);
        });
    }

    /**
     * Initialize malware detection
     */
    async initializeMalwareDetection() {
        this.malwareDetection = {
            engines: ['signature_based', 'heuristic', 'behavioral'],
            signatures: [],
            quarantine: [],
            scanResults: []
        };
        
        // Load malware signatures
        await this.loadMalwareSignatures();
        
        // Setup file scanning
        this.setupFileScanning();
    }

    /**
     * Load malware signatures
     */
    async loadMalwareSignatures() {
        // Mock implementation
        this.malwareDetection.signatures = [
            {
                id: 'malware_sig_001',
                pattern: /malicious_pattern_1/gi,
                type: 'file_hash',
                severity: 'high'
            },
            {
                id: 'malware_sig_002',
                pattern: /malicious_pattern_2/gi,
                type: 'behavior',
                severity: 'critical'
            }
        ];
    }

    /**
     * Setup file scanning
     */
    setupFileScanning() {
        // Monitor file uploads
        this.monitorFileUploads();
        
        // Scan downloads
        this.scanDownloads();
    }

    /**
     * Monitor file uploads
     */
    monitorFileUploads() {
        // Intercept file upload events
        document.addEventListener('file-upload', (event) => {
            this.scanFile(event.detail.file);
        });
    }

    /**
     * Scan file
     */
    async scanFile(file) {
        const scanResult = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            scanTime: new Date().toISOString(),
            threats: [],
            status: 'clean'
        };
        
        // Signature-based scanning
        const signatureThreats = this.signatureScan(file);
        scanResult.threats.push(...signatureThreats);
        
        // Heuristic scanning
        const heuristicThreats = this.heuristicScan(file);
        scanResult.threats.push(...heuristicThreats);
        
        // Update status if threats found
        if (scanResult.threats.length > 0) {
            scanResult.status = 'infected';
            this.quarantineFile(file, scanResult.threats);
        }
        
        this.malwareDetection.scanResults.push(scanResult);
        this.logSecurityEvent('FILE_SCANNED', scanResult);
    }

    /**
     * Signature-based scan
     */
    signatureScan(_file) {
        const threats = [];
        
        // Mock implementation - scan file content against signatures
        this.malwareDetection.signatures.forEach(signature => {
            if (Math.random() < 0.01) { // 1% chance of detection for demo
                threats.push({
                    type: 'signature',
                    signature: signature.id,
                    severity: signature.severity
                });
            }
        });
        
        return threats;
    }

    /**
     * Heuristic scan
     */
    heuristicScan(file) {
        const threats = [];
        
        // Check file characteristics
        if (file.size > 100000000) { // > 100MB
            threats.push({
                type: 'heuristic',
                reason: 'Large file size',
                severity: 'medium'
            });
        }
        
        // Check file type
        if (file.type === 'application/octet-stream') {
            threats.push({
                type: 'heuristic',
                reason: 'Executable file type',
                severity: 'high'
            });
        }
        
        return threats;
    }

    /**
     * Quarantine file
     */
    quarantineFile(file, threats) {
        const quarantineEntry = {
            file: file.name,
            threats: threats,
            quarantineTime: new Date().toISOString(),
            status: 'quarantined'
        };
        
        this.malwareDetection.quarantine.push(quarantineEntry);
        this.logSecurityEvent('FILE_QUARANTINED', quarantineEntry);
    }

    /**
     * Setup phishing detection
     */
    setupPhishingDetection() {
        this.phishingDetection = {
            algorithms: ['url_analysis', 'content_analysis', 'behavioral'],
            indicators: [],
            blockedUrls: []
        };
        
        // Monitor form submissions
        this.monitorFormSubmissions();
        
        // Analyze links
        this.analyzeLinks();
    }

    /**
     * Monitor form submissions
     */
    monitorFormSubmissions() {
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (this.isSensitiveForm(form)) {
                this.analyzeFormSubmission(form);
            }
        });
    }

    /**
     * Check if form is sensitive
     */
    isSensitiveForm(form) {
        const sensitiveTypes = ['password', 'email', 'credit-card', 'ssn'];
        const inputs = form.querySelectorAll('input');
        
        return Array.from(inputs).some(input => 
            sensitiveTypes.some(type => input.type === type || input.name.includes(type))
        );
    }

    /**
     * Analyze form submission
     */
    analyzeFormSubmission(form) {
        const analysis = {
            formAction: form.action,
            formMethod: form.method,
            inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                type: input.type,
                name: input.name,
                hasValue: !!input.value
            })),
            timestamp: new Date().toISOString(),
            riskScore: 0
        };
        
        // Calculate risk score
        analysis.riskScore = this.calculatePhishingRisk(analysis);
        
        if (analysis.riskScore > 0.7) {
            this.blockPhishingAttempt(analysis);
        }
        
        this.logSecurityEvent('FORM_ANALYZED', analysis);
    }

    /**
     * Calculate phishing risk
     */
    calculatePhishingRisk(analysis) {
        let risk = 0;
        
        // Check for suspicious URLs
        if (analysis.formAction && this.isSuspiciousUrl(analysis.formAction)) {
            risk += 0.4;
        }
        
        // Check for sensitive data collection
        const sensitiveInputs = analysis.inputs.filter(input => 
            ['password', 'email', 'credit-card'].includes(input.type)
        );
        if (sensitiveInputs.length > 0) {
            risk += 0.3;
        }
        
        // Check for unusual form behavior
        if (analysis.formMethod !== 'POST') {
            risk += 0.2;
        }
        
        return Math.min(risk, 1.0);
    }

    /**
     * Check if URL is suspicious
     */
    isSuspiciousUrl(url) {
        const suspiciousPatterns = [
            /bit\.ly/i,
            /tinyurl\.com/i,
            /可疑/i,
            /phishing/i
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Block phishing attempt
     */
    blockPhishingAttempt(analysis) {
        this.createSecurityIncident('PHISHING_ATTEMPT', analysis);
        this.logSecurityEvent('PHISHING_BLOCKED', analysis);
    }

    /**
     * Setup behavioral analysis
     */
    setupBehavioralAnalysis() {
        this.behavioralAnalysis = {
            userProfiles: new Map(),
            baselines: new Map(),
            anomalies: [],
            riskScores: new Map()
        };
        
        // Track user behavior
        this.trackUserBehavior();
        
        // Analyze patterns
        this.analyzeBehaviorPatterns();
    }

    /**
     * Track user behavior
     */
    trackUserBehavior() {
        // Track mouse movements
        this.trackMouseMovements();
        
        // Track keyboard patterns
        this.trackKeyboardPatterns();
        
        // Track session patterns
        this.trackSessionPatterns();
    }

    /**
     * Track mouse movements
     */
    trackMouseMovements() {
        let mouseEvents = [];
        
        document.addEventListener('mousemove', (event) => {
            mouseEvents.push({
                x: event.clientX,
                y: event.clientY,
                timestamp: Date.now()
            });
            
            // Keep only last 100 events
            if (mouseEvents.length > 100) {
                mouseEvents = mouseEvents.slice(-100);
            }
        });
        
        // Analyze mouse patterns periodically
        setInterval(() => {
            this.analyzeMousePattern(mouseEvents);
        }, 30000);
    }

    /**
     * Analyze mouse pattern
     */
    analyzeMousePattern(events) {
        if (events.length < 10) return;
        
        // Calculate movement characteristics
        const avgSpeed = this.calculateAverageSpeed(events);
        const straightness = this.calculateStraightness(events);
        const pausePattern = this.calculatePausePattern(events);
        
        const profile = {
            avgSpeed,
            straightness,
            pausePattern,
            timestamp: new Date().toISOString()
        };
        
        // Compare with baseline
        const baseline = this.behavioralAnalysis.baselines.get('mouse');
        if (baseline) {
            const deviation = this.calculateBehavioralDeviation(profile, baseline);
            if (deviation > 0.8) {
                this.logSecurityEvent('BEHAVIORAL_ANOMALY', {
                    type: 'mouse',
                    deviation,
                    profile
                });
            }
        } else {
            // Establish baseline
            this.behavioralAnalysis.baselines.set('mouse', profile);
        }
    }

    /**
     * Calculate average speed
     */
    calculateAverageSpeed(events) {
        if (events.length < 2) return 0;
        
        let totalSpeed = 0;
        for (let i = 1; i < events.length; i++) {
            const distance = Math.sqrt(
                Math.pow(events[i].x - events[i-1].x, 2) +
                Math.pow(events[i].y - events[i-1].y, 2)
            );
            const timeDiff = events[i].timestamp - events[i-1].timestamp;
            totalSpeed += distance / timeDiff;
        }
        
        return totalSpeed / (events.length - 1);
    }

    /**
     * Calculate straightness
     */
    calculateStraightness(events) {
        if (events.length < 2) return 1;
        
        const directDistance = Math.sqrt(
            Math.pow(events[events.length-1].x - events[0].x, 2) +
            Math.pow(events[events.length-1].y - events[0].y, 2)
        );
        
        let totalDistance = 0;
        for (let i = 1; i < events.length; i++) {
            totalDistance += Math.sqrt(
                Math.pow(events[i].x - events[i-1].x, 2) +
                Math.pow(events[i].y - events[i-1].y, 2)
            );
        }
        
        return totalDistance > 0 ? directDistance / totalDistance : 1;
    }

    /**
     * Calculate pause pattern
     */
    calculatePausePattern(events) {
        if (events.length < 2) return 0;
        
        const intervals = [];
        for (let i = 1; i < events.length; i++) {
            intervals.push(events[i].timestamp - events[i-1].timestamp);
        }
        
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        
        return variance / (avgInterval * avgInterval);
    }

    /**
     * Initialize compliance management
     */
    async initializeCompliance() {
        console.log('📋 Initializing Compliance Management...');
        
        // Setup GDPR compliance
        await this.setupGDPRCompliance();
        
        // Setup SOC2 compliance
        await this.setupSOC2Compliance();
        
        // Setup ISO27001 compliance
        await this.setupISO27001Compliance();
        
        // Initialize compliance monitoring
        this.startComplianceMonitoring();
    }

    /**
     * Setup GDPR compliance
     */
    async setupGDPRCompliance() {
        this.gdprCompliance = {
            consentManagement: this.setupConsentManagement(),
            dataSubjectRights: this.setupDataSubjectRights(),
            dataProtection: this.setupDataProtection(),
            breachNotification: this.setupBreachNotification()
        };
    }

    /**
     * Setup consent management
     */
    setupConsentManagement() {
        return {
            cookieConsent: this.setupCookieConsent(),
            dataProcessingConsent: this.setupDataProcessingConsent(),
            marketingConsent: this.setupMarketingConsent()
        };
    }

    /**
     * Setup cookie consent
     */
    setupCookieConsent() {
        const consentConfig = {
            required: ['essential', 'security'],
            optional: ['analytics', 'marketing', 'personalization'],
            granular: true,
            expiry: 365 // days
        };
        
        // Check existing consent
        const existingConsent = localStorage.getItem('cookie_consent');
        if (!existingConsent) {
            this.showCookieConsentBanner(consentConfig);
        }
        
        return consentConfig;
    }

    /**
     * Show cookie consent banner
     */
    showCookieConsentBanner(config) {
        // Create consent banner
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.textContent = `
            <div class="cookie-consent-content">
                <h3>Cookie Consent</h3>
                <p>We use cookies to enhance your experience and analyze site usage.</p>
                <div class="cookie-options">
                    ${config.optional.map(type => `
                        <label>
                            <input type="checkbox" value="${type}">
                            ${type.charAt(0).toUpperCase() + type.slice(1)}
                        </label>
                    `).join('')}
                </div>
                <div class="cookie-actions">
                    <button id="accept-all">Accept All</button>
                    <button id="accept-selected">Accept Selected</button>
                    <button id="reject-all">Reject All</button>
                </div>
            </div>
        ` /* Replaced innerHTML with textContent for safety */
        
        // Add styles
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #333;
            color: white;
            padding: 20px;
            z-index: 10000;
        `;
        
        document.body.appendChild(banner);
        
        // Setup event handlers
        this.setupCookieConsentHandlers(banner, config);
    }

    /**
     * Setup cookie consent handlers
     */
    setupCookieConsentHandlers(banner, config) {
        document.getElementById('accept-all').addEventListener('click', () => {
            const consent = {
                essential: true,
                security: true,
                ...Object.fromEntries(config.optional.map(type => [type, true]))
            };
            this.saveCookieConsent(consent);
            banner.remove();
        });
        
        document.getElementById('accept-selected').addEventListener('click', () => {
            const checkboxes = banner.querySelectorAll('input[type="checkbox"]');
            const consent = {
                essential: true,
                security: true
            };
            
            checkboxes.forEach(checkbox => {
                consent[checkbox.value] = checkbox.checked;
            });
            
            this.saveCookieConsent(consent);
            banner.remove();
        });
        
        document.getElementById('reject-all').addEventListener('click', () => {
            const consent = {
                essential: true,
                security: true,
                ...Object.fromEntries(config.optional.map(type => [type, false]))
            };
            this.saveCookieConsent(consent);
            banner.remove();
        });
    }

    /**
     * Save cookie consent
     */
    saveCookieConsent(consent) {
        localStorage.setItem('cookie_consent', JSON.stringify({
            consent,
            timestamp: new Date().toISOString(),
            version: '1.0'
        }));
        
        this.logSecurityEvent('CONSENT_GIVEN', { consent });
    }

    /**
     * Setup data subject rights
     */
    setupDataSubjectRights() {
        return {
            rightToAccess: this.setupRightToAccess(),
            rightToRectification: this.setupRightToRectification(),
            rightToErasure: this.setupRightToErasure(),
            rightToPortability: this.setupRightToPortability()
        };
    }

    /**
     * Setup right to access
     */
    setupRightToAccess() {
        return {
            endpoint: '/api/gdpr/data-access',
            authentication: 'required',
            format: 'json',
            responseTime: '30 days'
        };
    }

    /**
     * Setup right to rectification
     */
    setupRightToRectification() {
        return {
            endpoint: '/api/gdpr/data-rectification',
            authentication: 'required',
            verification: 'required',
            responseTime: '30 days'
        };
    }

    /**
     * Setup right to erasure
     */
    setupRightToErasure() {
        return {
            endpoint: '/api/gdpr/data-erasure',
            authentication: 'required',
            verification: 'required',
            exceptions: ['legal_obligation', 'public_interest'],
            responseTime: '30 days'
        };
    }

    /**
     * Setup right to portability
     */
    setupRightToPortability() {
        return {
            endpoint: '/api/gdpr/data-portability',
            authentication: 'required',
            format: ['json', 'csv', 'xml'],
            responseTime: '30 days'
        };
    }

    /**
     * Setup data protection
     */
    setupDataProtection() {
        return {
            encryption: 'aes-256',
            anonymization: 'pseudonymization',
            retention: '2 years',
            minimalCollection: true
        };
    }

    /**
     * Setup breach notification
     */
    setupBreachNotification() {
        return {
            threshold: '72 hours',
            authorities: ['supervisory_authority'],
            individuals: 'affected_data_subjects',
            content: ['nature', 'scope', 'consequences', 'measures']
        };
    }

    /**
     * Setup SOC2 compliance
     */
    async setupSOC2Compliance() {
        this.soc2Compliance = {
            security: this.setupSOC2Security(),
            availability: this.setupSOC2Availability(),
            processing: this.setupSOC2Processing(),
            confidentiality: this.setupSOC2Confidentiality(),
            privacy: this.setupSOC2Privacy()
        };
    }

    /**
     * Setup SOC2 Security
     */
    setupSOC2Security() {
        return {
            accessControl: this.setupAccessControl(),
            incidentResponse: this.setupIncidentResponse(),
            vulnerabilityManagement: this.setupVulnerabilityManagement(),
            penetrationTesting: this.setupPenetrationTesting()
        };
    }

    /**
     * Setup access control
     */
    setupAccessControl() {
        return {
            authentication: 'multi_factor',
            authorization: 'role_based',
            sessionManagement: 'timeout_30min',
            passwordPolicy: {
                minLength: 12,
                complexity: true,
                expiry: 90,
                history: 12
            }
        };
    }

    /**
     * Setup ISO27001 compliance
     */
    async setupISO27001Compliance() {
        this.iso27001Compliance = {
            informationSecurityPolicy: this.setupInfoSecPolicy(),
            riskManagement: this.setupRiskManagement(),
            assetManagement: this.setupAssetManagement(),
            accessControl: this.setupISOAccessControl(),
            cryptography: this.setupCryptography()
        };
    }

    /**
     * Setup information security policy
     */
    setupInfoSecPolicy() {
        return {
            policy: this.createSecurityPolicy(),
            review: 'annually',
            approval: 'management',
            communication: 'all_employees'
        };
    }

    /**
     * Create security policy
     */
    createSecurityPolicy() {
        return {
            title: 'Information Security Policy',
            version: '1.0',
            effectiveDate: new Date().toISOString(),
            scope: 'all_information_assets',
            objectives: [
                'Protect confidentiality of information',
                'Maintain integrity of information',
                'Ensure availability of information'
            ],
            requirements: [
                'All employees must complete security training',
                'Access must be granted on need-to-know basis',
                'All systems must have security controls'
            ]
        };
    }

    /**
     * Start compliance monitoring
     */
    startComplianceMonitoring() {
        setInterval(() => {
            this.checkComplianceStatus();
        }, 60000); // Check every minute
    }

    /**
     * Check compliance status
     */
    checkComplianceStatus() {
        Object.keys(this.complianceFrameworks).forEach(framework => {
            if (this.complianceFrameworks[framework].enabled) {
                const score = this.calculateComplianceScore(framework);
                this.complianceFrameworks[framework].score = score;
                
                if (score < 80) {
                    this.createComplianceAlert(framework, score);
                }
            }
        });
    }

    /**
     * Calculate compliance score
     */
    calculateComplianceScore(framework) {
        // Mock implementation - calculate based on various factors
        const factors = {
            GDPR: this.calculateGDPRScore(),
            SOC2: this.calculateSOC2Score(),
            ISO27001: this.calculateISO27001Score()
        };
        
        return factors[framework] || 0;
    }

    /**
     * Calculate GDPR score
     */
    calculateGDPRScore() {
        let score = 0;
        let checks = 0;
        
        // Check consent management
        if (localStorage.getItem('cookie_consent')) {
            score += 25;
        }
        checks++;
        
        // Check data protection
        if (this.gdprCompliance.dataProtection.encryption) {
            score += 25;
        }
        checks++;
        
        // Check subject rights
        if (this.gdprCompliance.dataSubjectRights.rightToAccess) {
            score += 25;
        }
        checks++;
        
        // Check breach notification
        if (this.gdprCompliance.breachNotification.threshold) {
            score += 25;
        }
        checks++;
        
        return checks > 0 ? score : 0;
    }

    /**
     * Calculate SOC2 score
     */
    calculateSOC2Score() {
        // Mock implementation
        return 85 + Math.random() * 10;
    }

    /**
     * Calculate ISO27001 score
     */
    calculateISO27001Score() {
        // Mock implementation
        return 80 + Math.random() * 15;
    }

    /**
     * Create compliance alert
     */
    createComplianceAlert(framework, score) {
        const alert = {
            type: 'COMPLIANCE',
            framework,
            score,
            status: score < 60 ? 'critical' : score < 80 ? 'warning' : 'info',
            message: `${framework} compliance score: ${score}%`,
            timestamp: new Date().toISOString()
        };
        
        this.alerts.push(alert);
        this.logSecurityEvent('COMPLIANCE_ALERT', alert);
    }

    /**
     * Setup security monitoring
     */
    async setupSecurityMonitoring() {
        console.log('👁️ Setting up Security Monitoring...');
        
        // Initialize real-time monitoring
        this.initializeRealTimeMonitoring();
        
        // Setup log aggregation
        this.setupLogAggregation();
        
        // Initialize alerting system
        this.initializeAlertingSystem();
        
        // Setup security analytics
        this.setupSecurityAnalytics();
    }

    /**
     * Initialize real-time monitoring
     */
    initializeRealTimeMonitoring() {
        this.realTimeMonitoring = {
            events: [],
            alerts: [],
            metrics: {
                eventsPerSecond: 0,
                alertsPerHour: 0,
                threatLevel: 0
            }
        };
        
        // Start monitoring loop
        this.startRealTimeMonitoringLoop();
    }

    /**
     * Start real-time monitoring loop
     */
    startRealTimeMonitoringLoop() {
        setInterval(() => {
            this.processSecurityEvents();
            this.updateSecurityMetrics();
            this.checkThresholds();
        }, 1000);
    }

    /**
     * Process security events
     */
    processSecurityEvents() {
        // Process pending security events
        while (this.securityEvents && this.securityEvents.length > 0) {
            const event = this.securityEvents.shift();
            this.analyzeSecurityEvent(event);
        }
    }

    /**
     * Analyze security event
     */
    analyzeSecurityEvent(event) {
        // Add to real-time monitoring
        this.realTimeMonitoring.events.push(event);
        
        // Check for alert conditions
        if (this.shouldAlert(event)) {
            this.createSecurityAlert(event);
        }
        
        // Update threat level
        this.updateThreatLevelFromEvent(event);
    }

    /**
     * Should alert
     */
    shouldAlert(event) {
        const alertConditions = {
            'CRITICAL': true,
            'HIGH': true,
            'THREAT_DETECTED': true,
            'ANOMALY_DETECTED': true,
            'UNAUTHORIZED_ACCESS': true
        };
        
        return alertConditions[event.type] || false;
    }

    /**
     * Create security alert
     */
    createSecurityAlert(event) {
        const alert = {
            id: Date.now().toString(),
            type: 'SECURITY_ALERT',
            event,
            severity: event.severity || 'medium',
            message: this.generateAlertMessage(event),
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        
        this.realTimeMonitoring.alerts.push(alert);
        this.alerts.push(alert);
        
        // Trigger notification
        this.triggerSecurityNotification(alert);
    }

    /**
     * Generate alert message
     */
    generateAlertMessage(event) {
        const messages = {
            'THREAT_DETECTED': `Security threat detected: ${event.details?.type || 'unknown'}`,
            'ANOMALY_DETECTED': `Behavioral anomaly detected: ${event.details?.type || 'unknown'}`,
            'UNAUTHORIZED_ACCESS': 'Unauthorized access attempt detected',
            'MALWARE_DETECTED': 'Malware detected and quarantined',
            'PHISHING_ATTEMPT': 'Phishing attempt blocked'
        };
        
        return messages[event.type] || `Security event: ${event.type}`;
    }

    /**
     * Trigger security notification
     */
    triggerSecurityNotification(alert) {
        // Send notification to security team
        this.sendSecurityNotification(alert);
        
        // Log notification
        this.logSecurityEvent('NOTIFICATION_SENT', { alert });
    }

    /**
     * Send security notification
     */
    sendSecurityNotification(alert) {
        // Mock implementation - integrate with notification system
        console.log('🚨 SECURITY NOTIFICATION:', alert);
    }

    /**
     * Update security metrics
     */
    updateSecurityMetrics() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        const oneSecondAgo = now - 1000;
        
        // Events per second
        const recentEvents = this.realTimeMonitoring.events.filter(
            event => new Date(event.timestamp).getTime() > oneSecondAgo
        );
        this.realTimeMonitoring.metrics.eventsPerSecond = recentEvents.length;
        
        // Alerts per hour
        const recentAlerts = this.realTimeMonitoring.alerts.filter(
            alert => new Date(alert.timestamp).getTime() > oneHourAgo
        );
        this.realTimeMonitoring.metrics.alertsPerHour = recentAlerts.length;
        
        // Update overall security metrics
        this.updateOverallSecurityMetrics();
    }

    /**
     * Update overall security metrics
     */
    updateOverallSecurityMetrics() {
        this.securityMetrics.securityEvents = this.realTimeMonitoring.events.length;
        this.securityMetrics.threatsBlocked = this.threats.filter(t => t.status === 'blocked').length;
        this.securityMetrics.incidentsResolved = this.incidents.filter(i => i.status === 'resolved').length;
        
        // Calculate security score
        this.calculateSecurityScore();
    }

    /**
     * Calculate security score
     */
    calculateSecurityScore() {
        let score = 100;
        
        // Deduct points for active threats
        const activeThreats = this.threats.filter(t => t.status === 'active').length;
        score -= activeThreats * 5;
        
        // Deduct points for unresolved incidents
        const unresolvedIncidents = this.incidents.filter(i => i.status !== 'resolved').length;
        score -= unresolvedIncidents * 10;
        
        // Add points for blocked threats
        const blockedThreats = this.threats.filter(t => t.status === 'blocked').length;
        score += blockedThreats * 2;
        
        // Ensure score stays within bounds
        this.securityScore = Math.max(0, Math.min(100, score));
    }

    /**
     * Initialize incident response
     */
    async initializeIncidentResponse() {
        console.log('🚨 Initializing Incident Response...');
        
        this.incidentResponse = {
            procedures: this.setupIncidentProcedures(),
            team: this.setupIncidentTeam(),
            communication: this.setupIncidentCommunication(),
            documentation: this.setupIncidentDocumentation()
        };
    }

    /**
     * Setup incident procedures
     */
    setupIncidentProcedures() {
        return {
            detection: this.setupDetectionProcedures(),
            analysis: this.setupAnalysisProcedures(),
            containment: this.setupContainmentProcedures(),
            eradication: this.setupEradicationProcedures(),
            recovery: this.setupRecoveryProcedures(),
            postIncident: this.setupPostIncidentProcedures()
        };
    }

    /**
     * Setup detection procedures
     */
    setupDetectionProcedures() {
        return {
            automated: true,
            manual: true,
            monitoring: '24/7',
            escalation: 'automatic'
        };
    }

    /**
     * Setup incident team
     */
    setupIncidentTeam() {
        return {
            lead: 'security_manager',
            members: ['security_analyst', 'network_engineer', 'system_administrator'],
            contacts: {
                security_manager: 'security@company.com',
                security_analyst: 'analyst@company.com'
            },
            onCall: true
        };
    }

    /**
     * Setup incident communication
     */
    setupIncidentCommunication() {
        return {
            internal: {
                channels: ['email', 'slack', 'phone'],
                templates: this.setupCommunicationTemplates()
            },
            external: {
                channels: ['email', 'press_release'],
                approval: 'required'
            }
        };
    }

    /**
     * Setup communication templates
     */
    setupCommunicationTemplates() {
        return {
            initial_alert: 'Security incident detected. Team mobilized.',
            status_update: 'Incident status: {status}. ETA: {eta}.',
            resolution: 'Incident resolved. Post-incident analysis initiated.'
        };
    }

    /**
     * Create security incident
     */
    createSecurityIncident(type, details) {
        const incident = {
            id: Date.now().toString(),
            type,
            details,
            severity: this.calculateIncidentSeverity(details),
            status: 'open',
            timestamp: new Date().toISOString(),
            assignedTo: this.assignIncident(type),
            actions: [],
            timeline: [
                {
                    action: 'incident_created',
                    timestamp: new Date().toISOString(),
                    details: { type, details }
                }
            ]
        };
        
        this.incidents.push(incident);
        this.logSecurityEvent('INCIDENT_CREATED', incident);
        
        // Trigger incident response
        this.triggerIncidentResponse(incident);
        
        return incident;
    }

    /**
     * Calculate incident severity
     */
    calculateIncidentSeverity(details) {
        if (details.severity) return details.severity;
        
        // Calculate based on impact and urgency
        const impact = details.impact || 'medium';
        const urgency = details.urgency || 'medium';
        
        const severityMatrix = {
            high: { high: 'critical', medium: 'high', low: 'medium' },
            medium: { high: 'high', medium: 'medium', low: 'low' },
            low: { high: 'medium', medium: 'low', low: 'low' }
        };
        
        return severityMatrix[impact][urgency] || 'medium';
    }

    /**
     * Assign incident
     */
    assignIncident(type) {
        const assignments = {
            'THREAT_DETECTED': 'security_analyst',
            'UNAUTHORIZED_ACCESS': 'security_manager',
            'MALWARE_DETECTED': 'security_analyst',
            'PHISHING_ATTEMPT': 'security_analyst',
            'ANOMALY_DETECTED': 'security_analyst'
        };
        
        return assignments[type] || 'security_analyst';
    }

    /**
     * Trigger incident response
     */
    triggerIncidentResponse(incident) {
        // Notify incident team
        this.notifyIncidentTeam(incident);
        
        // Start containment procedures
        this.startContainment(incident);
        
        // Log response initiation
        this.logSecurityEvent('INCIDENT_RESPONSE_INITIATED', { incident });
    }

    /**
     * Notify incident team
     */
    notifyIncidentTeam(incident) {
        const team = this.incidentResponse.team;
        const message = `Security incident ${incident.id}: ${incident.type} - Severity: ${incident.severity}`;
        
        // Send notifications to team members
        Object.values(team.contacts).forEach(contact => {
            this.sendNotification(contact, message);
        });
    }

    /**
     * Send notification
     */
    sendNotification(contact, message) {
        // Mock implementation
        console.log(`📧 Notification sent to ${contact}: ${message}`);
    }

    /**
     * Start containment
     */
    startContainment(incident) {
        const containmentActions = {
            'THREAT_DETECTED': ['isolate_affected_system', 'block_malicious_ips'],
            'UNAUTHORIZED_ACCESS': ['terminate_sessions', 'reset_credentials'],
            'MALWARE_DETECTED': ['quarantine_systems', 'scan_network'],
            'PHISHING_ATTEMPT': ['block_urls', 'notify_users']
        };
        
        const actions = containmentActions[incident.type] || ['investigate'];
        
        actions.forEach(action => {
            this.executeContainmentAction(incident, action);
        });
    }

    /**
     * Execute containment action
     */
    executeContainmentAction(incident, action) {
        const actionRecord = {
            action,
            timestamp: new Date().toISOString(),
            status: 'executed',
            details: {}
        };
        
        incident.actions.push(actionRecord);
        incident.timeline.push({
            action: 'containment_action',
            timestamp: new Date().toISOString(),
            details: actionRecord
        });
        
        this.logSecurityEvent('CONTAINMENT_ACTION_EXECUTED', {
            incident: incident.id,
            action
        });
    }

    /**
     * Setup security automation
     */
    async setupSecurityAutomation() {
        console.log('🤖 Setting up Security Automation...');
        
        this.securityAutomation = {
            threatResponse: this.setupThreatResponseAutomation(),
            complianceMonitoring: this.setupComplianceAutomation(),
            incidentResponse: this.setupIncidentResponseAutomation(),
            reporting: this.setupReportingAutomation()
        };
    }

    /**
     * Setup threat response automation
     */
    setupThreatResponseAutomation() {
        return {
            automatedBlocking: true,
            threatHunting: true,
            signatureUpdates: true,
            quarantineProcedures: true
        };
    }

    /**
     * Setup compliance automation
     */
    setupComplianceAutomation() {
        return {
            policyEnforcement: true,
            auditAutomation: true,
            reportingAutomation: true,
            remediationAutomation: true
        };
    }

    /**
     * Setup incident response automation
     */
    setupIncidentResponseAutomation() {
        return {
            automaticContainment: true,
            teamNotification: true,
            evidenceCollection: true,
            reportingAutomation: true
        };
    }

    /**
     * Setup reporting automation
     */
    setupReportingAutomation() {
        return {
            dailyReports: true,
            weeklyReports: true,
            monthlyReports: true,
            incidentReports: true,
            complianceReports: true
        };
    }

    /**
     * Get current metrics (mock implementations)
     */
    getCurrentNetworkMetrics() {
        return {
            request_rate: 100 + Math.random() * 50,
            response_time: 200 + Math.random() * 100,
            bandwidth: 1000000 + Math.random() * 500000
        };
    }

    getCurrentBehavior() {
        return {
            session_duration: 1800 + Math.random() * 600,
            requests_per_session: 50 + Math.random() * 20,
            current_hour: new Date().getHours()
        };
    }

    getCurrentSystemMetrics() {
        return {
            cpu_usage: 30 + Math.random() * 20,
            memory_usage: 40 + Math.random() * 15,
            disk_usage: 60 + Math.random() * 10
        };
    }

    /**
     * Update threat level
     */
    updateThreatLevel(anomaly) {
        const threatScores = {
            low: 25,
            medium: 50,
            high: 75,
            critical: 90
        };
        
        const newThreatLevel = threatScores[anomaly.severity] || 25;
        
        if (newThreatLevel > this.threatLevel) {
            this.threatLevel = newThreatLevel;
            this.logSecurityEvent('THREAT_LEVEL_UPDATED', {
                newLevel: this.threatLevel,
                trigger: anomaly
            });
        }
    }

    /**
     * Update threat level from event
     */
    updateThreatLevelFromEvent(event) {
        if (event.severity === 'critical') {
            this.threatLevel = Math.max(this.threatLevel, 90);
        } else if (event.severity === 'high') {
            this.threatLevel = Math.max(this.threatLevel, 75);
        }
    }

    /**
     * Log security event
     */
    logSecurityEvent(type, details) {
        const event = {
            id: Date.now().toString(),
            type,
            details,
            timestamp: new Date().toISOString(),
            user: this.getCurrentUser()
        };
        
        if (!this.securityEvents) {
            this.securityEvents = [];
        }
        this.securityEvents.push(event);
        
        // Keep only last 1000 events
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-1000);
        }
    }

    /**
     * Get current user (mock)
     */
    getCurrentUser() {
        return localStorage.getItem('currentUser') || 'anonymous';
    }

    /**
     * Generate security report
     */
    generateSecurityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            securityScore: this.securityScore,
            threatLevel: this.threatLevel,
            metrics: this.securityMetrics,
            incidents: this.incidents.slice(-10),
            threats: this.threats.slice(-10),
            compliance: this.complianceFrameworks,
            alerts: this.alerts.slice(-20),
            recommendations: this.generateSecurityRecommendations(),
            summary: this.generateSecuritySummary()
        };
        
        return report;
    }

    /**
     * Generate security recommendations
     */
    generateSecurityRecommendations() {
        const recommendations = [];
        
        if (this.securityScore < 80) {
            recommendations.push({
                priority: 'high',
                title: 'Improve Security Posture',
                description: 'Overall security score below acceptable level',
                actions: ['review_access_controls', 'update_policies', 'enhance_monitoring']
            });
        }
        
        if (this.threatLevel > 70) {
            recommendations.push({
                priority: 'critical',
                title: 'Address Elevated Threat Level',
                description: 'Current threat level requires immediate attention',
                actions: ['investigate_threats', 'enhance_defenses', 'incident_response']
            });
        }
        
        return recommendations;
    }

    /**
     * Generate security summary
     */
    generateSecuritySummary() {
        return {
            overallScore: this.securityScore,
            threatLevel: this.threatLevel,
            status: this.getSecurityStatus(),
            keyMetrics: {
                incidentsCount: this.incidents.length,
                threatsBlocked: this.securityMetrics.threatsBlocked,
                complianceScore: this.calculateComplianceScore('GDPR')
            },
            alertsCount: this.alerts.length
        };
    }

    /**
     * Get security status
     */
    getSecurityStatus() {
        if (this.securityScore >= 90) return 'excellent';
        if (this.securityScore >= 80) return 'good';
        if (this.securityScore >= 70) return 'fair';
        return 'poor';
    }

    /**
     * Get system status
     */
    getSystemStatus() {
        return {
            isInitialized: this.isInitialized,
            securityScore: this.securityScore,
            threatLevel: this.threatLevel,
            incidentsCount: this.incidents.length,
            threatsCount: this.threats.length,
            alertsCount: this.alerts.length,
            complianceStatus: this.complianceFrameworks,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.isInitialized = false;
        this.incidents = [];
        this.threats = [];
        this.alerts = [];
        this.auditTrail = [];
        
        console.log('🧹 Advanced Security System cleaned up');
    }
}

// Global instance
window.advancedSecurity = new AdvancedSecuritySystem();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedSecuritySystem;
}
