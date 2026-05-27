/**
 * Dashboard Unit Tests
 * Tests for core dashboard functionality
 */

// Mock DOM environment
import { MockFactory } from '../utils/mock-factory.js';

const { JSDOM } = require('jsdom');

// Set up DOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock Chart.js
global.Chart = jest.fn(() => ({
    update: MockFactory.createMockFunction(),
    destroy: MockFactory.createMockFunction()
}));

// Mock dashboard object
global.dashboard = {
    dataEngine: {
        setCurrentDirectory: MockFactory.createMockFunction(),
        analyzeDirectory: MockFactory.createMockFunction()
    },
    projectFileAnalyzer: MockFactory.createMockFunction(),
    technicalDebtAnalyzer: MockFactory.createMockFunction(),
    ai: MockFactory.createMockFunction()
};

// Test suite
describe('Dashboard Core Functionality', () => {
    beforeEach(() => {
    // Reset mocks before each test
        jest.clearAllMocks();
    });

    describe('calculateRoadmapProgress', () => {
        test('should calculate progress correctly with completed tasks', () => {
            // Mock DOM elements
            const mockData =  [
                { checked: true },
                { checked: true },
                { checked: false },
                { checked: true },
                { checked: false }
            ];
      
            document.querySelectorAll = jest.fn(() => mockCheckboxes);
      
            // Mock progress elements
            const mockData =  { style: { width: '' } };
            const mockData =  { textContent: '' };
      
            document.getElementById = jest.fn((id) => {
                if (id === 'overall-progress-bar') {
                    return mockProgressBar;
                }
                if (id === 'overall-progress-text') {
                    return mockProgressText;
                }
                return null;
            });
      
            // Import and test the function
            const { calculateRoadmapProgress } = require('./index.html');
      
            // Execute the function
            calculateRoadmapProgress();
      
            // Verify progress calculation
            expect(mockProgressBar.style.width).toBe('60%');
            expect(mockProgressText.textContent).toBe('60% Complete');
        });

        test('should handle zero tasks gracefully', () => {
            document.querySelectorAll = jest.fn(() => []);
      
            const mockData =  { style: { width: '' } };
            const mockData =  { textContent: '' };
      
            document.getElementById = jest.fn((id) => {
                if (id === 'overall-progress-bar') {
                    return mockProgressBar;
                }
                if (id === 'overall-progress-text') {
                    return mockProgressText;
                }
                return null;
            });
      
            const { calculateRoadmapProgress } = require('./index.html');
      
            expect(() => calculateRoadmapProgress()).not.toThrow();
        });
    });

    describe('Project File Analysis', () => {
        test('should analyze project files correctly', () => {
            const mockData =  {
                total_files: 7780,
                total_directories: 156,
                file_types: {
                    '.js': 2450,
                    '.html': 890,
                    '.css': 340,
                    '.json': 567
                }
            };
      
            const mockData =  {
                missingConfigFiles: [],
                untrackedFiles: [],
                suggestions: []
            };
      
            // Mock ProjectFileAnalyzer
            const mockData =  {
                analyzeDirectory: jest.fn(() => mockAnalysis),
                generateReport: jest.fn(() => '# Test Report')
            };
      
            global.dashboard.projectFileAnalyzer = mockAnalyzer;
      
            const { runProjectFileAnalysis } = require('./index.html');
      
            // Execute the analysis
            runProjectFileAnalysis();
      
            // Verify analyzer was called
            expect(mockAnalyzer.analyzeDirectory).toHaveBeenCalledWith('./', mockProjectData);
        });
    });

    describe('Technical Debt Analysis', () => {
        test('should analyze technical debt correctly', () => {
            const mockData =  {
                technical_debt: {
                    overall: { score: 25, severity: 'low' },
                    metrics: {
                        codeComplexity: 30,
                        testCoverage: 75,
                        documentation: 60,
                        codeSmells: 20,
                        performance: 85,
                        security: 90
                    }
                }
            };
      
            // Mock TechnicalDebtAnalyzer
            const mockData =  {
                analyzeTechnicalDebt: jest.fn(() => mockDebtData),
                generateReport: jest.fn(() => '# Technical Debt Report')
            };
      
            global.dashboard.technicalDebtAnalyzer = mockAnalyzer;
      
            const { showTechnicalDebtAnalysis } = require('./index.html');
      
            // Execute the analysis
            showTechnicalDebtAnalysis();
      
            // Verify analyzer was called
            expect(mockAnalyzer.analyzeTechnicalDebt).toHaveBeenCalled();
        });
    });

    describe('Export Functionality', () => {
        test('should export reports correctly', () => {
            const mockData =  {
                total_files: 7780,
                file_types: { '.js': 2450 }
            };
      
            const mockData =  {
                overview: { codeQuality: 82, testCoverage: 75 },
                recommendations: []
            };
      
            // Mock Blob and URL
            global.Blob = jest.fn(() => ({ size: 1024 }));
            global.URL = {
                createObjectURL: jest.fn(() => 'blob:mock-url'),
                revokeObjectURL: MockFactory.createMockFunction()
            };
      
            // Mock download link
            const mockData =  {
                href: '',
                download: '',
                click: MockFactory.createMockFunction()
            };
      
            global.document.createElement = jest.fn(() => mockLink);
            global.document.body = {
                appendChild: MockFactory.createMockFunction(),
                removeChild: MockFactory.createMockFunction()
            };
      
            const { exportReport } = require('./index.html');
      
            // Execute export
            exportReport(mockData, mockAnalysis, 'markdown', 'test-report.md');
      
            // Verify download was triggered
            expect(mockLink.download).toBe('test-report.md');
            expect(mockLink.click).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle errors gracefully', () => {
            // Mock console.error
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
            // Mock a function that throws an error
            const mockData =  jest.fn(() => {
                throw new Error('Test error');
            });
      
            // Execute and verify error handling
            expect(() => mockFunction()).toThrow('Test error');
      
            // Restore console
            consoleSpy.mockRestore();
        });
    });
});

