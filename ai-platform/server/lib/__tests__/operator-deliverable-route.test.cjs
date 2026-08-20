"use strict";

jest.mock("../operator-deliverable-service.cjs", () => ({
  createDeliverableWorkspace: jest.fn(),
  listProducts: jest
    .fn()
    .mockReturnValue([{ id: "clearance499", label: "Clearance" }]),
  vaultUrls: jest.fn().mockReturnValue({ dashboard: "http://localhost:3000" }),
  inferProductFromBooking: jest.fn().mockReturnValue("clearance499"),
}));
jest.mock("../audit-booking-route.cjs", () => ({
  loadBookings: jest.fn().mockResolvedValue([]),
}));

const {
  registerOperatorDeliverableRoute,
} = require("../operator-deliverable-route.cjs");
const {
  listProducts,
  vaultUrls,
} = require("../operator-deliverable-service.cjs");

describe("operator-deliverable-route", () => {
  test("exports registerOperatorDeliverableRoute function", () => {
    expect(typeof registerOperatorDeliverableRoute).toBe("function");
  });

  test("registerOperatorDeliverableRoute registers GET and POST routes", () => {
    const app = { get: jest.fn(), post: jest.fn() };
    registerOperatorDeliverableRoute(app, {});
    expect(app.get).toHaveBeenCalledWith(
      "/api/operator/products",
      expect.any(Function),
    );
    expect(app.get).toHaveBeenCalledWith(
      "/api/operator/bootstrap",
      expect.any(Function),
    );
    expect(app.post).toHaveBeenCalledWith(
      "/api/operator/deliverable",
      expect.any(Function),
    );
  });

  test("GET /api/operator/products returns product list", () => {
    const app = { get: jest.fn(), post: jest.fn() };
    registerOperatorDeliverableRoute(app, {});
    const productsHandler = app.get.mock.calls.find(
      (c) => c[0] === "/api/operator/products",
    )[1];
    const res = { json: jest.fn() };
    productsHandler({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        products: expect.any(Array),
      }),
    );
  });

  test("GET /api/operator/bootstrap returns vault urls", () => {
    const app = { get: jest.fn(), post: jest.fn() };
    registerOperatorDeliverableRoute(app, {});
    const bootstrapHandler = app.get.mock.calls.find(
      (c) => c[0] === "/api/operator/bootstrap",
    )[1];
    const res = { json: jest.fn() };
    bootstrapHandler({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        urls: expect.any(Object),
        defaultProduct: "clearance499",
      }),
    );
  });
});
