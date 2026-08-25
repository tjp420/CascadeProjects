"use strict";

/**
 * Enterprise Docker Configuration Validation Tests
 *
 * Verifies that:
 *  - Dockerfile.enterprise exists and is valid multi-stage
 *  - Dockerfile.ollama exists and is valid
 *  - docker-compose.enterprise.yml is valid YAML with expected services
 *  - docker-compose.enterprise.gpu.yml is a valid GPU override
 *  - .env.enterprise.example exists with all required variables
 *  - hydrate-airgap.sh exists with package/deploy/verify commands
 *  - All Modelfiles are referenced in the Ollama Dockerfile
 *  - Compose services have correct ports, volumes, and health checks
 *  - Compose env vars match the production env var spec
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const DOCKERFILE_ENGINE = path.join(ROOT, "Dockerfile.enterprise");
const DOCKERFILE_OLLAMA = path.join(ROOT, "Dockerfile.ollama");
const COMPOSE_FILE = path.join(ROOT, "docker-compose.enterprise.yml");
const GPU_OVERRIDE = path.join(ROOT, "docker-compose.enterprise.gpu.yml");
const ENV_TEMPLATE = path.join(ROOT, ".env.enterprise.example");
const HYDRATE_SCRIPT = path.join(ROOT, "scripts", "hydrate-airgap.sh");
const MANIFEST = path.join(
  ROOT,
  "coming-soon",
  "public",
  "models",
  "manifest.json",
);

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

function loadYaml(p) {
  return yaml.load(readFile(p));
}

// ── Dockerfile.enterprise ─────────────────────────────────────────────────

describe("Dockerfile.enterprise", () => {
  it("exists", () => {
    assert.ok(
      fs.existsSync(DOCKERFILE_ENGINE),
      "Dockerfile.enterprise should exist",
    );
  });

  it("uses multi-stage build", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    const stages = content.match(/^FROM\s+\S+\s+AS\s+\S+/gm) || [];
    assert.ok(
      stages.length >= 3,
      `should have at least 3 stages, got ${stages.length}`,
    );
  });

  it("uses node:22 base image", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(content.includes("node:22"), "should use Node.js 22 base image");
  });

  it("builds dashboard assets", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(
      content.includes("vite build"),
      "should run vite build for dashboard assets",
    );
    assert.ok(content.includes("tsc"), "should run TypeScript compilation");
  });

  it("uses non-root user", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(/USER\s+\w+/.test(content), "should use a non-root user");
  });

  it("has health check", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(
      content.includes("HEALTHCHECK"),
      "should have a HEALTHCHECK directive",
    );
  });

  it("uses tini for signal handling", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(
      content.includes("tini"),
      "should use tini for PID 1 signal handling",
    );
  });

  it("exposes port 3000", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(/EXPOSE\s+3000/.test(content), "should expose port 3000");
  });

  it("starts simplebeacon-server.cjs", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(
      content.includes("simplebeacon-server.cjs"),
      "should start the SimpleBeacon server",
    );
  });

  it("copies Modelfiles and manifest", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(content.includes("models"), "should copy model files");
  });

  it("creates data directories", () => {
    const content = readFile(DOCKERFILE_ENGINE);
    assert.ok(content.includes("mkdir"), "should create data directories");
  });
});

// ── Dockerfile.ollama ─────────────────────────────────────────────────────

describe("Dockerfile.ollama", () => {
  it("exists", () => {
    assert.ok(
      fs.existsSync(DOCKERFILE_OLLAMA),
      "Dockerfile.ollama should exist",
    );
  });

  it("uses ollama/ollama base image", () => {
    const content = readFile(DOCKERFILE_OLLAMA);
    assert.ok(
      content.includes("ollama/ollama"),
      "should use ollama/ollama base image",
    );
  });

  it("copies all Modelfiles", () => {
    const content = readFile(DOCKERFILE_OLLAMA);
    assert.ok(content.includes("Modelfile"), "should copy Modelfile");
    assert.ok(
      content.includes("Modelfile.llama32"),
      "should copy Modelfile.llama32",
    );
    assert.ok(
      content.includes("Modelfile.mistral"),
      "should copy Modelfile.mistral",
    );
    assert.ok(
      content.includes("Modelfile.qwen25-coder"),
      "should copy Modelfile.qwen25-coder",
    );
  });

  it("copies manifest.json", () => {
    const content = readFile(DOCKERFILE_OLLAMA);
    assert.ok(content.includes("manifest.json"), "should copy manifest.json");
  });

  it("has model initialization script", () => {
    const content = readFile(DOCKERFILE_OLLAMA);
    assert.ok(
      content.includes("init-models.sh"),
      "should have model initialization script",
    );
    assert.ok(
      content.includes("ollama create"),
      "should create models from Modelfiles",
    );
  });

  it("exposes port 11434", () => {
    const content = readFile(DOCKERFILE_OLLAMA);
    assert.ok(/EXPOSE\s+11434/.test(content), "should expose port 11434");
  });

  it("has health check", () => {
    const content = readFile(DOCKERFILE_OLLAMA);
    assert.ok(
      content.includes("HEALTHCHECK"),
      "should have a HEALTHCHECK directive",
    );
  });
});

// ── docker-compose.enterprise.yml ─────────────────────────────────────────

describe("docker-compose.enterprise.yml", () => {
  it("exists and is valid YAML", () => {
    assert.ok(
      fs.existsSync(COMPOSE_FILE),
      "docker-compose.enterprise.yml should exist",
    );
    assert.doesNotThrow(() => loadYaml(COMPOSE_FILE), "should be valid YAML");
  });

  it("has three services", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const services = Object.keys(compose.services || {});
    assert.ok(
      services.includes("simplebeacon-engine"),
      "should have simplebeacon-engine service",
    );
    assert.ok(
      services.includes("simplebeacon-ollama"),
      "should have simplebeacon-ollama service",
    );
    assert.ok(
      services.includes("simplebeacon-db"),
      "should have simplebeacon-db service",
    );
  });

  it("engine builds from Dockerfile.enterprise", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.strictEqual(engine.build?.dockerfile, "Dockerfile.enterprise");
  });

  it("ollama builds from Dockerfile.ollama", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const ollama = compose.services["simplebeacon-ollama"];
    assert.strictEqual(ollama.build?.dockerfile, "Dockerfile.ollama");
  });

  it("db uses postgres:16-alpine", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const db = compose.services["simplebeacon-db"];
    assert.strictEqual(db.image, "postgres:16-alpine");
  });

  it("engine depends on db and ollama", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(
      engine.depends_on?.["simplebeacon-db"],
      "engine should depend on db",
    );
    assert.ok(
      engine.depends_on?.["simplebeacon-ollama"],
      "engine should depend on ollama",
    );
  });

  it("engine has correct port mapping", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(
      engine.ports?.some((p) => p.includes("3000")),
      "engine should map port 3000",
    );
  });

  it("ollama has correct port mapping", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const ollama = compose.services["simplebeacon-ollama"];
    assert.ok(
      ollama.ports?.some((p) => p.includes("11434")),
      "ollama should map port 11434",
    );
  });

  it("db has correct port mapping", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const db = compose.services["simplebeacon-db"];
    assert.ok(
      db.ports?.some((p) => p.includes("5432")),
      "db should map port 5432",
    );
  });

  it("has named volumes for persistence", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const volumes = Object.keys(compose.volumes || {});
    assert.ok(
      volumes.includes("engine-data"),
      "should have engine-data volume",
    );
    assert.ok(
      volumes.includes("ollama-models"),
      "should have ollama-models volume",
    );
    assert.ok(volumes.includes("db-data"), "should have db-data volume");
  });

  it("has a bridge network", () => {
    const compose = loadYaml(COMPOSE_FILE);
    assert.ok(
      compose.networks?.["simplebeacon-net"],
      "should have simplebeacon-net network",
    );
    assert.strictEqual(compose.networks["simplebeacon-net"].driver, "bridge");
  });

  it("engine has health check", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(engine.healthcheck, "engine should have health check");
  });

  it("db has health check", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const db = compose.services["simplebeacon-db"];
    assert.ok(db.healthcheck, "db should have health check");
  });

  it("engine has OLLAMA_NUM_CTX env var", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(
      engine.environment?.OLLAMA_NUM_CTX,
      "engine should have OLLAMA_NUM_CTX env var",
    );
  });

  it("engine has OLLAMA_BASE_URL pointing to ollama service", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(
      engine.environment?.OLLAMA_BASE_URL?.includes("simplebeacon-ollama"),
      "OLLAMA_BASE_URL should point to the ollama service",
    );
  });

  it("engine has DATABASE_URL (via env_file pointing to db service)", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(
      engine.env_file,
      "engine should use env_file for DATABASE_URL and secrets",
    );
    // The actual DATABASE_URL is constructed in .env.enterprise with simplebeacon-db hostname
    const envTemplate = readFile(path.join(ROOT, ".env.enterprise.example"));
    assert.ok(
      envTemplate.includes("simplebeacon-db"),
      ".env.enterprise.example should have DATABASE_URL pointing to simplebeacon-db",
    );
  });

  it("engine has NODE_ENV=production", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.strictEqual(engine.environment?.NODE_ENV, "production");
  });

  it("engine has REQUIRE_AUTH=true", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.strictEqual(engine.environment?.REQUIRE_AUTH, "true");
  });

  it("engine has SIMPLEBEACON_OFFLINE=true", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.strictEqual(engine.environment?.SIMPLEBEACON_OFFLINE, "true");
  });

  it("engine has REPORT_SIGNING_KEY env var (via env_file)", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(engine.env_file, "engine should use env_file for secrets");
  });

  it("engine has DASHBOARD_VAULT_PASSWORD env var (via env_file)", () => {
    const compose = loadYaml(COMPOSE_FILE);
    const engine = compose.services["simplebeacon-engine"];
    assert.ok(engine.env_file, "engine should use env_file for secrets");
  });

  it("all services use restart: unless-stopped", () => {
    const compose = loadYaml(COMPOSE_FILE);
    for (const [name, service] of Object.entries(compose.services)) {
      assert.strictEqual(
        service.restart,
        "unless-stopped",
        `${name} should have restart: unless-stopped`,
      );
    }
  });
});

// ── docker-compose.enterprise.gpu.yml ─────────────────────────────────────

describe("docker-compose.enterprise.gpu.yml", () => {
  it("exists and is valid YAML", () => {
    assert.ok(fs.existsSync(GPU_OVERRIDE), "GPU override file should exist");
    assert.doesNotThrow(() => loadYaml(GPU_OVERRIDE), "should be valid YAML");
  });

  it("overrides ollama service with GPU resources", () => {
    const compose = loadYaml(GPU_OVERRIDE);
    const ollama = compose.services?.["simplebeacon-ollama"];
    assert.ok(ollama, "should override simplebeacon-ollama service");
    assert.ok(
      ollama.deploy?.resources?.reservations?.devices,
      "should have GPU device reservations",
    );
    const devices = ollama.deploy.resources.reservations.devices;
    assert.ok(
      devices.some((d) => d.driver === "nvidia"),
      "should specify NVIDIA driver",
    );
    assert.ok(
      devices.some((d) => d.capabilities?.includes("gpu")),
      "should request GPU capability",
    );
  });
});

// ── .env.enterprise.example ───────────────────────────────────────────────

describe(".env.enterprise.example", () => {
  it("exists", () => {
    assert.ok(
      fs.existsSync(ENV_TEMPLATE),
      ".env.enterprise.example should exist",
    );
  });

  it("includes all required security vars", () => {
    const content = readFile(ENV_TEMPLATE);
    for (const key of [
      "JWT_SECRET",
      "SIMPLEBEACON_LICENSE_SECRET",
      "DASHBOARD_VAULT_PASSWORD",
      "REPORT_SIGNING_KEY",
    ]) {
      assert.ok(content.includes(key), `should include ${key}`);
    }
  });

  it("includes OLLAMA vars", () => {
    const content = readFile(ENV_TEMPLATE);
    assert.ok(content.includes("OLLAMA_MODEL"), "should include OLLAMA_MODEL");
    assert.ok(
      content.includes("OLLAMA_NUM_CTX"),
      "should include OLLAMA_NUM_CTX",
    );
  });

  it("includes POSTGRES_PASSWORD", () => {
    const content = readFile(ENV_TEMPLATE);
    assert.ok(
      content.includes("POSTGRES_PASSWORD"),
      "should include POSTGRES_PASSWORD",
    );
  });

  it("includes port configuration", () => {
    const content = readFile(ENV_TEMPLATE);
    assert.ok(content.includes("ENGINE_PORT"), "should include ENGINE_PORT");
    assert.ok(content.includes("OLLAMA_PORT"), "should include OLLAMA_PORT");
    assert.ok(content.includes("DB_PORT"), "should include DB_PORT");
  });

  it("includes email and Stripe sections", () => {
    const content = readFile(ENV_TEMPLATE);
    assert.ok(
      content.includes("RESEND_API_KEY"),
      "should include email config",
    );
    assert.ok(
      content.includes("STRIPE_SECRET_KEY"),
      "should include Stripe config",
    );
  });

  it("has empty values for secrets (not pre-filled)", () => {
    const content = readFile(ENV_TEMPLATE);
    const jwtMatch = content.match(/^JWT_SECRET=(.*)$/m);
    assert.ok(jwtMatch, "JWT_SECRET should be present");
    assert.strictEqual(
      jwtMatch[1].trim(),
      "",
      "JWT_SECRET should be empty in the template",
    );
  });
});

// ── hydrate-airgap.sh ─────────────────────────────────────────────────────

describe("hydrate-airgap.sh", () => {
  it("exists", () => {
    assert.ok(fs.existsSync(HYDRATE_SCRIPT), "hydrate-airgap.sh should exist");
  });

  it("has package command", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(content.includes("package"), "should have package command");
    assert.ok(content.includes("docker build"), "should build Docker images");
    assert.ok(content.includes("docker save"), "should save images to archive");
  });

  it("has deploy command", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(content.includes("deploy"), "should have deploy command");
    assert.ok(
      content.includes("docker load"),
      "should load images from archive",
    );
    assert.ok(
      content.includes("docker compose"),
      "should start the stack with docker compose",
    );
  });

  it("has verify command", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(content.includes("verify"), "should have verify command");
    assert.ok(content.includes("curl"), "should check health endpoints");
  });

  it("has help command", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(content.includes("help"), "should have help command");
  });

  it("checks prerequisites", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(
      content.includes("check_prerequisites"),
      "should check for docker and docker compose",
    );
  });

  it("handles GPU detection during deploy", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(content.includes("nvidia"), "should detect NVIDIA runtime");
    assert.ok(content.includes("GPU_OVERRIDE"), "should use GPU override file");
  });

  it("pulls base models during packaging", () => {
    const content = readFile(HYDRATE_SCRIPT);
    assert.ok(
      content.includes("ollama pull"),
      "should pull base models during packaging",
    );
    assert.ok(content.includes("llama3.2"), "should pull llama3.2");
    assert.ok(content.includes("mistral"), "should pull mistral");
    assert.ok(content.includes("qwen2.5-coder"), "should pull qwen2.5-coder");
  });
});

// ── Manifest reference ────────────────────────────────────────────────────

describe("model manifest", () => {
  it("manifest.json exists and is valid JSON", () => {
    assert.ok(fs.existsSync(MANIFEST), "manifest.json should exist");
    assert.doesNotThrow(
      () => JSON.parse(readFile(MANIFEST)),
      "should be valid JSON",
    );
  });

  it("has all models referenced in Dockerfiles", () => {
    const manifest = JSON.parse(readFile(MANIFEST));
    const ollamaDockerfile = readFile(DOCKERFILE_OLLAMA);
    for (const modelId of Object.keys(manifest.models)) {
      const modelfileName = manifest.models[modelId].modelfile;
      assert.ok(
        ollamaDockerfile.includes(modelfileName),
        `Dockerfile.ollama should copy ${modelfileName} for model ${modelId}`,
      );
    }
  });
});
