// SimpleBeacon Diagnostic Bundle Library
// Handles file upload/download for diagnostic bundles

(function() {
  'use strict';

  // Public API
  window.DiagnosticBundleLib = {
    // Generate a diagnostic bundle from scan results
    generateBundle: function(scanResults) {
      var bundle = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        scanResults: scanResults,
        metadata: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      };
      return bundle;
    },

    // Download bundle as JSON file
    downloadBundle: function(bundle, filename) {
      filename = filename || 'simplebeacon-diagnostic-bundle.json';
      var dataStr = JSON.stringify(bundle, null, 2);
      var dataBlob = new Blob([dataStr], {type: 'application/json'});
      var url = URL.createObjectURL(dataBlob);
      
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    // Upload bundle from file
    uploadBundle: function(file, callback) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var bundle = JSON.parse(e.target.result);
          callback(null, bundle);
        } catch (err) {
          callback(new Error('Invalid bundle file: ' + err.message), null);
        }
      };
      reader.onerror = function() {
        callback(new Error('Failed to read file'), null);
      };
      reader.readAsText(file);
    },

    // Validate bundle structure
    validateBundle: function(bundle) {
      if (!bundle || typeof bundle !== 'object') {
        return {valid: false, error: 'Bundle is not an object'};
      }
      if (!bundle.version) {
        return {valid: false, error: 'Missing version field'};
      }
      if (!bundle.timestamp) {
        return {valid: false, error: 'Missing timestamp field'};
      }
      if (!bundle.scanResults) {
        return {valid: false, error: 'Missing scanResults field'};
      }
      return {valid: true};
    },

    // Extract summary from bundle
    getSummary: function(bundle) {
      if (!bundle || !bundle.scanResults) {
        return null;
      }
      
      var results = bundle.scanResults;
      return {
        timestamp: bundle.timestamp,
        version: bundle.version,
        totalFiles: results.totalFiles || 0,
        totalIssues: results.totalIssues || 0,
        criticalIssues: results.criticalIssues || 0,
        warningIssues: results.warningIssues || 0,
        infoIssues: results.infoIssues || 0
      };
    },

    // Format bundle for display
    formatForDisplay: function(bundle) {
      var summary = this.getSummary(bundle);
      if (!summary) {
        return 'No data available';
      }
      
      return [
        'SimpleBeacon Diagnostic Bundle',
        'Version: ' + summary.version,
        'Timestamp: ' + new Date(summary.timestamp).toLocaleString(),
        'Total Files: ' + summary.totalFiles,
        'Total Issues: ' + summary.totalIssues,
        'Critical: ' + summary.criticalIssues,
        'Warnings: ' + summary.warningIssues,
        'Info: ' + summary.infoIssues
      ].join('\n');
    }
  };

  // Initialize file input handlers
  function initFileInputs() {
    document.querySelectorAll('.diagnostic-bundle-upload').forEach(function(input) {
      input.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        window.DiagnosticBundleLib.uploadBundle(file, function(err, bundle) {
          if (err) {
            console.error('Bundle upload error:', err);
            alert('Failed to load bundle: ' + err.message);
            return;
          }
          
          var validation = window.DiagnosticBundleLib.validateBundle(bundle);
          if (!validation.valid) {
            console.error('Bundle validation error:', validation.error);
            alert('Invalid bundle: ' + validation.error);
            return;
          }
          
          // Dispatch custom event with loaded bundle
          var event = new CustomEvent('bundleLoaded', {
            detail: {bundle: bundle}
          });
          document.dispatchEvent(event);
        });
      });
    });
  }

  // Initialize download buttons
  function initDownloadButtons() {
    document.querySelectorAll('.diagnostic-bundle-download').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Get current scan results from global state if available
        var scanResults = window.currentScanResults || {};
        var bundle = window.DiagnosticBundleLib.generateBundle(scanResults);
        window.DiagnosticBundleLib.downloadBundle(bundle);
      });
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initFileInputs();
      initDownloadButtons();
    });
  } else {
    initFileInputs();
    initDownloadButtons();
  }
})();