const adminApi = require("../routes/admin-api.cjs");

describe("admin-api routes", () => {
  test("exports setupAdminAPI", () => {
    expect(adminApi).toHaveProperty("setupAdminAPI");
    expect(typeof adminApi.setupAdminAPI).toBe("function");
  });
});
