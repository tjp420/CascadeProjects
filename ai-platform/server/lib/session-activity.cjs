"use strict";

const activity = new Map();
const DEFAULT_OFFLINE_MS = 5 * 60 * 1000;

function recordActivity(userId, email, name) {
  if (!userId) return;
  const entry = activity.get(userId) || { email, name };
  entry.email = email || entry.email;
  entry.name = name || entry.name;
  entry.lastSeen = Date.now();
  activity.set(userId, entry);
}

function getActiveUsers(offlineThresholdMs = DEFAULT_OFFLINE_MS) {
  const now = Date.now();
  const threshold =
    typeof offlineThresholdMs === "number" && offlineThresholdMs > 0
      ? offlineThresholdMs
      : DEFAULT_OFFLINE_MS;
  const result = [];
  for (const [userId, entry] of activity.entries()) {
    const online = entry.lastSeen && now - entry.lastSeen < threshold;
    result.push({
      userId,
      email: entry.email,
      name: entry.name,
      lastSeen: entry.lastSeen,
      online,
    });
  }
  return result.sort((a, b) => b.lastSeen - a.lastSeen);
}

function getLastSeen(userId) {
  const entry = activity.get(userId);
  return entry ? entry.lastSeen : null;
}

module.exports = { recordActivity, getActiveUsers, getLastSeen };
