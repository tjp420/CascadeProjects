const rateLimit = require('express-rate-limit');
const logger = require('../../src/lib/app-logger.cjs');
const { getWeather } = require('../services/weather-service.cjs');

function setupExternalWeatherAPI(app, options = {}) {
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.EXTERNAL_WEATHER_RATE_LIMIT || 60) });

  app.get('/api/external/weather', limiter, async (req, res) => {
    const city = req.query.city || req.query.q || '';
    if (!city) return res.status(400).json({ success: false, error: 'city query parameter is required' });
    try {
      const data = await getWeather(city);
      return res.json({ success: true, city: city, data });
    } catch (err) {
      logger.warn('[ExternalWeather] Failed to fetch weather:', err.message);
      return res.status(502).json({ success: false, error: 'Failed to fetch weather', details: err.message });
    }
  });

  logger.info('[ExternalWeather] Route mounted at /api/external/weather');
}

module.exports = setupExternalWeatherAPI;
