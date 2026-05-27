{
  "name": "enhanced-directory-analyzer",
  "displayName": "Enhanced Directory Analyzer",
  "description": "Advanced code analysis and auto-fix integration",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Other",
    "Linters"
  ],
  "activationEvents": [
    "onCommand:enhanced-analyzer.analyzeDirectory",
    "onCommand:enhanced-analyzer.fixIssues",
    "workspaceContains:**/*.{py,js,html,css,json,md}"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "enhanced-analyzer.analyzeDirectory",
        "title": "Analyze Directory",
        "category": "Enhanced Analyzer"
      },
      {
        "command": "enhanced-analyzer.fixIssues",
        "title": "Fix Issues",
        "category": "Enhanced Analyzer"
      },
      {
        "command": "enhanced-analyzer.showReport",
        "title": "Show Analysis Report",
        "category": "Enhanced Analyzer"
      }
    ],
    "views": {
      "explorer": [
        {
          "id": "enhancedAnalyzerIssues",
          "name": "Analysis Issues",
          "when": "enhanced-analyzer:hasIssues"
        }
      ]
    },
    "diagnostics": [
      {
        "language": "python",
        "source": "enhanced-analyzer"
      },
      {
        "language": "javascript",
        "source": "enhanced-analyzer"
      },
      {
        "language": "html",
        "source": "enhanced-analyzer"
      }
    ],
    "configuration": {
      "title": "Enhanced Directory Analyzer",
      "properties": {
        "enhancedAnalyzer.autoAnalyze": {
          "type": "boolean",
          "default": true,
          "description": "Automatically analyze files on save"
        },
        "enhancedAnalyzer.serverPort": {
          "type": "number",
          "default": 9000,
          "description": "Port for the analyzer web server"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "typescript": "^4.9.4"
  },
  "dependencies": {
    "axios": "^1.3.0",
    "ws": "^8.12.0"
  }
}
