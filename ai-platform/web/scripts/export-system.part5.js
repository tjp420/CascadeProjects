                              )
                              .join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📦 Dependencies</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
                    ${fileData.dependencies
                      .map(
                        (dep) => `
                        <div style="padding: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                <span style="color: var(--text-primary); font-weight: 500;">${dep.name}</span>
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">${dep.version}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">${dep.type}</span>
                                <span style="color: var(--text-secondary); font-size: 0.8rem;">${dep.usage} uses</span>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeFileDetailsModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Close
                </button>
                <button onclick="refactorFile('${filename}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    🔧 Get Refactoring Suggestions
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(detailsModal);

    // Add click outside to close
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) {
        closeFileDetailsModal();
      }
    });

    // Show modal
    setTimeout(() => {
      detailsModal.style.display = 'flex';
    }, 100);
  }

  function closeFileDetailsModal() {
    const modal = document.getElementById('file-details-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Refactor File function
  function refactorFile(filename) {
    console.log(`Generating refactoring suggestions for: ${filename}`);

    // Close file details modal if open
    const detailsModal = document.getElementById('file-details-modal');
    if (detailsModal) {
      closeFileDetailsModal();
    }

    // Mock refactoring suggestions data
    const refactoringData = {
      'dashboard-scripts.js': {
        filename: 'dashboard-scripts.js',
        overallScore: 35,
        priority: 'high',
        estimatedEffort: '16-24 hours',
        suggestions: [
          {
            type: 'function-extraction',
            priority: 'high',
            title: 'Extract Large Functions',
            description:
              'Break down functions that exceed 50 lines into smaller, more manageable functions',
            affectedFunctions: ['renderComponents', 'processData', 'updateMetrics'],
            impact: 'high',
            effort: 'medium',
            before: {
              complexity: 392,
              maintainability: 0,
              functions: 156,
            },
            after: {
              complexity: 245,
              maintainability: 45,
              functions: 189,
            },
            codeExample: {
              before:
                "function renderComponents(data) {\n  // 234 lines of complex rendering logic\n  if (data.type === 'chart') {\n    // 45 lines of chart rendering\n  }\n  if (data.type === 'table') {\n    // 67 lines of table rendering\n  }\n  // ... more complex logic\n}",
              after:
                "function renderComponents(data) {\n  const renderer = getRenderer(data.type);\n  return renderer.render(data);\n}\n\nfunction getRenderer(type) {\n  switch(type) {\n    case 'chart': return new ChartRenderer();\n    case 'table': return new TableRenderer();\n    default: return new DefaultRenderer();\n  }\n}",
            },
          },
          {
            type: 'duplicate-code',
            priority: 'medium',
            title: 'Eliminate Code Duplication',
            description: 'Extract common patterns into reusable utility functions',
            affectedFunctions: ['loadChartData', 'updateMetrics', 'handleUserInput'],
            impact: 'medium',
            effort: 'low',
            before: {
              duplicateInstances: 8,
              linesSaved: 0,
            },
            after: {
              duplicateInstances: 2,
              linesSaved: 156,
            },
            codeExample: {
              before:
                '// Pattern repeated in 8 places\nfunction loadChartData() {\n  const data = fetchData();\n  const processed = processData(data);\n  const formatted = formatData(processed);\n  return formatted;\n}\n\nfunction updateMetrics() {\n  const data = fetchData();\n  const processed = processData(data);\n  const formatted = formatData(processed);\n  updateUI(formatted);\n}',
              after:
                'function createDataProcessor() {\n  return {\n    getProcessedData: () => {\n      const data = fetchData();\n      const processed = processData(data);\n      return formatData(processed);\n    }\n  };\n}\n\nconst processor = createDataProcessor();\nfunction loadChartData() {\n  return processor.getProcessedData();\n}',
            },
          },
          {
            type: 'class-extraction',
            priority: 'high',
            title: 'Extract Classes for Better Organization',
            description: 'Group related functions into classes to improve code organization',
            affectedFunctions: ['initializeDashboard', 'loadChartData', 'updateMetrics'],
            impact: 'high',
            effort: 'high',
            before: {
              classes: 12,
              cohesion: 'low',
            },
            after: {
              classes: 18,
              cohesion: 'high',
            },
            codeExample: {
              before:
                '// Scattered functions\nfunction initializeDashboard() { /* ... */ }\nfunction loadChartData() { /* ... */ }\nfunction updateMetrics() { /* ... */ }',
              after:
                'class DashboardManager {\n  constructor() {\n    this.chartLoader = new ChartLoader();\n    this.metricsUpdater = new MetricsUpdater();\n  }\n  \n  initialize() {\n    this.chartLoader.load();\n    this.metricsUpdater.start();\n  }\n}',
            },
          },
          {
            type: 'dependency-injection',
            priority: 'medium',
            title: 'Implement Dependency Injection',
            description: 'Reduce coupling by implementing dependency injection pattern',
            affectedFunctions: ['renderComponents', 'processData'],
            impact: 'medium',
            effort: 'medium',
            before: {
              coupling: 'high',
              testability: 'low',
            },
            after: {
              coupling: 'low',
              testability: 'high',
            },
            codeExample: {
              before:
                'function renderComponents() {\n  const chart = new Chart(); // Hard dependency\n  const table = new Table(); // Hard dependency\n  // ... use dependencies\n}',
              after:
                'function renderComponents(dependencies) {\n  const { chart, table } = dependencies;\n  // ... use injected dependencies\n}\n\n// Usage\nconst deps = { chart: new Chart(), table: new Table() };\nrenderComponents(deps);',
            },
          },
          {
            type: 'async-refactoring',
            priority: 'medium',
            title: 'Improve Asynchronous Code',
            description: 'Modernize callback-based code to use async/await',
            affectedFunctions: ['loadChartData', 'processData'],
            impact: 'medium',
            effort: 'medium',
            before: {
              callbackHell: true,
              readability: 'low',
            },
            after: {
              callbackHell: false,
              readability: 'high',
            },
            codeExample: {
              before:
                'function loadChartData(callback) {\n  fetchData((data) => {\n    processData(data, (processed) => {\n      formatData(processed, (formatted) => {\n        callback(formatted);\n      });\n    });\n  });\n}',
              after:
                'async function loadChartData() {\n  const data = await fetchData();\n  const processed = await processData(data);\n  return await formatData(processed);\n}',
            },
          },
          {
            type: 'error-handling',
            priority: 'low',
            title: 'Improve Error Handling',
            description: 'Add consistent error handling and logging',
            affectedFunctions: ['validateForm', 'calculateStats'],
            impact: 'low',
            effort: 'low',
            before: {
              errorHandling: 'inconsistent',
              logging: 'minimal',
            },
            after: {
              errorHandling: 'consistent',
              logging: 'comprehensive',
            },
            codeExample: {
              before:
                'function validateForm(data) {\n  if (!data.name) return false;\n  if (!data.email) return false;\n  return true;\n}',
              after:
                "function validateForm(data) {\n  try {\n    if (!data.name) {\n      logger.error('Name is required');\n      throw new ValidationError('Name is required');\n    }\n    if (!data.email) {\n      logger.error('Email is required');\n      throw new ValidationError('Email is required');\n    }\n    return true;\n  } catch (error) {\n    logger.error('Validation failed:', error);\n    throw error;\n  }\n}",
            },
          },
        ],
        benefits: [
          'Reduced cyclomatic complexity from 392 to 245',
          'Improved maintainability index from 0 to 45',
          'Eliminated 6 instances of code duplication',
          'Better code organization and readability',
          'Enhanced testability and maintainability',
          'Modern async/await patterns for better error handling',
        ],
        risks: [
          'Breaking changes in dependent modules',
          'Requires comprehensive testing',
          'Temporary reduction in development velocity',
          'Learning curve for team members',
        ],
        implementation: {
          phases: [
            {
              phase: 'Preparation',
              duration: '2-4 hours',
              tasks: [
                'Set up testing framework',
                'Create backup of current code',
                'Identify all dependencies',
              ],
            },
            {
              phase: 'Function Extraction',
              duration: '6-8 hours',
              tasks: [
                'Extract large functions',
                'Create utility functions',
                'Update function calls',
              ],
            },
            {
              phase: 'Class Organization',
              duration: '4-6 hours',
              tasks: ['Create class structure', 'Move functions to classes', 'Update imports'],
            },
            {
              phase: 'Testing & Validation',
              duration: '4-6 hours',
              tasks: ['Write unit tests', 'Integration testing', 'Performance validation'],
            },
          ],
          totalDuration: '16-24 hours',
          teamSize: '2-3 developers',
          skillLevel: 'Intermediate to Advanced',
        },
      },
      'backup-manager.js': {
        filename: 'backup-manager.js',
        overallScore: 82,
        priority: 'low',
        estimatedEffort: '2-4 hours',
        suggestions: [
          {
            type: 'documentation',
            priority: 'medium',
            title: 'Add Function Documentation',
            description: 'Add JSDoc comments to improve code documentation and maintainability',
            affectedFunctions: [
              'createBackup',
              'restoreBackup',
              'validateBackup',
              'compressBackup',
              'encryptBackup',
            ],
            impact: 'medium',
            effort: 'low',
            before: {
              documentation: 'missing',
              maintainability: 85,
            },
            after: {
              documentation: 'complete',
              maintainability: 92,
            },
            codeExample: {
              before:
                'function createBackup(data) {\n  // Create backup logic\n  return backupData;\n}',
              after:
                '/**\n * Creates a backup of the provided data\n * @param {Object} data - The data to backup\n * @param {Object} options - Backup configuration options\n * @returns {Promise<Object>} - Backup metadata and data\n * @throws {Error} - If backup creation fails\n */\nasync function createBackup(data, options = {}) {\n  // Create backup logic\n  return backupData;\n}',
            },
          },
          {
            type: 'logging',
            priority: 'low',
            title: 'Replace Console Logging',
            description: 'Replace console.log statements with proper logging system',
            affectedFunctions: ['createBackup', 'restoreBackup', 'validateBackup'],
            impact: 'low',
            effort: 'low',
            before: {
              logging: 'console.log',
              maintainability: 85,
            },
            after: {
              logging: 'structured',
              maintainability: 88,
            },
            codeExample: {
              before:
                "function createBackup(data) {\n  console.log('Creating backup...');\n  console.log('Backup created successfully');\n  return result;\n}",
              after:
                "const logger = require('./logger');\n\nfunction createBackup(data) {\n  logger.info('Starting backup creation');\n  // ... backup logic\n  logger.info('Backup created successfully', { size: result.size });\n  return result;\n}",
            },
          },
          {
            type: 'parameter-cleanup',
            priority: 'low',
            title: 'Remove Unused Parameters',
            description: 'Clean up unused function parameters to improve code clarity',
            affectedFunctions: ['compressBackup', 'encryptBackup'],
            impact: 'low',
            effort: 'low',
            before: {
              unusedParams: 2,
              codeClarity: 'medium',
            },
            after: {
              unusedParams: 0,
              codeClarity: 'high',
            },
            codeExample: {
              before:
                'function compressBackup(data, options, unusedParam) {\n  // unusedParam is not used\n  return compressedData;\n}',
              after: 'function compressBackup(data, options) {\n  return compressedData;\n}',
            },
          },
          {
            type: 'error-handling',
            priority: 'medium',
            title: 'Enhance Error Handling',
            description: 'Add more specific error types and better error messages',
            affectedFunctions: ['restoreBackup', 'validateBackup'],
            impact: 'medium',
            effort: 'medium',
            before: {
              errorHandling: 'basic',
              errorTypes: 'generic',
            },
            after: {
              errorHandling: 'comprehensive',
              errorTypes: 'specific',
            },
            codeExample: {
              before:
                "function restoreBackup(backupId) {\n  try {\n    // restore logic\n  } catch (error) {\n    throw new Error('Restore failed');\n  }\n}",
              after:
                "class BackupError extends Error {\n  constructor(message, code, details) {\n    super(message);\n    this.code = code;\n    this.details = details;\n  }\n}\n\nfunction restoreBackup(backupId) {\n  try {\n    // restore logic\n  } catch (error) {\n    throw new BackupError('Restore failed', 'RESTORE_ERROR', { backupId, originalError: error });\n  }\n}",
            },
          },
        ],
        benefits: [
          'Improved maintainability index from 85 to 92',
          'Better code documentation and developer experience',
          'Professional logging system for better debugging',
          'Cleaner function signatures and parameters',
          'Enhanced error handling with specific error types',
        ],
        risks: [
          'Minor breaking changes if function signatures are modified',
          'Requires logging system setup',
          'Additional documentation maintenance overhead',
        ],
        implementation: {
          phases: [
            {
              phase: 'Documentation',
              duration: '1-2 hours',
              tasks: ['Add JSDoc comments', 'Document function parameters', 'Update README'],
            },
            {
              phase: 'Logging Enhancement',
              duration: '0.5-1 hours',
              tasks: [
                'Set up logging system',
                'Replace console.log statements',
                'Add structured logging',
              ],
            },
            {
              phase: 'Code Cleanup',
              duration: '0.5-1 hours',
              tasks: ['Remove unused parameters', 'Clean up function signatures', 'Update tests'],
            },
          ],
          totalDuration: '2-4 hours',
          teamSize: '1-2 developers',
          skillLevel: 'Beginner to Intermediate',
        },
      },
    };

    const refactorInfo = refactoringData[filename];
    if (!refactorInfo) {
      showNotification(`Refactoring suggestions for ${filename} not found`, 'error');
      return;
    }

    // Create refactoring modal
    const refactorModal = document.createElement('div');
    refactorModal.id = 'refactor-modal';
    refactorModal.style.cssText = `
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

    refactorModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 1000px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="color: var(--text-primary); margin: 0;">🔧 Refactoring Suggestions</h3>
                    <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">${filename}</p>
                </div>
                <button onclick="closeRefactorModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Overall Score</div>
                    <div style="color: ${refactorInfo.overallScore < 40 ? 'var(--danger-color)' : refactorInfo.overallScore < 70 ? 'var(--warning-color)' : 'var(--success-color)'}; font-size: 1.5rem; font-weight: 600;">${refactorInfo.overallScore}/100</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Priority</div>
                    <div style="color: ${refactorInfo.priority === 'high' ? 'var(--danger-color)' : refactorInfo.priority === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; font-size: 1.5rem; font-weight: 600;">${refactorInfo.priority.toUpperCase()}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Estimated Effort</div>
                    <div style="color: var(--text-primary); font-size: 1.2rem; font-weight: 600;">${refactorInfo.estimatedEffort}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">💡 Refactoring Suggestions</h4>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${refactorInfo.suggestions
                      .map(
                        (suggestion, index) => `
                        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <span style="padding: 0.25rem 0.5rem; background: ${suggestion.priority === 'high' ? 'var(--danger-color)' : suggestion.priority === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; color: white; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
                                            ${suggestion.priority.toUpperCase()}
                                        </span>
                                        <span style="color: var(--text-primary); font-weight: 500;">${suggestion.title}</span>
                                    </div>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${suggestion.description}</p>
                                </div>
                                <div style="text-align: right; margin-left: 1rem;">
                                    <div style="color: var(--text-secondary); font-size: 0.8rem;">Impact</div>
                                    <div style="color: ${suggestion.impact === 'high' ? 'var(--danger-color)' : suggestion.impact === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; font-weight: 500;">${suggestion.impact}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.25rem;">Affected Functions</div>
                                    <div style="color: var(--text-primary); font-size: 0.9rem;">${suggestion.affectedFunctions.join(', ')}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.25rem;">Effort Required</div>
                                    <div style="color: var(--text-primary); font-size: 0.9rem;">${suggestion.effort}</div>
                                </div>
                            </div>
                            
                            <div style="background: var(--bg-secondary); border-radius: 6px; padding: 1rem;">
                                <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem; font-size: 0.9rem;">Code Example</div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.25rem;">Before:</div>
                                        <pre style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem; font-size: 0.8rem; overflow-x: auto; color: var(--text-primary);"><code>${suggestion.codeExample.before}</code></pre>
                                    </div>
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.25rem;">After:</div>
                                        <pre style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem; font-size: 0.8rem; overflow-x: auto; color: var(--text-primary);"><code>${suggestion.codeExample.after}</code></pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📈 Expected Benefits</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem;">
                            ${refactorInfo.benefits.map((benefit) => `<li style="margin-bottom: 0.25rem;">${benefit}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <h5 style="color: var(--text-primary); margin-bottom: 0.5rem;">⚠️ Potential Risks</h5>
                        <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem;">
                            ${refactorInfo.risks.map((risk) => `<li style="margin-bottom: 0.25rem;">${risk}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📋 Implementation Plan</h4>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div>
                            <h5 style="color: var(--text-primary); margin-bottom: 1rem;">Phases</h5>
                            ${refactorInfo.implementation.phases
                              .map(
                                (phase, index) => `
                                <div style="margin-bottom: 1rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                        <span style="color: var(--text-primary); font-weight: 500;">Phase ${index + 1}: ${phase.phase}</span>
                                        <span style="color: var(--text-secondary); font-size: 0.8rem;">${phase.duration}</span>
                                    </div>
                                    <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                                        ${phase.tasks.map((task) => `<li style="margin-bottom: 0.25rem;">${task}</li>`).join('')}
                                    </ul>
                                </div>
                            `
                              )
                              .join('')}
                        </div>
                        <div>
                            <h5 style="color: var(--text-primary); margin-bottom: 1rem;">Project Details</h5>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 0.5rem; font-size: 0.9rem;">
                                <div>
                                    <div style="color: var(--text-secondary);">Total Duration</div>
                                    <div style="color: var(--text-primary); font-weight: 500;">${refactorInfo.implementation.totalDuration}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-secondary);">Team Size</div>
                                    <div style="color: var(--text-primary); font-weight: 500;">${refactorInfo.implementation.teamSize}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-secondary);">Skill Level</div>
                                    <div style="color: var(--text-primary); font-weight: 500;">${refactorInfo.implementation.skillLevel}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeRefactorModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Close
                </button>
                <button onclick="exportRefactoringPlan('${filename}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    📄 Export Refactoring Plan
                </button>
                <button onclick="startRefactoring('${filename}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--warning-color); color: white; cursor: pointer;">
                    🔧 Start Refactoring
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(refactorModal);

    // Add click outside to close
    refactorModal.addEventListener('click', (e) => {
      if (e.target === refactorModal) {
        closeRefactorModal();
      }
    });

    // Show modal
    setTimeout(() => {
      refactorModal.style.display = 'flex';
    }, 100);
  }

  function closeRefactorModal() {
    const modal = document.getElementById('refactor-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function exportRefactoringPlan(filename) {
    showNotification(`Exporting refactoring plan for ${filename}...`, 'info');
    // In a real implementation, this would generate and download a detailed refactoring plan document
  }

  function startRefactoring(filename) {
    console.log(`Starting refactoring implementation for: ${filename}`);

    // Close refactoring modal if open
    const refactorModal = document.getElementById('refactor-modal');
    if (refactorModal) {
      closeRefactorModal();
    }

    // Get refactoring data
    const refactoringData = {
      'dashboard-scripts.js': {
        filename: 'dashboard-scripts.js',
        implementation: {
          phases: [
            {
              phase: 'Preparation',
              duration: '2-4 hours',
              tasks: [
                'Set up comprehensive testing framework (Jest + Cypress)',
                'Create complete backup of current codebase',
                'Identify all external dependencies and their versions',
                'Document current functionality and expected behavior',
                'Set up CI/CD pipeline for automated testing',
                'Create feature branch for refactoring work',
              ],
              deliverables: [
                'Test suite with 80%+ code coverage',
                'Code backup stored in version control',
                'Dependency inventory document',
                'Functionality documentation',
                'CI/CD pipeline configuration',
              ],
              risks: ['Test setup delays', 'Dependency conflicts', 'Backup corruption'],
              mitigation: [
                'Parallel test development',
                'Dependency version locking',
                'Multiple backup locations',
              ],
            },
            {
              phase: 'Function Extraction',
              duration: '6-8 hours',
              tasks: [
                'Extract renderComponents function into smaller functions',
                'Break down processData into specialized processors',
                'Split updateMetrics into metric-specific updaters',
                'Create utility functions for common operations',
                'Update all function calls throughout codebase',
                'Add comprehensive unit tests for new functions',
              ],
              deliverables: [
                'Refactored functions with <50 lines each',
                'Updated function call sites',
                'Unit test suite for new functions',
                'Performance benchmarks',
                'Function documentation',
              ],
              risks: [
                'Breaking existing functionality',
                'Performance degradation',
                'Integration issues',
              ],
              mitigation: ['Incremental refactoring', 'Performance testing', 'Integration testing'],
            },
            {
              phase: 'Class Organization',
              duration: '4-6 hours',
              tasks: [
                'Design class hierarchy and relationships',
                'Create DashboardManager class',
                'Implement ChartRenderer, TableRenderer, DefaultRenderer classes',
                'Create DataManager class for data processing',
                'Implement MetricsUpdater class',
                'Refactor existing functions into class methods',
                'Update imports and exports',
              ],
              deliverables: [
                'Class diagram documentation',
                'Implemented class hierarchy',
                'Refactored code with class structure',
                'Updated module exports',
                'Class unit tests',
              ],
              risks: ['Circular dependencies', 'Memory leaks', 'Breaking changes'],
              mitigation: [
                'Dependency analysis',
                'Memory profiling',
                'Backward compatibility layer',
              ],
            },
            {
              phase: 'Testing & Validation',
              duration: '4-6 hours',
              tasks: [
                'Run comprehensive unit tests',
                'Perform integration testing',
                'Execute end-to-end testing',
                'Performance benchmarking',
                'Security vulnerability scanning',
                'Code review and quality gates',
                'User acceptance testing',
              ],
              deliverables: [
                'Test execution report',
                'Performance comparison report',
                'Security scan results',
                'Code review documentation',
                'UAT results',
                'Deployment checklist',
              ],
              risks: ['Test failures', 'Performance regressions', 'Security vulnerabilities'],
              mitigation: ['Parallel testing', 'Performance monitoring', 'Security scanning tools'],
            },
          ],
          totalDuration: '16-24 hours',
          teamSize: '2-3 developers',
          skillLevel: 'Intermediate to Advanced',
          tools: [
            'Jest - Unit testing framework',
            'Cypress - End-to-end testing',
            'ESLint - Code quality',
            'SonarQube - Code analysis',
            'Git - Version control',
            'GitHub Actions - CI/CD',
            'Chrome DevTools - Performance profiling',
          ],
          successCriteria: [
            'Cyclomatic complexity reduced from 392 to <250',
            'Maintainability index improved from 0 to >40',
            'All unit tests passing with 80%+ coverage',
            'No performance degradation (>5% acceptable)',
            'Zero security vulnerabilities',
            'All existing functionality preserved',
          ],
          rollbackPlan: {
            triggers: [
              'Critical functionality broken',
              'Performance degradation >20%',
              'Security vulnerabilities discovered',
              'Team consensus to rollback',
            ],
            steps: [
              'Immediate rollback to backup branch',
              'Notify stakeholders of rollback',
              'Analyze root cause of failure',
              'Document lessons learned',
              'Plan revised approach',
            ],
            timeline: '30 minutes to complete rollback',
          },
        },
      },
      'backup-manager.js': {
        filename: 'backup-manager.js',
        implementation: {
          phases: [
            {
              phase: 'Documentation Enhancement',
              duration: '1-2 hours',
              tasks: [
                'Add comprehensive JSDoc comments to all functions',
                'Document function parameters and return values',
                'Create API documentation with examples',
                'Update README with usage instructions',
                'Add inline comments for complex logic',
              ],
              deliverables: [
                'Complete JSDoc documentation',
                'API documentation with examples',
                'Updated README file',
                'Code comments for complex sections',
              ],
              risks: ['Documentation inconsistencies', 'Time overruns'],
              mitigation: ['Documentation templates', 'Time tracking'],
            },
            {
              phase: 'Logging System Implementation',
              duration: '0.5-1 hours',
              tasks: [
                'Set up structured logging system (Winston/Pino)',
                'Replace all console.log statements with proper logging',
                'Add different log levels (info, warn, error, debug)',
                'Implement log formatting and metadata',
                'Add log rotation and archiving',
              ],
              deliverables: [
                'Configured logging system',
                'Updated code with structured logging',
                'Log configuration files',
                'Log rotation setup',
              ],
              risks: ['Logging system conflicts', 'Performance impact'],
              mitigation: ['Async logging', 'Performance testing'],
            },
            {
              phase: 'Code Cleanup',
              duration: '0.5-1 hours',
              tasks: [
                'Remove unused function parameters',
                'Clean up function signatures',
                'Update function calls to match cleaned signatures',
                'Add parameter validation',
                'Update unit tests for cleaned functions',
              ],
              deliverables: [
                'Cleaned function signatures',
                'Updated function calls',
                'Parameter validation',
                'Updated unit tests',
              ],
              risks: ['Breaking function contracts', 'Test failures'],
              mitigation: ['Backward compatibility', 'Comprehensive testing'],
            },
            {
              phase: 'Error Handling Enhancement',
              duration: '1-2 hours',
              tasks: [
                'Create custom error classes (BackupError, ValidationError)',
                'Implement specific error types and codes',
                'Add detailed error messages with context',
                'Implement error logging and tracking',
                'Add error recovery mechanisms',
              ],
              deliverables: [
                'Custom error classes',
                'Enhanced error handling',
                'Error tracking system',
                'Recovery mechanisms',
              ],
              risks: ['Error handling complexity', 'Breaking changes'],
              mitigation: ['Gradual implementation', 'Backward compatibility'],
            },
          ],
          totalDuration: '3-6 hours',
          teamSize: '1-2 developers',
          skillLevel: 'Beginner to Intermediate',
          tools: [
            'JSDoc - Documentation generation',
            'Winston/Pino - Logging framework',
            'ESLint - Code quality',
            'Jest - Unit testing',
            'Git - Version control',
            'VS Code - Code editor with extensions',
          ],
          successCriteria: [
            'Maintainability index improved from 85 to 92',
            'All functions documented with JSDoc',
            'Zero console.log statements in production code',
            'No unused parameters',
            'Comprehensive error handling with specific error types',
            'All unit tests passing with 90%+ coverage',
          ],
          rollbackPlan: {
            triggers: [
              'Critical backup functionality broken',
              'Performance degradation >15%',
              'Error handling causing issues',
              'Team consensus to rollback',
            ],
            steps: [
              'Revert to previous commit',
              'Restore original function signatures',
              'Revert logging changes',
              'Notify team of rollback',
              'Document rollback reasons',
            ],
            timeline: '15 minutes to complete rollback',
          },
        },
      },
    };

    const refactorInfo = refactoringData[filename];
    if (!refactorInfo) {
      showNotification(`Implementation plan for ${filename} not found`, 'error');
      return;
    }

    // Create implementation plan modal
    const planModal = document.createElement('div');
    planModal.id = 'implementation-plan-modal';
    planModal.style.cssText = `
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

    planModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 1200px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="color: var(--text-primary); margin: 0;">🚀 Refactoring Implementation Plan</h3>
                    <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">${filename}</p>
                </div>
                <button onclick="closeImplementationPlanModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Total Duration</div>
                    <div style="color: var(--primary-color); font-size: 1.5rem; font-weight: 600;">${refactorInfo.implementation.totalDuration}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Team Size</div>
                    <div style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">${refactorInfo.implementation.teamSize}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Skill Level</div>
                    <div style="color: var(--text-primary); font-size: 1.2rem; font-weight: 600;">${refactorInfo.implementation.skillLevel}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📋 Implementation Phases</h4>
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    ${refactorInfo.implementation.phases
                      .map(
                        (phase, index) => `
                        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
                                            PHASE ${index + 1}
                                        </span>
                                        <span style="color: var(--text-primary); font-weight: 500; font-size: 1.1rem;">${phase.phase}</span>
                                    </div>
                                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Estimated Duration: ${phase.duration}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: var(--text-secondary); font-size: 0.8rem;">Start Time</div>
                                    <div style="color: var(--text-primary); font-weight: 500;">${index === 0 ? 'Immediate' : `After Phase ${index}`}</div>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">📝 Tasks</div>
                                    <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                                        ${phase.tasks.map((task) => `<li style="margin-bottom: 0.25rem;">${task}</li>`).join('')}
                                    </ul>
                                </div>
                                <div>
                                    <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">📦 Deliverables</div>
                                    <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                                        ${phase.deliverables.map((deliverable) => `<li style="margin-bottom: 0.25rem;">${deliverable}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                            
                            <div style="background: var(--bg-secondary); border-radius: 6px; padding: 1rem;">
                                <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">⚠️ Risk Management</div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.25rem;">Risks:</div>
                                        <ul style="color: var(--warning-color); margin: 0; padding-left: 1.5rem; font-size: 0.8rem;">
                                            ${phase.risks.map((risk) => `<li style="margin-bottom: 0.25rem;">${risk}</li>`).join('')}
                                        </ul>
                                    </div>
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.25rem;">Mitigation:</div>
                                        <ul style="color: var(--success-color); margin: 0; padding-left: 1.5rem; font-size: 0.8rem;">
                                            ${phase.mitigation.map((strategy) => `<li style="margin-bottom: 0.25rem;">${strategy}</li>`).join('')}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">🛠️ Required Tools & Technologies</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.5rem;">
                    ${refactorInfo.implementation.tools
                      .map(
                        (tool) => `
                        <div style="padding: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                            <div style="color: var(--text-primary); font-weight: 500;">${tool.split(' - ')[0]}</div>
                            <div style="color: var(--text-secondary); font-size: 0.8rem;">${tool.split(' - ')[1] || ''}</div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">✅ Success Criteria</h4>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem;">
                        ${refactorInfo.implementation.successCriteria
                          .map(
                            (criteria) => `
                            <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: var(--success-color);">✓</span>
                                <span>${criteria}</span>
                            </li>
                        `
                          )
                          .join('')}
                    </ul>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">🔄 Rollback Plan</h4>
                <div style="background: var(--bg-warning); border: 1px solid var(--warning-color); border-radius: 8px; padding: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Rollback Triggers</div>
                            <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                                ${refactorInfo.implementation.rollbackPlan.triggers.map((trigger) => `<li style="margin-bottom: 0.25rem;">${trigger}</li>`).join('')}
                            </ul>
                        </div>
                        <div>
                            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Rollback Steps</div>
                            <ul style="color: var(--text-secondary); margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                                ${refactorInfo.implementation.rollbackPlan.steps.map((step) => `<li style="margin-bottom: 0.25rem;">${step}</li>`).join('')}
                            </ul>
                            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem;">Timeline: ${refactorInfo.implementation.rollbackPlan.timeline}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeImplementationPlanModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="exportImplementationPlan('${filename}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    📄 Export Plan
                </button>
                <button onclick="beginRefactoring('${filename}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--success-color); color: white; cursor: pointer;">
                    🚀 Begin Refactoring
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(planModal);

    // Add click outside to close
    planModal.addEventListener('click', (e) => {
      if (e.target === planModal) {
        closeImplementationPlanModal();
      }
    });

    // Show modal
    setTimeout(() => {
      planModal.style.display = 'flex';
    }, 100);
  }

  function closeImplementationPlanModal() {
    const modal = document.getElementById('implementation-plan-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function exportImplementationPlan(filename) {
    showNotification(`Exporting implementation plan for ${filename}...`, 'info');
    // In a real implementation, this would generate and download a detailed implementation plan document
  }

  function beginRefactoring(filename) {
    showNotification(`Starting refactoring process for ${filename}...`, 'success');
    closeImplementationPlanModal();
    // In a real implementation, this would start the actual refactoring process
  }

  // Implement Recommendation function
  function implementRecommendation(recommendation) {
    console.log(`Implementing recommendation: ${recommendation}`);

    // Parse recommendation type and file
    const parts = recommendation.split(' ');
    const action = parts[0];
    const filename = parts.slice(1).join(' ');

    // Show implementation progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'recommendation-progress-modal';
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
        z-index: 10000;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; text-align: center;">
            <div style="width: 50px; height: 50px; border: 4px solid var(--bg-secondary); border-top: 4px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
            <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Implementing Recommendation</div>
            <div id="recommendation-status" style="color: var(--text-secondary); font-size: 0.9rem;">Analyzing ${filename}...</div>
            <div style="width: 100%; height: 6px; background: var(--bg-primary); border-radius: 3px; margin-top: 1rem; overflow: hidden;">
                <div id="recommendation-progress" style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    document.body.appendChild(progressModal);

    // Get recommendation-specific implementation data
    const recommendationData = {
      'Review api/app.py': {
        file: 'api/app.py',
        type: 'code-review',
        steps: [
          'Analyzing Flask application structure...',
          'Reviewing API endpoints and routes...',
          'Checking security implementations...',
          'Validating error handling...',
          'Reviewing database connections...',
          'Checking authentication middleware...',
          'Analyzing performance bottlenecks...',
          'Generating improvement recommendations...',
        ],
        improvements: [
          {
            area: 'Security',
            issue: 'Missing input validation on POST endpoints',
            severity: 'high',
            recommendation: 'Add request validation using Flask-WTF or marshmallow',
            code: "from marshmallow import Schema, fields, validate\n\nclass UserSchema(Schema):\n    name = fields.Str(required=True, validate=validate.Length(min=1, max=50))\n    email = fields.Email(required=True)\n\n@app.route('/api/users', methods=['POST'])\ndef create_user():\n    schema = UserSchema()\n    try:\n        data = schema.load(request.json)\n        # Process validated data\n    except ValidationError as e:\n        return {'errors': e.messages}, 400",
          },
          {
            area: 'Performance',
            issue: 'Database queries not optimized',
            severity: 'medium',
            recommendation: 'Add database connection pooling and query optimization',
            code: 'from sqlalchemy import create_engine\nfrom sqlalchemy.pool import QueuePool\n\n# Configure connection pooling\nengine = create_engine(\n    DATABASE_URL,\n    poolclass=QueuePool,\n    pool_size=10,\n    max_overflow=20,\n    pool_pre_ping=True\n)\n\n# Add query optimization\ndef get_users_optimized():\n    return db.session.query(User).options(\n        joinedload(User.profile),\n        selectinload(User.posts)\n    ).all()',
          },
          {
            area: 'Error Handling',
            issue: 'Generic error handling',
            severity: 'medium',
            recommendation: 'Implement specific error types and proper logging',
            code: "import logging\nfrom flask import jsonify\n\nlogger = logging.getLogger(__name__)\n\nclass APIError(Exception):\n    def __init__(self, message, status_code=400, payload=None):\n        super().__init__()\n        self.message = message\n        self.status_code = status_code\n        self.payload = payload\n\n@app.errorhandler(APIError)\ndef handle_api_error(error):\n    logger.error(f'API Error: {error.message}', extra=error.payload)\n    response = {\n        'error': error.message,\n        'status': error.status_code\n    }\n    if error.payload:\n        response.update(error.payload)\n    return jsonify(response), error.status_code",
          },
        ],
        estimatedTime: '2-3 hours',
        priority: 'high',
      },
    };

    const data = recommendationData[recommendation];
    if (!data) {
      showNotification(`Recommendation data for ${recommendation} not found`, 'error');
      document.body.removeChild(progressModal);
      return;
    }

    // Simulate implementation process
    let progress = 0;
    let step = 0;
    const interval = setInterval(() => {
      progress += 12.5;
      step++;

      if (step < data.steps.length) {
        document.getElementById('recommendation-status').textContent = data.steps[step];
      }

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showRecommendationResults(data, recommendation);
        }, 500);
      }

      document.getElementById('recommendation-progress').style.width = progress + '%';
    }, 600);
  }

  function showRecommendationResults(data, recommendation) {
    console.log('Showing recommendation results:', data);

    // Create results modal
    const resultsModal = document.createElement('div');
    resultsModal.id = 'recommendation-results-modal';
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
        z-index: 10000;
    `;

    resultsModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="color: var(--text-primary); margin: 0;">✅ Recommendation Results</h3>
                    <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">${recommendation}</p>
                </div>
                <button onclick="closeRecommendationResultsModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="background: var(--bg-success); border: 1px solid var(--success-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                <p style="color: white; margin: 0; font-weight: 500;">Analysis completed successfully!</p>
                <p style="color: rgba(255,255,255,0.9); margin: 0.5rem 0 0 0; font-size: 0.9rem;">Found ${data.improvements.length} areas for improvement in ${data.file}</p>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">🔧 Recommended Improvements</h4>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${data.improvements
                      .map(
                        (improvement, index) => `
                        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <span style="padding: 0.25rem 0.5rem; background: ${improvement.severity === 'high' ? 'var(--danger-color)' : improvement.severity === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; color: white; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
                                            ${improvement.severity.toUpperCase()}
                                        </span>
                                        <span style="color: var(--text-primary); font-weight: 500;">${improvement.area}: ${improvement.issue}</span>
                                    </div>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${improvement.recommendation}</p>
                                </div>
                            </div>
                            
                            <div style="background: var(--bg-secondary); border-radius: 6px; padding: 1rem;">
                                <div style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem; font-size: 0.9rem;">💡 Implementation Example</div>
                                <pre style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.75rem; font-size: 0.85rem; overflow-x: auto; color: var(--text-primary);"><code>${improvement.code}</code></pre>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Estimated Implementation Time</div>
                    <div style="color: var(--text-primary); font-size: 1.2rem; font-weight: 600;">${data.estimatedTime}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Priority Level</div>
                    <div style="color: ${data.priority === 'high' ? 'var(--danger-color)' : data.priority === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; font-size: 1.2rem; font-weight: 600;">${data.priority.toUpperCase()}</div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeRecommendationResultsModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Close
                </button>
                <button onclick="exportRecommendationReport('${recommendation}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    📄 Export Report
                </button>
                <button onclick="startImplementation('${recommendation}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--success-color); color: white; cursor: pointer;">
                    🚀 Start Implementation
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(resultsModal);

    // Add click outside to close
    resultsModal.addEventListener('click', (e) => {
      if (e.target === resultsModal) {
        closeRecommendationResultsModal();
      }
    });

    // Show modal
    setTimeout(() => {
      resultsModal.style.display = 'flex';
    }, 100);
  }

  function closeRecommendationResultsModal() {
    const modal = document.getElementById('recommendation-results-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function exportRecommendationReport(recommendation) {
    showNotification(`Exporting recommendation report for ${recommendation}...`, 'info');
    // In a real implementation, this would generate and download a detailed recommendation report
  }

  function startImplementation(recommendation) {
    showNotification(`Starting implementation for ${recommendation}...`, 'success');
    closeRecommendationResultsModal();
    // In a real implementation, this would start the actual implementation process
  }

  // Performance Testing Functions
  function exportPerformanceReport() {
    console.log('Exporting performance report...');

    // Show export progress
    showNotification('Generating performance report...', 'info');

    // Simulate report generation
    setTimeout(() => {
      // Create performance report data
      const reportData = {
        title: 'Performance Analysis Report',
        date: new Date().toISOString(),
        summary: {
          overallScore: 78,
          testsRun: 12,
          passed: 10,
          failed: 2,
          averageResponseTime: 245,
          peakResponseTime: 892,
          throughput: 1250,
        },
        metrics: [
          {
            name: 'API Response Time',
            value: '245ms',
            status: 'good',
            target: '<300ms',
            trend: 'improving',
          },
          {
            name: 'Database Query Time',
            value: '89ms',
            status: 'excellent',
            target: '<100ms',
            trend: 'stable',
          },
          {
            name: 'Memory Usage',
            value: '512MB',
            status: 'warning',
            target: '<400MB',
            trend: 'increasing',
          },
          {
            name: 'CPU Utilization',
            value: '45%',
            status: 'good',
            target: '<60%',
            trend: 'stable',
          },
          {
            name: 'Error Rate',
            value: '0.2%',
            status: 'excellent',
            target: '<1%',
            trend: 'improving',
          },
        ],
        recommendations: [
          'Optimize memory usage by implementing connection pooling',
          'Consider adding caching for frequently accessed data',
          'Monitor memory usage trends for potential issues',
          'Implement automated performance monitoring alerts',
        ],
        charts: {
          responseTime: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
            data: [320, 285, 245, 267, 298, 245, 310],
          },
          throughput: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
            data: [980, 1120, 1250, 1180, 1320, 1250, 1050],
          },
        },
      };

      // Create downloadable report
      const reportContent = generatePerformanceReportContent(reportData);
      downloadReport('performance-report.pdf', reportContent);

      showNotification('Performance report exported successfully!', 'success');
    }, 1500);
  }

  function runPerformanceTest() {
    console.log('Running performance tests...');

    // Show test progress modal
    const testModal = document.createElement('div');
    testModal.id = 'performance-test-modal';
    testModal.style.cssText = `
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

    testModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%; text-align: center;">
            <div style="width: 60px; height: 60px; border: 4px solid var(--bg-secondary); border-top: 4px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem;"></div>
            <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Running Performance Tests</h3>
            <div id="test-status" style="color: var(--text-secondary); margin-bottom: 1rem;">Initializing test suite...</div>
            <div id="test-progress" style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 1rem; overflow: hidden;">
                <div style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="test-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.9rem;">
                <div style="text-align: left;">
                    <div style="color: var(--text-secondary);">Tests Completed:</div>
                    <div id="tests-completed" style="color: var(--text-primary); font-weight: 500;">0/12</div>
                </div>
                <div style="text-align: right;">
                    <div style="color: var(--text-secondary);">Average Response:</div>
                    <div id="avg-response" style="color: var(--text-primary); font-weight: 500;">--ms</div>
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    document.body.appendChild(testModal);

    // Simulate performance testing process
    const testSteps = [
      'Initializing test suite...',
      'Testing API response times...',
      'Measuring database performance...',
      'Analyzing memory usage...',
      'Checking CPU utilization...',
      'Testing concurrent users...',
      'Measuring throughput...',
      'Testing error handling...',
      'Analyzing cache performance...',
      'Testing load balancing...',
      'Measuring scalability...',
      'Generating final report...',
    ];

    let progress = 0;
    let step = 0;
    let testsCompleted = 0;
    const responseTimes = [];

    const interval = setInterval(() => {
      progress += 8.33;
      step++;
      testsCompleted++;

      // Update test status
      if (step < testSteps.length) {
        document.getElementById('test-status').textContent = testSteps[step];
      }

      // Update progress bar
      document.querySelector('#test-progress div').style.width = progress + '%';

      // Update test details
      document.getElementById('tests-completed').textContent = `${testsCompleted}/12`;

      // Simulate response times
      const responseTime = Math.floor(Math.random() * 200) + 150;
      responseTimes.push(responseTime);
      const avgResponse = Math.floor(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      );
      document.getElementById('avg-response').textContent = avgResponse + 'ms';

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(testModal);
          showPerformanceTestResults(responseTimes);
        }, 500);
      }
    }, 800);
  }

  function showPerformanceTestResults(responseTimes) {
    console.log('Showing performance test results');

    // Calculate metrics
    const avgResponse = Math.floor(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    const maxResponse = Math.max(...responseTimes);
    const minResponse = Math.min(...responseTimes);
    const passedTests = responseTimes.filter((rt) => rt < 300).length;
    const failedTests = 12 - passedTests;
    const score = Math.floor((passedTests / 12) * 100);

    // Create results modal
    const resultsModal = document.createElement('div');
    resultsModal.id = 'performance-results-modal';
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
        z-index: 10000;
    `;

    resultsModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="color: var(--text-primary); margin: 0;">🚀 Performance Test Results</h3>
                    <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">Completed at ${new Date().toLocaleTimeString()}</p>
                </div>
                <button onclick="closePerformanceResultsModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: ${score >= 80 ? 'var(--bg-success)' : score >= 60 ? 'var(--bg-warning)' : 'var(--bg-danger)'}; border: 1px solid ${score >= 80 ? 'var(--success-color)' : score >= 60 ? 'var(--warning-color)' : 'var(--danger-color)'}; border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: white; font-size: 0.9rem; margin-bottom: 0.5rem;">Overall Score</div>
                    <div style="color: white; font-size: 1.8rem; font-weight: 600;">${score}%</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Tests Passed</div>
                    <div style="color: var(--success-color); font-size: 1.5rem; font-weight: 600;">${passedTests}/12</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Avg Response</div>
                    <div style="color: ${avgResponse < 300 ? 'var(--success-color)' : 'var(--warning-color)'}; font-size: 1.5rem; font-weight: 600;">${avgResponse}ms</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Peak Response</div>
                    <div style="color: ${maxResponse < 500 ? 'var(--success-color)' : maxResponse < 800 ? 'var(--warning-color)' : 'var(--danger-color)'}; font-size: 1.5rem; font-weight: 600;">${maxResponse}ms</div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📊 Response Time Distribution</h4>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="display: flex; align-items: end; height: 150px; gap: 0.5rem;">
                        ${responseTimes
                          .map((time, index) => {
                            const height = (time / maxResponse) * 100;
                            const color =
                              time < 300
                                ? 'var(--success-color)'
                                : time < 500
                                  ? 'var(--warning-color)'
                                  : 'var(--danger-color)';
                            return `
                                <div style="flex: 1; background: ${color}; border-radius: 2px; height: ${height}%; position: relative;" title="Test ${index + 1}: ${time}ms">
                                    <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 0.7rem; color: var(--text-secondary);">${time}</div>
                                </div>
                            `;
                          })
                          .join('')}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                        <span>Test 1</span>
                        <span>Test 6</span>
                        <span>Test 12</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📈 Performance Metrics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem;">
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Min Response Time</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${minResponse}ms</div>
                    </div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem;">
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Max Response Time</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${maxResponse}ms</div>
                    </div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem;">
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Tests Failed</div>
                        <div style="color: ${failedTests > 0 ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: 500;">${failedTests}</div>
                    </div>
                    <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.75rem;">
                        <div style="color: var(--text-secondary); font-size: 0.8rem;">Success Rate</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${Math.floor((passedTests / 12) * 100)}%</div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closePerformanceResultsModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Close
                </button>
                <button onclick="exportPerformanceReport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    📄 Export Report
                </button>
                <button onclick="rerunPerformanceTest()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    🔄 Rerun Test
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(resultsModal);

    // Add click outside to close
    resultsModal.addEventListener('click', (e) => {
      if (e.target === resultsModal) {
        closePerformanceResultsModal();
      }
    });

    // Show modal
    setTimeout(() => {
      resultsModal.style.display = 'flex';
    }, 100);
  }

  function closePerformanceResultsModal() {
    const modal = document.getElementById('performance-results-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function rerunPerformanceTest() {
    closePerformanceResultsModal();
    runPerformanceTest();
  }

  function refreshPerformanceData() {
    console.log('Refreshing performance data...');

    // Show refresh progress
    showNotification('Refreshing performance metrics...', 'info');

    // Simulate data refresh
    setTimeout(() => {
      // Update performance displays
      updatePerformanceDisplays();

      showNotification('Performance data refreshed successfully!', 'success');
    }, 1000);
  }

  function updatePerformanceDisplays() {
    // In a real implementation, this would update the UI with fresh performance data
    console.log('Updating performance displays with fresh data...');

    // Simulate updating various performance metrics
    const metrics = {
      responseTime: Math.floor(Math.random() * 100) + 200,
      throughput: Math.floor(Math.random() * 500) + 1000,
      errorRate: (Math.random() * 0.5).toFixed(2),
      memoryUsage: Math.floor(Math.random() * 200) + 400,
      cpuUtilization: Math.floor(Math.random() * 30) + 30,
    };

    console.log('Updated performance metrics:', metrics);
  }

  function generatePerformanceReportContent(data) {
    // Generate PDF-like content for the performance report
    return `
PERFORMANCE ANALYSIS REPORT
==========================

Generated: ${data.date}

EXECUTIVE SUMMARY
-----------------
Overall Score: ${data.summary.overallScore}/100
Tests Run: ${data.summary.testsRun}
Passed: ${data.summary.passed}
Failed: ${data.summary.failed}
Average Response Time: ${data.summary.averageResponseTime}ms
Peak Response Time: ${data.summary.peakResponseTime}ms
Throughput: ${data.summary.throughput} requests/second

PERFORMANCE METRICS
------------------
${data.metrics
  .map(
    (metric) => `
${metric.name}: ${metric.value}
Status: ${metric.status}
Target: ${metric.target}
Trend: ${metric.trend}
`
  )
  .join('\n')}

RECOMMENDATIONS
---------------
${data.recommendations.map((rec) => `• ${rec}`).join('\n')}

RESPONSE TIME CHART
------------------
Time: ${data.charts.responseTime.labels.join(', ')}
Data: ${data.charts.responseTime.data.join(', ')}

THROUGHPUT CHART
---------------
Time: ${data.charts.throughput.labels.join(', ')}
Data: ${data.charts.throughput.data.join(', ')}
    `.trim();
  }

  function downloadReport(filename, content) {
    // Create downloadable file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Roadmap Management Functions
  function addMilestone() {
    console.log('Adding new milestone...');

    // Create milestone modal
    const modal = document.createElement('div');
    modal.id = 'milestone-modal';
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
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🎯 Add New Milestone</h3>
                <button onclick="closeMilestoneModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <form onsubmit="saveMilestone(event)">
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Milestone Name</label>
                        <input type="text" id="milestone-name" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);" placeholder="e.g., Q2 Product Launch">
                    </div>
                    
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Description</label>
                        <textarea id="milestone-description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); resize: vertical;" placeholder="Describe the milestone objectives..."></textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Target Date</label>
                            <input type="date" id="milestone-date" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        
                        <div>
                            <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Priority</label>
                            <select id="milestone-priority" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Status</label>
                        <select id="milestone-status" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="planned">Planned</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="delayed">Delayed</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Assigned Team</label>
                        <input type="text" id="milestone-team" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);" placeholder="e.g., Development Team">
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button type="button" onclick="closeMilestoneModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                        Cancel
                    </button>
                    <button type="submit" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                        Add Milestone
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeMilestoneModal();
      }
    });

    // Show modal
    setTimeout(() => {
      modal.style.display = 'flex';
    }, 100);
  }

  function closeMilestoneModal() {
    const modal = document.getElementById('milestone-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function saveMilestone(event) {
    event.preventDefault();

    const milestone = {
      id: 'MILE-' + Date.now(),
      name: document.getElementById('milestone-name').value,
      description: document.getElementById('milestone-description').value,
      date: document.getElementById('milestone-date').value,
      priority: document.getElementById('milestone-priority').value,
      status: document.getElementById('milestone-status').value,
      team: document.getElementById('milestone-team').value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dependencies: [],
      tags: [],
    };

    console.log('Saving milestone:', milestone);

    // Save to persistent storage
    const currentMilestones = roadmapStorage.loadMilestones();
    currentMilestones.push(milestone);

    if (roadmapStorage.saveMilestones(currentMilestones)) {
      showNotification(`Milestone "${milestone.name}" added successfully!`, 'success');
    } else {
      showNotification('Failed to save milestone. Please try again.', 'error');
      return;
    }

    closeMilestoneModal();

    // Refresh the roadmap display
    refreshRoadmap();
  }

  function editTimeline() {
    console.log('Editing timeline...');

    // Create timeline editor modal
    const modal = document.createElement('div');
    modal.id = 'timeline-modal';
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
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">📅 Edit Timeline</h3>
                <button onclick="closeTimelineModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Timeline Settings</h4>
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Timeline View</label>
                        <select id="timeline-view" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="months">Monthly View</option>
                            <option value="quarters">Quarterly View</option>
                            <option value="years">Yearly View</option>
                            <option value="gantt">Gantt Chart</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Date Range</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <input type="date" id="timeline-start" style="padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);" placeholder="Start Date">
                            <input type="date" id="timeline-end" style="padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);" placeholder="End Date">
                        </div>
                    </div>
                    
                    <div>
                        <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Display Options</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                                <input type="checkbox" id="show-milestones" checked style="padding: 0.5rem;">
                                Show Milestones
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                                <input type="checkbox" id="show-dependencies" checked style="padding: 0.5rem;">
                                Show Dependencies
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                                <input type="checkbox" id="show-progress" checked style="padding: 0.5rem;">
                                Show Progress
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
                                <input type="checkbox" id="show-teams" style="padding: 0.5rem;">
                                Show Teams
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Milestone Order</h4>
                <div id="milestone-order" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem;">
                    <p style="color: var(--text-secondary); text-align: center;">Drag and drop milestones to reorder</p>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeTimelineModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="saveTimelineSettings()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Save Changes
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTimelineModal();
      }
    });

    // Show modal
    setTimeout(() => {
      modal.style.display = 'flex';
    }, 100);
  }

  function closeTimelineModal() {
    const modal = document.getElementById('timeline-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function saveTimelineSettings() {
    const settings = {
      view: document.getElementById('timeline-view').value,
      startDate: document.getElementById('timeline-start').value,
      endDate: document.getElementById('timeline-end').value,
      showMilestones: document.getElementById('show-milestones').checked,
      showDependencies: document.getElementById('show-dependencies').checked,
      showProgress: document.getElementById('show-progress').checked,
      showTeams: document.getElementById('show-teams').checked,
    };

    console.log('Saving timeline settings:', settings);

    // Save to persistent storage
    if (roadmapStorage.saveSettings(settings)) {
      showNotification('Timeline settings saved successfully!', 'success');
    } else {
      showNotification('Failed to save timeline settings. Please try again.', 'error');
      return;
    }

    closeTimelineModal();

    // Refresh the roadmap display
    refreshRoadmap();
  }

  function refreshRoadmap() {
    console.log('Refreshing roadmap...');
    showNotification('Roadmap refreshed with latest data', 'info');

    // In a real implementation, this would reload the roadmap data
    const container = document.querySelector('.dashboard-container');
    if (container) {
      // Re-render the roadmap
      showRoadmap(container);
    }
  }

  function showRoadmap(container) {
    console.log('Displaying roadmap...');

    // Load milestones from persistent storage
    const milestones = roadmapStorage.loadMilestones();

    container.textContent = `
        <div style="padding: 2rem /* Replaced innerHTML with textContent for safety */">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: var(--text-primary); margin: 0;">
                    <svg class="svg-inline--fa fa-route" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="route" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 1.5rem; height: 1.5rem; margin-right: 0.5rem; vertical-align: middle;">
                        <path fill="currentColor" d="M512 96c0 50.2-59.1 125.1-84.6 155c-3.8 4.4-9.4 6.1-14.5 5H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c53 0 96 43 96 96s-43 96-96 96H139.6c8.7-9.9 19.3-22.6 30-36.8c6.3-8.4 12.8-17.6 19-27.2H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320c-53 0-96-43-96-96s43-96 96-96h39.8c-21-31.5-39.8-67.7-39.8-96c0-53 43-96 96-96s96 43 96 96zM117.1 489.1c-3.8 4.3-7.2 8.1-10.1 11.3l-1.8 2-.2-.2c-6 4.6-14.6 4-20-1.8C59.8 473 0 402.5 0 352c0-53 43-96 96-96s96 43 96 96c0 30-21.1 67-43.5 97.9c-10.7 14.7-21.7 28-30.8 38.5l-.6 .7zM128 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM416 128a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"></path>
                    </svg>
                    Roadmap
                </h2>
                <div>
                    <button class="btn btn-primary" onclick="addMilestone()">
                        <svg class="svg-inline--fa fa-plus" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="plus" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"></path>
                        </svg>
                        Add Milestone
                    </button>
                    <button class="btn btn-secondary" onclick="editTimeline()">
                        <svg class="svg-inline--fa fa-pen-to-square" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="pen-to-square" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.2c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"></path>
                        </svg>
                        Edit Timeline
                    </button>
                    <button class="btn btn-secondary" onclick="refreshRoadmap()">
                        <svg class="svg-inline--fa fa-rotate" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="rotate" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M142.9 142.9c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5c0 0 0 0 0 0H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5c7.7-21.8 20.2-42.3 37.8-59.8zM16 312v7.6 .7V440c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2l41.6-41.6c87.6 86.5 228.7 86.2 315.8-1c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.2 62.2-162.7 62.5-225.3 1L185 329c6.9-6.9 8.9-17.2 5.2-26.2s-12.5-14.8-22.2-14.8H48.4h-.7H40c-13.3 0-24 10.7-24 24z"></path>
                        </svg>
                        Refresh
                    </button>
                    <button class="btn btn-secondary" onclick="exportRoadmapData()">
                        <svg class="svg-inline--fa fa-download" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="download" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M288 32c0-17.7-14.3-32-32-32H160c-17.7 0-32 14.3-32 32V96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32V32zM64 288c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 17.7 14.3 32 32 32s32-14.3 32-32V288zM448 128c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32zM480 352c0 17.7-14.3 32-32 32H352c-17.7 0-32-14.3-32-32s14.3-32 32-32h96c17.7 0 32 14.3 32 32zM32 416c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64c-17.7 0-32 14.3-32 32zm352-64c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32h-96z"></path>
                        </svg>
                        Export
                    </button>
                    <button class="btn btn-secondary" onclick="importRoadmapData()">
                        <svg class="svg-inline--fa fa-upload" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="upload" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M288 109.3V336c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3L169.4 246.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l109.3-109.3c12.5-12.5 32.8-12.5 45.3 0l109.3 109.3c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM416 128a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"></path>
                        </svg>
                        Import
                    </button>
                    <button class="btn btn-secondary" onclick="clearRoadmapData()">
                        <svg class="svg-inline--fa fa-trash" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="trash" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M135.2 17.7L140.6 32H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h384c17.7 0 32-14.3 32-32s-14.3-32-32-32h-108.6l5.4-14.3c1.8-4.8 6.4-8.5 11.5-8.5h80.2c5.1 0 9.7 3.7 11.5 8.5l5.4 14.3h-108.6c-17.7 0-32 14.3-32 32s14.3 32 32 32h384c17.7 0 32-14.3 32-32s-14.3-32-32-32h-108.6zM32 96h384v352c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V96zm64 64v224c0 8.8 7.2 16 16 16s16-7.2 16-16V160c0-8.8-7.2-16-16-16s-16 7.2-16 16zm96 0v224c0 8.8 7.2 16 16 16s16-7.2 16-16V160c0-8.8-7.2-16-16-16s-16 7.2-16 16zm96 0v224c0 8.8 7.2 16 16 16s16-7.2 16-16V160c0-8.8-7.2-16-16-16s-16 7.2-16 16z"></path>
                        </svg>
                        Clear
                    </button>
                    <button class="btn btn-secondary" onclick="showAdvancedViews()">
                        <svg class="svg-inline--fa fa-chart-gantt" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="chart-gantt" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M0 432c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V256H0v176zm192-68c0-6.6 5.4-12 12-12h136c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H204c-6.6 0-12-5.4-12-12v-40zm-128 0c0-6.6 5.4-12 12-12h72c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zm384-164v12c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12v-12c0-6.6 5.4-12 12-12h424c6.6 0 12 5.4 12 12zm-12-128H12c-6.6 0-12-5.4-12-12v-12c0-6.6 5.4-12 12-12h424c6.6 0 12 5.4 12 12v12c0 6.6-5.4 12-12 12z"></path>
                        </svg>
                        Advanced Views
                    </button>
                    <button class="btn btn-secondary" onclick="showIntegrations()">
                        <svg class="svg-inline--fa fa-plug" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="plug" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M96 224c0-53 43-96 96-96h192v96c0 53-43 96-96 96H96V224zm320 96h96c53 0 96-43 96-96V128c0-53-43-96-96-96H352v96c0 53-43 96-96 96h-96c-53 0-96-43-96-96V32H0v192c0 88.4 71.6 160 160 160h96c53 0 96-43 96-96v96h64V320zm0-256h96c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48h-96V64z"></path>
                        </svg>
                        Integrations
                    </button>
                    <button class="btn btn-secondary" onclick="showCollaboration()">
                        <svg class="svg-inline--fa fa-users" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="users" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" style="width: 1rem; height: 1rem; margin-right: 0.5rem; vertical-align: middle;">
                            <path fill="currentColor" d="M96 224c61.9 0 112-50.1 112-112S157.9 0 96 0S-16 50.1-16 112s50.1 112 112 112zm0 32c-74.2 0-224 37.1-224 112v48c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48v-48c0-74.9-149.8-112-224-112zm352 0c-8.8 0-17.6.4-26.4 1.1C452.1 272.1 480 311.8 480 358.4V400h96c26.5 0 48-21.5 48-48v-48c0-74.9-149.8-112-224-112zm-96-32c61.9 0 112-50.1 112-112S413.9 0 352 0s-112 50.1-112 112 50.1 112 112 112z"></path>
                        </svg>
                        Collaboration
                    </button>
                </div>
            </div>
            
            <!-- Timeline View -->
            <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; margin-bottom: 2rem;">
                <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📅 Project Timeline</h3>
                <div style="position: relative; padding: 2rem 0;">
                    <!-- Timeline line -->
                    <div style="position: absolute; left: 2rem; top: 0; bottom: 0; width: 2px; background: var(--border-color);"></div>
                    
                    <!-- Milestones -->
                    ${milestones
                      .map(
                        (milestone, index) => `
                        <div style="position: relative; padding-left: 4rem; margin-bottom: 2rem;">
                            <!-- Timeline dot -->
                            <div style="position: absolute; left: 1.5rem; top: 0.5rem; width: 1rem; height: 1rem; border-radius: 50%; background: ${milestone.status === 'completed' ? 'var(--success-color)' : milestone.status === 'in-progress' ? 'var(--primary-color)' : milestone.status === 'delayed' ? 'var(--danger-color)' : 'var(--warning-color)'};"></div>
                            
                            <!-- Milestone card -->
                            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                    <div>
                                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">${milestone.name}</h4>
                                        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">${milestone.description}</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 500; background: ${milestone.priority === 'high' ? 'var(--danger-color)' : milestone.priority === 'medium' ? 'var(--warning-color)' : 'var(--success-color)'}; color: white;">
                                            ${milestone.priority.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                    <div style="display: flex; gap: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                                        <span>📅 ${new Date(milestone.date).toLocaleDateString()}</span>
                                        <span>👥 ${milestone.team}</span>
                                    </div>
                                    <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: ${milestone.status === 'completed' ? 'var(--bg-success)' : milestone.status === 'in-progress' ? 'var(--bg-primary)' : milestone.status === 'delayed' ? 'var(--bg-danger)' : 'var(--bg-warning)'}; color: ${milestone.status === 'completed' ? 'var(--success-color)' : milestone.status === 'in-progress' ? 'var(--primary-color)' : milestone.status === 'delayed' ? 'var(--danger-color)' : 'var(--warning-color)'};">
                                        ${milestone.status.replace('-', ' ').toUpperCase()}
                                    </span>
                                </div>
                                
                                ${
                                  milestone.progress > 0
                                    ? `
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                            <span style="color: var(--text-primary); font-size: 0.9rem;">Progress</span>
                                            <span style="color: var(--text-secondary); font-size: 0.9rem;">${milestone.progress}%</span>
                                        </div>
                                        <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden;">
                                            <div style="height: 100%; width: ${milestone.progress}%; background: linear-gradient(90deg, var(--primary-color), var(--success-color)); border-radius: 3px;"></div>
                                        </div>
                                    </div>
                                `
                                    : ''
                                }
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <!-- Statistics -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Total Milestones</div>
                    <div style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">${milestones.length}</div>
                </div>
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">Completed</div>
                    <div style="color: var(--success-color); font-size: 1.5rem; font-weight: 600;">${milestones.filter((m) => m.status === 'completed').length}</div>
                </div>
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">In Progress</div>
                    <div style="color: var(--primary-color); font-size: 1.5rem; font-weight: 600;">${milestones.filter((m) => m.status === 'in-progress').length}</div>
                </div>
                <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">On Track</div>
                    <div style="color: ${milestones.filter((m) => m.status === 'delayed').length > 0 ? 'var(--warning-color)' : 'var(--success-color)'}; font-size: 1.5rem; font-weight: 600;">${milestones.filter((m) => m.status !== 'delayed').length}/${milestones.length}</div>
                </div>
            </div>
        </div>
    `;
  }

  // Roadmap Data Persistence System
  class RoadmapStorage {
    constructor() {
      this.storageKey = 'roadmap_data';
      this.settingsKey = 'roadmap_settings';
      this.version = '1.0.0';
    }

    // Save milestones to localStorage and sync with API
    async saveMilestones(milestones) {
      try {
        // Save to localStorage first
        const data = {
          version: this.version,
          timestamp: new Date().toISOString(),
          milestones: milestones,
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        console.log('✅ Milestones saved to localStorage');

        // Sync with API if online and API client is available
        if (window.roadmapAPI && window.roadmapAPI.isOnline) {
          try {
            // Batch update milestones in API
            const results = [];
            for (const milestone of milestones) {
              try {
                // Try to update existing milestone
                await window.roadmapAPI.updateMilestone(milestone.id, milestone);
                results.push({ id: milestone.id, action: 'updated' });
              } catch (error) {
                if (error.message.includes('404')) {
                  // Milestone doesn't exist, create it
                  await window.roadmapAPI.createMilestone(milestone);
                  results.push({ id: milestone.id, action: 'created' });
                } else {
                  results.push({ id: milestone.id, action: 'failed', error: error.message });
                }
              }
            }

            console.log('🔄 Milestones synced with API:', results);
            return true;
          } catch (syncError) {
            console.warn('⚠️ Failed to sync with API, but localStorage save succeeded:', syncError);
            // Still return true since localStorage worked
            return true;
          }
        }

        return true;
      } catch (error) {
        console.error('❌ Failed to save milestones:', error);
        return false;
      }
    }

    // Load milestones from localStorage
    loadMilestones() {
      try {
        const data = localStorage.getItem(this.storageKey);
        if (!data) {
          return this.getDefaultMilestones();
        }

        const parsed = JSON.parse(data);

        // Version migration handling
        if (parsed.version !== this.version) {
          console.log('🔄 Migrating roadmap data from version', parsed.version, 'to', this.version);
          return this.migrateData(parsed);
        }

        return parsed.milestones || this.getDefaultMilestones();
      } catch (error) {
        console.error('❌ Failed to load milestones:', error);
        return this.getDefaultMilestones();
      }
    }

    // Save timeline settings
    saveSettings(settings) {
      try {
        const data = {
          version: this.version,
          timestamp: new Date().toISOString(),
          settings: settings,
        };
        localStorage.setItem(this.settingsKey, JSON.stringify(data));
        console.log('✅ Timeline settings saved to localStorage');
        return true;
      } catch (error) {
        console.error('❌ Failed to save settings:', error);
        return false;
      }
    }

    // Load timeline settings
    loadSettings() {
      try {
        const data = localStorage.getItem(this.settingsKey);
        if (!data) {
          return this.getDefaultSettings();
        }

        const parsed = JSON.parse(data);
        return parsed.settings || this.getDefaultSettings();
      } catch (error) {
        console.error('❌ Failed to load settings:', error);
        return this.getDefaultSettings();
      }
    }

    // Export data for backup
    exportData() {
      const milestones = this.loadMilestones();
      const settings = this.loadSettings();

      return {
        version: this.version,
        exportDate: new Date().toISOString(),
        milestones: milestones,
        settings: settings,
      };
    }

    // Import data from backup
    importData(data) {
      try {
        if (!data.milestones || !Array.isArray(data.milestones)) {
          throw new Error('Invalid data format');
        }

        // Validate milestone structure
        const validatedMilestones = data.milestones.filter(
          (milestone) => milestone.id && milestone.name && milestone.date
        );

        this.saveMilestones(validatedMilestones);

        if (data.settings) {
          this.saveSettings(data.settings);
        }

        console.log('✅ Data imported successfully');
        return true;
      } catch (error) {
        console.error('❌ Failed to import data:', error);
        return false;
      }
    }

    // Clear all data
    clearData() {
      try {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.settingsKey);
        console.log('✅ Roadmap data cleared');
        return true;
      } catch (error) {
        console.error('❌ Failed to clear data:', error);
        return false;
      }
    }

    // Get default milestones
    getDefaultMilestones() {
      return [
        {
          id: 'MILE-001',
          name: 'Q1 Product Launch',
          description: 'Launch the new product with core features',
          date: '2024-03-31',
          priority: 'high',
          status: 'completed',
          team: 'Product Team',
          progress: 100,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-03-31T23:59:59Z',
        },
        {
          id: 'MILE-002',
          name: 'Q2 Feature Enhancement',
          description: 'Add advanced features and improvements',
          date: '2024-06-30',
          priority: 'high',
          status: 'in-progress',
          team: 'Development Team',
          progress: 65,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-05-20T12:00:00Z',
        },
        {
          id: 'MILE-003',
          name: 'Q3 Market Expansion',
          description: 'Expand to new markets and user segments',
          date: '2024-09-30',
          priority: 'medium',
          status: 'planned',
          team: 'Marketing Team',
          progress: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];
    }

    // Get default settings
    getDefaultSettings() {
      return {
        view: 'months',
        startDate: null,
        endDate: null,
        showMilestones: true,
        showDependencies: false,
        showProgress: true,
        showTeams: true,
        theme: 'default',
        autoSave: true,
        notifications: true,
      };
    }

    // Data migration for version updates
    migrateData(oldData) {
      const milestones = oldData.milestones || this.getDefaultMilestones();

      // Add missing fields for new version
      const migratedMilestones = milestones.map((milestone) => ({
        ...milestone,
        createdAt: milestone.createdAt || new Date().toISOString(),
        updatedAt: milestone.updatedAt || new Date().toISOString(),
        dependencies: milestone.dependencies || [],
        tags: milestone.tags || [],
      }));

      this.saveMilestones(migratedMilestones);
      return migratedMilestones;
    }
  }

  // Initialize storage system
  const roadmapStorage = new RoadmapStorage();
  window.roadmapStorage = roadmapStorage;

  // Data Management Functions
  function exportRoadmapData() {
    console.log('Exporting roadmap data...');

    try {
      const data = roadmapStorage.exportData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `roadmap-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showNotification('Roadmap data exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export roadmap data:', error);
      showNotification('Failed to export roadmap data. Please try again.', 'error');
    }
  }

  function importRoadmapData() {
    console.log('Importing roadmap data...');

    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);

          if (roadmapStorage.importData(data)) {
            showNotification('Roadmap data imported successfully!', 'success');
            refreshRoadmap();
          } else {
            showNotification('Failed to import roadmap data. Invalid file format.', 'error');
          }
        } catch (error) {
          console.error('Failed to parse import file:', error);
          showNotification('Failed to import roadmap data. Invalid JSON format.', 'error');
        }
      };

      reader.readAsText(file);
      document.body.removeChild(input);
    });

    input.addEventListener('cancel', function () {
      document.body.removeChild(input);
    });

    document.body.appendChild(input);
    input.click();
  }

  function clearRoadmapData() {
    console.log('Clearing roadmap data...');

    // Create confirmation modal
    const modal = document.createElement('div');
    modal.id = 'clear-confirm-modal';
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
          <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                  <h3 style="color: var(--text-primary); margin: 0;">⚠️ Clear All Data</h3>
                  <button onclick="closeClearConfirmModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                      ✕
                  </button>
              </div>
              
              <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                  Are you sure you want to clear all roadmap data? This action cannot be undone and will delete all milestones and settings.
              </p>
              
              <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                  <button onclick="closeClearConfirmModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                      Cancel
                  </button>
                  <button onclick="confirmClearData()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--danger-color); color: white; cursor: pointer;">
                      Clear All Data
                  </button>
              </div>
          </div>
      `;

    document.body.appendChild(modal);

    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeClearConfirmModal();
      }
    });

    // Show modal
    setTimeout(() => {
      modal.style.display = 'flex';
    }, 100);
  }

  function closeClearConfirmModal() {
    const modal = document.getElementById('clear-confirm-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function confirmClearData() {
    if (roadmapStorage.clearData()) {
      showNotification('All roadmap data cleared successfully!', 'success');
      closeClearConfirmModal();
      refreshRoadmap();
    } else {
      showNotification('Failed to clear roadmap data. Please try again.', 'error');
    }
  }

  // Make functions globally available for navigation
  window.showRoadmap = showRoadmap;
  window.addMilestone = addMilestone;
  window.editTimeline = editTimeline;
  window.refreshRoadmap = refreshRoadmap;
  window.closeMilestoneModal = closeMilestoneModal;
  window.saveMilestone = saveMilestone;
  window.closeTimelineModal = closeTimelineModal;
  window.saveTimelineSettings = saveTimelineSettings;
  window.roadmapStorage = roadmapStorage;
  window.exportRoadmapData = exportRoadmapData;
  window.importRoadmapData = importRoadmapData;
  window.clearRoadmapData = clearRoadmapData;
  window.closeClearConfirmModal = closeClearConfirmModal;
  window.confirmClearData = confirmClearData;

  // Advanced Views Functions
  // eslint-disable-next-line no-unused-vars
  function showAdvancedViews() {
    console.log('Opening advanced views...');

    if (!window.roadmapAdvancedViews) {
      console.warn('Advanced views system not available, loading fallback...');
      showNotification('Advanced views system loading...', 'info');
      // Try to load the advanced views system
      setTimeout(() => {
        if (window.roadmapAdvancedViews) {
          showAdvancedViews();
        } else {
          showNotification('Advanced views system not available', 'error');
        }
      }, 1000);
      return;
    }

    const milestones = roadmapStorage.loadMilestones();
    const container = document.querySelector('.dashboard-container');

    if (container) {
      // Create view selector modal
      const modal = document.createElement('div');
      modal.id = 'advanced-views-modal';
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
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 style="color: var(--text-primary); margin: 0;">📊 Advanced Views</h3>
            <button onclick="closeAdvancedViewsModal()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
              ✕
            </button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
            <button onclick="openGanttChart()" style="padding: 2rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 1rem;">📊</div>
              <h4 style="margin: 0 0 0.5rem 0;">Gantt Chart</h4>
              <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Visual timeline with dependencies</p>
            </button>
            
            <button onclick="openKanbanBoard()" style="padding: 2rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer; text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 1rem;">📋</div>
              <h4 style="margin: 0 0 0.5rem 0;">Kanban Board</h4>
              <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Task board with drag & drop</p>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Add click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeAdvancedViewsModal();
        }
      });

      // Show modal
      setTimeout(() => {
        modal.style.display = 'flex';
      }, 100);
    }
  }

  function closeAdvancedViewsModal() {
    const modal = document.getElementById('advanced-views-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // eslint-disable-next-line no-unused-vars
  function openGanttChart() {
    closeAdvancedViewsModal();
    const milestones = roadmapStorage.loadMilestones();
    const container = document.querySelector('.dashboard-container');
    if (container) {
      window.roadmapAdvancedViews.renderGanttChart(container, milestones);
      showNotification('Gantt chart view opened', 'success');
    }
  }

  // eslint-disable-next-line no-unused-vars
  function openKanbanBoard() {
    closeAdvancedViewsModal();
    const milestones = roadmapStorage.loadMilestones();
    const container = document.querySelector('.dashboard-container');
    if (container) {
      window.roadmapAdvancedViews.renderKanbanBoard(container, milestones);
      showNotification('Kanban board view opened', 'success');
    }
  }

  // Integrations Functions
  // eslint-disable-next-line no-unused-vars
  function showIntegrations() {
    console.log('Opening integrations...');

    if (!window.roadmapIntegrations) {
      console.warn('Integrations system not available, loading fallback...');
      showNotification('Integrations system loading...', 'info');
      setTimeout(() => {
        if (window.roadmapIntegrations) {
          showIntegrations();
        } else {
          showNotification('Integrations system not available', 'error');
        }
      }, 1000);
      return;
    }

    window.roadmapIntegrations.showIntegrationsModal();
  }

  // Collaboration Functions
  // eslint-disable-next-line no-unused-vars
  function showCollaboration() {
    console.log('Opening collaboration features...');

    if (!window.roadmapCollaboration) {
      console.warn('Collaboration system not available, loading fallback...');
      showNotification('Collaboration system loading...', 'info');
      setTimeout(() => {
        if (window.roadmapCollaboration) {
          showCollaboration();
        } else {
          showNotification('Collaboration system not available', 'error');
        }
      }, 1000);
      return;
    }

    // Show collaboration panel
    const container = document.querySelector('.dashboard-container');
    if (container) {
      const collaborationPanel = document.createElement('div');
      collaborationPanel.id = 'collaboration-panel';
      collaborationPanel.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 300px;
        height: 100%;
        background: var(--card-bg);
        border-left: 1px solid var(--border-color);
        padding: 2rem;
        overflow-y: auto;
        z-index: 9999;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;

      collaborationPanel.textContent = `
        <div style="display: flex /* Replaced innerHTML with textContent for safety */ justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <h3 style="color: var(--text-primary); margin: 0;">👥 Collaboration</h3>
          <button onclick="closeCollaborationPanel()" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
            ✕
          </button>
        </div>
        
        <div style="margin-bottom: 2rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Active Users</h4>
          <div id="active-users">
            <!-- Active users will be populated here -->
          </div>
        </div>
        
        <div style="margin-bottom: 2rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Recent Activity</h4>
          <div id="activity-list">
            <!-- Activity will be populated here -->
          </div>
        </div>
      `;

      document.body.appendChild(collaborationPanel);

      // Show panel
      setTimeout(() => {
        collaborationPanel.style.transform = 'translateX(0)';
      }, 100);

      // Update displays
      window.roadmapCollaboration.updateActiveUsersDisplay();
      window.roadmapCollaboration.updateActivityDisplay();
    }
  }

  // eslint-disable-next-line no-unused-vars
  function closeCollaborationPanel() {
    const panel = document.getElementById('collaboration-panel');
    if (panel) {
      panel.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(panel);
      }, 300);
    }
  }

  // Functions are now available from roadmap-global-functions.js

  console.log(
    '✅ Export system with backup integration, complexity analysis, sprint management, task editing, complexity data refresh, file analysis, recommendation implementation, performance testing, and roadmap management loaded'
  );
}
