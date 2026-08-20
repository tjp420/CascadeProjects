"use strict";

const crypto = require("crypto");
const https = require("https");

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const payload = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(payload));
          } catch {
            resolve(payload);
          }
        } else {
          const err = new Error(`HSM request failed: HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = payload;
          reject(err);
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

class BaseHsmProvider {
  constructor(opts = {}) {
    this.provider = opts.provider || "mockhsm";
    this.keyId = opts.keyId || process.env.HSM_KEY_ID || "sb-master-key";
    this.region = opts.region || process.env.HSM_REGION || "us-east-1";
    this.project = opts.project || process.env.HSM_PROJECT || "default-project";
    this.endpoint = opts.endpoint || process.env.HSM_ENDPOINT || null;
    this.accessToken = opts.accessToken || process.env.HSM_ACCESS_TOKEN || null;
    this._request = this._request || httpRequest;
  }

  requireToken() {
    if (!this.accessToken) throw new Error("HSM access token not configured");
  }

  async derive(_orgId) {
    throw new Error("derive() not implemented");
  }

  handshake() {
    const handle = `${this.provider}:${this.keyId}@${this.region}`;
    const seed = (this.accessToken || "no-token").slice(0, 8);
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${handle}:${seed}`)
      .digest("hex");
    return {
      provider: this.provider,
      keyId: this.keyId,
      region: this.region,
      handle,
      fingerprint,
      handshakeAt: new Date().toISOString(),
      healthy: true,
    };
  }
}

class MockHsmProvider extends BaseHsmProvider {
  async derive(orgId) {
    const master = process.env.HSM_MOCK_ROOT_KEY
      ? Buffer.from(process.env.HSM_MOCK_ROOT_KEY, "hex")
      : crypto.randomBytes(32);
    const salt = Buffer.from(`sb:org:${orgId}`, "utf8");
    return crypto.createHmac("sha256", master).update(salt).digest();
  }
}

class CloudKmsProvider extends BaseHsmProvider {
  async derive(orgId) {
    this.requireToken();
    const salt = Buffer.from(`sb:org:${orgId}`, "utf8");
    const body = JSON.stringify({ data: salt.toString("base64") });
    const url = this.endpoint
      ? `${this.endpoint}/v1/${this.keyId}/cryptoKeyVersions/1:macSign`
      : `https://cloudkms.googleapis.com/v1/${this.keyId}/cryptoKeyVersions/1:macSign`;
    const res = await this._request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
      body,
    );
    if (!res || !res.mac)
      throw new Error("Cloud KMS did not return a valid MAC");
    const mac = Buffer.from(res.mac, "base64");
    return mac.length >= 32
      ? mac.slice(0, 32)
      : crypto.createHash("sha256").update(mac).digest();
  }
}

class AzureKmsProvider extends BaseHsmProvider {
  async derive(orgId) {
    this.requireToken();
    const salt = Buffer.from(`sb:org:${orgId}`, "utf8");
    const digest = crypto.createHash("sha256").update(salt).digest();
    const body = JSON.stringify({
      alg: "RS256",
      value: digest.toString("base64"),
    });
    const keyVersion = this.keyId.includes("/")
      ? this.keyId
      : `keys/${this.keyId}`;
    const host = this.endpoint || `${this.keyId.split("/")[0]}.vault.azure.net`;
    const url = this.endpoint
      ? `${this.endpoint}/${keyVersion}/sign?api-version=7.4`
      : `https://${host}/${keyVersion}/sign?api-version=7.4`;
    const res = await this._request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
      body,
    );
    if (!res || !res.value)
      throw new Error("Azure Key Vault did not return a valid signature");
    const sig = Buffer.from(res.value, "base64");
    return crypto.createHash("sha256").update(sig).digest();
  }
}

function createProvider(options = {}) {
  const provider = options.provider || process.env.HSM_PROVIDER || "mockhsm";
  const supported = new Set(["mockhsm", "cloudkms", "azurekms"]);
  if (!supported.has(provider))
    throw new Error(`Unsupported HSM provider: ${provider}`);
  const base = {
    provider,
    keyId: options.keyId || process.env.HSM_KEY_ID || "sb-master-key",
    region: options.region || process.env.HSM_REGION || "us-east-1",
    project: options.project || process.env.HSM_PROJECT || "default-project",
    endpoint: options.endpoint || process.env.HSM_ENDPOINT || null,
    accessToken: options.accessToken || process.env.HSM_ACCESS_TOKEN || null,
  };
  if (provider === "mockhsm") return new MockHsmProvider(base);
  if (provider === "cloudkms") return new CloudKmsProvider(base);
  if (provider === "azurekms") return new AzureKmsProvider(base);
  throw new Error(`Unsupported HSM provider: ${provider}`);
}

module.exports = {
  createProvider,
  BaseHsmProvider,
  MockHsmProvider,
  CloudKmsProvider,
  AzureKmsProvider,
  httpRequest,
};
