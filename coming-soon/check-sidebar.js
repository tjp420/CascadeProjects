const http = require('http');
const req = http.get('http://127.0.0.1:64512/', res => {
    let d = '';
    res.on('data', c => (d += c));
    res.on('end', () => {
        const s = d.toLowerCase().indexOf('sidebar');
        const f = d.indexOf('id="sidebar"');
        const i = d.indexOf('sidebarFrame');
        process.exit(s > 0 || f > 0 || i > 0 ? 0 : 1);
    });
});
req.setTimeout(5000);
req.on('error', e => {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
});
