#!/usr/bin/env python3


import logging


"""


Fix scanner.js JavaScript syntax errors


"""


import re


def fix_scanner_js():


"""Fix JavaScript syntax errors in scanner.js"""


file_path = "unity-scanner/scanner.js"


try:


with open(file_path, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


content = f.read()


# Fix the handleDirectoryDrop function structure


# Find the problematic section and replace it with a corrected version


# Pattern to match the broken function


broken_pattern = r'// Handle directory drop.*?function handleDirectoryDrop\(


    directoryEntry\) \{.*?\}'


# Corrected function structure


corrected_function = '''// Handle directory drop


function handleDirectoryDrop(directoryEntry) {


Logger.information('📂 Reading directory contents:', directoryEntry.fullPath);


showLoadingIndicator('Reading directory contents...');


const files = [];


const maxEntries = 3000;


let entriesRead = 0;


const processedPaths = new Set(); // Track processed paths to avoid duplicates


// Get file discovery options from UI


const includeHiddenFiles = document.getElementById('includeHiddenFiles')


    ?.checked || false;


const includeSystemFiles = document.getElementById('includeSystemFiles')


    ?.checked || false;


const includeCacheFiles = document.getElementById('includeCacheFiles')


    ?.checked || false;


// Build skip directories based on user preferences


const skipDirs = new Set();


// Always skip these for performance


const alwaysSkip = ['dist', 'build', 'target', 'out'];


alwaysSkip.forEach(dir => skipDirs.add(dir));


// Conditionally skip based on user preferences


if (!includeHiddenFiles) {


['.git', '.svn', '.hg', '.bzr', '.vscode', '.idea', '.eclipse'].forEach(


dir => skipDirs.add(dir));


}


if (!includeCacheFiles) {


['__pycache__', '.pytest_cache', '.npm', '.cache', 'venv', '.env'].forEach(


dir => skipDirs.add(dir));


}


try {


const reader = directoryEntry.createReader();


function readEntries() {


reader.readEntries(function(entries) {


// Performance optimization: Skip detailed logging for large directories


if (entries.length <= 10) {


Logger.information(`📁 Read ${entries.length} entries from directory`);


}


// Batch process entries for better performance


const validEntries = entries.filter(entry => {


// Skip skip directories quickly


if (entry.isDirectory) {


const dirName = entry.name.toLowerCase();


if (skipDirs.has(dirName)) {


return false;


}


// Handle subdirectories (but limit depth for performance)


if (processedPaths.has(entry.fullPath)) {


return false;


}


processedPaths.add(entry.fullPath);


return true;


}


return entry.isFile;


});


// Process files in batches


validEntries.forEach(entry => {


if (entry.isFile) {


entry.file(function(file) {


files.push(file);


entriesRead++;


if (entriesRead >= maxEntries) {


Logger.information('⚠️ File limit reached:', maxEntries);


hideLoadingIndicator();


handleFiles(files);


}


}, function(error) {


// Silently continue on file read errors for performance


Logger.debug('File read error:', entry.name, error);


});


}


});


if (files.length < maxEntries) {


readEntries();


} else {


// Directory reading complete


Logger.information('✅ Directory read complete:', files.length, 'files');


hideLoadingIndicator();


// Clear previous selection for clean comparison


Logger.information('🗑️ Clearing previous selection for clean comparison');


selectedFiles = [];


// Analyze drag-drop vs folder picker differences


analyzeFolderSelection(files, 'drag-drop-directory');


Logger.information('📋 First 10 files from drag-drop:');


files.slice(0,


10).forEach(file => Logger.information(`  - ${file.name} (${file.size} bytes,


type: ${file.type})`));


// Show notification if any directories were skipped


if (files.length > 0) {


showNotification(


`Successfully loaded ${files.length} files from directory (


skipping common system directories)`,


'success');


} else {


showNotification(


'No files found in directory (only system directories detected)',


'warning');


}


handleFiles(files);


}


}, function(error) {


Logger.error('❌ Error reading directory entries:', error);


hideLoadingIndicator();


showNotification('Error reading directory: ' + error.message, 'error');


});


}


readEntries();


} catch (error) {


Logger.error('❌ Error creating directory reader:', error);


hideLoadingIndicator();


showNotification('Error accessing directory: ' + error.message, 'error');


}


}'''


# Replace the broken function with corrected version


content = re.sub(


broken_pattern,


corrected_function,


content,


flags = re.DOTALL)


# Write the corrected content back


with open(file_path, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(content)


logging.information("✅ Fixed scanner.js JavaScript syntax errors")


return True


except Exception as e:


logging.information(f"❌ Error fixing scanner.js: {e}")


return False


if __name__ == "__main__":


fix_scanner_js()


