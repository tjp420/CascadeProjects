// simplebeacon-ignore i18n
/**
 * Show download credentials modal.
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.submitLabel - Submit button label
 * @param {Function} options.onSubmit - Called with credentials object
 * @param {Object} [options.defaults] - Default values for fields
 */
export function showDownloadCredentialsModal({
  title = 'Edit Report Credentials',
  submitLabel = 'Download',
  onSubmit,
  defaults = {},
} = {}) {
  var _a;
  const existing = document.getElementById('download-credentials-modal');
  existing === null || existing === void 0 ? void 0 : existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'download-credentials-modal';
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal-card';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'download-creds-title');
  modal.style.maxWidth = '480px';
  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleEl = document.createElement('h2');
  titleEl.id = 'download-creds-title';
  titleEl.textContent = title;
  const desc = document.createElement('p');
  desc.className = 'text-muted';
  desc.textContent = 'Customize the information shown on your report before downloading.';
  header.appendChild(titleEl);
  header.appendChild(desc);
  const form = document.createElement('form');
  form.id = 'download-creds-form';
  form.className = 'modal-body';
  const fields = [
    {
      id: 'dc-project-name',
      label: 'Project / Company Name',
      placeholder: 'Acme Corp',
      value: defaults.projectName || '',
    },
    {
      id: 'dc-signatory-name',
      label: 'Signatory Name',
      placeholder: 'Jane Smith',
      value: defaults.signatoryName || '',
    },
    {
      id: 'dc-signatory-title',
      label: 'Signatory Title',
      placeholder: 'Chief Technology Officer',
      value: defaults.signatoryTitle || '',
    },
    {
      id: 'dc-contact-email',
      label: 'Contact Email',
      placeholder: 'Contact email address',
      value: defaults.contactEmail || '',
      inputmode: 'email',
    },
  ];
  fields.forEach((field) => {
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.setAttribute('for', field.id);
    lbl.textContent = field.label;
    const inp = document.createElement('input');
    inp.id = field.id;
    inp.className = 'input';
    inp.type = 'text';
    inp.autocomplete = 'off';
    inp.placeholder = field.placeholder;
    inp.value = field.value;
    if (field.inputmode) inp.inputMode = field.inputmode;
    form.appendChild(lbl);
    form.appendChild(inp);
  });
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = 'var(--space-2)';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.marginTop = 'var(--space-2)';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-ghost btn-sm';
  cancelBtn.id = 'dc-cancel';
  cancelBtn.textContent = 'Cancel';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary btn-sm';
  submitBtn.id = 'dc-submit';
  submitBtn.textContent = submitLabel;
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(submitBtn);
  form.appendChild(btnRow);
  modal.appendChild(header);
  modal.appendChild(form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  function close() {
    overlay.remove();
  }
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const credentials = {
      projectName: overlay.querySelector('#dc-project-name').value.trim(),
      signatoryName: overlay.querySelector('#dc-signatory-name').value.trim(),
      signatoryTitle: overlay.querySelector('#dc-signatory-title').value.trim(),
      contactEmail: overlay.querySelector('#dc-contact-email').value.trim(),
    };
    close();
    if (typeof onSubmit === 'function') {
      onSubmit(credentials);
    }
  });
  (_a = overlay.querySelector('#dc-project-name')) === null || _a === void 0 ? void 0 : _a.focus();
}
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
