import {
  buildContextBrief,
  buildWorkspaceContextPayload,
  collectFunctionNames,
  collectImportLines,
} from "../ai-context-brief";

describe("buildContextBrief", () => {
  const sample = `
import { validateUser } from "./validation.js";
const session = require("./session.js");

function login() {
  return true;
}

const createLoginResponse = () => {
  return {};
};
`;

  it("lists imports, functions, and constraint lines", () => {
    const brief = buildContextBrief(
      {
        fileName: "C:/proj/src/auth/login.js",
        languageId: "javascript",
        getText: () => sample,
        uri: { fsPath: "C:/proj/src/auth/login.js" },
      },
      "C:/proj",
    );

    expect(brief).toContain("File: src/auth/login.js");

    expect(brief).toContain("[SIMPLEBEACON AI CONTEXT]");
    expect(brief).toContain("import { validateUser } from \"./validation.js\";");
    expect(brief).toContain("const session = require(\"./session.js\");");
    expect(brief).toContain("- login");
    expect(brief).toContain("- createLoginResponse");
    expect(brief).toContain("not a security verdict");
    expect(brief).not.toContain("token saved");
  });

  it("collectImportLines ignores non-import const", () => {
    const lines = collectImportLines(
      "const x = 1;\nrequire('./x');\n",
      "javascript",
    );
    expect(lines).toEqual(["require('./x');"]);
  });

  it("collectFunctionNames dedupes", () => {
    const names = collectFunctionNames(
      "function foo() {}\nfunction foo() {}\nconst bar = () => {}",
    );
    expect(names).toEqual(["foo", "bar"]);
  });
});

describe("buildWorkspaceContextPayload", () => {
  const sample = `
import { validateUser } from "./validation.js";
function login() { return true; }
`;

  const document = {
    fileName: "C:/proj/src/auth/login.js",
    languageId: "javascript",
    getText: () => sample,
    uri: { fsPath: "C:/proj/src/auth/login.js" },
  };

  it("returns JSON facts without inventing symbols", () => {
    const payload = buildWorkspaceContextPayload({
      document,
      workspaceRoot: "C:/proj",
      existsFn: () => false,
    });
    expect(payload.status).toBe("ok");
    expect(payload.simplebeacon.operation).toBe("workspace_verification");
    expect(payload.file).toEqual({ path: "src/auth/login.js", exists: true });
    expect(payload.functions).toContain("login");
    expect(payload.imports).toContain("./validation.js");
    expect(payload.relevantFiles).toEqual(["src/auth/login.js"]);
    expect(payload.unresolvedImports).toContain("./validation.js");
    expect(payload.constraints).toContain("do_not_invent_symbols");
  });

  it("marks verifySymbol as not_found when undeclared", () => {
    const payload = buildWorkspaceContextPayload({
      document,
      workspaceRoot: "C:/proj",
      input: { verifySymbol: "calculateRisk" },
      existsFn: () => false,
    });
    expect(payload.simplebeacon.verified).toBe(false);
    expect(payload.symbols.notFound).toEqual(["calculateRisk"]);
    expect(payload.symbols.status.calculateRisk).toBe("not_found");
    expect(payload.verification).toEqual([
      {
        symbol: "calculateRisk",
        status: "not_found",
        file: "src/auth/login.js",
      },
    ]);
    expect(payload.blockers).toEqual([
      {
        type: "missing_symbol",
        file: "src/auth/login.js",
        symbol: "calculateRisk",
        status: "not_found",
      },
    ]);
    expect(payload.evidence.some((row) => row.symbol === "calculateRisk" && row.exists === false)).toBe(
      true,
    );
  });

  it("includes resolved relative imports in relevantFiles", () => {
    const payload = buildWorkspaceContextPayload({
      document,
      workspaceRoot: "C:/proj",
      existsFn: (absPath) => absPath.replace(/\\/g, "/").endsWith("src/auth/validation.js"),
    });
    expect(payload.relevantFiles).toEqual([
      "src/auth/login.js",
      "src/auth/validation.js",
    ]);
    expect(payload.unresolvedImports).toEqual([]);
  });

  it("reports missing requested files without guessing", () => {
    const payload = buildWorkspaceContextPayload({
      document: null,
      input: { requestedFile: "C:/proj/src/missing.js" },
      fileExists: false,
    });
    expect(payload.status).toBe("error");
    expect(payload.file.exists).toBe(false);
    expect(payload.reason).toBe("Requested file does not exist");
    expect(payload.blockers[0]).toEqual({
      type: "missing_file",
      file: "C:/proj/src/missing.js",
      status: "not_found",
    });
  });

  it("errors when there is no document", () => {
    const payload = buildWorkspaceContextPayload({ document: null });
    expect(payload.status).toBe("error");
    expect(payload.reason).toBe("No active editor");
  });
});
