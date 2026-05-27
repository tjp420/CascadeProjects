/**
 * Emergency Security Scanner
 * Immediately identifies critical security issues from mock data analysis
 */

class EmergencySecurityScanner {
  constructor() {
    this.criticalPatterns = {
      creditCards: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
      apiKeys: /(?:api[_-]?key|apikey|secret|token|private[_-]?key)\s*[:=]\s*['"`]([a-zA-Z0-9_-]{16,})['"`]/gi,
      passwords: /(?:password|passwd|pwd)\s*[:=]\s*['"`]([^'"`\s]{6,})['"`]/gi,
      emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      urls: /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.1[6-9]\.|172\.2[0-9]\.|172\.3[0-1]\.)/gi
    };
    
    this.secureReplacements = {
      creditCards: {
        visa: "4111111111111111",
        mastercard: "5555555555554444",
        amex: "378282246310005",
        discover: "6011111111111117"
      },
      apiKeys: "REPLACE_WITH_ENV_VARIABLE",
      passwords: "REPLACE_WITH_SECURE_PASSWORD"
    };
    
    this.criticalFindings = [];
    this.scanResults = {};
  }

  /**
   * Emergency scan for critical security issues
   */
  async emergencyScan() {
    console.log('🚨 EMERGENCY SECURITY SCAN STARTED');
    console.log('Scanning for critical security issues...');
    
    const startTime = Date.now();
    
    try {
      // Scan for credit cards
      await this.scanForCreditCards();
      
      // Scan for API keys
      await this.scanForAPIKeys();
      
      // Scan for passwords
      await this.scanForPasswords();
      
      // Scan for emails
      await this.scanForEmails();
      
      // Scan for URLs
      await this.scanForURLs();
      
      const endTime = Date.now();
      const scanDuration = endTime - startTime;
      
      this.generateEmergencyReport(scanDuration);
      
    } catch (error) {
      console.error('❌ Emergency scan failed:', error);
      this.generateErrorReport(error);
    }
  }

  /**
   * Scan for credit card numbers
   */
  async scanForCreditCards() {
    console.log('🔍 Scanning for credit card numbers...');
    
    const creditCardFindings = [];
    const files = await this.getProjectFiles();
    
    for (const file of files) {
      const content = await this.readFileContent(file.path);
      const matches = content.match(this.criticalPatterns.creditCards);
      
      if (matches) {
        matches.forEach((match, _index) => {
          const lineNumber = this.getLineNumber(content, match);
          creditCardFindings.push({
            type: 'Credit Card',
            file: file.path,
            line: lineNumber,
            content: this.maskCreditCard(match),
            severity: 'critical',
            category: 'security',
            recommendation: 'Replace with secure test credit card number'
          });
        });
      }
    }
    
    this.scanResults.creditCards = creditCardFindings;
    console.log(`⚠️ Found ${creditCardFindings.length} credit card numbers`);
  }

  /**
   * Scan for API keys
   */
  async scanForAPIKeys() {
    console.log('🔍 Scanning for API keys...');
    
    const apiKeyFindings = [];
    const files = await this.getProjectFiles();
    
    for (const file of files) {
      const content = await this.readFileContent(file.path);
      const matches = content.match(this.criticalPatterns.apiKeys);
      
      if (matches) {
        matches.forEach((match, _index) => {
          const lineNumber = this.getLineNumber(content, match);
          apiKeyFindings.push({
            type: 'API Key',
            file: file.path,
            line: lineNumber,
            content: this.maskAPIKey(match),
            severity: 'critical',
            category: 'security',
            recommendation: 'Replace with environment variable'
          });
        });
      }
    }
    
    this.scanResults.apiKeys = apiKeyFindings;
    console.log(`⚠️ Found ${apiKeyFindings.length} API keys`);
  }

  /**
   * Scan for passwords
   */
  async scanForPasswords() {
    console.log('🔍 Scanning for passwords...');
    
    const passwordFindings = [];
    const files = await this.getProjectFiles();
    
    for (const file of files) {
      const content = await this.readFileContent(file.path);
      const matches = content.match(this.criticalPatterns.passwords);
      
      if (matches) {
        matches.forEach((match, _index) => {
          const lineNumber = this.getLineNumber(content, match);
          passwordFindings.push({
            type: 'Password',
            file: file.path,
            line: lineNumber,
            content: '***MASKED_PASSWORD***',
            severity: 'high',
            category: 'security',
            recommendation: 'Replace with environment variable'
          });
        });
      }
    }
    
    this.scanResults.passwords = passwordFindings;
    console.log(`⚠️ Found ${passwordFindings.length} passwords`);
  }

  /**
   * Scan for emails
   */
  async scanForEmails() {
    console.log('🔍 Scanning for email addresses...');
    
    const emailFindings = [];
    const files = await this.getProjectFiles();
    
    for (const file of files) {
      const content = await this.readFileContent(file.path);
      const matches = content.match(this.criticalPatterns.emails);
      
      if (matches) {
        const uniqueEmails = [...new Set(matches)]; // Remove duplicates
        uniqueEmails.forEach((match, _index) => {
          const lineNumber = this.getLineNumber(content, match);
          emailFindings.push({
            type: 'Email Address',
            file: file.path,
            line: lineNumber,
            content: this.maskEmail(match),
            severity: 'low',
            category: 'security',
            recommendation: 'Replace with environment-specific email'
          });
        });
      }
    }
    
    this.scanResults.emails = emailFindings;
    console.log(`⚠️ Found ${emailFindings.length} email addresses`);
  }

  /**
   * Scan for URLs
   */
  async scanForURLs() {
    console.log('🔍 Scanning for URLs...');
    
    const urlFindings = [];
    const files = await this.getProjectFiles();
    
    for (const file of files) {
      const content = await this.readFileContent(file.path);
      const matches = content.match(this.criticalPatterns.urls);
      
      if (matches) {
        matches.forEach((match, _index) => {
          const lineNumber = this.getLineNumber(content, match);
          urlFindings.push({
            type: 'URL',
            file: file.path,
            line: lineNumber,
            content: match,
            severity: 'medium',
            category: 'performance',
            recommendation: 'Replace with production endpoint'
          });
        });
      }
    }
    
    this.scanResults.urls = urlFindings;
    console.log(`⚠️ Found ${urlFindings.length} URLs`);
  }

  /**
   * Get project files (mock implementation)
   */
  async getProjectFiles() {
    // In a real implementation, this would scan the actual file system
    // For now, return mock data based on the analysis results
    return [
      { path: 'src/python/auth_system.py', size: 1319 },
      { path: 'src/python/auth.py', size: 832 },
      { path: 'src/javascript/auth.ts', size: 55 },
      { path: 'src/javascript/setup-database.js', size: 293 },
      { path: 'src/pages/index.html', size: 1941 },
      { path: 'dashboard-server.js', size: 306 },
      { path: 'billing/pricing.html', size: 500 },
      { path: 'billing/stripe-integration.js', size: 200 }
    ];
  }

  /**
   * Read file content (mock implementation)
   */
  async readFileContent(filePath) {
    // In a real implementation, this would read the actual file
    // For now, return mock content based on the analysis results
    return `
      // Mock content for ${filePath}
      const apiKey = "sk-test-1234567890abcdef";
      const password = "demo123";
      const email = "demo@example.com";
      const creditCard = "4111111111111111";
      const url = "https://localhost:3000/api";
    `;
  }

  /**
   * Get line number for a match
   */
  getLineNumber(content, match) {
    const beforeMatch = content.substring(0, content.indexOf(match));
    return beforeMatch.split('\n').length;
  }

  /**
   * Mask credit card number
   */
  maskCreditCard(cardNumber) {
    return cardNumber.substring(0, 4) + '****' + cardNumber.substring(cardNumber.length - 4);
  }

  /**
   * Mask API key
   */
  maskAPIKey(apiKey) {
    const match = apiKey.match(/['"`]([^'"`]+)['"`]/);
    if (match) {
      const key = match[1];
      return match[0].replace(key, key.substring(0, 4) + '****');
    }
    return '****MASKED****';
  }

  /**
   * Mask email address
   */
  maskEmail(email) {
    const [username, domain] = email.split('@');
    const maskedUsername = username.substring(0, 2) + '***';
    return maskedUsername + '@' + domain;
  }

  /**
   * Generate emergency report
   */
  generateEmergencyReport(scanDuration) {
    const totalCritical = (this.scanResults.creditCards?.length || 0) + 
                         (this.scanResults.apiKeys?.length || 0);
    const totalHigh = this.scanResults.passwords?.length || 0;
    const totalMedium = this.scanResults.urls?.length || 0;
    const totalLow = this.scanResults.emails?.length || 0;
    
    const report = {
      timestamp: new Date().toISOString(),
      scanDuration: scanDuration,
      severity: 'critical',
      totalFindings: totalCritical + totalHigh + totalMedium + totalLow,
      summary: {
        critical: totalCritical,
        high: totalHigh,
        medium: totalMedium,
        low: totalLow
      },
      findings: this.scanResults,
      recommendations: this.generateRecommendations(),
      emergencyActions: this.generateEmergencyActions()
    };
    
    console.log('🚨 EMERGENCY SECURITY SCAN COMPLETE');
    console.log(`⚠️ CRITICAL: ${totalCritical} findings`);
    console.log(`🔴 HIGH: ${totalHigh} findings`);
    console.log(`🟡 MEDIUM: ${totalMedium} findings`);
    console.log(`🟢 LOW: ${totalLow} findings`);
    console.log(`⏱️ Scan completed in ${scanDuration}ms`);
    
    // Store results for immediate action
    window.emergencyScanResults = report;
    
    return report;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.scanResults.creditCards?.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Replace Credit Card Numbers',
        description: `${this.scanResults.creditCards.length} credit card numbers found`,
        action: 'Replace with secure test numbers immediately',
        timeline: '24 hours'
      });
    }
    
    if (this.scanResults.apiKeys?.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Secure API Keys',
        description: `${this.scanResults.apiKeys.length} API keys found`,
        action: 'Replace with environment variables',
        timeline: '24 hours'
      });
    }
    
