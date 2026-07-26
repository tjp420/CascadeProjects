const axios = require('axios');

// Simple in-memory cache: key -> { ts, data }
const CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS || 5 * 60 * 1000); // default 5 minutes
const cache = new Map();

/**
 * Fetch current weather for a city using OpenWeatherMap (with simple caching).
 * Expects OPENWEATHERMAP_API_KEY in environment.
 * @param {string} city
 * @returns {Promise<Object>} weather data
 */
async function getWeather(city) {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY is not set');
  const q = String(city || '').trim();
  if (!q) throw new Error('City is required');
  const key = q.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    return cached.data;
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${apiKey}&units=metric`;
  const resp = await axios.get(url, { timeout: 5000 });
  const data = resp.data;
  try { cache.set(key, { ts: now, data }); } catch { /* ignore cache errors */ }
  return data;
}

module.exports = { getWeather };
