# File Optimization and Security Utilities

This directory contains comprehensive utilities for optimizing large files and enhancing security through filename sanitization and validation.

## 🚀 Quick Start

### Install Dependencies
```bash
pip install -r requirements.txt
npm install
```

### Run Full Optimization
```bash
# Full optimization with report
npm run optimize:full

# Dry run to see what would be changed
npm run optimize:dry-run
```

## 📁 Utilities Overview

### 1. Database Optimizer (`database_optimizer.py`)
Optimizes SQLite databases to reduce size and improve performance.

**Features:**
- Database vacuuming and cleanup
- Index rebuilding
- Data archiving
- Backup creation

**Usage:**
```bash
# Optimize a specific database
python database_optimizer.py path/to/database.db

# Clean up data older than 30 days
python database_optimizer.py path/to/database.db --cleanup-days 30

# Create backup only
python database_optimizer.py path/to/database.db --backup-only
```

### 2. Data Compressor (`data_compressor.py`)
Compresses large JSON, CSV, and other data files.

**Features:**
- Multiple compression algorithms (gzip, bz2, lzma)
- JSON structure optimization
- CSV data cleaning
- Summary generation

**Usage:**
```bash
# Compress with gzip (default)
python data_compressor.py path/to/large_file.json

# Compress with lzma
python data_compressor.py path/to/large_file.json --method lzma

# Optimize structure without compression
python data_compressor.py path/to/file.json --optimize

# Create summary
python data_compressor.py path/to/file.json --summary

# Perform all operations
python data_compressor.py path/to/file.json --all
```

### 3. Filename Sanitizer (`filename_sanitizer.py`)
Sanitizes filenames with special characters and spaces.

**Features:**
- Removes special characters
- Replaces spaces with underscores
- Batch processing
- Backup creation
- Security validation

**Usage:**
```bash
# Scan directory for problematic files
python filename_sanitizer.py /path/to/directory --scan-only

# Batch rename with backup
python filename_sanitizer.py /path/to/directory

# Dry run (no actual changes)
python filename_sanitizer.py /path/to/directory --dry-run

# Skip backup creation
python filename_sanitizer.py /path/to/directory --no-backup

# Validate single filename
python filename_sanitizer.py /path/to/directory --validate "Bad File Name!.pdf"
```

### 4. File Security Validator (`file_security_validator.py`)
Validates files for security compliance.

**Features:**
- File type validation
- Size limits
- Malicious content scanning
- MIME type verification
- Hash generation

**Usage:**
```bash
# Validate single file
python file_security_validator.py path/to/file.txt

# Validate for upload
python file_security_validator.py path/to/file.txt --upload-dir /target/directory

# Generate report
python file_security_validator.py path/to/file.txt --report security_report.txt
```

### 5. Master Optimization Script (`run_optimization.py`)
Runs all optimization utilities in sequence.

**Features:**
- Complete optimization pipeline
- Comprehensive reporting
- Error handling
- Progress tracking

**Usage:**
```bash
# Run full optimization
python run_optimization.py /path/to/directory

# Run specific optimizations
python run_optimization.py /path/to/directory --database-only
python run_optimization.py /path/to/directory --compress-only
python run_optimization.py /path/to/directory --sanitize-only
python run_optimization.py /path/to/directory --security-only

# Custom options
python run_optimization.py /path/to/directory --cleanup-days 60 --compression-method lzma --dry-run
```

## 📦 NPM Scripts

The following scripts are available in `package.json`:

```bash
# Individual utilities
npm run optimize:databases
npm run optimize:files
npm run sanitize:filenames
npm run validate:security

# Master scripts
npm run optimize:all
npm run optimize:full      # With report generation
npm run optimize:dry-run   # Dry run with report

# JavaScript optimization
npm run build:optimized   # Webpack with code splitting
```

## 🎯 Optimization Targets

