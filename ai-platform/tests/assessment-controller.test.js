/**
 * Assessment Controller Tests
 * Covers AssessmentController methods and route delegation.
 */

const fs = require("fs");
const path = require("path");

// Manual mocks for controller dependencies
jest.mock("../server/lib/simplebeacon-proxy.cjs", () => ({
  buildAssessmentReport: jest.fn((_scan, opts) => ({
    executiveSummary: "Test summary",
    complianceChecklist: { summary: "pass" },
    findings: { critical: { findings: 0 } },
    metadata: opts,
  })),
  evaluateGate: jest.fn(() => ({ pass: true, blockingCount: 0 })),
  formatJsonReport: jest.fn((report) => report),
  loadSimplebeaconConfig: jest.fn(() => ({
    configPath: "/tmp/.simplebeacon/config.json",
    gate: { failOn: ["high"] },
  })),
  resolvePlatformRoot: jest.fn((p) => ({ platformRoot: p })),
  runScan: jest.fn(async () => ({
    type: "simplebeacon-report",
    issueCount: 0,
  })),
  sanitizeScanReport: jest.fn((r) => r),
}));

jest.mock("../server/lib/path-safety.cjs", () => ({
  validateRepoUrl: jest.fn((url) => url),
  resolveDefaultAllowedRoots: jest.fn(() => ["/allowed/root"]),
  assertSafeProjectPath: jest.fn((_p, _roots, label) => {
    if (_p.includes("unsafe")) throw new Error("outside allowed");
    return _p;
  }),
}));

jest.mock("../shared-utils/index.cjs", () => ({
  toClientError: jest.fn((err, fallback) => err.message || fallback),
}));

jest.mock("../server/lib/assessment-retention.cjs", () => ({
  startAssessmentRetentionJob: jest.fn(),
  resolveAssessmentTtlMs: jest.fn(() => 7 * 24 * 60 * 60 * 1000),
}));

const AssessmentController = require("../server/api/assessment/AssessmentController.cjs");

