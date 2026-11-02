import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3217;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(root, ".data");
const BACKUP_DIR = path.join(root, `.data-sec-test-backup-${process.pid}`);

let server = null;
let hadData = false;

const testEnv = {
  ...process.env,
  SESSION_SECRET: "test-session-secret-for-sec1-tests-1234567890",
  DEMO_MODE: "true",
  ALLOW_DEMO_RESET: "false",
  MODEL_API_KEY: "",
  AI_DAILY_LIMIT: "500",
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Test server did not start");
}

async function startServer() {
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], {
    cwd: root,
    env: testEnv,
    stdio: "ignore",
  });
  await waitForServer();
}

async function stopServer() {
  if (!server) return;
  const done = new Promise((r) => server.once("exit", r));
  server.kill("SIGTERM");
  await Promise.race([done, new Promise((r) => setTimeout(r, 5000))]);
  try { server.kill("SIGKILL"); } catch { /* already gone */ }
  server = null;
  await new Promise((r) => setTimeout(r, 300));
}

function cookieFrom(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return set.map((c) => c.split(";")[0]).join("; ");
}

async function call(pathname, { method = "GET", cookie = "", body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, cookie: cookieFrom(res), headers: res.headers };
}

async function login(username) {
  const res = await call("/api/auth/login", { method: "POST", body: { username, password: "demo1234" } });
  assert.equal(res.status, 200, `login ${username}`);
  assert.ok(res.cookie.includes("hotelapp_session="), "session cookie set");
  assert.match(res.headers.get("set-cookie") ?? "", /HttpOnly/i);
  return res.cookie;
}

before(async () => {
  try { await fs.access(DATA_DIR); hadData = true; await fs.cp(DATA_DIR, BACKUP_DIR, { recursive: true }); }
  catch { hadData = false; }
  await startServer();
});

after(async () => {
  await stopServer();
  await fs.rm(DATA_DIR, { recursive: true, force: true });
  if (hadData) await fs.rename(BACKUP_DIR, DATA_DIR);
});

test("signed out gets 401 on tasks, photos, history, reports", async () => {
  for (const pathname of ["/api/tasks", "/api/photos/some-photo.jpg", "/api/history", "/api/reports"]) {
    const res = await call(pathname);
    assert.equal(res.status, 401, `${pathname} should be 401, got ${res.status}`);
  }
});

test("staff cannot see another department (403), own department works", async () => {
  const cookie = await login("aigerim"); // housekeeping
  const other = await call("/api/tasks?department=maintenance", { cookie });
  assert.equal(other.status, 403);
  const own = await call("/api/tasks", { cookie });
  assert.equal(own.status, 200);
  for (const task of own.json.tasks ?? []) {
    assert.equal(task.department, "housekeeping");
  }
});

test("guest sees only own task statuses, with no photo data", async () => {
  const a = await call("/api/guest/message", { method: "POST", body: { message: "please bring towels", room: "204" } });
  assert.equal(a.status, 200);
  assert.ok(a.cookie.includes("hotelapp_guest="), "guest cookie issued");
  assert.ok((a.json.tasks ?? []).length >= 1);
  for (const task of a.json.tasks) {
    assert.deepEqual(Object.keys(task).sort(), ["id", "status", "title"]);
  }
  const b = await call("/api/guest/message", { method: "POST", body: { message: "there is a leak in the bathroom", room: "204" } });
  assert.equal(b.status, 200);
  const bIds = new Set((b.json.tasks ?? []).map((t) => t.id));

  const mine = await call("/api/guest/tasks", { cookie: a.cookie });
  assert.equal(mine.status, 200);
  assert.ok(mine.json.tasks.length >= 1);
  for (const task of mine.json.tasks) {
    assert.deepEqual(Object.keys(task).sort(), ["id", "status", "title"]);
    assert.ok(!bIds.has(task.id), "guest A must not see guest B tasks");
  }
  const anonymous = await call("/api/guest/tasks");
  assert.deepEqual(anonymous.json.tasks, []);
});

test("reset is blocked without ALLOW_DEMO_RESET", async () => {
  const cookie = await login("owner");
  const res = await call("/api/tasks", { method: "DELETE", cookie });
  assert.equal(res.status, 403);
});

test("foreign Origin is rejected on mutating requests", async () => {
  const res = await call("/api/guest/message", {
    method: "POST",
    body: { message: "please bring towels", room: "204" },
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(res.status, 403);
});

test("guest rate limit returns 429", async () => {
  let saw429 = false;
  for (let i = 0; i < 15 && !saw429; i++) {
    const res = await call("/api/guest/message", { method: "POST", body: { message: "please bring towels", room: "204" } });
    if (res.status === 429) {
      saw429 = true;
      assert.match(res.json.error ?? "", /Please wait a moment/);
    }
  }
  assert.ok(saw429, "expected a 429 within 15 guest messages in a minute");
});

test("sign-in survives a server restart", async () => {
  const cookie = await login("owner");
  await stopServer();
  await startServer();
  const me = await call("/api/auth/me", { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user?.username, "owner");
  const tasks = await call("/api/tasks", { cookie });
  assert.equal(tasks.status, 200);
});
