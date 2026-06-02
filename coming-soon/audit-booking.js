(function () {
  'use strict';

  var cfg = window.SIMPLEBEACON_SITE || {};
  var form = document.getElementById('auditBookingForm');
  if (!form) return;

  var statusEl = form.querySelector('.audit-booking-status');
  var submitBtn = form.querySelector('.audit-booking-submit');
  var apiUrl = String(cfg.auditBookingApi || '/api/audit-booking').trim();

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.className = 'audit-booking-status' + (kind ? ' is-' + kind : '');
  }

  function scrollToForm(source) {
    var sourceInput = form.querySelector('input[name="source"]');
    if (sourceInput && source) sourceInput.value = source;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var first = form.querySelector('input[name="contactEmail"]');
    if (first) first.focus();
  }

  window.SIMPLEBEACON_SCROLL_TO_BOOKING = scrollToForm;

  function formatBookingNotes(data) {
    var role = String(data.get('buyerRole') || '').trim();
    var notes = String(data.get('notes') || '').trim();
    var roleLabels = {
      agency_owner: 'Agency owner / founder',
      cto: 'CTO / Head of Engineering',
      tech_director: 'Technical director / delivery lead',
      pm: 'Product / program manager',
      other: 'Other'
    };
    var roleLabel = roleLabels[role] || role;
    if (roleLabel && notes) return 'Role: ' + roleLabel + '\n' + notes;
    if (roleLabel) return 'Role: ' + roleLabel;
    return notes;
  }

  // Real-time validation functions
  function validateEmail(input) {
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var isValid = emailRegex.test(input.value);
    var validationEl = document.getElementById('contactEmailValidation');
    
    if (input.value.length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (validationEl) {
        validationEl.classList.remove('is-valid', 'is-invalid');
        validationEl.textContent = '';
      }
      return false;
    }
    
    if (isValid) {
      input.classList.add('is-valid');
      input.classList.remove('is-invalid');
      if (validationEl) {
        validationEl.classList.add('is-valid');
        validationEl.classList.remove('is-invalid');
        validationEl.textContent = '✓ Valid email';
      }
    } else {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (validationEl) {
        validationEl.classList.add('is-invalid');
        validationEl.classList.remove('is-valid');
        validationEl.textContent = 'Please enter a valid email address';
      }
    }
    return isValid;
  }

  function validateRequired(input, fieldName) {
    var isValid = input.value.trim().length > 0;
    var validationEl = document.getElementById(fieldName + 'Validation');
    
    if (input.value.trim().length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (validationEl) {
        validationEl.classList.remove('is-valid', 'is-invalid');
        validationEl.textContent = '';
      }
      return false;
    }
    
    if (isValid) {
      input.classList.add('is-valid');
      input.classList.remove('is-invalid');
      if (validationEl) {
        validationEl.classList.add('is-valid');
        validationEl.classList.remove('is-invalid');
        validationEl.textContent = '✓ Valid';
      }
    } else {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (validationEl) {
        validationEl.classList.add('is-invalid');
        validationEl.classList.remove('is-valid');
        validationEl.textContent = 'This field is required';
      }
    }
    return isValid;
  }

  function validateRepository(input) {
    var repoRegex = /^(github\.com\/[\w-]+\/[\w-]+|[\w-]+\/[\w-]+|[\w-]+)$/;
    var isValid = repoRegex.test(input.value);
    var validationEl = document.getElementById('repositoryValidation');
    
    if (input.value.length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (validationEl) {
        validationEl.classList.remove('is-valid', 'is-invalid');
        validationEl.textContent = '';
      }
      return false;
    }
    
    if (isValid) {
      input.classList.add('is-valid');
      input.classList.remove('is-invalid');
      if (validationEl) {
        validationEl.classList.add('is-valid');
        validationEl.classList.remove('is-invalid');
        validationEl.textContent = '✓ Valid repository format';
      }
    } else {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (validationEl) {
        validationEl.classList.add('is-invalid');
        validationEl.classList.remove('is-valid');
        validationEl.textContent = 'Use format: github.com/org/repo or project-name';
      }
    }
    return isValid;
  }

  function validateDate(input) {
    var isValid = input.value.length > 0;
    var validationEl = document.getElementById('handoffDateValidation');
    
    if (input.value.length === 0) {
      input.classList.remove('is-valid', 'is-invalid');
      if (validationEl) {
        validationEl.classList.remove('is-valid', 'is-invalid');
        validationEl.textContent = '';
      }
      return false;
    }
    
    var handoffDate = new Date(input.value);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (handoffDate <= today) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (validationEl) {
        validationEl.classList.add('is-invalid');
        validationEl.classList.remove('is-valid');
        validationEl.textContent = 'Date must be in the future';
      }
      return false;
    }
    
    if (isValid) {
      input.classList.add('is-valid');
      input.classList.remove('is-invalid');
      if (validationEl) {
        validationEl.classList.add('is-valid');
        validationEl.classList.remove('is-invalid');
        validationEl.textContent = '✓ Valid date';
      }
    }
    return isValid;
  }

  // Attach real-time validation listeners
  var emailInput = form.querySelector('input[name="contactEmail"]');
  if (emailInput) {
    emailInput.addEventListener('blur', function() { validateEmail(emailInput); });
    emailInput.addEventListener('input', function() {
      if (emailInput.classList.contains('is-invalid')) {
        validateEmail(emailInput);
      }
    });
  }

  var companyInput = form.querySelector('input[name="company"]');
  if (companyInput) {
    companyInput.addEventListener('blur', function() { validateRequired(companyInput, 'company'); });
    companyInput.addEventListener('input', function() {
      if (companyInput.classList.contains('is-invalid')) {
        validateRequired(companyInput, 'company');
      }
    });
  }

  var roleSelect = form.querySelector('select[name="buyerRole"]');
  if (roleSelect) {
    roleSelect.addEventListener('change', function() { validateRequired(roleSelect, 'buyerRole'); });
  }

  var repoInput = form.querySelector('input[name="repository"]');
  if (repoInput) {
    repoInput.addEventListener('blur', function() { validateRepository(repoInput); });
    repoInput.addEventListener('input', function() {
      if (repoInput.classList.contains('is-invalid')) {
        validateRepository(repoInput);
      }
    });
  }

  var dateInput = form.querySelector('input[name="handoffDate"]');
  if (dateInput) {
    dateInput.addEventListener('blur', function() { validateDate(dateInput); });
    dateInput.addEventListener('change', function() { validateDate(dateInput); });
  }

  document.querySelectorAll('a[href="#auditBookingForm"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      event.preventDefault();
      scrollToForm(link.getAttribute('data-booking-scroll') || 'pricing');
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('', '');

    var data = new FormData(form);
    if (String(data.get('website') || '').trim()) return;

    var payload = {
      contactEmail: String(data.get('contactEmail') || '').trim(),
      company: String(data.get('company') || '').trim(),
      repository: String(data.get('repository') || '').trim(),
      branch: String(data.get('branch') || 'main').trim(),
      handoffDate: String(data.get('handoffDate') || '').trim(),
      notes: formatBookingNotes(data),
      source: String(data.get('source') || 'pricing').trim(),
      paymentsEnabled: cfg.paymentsEnabled === true
    };

    if (!payload.contactEmail || !payload.company || !payload.repository) {
      setStatus('Please fill in your email, company, and repository details.', 'error');
      return;
    }

    if (!payload.handoffDate) {
      setStatus('Please add your client delivery date so we can prioritize your clearance.', 'error');
      return;
    }

    var buyerRole = String(data.get('buyerRole') || '').trim();
    if (!buyerRole) {
      setStatus('Please select your role so we route your request correctly.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    // Check if we're in local development (no API endpoint available)
    if (apiUrl === '/api/audit-booking' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
      // Fallback for local development - simulate successful submission
      setTimeout(function() {
        form.reset();
        var sourceInput = form.querySelector('input[name="source"]');
        if (sourceInput) sourceInput.value = 'pricing';
        setStatus('Request submitted successfully (local simulation). Check your inbox for payment link and delivery steps.', 'success');
        console.log('Audit booking submission (local simulation):', payload);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request $499 clearance — send';
        }
      }, 1500);
      return;
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (result.body && result.body.ok && result.body.saved) {
          form.reset();
          var sourceInput = form.querySelector('input[name="source"]');
          if (sourceInput) sourceInput.value = 'pricing';
          var inbox = String((result.body.operatorInboxUrl || cfg.operatorInboxUrl || '/operator/bookings')).trim();
          if (result.body.emailSent) {
            var prospectNote = result.body.prospectEmailSent
              ? ' Check your inbox for payment link and delivery steps.'
              : '';
            setStatus('Booking #' + result.body.bookingId + ' saved and emailed.' + prospectNote + ' View all requests: ' + inbox, 'success');
          } else {
            statusEl.innerHTML = 'Booking #' + result.body.bookingId + ' saved on this server. '
              + '<a href="' + inbox + '">Open operator inbox</a> to see it (this is not your email inbox — email needs Resend).';
            statusEl.hidden = false;
            statusEl.className = 'audit-booking-status is-success';
          }
          return;
        }

        if (result.ok && result.body && result.body.ok) {
          form.reset();
          statusEl.innerHTML = 'Check your inbox — payment link and clearance delivery steps are on the way. '
            + 'After payment, run <code>scan --gate --offline</code> and follow the clearance delivery guide to send your JSON report.';
          statusEl.hidden = false;
          statusEl.className = 'audit-booking-status is-success';
          return;
        }

        if (result.status === 401 || (result.body && result.body.error === 'Authentication failed')) {
          setStatus('Server blocked the request (auth). Stop the server (Ctrl+C), run npm run staging:paywall again, hard refresh, then retry.', 'error');
          return;
        }

        if (result.body && result.body.error === 'email_failed') {
          setStatus(result.body.message || 'Email provider rejected the send.', 'error');
          return;
        }

        if (result.body && result.body.error === 'email_not_configured') {
          setStatus('Booking saved but email is not configured on the server. Email ' + (cfg.auditEmail || 'audit@simplebeacon.ai') + ' with your details, or ask the operator to set RESEND_API_KEY on Cloudflare.', 'error');
          return;
        }

        setStatus((result.body && result.body.message) || 'Could not send request. Try again or use the Contact page in the footer.', 'error');
      })
      .catch(function () {
        setStatus('Network error — is the local server running? On production, deploy the functions/ folder to Cloudflare Pages.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request $499 clearance — send';
        }
      });
  });
})();