import { apiBase } from './authService.js?v=20260722bridgefix1';

export async function fetchWeather(city) {
  if (!city) throw new Error('city is required');
  const base = apiBase() || '';
  const url = (base || '') + `/api/external/weather?city=${encodeURIComponent(city)}`;
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Weather API error ${resp.status}: ${txt}`);
  }
  const json = await resp.json();
  if (!json || !json.success) throw new Error(json?.error || 'Failed to fetch weather');
  return json;
}
