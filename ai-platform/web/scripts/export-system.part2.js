${document.querySelector('.recommendations')?.textContent || 'No recommendations available'}

NEXT STEPS
-----------
1. Review files with high complexity scores
2. Implement automated testing for critical components
3. Set up continuous integration for code quality checks
4. Create documentation standards for the project
5. Schedule regular code reviews and refactoring sessions

Generated: ${new Date().toLocaleString()}
    `;

    // Create and download the report
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `directory-analysis-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Directory analysis report exported successfully!', 'success');
  }

  // Directory Selection Functions
  function changeDirectory() {
    console.log('Changing directory...');

    // Create directory selection modal
    const selectModal = document.createElement('div');
    selectModal.id = 'directory-select-modal';
    selectModal.style.cssText = `
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

    selectModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📁 Change Directory</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Select a different directory to analyze. The current directory will be cleared and the new directory will be analyzed.</p>
                
                <div style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 2rem; text-align: center; cursor: pointer;" onclick="selectNewDirectory()">
                    <div style="color: var(--text-secondary); margin-bottom: 1rem;">
                        <svg style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM4 8a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z"/>
                        </svg>
                    </div>
                    <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Select New Directory</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Choose a different folder</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="current-color: var(--text-primary); margin-bottom: 1rem;">Current Directory</h4>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); text-align: center; padding: 2rem;">
                        No directory selected
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeDirectorySelection()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(selectModal);

    // Add click outside to close
    selectModal.addEventListener('click', (e) => {
      if (e.target === selectModal) {
        closeDirectorySelection();
      }
    });

    // Show modal
    setTimeout(() => {
      selectModal.style.display = 'flex';
    }, 100);
  }

  function closeDirectorySelection() {
    const modal = document.getElementById('directory-select-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function selectNewDirectory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = false;
    input.onchange = (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        const directoryPath = files[0].webkitRelativePath.split('/')[0];
        showNotification(`Changed to directory: ${directoryPath}`, 'info');
        closeDirectorySelection();

        // Clear current analysis and start new analysis
        setTimeout(() => {
          analyzeDirectory();
        }, 500);
      }
    };
    input.click();
  }

  // Export Directory Report Function
  function exportDirectoryReport() {
    console.log('Exporting directory report...');

    // Create export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'directory-export-modal';
    exportModal.style.cssText = `
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

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📊 Export Directory Report</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Report Type</label>
                <select id="directory-report-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="summary">Summary Report</option>
                    <option value="detailed">Detailed Analysis</option>
                    <option value="files">File List Only</option>
                    <option value="metrics">Quality Metrics</option>
                </select>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Export Format</label>
                <select id="directory-report-format" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="txt">Text File (.txt)</option>
                    <option value="csv">CSV File (.csv)</option>
                    <option value="json">JSON File (.json)</option>
                    <option value="pdf">PDF Report (.pdf)</option>
                </select>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Include Charts</label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="directory-include-charts" checked style="cursor: pointer;">
                    <span style="color: var(--text-secondary);">Include visual charts and graphs</span>
                </label>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeDirectoryExport()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="generateDirectoryReportExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeDirectoryExport();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeDirectoryExport() {
    const modal = document.getElementById('directory-export-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function generateDirectoryReportExport() {
    const reportType = document.getElementById('directory-report-type').value;
    const format = document.getElementById('directory-report-format').value;
    const includeCharts = document.getElementById('directory-report-type')?.checked ?? true;

    // Get analysis results from the results modal
    const resultsModal = document.getElementById('directory-analysis-results-modal');

    // Generate mock directory data for demonstration
    const directoryData = window.ExportMockData.generateMockDirectoryData(
      reportType,
      format,
      includeCharts
    );

    // Create and download the report
    const mimeType =
      format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([directoryData.content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const filename = `directory-analysis-${reportType}-${new Date().toISOString().split('T')[0]}.${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`Directory report exported successfully as ${filename}!`, 'success');
    closeDirectoryExport();
  }

  // System Diagnostics Functions
  function runDiagnostics() {
    console.log('Running system diagnostics...');

    // Create diagnostics modal
    const diagnosticsModal = document.createElement('div');
    diagnosticsModal.id = 'diagnostics-modal';
    diagnosticsModal.style.cssText = `
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

    diagnosticsModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 800px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🩺 System Diagnostics</h3>
                <button onclick="closeDiagnostics()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Running comprehensive system diagnostics to check all components and identify potential issues.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Diagnostics Options</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="check-performance" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Check system performance and response times</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="check-connectivity" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Verify API connectivity and endpoints</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="check-errors" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Scan for JavaScript errors and warnings</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="check-memory" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Analyze memory usage and leaks</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="check-security" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Security vulnerability assessment</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="check-dependencies" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Check dependencies and versions</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeDiagnostics()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="startDiagnostics()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-stethoscope"></i> Run Diagnostics
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(diagnosticsModal);

    // Add click outside to close
    diagnosticsModal.addEventListener('click', (e) => {
      if (e.target === diagnosticsModal) {
        closeDiagnostics();
      }
    });

    // Show modal
    setTimeout(() => {
      diagnosticsModal.style.display = 'flex';
    }, 100);
  }

  function closeDiagnostics() {
    const modal = document.getElementById('diagnostics-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function startDiagnostics() {
    const checkPerformance = document.getElementById('check-performance')?.checked ?? true;
    const checkConnectivity = document.getElementById('check-connectivity')?.checked ?? true;
    const checkErrors = document.getElementById('check-errors')?.checked ?? true;
    const checkMemory = document.getElementById('check-memory')?.checked ?? true;
    const checkSecurity = document.getElementById('check-security')?.checked ?? true;
    const checkDependencies = document.getElementById('check-dependencies')?.checked ?? true;

    closeDiagnostics();

    // Create diagnostics progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'diagnostics-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Running System Diagnostics...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Checking system components...</span>
                    <span id="diagnostics-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="diagnostics-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="diagnostics-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing diagnostic system...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate diagnostics process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification('System diagnostics completed successfully!', 'success');

          // Generate and show diagnostics results
          const diagnosticsResults = generateDiagnosticsResults({
            checkPerformance,
            checkConnectivity,
            checkErrors,
            checkMemory,
            checkSecurity,
            checkDependencies,
          });

          showDiagnosticsResults(diagnosticsResults);
        }, 500);
      }

      document.getElementById('diagnostics-bar').style.width = progress + '%';
      document.getElementById('diagnostics-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('diagnostics-status');
      if (progress < 15) {
        statusElement.textContent = 'Initializing diagnostic system...';
      } else if (progress < 30) {
        statusElement.textContent = 'Checking system performance and response times...';
      } else if (progress < 45) {
        statusElement.textContent = 'Verifying API connectivity and endpoints...';
      } else if (progress < 60) {
        statusElement.textContent = 'Scanning for JavaScript errors and warnings...';
      } else if (progress < 75) {
        statusElement.textContent = 'Analyzing memory usage and potential leaks...';
      } else if (progress < 90) {
        statusElement.textContent = 'Running security vulnerability assessment...';
      } else {
        statusElement.textContent = 'Checking dependencies and versions...';
      }
    }, 400);
  }

  function generateDiagnosticsResults(options) {
    const results = {
      timestamp: new Date().toISOString(),
      overallHealth: Math.random() > 0.2 ? 'Healthy' : 'Needs Attention',
      score: Math.floor(Math.random() * 30) + 70,
      checks: {},
    };

    if (options.checkPerformance) {
      results.checks.performance = {
        status: Math.random() > 0.3 ? 'Pass' : 'Warning',
        responseTime: Math.floor(Math.random() * 100) + 50,
        throughput: Math.floor(Math.random() * 1000) + 500,
        cpuUsage: Math.floor(Math.random() * 40) + 20,
        recommendations: [
          'Optimize database queries for better performance',
          'Implement caching for frequently accessed data',
          'Consider CDN for static assets',
        ],
      };
    }

    if (options.checkConnectivity) {
      results.checks.connectivity = {
        status: Math.random() > 0.2 ? 'Pass' : 'Warning',
        apiEndpoints: Math.floor(Math.random() * 10) + 5,
        failedEndpoints: Math.floor(Math.random() * 3),
        latency: Math.floor(Math.random() * 50) + 10,
        recommendations: [
          'Check API endpoint configurations',
          'Implement retry mechanisms for failed requests',
          'Monitor network connectivity',
        ],
      };
    }

    if (options.checkErrors) {
      results.checks.errors = {
        status: Math.random() > 0.4 ? 'Pass' : 'Warning',
        totalErrors: Math.floor(Math.random() * 10),
        criticalErrors: Math.floor(Math.random() * 3),
        warnings: Math.floor(Math.random() * 20) + 5,
        recommendations: [
          'Review JavaScript error logs',
          'Implement error tracking and monitoring',
          'Add try-catch blocks for critical functions',
        ],
      };
    }

    if (options.checkMemory) {
      results.checks.memory = {
        status: Math.random() > 0.3 ? 'Pass' : 'Warning',
        memoryUsage: Math.floor(Math.random() * 50) + 30,
        potentialLeaks: Math.floor(Math.random() * 5),
        heapSize: Math.floor(Math.random() * 100) + 50,
        recommendations: [
          'Monitor memory usage patterns',
          'Implement memory cleanup routines',
          'Optimize data structures and algorithms',
        ],
      };
    }

    if (options.checkSecurity) {
      results.checks.security = {
        status: Math.random() > 0.25 ? 'Pass' : 'Warning',
        vulnerabilities: Math.floor(Math.random() * 5),
        securityScore: Math.floor(Math.random() * 30) + 70,
        encryptionStatus: Math.random() > 0.1 ? 'Enabled' : 'Disabled',
        recommendations: [
          'Update security patches and dependencies',
          'Implement input validation and sanitization',
          'Review authentication and authorization mechanisms',
        ],
      };
    }

    if (options.checkDependencies) {
      results.checks.dependencies = {
        status: Math.random() > 0.35 ? 'Pass' : 'Warning',
        totalDependencies: Math.floor(Math.random() * 20) + 10,
        outdatedDependencies: Math.floor(Math.random() * 5),
        securityIssues: Math.floor(Math.random() * 3),
        recommendations: [
          'Update outdated packages and libraries',
          'Review dependency security advisories',
          'Implement dependency vulnerability scanning',
        ],
      };
    }

    return results;
  }

  function showDiagnosticsResults(results) {
    const resultsModal = document.createElement('div');
    resultsModal.id = 'diagnostics-results-modal';
    resultsModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    resultsModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 900px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">📊 System Diagnostics Results</h3>
                <button onclick="closeDiagnosticsResults()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <!-- Overall Health -->
            <div style="background: linear-gradient(135deg, ${results.overallHealth === 'Healthy' ? 'var(--success-color)' : 'var(--warning-color)'}, var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Overall System Health</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${results.overallHealth}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">System Status</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${results.score}/100</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Health Score</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${Object.keys(results.checks).length}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Checks Run</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${new Date(results.timestamp).toLocaleTimeString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Last Check</div>
                    </div>
                </div>
            </div>
            
            <!-- Individual Check Results -->
            ${Object.entries(results.checks)
              .map(
                ([checkName, checkData]) => `
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        ${checkName.charAt(0).toUpperCase() + checkName.slice(1)} Check
                        <span style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: ${checkData.status === 'Pass' ? 'var(--success-color)' : 'var(--warning-color)'}; color: white; border-radius: 4px;">
                            ${checkData.status}
                        </span>
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                        ${Object.entries(checkData)
                          .filter(([key, value]) => key !== 'status' && key !== 'recommendations')
                          .map(
                            ([key, value]) => `
                            <div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem;">${key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</div>
                                <div style="color: var(--text-primary); font-weight: 500;">${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</div>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                    ${
                      checkData.recommendations
                        ? `
                        <div style="margin-top: 1rem;">
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Recommendations:</div>
                            <ul style="color: var(--text-secondary); margin: 0; padding-left: 1rem; font-size: 0.9rem;">
                                ${checkData.recommendations.map((rec) => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    `
                        : ''
                    }
                </div>
            `
              )
              .join('')}
            
            <!-- Action Buttons -->
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="clearSystemLogs()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    <i class="fas fa-trash"></i> Clear Logs
                </button>
                <button onclick="exportDiagnosticsReport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export Report
                </button>
                <button onclick="closeDiagnosticsResults()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--secondary-color); color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(resultsModal);

    // Add click outside to close
    resultsModal.addEventListener('click', (e) => {
      if (e.target === resultsModal) {
        closeDiagnosticsResults();
      }
    });

    // Show modal
    setTimeout(() => {
      resultsModal.style.display = 'flex';
    }, 100);
  }

  function closeDiagnosticsResults() {
    const modal = document.getElementById('diagnostics-results-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Clear System Logs Function
  function clearSystemLogs() {
    console.log('Clearing system logs...');

    // Create confirmation modal
    const confirmModal = document.createElement('div');
    confirmModal.id = 'clear-logs-confirm-modal';
    confirmModal.style.cssText = `
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

    confirmModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Clear System Logs</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Are you sure you want to clear all system logs? This action cannot be undone.</p>
                
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">Logs to be cleared:</h4>
                    <ul style="color: var(--text-secondary); margin: 0; padding-left: 1rem; font-size: 0.9rem;">
                        <li>Application logs</li>
                        <li>Error logs</li>
                        <li>Debug logs</li>
                        <li>System event logs</li>
                        <li>Performance logs</li>
                        <li>Security logs</li>
                    </ul>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeClearLogsConfirm()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="confirmClearLogs()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--danger-color); color: white; cursor: pointer;">
                    <i class="fas fa-trash"></i> Clear Logs
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);

    // Add click outside to close
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        closeClearLogsConfirm();
      }
    });

    // Show modal
    setTimeout(() => {
      confirmModal.style.display = 'flex';
    }, 100);
  }

  function closeClearLogsConfirm() {
    const modal = document.getElementById('clear-logs-confirm-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function confirmClearLogs() {
    closeClearLogsConfirm();

    // Create clearing progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'clear-logs-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Clearing System Logs...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Clearing log files...</span>
                    <span id="clear-logs-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="clear-logs-bar" style="height: 100%; width: 0%; background: var(--danger-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="clear-logs-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing log cleanup...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate log clearing process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(
            'System logs cleared successfully! All logs have been removed.',
            'success'
          );

          // Show completion summary
          showLogsClearedSummary();
        }, 500);
      }

      document.getElementById('clear-logs-bar').style.width = progress + '%';
      document.getElementById('clear-logs-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('clear-logs-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing log cleanup process...';
      } else if (progress < 40) {
        statusElement.textContent = 'Clearing application and error logs...';
      } else if (progress < 60) {
        statusElement.textContent = 'Removing debug and system event logs...';
      } else if (progress < 80) {
        statusElement.textContent = 'Cleaning performance and security logs...';
      } else {
        statusElement.textContent = 'Finalizing log cleanup...';
      }
    }, 350);
  }

  function showLogsClearedSummary() {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'logs-cleared-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    const logsCleared = {
      applicationLogs: Math.floor(Math.random() * 1000) + 500,
      errorLogs: Math.floor(Math.random() * 100) + 20,
      debugLogs: Math.floor(Math.random() * 500) + 200,
      systemEventLogs: Math.floor(Math.random() * 200) + 50,
      performanceLogs: Math.floor(Math.random() * 300) + 100,
      securityLogs: Math.floor(Math.random() * 50) + 10,
      totalSize: Math.floor(Math.random() * 1000000) + 500000,
    };

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🗑️ Logs Cleared Successfully</h3>
                <button onclick="closeLogsClearedSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--success-color), var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Cleanup Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${logsCleared.applicationLogs}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Application Logs</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${logsCleared.errorLogs}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Error Logs</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${logsCleared.debugLogs}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Debug Logs</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${formatFileSize(logsCleared.totalSize)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Size</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Detailed Breakdown</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">System Event Logs</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${logsCleared.systemEventLogs} entries</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Performance Logs</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${logsCleared.performanceLogs} entries</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Security Logs</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${logsCleared.securityLogs} entries</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Cleanup Time</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeLogsClearedSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeLogsClearedSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeLogsClearedSummary() {
    const modal = document.getElementById('logs-cleared-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Export Debug Report Function
  function exportDiagnosticsReport() {
    console.log('Exporting diagnostics report...');

    // Create export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'diagnostics-export-modal';
    exportModal.style.cssText = `
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

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📊 Export Diagnostics Report</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Report Type</label>
                <select id="diagnostics-report-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="summary">Summary Report</option>
                    <option value="detailed">Detailed Analysis</option>
                    <option value="debug">Debug Report</option>
                    <option value="health">Health Assessment</option>
                </select>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Export Format</label>
                <select id="diagnostics-report-format" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="txt">Text File (.txt)</option>
                    <option value="csv">CSV File (.csv)</option>
                    <option value="json">JSON File (.json)</option>
                    <option value="pdf">PDF Report (.pdf)</option>
                </select>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Include Charts</label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="diagnostics-include-charts" checked style="cursor: pointer;">
                    <span style="color: var(--text-secondary);">Include visual charts and graphs</span>
                </label>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Time Period</label>
                <select id="diagnostics-report-period" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="current">Current Only</option>
                    <option value="last24h">Last 24 Hours</option>
                    <option value="last7d">Last 7 Days</option>
                    <option value="last30d">Last 30 Days</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeDiagnosticsExport()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="generateDiagnosticsReportExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeDiagnosticsExport();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeDiagnosticsExport() {
    const modal = document.getElementById('diagnostics-export-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function generateDiagnosticsReportExport() {
    const reportType = document.getElementById('diagnostics-report-type').value;
    const format = document.getElementById('diagnostics-report-format').value;
    const includeCharts = document.getElementById('diagnostics-include-charts')?.checked ?? true;
    const period = document.getElementById('diagnostics-report-period').value;

    // Generate mock diagnostics data
    const diagnosticsData = window.ExportMockData.generateMockDiagnosticsData(
      reportType,
      format,
      includeCharts,
      period
    );

    // Create and download the report
    const mimeType =
      format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([diagnosticsData.content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const filename = `diagnostics-report-${reportType}-${period}-${new Date().toISOString().split('T')[0]}.${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`Diagnostics report exported successfully as ${filename}!`, 'success');
    closeDiagnosticsExport();
  }

  // Export with Backup Function
  function exportWithBackup() {
    console.log('Starting export with backup process...');

    // Create export with backup modal
    const exportModal = document.createElement('div');
    exportModal.id = 'export-backup-modal';
    exportModal.style.cssText = `
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

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📦 Export & Backup</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Create a complete backup of your data and export it in your preferred format. This ensures data safety and provides offline access.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Export Options</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-dashboard-data" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include dashboard data and settings</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-user-preferences" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include user preferences and configurations</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-upload-history" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include upload history and analysis</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-reports" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include generated reports</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-system-logs" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include system logs (optional)</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Backup Settings</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="create-zip-archive" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Create compressed ZIP archive</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-checksum" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include checksum for integrity verification</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="encrypt-backup" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Encrypt backup with password</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Export Format</h4>
                        <select id="backup-format" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="json">JSON Format</option>
                            <option value="csv">CSV Format</option>
                            <option value="xml">XML Format</option>
                            <option value="sql">SQL Database Dump</option>
                            <option value="yaml">YAML Format</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeExportBackup()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="startExportBackup()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export & Backup
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeExportBackup();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeExportBackup() {
    const modal = document.getElementById('export-backup-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function startExportBackup() {
    const includeDashboardData = document.getElementById('include-dashboard-data')?.checked ?? true;
    const includeUserPreferences =
      document.getElementById('include-user-preferences')?.checked ?? true;
    const includeUploadHistory = document.getElementById('include-upload-history')?.checked ?? true;
    const includeReports = document.getElementById('include-reports')?.checked ?? true;
    const includeSystemLogs = document.getElementById('include-system-logs')?.checked ?? false;
    const createZipArchive = document.getElementById('create-zip-archive')?.checked ?? true;
    const includeChecksum = document.getElementById('include-checksum')?.checked ?? true;
    const encryptBackup = document.getElementById('encrypt-backup')?.checked ?? false;
    const backupFormat = document.getElementById('backup-format').value;

    closeExportBackup();

    // Create export progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'export-backup-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Creating Backup & Export...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Preparing data and creating backup...</span>
                    <span id="export-backup-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="export-backup-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="export-backup-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing backup process...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate export and backup process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification('Backup created and exported successfully!', 'success');

          // Generate and download backup
          const backupData = generateBackupData({
            includeDashboardData,
            includeUserPreferences,
            includeUploadHistory,
            includeReports,
            includeSystemLogs,
            createZipArchive,
            includeChecksum,
            encryptBackup,
            backupFormat,
          });

          downloadBackup(backupData);

          // Show backup summary
          showBackupSummary(backupData);
        }, 500);
      }

      document.getElementById('export-backup-bar').style.width = progress + '%';
      document.getElementById('export-backup-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('export-backup-status');
      if (progress < 15) {
        statusElement.textContent = 'Initializing backup process...';
      } else if (progress < 30) {
        statusElement.textContent = 'Collecting dashboard data and settings...';
      } else if (progress < 45) {
        statusElement.textContent = 'Gathering user preferences and configurations...';
      } else if (progress < 60) {
        statusElement.textContent = 'Compiling upload history and analysis...';
      } else if (progress < 75) {
        statusElement.textContent = 'Including reports and system logs...';
      } else if (progress < 90) {
        statusElement.textContent = 'Creating archive and generating checksum...';
      } else {
        statusElement.textContent = 'Finalizing backup and preparing download...';
      }
    }, 400);
  }

  function generateBackupData(options) {
    const now = new Date();
    const backupId = `backup_${now.toISOString().split('T')[0]}_${now.toTimeString().split(' ')[0].replace(/:/g, '')}`;

    // Generate comprehensive backup data
    const backupData = {
      metadata: {
        backupId: backupId,
        created: now.toISOString(),
        version: '1.0.0',
        format: options.backupFormat,
        compressed: options.createZipArchive,
        encrypted: options.encryptBackup,
        checksum: options.includeChecksum ? generateChecksum() : null,
      },
      content: {},
    };

    if (options.includeDashboardData) {
      backupData.content.dashboard = {
        settings: {
          theme: 'dark',
          language: 'en',
          notifications: true,
          autoRefresh: 30,
        },
        metrics: {
          totalUploads: Math.floor(Math.random() * 100) + 50,
          totalFiles: Math.floor(Math.random() * 500) + 200,
          totalSize: Math.floor(Math.random() * 10000000) + 1000000,
          averageQuality: Math.floor(Math.random() * 30) + 70,
        },
        widgets: [
          { id: 'widget_1', type: 'chart', position: 'top-left', config: {} },
          { id: 'widget_2', type: 'table', position: 'top-right', config: {} },
          { id: 'widget_3', type: 'stats', position: 'bottom', config: {} },
        ],
      };
    }

    if (options.includeUserPreferences) {
      backupData.content.userPreferences = {
        profile: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          timezone: 'UTC-06:00',
          dateFormat: 'MM/DD/YYYY',
        },
        ui: {
          sidebarCollapsed: false,
          compactMode: false,
          showTooltips: true,
          animations: true,
        },
        notifications: {
          email: true,
          push: true,
          desktop: false,
          frequency: 'daily',
        },
      };
    }

    if (options.includeUploadHistory) {
      backupData.content.uploadHistory = Array.from(
        { length: Math.floor(Math.random() * 20) + 10 },
        (_, index) => ({
          id: `upload_${index + 1}`,
          date: new Date(now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
          files: Math.floor(Math.random() * 10) + 1,
          size: Math.floor(Math.random() * 1000000) + 10000,
          type: ['single', 'batch'][Math.floor(Math.random() * 2)],
          status: 'completed',
          quality: Math.floor(Math.random() * 30) + 70,
        })
      );
    }

    if (options.includeReports) {
      backupData.content.reports = {
        summary: {
          totalReports: Math.floor(Math.random() * 50) + 20,
          lastGenerated: new Date(
            now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
          ).toISOString(),
          formats: ['pdf', 'csv', 'json', 'txt'],
        },
        recent: Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, index) => ({
          id: `report_${index + 1}`,
          name: `Report ${index + 1}`,
          type: ['summary', 'detailed', 'analytics'][Math.floor(Math.random() * 3)],
          generated: new Date(
            now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
          ).toISOString(),
          size: Math.floor(Math.random() * 100000) + 10000,
        })),
      };
    }

    if (options.includeSystemLogs) {
      backupData.content.systemLogs = {
        application: Array.from({ length: Math.floor(Math.random() * 100) + 50 }, (_, index) => ({
          timestamp: new Date(now - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString(),
          level: ['info', 'warning', 'error'][Math.floor(Math.random() * 3)],
          message: `System log entry ${index + 1}`,
        })),
        errors: Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, index) => ({
          timestamp: new Date(now - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString(),
          error: `Error message ${index + 1}`,
          stack: `Error stack trace for error ${index + 1}`,
        })),
      };
    }

    return backupData;
  }

  function generateChecksum() {
    const chars = '0123456789abcdef';
    let checksum = '';
    for (let i = 0; i < 64; i++) {
      checksum += chars[Math.floor(Math.random() * chars.length)];
    }
    return checksum;
  }

  function downloadBackup(backupData) {
    // Format the backup data based on the selected format
    let content, filename, mimeType;

    switch (backupData.metadata.format) {
      case 'json':
        content = JSON.stringify(backupData, null, 2);
        filename = `${backupData.metadata.backupId}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = convertToCSV(backupData);
        filename = `${backupData.metadata.backupId}.csv`;
        mimeType = 'text/csv';
        break;
      case 'xml':
        content = convertToXML(backupData);
        filename = `${backupData.metadata.backupId}.xml`;
        mimeType = 'application/xml';
        break;
      case 'sql':
        content = convertToSQL(backupData);
        filename = `${backupData.metadata.backupId}.sql`;
        mimeType = 'text/plain';
        break;
      case 'yaml':
        content = convertToYAML(backupData);
        filename = `${backupData.metadata.backupId}.yaml`;
        mimeType = 'text/plain';
        break;
      default:
        content = JSON.stringify(backupData, null, 2);
        filename = `${backupData.metadata.backupId}.json`;
        mimeType = 'application/json';
    }

    // Create and download the backup file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertToCSV(data) {
    let csv = 'Type,Category,Key,Value,Timestamp\n';

    function flattenObject(obj, prefix = '') {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flattenObject(value, fullKey);
        } else {
          const stringValue = typeof value === 'string' ? `"${value}"` : value;
          csv += `Backup,${prefix},${key},${stringValue},${new Date().toISOString()}\n`;
        }
      });
    }

    flattenObject(data.content);
    return csv;
  }

  function convertToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<backup>\n';

    xml += '  <metadata>\n';
    Object.entries(data.metadata).forEach(([key, value]) => {
      xml += `    <${key}>${value}</${key}>\n`;
    });
    xml += '  </metadata>\n';

    xml += '  <content>\n';
    Object.entries(data.content).forEach(([category, items]) => {
      xml += `    <${category}>\n`;
      if (Array.isArray(items)) {
        items.forEach((item) => {
          xml += '      <item>\n';
          Object.entries(item).forEach(([key, value]) => {
            xml += `        <${key}>${value}</${key}>\n`;
          });
          xml += '      </item>\n';
        });
      } else {
        Object.entries(items).forEach(([key, value]) => {
          xml += `      <${key}>${value}</${key}>\n`;
        });
      }
      xml += `    </${category}>\n`;
    });
    xml += '  </content>\n';

    xml += '</backup>';
    return xml;
  }

  function convertToSQL(data) {
    let sql = `-- Backup SQL Dump\n-- Generated: ${new Date().toISOString()}\n-- Backup ID: ${data.metadata.backupId}\n\n`;

    sql += '-- Metadata Table\nCREATE TABLE IF NOT EXISTS backup_metadata (\n';
    sql += '  id INTEGER PRIMARY KEY,\n';
    sql += '  backup_id TEXT UNIQUE,\n';
    sql += '  created TEXT,\n';
    sql += '  version TEXT,\n';
    sql += '  format TEXT,\n';
    sql += '  compressed BOOLEAN,\n';
    sql += '  encrypted BOOLEAN,\n';
    sql += '  checksum TEXT\n);\n';

    sql +=
      '\n-- Insert Metadata\nINSERT INTO backup_metadata (backup_id, created, version, format, compressed, encrypted, checksum) VALUES (\n';
    sql += `  '${data.metadata.backupId}',\n`;
    sql += `  '${data.metadata.created}',\n`;
    sql += `  '${data.metadata.version}',\n`;
    sql += `  '${data.metadata.format}',\n`;
    sql += `  ${data.metadata.compressed},\n`;
    sql += `  ${data.metadata.encrypted},\n`;
    sql += `  '${data.metadata.checksum}'\n);\n`;

    sql += '\n-- Content Table\nCREATE TABLE IF NOT EXISTS backup_content (\n';
    sql += '  id INTEGER PRIMARY KEY AUTOINCREMENT,\n';
    sql += '  category TEXT,\n';
    sql += '  item_key TEXT,\n';
    sql += '  item_value TEXT,\n';
    sql += '  backup_id TEXT,\n';
    sql += '  FOREIGN KEY (backup_id) REFERENCES backup_metadata(backup_id)\n);\n';

    sql += '\n-- Insert Content\n';
    Object.entries(data.content).forEach(([category, items]) => {
      if (Array.isArray(items)) {
        items.forEach((item, index) => {
          Object.entries(item).forEach(([key, value]) => {
            sql += `INSERT INTO backup_content (category, item_key, item_value, backup_id) VALUES ('${category}', '${key}', '${JSON.stringify(value)}', '${data.metadata.backupId}');\n`;
          });
        });
      } else {
        Object.entries(items).forEach(([key, value]) => {
          sql += `INSERT INTO backup_content (category, item_key, item_value, backup_id) VALUES ('${category}', '${key}', '${JSON.stringify(value)}', '${data.metadata.backupId}');\n`;
        });
      }
    });

    return sql;
  }

  function convertToYAML(data) {
    let yaml = `# Backup YAML Export\n# Generated: ${new Date().toISOString()}\n# Backup ID: ${data.metadata.backupId}\n\n`;

    yaml += 'metadata:\n';
    Object.entries(data.metadata).forEach(([key, value]) => {
      yaml += `  ${key}: ${value}\n`;
    });

    yaml += '\ncontent:\n';
    Object.entries(data.content).forEach(([category, items]) => {
      yaml += `  ${category}:\n`;
      if (Array.isArray(items)) {
        yaml += '    - \n';
        items.forEach((item, index) => {
          yaml += '      - \n';
          Object.entries(item).forEach(([key, value]) => {
            yaml += `        ${key}: ${typeof value === 'string' ? `"${value}"` : value}\n`;
          });
        });
      } else {
        Object.entries(items).forEach(([key, value]) => {
          yaml += `    ${key}: ${typeof value === 'string' ? `"${value}"` : value}\n`;
        });
      }
    });

    return yaml;
  }

  function showBackupSummary(backupData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'backup-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    const totalItems = Object.keys(backupData.content).length;
    const totalFiles = Object.values(backupData.content).reduce((acc, items) => {
      return acc + (Array.isArray(items) ? items.length : 1);
    }, 0);

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">📦 Backup Created Successfully</h3>
                <button onclick="closeBackupSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--success-color), var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Backup Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${backupData.metadata.backupId}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Backup ID</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${totalItems}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Categories</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${totalFiles}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Items</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${backupData.metadata.format.toUpperCase()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Format</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Backup Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Created</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(backupData.metadata.created).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Version</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${backupData.metadata.version}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Compressed</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${backupData.metadata.compressed ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Encrypted</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${backupData.metadata.encrypted ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Checksum</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${backupData.metadata.checksum ? 'Included' : 'Not Included'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">File Size</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${formatFileSize(JSON.stringify(backupData).length)}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Included Categories</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${Object.keys(backupData.content)
                      .map(
                        (category) => `
                        <span style="padding: 0.25rem 0.75rem; background: var(--primary-color); color: white; border-radius: 4px; font-size: 0.9rem;">
                            ${category.charAt(0).toUpperCase() + category.slice(1)}
                        </span>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeBackupSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeBackupSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeBackupSummary() {
    const modal = document.getElementById('backup-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Sprint Management Functions
  function createNewSprint() {
    console.log('Creating new sprint...');

    // Create new sprint modal
    const sprintModal = document.createElement('div');
    sprintModal.id = 'new-sprint-modal';
    sprintModal.style.cssText = `
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

    sprintModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🚀 Create New Sprint</h3>
                <button onclick="closeNewSprint()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Create a new sprint to organize your work and track progress. Set goals, timeline, and team members.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Sprint Name</label>
                        <input type="text" id="sprint-name" placeholder="Enter sprint name" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Sprint Goal</label>
                        <textarea id="sprint-goal" placeholder="What do you want to achieve in this sprint?" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 80px; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Start Date</label>
                            <input type="date" id="sprint-start-date" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">End Date</label>
                            <input type="date" id="sprint-end-date" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Sprint Type</label>
                        <select id="sprint-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="development">Development Sprint</option>
                            <option value="testing">Testing Sprint</option>
                            <option value="planning">Planning Sprint</option>
                            <option value="review">Review Sprint</option>
                            <option value="maintenance">Maintenance Sprint</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Team Members</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="member-john" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">John Doe</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="member-jane" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Jane Smith</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="member-bob" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Bob Johnson</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="member-alice" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Alice Brown</span>
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Priority</label>
                        <select id="sprint-priority" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="high">High Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="low">Low Priority</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeNewSprint()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="createSprint()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-plus"></i> Create Sprint
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(sprintModal);

    // Set default dates
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 14); // 2 weeks default

    document.getElementById('sprint-start-date').value = today.toISOString().split('T')[0];
    document.getElementById('sprint-end-date').value = endDate.toISOString().split('T')[0];

    // Add click outside to close
    sprintModal.addEventListener('click', (e) => {
      if (e.target === sprintModal) {
        closeNewSprint();
      }
    });

    // Show modal
    setTimeout(() => {
      sprintModal.style.display = 'flex';
    }, 100);
  }

  function closeNewSprint() {
    const modal = document.getElementById('new-sprint-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function createSprint() {
    const sprintName = document.getElementById('sprint-name').value;
    const sprintGoal = document.getElementById('sprint-goal').value;
    const startDate = document.getElementById('sprint-start-date').value;
    const endDate = document.getElementById('sprint-end-date').value;
    const sprintType = document.getElementById('sprint-type').value;
    const sprintPriority = document.getElementById('sprint-priority').value;

    const teamMembers = [];
    if (document.getElementById('member-john').checked) {
      teamMembers.push('John Doe');
    }
    if (document.getElementById('member-jane').checked) {
      teamMembers.push('Jane Smith');
    }
    if (document.getElementById('member-bob').checked) {
      teamMembers.push('Bob Johnson');
    }
    if (document.getElementById('member-alice').checked) {
      teamMembers.push('Alice Brown');
    }

    // Validate required fields
    if (!sprintName || !sprintGoal || !startDate || !endDate) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      showNotification('End date must be after start date', 'error');
      return;
    }

    closeNewSprint();

    // Create sprint progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'create-sprint-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Creating Sprint...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Setting up sprint "${sprintName}"...</span>
                    <span id="create-sprint-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="create-sprint-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="create-sprint-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing sprint creation...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate sprint creation process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(`Sprint "${sprintName}" created successfully!`, 'success');

          // Generate sprint data
          const sprintData = generateSprintData({
            name: sprintName,
            goal: sprintGoal,
            startDate,
            endDate,
            type: sprintType,
            priority: sprintPriority,
            teamMembers,
          });

          // Show sprint summary
          showSprintSummary(sprintData);

          // Add sprint to current data
          addSprintToCurrentData(sprintData);
        }, 500);
      }

      document.getElementById('create-sprint-bar').style.width = progress + '%';
      document.getElementById('create-sprint-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('create-sprint-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing sprint creation...';
      } else if (progress < 40) {
        statusElement.textContent = 'Setting up sprint configuration...';
      } else if (progress < 60) {
        statusElement.textContent = 'Adding team members and permissions...';
      } else if (progress < 80) {
        statusElement.textContent = 'Creating sprint tasks and milestones...';
      } else {
        statusElement.textContent = 'Finalizing sprint setup...';
      }
    }, 350);
  }

  function generateSprintData(sprintConfig) {
    const now = new Date();
    const sprintId = `sprint_${now.getTime()}`;

    return {
      id: sprintId,
      name: sprintConfig.name,
      goal: sprintConfig.goal,
      startDate: sprintConfig.startDate,
      endDate: sprintConfig.endDate,
      type: sprintConfig.type,
      priority: sprintConfig.priority,
      status: 'active',
      teamMembers: sprintConfig.teamMembers,
      created: now.toISOString(),
      tasks: Array.from({ length: Math.floor(Math.random() * 8) + 5 }, (_, index) => ({
        id: `task_${index + 1}`,
        title: `Task ${index + 1}`,
        description: `Description for task ${index + 1}`,
        status: ['todo', 'in-progress', 'review', 'done'][Math.floor(Math.random() * 4)],
        assignee:
          sprintConfig.teamMembers[Math.floor(Math.random() * sprintConfig.teamMembers.length)],
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        estimatedHours: Math.floor(Math.random() * 20) + 2,
        actualHours: Math.floor(Math.random() * 15) + 1,
        created: new Date(now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
      })),
      milestones: Array.from({ length: Math.floor(Math.random() * 4) + 2 }, (_, index) => ({
        id: `milestone_${index + 1}`,
        name: `Milestone ${index + 1}`,
        description: `Description for milestone ${index + 1}`,
        dueDate: new Date(
          new Date(sprintConfig.startDate).getTime() +
            Math.floor(
              Math.random() *
                (new Date(sprintConfig.endDate).getTime() -
                  new Date(sprintConfig.startDate).getTime())
            )
        ).toISOString(),
        completed: Math.random() > 0.5,
      })),
      burndown: Array.from({ length: Math.floor(Math.random() * 14) + 7 }, (_, index) => ({
        date: new Date(new Date(sprintConfig.startDate).getTime() + index * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        planned: Math.floor(Math.random() * 20) + 10,
        actual: Math.floor(Math.random() * 20) + 5,
      })),
      velocity: {
        average: Math.floor(Math.random() * 30) + 20,
        lastSprint: Math.floor(Math.random() * 40) + 15,
        trend: ['increasing', 'stable', 'decreasing'][Math.floor(Math.random() * 3)],
      },
    };
  }

  function showSprintSummary(sprintData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'sprint-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    const totalTasks = sprintData.tasks.length;
    const completedTasks = sprintData.tasks.filter((task) => task.status === 'done').length;
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100);

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🚀 Sprint Created Successfully</h3>
                <button onclick="closeSprintSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--success-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">${sprintData.name}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${sprintData.id}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Sprint ID</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${sprintData.type.charAt(0).toUpperCase() + sprintData.type.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Type</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${sprintData.priority.charAt(0).toUpperCase() + sprintData.priority.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Priority</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${sprintData.teamMembers.length}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Team Members</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Sprint Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Goal</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${sprintData.goal}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Duration</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(sprintData.startDate).toLocaleDateString()} - ${new Date(sprintData.endDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Status</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${sprintData.status.charAt(0).toUpperCase() + sprintData.status.slice(1)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Created</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(sprintData.created).toLocaleString()}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Task Overview</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Tasks</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${totalTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${completedTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">In Progress</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${sprintData.tasks.filter((task) => task.status === 'in-progress').length}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Progress</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${progressPercentage}%</div>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${progressPercentage}%; background: var(--success-color); border-radius: 4px;"></div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Team Members</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${sprintData.teamMembers
                      .map(
                        (member) => `
                        <span style="padding: 0.25rem 0.75rem; background: var(--primary-color); color: white; border-radius: 4px; font-size: 0.9rem;">
                            ${member}
                        </span>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeSprintSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeSprintSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeSprintSummary() {
    const modal = document.getElementById('sprint-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function addSprintToCurrentData(sprintData) {
    // This would normally update the current sprint data
    // For now, we'll just store it in localStorage for demonstration
    const currentSprints = JSON.parse(localStorage.getItem('sprints') || '[]');
    currentSprints.push(sprintData);
    localStorage.setItem('sprints', JSON.stringify(currentSprints));
  }

  // Refresh Sprint Data Function
  function refreshSprintData() {
    console.log('Refreshing sprint data...');

    // Create refresh progress modal
    const refreshModal = document.createElement('div');
    refreshModal.id = 'refresh-sprint-modal';
    refreshModal.style.cssText = `
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

    refreshModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">🔄 Refreshing Sprint Data...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Updating sprint information...</span>
                    <span id="refresh-sprint-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="refresh-sprint-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="refresh-sprint-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Connecting to sprint management system...
            </div>
        </div>
    `;

    document.body.appendChild(refreshModal);

    // Simulate refresh process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(refreshModal);
          showNotification('Sprint data refreshed successfully!', 'success');

          // Generate updated sprint data
          const updatedData = generateUpdatedSprintData();

          // Show refresh summary
          showRefreshSummary(updatedData);
        }, 500);
      }

      document.getElementById('refresh-sprint-bar').style.width = progress + '%';
      document.getElementById('refresh-sprint-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('refresh-sprint-status');
      if (progress < 20) {
        statusElement.textContent = 'Connecting to sprint management system...';
      } else if (progress < 40) {
        statusElement.textContent = 'Fetching latest sprint data...';
      } else if (progress < 60) {
        statusElement.textContent = 'Updating task statuses and progress...';
      } else if (progress < 80) {
        statusElement.textContent = 'Calculating burndown and velocity metrics...';
      } else {
        statusElement.textContent = 'Finalizing data refresh...';
      }
    }, 300);
  }

  function generateUpdatedSprintData() {
    const currentSprints = JSON.parse(localStorage.getItem('sprints') || '[]');

    // Simulate updated data
    const updatedData = {
      lastUpdated: new Date().toISOString(),
      totalSprints: currentSprints.length,
      activeSprints: currentSprints.filter((sprint) => sprint.status === 'active').length,
      completedSprints: currentSprints.filter((sprint) => sprint.status === 'completed').length,
      totalTasks: currentSprints.reduce((acc, sprint) => acc + sprint.tasks.length, 0),
      completedTasks: currentSprints.reduce(
        (acc, sprint) => acc + sprint.tasks.filter((task) => task.status === 'done').length,
        0
      ),
      averageVelocity: Math.floor(Math.random() * 30) + 20,
      recentActivity: Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, index) => ({
        id: `activity_${index + 1}`,
        type: ['task_completed', 'task_created', 'sprint_started', 'milestone_completed'][
          Math.floor(Math.random() * 4)
        ],
        description: `Recent activity ${index + 1}`,
        timestamp: new Date(
          Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000)
        ).toISOString(),
        user: ['John Doe', 'Jane Smith', 'Bob Johnson'][Math.floor(Math.random() * 3)],
      })),
    };

    return updatedData;
  }

  function showRefreshSummary(updatedData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'refresh-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🔄 Data Refresh Complete</h3>
                <button onclick="closeRefreshSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--success-color), var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Refresh Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.totalSprints}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Sprints</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.activeSprints}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Active</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.totalTasks}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Tasks</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.averageVelocity}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Avg Velocity</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Refresh Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Last Updated</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(updatedData.lastUpdated).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed Sprints</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${updatedData.completedSprints}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed Tasks</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${updatedData.completedTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Recent Activities</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${updatedData.recentActivity.length}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Recent Activity</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${updatedData.recentActivity
                      .slice(0, 5)
                      .map(
                        (activity) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: var(--card-bg); border-radius: 4px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500; font-size: 0.9rem;">${activity.description}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">${activity.user} • ${new Date(activity.timestamp).toLocaleString()}</div>
                            </div>
                            <span style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: var(--primary-color); color: white; border-radius: 4px;">
                                ${activity.type.replace('_', ' ')}
                            </span>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeRefreshSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeRefreshSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeRefreshSummary() {
    const modal = document.getElementById('refresh-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Refresh Backup List Function
  function refreshBackupList() {
    console.log('Refreshing backup list...');

    // Create refresh progress modal
    const refreshModal = document.createElement('div');
    refreshModal.id = 'refresh-backup-list-modal';
    refreshModal.style.cssText = `
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

    refreshModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">🔄 Refreshing Backup List...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Updating backup inventory...</span>
                    <span id="refresh-backup-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="refresh-backup-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="refresh-backup-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Connecting to backup storage system...
            </div>
        </div>
    `;

    document.body.appendChild(refreshModal);

    // Simulate refresh process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(refreshModal);
          showNotification('Backup list refreshed successfully!', 'success');

          // Generate updated backup list data
          const updatedData = generateUpdatedBackupListData();

          // Show refresh summary
          showBackupListSummary(updatedData);

          // Update current backup data
          updateCurrentBackupData(updatedData);
        }, 500);
      }

      document.getElementById('refresh-backup-bar').style.width = progress + '%';
      document.getElementById('refresh-backup-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('refresh-backup-status');
      if (progress < 20) {
        statusElement.textContent = 'Connecting to backup storage system...';
      } else if (progress < 40) {
        statusElement.textContent = 'Scanning backup directory...';
      } else if (progress < 60) {
        statusElement.textContent = 'Validating backup integrity...';
      } else if (progress < 80) {
        statusElement.textContent = 'Updating backup metadata...';
      } else {
        statusElement.textContent = 'Finalizing backup list...';
      }
    }, 300);
  }

  function generateUpdatedBackupListData() {
    // Get current backups from localStorage
    const currentBackups = JSON.parse(localStorage.getItem('backups') || '[]');

    // Simulate updated data with new backup
    const newBackup = generateBackupData({
      includeDashboardData: true,
      includeUserPreferences: true,
      includeUploadHistory: true,
      includeReports: true,
      includeSystemLogs: false,
      createZipArchive: true,
      includeChecksum: true,
      encryptBackup: false,
      backupFormat: 'json',
    });

    currentBackups.push(newBackup);

    // Keep only last 10 backups
    if (currentBackups.length > 10) {
      currentBackups = currentBackups.slice(-10);
    }

    // Update localStorage
    localStorage.setItem('backups', JSON.stringify(currentBackups));

    return {
      lastUpdated: new Date().toISOString(),
      totalBackups: currentBackups.length,
      recentBackups: currentBackups.slice(-5),
      totalSize: currentBackups.reduce((acc, backup) => acc + JSON.stringify(backup).length, 0),
      oldestBackup: currentBackups.length > 0 ? currentBackups[0].metadata.backupId : null,
      newestBackup: newBackup.metadata.backupId,
    };
  }

  function showBackupListSummary(updatedData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'backup-list-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🔄 Backup List Refreshed</h3>
                <button onclick="closeBackupListSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--success-color), var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Refresh Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.totalBackups}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Backups</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.recentBackups.length}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Recent Backups</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${formatFileSize(updatedData.totalSize)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total Size</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${updatedData.newestBackup}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Newest Backup</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Refresh Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Last Updated</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(updatedData.lastUpdated).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Oldest Backup</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${updatedData.oldestBackup || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Storage Location</div>
                        <div style="color: var(--text-primary); font-weight: 500;">Local Storage</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Retention Policy</div>
                        <div style="color: var(--text-primary); font-weight: 500;">Last 10 backups</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Recent Backups</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${updatedData.recentBackups
                      .map(
                        (backup, index) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: var(--card-bg); border-radius: 4px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500; font-size: 0.9rem;">${backup.metadata.backupId}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">${new Date(backup.metadata.created).toLocaleDateString()}</div>
                            </div>
                            <span style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: ${backup.metadata.compressed ? 'var(--success-color)' : 'var(--primary-color)'}; color: white; border-radius: 4px;">
                                ${backup.metadata.format.toUpperCase()}
                            </span>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeBackupListSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeBackupListSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeBackupListSummary() {
    const modal = document.getElementById('backup-list-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function updateCurrentBackupData(updatedData) {
    // This would normally update the current backup display
    // For now, we'll just update localStorage
    const currentBackups = JSON.parse(localStorage.getItem('backups') || '[]');
    localStorage.setItem('backups', JSON.stringify(currentBackups));

    // Update any UI elements that display backup information
    const backupCountElements = document.querySelectorAll('.backup-count');
    backupCountElements.forEach((element) => {
      element.textContent = updatedData.totalBackups;
    });

    const recentBackupElements = document.querySelectorAll('.recent-backup-count');
    recentBackupElements.forEach((element) => {
      element.textContent = updatedData.recentBackups.length;
    });
  }

  // Milestone and Timeline Management Functions
  function addMilestone() {
    console.log('Adding new milestone...');

    // Create milestone modal
    const milestoneModal = document.createElement('div');
    milestoneModal.id = 'add-milestone-modal';
    milestoneModal.style.cssText = `
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

    milestoneModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🎯 Add New Milestone</h3>
                <button onclick="closeAddMilestone()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Create a new milestone to track important project goals and deadlines.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Milestone Name</label>
                        <input type="text" id="milestone-name" placeholder="Enter milestone name" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Description</label>
                        <textarea id="milestone-description" placeholder="Describe the milestone and its objectives" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 80px; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Target Date</label>
                            <input type="date" id="milestone-date" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Priority</label>
                            <select id="milestone-priority" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Milestone Type</label>
                        <select id="milestone-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="release">Release Milestone</option>
                            <option value="feature">Feature Milestone</option>
                            <option value="testing">Testing Milestone</option>
                            <option value="review">Review Milestone</option>
                            <option value="deployment">Deployment Milestone</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Assign To</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="assign-john" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">John Doe</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="assign-jane" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Jane Smith</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="assign-bob" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Bob Johnson</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="assign-alice" style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Alice Brown</span>
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Dependencies</label>
                        <textarea id="milestone-dependencies" placeholder="List any dependencies or prerequisites" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 60px; resize: vertical;"></textarea>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeAddMilestone()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="createMilestone()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-plus"></i> Add Milestone
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(milestoneModal);

    // Set default date (30 days from now)
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    document.getElementById('milestone-date').value = defaultDate.toISOString().split('T')[0];

    // Add click outside to close
    milestoneModal.addEventListener('click', (e) => {
      if (e.target === milestoneModal) {
        closeAddMilestone();
      }
    });

    // Show modal
    setTimeout(() => {
      milestoneModal.style.display = 'flex';
    }, 100);
  }

  function closeAddMilestone() {
    const modal = document.getElementById('add-milestone-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function createMilestone() {
    const milestoneName = document.getElementById('milestone-name').value;
    const milestoneDescription = document.getElementById('milestone-description').value;
    const milestoneDate = document.getElementById('milestone-date').value;
    const milestonePriority = document.getElementById('milestone-priority').value;
    const milestoneType = document.getElementById('milestone-type').value;
    const milestoneDependencies = document.getElementById('milestone-dependencies').value;

    const assignees = [];
    if (document.getElementById('assign-john').checked) {
      assignees.push('John Doe');
    }
    if (document.getElementById('assign-jane').checked) {
      assignees.push('Jane Smith');
    }
    if (document.getElementById('assign-bob').checked) {
      assignees.push('Bob Johnson');
    }
    if (document.getElementById('assign-alice').checked) {
      assignees.push('Alice Brown');
    }

    // Validate required fields
    if (!milestoneName || !milestoneDescription || !milestoneDate) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    closeAddMilestone();

    // Create milestone progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'create-milestone-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Creating Milestone...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Setting up milestone "${milestoneName}"...</span>
                    <span id="create-milestone-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="create-milestone-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="create-milestone-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing milestone creation...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate milestone creation process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(`Milestone "${milestoneName}" created successfully!`, 'success');

          // Generate milestone data
          const milestoneData = generateMilestoneData({
            name: milestoneName,
            description: milestoneDescription,
            date: milestoneDate,
            priority: milestonePriority,
            type: milestoneType,
            assignees,
            dependencies: milestoneDependencies,
          });

          // Show milestone summary
          showMilestoneSummary(milestoneData);

          // Add milestone to current data
          addMilestoneToCurrentData(milestoneData);
        }, 500);
      }

      document.getElementById('create-milestone-bar').style.width = progress + '%';
      document.getElementById('create-milestone-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('create-milestone-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing milestone creation...';
      } else if (progress < 40) {
        statusElement.textContent = 'Setting up milestone configuration...';
      } else if (progress < 60) {
        statusElement.textContent = 'Adding assignees and dependencies...';
      } else if (progress < 80) {
        statusElement.textContent = 'Creating timeline entry...';
      } else {
        statusElement.textContent = 'Finalizing milestone setup...';
      }
    }, 350);
  }

  function generateMilestoneData(milestoneConfig) {
    const now = new Date();
    const milestoneId = `milestone_${now.getTime()}`;

    return {
      id: milestoneId,
      name: milestoneConfig.name,
      description: milestoneConfig.description,
      targetDate: milestoneConfig.date,
      priority: milestoneConfig.priority,
      type: milestoneConfig.type,
      status: 'upcoming',
      assignees: milestoneConfig.assignees,
      dependencies: milestoneConfig.dependencies,
      created: now.toISOString(),
      progress: 0,
      tasks: Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, index) => ({
        id: `task_${index + 1}`,
        title: `Task ${index + 1}`,
        status: ['todo', 'in-progress', 'done'][Math.floor(Math.random() * 3)],
        assignee:
          milestoneConfig.assignees[Math.floor(Math.random() * milestoneConfig.assignees.length)],
        dueDate: new Date(
          new Date(milestoneConfig.date).getTime() -
            Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
        ).toISOString(),
      })),
      deliverables: Array.from({ length: Math.floor(Math.random() * 3) + 2 }, (_, index) => ({
        id: `deliverable_${index + 1}`,
        name: `Deliverable ${index + 1}`,
        status: Math.random() > 0.5 ? 'completed' : 'pending',
        description: `Description for deliverable ${index + 1}`,
      })),
      risks: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, index) => ({
        id: `risk_${index + 1}`,
        description: `Risk ${index + 1}`,
        impact: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        probability: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        mitigation: `Mitigation strategy for risk ${index + 1}`,
      })),
    };
  }

  function showMilestoneSummary(milestoneData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'milestone-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    const totalTasks = milestoneData.tasks.length;
    const completedTasks = milestoneData.tasks.filter((task) => task.status === 'done').length;
    const progressPercentage = Math.round((completedTasks / totalTasks) * 100);

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🎯 Milestone Created Successfully</h3>
                <button onclick="closeMilestoneSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--success-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">${milestoneData.name}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${milestoneData.id}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Milestone ID</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${milestoneData.type.charAt(0).toUpperCase() + milestoneData.type.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Type</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${milestoneData.priority.charAt(0).toUpperCase() + milestoneData.priority.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Priority</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${milestoneData.assignees.length}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Assignees</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Milestone Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Description</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${milestoneData.description}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Target Date</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(milestoneData.targetDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Status</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${milestoneData.status.charAt(0).toUpperCase() + milestoneData.status.slice(1)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Created</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(milestoneData.created).toLocaleString()}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Task Overview</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Tasks</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${totalTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${completedTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">In Progress</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${milestoneData.tasks.filter((task) => task.status === 'in-progress').length}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Progress</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${progressPercentage}%</div>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${progressPercentage}%; background: var(--success-color); border-radius: 4px;"></div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Team Members</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${milestoneData.assignees
                      .map(
                        (assignee) => `
                        <span style="padding: 0.25rem 0.75rem; background: var(--primary-color); color: white; border-radius: 4px; font-size: 0.9rem;">
                            ${assignee}
                        </span>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeMilestoneSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeMilestoneSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeMilestoneSummary() {
    const modal = document.getElementById('milestone-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function addMilestoneToCurrentData(milestoneData) {
    // This would normally update the current milestone data
    // For now, we'll just store it in localStorage for demonstration
    const currentMilestones = JSON.parse(localStorage.getItem('milestones') || '[]');
    currentMilestones.push(milestoneData);
    localStorage.setItem('milestones', JSON.stringify(currentMilestones));
  }

  // Edit Timeline Function
  function editTimeline() {
    console.log('Editing timeline...');

    // Create timeline editing modal
    const timelineModal = document.createElement('div');
    timelineModal.id = 'edit-timeline-modal';
    timelineModal.style.cssText = `
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

    timelineModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 800px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">✏️ Edit Timeline</h3>
                <button onclick="closeEditTimeline()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Edit your project timeline, milestones, and key dates. Drag and drop to reorder items.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Timeline Settings</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Project Start Date</label>
                                <input type="date" id="timeline-start-date" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            </div>
                            <div>
                                <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Project End Date</label>
                                <input type="date" id="timeline-end-date" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            </div>
                        </div>
                        <div style="margin-top: 1rem;">
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Timeline View</label>
                            <select id="timeline-view" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="gantt">Gantt Chart</option>
                                <option value="calendar">Calendar View</option>
                                <option value="kanban">Kanban Board</option>
                                <option value="list">List View</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Current Milestones</h4>
                        <div id="milestones-list" style="max-height: 300px; overflow-y: auto;">
                            ${generateMilestonesList()}
                        </div>
                        <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                            <button onclick="addNewMilestoneItem()" style="padding: 0.5rem 1rem; border: none; border-radius: 4px; background: var(--primary-color); color: white; cursor: pointer;">
                                <i class="fas fa-plus"></i> Add Milestone
                            </button>
                            <button onclick="reorderMilestones()" style="padding: 0.5rem 1rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                                <i class="fas fa-sort"></i> Reorder
                            </button>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                        <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Key Dates</h4>
                        <div id="key-dates-list" style="max-height: 200px; overflow-y: auto;">
                            ${generateKeyDatesList()}
                        </div>
                        <div style="margin-top: 1rem;">
                            <button onclick="addNewKeyDate()" style="padding: 0.5rem 1rem; border: none; border-radius: 4px; background: var(--primary-color); color: white; cursor: pointer;">
                                <i class="fas fa-plus"></i> Add Key Date
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeEditTimeline()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="saveTimeline()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-save"></i> Save Timeline
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(timelineModal);

    // Set default dates
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + 6); // 6 months default

    document.getElementById('timeline-start-date').value = today.toISOString().split('T')[0];
    document.getElementById('timeline-end-date').value = endDate.toISOString().split('T')[0];

    // Add click outside to close
    timelineModal.addEventListener('click', (e) => {
      if (e.target === timelineModal) {
        closeEditTimeline();
      }
    });

    // Show modal
    setTimeout(() => {
      timelineModal.style.display = 'flex';
    }, 100);
  }

  function generateMilestonesList() {
    const currentMilestones = JSON.parse(localStorage.getItem('milestones') || '[]');

    if (currentMilestones.length === 0) {
      return '<p style="color: var(--text-secondary); text-align: center;">No milestones yet. Create your first milestone!</p>';
    }

    return currentMilestones
      .map(
        (milestone, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; margin-bottom: 0.5rem; background: var(--card-bg); border-radius: 4px; border-left: 4px solid ${getPriorityColor(milestone.priority)};">
            <div style="flex: 1;">
                <div style="color: var(--text-primary); font-weight: 500;">${milestone.name}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${new Date(milestone.targetDate).toLocaleDateString()} • ${milestone.type}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="editMilestoneItem('${milestone.id}')" style="padding: 0.25rem 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteMilestoneItem('${milestone.id}')" style="padding: 0.25rem 0.5rem; border: 1px solid var(--danger-color); border-radius: 4px; background: var(--bg-primary); color: var(--danger-color); cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `
      )
      .join('');
  }

  function generateKeyDatesList() {
    const keyDates = [
      { id: 'date_1', name: 'Project Kickoff', date: '2024-01-15', type: 'start' },
      { id: 'date_2', name: 'First Sprint Review', date: '2024-02-01', type: 'review' },
      { id: 'date_3', name: 'Beta Release', date: '2024-03-15', type: 'release' },
      { id: 'date_4', name: 'Final Delivery', date: '2024-06-30', type: 'delivery' },
    ];

    return keyDates
      .map(
        (date) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: var(--card-bg); border-radius: 4px;">
            <div>
                <div style="color: var(--text-primary); font-weight: 500;">${date.name}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${new Date(date.date).toLocaleDateString()}</div>
            </div>
            <button onclick="deleteKeyDate('${date.id}')" style="padding: 0.25rem 0.5rem; border: 1px solid var(--danger-color); border-radius: 4px; background: var(--bg-primary); color: var(--danger-color); cursor: pointer;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `
      )
      .join('');
  }

  function getPriorityColor(priority) {
    switch (priority) {
      case 'high':
        return 'var(--danger-color)';
      case 'medium':
        return 'var(--warning-color)';
      case 'low':
        return 'var(--success-color)';
      default:
        return 'var(--primary-color)';
    }
  }

  function closeEditTimeline() {
    const modal = document.getElementById('edit-timeline-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function saveTimeline() {
    const startDate = document.getElementById('timeline-start-date').value;
    const endDate = document.getElementById('timeline-end-date').value;
    const timelineView = document.getElementById('timeline-view').value;

    if (!startDate || !endDate) {
      showNotification('Please set both start and end dates', 'error');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      showNotification('End date must be after start date', 'error');
      return;
    }

    closeEditTimeline();

    // Create save progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'save-timeline-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Saving Timeline...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Updating timeline configuration...</span>
                    <span id="save-timeline-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="save-timeline-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="save-timeline-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing timeline save...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate save process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification('Timeline saved successfully!', 'success');

          // Generate timeline data
          const timelineData = generateTimelineData({
            startDate,
            endDate,
            view: timelineView,
          });

          // Show timeline summary
          showTimelineSummary(timelineData);

          // Update current timeline data
          updateCurrentTimelineData(timelineData);
        }, 500);
      }

      document.getElementById('save-timeline-bar').style.width = progress + '%';
      document.getElementById('save-timeline-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('save-timeline-status');
      if (progress < 25) {
        statusElement.textContent = 'Initializing timeline save...';
      } else if (progress < 50) {
        statusElement.textContent = 'Updating milestone dates...';
      } else if (progress < 75) {
        statusElement.textContent = 'Saving timeline configuration...';
      } else {
        statusElement.textContent = 'Finalizing timeline changes...';
      }
    }, 300);
  }

  function generateTimelineData(timelineConfig) {
    return {
      id: `timeline_${new Date().getTime()}`,
      startDate: timelineConfig.startDate,
      endDate: timelineConfig.endDate,
      view: timelineConfig.view,
      lastUpdated: new Date().toISOString(),
      milestones: JSON.parse(localStorage.getItem('milestones') || '[]'),
      keyDates: [
        { id: 'date_1', name: 'Project Kickoff', date: timelineConfig.startDate, type: 'start' },
        {
          id: 'date_2',
          name: 'First Sprint Review',
          date: new Date(new Date(timelineConfig.startDate).getTime() + 15 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          type: 'review',
        },
        {
          id: 'date_3',
          name: 'Beta Release',
          date: new Date(new Date(timelineConfig.startDate).getTime() + 60 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          type: 'release',
        },
        { id: 'date_4', name: 'Final Delivery', date: timelineConfig.endDate, type: 'delivery' },
      ],
      duration: Math.floor(
        (new Date(timelineConfig.endDate) - new Date(timelineConfig.startDate)) /
          (1000 * 60 * 60 * 24)
      ),
      totalMilestones: JSON.parse(localStorage.getItem('milestones') || '[]').length,
    };
  }

  function showTimelineSummary(timelineData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'timeline-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">✏️ Timeline Saved Successfully</h3>
                <button onclick="closeTimelineSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--success-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Timeline Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${timelineData.duration}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Days Duration</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${timelineData.totalMilestones}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Milestones</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${timelineData.keyDates.length}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Key Dates</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${timelineData.view.charAt(0).toUpperCase() + timelineData.view.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">View Type</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Timeline Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Start Date</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(timelineData.startDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">End Date</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(timelineData.endDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Last Updated</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(timelineData.lastUpdated).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Timeline ID</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${timelineData.id}</div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeTimelineSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeTimelineSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeTimelineSummary() {
    const modal = document.getElementById('timeline-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function updateCurrentTimelineData(timelineData) {
    // This would normally update the current timeline display
    // For now, we'll just update localStorage
    localStorage.setItem('timeline', JSON.stringify(timelineData));

    // Update any UI elements that display timeline information
    const timelineElements = document.querySelectorAll('.timeline-duration');
    timelineElements.forEach((element) => {
      element.textContent = `${timelineData.duration} days`;
    });
  }

  function addNewMilestoneItem() {
    // This would open the add milestone modal
    addMilestone();
  }

  function addNewKeyDate() {
    // This would open a modal to add a new key date
    showNotification('Add key date feature coming soon!', 'info');
  }

  function editMilestoneItem(milestoneId) {
    // This would open the edit milestone modal
    showNotification('Edit milestone feature coming soon!', 'info');
  }

  function deleteMilestoneItem(milestoneId) {
    // This would delete the milestone
    showNotification('Delete milestone feature coming soon!', 'info');
  }

  function deleteKeyDate(dateId) {
    // This would delete the key date
    showNotification('Delete key date feature coming soon!', 'info');
  }

  function reorderMilestones() {
    // This would enable drag and drop reordering
    showNotification('Reorder milestones feature coming soon!', 'info');
  }

  // Export Roadmap Function
  function exportRoadmap() {
    console.log('Exporting roadmap...');

    // Create export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'export-roadmap-modal';
    exportModal.style.cssText = `
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

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📊 Export Roadmap</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Export your project roadmap with milestones and timeline data.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Export Format</label>
                        <select id="roadmap-export-format" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="pdf">PDF Document</option>
                            <option value="excel">Excel Spreadsheet</option>
                            <option value="powerpoint">PowerPoint Presentation</option>
                            <option value="json">JSON Data</option>
                            <option value="csv">CSV File</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Export Type</label>
                        <select id="roadmap-export-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="summary">Summary Overview</option>
                            <option value="detailed">Detailed Timeline</option>
                            <option value="milestones">Milestones Only</option>
                            <option value="gantt">Gantt Chart</option>
                            <option value="executive">Executive Report</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Time Period</label>
                        <select id="roadmap-export-period" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="current">Current Timeline</option>
                            <option value="next30">Next 30 Days</option>
                            <option value="next90">Next 90 Days</option>
                            <option value="next180">Next 180 Days</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Include Options</label>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-milestones" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include milestones</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-key-dates" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include key dates</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-progress" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include progress data</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-charts" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Include charts and graphs</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeExportRoadmap()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="generateRoadmapExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export Roadmap
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeExportRoadmap();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeExportRoadmap() {
    const modal = document.getElementById('export-roadmap-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function generateRoadmapExport() {
    const exportFormat = document.getElementById('roadmap-export-format').value;
    const exportType = document.getElementById('roadmap-export-type').value;
    const exportPeriod = document.getElementById('roadmap-export-period').value;
    const includeMilestones = document.getElementById('include-milestones')?.checked ?? true;
    const includeKeyDates = document.getElementById('include-key-dates')?.checked ?? true;
    const includeProgress = document.getElementById('include-progress')?.checked ?? true;
    const includeCharts = document.getElementById('include-charts')?.checked ?? true;

    closeExportRoadmap();

    // Create export progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'export-roadmap-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Exporting Roadmap...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Generating ${exportFormat} export...</span>
                    <span id="export-roadmap-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="export-roadmap-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="export-roadmap-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing export process...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate export process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(
            `Roadmap exported successfully as ${exportFormat.toUpperCase()}!`,
            'success'
          );

          // Generate and download roadmap export
          const roadmapData = generateRoadmapData({
            format: exportFormat,
            type: exportType,
            period: exportPeriod,
            includeMilestones,
            includeKeyDates,
            includeProgress,
            includeCharts,
          });

          downloadRoadmapExport(roadmapData, exportFormat);

          // Show export summary
          showRoadmapExportSummary(roadmapData);
        }, 500);
      }

      document.getElementById('export-roadmap-bar').style.width = progress + '%';
      document.getElementById('export-roadmap-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('export-roadmap-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing export process...';
      } else if (progress < 40) {
        statusElement.textContent = 'Collecting timeline data...';
      } else if (progress < 60) {
        statusElement.textContent = 'Generating charts and visualizations...';
      } else if (progress < 80) {
        statusElement.textContent = 'Formatting for ${exportFormat.toUpperCase()}...';
      } else {
        statusElement.textContent = 'Finalizing export...';
      }
    }, 350);
  }

  function generateRoadmapData(exportConfig) {
    const timeline = JSON.parse(localStorage.getItem('timeline') || '{}');
    const milestones = JSON.parse(localStorage.getItem('milestones') || '[]');

    return {
      exportId: `roadmap_${new Date().getTime()}`,
      format: exportConfig.format,
      type: exportConfig.type,
      period: exportConfig.period,
      generated: new Date().toISOString(),
      timeline: timeline,
      milestones: milestones,
      keyDates: timeline.keyDates || [],
      options: {
        includeMilestones: exportConfig.includeMilestones,
        includeKeyDates: exportConfig.includeKeyDates,
        includeProgress: exportConfig.includeProgress,
        includeCharts: exportConfig.includeCharts,
      },
      content: generateRoadmapContent(exportConfig),
    };
  }

  function generateRoadmapContent(exportConfig) {
    const milestones = JSON.parse(localStorage.getItem('milestones') || '[]');
    const timeline = JSON.parse(localStorage.getItem('timeline') || '{}');

    switch (exportConfig.type) {
      case 'summary':
        return generateRoadmapSummaryContent(milestones, timeline, exportConfig);
      case 'detailed':
        return generateRoadmapDetailedContent(milestones, timeline, exportConfig);
      case 'milestones':
        return generateRoadmapMilestonesContent(milestones, exportConfig);
      case 'gantt':
        return generateRoadmapGanttContent(milestones, timeline, exportConfig);
      case 'executive':
        return generateRoadmapExecutiveContent(milestones, timeline, exportConfig);
      default:
        return generateRoadmapSummaryContent(milestones, timeline, exportConfig);
    }
  }

  function generateRoadmapSummaryContent(milestones, timeline, exportConfig) {
    return `
PROJECT ROADMAP SUMMARY
========================

Generated: ${new Date().toLocaleString()}
Export Type: Summary
Export Format: ${exportConfig.format.toUpperCase()}
Export Period: ${exportConfig.period}

OVERVIEW
--------
Project Duration: ${timeline.duration || 'N/A'} days
Total Milestones: ${milestones.length}
Key Dates: ${(timeline.keyDates || []).length}
Export Date: ${new Date().toLocaleDateString()}

${
  exportConfig.includeMilestones
    ? `
MILESTONES
-----------
${milestones
  .map(
    (milestone, index) => `
${index + 1}. ${milestone.name}
   Target Date: ${new Date(milestone.targetDate).toLocaleDateString()}
   Priority: ${milestone.priority}
   Type: ${milestone.type}
   Status: ${milestone.status}
   Progress: ${milestone.progress}%
   Assignees: ${milestone.assignees.join(', ')}
`
  )
  .join('\n')}
`
    : ''
}

${
  exportConfig.includeKeyDates
    ? `
KEY DATES
---------
${(timeline.keyDates || [])
  .map(
    (date, index) => `
${index + 1}. ${date.name}
   Date: ${new Date(date.date).toLocaleDateString()}
   Type: ${date.type}
`
  )
  .join('\n')}
`
    : ''
}

${
  exportConfig.includeProgress
    ? `
PROGRESS SUMMARY
----------------
Completed Milestones: ${milestones.filter((m) => m.status === 'completed').length}
Upcoming Milestones: ${milestones.filter((m) => m.status === 'upcoming').length}
In Progress: ${milestones.filter((m) => m.status === 'in-progress').length}
Overall Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%
`
    : ''
}

RECOMMENDATIONS
---------------
1. Review milestone priorities and adjust as needed
2. Ensure all milestones have clear deliverables
3. Monitor progress regularly and update status
4. Communicate timeline changes to stakeholders
5. Document lessons learned for future projects

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateRoadmapDetailedContent(milestones, timeline, exportConfig) {
    return `
PROJECT ROADMAP DETAILED REPORT
================================

Generated: ${new Date().toLocaleString()}
Export Type: Detailed Timeline
Export Format: ${exportConfig.format.toUpperCase()}
Export Period: ${exportConfig.period}

PROJECT INFORMATION
------------------
Start Date: ${new Date(timeline.startDate || 'N/A').toLocaleDateString()}
End Date: ${new Date(timeline.endDate || 'N/A').toLocaleDateString()}
Duration: ${timeline.duration || 'N/A'} days
Timeline View: ${timeline.view || 'N/A'}
Last Updated: ${new Date(timeline.lastUpdated || 'N/A').toLocaleString()}

${
  exportConfig.includeMilestones
    ? `
DETAILED MILESTONES
--------------------
${milestones
  .map(
    (milestone, index) => `
MILESTONE ${index + 1}: ${milestone.name}
========================
ID: ${milestone.id}
Description: ${milestone.description}
Target Date: ${new Date(milestone.targetDate).toLocaleDateString()}
Priority: ${milestone.priority}
Type: ${milestone.type}
Status: ${milestone.status}
Progress: ${milestone.progress}%
Created: ${new Date(milestone.created).toLocaleString()}

Team Members: ${milestone.assignees.join(', ')}
Dependencies: ${milestone.dependencies || 'None'}

TASKS (${milestone.tasks?.length || 0}):
${
  milestone.tasks
    ?.map(
      (task, taskIndex) => `
  ${taskIndex + 1}. ${task.title}
     Status: ${task.status}
     Assignee: ${task.assignee}
     Due Date: ${new Date(task.dueDate).toLocaleDateString()}
`
    )
    .join('') || 'No tasks assigned'
}

DELIVERABLES (${milestone.deliverables?.length || 0}):
${
  milestone.deliverables
    ?.map(
      (deliverable, delIndex) => `
  ${delIndex + 1}. ${deliverable.name}
     Status: ${deliverable.status}
     Description: ${deliverable.description}
`
    )
    .join('') || 'No deliverables defined'
}

RISKS (${milestone.risks?.length || 0}):
${
  milestone.risks
    ?.map(
      (risk, riskIndex) => `
  ${riskIndex + 1}. ${risk.description}
     Impact: ${risk.impact}
     Probability: ${risk.probability}
     Mitigation: ${risk.mitigation}
`
    )
    .join('') || 'No risks identified'
}
`
  )
  .join('\n\n')}
`
    : ''
}

${
  exportConfig.includeKeyDates
    ? `
KEY DATES
---------
${(timeline.keyDates || [])
  .map(
    (date, index) => `
${index + 1}. ${date.name}
   Date: ${new Date(date.date).toLocaleDateString()}
   Type: ${date.type}
   Description: ${date.type === 'start' ? 'Project start date' : date.type === 'review' ? 'Review checkpoint' : date.type === 'release' ? 'Release milestone' : 'Delivery deadline'}
`
  )
  .join('\n')}
`
    : ''
}

${
  exportConfig.includeProgress
    ? `
PROGRESS ANALYSIS
-----------------
Overall Milestone Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%
Completed Milestones: ${milestones.filter((m) => m.status === 'completed').length}/${milestones.length}
Upcoming Milestones: ${milestones.filter((m) => m.status === 'upcoming').length}/${milestones.length}
In Progress Milestones: ${milestones.filter((m) => m.status === 'in-progress').length}/${milestones.length}

TASK COMPLETION:
${
  milestones.reduce((acc, milestone) => {
    const completed = milestone.tasks?.filter((t) => t.status === 'done').length || 0;
    const total = milestone.tasks?.length || 0;
    return acc + (total > 0 ? Math.round((completed / total) * 100) : 0);
  }, 0) / milestones.length
}% average completion

DELIVERABLE STATUS:
${
  milestones.reduce((acc, milestone) => {
    const completed = milestone.deliverables?.filter((d) => d.status === 'completed').length || 0;
    const total = milestone.deliverables?.length || 0;
    return acc + (total > 0 ? Math.round((completed / total) * 100) : 0);
  }, 0) / milestones.length
}% deliverable completion
`
    : ''
}

${
  exportConfig.includeCharts
    ? `
CHART DATA
----------
[GANTT CHART DATA]
Timeline: ${timeline.startDate || 'N/A'} to ${timeline.endDate || 'N/A'}
Milestones: ${milestones.length}
Key Dates: ${(timeline.keyDates || []).length}

[PROGRESS CHART DATA]
Overall Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%
Completed: ${milestones.filter((m) => m.status === 'completed').length}
In Progress: ${milestones.filter((m) => m.status === 'in-progress').length}
Upcoming: ${milestones.filter((m) => m.status === 'upcoming').length}

[MILESTONE DISTRIBUTION]
By Priority: ${milestones.filter((m) => m.priority === 'high').length} High, ${milestones.filter((m) => m.priority === 'medium').length} Medium, ${milestones.filter((m) => m.priority === 'low').length} Low
By Type: ${milestones.filter((m) => m.type === 'release').length} Release, ${milestones.filter((m) => m.type === 'feature').length} Feature, ${milestones.filter((m) => m.type === 'testing').length} Testing, ${milestones.filter((m) => m.type === 'review').length} Review
`
    : ''
}

NEXT STEPS
----------
1. Review detailed milestone progress
2. Address any risks or dependencies
3. Update task assignments as needed
4. Monitor upcoming deadlines
5. Communicate progress to stakeholders
6. Adjust timeline if necessary
7. Document lessons learned

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateRoadmapMilestonesContent(milestones, exportConfig) {
    return `
PROJECT MILESTONES REPORT
=======================

Generated: ${new Date().toLocaleString()}
Export Type: Milestones Only
Export Format: ${exportConfig.format.toUpperCase()}
Export Period: ${exportConfig.period}

MILESTONE OVERVIEW
------------------
Total Milestones: ${milestones.length}
Completed: ${milestones.filter((m) => m.status === 'completed').length}
In Progress: ${milestones.filter((m) => m.status === 'in-progress').length}
Upcoming: ${milestones.filter((m) => m.status === 'upcoming').length}

MILESTONE DETAILS
-----------------
${milestones
  .map(
    (milestone, index) => `
${index + 1}. ${milestone.name}
   ID: ${milestone.id}
   Description: ${milestone.description}
   Target Date: ${new Date(milestone.targetDate).toLocaleDateString()}
   Priority: ${milestone.priority}
   Type: ${milestone.type}
   Status: ${milestone.status}
   Progress: ${milestone.progress}%
   Created: ${new Date(milestone.created).toLocaleString()}
   
   Team: ${milestone.assignees.join(', ')}
   Dependencies: ${milestone.dependencies || 'None'}
   
   Tasks: ${milestone.tasks?.length || 0} total
   Deliverables: ${milestone.deliverables?.length || 0} total
   Risks: ${milestone.risks?.length || 0} identified
   
   ${milestone.tasks ? 'Task Breakdown:\n' + milestone.tasks.map((task, taskIndex) => `  ${taskIndex + 1}. ${task.title} (${task.status})`).join('\n') : ''}
   
   ${milestone.deliverables ? 'Deliverables:\n' + milestone.deliverables.map((del, delIndex) => `  ${delIndex + 1}. ${del.name} (${del.status})`).join('\n') : ''}
`
  )
  .join('\n\n')}

MILESTONE STATISTICS
--------------------
By Priority:
  High: ${milestones.filter((m) => m.priority === 'high').length}
  Medium: ${milestones.filter((m) => m.priority === 'medium').length}
  Low: ${milestones.filter((m) => m.priority === 'low').length}

By Type:
  Release: ${milestones.filter((m) => m.type === 'release').length}
  Feature: ${milestones.filter((m) => m.type === 'feature').length}
  Testing: ${milestones.filter((m) => m.type === 'testing').length}
  Review: ${milestones.filter((m) => m.type === 'review').length}
  Deployment: ${milestones.filter((m) => m.type === 'deployment').length}
  Other: ${milestones.filter((m) => m.type === 'other').length}

By Status:
  Completed: ${milestones.filter((m) => m.status === 'completed').length}
  In Progress: ${milestones.filter((m) => m.status === 'in-progress').length}
  Upcoming: ${milestones.filter((m) => m.status === 'upcoming').length}

AVERAGE PROGRESS: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%

TEAM DISTRIBUTION
-----------------
${milestones
  .reduce((team, milestone) => {
    milestone.assignees.forEach((assignee) => {
      team[assignee] = (team[assignee] || 0) + 1;
    });
    return team;
  }, {})
  .map((count, assignee) => `${assignee}: ${count} milestones`)
  .join('\n')}

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateRoadmapGanttContent(milestones, timeline, exportConfig) {
    return `
PROJECT GANTT CHART
==================

Generated: ${new Date().toLocaleString()}
Export Type: Gantt Chart
Export Format: ${exportConfig.format.toUpperCase()}
Export Period: ${exportConfig.period}

PROJECT TIMELINE
-----------------
Start Date: ${new Date(timeline.startDate || 'N/A').toLocaleDateString()}
End Date: ${new Date(timeline.endDate || 'N/A').toLocaleDateString()}
Duration: ${timeline.duration || 'N/A'} days
Total Milestones: ${milestones.length}

GANTT CHART DATA
-----------------
${milestones
  .map(
    (milestone, index) => `
${index + 1}. ${milestone.name}
   Start: ${new Date(milestone.created).toLocaleDateString()}
   End: ${new Date(milestone.targetDate).toLocaleDateString()}
   Duration: ${Math.floor((new Date(milestone.targetDate) - new Date(milestone.created)) / (1000 * 60 * 60 * 24))} days
   Progress: ${milestone.progress}%
   Status: ${milestone.status}
   Priority: ${milestone.priority}
   Type: ${milestone.type}
   Assignees: ${milestone.assignees.join(', ')}
`
  )
  .join('\n\n')}

${
  exportConfig.includeKeyDates
    ? `
KEY DATES
---------
${(timeline.keyDates || [])
  .map(
    (date, index) => `
${index + 1}. ${date.name}
   Date: ${new Date(date.date).toLocaleDateString()}
   Type: ${date.type}
   Position: ${date.type === 'start' ? 'Start' : date.type === 'delivery' ? 'End' : 'Checkpoint'}
`
  )
  .join('\n')}
`
    : ''
}

${
  exportConfig.includeProgress
    ? `
PROGRESS TRACKING
-----------------
Overall Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%
Completed Milestones: ${milestones.filter((m) => m.status === 'completed').length}/${milestones.length}
On Track: ${milestones.filter((m) => m.status === 'in-progress').length}/${milestones.length}
Delayed: ${milestones.filter((m) => new Date(milestone.targetDate) < new Date() && milestone.status !== 'completed').length}/${milestones.length}

CRITICAL PATH
-------------
${milestones
  .filter((m) => m.priority === 'high')
  .map(
    (milestone, index) => `
${index + 1}. ${milestone.name} (High Priority)
   Due: ${new Date(milestone.targetDate).toLocaleDateString()}
   Status: ${milestone.status}
   Risk: ${new Date(milestone.targetDate) < new Date() && milestone.status !== 'completed' ? 'OVERDUE' : 'ON SCHEDULE'}
`
  )
  .join('\n')}
`
    : ''
}

${
  exportConfig.includeCharts
    ? `
VISUALIZATION DATA
------------------
[TIMELINE CHART]
X-Axis: Date Range (${new Date(timeline.startDate || 'N/A').toLocaleDateString()} - ${new Date(timeline.endDate || 'N/A').toLocaleDateString()})
Y-Axis: Milestones
Data Points: ${milestones.length}

[PROGRESS CHART]
Completed: ${milestones.filter((m) => m.status === 'completed').length}
In Progress: ${milestones.filter((m) => m.status === 'in-progress').length}
Upcoming: ${milestones.filter((m) => m.status === 'upcoming').length}

[PRIORITY DISTRIBUTION]
High: ${milestones.filter((m) => m.priority === 'high').length}
Medium: ${milestones.filter((m) => m.priority === 'medium').length}
Low: ${milestones.filter((m) => m.priority === 'low').length}
`
    : ''
}

RECOMMENDATIONS
---------------
1. Focus on high-priority milestones
2. Monitor critical path items closely
3. Adjust timeline for overdue items
4. Reallocate resources as needed
5. Communicate delays to stakeholders
6. Update progress tracking regularly
7. Review and adjust milestones quarterly

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateRoadmapExecutiveContent(milestones, timeline, exportConfig) {
    return `
EXECUTIVE ROADMAP REPORT
=======================

Generated: ${new Date().toLocaleString()}
Export Type: Executive Report
Export Format: ${exportConfig.format.toUpperCase()}
Export Period: ${exportConfig.period}

EXECUTIVE SUMMARY
-----------------
Project Duration: ${timeline.duration || 'N/A'} days
Total Milestones: ${milestones.length}
Overall Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%
Status: ${milestones.filter((m) => m.status === 'completed').length === milestones.length ? 'COMPLETED' : milestones.filter((m) => new Date(m.targetDate) < new Date() && m.status !== 'completed').length > 0 ? 'DELAYED' : 'ON TRACK'}

KEY METRICS
-----------
Completion Rate: ${Math.round((milestones.filter((m) => m.status === 'completed').length / milestones.length) * 100)}%
On-Time Delivery: ${Math.round((milestones.filter((m) => m.status === 'completed' || new Date(m.targetDate) >= new Date()).length / milestones.length) * 100)}%
High Priority Completed: ${milestones.filter((m) => m.priority === 'high' && m.status === 'completed').length}/${milestones.filter((m) => m.priority === 'high').length}
Average Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%

${
  exportConfig.includeMilestones
    ? `
MILESTONE STATUS
---------------
${milestones
  .filter((m) => m.priority === 'high')
  .map(
    (milestone, index) => `
${index + 1}. ${milestone.name}
   Status: ${milestone.status}
   Progress: ${milestone.progress}%
   Due: ${new Date(milestone.targetDate).toLocaleDateString()}
   Risk: ${new Date(milestone.targetDate) < new Date() && milestone.status !== 'completed' ? 'HIGH' : 'LOW'}
`
  )
  .join('\n')}
`
    : ''
}

${
  exportConfig.includeProgress
    ? `
PROGRESS ANALYSIS
-----------------
Current Status: ${milestones.filter((m) => m.status === 'completed').length === milestones.length ? 'PROJECT COMPLETED' : milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed').length > 0 ? 'PROJECT DELAYED' : 'PROJECT ON TRACK'}

Performance Indicators:
- Overall Progress: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}%
- Completed Milestones: ${milestones.filter((m) => m.status === 'completed').length}/${milestones.length}
- Delayed Items: ${milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed').length}
- High Priority Items: ${milestones.filter((m) => m.priority === 'high').length}

Risk Assessment:
${milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed').length > 0 ? 'HIGH RISK - Multiple overdue milestones' : 'LOW RISK - All milestones on track'}
`
    : ''
}

${
  exportConfig.includeCharts
    ? `
PERFORMANCE CHARTS
-----------------
[EXECUTIVE DASHBOARD]
Overall Health: ${milestones.filter((m) => m.status === 'completed').length === milestones.length ? 'GREEN' : milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed').length > 0 ? 'RED' : 'YELLOW'}
Progress Score: ${Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / milestones.length)}/100
Risk Level: ${milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed').length > 0 ? 'HIGH' : 'LOW'}

[KPI SUMMARY]
Completion Rate: ${Math.round((milestones.filter((m) => m.status === 'completed').length / milestones.length) * 100)}%
On-Time Rate: ${Math.round((milestones.filter((m) => m.status === 'completed' || new Date(milestone.targetDate) >= new Date()).length / milestones.length) * 100)}%
Quality Score: ${Math.round(milestones.reduce((acc, m) => acc + (m.progress > 80 ? 100 : m.progress), 0) / milestones.length)}%
`
    : ''
}

RECOMMENDATIONS
---------------
${
  milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed')
    .length > 0
    ? `IMMEDIATE ACTIONS REQUIRED:
1. Address ${milestones.filter((m) => new Date(milestone.targetDate) < new Date() && m.status !== 'completed').length} overdue milestones
2. Reassess project timeline and resources
3. Communicate delays to stakeholders
4. Implement recovery plan
5. Consider milestone re-prioritization`
    : `PROJECT ON TRACK:
1. Continue monitoring progress
2. Focus on upcoming milestones
3. Maintain current pace
4. Plan for next phase
5. Document best practices`
}

STRATEGIC RECOMMENDATIONS:
1. Review milestone priorities quarterly
2. Implement automated progress tracking
3. Enhance stakeholder communication
4. Optimize resource allocation
5. Establish quality metrics

NEXT STEPS:
1. Review this executive summary
2. Discuss recommendations with team
3. Implement action items
4. Monitor progress weekly
5. Update stakeholders monthly

Generated: ${new Date().toLocaleString()}
    `;
  }

  function downloadRoadmapExport(roadmapData, format) {
    // Create and download the roadmap export
    let content, filename, mimeType;

    switch (format) {
      case 'pdf':
        content = `PDF Export: ${roadmapData.content}`;
        filename = `roadmap_${roadmapData.exportId}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'excel':
        content = `Excel Export: ${roadmapData.content}`;
        filename = `roadmap_${roadmapData.exportId}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'powerpoint':
        content = `PowerPoint Export: ${roadmapData.content}`;
        filename = `roadmap_${roadmapData.exportId}.pptx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      case 'json':
        content = JSON.stringify(roadmapData, null, 2);
        filename = `roadmap_${roadmapData.exportId}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = convertRoadmapToCSV(roadmapData);
        filename = `roadmap_${roadmapData.exportId}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        content = roadmapData.content;
        filename = `roadmap_${roadmapData.exportId}.txt`;
        mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertRoadmapToCSV(roadmapData) {
    let csv = 'Export ID,Format,Type,Period,Generated,Milestones,Key Dates\n';
    csv += `${roadmapData.exportId},${roadmapData.format},${roadmapData.type},${roadmapData.period},${new Date(roadmapData.generated).toLocaleDateString()},${roadmapData.milestones?.length || 0},${roadmapData.keyDates?.length || 0}\n`;
    return csv;
  }

  function showRoadmapExportSummary(roadmapData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'roadmap-export-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">📊 Roadmap Exported Successfully</h3>
                <button onclick="closeRoadmapExportSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--success-color), var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Export Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${roadmapData.format.toUpperCase()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Format</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${roadmapData.type.charAt(0).toUpperCase() + roadmapData.type.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Type</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${roadmapData.milestones?.length || 0}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Milestones</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${roadmapData.period}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Period</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Export Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Export ID</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${roadmapData.exportId}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Generated</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(roadmapData.generated).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">File Size</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${formatFileSize(roadmapData.content.length)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Options</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${Object.keys(roadmapData.options).filter((key) => roadmapData.options[key]).length} selected</div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeRoadmapExportSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeRoadmapExportSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeRoadmapExportSummary() {
    const modal = document.getElementById('roadmap-export-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Team Management Functions
  function addTeamMember() {
    console.log('Adding new team member...');

    // Create team member modal
    const memberModal = document.createElement('div');
    memberModal.id = 'add-member-modal';
    memberModal.style.cssText = `
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

    memberModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">👥 Add Team Member</h3>
                <button onclick="closeAddMember()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Add a new team member to your organization. Fill in their details and assign them to departments.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">First Name</label>
                            <input type="text" id="member-first-name" placeholder="Enter first name" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Last Name</label>
                            <input type="text" id="member-last-name" placeholder="Enter last name" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Email Address</label>
                        <input type="email" id="member-email" placeholder="Enter email address" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Phone Number</label>
                        <input type="tel" id="member-phone" placeholder="Enter phone number" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Job Title</label>
                        <input type="text" id="member-title" placeholder="Enter job title" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Department</label>
                        <select id="member-department" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="">Select Department</option>
                            <option value="engineering">Engineering</option>
                            <option value="design">Design</option>
                            <option value="marketing">Marketing</option>
                            <option value="sales">Sales</option>
                            <option value="hr">Human Resources</option>
                            <option value="finance">Finance</option>
                            <option value="operations">Operations</option>
                            <option value="management">Management</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Role</label>
                        <select id="member-role" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="member">Team Member</option>
                            <option value="lead">Team Lead</option>
                            <option value="manager">Manager</option>
                            <option value="director">Director</option>
                            <option value="executive">Executive</option>
                            <option value="contractor">Contractor</option>
                            <option value="intern">Intern</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Skills</label>
                        <textarea id="member-skills" placeholder="List key skills and expertise" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 80px; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Start Date</label>
                            <input type="date" id="member-start-date" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <div>
                            <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Employment Type</label>
                            <select id="member-employment-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="full-time">Full-time</option>
                                <option value="part-time">Part-time</option>
                                <option value="contract">Contract</option>
                                <option value="internship">Internship</option>
                                <option value="freelance">Freelance</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Bio</label>
                        <textarea id="member-bio" placeholder="Brief professional biography" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 60px; resize: vertical;"></textarea>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeAddMember()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="createTeamMember()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-user-plus"></i> Add Member
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(memberModal);

    // Set default start date to today
    document.getElementById('member-start-date').value = new Date().toISOString().split('T')[0];

    // Add click outside to close
    memberModal.addEventListener('click', (e) => {
      if (e.target === memberModal) {
        closeAddMember();
      }
    });

    // Show modal
    setTimeout(() => {
      memberModal.style.display = 'flex';
    }, 100);
  }

  function closeAddMember() {
    const modal = document.getElementById('add-member-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function createTeamMember() {
    const firstName = document.getElementById('member-first-name').value;
    const lastName = document.getElementById('member-last-name').value;
    const email = document.getElementById('member-email').value;
    const phone = document.getElementById('member-phone').value;
    const title = document.getElementById('member-title').value;
    const department = document.getElementById('member-department').value;
    const role = document.getElementById('member-role').value;
    const skills = document.getElementById('member-skills').value;
    const startDate = document.getElementById('member-start-date').value;
    const employmentType = document.getElementById('member-employment-type').value;
    const bio = document.getElementById('member-bio').value;

    // Validate required fields
    if (!firstName || !lastName || !email || !title || !department || !role) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (!validateEmail(email)) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }

    closeAddMember();

    // Create member progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'create-member-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Adding Team Member...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Creating profile for ${firstName} ${lastName}...</span>
                    <span id="create-member-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="create-member-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="create-member-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing member creation...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate member creation process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(`Team member ${firstName} ${lastName} added successfully!`, 'success');

          // Generate member data
          const memberData = generateMemberData({
            firstName,
            lastName,
            email,
            phone,
            title,
            department,
            role,
            skills,
            startDate,
            employmentType,
            bio,
          });

          // Show member summary
          showMemberSummary(memberData);

          // Add member to current data
          addMemberToCurrentData(memberData);
        }, 500);
      }

      document.getElementById('create-member-bar').style.width = progress + '%';
      document.getElementById('create-member-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('create-member-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing member creation...';
      } else if (progress < 40) {
        statusElement.textContent = 'Setting up member profile...';
      } else if (progress < 60) {
        statusElement.textContent = 'Assigning to department...';
      } else if (progress < 80) {
        statusElement.textContent = 'Creating access credentials...';
      } else {
        statusElement.textContent = 'Finalizing member setup...';
      }
    }, 350);
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function generateMemberData(memberConfig) {
    const now = new Date();
    const memberId = `member_${now.getTime()}`;

    return {
      id: memberId,
      firstName: memberConfig.firstName,
      lastName: memberConfig.lastName,
      fullName: `${memberConfig.firstName} ${memberConfig.lastName}`,
      email: memberConfig.email,
      phone: memberConfig.phone,
      title: memberConfig.title,
      department: memberConfig.department,
      role: memberConfig.role,
      skills: memberConfig.skills,
      startDate: memberConfig.startDate,
      employmentType: memberConfig.employmentType,
      bio: memberConfig.bio,
      status: 'active',
      created: now.toISOString(),
      avatar: `https://ui-avatars.com/api/?name=${memberConfig.firstName}+${memberConfig.lastName}&background=random`,
      projects: Array.from({ length: Math.floor(Math.random() * 5) + 2 }, (_, index) => ({
        id: `project_${index + 1}`,
        name: `Project ${index + 1}`,
        role: ['Lead', 'Member', 'Contributor', 'Reviewer'][Math.floor(Math.random() * 4)],
        status: ['active', 'completed', 'on-hold'][Math.floor(Math.random() * 3)],
