// simplebeacon-ignore test-coverage
/**
 * Combined ZScript mod report — structure, CVAR map, intensity diagnostics.
 */

const path = require("path");
const {
  buildStructureReport,
  collectZscriptFiles,
} = require("./zscript-structure-analyzer.cjs");
const { buildCvarReport } = require("./zscript-cvar-analyzer.cjs");

/**
 * Generate zscript mod report.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
async function generateZscriptModReport(projectPath, options = {}) {
  const rootDir = path.resolve(projectPath);
  const focus = String(options.focus || "lighting-intensity").toLowerCase();

  const structure = await buildStructureReport(rootDir, options);
  const zscriptFiles = await collectZscriptFiles(rootDir, options);
  const cvars = await buildCvarReport(rootDir, zscriptFiles, options);

  const report = {
    type: "zscript-mod-report",
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: "simplebeacon-zscript-analyzer",
    projectRoot: rootDir,
    focus,
    structure: {
      filesScanned: structure.filesScanned,
      truncatedFiles: structure.truncatedFiles,
      zscript_files: structure.zscript_files,
      class_hierarchy: structure.classHierarchy,
      entry_points: structure.entryPoints,
    },
    cvars,
    function_analysis: structure.function_analysis,
    problem_diagnosis: buildProblemDiagnosis(focus, cvars, structure),
    limitations: [
      "Heuristic parser — not a full ZScript compiler; verify findings in GZDoom.",
      "CVAR current_value reflects defaults from CVARINFO only (not live in-game values).",
      "Function bodies summarized by pattern — read cited files for exact math.",
    ],
  };

  return report;
}

/**
 * Build problem diagnosis.
 * @param {Array} focus
 * @param {any} cvarSection
 * @param {string} structure
 * @returns {any}
 */
function buildProblemDiagnosis(focus, cvarSection, structure) {
  if (focus !== "lighting-intensity") {
    return {
      focus,
      notes: "No specialized diagnosis template for this focus yet.",
    };
  }

  const intensityCvars = cvarSection.intensityCvars || [];
  const hints = cvarSection.problemHints || [];

  return {
    focus: "lighting-intensity",
    problem:
      "Global/per-channel intensity scaling may not produce visible differences between CVAR values",
    affected_files: collectAffectedFiles(structure, cvarSection),
    symptoms: [
      "Changing intensity CVARs may not change rendered brightness",
      "Multiple intensity CVARs (global float vs player/item multiplier) can confuse which control is active",
    ],
    cvar_candidates: intensityCvars,
    suspected_root_causes: hints,
    recommended_validation: [
      "In-game: set r3d_lite_intensity to 100 vs 1500 and compare brightness",
      "Confirm UnifiedLightingHandler.UpdateCVARs assigns masterIntensity each tick",
      "Trace whether light actors call AdjustBrightness/CalculateLightIntensity with masterIntensity",
      "Check player/item paths use r3d_lite_player_intensity vs global r3d_lite_intensity",
    ],
    test_matrix_template: {
      test_case_1: {
        input: "r3d_lite_intensity = 100",
        expected: "Dim ambient/dynamic lighting",
        actual: "(fill in after in-game test)",
        status: "PENDING",
      },
      test_case_2: {
        input: "r3d_lite_intensity = 1500",
        expected: "Bright ambient/dynamic lighting",
        actual: "(fill in after in-game test)",
        status: "PENDING",
      },
    },
  };
}

/**
 * Collect affected files.
 * @param {string} structure
 * @param {any} cvarSection
 * @returns {any}
 */
function collectAffectedFiles(structure, cvarSection) {
  const files = new Set();
  for (const hint of cvarSection.scalingHints || []) {
    files.add(hint.filePath);
  }
  for (const name of Object.keys(structure.function_analysis || {})) {
    files.add(structure.function_analysis[name].filePath);
  }
  for (const ref of cvarSection.intensityCvars || []) {
    const usage = cvarSection.cvars?.[ref]?.usedIn || [];
    for (const u of usage) files.add(u.filePath);
  }
  return [...files].slice(0, 25);
}

module.exports = {
  generateZscriptModReport,
};
