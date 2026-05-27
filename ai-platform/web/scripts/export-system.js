/**
 * Auto-generated loader splitting oversized script for safer delivery.
 * Keeps behavior by loading parts sequentially in source order.
 */
(function loadChunkedScript() {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.__export_system_loaded) {
        return;
    }
    window.__export_system_loaded = true;

    const parts = ['export-system.part1.js', 'export-system.part2.js', 'export-system.part3.js', 'export-system.part4.js', 'export-system.part5.js'];
    const version = '20260525-opt3';

    const loadPart = (idx) => {
        if (idx >= parts.length) {
            return;
        }
        const script = document.createElement('script');
        script.src = `/scripts/${parts[idx]}?v=${version}`;
        script.async = false;
        script.onload = () => loadPart(idx + 1);
        script.onerror = () => {
            console.error(`[chunk-loader] Failed to load ${parts[idx]}`);
        };
        document.head.appendChild(script);
    };

    loadPart(0);
})();
