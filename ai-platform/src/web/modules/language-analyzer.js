/**
 * Language Analyzer Module
 * Provides programming language-specific pattern detection and analysis
 */

/**
 * Language-specific mock data patterns
 */
export const LANGUAGE_PATTERNS = {
    // JavaScript/TypeScript patterns
    javascript: {
        patterns: [
            {
                pattern: 'jest\.fn\(\)|jest\\.spyOn\\(',
                confidence: 0.95,
                category: 'jest_mocks',
                description: 'Jest mock functions',
                language: 'javascript'
            },
            {
                pattern: 'sinon\.stub\(\)|sinon\\.spyOn\\(',
                confidence: 0.95,
                category: 'sinon_mocks',
                description: 'Sinon test doubles',
                language: 'javascript'
            },
            {
                pattern: 'mockImplementation\\(|mockReturnValue\\(',
                confidence: 0.9,
                category: 'mock_implementations',
                description: 'Mock implementation methods',
                language: 'javascript'
            },
            {
                pattern: 'describe\\([\'"]mock|it\\([\'"]mock|test\\([\'"]mock',
                confidence: 0.8,
                category: 'test_descriptions',
                description: 'Test descriptions mentioning mocks',
                language: 'javascript'
            },
            {
                pattern: 'beforeEach\\(.*jest\\.clearAllMocks',
                confidence: 0.85,
                category: 'mock_setup',
                description: 'Mock setup in test hooks',
                language: 'javascript'
            }
        ]
    },
    
    // Python patterns
    python: {
        patterns: [
            {
                pattern: '@patch\\(|@mock\\.patch\\(',
                confidence: 0.95,
                category: 'python_patches',
                description: 'Python mock patch decorators',
                language: 'python'
            },
            {
                pattern: 'Mock\(\)|MagicMock\(\)|PropertyMock\\(',
                confidence: 0.9,
                category: 'python_mock_objects',
                description: 'Python mock objects',
                language: 'python'
            },
            {
                pattern: 'unittest\\.mock|mock\\.patch',
                confidence: 0.9,
                category: 'python_unittest_mocks',
                description: 'Python unittest mocking',
                language: 'python'
            },
            {
                pattern: 'return_value\\.|side_effect\\.',
                confidence: 0.85,
                category: 'mock_configurations',
                description: 'Mock return value configuration',
                language: 'python'
            },
            {
                pattern: 'assert_called_with\\(|assert_called_once\\(',
                confidence: 0.8,
                category: 'mock_assertions',
                description: 'Mock assertion methods',
                language: 'python'
            }
        ]
    },
    
    // Java patterns
    java: {
        patterns: [
            {
                pattern: '@Mock\\(|@InjectMocks',
                confidence: 0.95,
                category: 'java_mock_annotations',
                description: 'Mockito mock annotations',
                language: 'java'
            },
            {
                pattern: 'Mockito\\.mock\\(|Mockito\\.spy\\(',
                confidence: 0.9,
                category: 'mockito_mocks',
                description: 'Mockito mock creation',
                language: 'java'
            },
            {
                pattern: 'when\(.*)\.thenReturn\\(|when\(.*)\.thenThrow\\(',
                confidence: 0.9,
                category: 'mockito_stubbing',
                description: 'Mockito when-thenReturn patterns',
                language: 'java'
            },
            {
                pattern: 'verify\(.*)\.times\(.*\)|verify\(.*)\.never\(\)',
                confidence: 0.85,
                category: 'mockito_verification',
                description: 'Mockito verification patterns',
                language: 'java'
            },
            {
                pattern: '@RunWith\(MockitoJUnitRunner\.class\)',
                confidence: 0.9,
                category: 'java_test_runners',
                description: 'Mockito JUnit runner',
                language: 'java'
            }
        ]
    },
    
    // C# patterns
    csharp: {
        patterns: [
            {
                pattern: 'Mock<\\w+>\\(|new Mock<',
                confidence: 0.95,
                category: 'csharp_moq_mocks',
                description: 'Moq mock objects',
                language: 'csharp'
            },
            {
                pattern: '\\.Setup\(.*)\.Returns',
                confidence: 0.9,
                category: 'moq_setup',
                description: 'Moq setup patterns',
                language: 'csharp'
            },
            {
                pattern: '\\.Verify\(.*)|\\.VerifyAll\\(',
                confidence: 0.85,
                category: 'moq_verification',
                description: 'Moq verification patterns',
                language: 'csharp'
            },
            {
                pattern: 'It\\.Is<\\w+>\(|It\\.IsAny<\\w+>\)',
                confidence: 0.8,
                category: 'moq_matchers',
                description: 'Moq argument matchers',
                language: 'csharp'
            }
        ]
    },
    
    // Ruby patterns
    ruby: {
        patterns: [
            {
                pattern: 'allow\\(.*\\)\\.to receive\\(',
                confidence: 0.95,
                category: 'rspec_mocks',
                description: 'RSpec allow-receive patterns',
                language: 'ruby'
            },
            {
                pattern: 'double\\(|instance_double\\(|class_double\\(',
                confidence: 0.9,
                category: 'rspec_doubles',
                description: 'RSpec test doubles',
                language: 'ruby'
            },
            {
                pattern: 'and_return\\(|and_raise\\(',
                confidence: 0.85,
                category: 'rspec_stubbing',
                description: 'RSpec stub return values',
                language: 'ruby'
            },
            {
                pattern: 'have_received\\(|have_been_made',
                confidence: 0.8,
                category: 'rspec_verification',
                description: 'RSpec message expectations',
                language: 'ruby'
            }
        ]
    },
    
    // PHP patterns
    php: {
        patterns: [
            {
                pattern: '\\$this->createMock\\(|\\$this->getMockBuilder\\(',
                confidence: 0.95,
                category: 'php_unit_mocks',
                description: 'PHPUnit mock creation',
                language: 'php'
            },
            {
                pattern: '->expects\\(\\$this->once\\(\\)\\)|->expects\\(\\$this->any\\(\\)\\)',
                confidence: 0.9,
                category: 'php_expectations',
                description: 'PHPUnit expectation setup',
                language: 'php'
            },
            {
                pattern: '->method\\([\'"][^\'"]+[\'"]\\)->will\\(',
                confidence: 0.85,
                category: 'php_method_stubbing',
                description: 'PHPUnit method stubbing',
                language: 'php'
            },
            {
                pattern: '->willReturn\\(|->willThrowException\\(',
                confidence: 0.85,
                category: 'php_return_values',
                description: 'PHPUnit return value configuration',
                language: 'php'
            }
        ]
    },
    
    // Go patterns
    go: {
        patterns: [
            {
                pattern: 'gomock\\.NewController\\(',
                confidence: 0.95,
                category: 'go_gomock',
                description: 'GoMock controller creation',
                language: 'go'
            },
            {
                pattern: 'NewMockInterface\\(|EXPECT\\(',
                confidence: 0.9,
                category: 'go_mock_interfaces',
                description: 'GoMock interface mocks',
                language: 'go'
            },
            {
                pattern: '\\.Return\\(|\\.Set\\(',
                confidence: 0.85,
                category: 'go_mock_setup',
                description: 'GoMock setup methods',
                language: 'go'
            },
            {
                pattern: 'testify\\.mock|mock\\.New\\(',
                confidence: 0.9,
                category: 'go_testify_mocks',
                description: 'Testify mocking framework',
                language: 'go'
            }
        ]
    }
};

