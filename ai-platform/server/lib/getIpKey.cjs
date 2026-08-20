const crypto = require("crypto");

const DEFAULT_OPTIONS = {
  trustProxy: true,
  trustedProxies: [
    "127.0.0.1/32",
    "::1/128",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
  ],
  xffPosition: "hop-by-hop", // 'hop-by-hop' (right-to-left) or 'edge' (left-most)
  masking: { enabled: true, algorithm: "sha256", length: 16 },
};

function simpleIsPrivate(ip) {
  if (!ip) return false;
  // IPv4 quick checks
  if (/^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip))
    return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // IPv6 loopback/link-local
  if (ip === "::1") return true;
  if (/^fe80:/i.test(ip)) return true;
  return false;
}

function stripPortAndZone(raw) {
  if (!raw) return raw;
  let v = raw.trim();
  // remove surrounding brackets for IPv6 [::1]:8080
  if (v.startsWith("[")) {
    const m = v.match(/^\[(.*?)](?::\d+)?$/);
    if (m) v = m[1];
  } else {
    // remove trailing port for IPv4 (only when looks like ipv4:port)
    if (/^[0-9.]+:\d+$/.test(v)) {
      v = v.replace(/:\d+$/, "");
    }
  }
  // strip zone id like %eth0
  v = v.replace(/%.*$/, "");
  // map IPv4-mapped IPv6
  const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (m) return m[1];
  return v;
}

function chooseClientFromXff(xff, opts) {
  if (!xff) return null;
  const parts = xff
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (opts.xffPosition === "edge") {
    // left-most
    return parts[0];
  }
  // hop-by-hop: iterate right-to-left and return first non-trusted
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = stripPortAndZone(parts[i]).toLowerCase();
    if (!simpleIsPrivate(candidate)) return candidate;
  }
  // fallback to left-most
  return stripPortAndZone(parts[0]).toLowerCase();
}

function maskKey(canonicalIp, opts) {
  if (!opts.masking || !opts.masking.enabled) return canonicalIp;
  const algo = opts.masking.algorithm || "sha256";
  const full = crypto.createHash(algo).update(canonicalIp).digest("hex");
  return full.substring(0, opts.masking.length || 16);
}

function getIpKey(req, options = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  let clientIp = null;

  if (opts.trustProxy && req && req.headers && req.headers["x-forwarded-for"]) {
    try {
      clientIp = chooseClientFromXff(req.headers["x-forwarded-for"], opts);
    } catch (e) {
      clientIp = null;
    }
  }

  if (!clientIp && req && req.socket && req.socket.remoteAddress) {
    clientIp = req.socket.remoteAddress;
  }

  if (!clientIp && req && req.connection && req.connection.remoteAddress) {
    clientIp = req.connection.remoteAddress;
  }

  if (!clientIp) clientIp = "127.0.0.1";

  let canonical = stripPortAndZone(String(clientIp)).toLowerCase();
  // final trim
  canonical = canonical.trim();

  return maskKey(canonical, opts);
}

module.exports = { getIpKey };
