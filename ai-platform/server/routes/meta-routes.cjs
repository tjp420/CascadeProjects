// simplebeacon-ignore: debugArtifacts
// simplebeacon-ignore sync-io
const express = require('express');
const path = require('path');
const fs = require('fs');
const { contentNeedsValidation } = require('../lib/file-quality-heuristics.cjs');

const router = express.Router();

// Preload package.json at startup to avoid sync reads in route handlers
const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
let cachedPackageJson = null;
try {
  cachedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch {
  cachedPackageJson = { version: '1.0.0' };
}

function getPackageJson() {
  return cachedPackageJson;
}

function getFileType(filename, content) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.js' || ext === '.py') return content.includes('test') ? 'test' : 'development';
  if (ext === '.html') return 'web';
  if (ext === '.md') return 'documentation';
  if (ext === '.json' || ext === '.yaml' || ext === '.yml') return 'configuration';
  return 'other';
}

function analyzeFileStatus(content, _filename) {
  if (contentNeedsValidation(content)) return 'planned';
  if (content.includes('// IN PROGRESS') || content.includes('# IN PROGRESS')) return 'in-progress';
  if (content.includes('// COMPLETED') || content.includes('# COMPLETED')) return 'completed';
  return 'planned';
}

function estimateWork(line) {
  if (line.includes('small') || line.includes('quick')) return '1 day';
  if (line.includes('medium')) return '3 days';
  if (line.includes('large') || line.includes('complex')) return '1 week';
  return 'Unestimated';
}

// Real Project Structure API
router.get('/project-structure', async (req, res) => {
  try {
    const fsPromises = require('fs').promises;
    const pathUtil = require('path');
    const projectPath = pathUtil.join(__dirname, '..', '..');
    const files = {};

    const scanDirectory = async (dirPath, basePath = '') => {
      const items = await fsPromises.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        const itemPath = pathUtil.join(dirPath, item.name);
        const relativePath = pathUtil.join(basePath, item.name);
        if (item.isDirectory()) {
          await scanDirectory(itemPath, relativePath);
        } else {
          const content = await fsPromises.readFile(itemPath, 'utf8');
          const status = analyzeFileStatus(content, item.name);
          files[relativePath] = {
            type: getFileType(item.name, content),
            status,
            lastModified: item.mtime,
            size: item.size
          };
        }
      }
    };

    await scanDirectory(projectPath);
    res.json({ files });
  } catch (error) {
    console.error('Project structure scan error:', error);
    res.status(500).json({ error: 'Failed to scan project structure' });
  }
});

// Releases API
router.get('/releases', (req, res) => {
  try {
    const packageJson = getPackageJson();
    const releases = [
      {
        version: packageJson.version || '2.0.0',
        name: 'Current Release',
        description: 'AI Data Processing Platform with technical debt management',
        date: new Date().toISOString().split('T')[0],
        status: 'released'
      },
      {
        version: '2.1.0',
        name: 'Enhanced Analytics',
        description: 'Enhanced analytics and reporting features with mock data analyzer',
        date: '2026-06-15',
        status: 'upcoming'
      },
      {
        version: '2.2.0',
        name: 'Mobile & Performance',
        description: 'Mobile interface and performance improvements',
        date: '2026-08-01',
        status: 'planned'
      }
    ];
    res.json(releases);
  } catch (error) {
    console.error('Releases analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze releases' });
  }
});

// Feature Backlog API
router.get('/backlog', async (req, res) => {
  try {
    const fsPromises = require('fs').promises;
    const pathUtil = require('path');
    const projectPath = pathUtil.join(__dirname, '..', '..');
    const backlog = [];

    const scanForBacklogItems = async (dirPath) => {
      const items = await fsPromises.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        const itemPath = pathUtil.join(dirPath, item.name);
        if (item.isDirectory()) {
          await scanForBacklogItems(itemPath);
        } else if (item.name.match(/\.(js|py|html|md|json|yml|txt)$/i)) {
          try {
            const content = await fsPromises.readFile(itemPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|NOTE)/i)) {
                backlog.push({
                  title: line.split(/\s+/).slice(1).join(' ').substring(0, 50),
                  file: item.name,
                  line: index + 1,
                  priority: line.includes('TODO') ? 'medium' : line.includes('FIXME') ? 'high' : 'low',
                  status: 'planned',
                  estimate: estimateWork(line)
                });
              }
            });
          } catch {
            // Skip files that can't be read
          }
        }
      }
    };

    await scanForBacklogItems(projectPath);
    res.json(backlog);
  } catch (error) {
    console.error('Backlog scan error:', error);
    res.status(500).json({ error: 'Failed to scan backlog' });
  }
});

module.exports = router;
