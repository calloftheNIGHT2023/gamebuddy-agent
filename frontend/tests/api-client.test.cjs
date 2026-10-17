const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(readFileSync(path.join(__dirname, "../lib/api-client.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function runtime({ host = "127.0.0.1", protocol = "http:", base, handler } = {}) {
  const storage = new Map();
  const requests = [];
  const processStub = { env: { NEXT_PUBLIC_API_BASE_URL: base } };
  const windowStub = Object.assign(new EventTarget(), {
    location: { hostname: host, protocol },
    sessionStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  });
  const moduleStub = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleStub, exports: moduleStub.exports, window: windowStub, process: processStub,
    URL, Headers, AbortController, Event, Error, TypeError, setTimeout, clearTimeout,
    fetch: async (url, init) => { requests.push({ url, init }); return handler ? handler(url, init) : new Response("{}", { headers: { "Content-Type": "application/json" } }); },
  });
  return { api: moduleStub.exports, requests, processStub, storage };
}

test("both local page hostnames resolve to the IPv4 backend", () => {
  for (const host of ["localhost", "127.0.0.1"]) assert.equal(runtime({ host }).api.resolveApiBase(), "http://127.0.0.1:8000/api/v1");
  assert.equal(runtime({ base: "http://localhost:8000/api/v1/" }).api.resolveApiBase(), "http://127.0.0.1:8000/api/v1");
});

test("a public page rejects missing, loopback, and mixed-content backend configuration", () => {
  assert.throws(() => runtime({ host: "demo.example", protocol: "https:" }).api.resolveApiBase(), /后端地址未配置/);
  assert.throws(() => runtime({ host: "demo.example", base: "http://localhost:8000/api/v1" }).api.resolveApiBase(), /公网网站配置了本机/);
  for (const base of ["https://[::ffff:127.0.0.1]/api/v1", "https://[::ffff:7fff:ffff]/api/v1", "https://localhost./api/v1"]) assert.throws(() => runtime({ host: "demo.example", base }).api.resolveApiBase(), /公网网站配置了本机/);
  assert.throws(() => runtime({ host: "demo.example", protocol: "https:", base: "http://api.example/api/v1" }).api.resolveApiBase(), /HTTPS/);
});

test("the session token is attached to configured API requests, but never health checks", async () => {
  const app = runtime({ host: "demo.example", protocol: "https:", base: "https://api.example/api/v1" });
  app.api.saveAdminToken("test-only-token");
  await app.api.apiRequest("/ops/summary");
  await app.api.apiRequest("/health", {}, { root: true, authorize: false });
  assert.equal(app.requests[0].url, "https://api.example/api/v1/ops/summary");
  assert.equal(app.requests[0].init.headers.get("Authorization"), "Bearer test-only-token");
  assert.equal(app.requests[1].url, "https://api.example/health");
  assert.equal(app.requests[1].init.headers.get("Authorization"), null);
  assert.equal(app.requests[0].init.credentials, "omit");
  assert.equal(app.requests[0].init.redirect, "error");
});

test("tokens cannot be sent to another configured origin or an external request path", async () => {
  const app = runtime({ base: "https://api.example/api/v1" });
  app.api.saveAdminToken("test-only-token");
  app.processStub.env.NEXT_PUBLIC_API_BASE_URL = "https://other.example/api/v1";
  await app.api.apiRequest("/ops/summary");
  assert.equal(app.requests[0].init.headers.get("Authorization"), null);
  await assert.rejects(app.api.apiRequest("//outside.example/path"), /API 请求路径无效/);
  assert.equal(app.requests.length, 1);
});

test("clearing the token removes authorization from subsequent requests", async () => {
  const app = runtime();
  app.api.saveAdminToken("test-only-token");
  app.api.clearAdminToken();
  await app.api.apiRequest("/ops/summary");
  assert.equal(app.api.getAdminToken(), "");
  assert.equal(app.requests[0].init.headers.get("Authorization"), null);
  assert.equal(app.storage.size, 0);
});

test("401 and admin-unconfigured 503 have distinct actionable messages", async () => {
  for (const [status, detail, expected] of [[401, "Unauthorized", /管理员未登录/], [503, "Private access is not configured", /管理员入口未配置/]]) {
    const app = runtime({ handler: () => new Response(JSON.stringify({ detail }), { status }) });
    await assert.rejects(app.api.apiRequest("/ops/summary"), (error) => error.status === status && expected.test(error.message));
  }
});

test("health reads root /health and validates non-secret deployment metadata", async () => {
  const health = { status: "ok", mode: "public", private_access: "disabled", storage: "ephemeral" };
  const app = runtime({ handler: () => new Response(JSON.stringify(health)) });
  assert.deepEqual(await app.api.getBackendHealth(), health);
  assert.equal(app.requests[0].url, "http://127.0.0.1:8000/health");
  await assert.rejects(runtime().api.getBackendHealth(), /版本未提供有效的连接状态/);
});

test("validation errors are preserved instead of becoming a generic connection error", async () => {
  const app = runtime({ handler: () => new Response(JSON.stringify({ detail: [{ loc: ["body", "state", "level"], msg: "must be finite" }] }), { status: 422 }) });
  await assert.rejects(app.api.apiRequest("/assistant"), /state.level：must be finite/);
});

test("an aborted request reports backend timeout", async () => {
  const app = runtime({ handler: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); });
  }) });
  await assert.rejects(app.api.apiRequest("/assistant", {}, { timeoutMs: 1 }), /后端请求超时/);
});
