const http = require("http");

const port = process.env.VITE_API_PORT || "53900";
const targetUrl = `http://127.0.0.1:${port}`;

console.log(
  `📡 [Pre-flight] Checking SimpleBeacon API availability at ${targetUrl}...`,
);

const req = http.get(`${targetUrl}/api/tags`, { timeout: 2000 }, (res) => {
  console.log(
    `✅ [Pre-flight] API is responsive (Status: ${res.statusCode}). Bypassing CORS blocks via Vite Proxy.`,
  );
  process.exit(0);
});

req.on("error", () => {
  console.warn(
    `\n⚠️  [Pre-flight] WARNING: API server is unreachable on port ${port}.`,
  );
  console.warn(
    `👉 Ensure your local backend is running, or launch with: VITE_API_PORT=59277 npm run dev\n`,
  );
  process.exit(0);
});

req.on("timeout", () => {
  req.destroy();
  console.warn(
    `⏳ [Pre-flight] API connection timed out. Proceeding with loose proxy mounts...`,
  );
  process.exit(0);
});
