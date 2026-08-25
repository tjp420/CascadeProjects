"use strict";

/**
 * Benchmark directory walk performance on a synthetic large tree.
 * Measures: walkAllFiles (full-directory-scanner), walkProjectFiles (project-walker),
 * and countRepositoryInventory (repository-inventory).
 *
 * Usage: node tests/bench-directory-walk.js [--files N] [--depth D]
 * Defaults: 5000 files, depth 5
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { performance } = require("node:perf_hooks");

const args = process.argv.slice(2);
let targetFiles = 5000;
let maxDepth = 5;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--files" && args[i + 1]) {
    targetFiles = parseInt(args[i + 1], 10);
  }
  if (args[i] === "--depth" && args[i + 1]) {
    maxDepth = parseInt(args[i + 1], 10);
  }
}

function generateSyntheticTree(root, totalFiles, depth) {
  const filesPerDir = Math.ceil(totalFiles / Math.max(1, depth * 10));
  let created = 0;

  function populate(dir, currentDepth) {
    if (created >= totalFiles) return;
    if (currentDepth >= depth) {
      for (let i = 0; i < filesPerDir && created < totalFiles; i += 1) {
        fs.writeFileSync(
          path.join(dir, `file_${created}.js`),
          `// file ${created}\nconst x = ${created};\n`,
        );
        created += 1;
      }
      return;
    }
    const subDirs = 5;
    for (let d = 0; d < subDirs; d += 1) {
      const subDir = path.join(dir, `dir_${d}`);
      fs.mkdirSync(subDir, { recursive: true });
      for (
        let i = 0;
        i < filesPerDir / subDirs && created < totalFiles;
        i += 1
      ) {
        fs.writeFileSync(
          path.join(subDir, `file_${created}.js`),
          `// file ${created}\nconst x = ${created};\n`,
        );
        created += 1;
      }
      populate(subDir, currentDepth + 1);
    }
  }

  fs.mkdirSync(root, { recursive: true });
  populate(root, 0);
  return created;
}

async function main() {
  const tmpDir = path.join(os.tmpdir(), `sb-bench-${Date.now()}`);
  console.log(
    `Generating synthetic tree: ${targetFiles} files, depth ${maxDepth}...`,
  );
  const startGen = performance.now();
  const actualFiles = generateSyntheticTree(tmpDir, targetFiles, maxDepth);
  const genMs = Math.round(performance.now() - startGen);
  console.log(`  Created ${actualFiles} files in ${genMs}ms`);

  // Benchmark walkAllFiles
  const { walkAllFiles } = require("../src/lib/full-directory-scanner");
  const t1 = performance.now();
  const result1 = await walkAllFiles(tmpDir, {
    skipDirs: new Set(["node_modules", ".git"]),
  });
  const walkAllMs = Math.round(performance.now() - t1);
  console.log(
    `\nwalkAllFiles:          ${walkAllMs}ms  (${result1.files.length} files, ${result1.totalFolders} folders)`,
  );

  // Benchmark walkProjectFiles
  const {
    walkProjectFiles,
  } = require("../src/analyzers/file-reduction/utils/project-walker");
  const t2 = performance.now();
  const result2 = await walkProjectFiles(tmpDir);
  const walkProjMs = Math.round(performance.now() - t2);
  console.log(
    `walkProjectFiles:      ${walkProjMs}ms  (${result2.files.length} files, ${result2.directories.length} dirs)`,
  );

  // Benchmark countRepositoryInventory
  const {
    countRepositoryInventory,
  } = require("../src/lib/repository-inventory");
  const t3 = performance.now();
  const result3 = await countRepositoryInventory(tmpDir, { profile: "audit" });
  const invMs = Math.round(performance.now() - t3);
  console.log(
    `countRepositoryInv:    ${invMs}ms  (${result3.totalFiles} files, ${result3.totalFolders} folders)`,
  );

  console.log(`\nSummary:`);
  console.log(`  walkAllFiles:       ${walkAllMs}ms`);
  console.log(`  walkProjectFiles:   ${walkProjMs}ms`);
  console.log(`  countInventory:     ${invMs}ms`);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