/**
 * Language detection utilities
 */
export class LanguageDetector {
    /**
     * Detect programming language from file path and content
     */
    static detectLanguage(filePath, content) {
        const extension = filePath.split('.').pop().toLowerCase();
        const filename = filePath.split('/').pop().toLowerCase();
        const firstLine = content.split('\n')[0].trim();
        
        // File extension mapping
        const extensionMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'javascript',
            'tsx': 'javascript',
            'mjs': 'javascript',
            'cjs': 'javascript',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php',
            'go': 'go',
            'scala': 'scala',
            'kt': 'kotlin',
            'swift': 'swift',
            'rs': 'rust',
            'cpp': 'cpp',
            'c': 'c',
            'h': 'c',
            'hpp': 'cpp'
        };
        
        // Check extension first
        if (extensionMap[extension]) {
            return extensionMap[extension];
        }
        
        // Check filename patterns
        if (filename.includes('package.json') || filename.includes('yarn.lock')) {
            return 'javascript';
        }
        
        if (filename.includes('requirements.txt') || filename.includes('setup.py')) {
            return 'python';
        }
        
        if (filename.includes('pom.xml') || filename.includes('build.gradle')) {
            return 'java';
        }
        
        if (filename.includes('composer.json')) {
            return 'php';
        }
        
