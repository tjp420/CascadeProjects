**Admin Throttle — getIpKey integration**

Purpose: centralize canonical IP key generation for the admin rate-limiter to
prevent unbounded key explosion and IPv6-related errors (e.g. ERR_ERL_KEY_GEN_IPV6).

Summary

- `getIpKey(req)` normalizes an incoming client address (X-Forwarded-For, socket
  remoteAddress), strips ports and zone IDs, maps IPv4-mapped IPv6 (`::ffff:`)
  to dotted-quad, and returns a fixed-length masked token (hex) used as a
  stable rate-limiter key.

Options & behaviors

- Trust proxy: when enabled (default) `X-Forwarded-For` is parsed; `xffPosition`
  controls whether the left-most (`edge`) or right-most non-private (`hop-by-hop`)
  entry is picked.
- Masking: SHA-256 digest by default, truncated to 16 hex chars. This produces
  compact, consistent keys suitable for in-memory maps and Redis keys.

Backwards compatibility

- `admin-throttle` preserves legacy APIs: `checkAdminRequest(ip)` still accepts
  an IP string and will use the previous full-hash behavior. Middleware now calls
  `checkAdminRequest(req)` (preferred) so the masked 16-char token is used for
  per-IP buckets while subnet buckets continue to use the prior subnet hashing.

Migration notes

- To adopt the new masked key elsewhere, call `getIpKey(req)` and use the
  returned token directly as the `ipmask` key (prefix `sb:admin-throttle:ipmask:`).
- If you need a different masking length or algorithm, pass options to
  `getIpKey(req, { masking: { algorithm: 'sha256', length: 16 } })`.

Testing & verification

- Unit tests: `server/lib/__tests__/getIpKey.test.cjs` covers canonical vectors.
- Run the server-lib test subset locally:

```powershell
cd ai-platform
npm test -- server/lib --silent
```

Rationale

- Using compact masked tokens reduces memory pressure, avoids creation of
  extremely long Redis keys from raw IPv6 addresses, and standardizes IP
  canonicalization in one place.

Contact & next steps

- Reviewer suggestions: `@team-security`, `@team-platform`.
- Follow-up: update other throttle call-sites to accept request objects where
  feasible (for full `getIpKey` coverage).
