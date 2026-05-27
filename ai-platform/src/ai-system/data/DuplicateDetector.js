/**
 * Duplicate Data Detection and Removal System
 * 
 * Implements sophisticated duplicate detection algorithms for mock data,
 * including content-based, structure-based, and semantic duplicate detection
 * with automatic deduplication capabilities.
 */

const logger = require('../../lib/app-logger');

class DuplicateDetector {
  constructor(options = {}) {
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.contentThreshold = options.contentThreshold || 0.9;
    this.structureThreshold = options.structureThreshold || 0.8;
    this.enableSemanticDetection = options.enableSemanticDetection || true;
    this.cache = new Map();
    this.duplicateGroups = new Map();
    this.stats = {
      totalScanned: 0,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      processingTime: 0
    };
    
    logger.info('[DUPLICATE] Duplicate detector initialized');
  }

  // Main duplicate detection method
  async detectDuplicates(files) {
    const startTime = Date.now();
    const duplicates = [];
    
    logger.debug(`[DUPLICATE] Starting duplicate detection for ${files.length} files`);
    
    // Group files by type for more efficient processing
    const filesByType = this.groupFilesByType(files);
    
    for (const [fileType, typeFiles] of filesByType) {
      const typeDuplicates = await this.detectDuplicatesInType(typeFiles, fileType);
      duplicates.push(...typeDuplicates);
    }
    
    this.stats.totalScanned = files.length;
    this.stats.duplicatesFound = duplicates.length;
    this.stats.processingTime = Date.now() - startTime;
    
    logger.info(`[DUPLICATE] Detection complete: ${duplicates.length} duplicate groups found`);
    
    return {
      duplicates,
      stats: this.stats,
      summary: this.generateSummary(duplicates)
    };
  }

  // Group files by type for more efficient processing
  groupFilesByType(files) {
    const grouped = new Map();
    
    files.forEach(file => {
      const type = this.getFileType(file);
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type).push(file);
    });
    
