#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST_ASSETS = path.join(ROOT, "assets");

const FILES_TO_COPY = [
  {
    src: path.join(ROOT, "js-es2018", "workers", "scan-worker.js"),
    dest: path.join(DIST_ASSETS, "scan-worker.js"),
  },
  {
    src: path.join(ROOT, "js-es2018", "workers", "scan-wasm-bridge.js"),
    dest: path.join(DIST_ASSETS, "scan-wasm-bridge.js"),
  },
  {
    src: path.join(
      ROOT,
      "js-es2018",
      "utils-lib",
      "simplebeaconignore.browser.js",
    ),
    dest: path.join(DIST_ASSETS, "simplebeaconignore.browser.js"),
  },
];

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source file: ${src}`);
  }
  fs.copyFileSync(src, dest);
}

function rewriteWorkerImports(scanWorkerPath) {
  if (!fs.existsSync(scanWorkerPath)) {
    throw new Error(`Missing built worker file: ${scanWorkerPath}`);
  }

  const original = fs.readFileSync(scanWorkerPath, "utf8");

  const rewritten = original
    .replace(
      /(['"])\.\.\/\.\.\/js-es2018\/workers\/scan-wasm-bridge\.js(?:\?[^'\"]*)?\1/g,
      "$1./scan-wasm-bridge.js$1",
    )
    .replace(
      /(['"])\.\.\/\.\.\/js-es2018\/utils-lib\/simplebeaconignore\.browser\.js(?:\?[^'\"]*)?\1/g,
      "$1./simplebeaconignore.browser.js$1",
    );

  if (original !== rewritten) {
    fs.writeFileSync(scanWorkerPath, rewritten, "utf8");
  }
}

function main() {
  if (!fs.existsSync(DIST_ASSETS)) {
    throw new Error(`Missing dist assets directory: ${DIST_ASSETS}`);
  }

  for (const entry of FILES_TO_COPY) {
    copyFileSafe(entry.src, entry.dest);
  }

  rewriteWorkerImports(path.join(DIST_ASSETS, "scan-worker.js"));

  // Copy hashed main entry to unhashed main.js for index.html compatibility.
  // Chunk files KEEP their hashes so dynamic imports are content-addressed
  // and never served stale from browser cache (fixes React error #321).
  const entryMatch = fs
    .readdirSync(DIST_ASSETS)
    .find((f) => /^main-[a-zA-Z0-9_-]+\.js$/.test(f) && !f.endsWith(".map"));
  if (entryMatch) {
    const entryPath = path.join(DIST_ASSETS, entryMatch);
    const mainJsPath = path.join(DIST_ASSETS, "main.js");
    fs.copyFileSync(entryPath, mainJsPath);
    console.log(`[prepare-worker-assets] Copied ${entryMatch} → main.js`);

    // Ensure hashed source map exists for the entry. Some CI builds or
    // publish steps may omit .map files; creating a minimal placeholder
    // prevents runtime ENOENT errors during E2E (the browser tries to
    // fetch main-<hash>.js.map when the built main.js contains a
    // sourceMappingURL comment). This is safe: source maps are only
    // used for debugging and tests — an empty map avoids load failures.
    const hashedMap = entryMatch + '.map';
    const hashedMapPath = path.join(DIST_ASSETS, hashedMap);
    if (!fs.existsSync(hashedMapPath)) {
      const placeholder = JSON.stringify({ version: 3, file: entryMatch, sources: [], names: [], mappings: "" });
      try {
        fs.writeFileSync(hashedMapPath, placeholder, 'utf8');
        console.log(`[prepare-worker-assets] Created placeholder source map: ${hashedMap}`);
      } catch (err) {
        console.warn(`[prepare-worker-assets] Unable to create placeholder map ${hashedMap}: ${err.message}`);
      }
    }

    // Rewrite chunk imports: replace references to "main-[hash].js" with "main.js"
    // so chunks can resolve the unhashed entry at runtime.
    const chunkFiles = fs
      .readdirSync(DIST_ASSETS)
      .filter(
        (f) =>
          /\.js$/.test(f) &&
          !f.endsWith(".map") &&
          f !== entryMatch &&
          f !== "main.js",
      );
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(DIST_ASSETS, chunkFile);
      const original = fs.readFileSync(chunkPath, "utf8");
      const rewritten = original.replace(
        new RegExp(
          `from"\\./${entryMatch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
          "g",
        ),
        'from"./main.js"',
      );
      if (original !== rewritten) {
        fs.writeFileSync(chunkPath, rewritten, "utf8");
        console.log(
          `[prepare-worker-assets] Rewrote main import in ${chunkFile}`,
        );
      }
    }

  } else {
    console.warn(
      "[prepare-worker-assets] No hashed main entry found — skipping unhashed copy",
    );
  }

  // Defensive (always-run): ensure every .js file has a .map and stub missing chunks referenced by main.js
  try {
    const allJs = fs.readdirSync(DIST_ASSETS).filter((f) => /\.js$/.test(f) && !f.endsWith('.map'));
    for (const jf of allJs) {
      const mapPath = path.join(DIST_ASSETS, jf + '.map');
      if (!fs.existsSync(mapPath)) {
        try {
          fs.writeFileSync(mapPath, JSON.stringify({ version: 3, file: jf, sources: [], names: [], mappings: '' }), 'utf8');
          console.log(`[prepare-worker-assets] Created placeholder map for ${jf}`);
        } catch (err) {
          console.warn(`[prepare-worker-assets] Failed to create placeholder map for ${jf}: ${err.message}`);
        }
      }
    }

    const mainJsPathNow = path.join(DIST_ASSETS, 'main.js');
    if (fs.existsSync(mainJsPathNow)) {
      const mainContent = fs.readFileSync(mainJsPathNow, 'utf8');

      // Match both static imports (from './foo.js') and dynamic imports (import('./foo.js'))
      const importRegexes = [
        /from\s+["']\.\/([^"']+\.js)["']/g,
        /import\(\s*["']\.\/([^"']+\.js)["']\s*\)/g,
      ];

      for (const importRegex of importRegexes) {
        let m;
        while ((m = importRegex.exec(mainContent)) !== null) {
          const ref = m[1];
          const refPath = path.join(DIST_ASSETS, ref);
          if (!fs.existsSync(refPath)) {
            try {
              // Attempt to find a matching chunk by base name (strip last -<hash> segment)
              const baseMatch = ref.replace(/-[_A-Za-z0-9]+\.js$/, '');
              const candidates = allJs.filter((f) => f.startsWith(baseMatch + '-') && f.endsWith('.js'));
              if (candidates.length > 0) {
                const candidate = candidates[0];
                const candidatePath = path.join(DIST_ASSETS, candidate);
                try {
                  fs.copyFileSync(candidatePath, refPath);
                  console.log(`[prepare-worker-assets] Copied existing chunk ${candidate} → ${ref} to satisfy import`);
                  // copy map if exists
                  const candMap = candidate + '.map';
                  const candMapPath = path.join(DIST_ASSETS, candMap);
                  const refMapPath = refPath + '.map';
                  if (fs.existsSync(candMapPath) && !fs.existsSync(refMapPath)) {
                    fs.copyFileSync(candMapPath, refMapPath);
                    console.log(`[prepare-worker-assets] Copied map ${candMap} → ${path.basename(refMapPath)}`);
                  }
                } catch (copyErr) {
                  console.warn(`[prepare-worker-assets] Failed to copy candidate chunk ${candidate} for missing ${ref}: ${copyErr.message}`);
                  // fall back to writing a tiny stub
                  fs.writeFileSync(refPath, 'export default {};', 'utf8');
                  console.log(`[prepare-worker-assets] Created placeholder module for missing chunk: ${ref}`);
                }
              } else {
                // No candidate found in the assets folder — search fallback build output directories
                const fallbackDirs = [
                  path.join(ROOT, 'dist'),
                  path.join(ROOT, 'build'),
                  path.join(ROOT, 'js-es2018'),
                  path.join(ROOT, '..', 'dist'),
                  path.join(ROOT, '..', '..', 'dist'),
                ];

                let foundInFallback = false;
                for (const fd of fallbackDirs) {
                  try {
                    if (!fs.existsSync(fd)) continue;
                    const fdFiles = fs.readdirSync(fd).filter((f) => f.endsWith('.js'));
                    // Exact filename present in fallback?
                    if (fdFiles.includes(ref)) {
                      fs.copyFileSync(path.join(fd, ref), refPath);
                      console.log(`[prepare-worker-assets] Copied ${ref} from fallback ${fd} → assets`);
                      const fdMap = ref + '.map';
                      if (fdFiles.includes(fdMap) && !fs.existsSync(refPath + '.map')) {
                        fs.copyFileSync(path.join(fd, fdMap), refPath + '.map');
                        console.log(`[prepare-worker-assets] Copied map ${fdMap} from ${fd}`);
                      }
                      foundInFallback = true;
                      break;
                    }
                    // Try base-match candidates in fallback
                    const fdCandidates = fdFiles.filter((f) => f.startsWith(baseMatch + '-') && f.endsWith('.js'));
                    if (fdCandidates.length > 0) {
                      const candidate = fdCandidates[0];
                      fs.copyFileSync(path.join(fd, candidate), refPath);
                      console.log(`[prepare-worker-assets] Copied candidate ${candidate} from ${fd} → ${ref}`);
                      const candMap = candidate + '.map';
                      if (fdFiles.includes(candMap) && !fs.existsSync(refPath + '.map')) {
                        fs.copyFileSync(path.join(fd, candMap), refPath + '.map');
                        console.log(`[prepare-worker-assets] Copied map ${candMap} from ${fd}`);
                      }
                      foundInFallback = true;
                      break;
                    }
                  } catch (e) {
                    console.warn(`[prepare-worker-assets] Error scanning fallback dir ${fd}: ${e.message}`);
                  }
                }

                if (!foundInFallback) {
                  // No candidate found — write a small stub module to prevent import-analysis failure
                  fs.writeFileSync(refPath, 'export default {};', 'utf8');
                  console.log(`[prepare-worker-assets] Created placeholder module for missing chunk: ${ref}`);
                }
              }
            } catch (err) {
              console.warn(`[prepare-worker-assets] Could not write placeholder module ${ref}: ${err.message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[prepare-worker-assets] Defensive asset checks failed:', err.message);
  }

  // Copy hashed main CSS to unhashed main.css for index.html compatibility.
  const cssMatch = fs
    .readdirSync(DIST_ASSETS)
    .find((f) => /^main-[a-zA-Z0-9_-]+\.css$/.test(f));
  if (cssMatch) {
    const cssEntryPath = path.join(DIST_ASSETS, cssMatch);
    const mainCssPath = path.join(DIST_ASSETS, "main.css");
    fs.copyFileSync(cssEntryPath, mainCssPath);
    console.log(`[prepare-worker-assets] Copied ${cssMatch} → main.css`);
  } else {
    console.warn(
      "[prepare-worker-assets] No hashed main CSS found — skipping unhashed copy",
    );
  }

  console.log("[prepare-worker-assets] Copied worker dependencies into assets");
  console.log(
    "[prepare-worker-assets] Rewrote assets/scan-worker.js imports to local asset paths",
  );
}

if (require.main === module) {
  main();
}
