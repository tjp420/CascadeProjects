/**
 * Compatibility shim for legacy pages that load `/export-system.js`.
 * Canonical implementation lives at `/scripts/export-system.js`.
 */
(function loadExportSystemCompatibilityShim() {
  const scriptId = 'export-system-runtime-script';
  if (document.getElementById(scriptId)) {
    return;
  }

  const script = document.createElement('script');
  script.id = scriptId;
  script.src = '/scripts/export-system.js';
  script.defer = true;
  document.head.appendChild(script);
})();