        if (filename.includes('go.mod') || filename.includes('go.sum')) {
            return 'go';
        }
        
        // Check content patterns
        if (firstLine.startsWith('#!/usr/bin/env python') || firstLine.startsWith('#!/usr/bin/python')) {
            return 'python';
        }
        
        if (firstLine.includes('package ') && firstLine.includes(';')) {
            return 'java';
        }
        
        if (firstLine.includes('using ') && firstLine.includes(';')) {
            return 'csharp';
        }
        
        if (firstLine.includes('package main') || firstLine.includes('import ')) {
            return 'go';
        }
        
        // Default based on common patterns
        if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
            return 'javascript';
        }
        
        if (content.includes('def ') || content.includes('import ')) {
            return 'python';
        }
        
        if (content.includes('public class ') || content.includes('import java.')) {
            return 'java';
        }
        
        return 'unknown';
    }
    
    /**
     * Get language-specific patterns
     */
    static getPatternsForLanguage(language) {
        return LANGUAGE_PATTERNS[language] || { patterns: [] };
    }
    
    /**
     * Get all available languages
     */
    static getSupportedLanguages() {
        return Object.keys(LANGUAGE_PATTERNS);
    }
}

/**
 * Code structure analyzer
 */
export class CodeStructureAnalyzer {
    /**
     * Analyze code structure for context
     */
    static analyzeStructure(content, language) {
        const structure = {
            imports: this.extractImports(content, language),
            functions: this.extractFunctions(content, language),
            classes: this.extractClasses(content, language),
            variables: this.extractVariables(content, language),
            comments: this.extractComments(content, language),
            strings: this.extractStrings(content, language)
        };
        
        return structure;
    }
    
