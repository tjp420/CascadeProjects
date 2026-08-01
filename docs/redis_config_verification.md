# Redis Configuration Verification

## Client Dependency

- **Package:** `redis` (Node Redis v4)
- **Declared in:** `ai-platform/package.json`
- **Version:** `^4.7.1`
- **Used by:** `ai-platform/server/lib/hybrid-kem-resumption.cjs` (via `validateTicketWithRedis`)

## Container Images

| Environment | Compose file | Image | RedisBloom module loaded? | Auth | `maxmemory` bound |
|-------------|--------------|-------|---------------------------|------|-------------------|
| Test | `docker-compose.redis.yml` | `redis:7.2-alpine` | No | None | Not set |
| Staging / Phase 2 | `docker-compose.phase2.yml` | `redis:7-alpine` | No | `--requirepass` via `REDIS_PASSWORD` | Not set |

## Findings

1. **Native RedisBloom module is not loaded in any container image.**
   - The `hybrid-kem-resumption.cjs` code probes with `BF.INFO` and falls back to plain-Redis `SADD`/`SISMEMBER`.
   - This fallback works, but it does not give the memory-efficiency benefits of RedisBloom.
   - To enable native bloom, use an image with the module pre-installed, e.g. `redislabs/rebloom:2.8` or `redis/redis-stack-server:latest`, and add `--loadmodule /path/to/redisbloom.so` to the `command`.

2. **No `maxmemory` limit is configured.**
   - Both compose files leave Redis at its default unbounded memory behavior.
   - For production, set an explicit `maxmemory` and a matching `maxmemory-policy` (e.g. `volatile-lru` or `allkeys-lru` if the nonce set must be bounded):
     ```
     --maxmemory 1gb --maxmemory-policy allkeys-lru
     ```

3. **Authentication is optional in the test compose but required in phase2.**
   - `docker-compose.redis.yml` has no password (matches the integration test URL `redis://127.0.0.1:6379`).
   - `docker-compose.phase2.yml` uses `REDIS_PASSWORD`.
   - The `validateTicketWithRedis` signature does not currently accept a Redis URL with credentials; if production uses authentication, the call sites must be updated to pass the full `url` to `redis.createClient()`.

4. **Persistence is enabled by default (RDB) in `redis:7-alpine`.**
   - `RDB` is written to `/data` via the `redis_data` volume.
   - For the ticket-nonce set, this is usually acceptable, but `appendonly yes` with AOF may be overkill for ephemeral replay-prevention data.

## Recommended Production Configuration

```yaml
command:
  - redis-server
  - --maxmemory 1gb
  - --maxmemory-policy allkeys-lru
  - --requirepass ${REDIS_PASSWORD}
  - --loadmodule /usr/lib/redis/modules/redisbloom.so  # if native bloom is desired
```

If native RedisBloom is not used, the current `SADD/SISMEMBER` fallback is safe but should be monitored for memory growth because the `hybrid:ticket-nonces` set will grow until the per-key TTL expires.
