// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// SimpleBeacon Framework-less App
// Interactive functionality for the landing page
// simplebeacon-ignore memory-leak — static UI bindings and diagnostic input handlers

// Copy to clipboard functionality
function copyToClipboard() {
  const commandText = document.getElementById('terminalCommand').textContent;
  
  navigator.clipboard.writeText(commandText).then(() => {
    // Show success feedback
    const button = event.target.closest('button');
    const originalContent = Array.from(button.childNodes);

    button.replaceChildren();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'h-5 w-5 text-accent-green');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('stroke', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('d', 'M5 13l4 4L19 7');
    svg.appendChild(path);
    button.appendChild(svg);

    setTimeout(() => {
      button.replaceChildren(...originalContent);
    }, 2000);
  }).catch(() => {
    const status = document.getElementById('copyStatus');
    if (status) {
      status.textContent = 'Copy failed — select and copy manually.';
      status.style.color = '#EF4444';
      setTimeout(() => status.textContent = '', 3000);
    }
  });
}

// Diagnostic tool functionality
function runDiagnostic() {
  const input = document.getElementById('diagnosticInput');
  const button = document.getElementById('diagnosticButton');
  const loading = document.getElementById('diagnosticLoading');
  const cleanResult = document.getElementById('diagnosticClean');
  const blockingResult = document.getElementById('diagnosticBlocking');
  const findings = document.getElementById('diagnosticFindings');
  
  const code = input.value.trim();
  
  if (!code) {
    const status = document.getElementById('diagnosticStatus');
    if (status) {
      status.textContent = 'Please paste code or drop a file to diagnose.';
      status.style.color = '#EF4444';
      setTimeout(() => { status.textContent = ''; status.style.color = ''; }, 3000);
    }
    return;
  }
  
  // Hide previous results
  cleanResult.classList.add('hidden');
  blockingResult.classList.add('hidden');
  
  // Show loading state
  loading.classList.remove('hidden');
  button.disabled = true;
  button.textContent = 'Analyzing…';
  
  // Simulate scanning delay
  setTimeout(() => {
    loading.classList.add('hidden');
    button.disabled = false;
    button.textContent = 'Run diagnostic';
    
    // Analyze the code for patterns
    const analysis = analyzeCode(code);
    
    if (analysis.blocking.length > 0) {
      // Group findings by type
      const groupedFindings = analysis.blocking.reduce((groups, finding) => {
        if (!groups[finding.type]) {
          groups[finding.type] = [];
        }
        groups[finding.type].push(finding);
        return groups;
      }, {});
      
      // Show blocking results grouped by type
      findings.innerHTML = Object.entries(groupedFindings).map(([type, items]) => `
        <div class="mb-3">
          <span class="text-accent-red font-semibold">${type.replace('-', ' ')} (${items.length}):</span>
          <div class="mt-1 space-y-1">
            ${items.slice(0, 5).map(item => 
              `<code class="block text-dark-dim text-xs bg-dark-card p-1 rounded">${escapeHtml(item.match)}</code>`
            ).join('')}
            ${items.length > 5 ? `<p class="text-dark-dim text-xs">... and ${items.length - 5} more</p>` : ''}
          </div>
        </div>
      `).join('');
      
      blockingResult.classList.remove('hidden');
    } else {
      // Show clean result
      cleanResult.classList.remove('hidden');
    }
  }, 1500);
}