describe("AssessmentController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("resolveAssessmentId", () => {
    test("returns params.id when present", () => {
      expect(
        AssessmentController.resolveAssessmentId({ params: { id: "abc" } }),
      ).toBe("abc");
    });

    test("returns params.assessmentId as fallback", () => {
      expect(
        AssessmentController.resolveAssessmentId({
          params: { assessmentId: "xyz" },
        }),
      ).toBe("xyz");
    });
  });

  describe("triggerScan", () => {
    test("delegates to createAssessment", async () => {
      const spy = jest
        .spyOn(AssessmentController, "createAssessment")
        .mockResolvedValue();
      const req = { body: {} };
      const res = {};
      await AssessmentController.triggerScan(req, res);
      expect(spy).toHaveBeenCalledWith(req, res);
      spy.mockRestore();
    });
  });

  describe("getReport", () => {
    test("delegates to getAssessment with resolved id", async () => {
      const spy = jest
        .spyOn(AssessmentController, "getAssessment")
        .mockResolvedValue();
      const req = { params: { id: "rpt-1" } };
      const res = {};
      await AssessmentController.getReport(req, res);
      expect(req.params.assessmentId).toBe("rpt-1");
      expect(spy).toHaveBeenCalledWith(req, res);
      spy.mockRestore();
    });
  });

  describe("downloadReport", () => {
    test("delegates to downloadAssessment with resolved id", async () => {
      const spy = jest
        .spyOn(AssessmentController, "downloadAssessment")
        .mockResolvedValue();
      const req = { params: { id: "dl-1" } };
      const res = {};
      await AssessmentController.downloadReport(req, res);
      expect(req.params.assessmentId).toBe("dl-1");
      expect(spy).toHaveBeenCalledWith(req, res);
      spy.mockRestore();
    });
  });

  describe("createAssessment — public (no auth)", () => {
    test("returns 403 when projectPath supplied without auth", async () => {
      const req = { body: { projectPath: "/some/path" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await AssessmentController.createAssessment(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error:
            "projectPath requires sign-in; use repoUrl for public assessments",
        }),
      );
    });

    test("returns 400 when repoUrl missing and no auth", async () => {
      const req = { body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await AssessmentController.createAssessment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "repoUrl is required for public assessments",
        }),
      );
    });
  });

  describe("getAssessment", () => {
    test("returns 404 when assessment file missing", async () => {
      const req = { params: { id: "missing-id" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      jest
        .spyOn(AssessmentController, "readAssessment")
        .mockRejectedValue({ code: "ENOENT" });

      await AssessmentController.getAssessment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    test("returns assessment when found", async () => {
      const req = { params: { id: "found-id" } };
      const res = { json: jest.fn() };

      jest
        .spyOn(AssessmentController, "readAssessment")
        .mockResolvedValue({ score: 95 });

      await AssessmentController.getAssessment(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          assessmentId: "found-id",
          assessment: { score: 95 },
        }),
      );
    });
  });

  describe("downloadAssessment", () => {
    test("returns 404 when file missing", async () => {
      const req = { params: { id: "missing-dl", format: "json" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      const origReadFile = fs.promises.readFile;
      fs.promises.readFile = jest.fn().mockRejectedValue({ code: "ENOENT" });

      await AssessmentController.downloadAssessment(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      fs.promises.readFile = origReadFile;
    });

    test("sends JSON attachment for format=json", async () => {
      const req = { params: { id: "dl-ok", format: "json" } };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const origReadFile = fs.promises.readFile;
      fs.promises.readFile = jest.fn().mockResolvedValue('{"score":99}');

      await AssessmentController.downloadAssessment(req, res);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/json",
      );
      expect(res.send).toHaveBeenCalledWith('{"score":99}');

      fs.promises.readFile = origReadFile;
    });

    test("returns parsed JSON for unknown format", async () => {
      const req = { params: { id: "dl-ok", format: "html" } };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const origReadFile = fs.promises.readFile;
      fs.promises.readFile = jest.fn().mockResolvedValue('{"score":88}');

      await AssessmentController.downloadAssessment(req, res);
      expect(res.json).toHaveBeenCalledWith({ score: 88 });

      fs.promises.readFile = origReadFile;
    });
  });

  describe("readAssessment", () => {
    test("returns parsed assessment JSON", async () => {
      const origReadFile = fs.promises.readFile;
      fs.promises.readFile = jest.fn().mockResolvedValue('{"id":"a1"}');

      const result = await AssessmentController.readAssessment("a1");
      expect(result).toEqual({ id: "a1" });

      fs.promises.readFile = origReadFile;
    });

    test("throws ENOENT when file missing", async () => {
      const origReadFile = fs.promises.readFile;
      fs.promises.readFile = jest
        .fn()
        .mockRejectedValue({ code: "ENOENT", message: "not found" });

      await expect(
        AssessmentController.readAssessment("gone"),
      ).rejects.toMatchObject({ code: "ENOENT" });

      fs.promises.readFile = origReadFile;
    });
  });

  describe("createAssessment — authenticated success", () => {
    test("creates assessment with repoUrl", async () => {
      const req = {
        body: {
          repoUrl: "https://github.com/user/repo",
          company: "Acme",
          email: "a@b.com",
          assessmentType: "full",
        },
        user: { id: "u1", email: "a@b.com" },
      };
      const res = { json: jest.fn() };

      const origCloneRepo = AssessmentController.cloneRepo;
      AssessmentController.cloneRepo = jest
        .fn()
        .mockResolvedValue("/cloned/path");
      const origRemoveClonedSource = AssessmentController.removeClonedSource;
      AssessmentController.removeClonedSource = jest.fn().mockResolvedValue();
      const origRunScan = AssessmentController.runSimplebeaconScan;
      AssessmentController.runSimplebeaconScan = jest
        .fn()
        .mockResolvedValue({ issueCount: 0 });
      const origWriteFile = fs.promises.writeFile;
      fs.promises.writeFile = jest.fn().mockResolvedValue();
      const origMkdir = fs.promises.mkdir;
      fs.promises.mkdir = jest.fn().mockResolvedValue();

      await AssessmentController.createAssessment(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          assessmentId: expect.stringMatching(/^assessment_\d+$/),
          reportUrl: expect.stringMatching(
            /\/api\/assessment\/report\/assessment_\d+$/,
          ),
        }),
      );

      AssessmentController.cloneRepo = origCloneRepo;
      AssessmentController.removeClonedSource = origRemoveClonedSource;
      AssessmentController.runSimplebeaconScan = origRunScan;
      fs.promises.writeFile = origWriteFile;
      fs.promises.mkdir = origMkdir;
    });

    test("creates assessment with bodyPath when authenticated", async () => {
      const req = {
        body: { projectPath: "/allowed/root", company: "TestCo" },
        user: { id: "u2" },
      };
      const res = { json: jest.fn() };

      const origRunScan = AssessmentController.runSimplebeaconScan;
      AssessmentController.runSimplebeaconScan = jest
        .fn()
        .mockResolvedValue({ issueCount: 0 });
      const origWriteFile = fs.promises.writeFile;
      fs.promises.writeFile = jest.fn().mockResolvedValue();
      const origMkdir = fs.promises.mkdir;
      fs.promises.mkdir = jest.fn().mockResolvedValue();

      await AssessmentController.createAssessment(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );

      AssessmentController.runSimplebeaconScan = origRunScan;
      fs.promises.writeFile = origWriteFile;
      fs.promises.mkdir = origMkdir;
    });

    test("handles scan failure gracefully", async () => {
      const req = {
        body: { repoUrl: "https://github.com/user/repo" },
        user: { id: "u3" },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      const origCloneRepo = AssessmentController.cloneRepo;
      AssessmentController.cloneRepo = jest
        .fn()
        .mockResolvedValue("/cloned/path");
      const origRemoveClonedSource = AssessmentController.removeClonedSource;
      AssessmentController.removeClonedSource = jest.fn().mockResolvedValue();
      const origRunScan = AssessmentController.runSimplebeaconScan;
      AssessmentController.runSimplebeaconScan = jest
        .fn()
        .mockRejectedValue(new Error("scan failed"));
      const origMkdir = fs.promises.mkdir;
      fs.promises.mkdir = jest.fn().mockResolvedValue();

      await AssessmentController.createAssessment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );

      AssessmentController.cloneRepo = origCloneRepo;
      AssessmentController.removeClonedSource = origRemoveClonedSource;
      AssessmentController.runSimplebeaconScan = origRunScan;
      fs.promises.mkdir = origMkdir;
    });
  });

  describe("readAssessment errors", () => {
    test("throws wrapped error for non-ENOENT failures", async () => {
      const origReadFile = fs.promises.readFile;
      fs.promises.readFile = jest
        .fn()
        .mockRejectedValue(new Error("disk full"));

      await expect(AssessmentController.readAssessment("bad")).rejects.toThrow(
        /Failed to read assessment/,
      );

      fs.promises.readFile = origReadFile;
    });
  });

  describe("removeClonedSource", () => {
    test("removes repo directory when present", async () => {
      const origExistsSync = fs.existsSync;
      const origRm = fs.promises.rm;
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.promises.rm = jest.fn().mockResolvedValue();

      await AssessmentController.removeClonedSource("/tmp/assessment_123");
      expect(fs.promises.rm).toHaveBeenCalled();

      fs.existsSync = origExistsSync;
      fs.promises.rm = origRm;
    });

    test("silently skips when repo dir missing", async () => {
      const origExistsSync = fs.existsSync;
      const origRm = fs.promises.rm;
      fs.existsSync = jest.fn().mockReturnValue(false);
      fs.promises.rm = jest.fn().mockResolvedValue();

      await AssessmentController.removeClonedSource("/tmp/assessment_456");
      expect(fs.promises.rm).not.toHaveBeenCalled();

      fs.existsSync = origExistsSync;
      fs.promises.rm = origRm;
    });
  });
});