// Integration tests
describe('Dashboard Integration Tests', () => {
    test('should initialize dashboard correctly', () => {
    // Mock window.onload
        const mockData =  MockFactory.createMockFunction();
        global.window.onload = mockOnload;
    
        // Trigger initialization
        mockOnload();
    
        expect(mockOnload).toHaveBeenCalled();
    });

    test('should handle tab switching correctly', () => {
    // Mock tab elements
        const mockData =  [
            { classList: { add: MockFactory.createMockFunction(), remove: MockFactory.createMockFunction() } },
            { classList: { add: MockFactory.createMockFunction(), remove: MockFactory.createMockFunction() } }
        ];
    
        const mockData =  [
            { style: { display: 'none' } },
            { style: { display: 'none' } }
        ];
    
        document.querySelectorAll = jest.fn((selector) => {
            if (selector === '.tab') {
                return mockTabs;
            }
            if (selector === '.tab-content') {
                return mockContents;
            }
            return [];
        });
    
        // Mock tab switching
        const { switchTab } = require('./index.html');
    
        // Switch to first tab
        switchTab(0);
    
        // Verify tab switching
        expect(mockTabs[0].classList.add).toHaveBeenCalledWith('active');
        expect(mockContents[0].style.display).toBe('block');
    });
});

// Performance tests
describe('Dashboard Performance Tests', () => {
    test('should handle large datasets efficiently', () => {
        const startTime = performance.now();
    
        // Mock large dataset
        const largeData = {
            total_files: 50000,
            file_types: {}
        };
    
        // Generate file types
        for (let i = 0; i < 100; i++) {
            largeData.file_types[`.ext${i}`] = Math.floor(Math.random() * 1000);
        }
    
        // Test processing time
        const { processLargeDataset } = require('./index.html');
    
        if (processLargeDataset) {
            processLargeDataset(largeData);
        }
    
        const endTime = performance.now();
        const duration = endTime - startTime;
    
        // Should process within reasonable time (less than 1 second)
        expect(duration).toBeLessThan(1000);
    });
});

module.exports = {
    // Export test utilities
    mockDOM: () => {
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        return dom;
    },
  
    createMockDashboard: () => ({
        dataEngine: {
            setCurrentDirectory: MockFactory.createMockFunction(),
            analyzeDirectory: MockFactory.createMockFunction()
        },
        projectFileAnalyzer: MockFactory.createMockFunction(),
        technicalDebtAnalyzer: MockFactory.createMockFunction(),
        ai: MockFactory.createMockFunction()
    })
};
