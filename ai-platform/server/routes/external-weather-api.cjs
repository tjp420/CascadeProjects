const rateLimit = require("express-rate-limit");
const logger = require("../../src/lib/app-logger.cjs");
const { getWeather } = require("../services/weather-service.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

function setupExternalWeatherAPI(app, options = {}) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.EXTERNAL_WEATHER_RATE_LIMIT || 60),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the deprecated `X-RateLimit-*` headers
    message: {
      success: false,
      error: "Too many requests — please try again later.",
    },
    keyGenerator: (req) => {
      if (rateLimit && typeof rateLimit.ipKeyGenerator === "function") {
        try {
          return rateLimit.ipKeyGenerator(req.ip);
        } catch (err) {
          return req.ip;
        }
      }
      return req.ip;
    },
  });

  app.get("/api/external/weather", limiter, async (req, res) => {
    const city = req.query.city || req.query.q || "";
    if (!city) return sendError(res, 400, "city query parameter is required");
    try {
      const data = await getWeather(city);
      return res.json({ success: true, city: city, data });
    } catch (err) {
      logger.warn("[ExternalWeather] Failed to fetch weather:", err.message);
      return sendError(res, 502, "Failed to fetch weather", {
        details: err.message,
      });
    }
  });

  logger.info("[ExternalWeather] Route mounted at /api/external/weather");
}

module.exports = setupExternalWeatherAPI;