    return grouped;
  }

  // Detect duplicates within files of the same type
  async detectDuplicatesInType(files, fileType) {
    const duplicates = [];
    const processed = new Set();
    
    for (let i = 0; i < files.length; i++) {
      if (processed.has(i)) continue;
      
      const currentFile = files[i];
      const duplicateGroup = [currentFile];
      
      for (let j = i + 1; j < files.length; j++) {
        if (processed.has(j)) continue;
        
        const compareFile = files[j];
        const similarity = await this.calculateSimilarity(currentFile, compareFile, fileType);
        
        if (similarity >= this.similarityThreshold) {
          duplicateGroup.push(compareFile);
          processed.add(j);
        }
      }
      
      if (duplicateGroup.length > 1) {
        duplicates.push({
          type: fileType,
          files: duplicateGroup,
          similarity: this.calculateGroupSimilarity(duplicateGroup),
          recommended: duplicateGroup[0], // Keep first file as master
          duplicates: duplicateGroup.slice(1) // Files to remove
        });
        
        duplicateGroup.forEach((_, index) => processed.add(i + index));
      }
      
      processed.add(i);
    }
    
    return duplicates;
  }

  // Calculate similarity between two files
  async calculateSimilarity(file1, file2, fileType) {
    const cacheKey = this.generateCacheKey(file1, file2);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    let similarity = 0;
    
    switch (fileType) {
      case 'json':
        similarity = this.calculateJSONSimilarity(file1, file2);
        break;
      case 'csv':
        similarity = this.calculateCSVSimilarity(file1, file2);
        break;
      case 'xml':
        similarity = this.calculateXMLSimilarity(file1, file2);
        break;
      case 'html':
        similarity = this.calculateHTMLSimilarity(file1, file2);
        break;
      case 'txt':
        similarity = this.calculateTextSimilarity(file1, file2);
        break;
      case 'js':
        similarity = this.calculateJavaScriptSimilarity(file1, file2);
        break;
      default:
        similarity = this.calculateGenericSimilarity(file1, file2);
    }
    
    this.cache.set(cacheKey, similarity);
    return similarity;
  }

  // JSON similarity calculation
  calculateJSONSimilarity(file1, file2) {
    try {
      const data1 = typeof file1.content === 'string' ? JSON.parse(file1.content) : file1.content;
      const data2 = typeof file2.content === 'string' ? JSON.parse(file2.content) : file2.content;
      
      // Structure similarity
      const structureSim = this.calculateStructureSimilarity(data1, data2);
      
      // Content similarity
      const contentSim = this.calculateContentSimilarity(data1, data2);
      
      // Weighted combination
      return (structureSim * 0.3 + contentSim * 0.7);
      
    } catch (error) {
      console.warn('[DUPLICATE] JSON parsing error:', error.message);
      return this.calculateTextSimilarity(file1, file2);
    }
  }

  // CSV similarity calculation
  calculateCSVSimilarity(file1, file2) {
    const rows1 = this.parseCSV(file1.content);
    const rows2 = this.parseCSV(file2.content);
    
    if (rows1.length === 0 || rows2.length === 0) return 0;
    
    // Header similarity
    const headerSim = this.calculateArraySimilarity(rows1[0], rows2[0]);
    
    // Content similarity (sample rows)
    const sampleSize = Math.min(10, rows1.length, rows2.length);
    let contentSim = 0;
    
    for (let i = 1; i < sampleSize; i++) {
      contentSim += this.calculateArraySimilarity(rows1[i], rows2[i]);
    }
    
    contentSim /= (sampleSize - 1);
    
    return (headerSim * 0.4 + contentSim * 0.6);
  }

  // XML similarity calculation
  calculateXMLSimilarity(file1, file2) {
    // Simple XML similarity based on structure and content
    const structure1 = this.extractXMLStructure(file1.content);
    const structure2 = this.extractXMLStructure(file2.content);
    
    const structureSim = this.calculateStructureSimilarity(structure1, structure2);
    const contentSim = this.calculateTextSimilarity(file1, file2);
    
    return (structureSim * 0.5 + contentSim * 0.5);
  }

  // HTML similarity calculation
  calculateHTMLSimilarity(file1, file2) {
    // Extract text content and structure
    const text1 = this.extractTextFromHTML(file1.content);
    const text2 = this.extractTextFromHTML(file2.content);
    
    const structure1 = this.extractHTMLStructure(file1.content);
    const structure2 = this.extractHTMLStructure(file2.content);
    
    const textSim = this.calculateTextSimilarity({ content: text1 }, { content: text2 });
    const structureSim = this.calculateStructureSimilarity(structure1, structure2);
    
    return (textSim * 0.6 + structureSim * 0.4);
  }

  // Text similarity calculation
  calculateTextSimilarity(file1, file2) {
    const text1 = file1.content.toLowerCase().trim();
    const text2 = file2.content.toLowerCase().trim();
    
    // Simple similarity based on common substrings
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1;
    
    // Calculate Jaccard similarity
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // JavaScript similarity calculation
  calculateJavaScriptSimilarity(file1, file2) {
    // Extract function signatures and structure
    const structure1 = this.extractJavaScriptStructure(file1.content);
    const structure2 = this.extractJavaScriptStructure(file2.content);
    
    const structureSim = this.calculateStructureSimilarity(structure1, structure2);
    const textSim = this.calculateTextSimilarity(file1, file2);
    
    return (structureSim * 0.6 + textSim * 0.4);
  }

  // Generic similarity calculation
  calculateGenericSimilarity(file1, file2) {
    return this.calculateTextSimilarity(file1, file2);
  }

  // Calculate structure similarity
  calculateStructureSimilarity(obj1, obj2) {
    const keys1 = Object.keys(obj1).sort();
    const keys2 = Object.keys(obj2).sort();
    
    if (keys1.length === 0 && keys2.length === 0) return 1;
    if (keys1.length === 0 || keys2.length === 0) return 0;
    
    const intersection = keys1.filter(key => keys2.includes(key));
    const union = [...new Set([...keys1, ...keys2])];
    
    return intersection.length / union.length;
  }

  // Calculate content similarity
  calculateContentSimilarity(obj1, obj2) {
    let matches = 0;
    let total = 0;
    
    const keys = [...new Set([...Object.keys(obj1), ...Object.keys(obj2)])];
    
    for (const key of keys) {
      if (obj1.hasOwnProperty(key) && obj2.hasOwnProperty(key)) {
        const val1 = obj1[key];
        const val2 = obj2[key];
        
        if (typeof val1 === typeof val2) {
          if (typeof val1 === 'object' && val1 !== null) {
            matches += this.calculateContentSimilarity(val1, val2);
          } else if (val1 === val2) {
            matches += 1;
          } else {
            // Partial match for strings
            if (typeof val1 === 'string' && typeof val2 === 'string') {
              matches += this.calculateStringSimilarity(val1, val2);
            }
          }
        }
        total += 1;
      } else {
        total += 1;
      }
    }
    
    return total > 0 ? matches / total : 0;
  }

  // Calculate array similarity
  calculateArraySimilarity(arr1, arr2) {
    if (arr1.length === 0 && arr2.length === 0) return 1;
    if (arr1.length === 0 || arr2.length === 0) return 0;
    
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // Calculate string similarity
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    // Levenshtein distance
    const distance = this.calculateLevenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  // Calculate Levenshtein distance
  calculateLevenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Helper methods for parsing different formats
  parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => line.split(',').map(cell => cell.trim()));
  }

  extractXMLStructure(content) {
    // Simple XML structure extraction
    const tags = content.match(/<(\w+)[^>]*>/g) || [];
    return tags.map(tag => tag.replace(/[<>]/g, '').split(' ')[0]);
  }

  extractTextFromHTML(content) {
    // Remove HTML tags and extract text
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  extractHTMLStructure(content) {
    // Extract HTML structure (tags)
    const tags = content.match(/<(\w+)[^>]*>/g) || [];
    return tags.map(tag => tag.replace(/[<>]/g, '').split(' ')[0]);
  }

  extractJavaScriptStructure(content) {
    // Extract JavaScript structure (functions, variables, etc.)
    const functions = content.match(/function\s+(\w+)/g) || [];
    const variables = content.match(/(?:const|let|var)\s+(\w+)/g) || [];
    
    return {
      functions: functions.map(f => f.split(' ')[1]),
      variables: variables.map(v => v.split(' ')[1])
    };
  }

  // Calculate group similarity
  calculateGroupSimilarity(files) {
    if (files.length <= 1) return 1;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        totalSimilarity += this.calculateTextSimilarity(files[i], files[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  // Generate cache key
  generateCacheKey(file1, file2) {
    const hash1 = this.hashString(file1.content);
    const hash2 = this.hashString(file2.content);
    return `${hash1}_${hash2}`;
  }

  // Simple hash function
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Get file type
  getFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    return extension || 'unknown';
  }

  // Generate summary
  generateSummary(duplicates) {
    const summary = {
      totalGroups: duplicates.length,
      totalDuplicates: duplicates.reduce((sum, group) => sum + group.duplicates.length, 0),
      filesByType: {},
      averageSimilarity: 0,
      spaceSaved: 0
    };

    duplicates.forEach(group => {
      if (!summary.filesByType[group.type]) {
        summary.filesByType[group.type] = { groups: 0, duplicates: 0 };
      }
      summary.filesByType[group.type].groups++;
      summary.filesByType[group.type].duplicates += group.duplicates.length;
      
      summary.averageSimilarity += group.similarity;
      
      // Calculate space saved (rough estimate)
      group.duplicates.forEach(file => {
        summary.spaceSaved += file.size || 1000; // Default 1KB if size unknown
      });
    });

    if (duplicates.length > 0) {
      summary.averageSimilarity /= duplicates.length;
    }

    return summary;
  }

  // Remove duplicates
  async removeDuplicates(duplicates, options = {}) {
    const { dryRun = false, backup = true } = options;
    const results = [];
    
    logger.debug(`[DUPLICATE] Starting duplicate removal (${dryRun ? 'dry run' : 'actual'})`);
    
    for (const group of duplicates) {
      const result = {
        type: group.type,
        masterFile: group.recommended.name,
        duplicatesRemoved: [],
        spaceSaved: 0,
        success: false
      };
      
      try {
        if (!dryRun) {
          if (backup) {
            await this.backupFiles(group.duplicates);
          }
          
          // Remove duplicate files
          for (const duplicate of group.duplicates) {
            await this.removeFile(duplicate);
            result.duplicatesRemoved.push(duplicate.name);
            result.spaceSaved += duplicate.size || 1000;
          }
        } else {
          // Dry run - just simulate
          result.duplicatesRemoved = group.duplicates.map(f => f.name);
          result.spaceSaved = group.duplicates.reduce((sum, f) => sum + (f.size || 1000), 0);
        }
        
        result.success = true;
        this.stats.duplicatesRemoved += group.duplicates.length;
        
      } catch (error) {
        console.error(`[DUPLICATE] Error removing duplicates for ${group.type}:`, error.message);
        result.error = error.message;
      }
      
      results.push(result);
    }
    
    logger.info(`[DUPLICATE] Removal complete: ${this.stats.duplicatesRemoved} files removed`);
    
    return {
      results,
      stats: this.stats,
      summary: this.generateRemovalSummary(results)
    };
  }

  // Backup files before removal
  async backupFiles(files) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const backupDir = path.join(process.cwd(), 'backups', 'duplicates', Date.now().toString());
    await fs.mkdir(backupDir, { recursive: true });
    
    for (const file of files) {
      const backupPath = path.join(backupDir, file.name);
      await fs.writeFile(backupPath, file.content);
    }
    
    return backupDir;
  }

  // Remove file
  async removeFile(file) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const filePath = path.join(process.cwd(), file.path);
    await fs.unlink(filePath);
  }

  // Generate removal summary
  generateRemovalSummary(results) {
    return {
      totalGroupsProcessed: results.length,
      successfulGroups: results.filter(r => r.success).length,
      failedGroups: results.filter(r => !r.success).length,
      totalFilesRemoved: results.reduce((sum, r) => sum + r.duplicatesRemoved.length, 0),
      totalSpaceSaved: results.reduce((sum, r) => sum + r.spaceSaved, 0),
      spaceSavedFormatted: this.formatBytes(results.reduce((sum, r) => sum + r.spaceSaved, 0))
    };
  }

  // Format bytes
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get statistics
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      duplicateGroups: this.duplicateGroups.size
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    logger.debug('[DUPLICATE] Cache cleared');
  }

  // Reset statistics
  resetStats() {
    this.stats = {
      totalScanned: 0,
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      processingTime: 0
    };
  }
}

module.exports = DuplicateDetector;