    /**
     * Extract import statements
     */
    static extractImports(content, language) {
        const imports = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            line = line.trim();
            
            switch (language) {
            case 'javascript':
                if (line.startsWith('import ') || line.startsWith('const ') && line.includes('require(')) {
                    imports.push({ line: index + 1, content: line, type: 'import' });
                }
                break;
            case 'python':
                if (line.startsWith('import ') || line.startsWith('from ')) {
                    imports.push({ line: index + 1, content: line, type: 'import' });
                }
                break;
            case 'java':
                if (line.startsWith('import ') || line.startsWith('package ')) {
                    imports.push({ line: index + 1, content: line, type: 'import' });
                }
                break;
            case 'csharp':
                if (line.startsWith('using ')) {
                    imports.push({ line: index + 1, content: line, type: 'import' });
                }
                break;
            case 'go':
                if (line.startsWith('import ') || line.startsWith('package ')) {
                    imports.push({ line: index + 1, content: line, type: 'import' });
                }
                break;
            }
        });
        
        return imports;
    }
    
    /**
     * Extract function definitions
     */
    static extractFunctions(content, language) {
        const functions = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            line = line.trim();
            
            switch (language) {
            case 'javascript':
                if (line.match(/^(async\s+)?function\s+\w+|^(const|let)\s+\w+\s*=\s*(async\s+)?\(/)) {
                    functions.push({ line: index + 1, content: line, type: 'function' });
                }
                break;
            case 'python':
                if (line.startsWith('def ')) {
                    functions.push({ line: index + 1, content: line, type: 'function' });
                }
                break;
            case 'java':
            case 'csharp':
                if (line.match(/^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/)) {
                    functions.push({ line: index + 1, content: line, type: 'function' });
                }
                break;
            case 'go':
                if (line.startsWith('func ')) {
                    functions.push({ line: index + 1, content: line, type: 'function' });
                }
                break;
            }
        });
        
        return functions;
    }
    
    /**
     * Extract class definitions
     */
    static extractClasses(content, language) {
        const classes = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            line = line.trim();
            
            switch (language) {
            case 'javascript':
                if (line.startsWith('class ')) {
                    classes.push({ line: index + 1, content: line, type: 'class' });
                }
                break;
            case 'python':
                if (line.startsWith('class ')) {
                    classes.push({ line: index + 1, content: line, type: 'class' });
                }
                break;
            case 'java':
            case 'csharp':
                if (line.match(/^(public|private|protected)?\s*(abstract\s+)?class\s+\w+/)) {
                    classes.push({ line: index + 1, content: line, type: 'class' });
                }
                break;
            case 'go':
                if (line.startsWith('type ') && line.includes(' struct ')) {
                    classes.push({ line: index + 1, content: line, type: 'struct' });
                }
                break;
            }
        });
        
        return classes;
    }
    
    /**
     * Extract variable declarations
     */
    static extractVariables(content, language) {
        const variables = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            line = line.trim();
            
            switch (language) {
            case 'javascript':
                if (line.match(/^(const|let|var)\s+\w+\s*=/)) {
                    variables.push({ line: index + 1, content: line, type: 'variable' });
                }
                break;
            case 'python':
                if (line.match(/^\w+\s*=/) && !line.startsWith('def ') && !line.startsWith('class ')) {
                    variables.push({ line: index + 1, content: line, type: 'variable' });
                }
                break;
            case 'java':
            case 'csharp':
                if (line.match(/^(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*=/)) {
                    variables.push({ line: index + 1, content: line, type: 'variable' });
                }
                break;
            case 'go':
                if (line.match(/^var\s+\w+\s+\w+/) || line.match(/^\w+\s*:=\s*/)) {
                    variables.push({ line: index + 1, content: line, type: 'variable' });
                }
                break;
            }
        });
        
        return variables;
    }
    
    /**
     * Extract comments
     */
    static extractComments(content, language) {
        const comments = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            switch (language) {
            case 'javascript':
            case 'java':
            case 'csharp':
            case 'go':
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    comments.push({ line: index + 1, content: line, type: 'comment' });
                }
                break;
            case 'python':
            case 'ruby':
                if (trimmed.startsWith('#')) {
                    comments.push({ line: index + 1, content: line, type: 'comment' });
                }
                break;
            }
        });
        
        return comments;
    }
    
    /**
     * Extract string literals
     */
    static extractStrings(content, language) {
        const strings = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Simple regex to match string literals
            const stringMatches = line.match(/(['"`])((?:(?!\1)[^\\]|\\.)*)(\1)/g);
            
            if (stringMatches) {
                stringMatches.forEach(str => {
                    strings.push({ line: index + 1, content: str, type: 'string' });
                });
            }
        });
        
        return strings;
    }
}

/**
 * Get all language patterns
 */
export function getAllLanguagePatterns() {
    const allPatterns = {};
    
    Object.entries(LANGUAGE_PATTERNS).forEach(([language, patterns]) => {
        allPatterns[language] = patterns;
    });
    
    return allPatterns;
}

/**
 * Get patterns for multiple languages
 */
export function getPatternsForLanguages(languages) {
    const patterns = {};
    
    languages.forEach(language => {
        const langPatterns = LanguageDetector.getPatternsForLanguage(language);
        if (langPatterns.patterns.length > 0) {
            patterns[language] = langPatterns;
        }
    });
    
    return patterns;
}

export default {
    LANGUAGE_PATTERNS,
    LanguageDetector,
    CodeStructureAnalyzer,
    getAllLanguagePatterns,
    getPatternsForLanguages
};
