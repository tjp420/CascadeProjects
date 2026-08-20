// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');

const sourceDir = 'C:\\Users\\Trevor\\CascadeProjects\\simplebeacon-vscode-merged\\.vsix-patch-temp';
const vsixPath =
  'C:\\Users\\Trevor\\CascadeProjects\\simplebeacon-vscode-merged\\releases\\simplebeacon-3.0.388-patched.vsix';

if (fs.existsSync(vsixPath)) {
  fs.unlinkSync(vsixPath);
}

const archiver = require('C:\\Users\\Trevor\\CascadeProjects\\node_modules\\archiver');
const output = fs.createWriteStream(vsixPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log('VSIX created:', vsixPath, archive.pointer(), 'bytes');
});

archive.on('error', (err) => {
  throw err;
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Warning:', err.message);
  } else {
    throw err;
  }
});

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
