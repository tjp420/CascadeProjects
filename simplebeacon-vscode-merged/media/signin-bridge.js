(function () {
  var vsc = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  if (!vsc) return;
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.command) return;
    var c = e.data.command;
    if (c === 'setAuthState' || c === 'storeActiveLicenseToken') {
      vsc.postMessage(e.data);
    }
  });
})();
