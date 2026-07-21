// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * SimpleBeacon Desktop Bridge
 *
 * Exposes Tauri native APIs to the bundled dashboard so it can scan local files,
 * select folders, and spawn CLI processes without browser sandbox restrictions.
 */
(function () {
  if (typeof window === 'undefined') return;

  // Mark the runtime so the dashboard can adapt UI/UX for the desktop wrapper.
  window.__SIMPLEBEACON_DESKTOP__ = true;

  async function invoke(cmd, args) {
    if (typeof window.__TAURI__ !== 'undefined' && window.__TAURI__.invoke) {
      return window.__TAURI__.invoke(cmd, args);
    }
    throw new Error('Tauri invoke is not available');
  }

  window.__SBD_SELECT_FOLDER__ = async function () {
    const selected = await invoke('select_folder');
    return selected || null;
  };

  window.__SBD_READ_DIRECTORY__ = async function (path) {
    return invoke('read_directory', { path });
  };

  window.__SBD_READ_TEXT_FILE__ = async function (path) {
    return invoke('read_text_file', { path });
  };

  window.__SBD_WRITE_TEXT_FILE__ = async function (path, contents) {
    return invoke('write_text_file', { path, contents });
  };

  window.__SBD_PLATFORM_INFO__ = async function () {
    return invoke('platform_info');
  };

  process.stdout.write(['[SimpleBeacon Desktop] native bridge ready'].join(" ") + "\n");
})();
