const { validateRepoUrl, parseGithubRepoUrl } = require("../server/lib/path-safety.cjs");

describe("github repo URL validation", () => {
  test("validateRepoUrl accepts HTTPS github repository URLs", () => {
    const url = validateRepoUrl(
      "https://github.com/simplebeacon/simplebeacon-cli.git",
    );
    expect(url).toBe("https://github.com/simplebeacon/simplebeacon-cli.git");
  });

  test("validateRepoUrl rejects non-HTTPS hosts", () => {
    expect(() => validateRepoUrl("http://github.com/foo/bar")).toThrow(
      /HTTPS/i,
    );
  });

  test("parseGithubRepoUrl accepts trailing slash and .git", () => {
    expect(
      parseGithubRepoUrl("https://github.com/simplebeacon/simplebeacon-cli/"),
    ).toEqual(
      expect.objectContaining({
        owner: "simplebeacon",
        repo: "simplebeacon-cli",
        cloneUrl: "https://github.com/simplebeacon/simplebeacon-cli.git",
      }),
    );
    expect(
      parseGithubRepoUrl("https://github.com/simplebeacon/simplebeacon-cli.git"),
    ).toMatchObject({ owner: "simplebeacon", repo: "simplebeacon-cli" });
  });

  test("parseGithubRepoUrl reads tree branch", () => {
    expect(
      parseGithubRepoUrl("https://github.com/simplebeacon/cli/tree/main"),
    ).toMatchObject({
      owner: "simplebeacon",
      repo: "cli",
      branch: "main",
    });
  });

  test("parseGithubRepoUrl rejects org pages and non-github hosts", () => {
    expect(() => parseGithubRepoUrl("https://github.com/simplebeacon")).toThrow(
      /owner\/repo/i,
    );
    expect(() => parseGithubRepoUrl("https://gitlab.com/foo/bar")).toThrow(
      /GitHub repository URL/i,
    );
  });
});