    if (this.scanResults.passwords?.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Secure Passwords',
        description: `${this.scanResults.passwords.length} passwords found`,
        action: 'Replace with secure authentication',
        timeline: '48 hours'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate emergency actions
   */
  generateEmergencyActions() {
    return [
      {
        action: 'IMMEDIATE',
        description: 'Replace all credit card numbers with secure test numbers',
        files: this.scanResults.creditCards?.map(f => f.file) || []
      },
      {
        action: 'IMMEDIATE',
        description: 'Replace all API keys with environment variables',
        files: this.scanResults.apiKeys?.map(f => f.file) || []
      },
      {
        action: 'WITHIN 24 HOURS',
        description: 'Update all authentication systems',
        files: this.scanResults.passwords?.map(f => f.file) || []
      },
      {
        action: 'WITHIN 48 HOURS',
        description: 'Update all URLs to production endpoints',
        files: this.scanResults.urls?.map(f => f.file) || []
      }
    ];
  }

  /**
   * Generate error report
   */
  generateErrorReport(error) {
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      recommendations: [
        'Check file permissions',
        'Verify file paths are correct',
        'Ensure all files are accessible'
      ]
    };
    
    console.error('❌ EMERGENCY SCAN FAILED:', errorReport);
    return errorReport;
  }

  /**
   * Export emergency report
   */
  exportEmergencyReport() {
    if (!window.emergencyScanResults) {
      console.error('No emergency scan results available');
      return;
    }
    
    const dataStr = JSON.stringify(window.emergencyScanResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `emergency-security-scan-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('📥 Emergency security report exported');
  }
}

// Export for immediate use
if (typeof window !== 'undefined') {
  window.EmergencySecurityScanner = EmergencySecurityScanner;
  window.emergencyScanner = new EmergencySecurityScanner();
  
  console.log('🚨 Emergency Security Scanner loaded');
  console.log('Run emergencyScanner.emergencyScan() to start critical security scan');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmergencySecurityScanner;
}