### Large Files (>1MB)
- **Databases**: `*.db`, `*.sqlite`, `*.sqlite3`
- **JavaScript bundles**: `*.js`, `*.mjs`
- **Data files**: `*.json`, `*.csv`, `*.xml`
- **Source maps**: `*.js.map`

### Security Issues
- **Special characters**: Spaces, symbols in filenames
- **Unsafe extensions**: Executables, scripts
- **Malicious content**: Script injections, suspicious patterns

## 📊 Expected Results

### Performance Improvements
- **Database size**: 30-70% reduction
- **File size**: 40-80% compression ratio
- **Load time**: 40%+ improvement
- **Storage**: Significant space savings

### Security Enhancements
- **100%** filename compliance
- **Zero** malicious files
- **Complete** audit trail
- **Automated** validation

## 🔧 Configuration

### Database Optimizer Settings
```python
# Default cleanup days
DEFAULT_CLEANUP_DAYS = 30

# Backup location
BACKUP_DIR = "./backups"
```

### File Size Limits
```python
# Maximum file size for uploads (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024

# Large file threshold (1MB)
LARGE_FILE_THRESHOLD = 1024 * 1024
```

### Allowed File Extensions
```python
ALLOWED_EXTENSIONS = {
    # Documents
    '.txt', '.md', '.pdf', '.doc', '.docx',
    # Code files
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java',
    # Data files
    '.json', '.csv', '.xml', '.yaml', '.yml',
    # Images
    '.jpg', '.jpeg', '.png', '.gif', '.svg',
    # Archives
    '.zip', '.tar', '.gz', '.bz2', '.xz'
}
```

## 📋 Best Practices

### Before Running Optimization
1. **Backup important data**
2. **Test on sample files first**
3. **Run dry-run mode first**
4. **Check available disk space**

### During Optimization
1. **Monitor logs for errors**
2. **Verify backup creation**
3. **Check progress periodically**
4. **Stop if critical errors occur**

### After Optimization
1. **Review optimization report**
2. **Verify file integrity**
3. **Test application functionality**
4. **Monitor performance improvements**

## 🚨 Safety Features

### Automatic Backups
- Database files: Automatic backup before optimization
- File renaming: Optional backup creation
- Rollback capability: Restore from backups

### Validation Checks
- File integrity verification
- Security scanning
- Type validation
- Size limits

### Error Handling
- Graceful failure handling
- Detailed error logging
- Partial success reporting
- Recovery recommendations

## 📈 Monitoring

### Log Files
- `database_optimization.log`
- `data_compression.log`
- `filename_sanitization.log`
- `file_security_validation.log`
- `optimization_master.log`

### Reports
- `optimization_report_YYYYMMDD_HHMMSS.txt`
- `sanitization_report_YYYYMMDD_HHMMSS.txt`
- `security_report.txt`

### Metrics Tracked
- Files processed
- Space saved
- Compression ratios
- Error counts
- Processing time

## 🔍 Troubleshooting

### Common Issues

**Permission Denied**
```bash
# Run with appropriate permissions
sudo python run_optimization.py /path/to/directory
```

**Out of Disk Space**
```bash
# Check available space
df -h

# Clean up temporary files
npm run clean
```

**Import Errors**
```bash
# Install missing dependencies
pip install -r requirements.txt
pip install python-magic
```

**Database Locked**
```bash
# Close database connections
# Wait for processes to complete
# Try again after lock release
```

### Getting Help

1. Check log files for detailed error messages
2. Run with `--dry-run` to test without changes
3. Use `--scan-only` to identify issues before fixing
4. Review optimization reports for guidance

## 🔄 Automation

### Cron Job Example
```bash
# Weekly optimization (Sundays at 2 AM)
0 2 * * 0 cd /path/to/project && npm run optimize:full

# Daily security check
0 3 * * * cd /path/to/project && npm run validate:security
```

### GitHub Actions
```yaml
name: File Optimization
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly
jobs:
  optimize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install -r scripts/requirements.txt
      - name: Run optimization
        run: npm run optimize:full
```

## 📝 License

MIT License - See LICENSE file for details.