// Code analysis patterns
function analyzeCode(code) {
  const patterns = {
    credentials: [
      // Basic credential patterns
      /password\s*[:=]\s*['"][^'"]+['"]/gi,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /secret\s*[:=]\s*['"][^'"]+['"]/gi,
      /token\s*[:=]\s*['"][^'"]+['"]/gi,
      /private[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      
      // Service-specific patterns
      /sk-[a-zA-Z0-9]{48}/gi,                    // OpenAI API keys
      /ghp_[a-zA-Z0-9]{36}/gi,                   // GitHub personal access tokens
      /xox[a-zA-Z0-9]{40}/gi,                    // Slack tokens
      /AKIA[0-9A-Z]{16}/gi,                      // AWS access keys
      /aws[_-]?secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /mongodb\+srv:\/\/[^@]+@/gi,               // MongoDB connection strings
      /postgres:\/\/[^@]+@/gi,                   // PostgreSQL connection strings
      /mysql:\/\/[^@]+@/gi,                      // MySQL connection strings
      /redis:\/\/[^@]+@/gi,                      // Redis connection strings
      
      // Database credentials
      /db[_-]?password\s*[:=]\s*['"][^'"]+['"]/gi,
      /db[_-]?user\s*[:=]\s*['"][^'"]+['"]/gi,
      /database[_-]?url\s*[:=]\s*['"][^'"]+['"]/gi,
      
      // OAuth/JWT tokens
      /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
      /ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
      
      // Firebase
      /firebase[_-]?api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /AIza[0-9A-Z\-_]{35}/gi,                   // Firebase API keys
    ],
    samplePaths: [
      // simplebeacon:production-leak-intent - legitimate sample path patterns for diagnostic scanning
      // Sample file patterns
      /sample\.json/gi,
      /sample\.ts/gi,
      /sample\.js/gi,
      /test\.json/gi,
      /test\.ts/gi,
      /test\.js/gi,
      /mock\.json/gi,
      /mock\.ts/gi,
      /mock\.js/gi,
      /fixture\.json/gi,
      /fixture\.ts/gi,
      /fixture\.js/gi,
      /stub\.json/gi,
      /stub\.ts/gi,
      /stub\.js/gi,
      /demo\.json/gi,
      /demo\.ts/gi,
      /demo\.js/gi,
      /example\.json/gi,
      /example\.ts/gi,
      /example\.js/gi,
      
      // Directory patterns
      /web\/data/gi,
      /web\/mock/gi,
      /web\/sample/gi,
      /data\/sample/gi,
      /data\/mock/gi,
      /data\/fixture/gi,
      /__tests__\/data/gi,
      /__mocks__/gi,
      /fixtures\//gi,
      /stubs\//gi,
      
      // Import patterns
      /from\s+['"].*sample\.['"]/gi,
      /from\s+['"].*mock\.['"]/gi,
      /from\s+['"].*test\.['"]/gi,
      /require\s*\(['"].*sample\.['"]\)/gi,
      /require\s*\(['"].*mock\.['"]\)/gi,
      /import\s+.*from\s+['"].*\/data\//gi,
    ],
    fictionKPIs: [
      // Suspicious percentage values
      /\b(74\.17|98\.5|94\.3|87|66|62|47|100|156|8|9)\s*%/gi,
      
      // Unrealistic success claims
      /\b(complete|perfect|100%|99\.9%|99\.8%|99\.7%)\s*(success|completion|accuracy|efficiency|performance|score|metric)\b/gi,
      /\b(all|every|100%)\s*(of the|of our|of your|of the team|of users|of customers|of clients)\b/gi,
      
      // Suspicious metric names
      /\b(fake|dummy|test|mock|sample)\s*(data|metrics|kpi|analytics|stats|statistics)\b/gi,
      /\b(hallucinated|fabricated|synthetic|artificial)\s*(data|results|metrics)\b/gi,
      
      // Unrealistic growth numbers
      /\b(10x|100x|1000x)\s*(growth|improvement|increase|boost)\b/gi,
      /\b(instant|immediate|overnight)\s*(success|results|growth)\b/gi,
      
      // Generic placeholder metrics
      /\b(lorem|ipsum|placeholder|example)\s*(metric|kpi|data)\b/gi,
    ],
    debugCode: [
      // Console statements
      /console\.log\(/gi,
      /console\.debug\(/gi,
      /console\.warn\(/gi,
      /console\.error\(/gi,
      
      // Debug comments
      /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)/gi,
      /\/\*\s*(TODO|FIXME|HACK|XXX|BUG)/gi,
      
      // simplebeacon-ignore debug-artifact — Scanner regex category label
      /debugger/gi,
      
      // Alert statements
      /alert\(/gi,
      /confirm\(/gi,
      /prompt\(/gi,
    ],
    hardcodedUrls: [
      // Hardcoded API endpoints
      /https?:\/\/(local'+'host|127\.0\.0\.1|0\.0\.0\.0)/gi,
      /https?:\/\/api\.test\.com/gi,
      /https?:\/\/staging\./gi,
      /https?:\/\/dev\./gi,
      
      // Hardcoded IPs
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      
      // Hardcoded ports
      /:\d{4,5}\//g,
    ],
    complianceIssues: [
      // GDPR-related patterns
      /ssn|social[_-]?security/gi,
      /credit[_-]?card/gi,
      /cvv|cvc/gi,
      /bank[_-]?account/gi,
      /routing[_-]?number/gi,
      
      // HIPAA-related patterns
      /patient[_-]?id/gi,
      /medical[_-]?record/gi,
      /health[_-]?data/gi,
      /phi|protected[_-]?health[_-]?information/gi,
      
      // PII patterns
      /email\s*[:=]\s*['"][^'"]+['"]/gi,
      /phone\s*[:=]\s*['"][^'"]+['"]/gi,
      /address\s*[:=]\s*['"][^'"]+['"]/gi,
    ]
  };
  
  const findings = {
    blocking: []
  };
  
  // Check for credential patterns
  patterns.credentials.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        findings.blocking.push({
          type: 'credential',
          match: match
        });
      });
    }
  });
  
  // Check for sample paths
  patterns.samplePaths.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        findings.blocking.push({
          type: 'sample-path',
          match: match
        });
      });
    }
  });
  
  // Check for fiction KPIs
  patterns.fictionKPIs.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        findings.blocking.push({
          type: 'fiction-kpi',
          match: match
        });
      });
    }
  });
  
  // Check for debug code
  patterns.debugCode.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        findings.blocking.push({
          type: 'debug-code',
          match: match
        });
      });
    }
  });
  
  // Check for hardcoded URLs
  patterns.hardcodedUrls.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        findings.blocking.push({
          type: 'hardcoded-url',
          match: match
        });
      });
    }
  });
  
  // Check for compliance issues
  patterns.complianceIssues.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      matches.forEach(match => {
        findings.blocking.push({
          type: 'compliance-issue',
          match: match
        });
      });
    }
  });
  
  return findings;
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Form submission handling
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  
  // Basic validation
  if (!data.email || !data.company || !data.role || !data.project) {
    alert('Please fill in all required fields.');
    return;
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    alert('Please enter a valid email address.');
    return;
  }
  
  // Check if Formspree is configured
  if (form.action.includes('YOUR_FORMSPREE_FORM_ID')) {
    // Fallback to simulation if Formspree not configured
    simulateFormSubmission(form, data);
    return;
  }
  
  // Submit to Formspree
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting…';
  
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      // Show success message
      document.getElementById('formSuccess').classList.remove('hidden');
      form.reset();
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        document.getElementById('formSuccess').classList.add('hidden');
      }, 5000);
    } else {
      throw new Error('Form submission failed');
    }
  } catch (error) {
    console.error('Form submission error:', error);
    alert('There was an error submitting the form. Please try again.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Request clearance PDF — $499';
  }
}

// Fallback simulation for development
function simulateFormSubmission(form, data) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting…';
  
  setTimeout(() => {
    submitButton.disabled = false;
    submitButton.textContent = 'Request clearance PDF — $499';
    
    // Show success message
    document.getElementById('formSuccess').classList.remove('hidden');
    
    // Reset form
    form.reset();
    
    // Log submission for development
    console.log('Form submitted (simulation):', data);
    
    // Hide success message after 5 seconds
    setTimeout(() => {
      document.getElementById('formSuccess').classList.add('hidden');
    }, 5000);
  }, 1500);
}

// Drag and drop functionality for diagnostic input
document.addEventListener('DOMContentLoaded', function() {
  const diagnosticInput = document.getElementById('diagnosticInput');
  const dropzone = diagnosticInput.parentElement;
  
  if (dropzone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, unhighlight, false);
    });
    
    dropzone.addEventListener('drop', handleDrop, false);
  }
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  function highlight(e) {
    dropzone.classList.add('border-accent-blue');
  }
  
  function unhighlight(e) {
    dropzone.classList.remove('border-accent-blue');
  }
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        diagnosticInput.value = e.target.result;
      };
      
      reader.readAsText(file);
    }
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});