// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**
 * Authentication Integration Tests
 *
 * Tests the authentication flow including login, token refresh, and protected routes.
 */

const request = require("supertest");
const express = require("express");
const {
  authenticate,
  handleLogin,
  handleTokenRefresh,
} = require("../../server/middleware/auth.cjs");
const jwt = require("jsonwebtoken");

describe("Authentication Integration", () => {
  let app;
  let testUser;
  let validToken;
  let refreshToken;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(express.json());

    // Test user data
    testUser = {
      id: "test-user-123",
      email: "test@example.com",
      name: "Test User",
      trustLevel: "gold",
      permissions: ["read:own", "write:own"],
    };

    // Mock login endpoint
    app.post("/api/auth/login", async (req, res, next) => {
      try {
        const { email, password } = req.body;

        // Mock authentication logic
        if (email === "test@example.com" && password === "test123") {
          const token = jwt.sign(
            {
              id: testUser.id,
              email: testUser.email,
              name: testUser.name,
              trustLevel: testUser.trustLevel,
              permissions: testUser.permissions,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "1h" },
          );

          const refresh = jwt.sign(
            { id: testUser.id, type: "refresh" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" },
          );

          validToken = token;
          refreshToken = refresh;

          res.json({
            success: true,
            token,
            refreshToken,
            user: {
              id: testUser.id,
              email: testUser.email,
              name: testUser.name,
              trustLevel: testUser.trustLevel,
              permissions: testUser.permissions,
            },
          });
        } else {
          res.status(401).json({
            success: false,
            error: "Invalid credentials",
          });
        }
      } catch (error) {
        next(error);
      }
    });

    // Protected endpoint
    app.get("/api/protected", authenticate, (req, res) => {
      res.json({
        success: true,
        user: req.user,
        message: "Access granted",
      });
    });

    // Token refresh endpoint
    app.post("/api/auth/refresh", async (req, res, next) => {
      try {
        const { refreshToken: token } = req.body;

        if (!token) {
          return res.status(401).json({
            success: false,
            error: "Refresh token required",
          });
        }

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

        if (decoded.type !== "refresh") {
          return res.status(401).json({
            success: false,
            error: "Invalid refresh token",
          });
        }

        const newToken = jwt.sign(
          {
            id: decoded.id,
            email: testUser.email,
            name: testUser.name,
            trustLevel: testUser.trustLevel,
            permissions: testUser.permissions,
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || "1h" },
        );

        res.json({
          success: true,
          token: newToken,
          user: {
            id: testUser.id,
            email: testUser.email,
            name: testUser.name,
            trustLevel: testUser.trustLevel,
            permissions: testUser.permissions,
          },
        });
      } catch (error) {
        if (error.name === "JsonWebTokenError") {
          return res.status(401).json({
            success: false,
            error: "Invalid refresh token",
          });
        }
        next(error);
      }
    });

    // Public endpoint
    app.get("/api/public", (req, res) => {
      res.json({
        success: true,
        message: "Public access granted",
      });
    });
  });

  describe("POST /api/auth/login", () => {
    it("should authenticate with valid credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "test123",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user.email).toBe("test@example.com");
    });

    it("should reject invalid credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should reject missing credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/protected", () => {
    it("should allow access with valid token", async () => {
      const response = await request(app)
        .get("/api/protected")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe("test@example.com");
      expect(response.body.message).toBe("Access granted");
    });

    it("should reject access without token", async () => {
      const response = await request(app).get("/api/protected");

      expect(response.status).toBe(401);
    });

    it("should reject access with invalid token", async () => {
      const response = await request(app)
        .get("/api/protected")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
    });

    it("should reject access with malformed token", async () => {
      const response = await request(app)
        .get("/api/protected")
        .set("Authorization", "Bearer malformed.token.here");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh token with valid refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({
        refreshToken: refreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe("test@example.com");
    });

    it("should reject refresh without token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Refresh token required");
    });

    it("should reject invalid refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({
        refreshToken: "invalid-refresh-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid refresh token");
    });
  });

  describe("GET /api/public", () => {
    it("should allow public access", async () => {
      const response = await request(app).get("/api/public");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Public access granted");
    });
  });

  describe("JWT Token Validation", () => {
    it("should create valid JWT token", () => {
      const token = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
    });

    it("should reject expired token", () => {
      const expiredToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" }, // Expired 1 hour ago
      );

      expect(() => {
        jwt.verify(expiredToken, process.env.JWT_SECRET);
      }).toThrow(jwt.TokenExpiredError);
    });

    it("should reject token with wrong secret", () => {
      const token = jwt.sign(
        { id: testUser.id, email: testUser.email },
        "wrong-secret",
        { expiresIn: "1h" },
      );

      expect(() => {
        jwt.verify(token, process.env.JWT_SECRET);
      }).toThrow(jwt.JsonWebTokenError);
    });
  });

  describe("Token Payload Validation", () => {
    it("should include required user fields in token", () => {
      const token = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
          trustLevel: testUser.trustLevel,
          permissions: testUser.permissions,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.id).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.name).toBe(testUser.name);
      expect(decoded.trustLevel).toBe(testUser.trustLevel);
      expect(decoded.permissions).toEqual(testUser.permissions);
    });

    it("should handle missing user fields gracefully", () => {
      const minimalToken = jwt.sign(
        { id: testUser.id, email: testUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );

      const decoded = jwt.verify(minimalToken, process.env.JWT_SECRET);

      expect(decoded.id).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.name).toBeUndefined();
      expect(decoded.trustLevel).toBeUndefined();
      expect(decoded.permissions).toBeUndefined();
    });
  });
});
