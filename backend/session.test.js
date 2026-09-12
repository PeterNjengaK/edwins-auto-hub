const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("./app");
test("idle expiry is server enforced, only activity renews it, and cookies cannot restore a window", async () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "edwins-session-"));
  let now = Date.now();
  const instance = createApp({
    storage,
    password: "session-test-password",
    seed: false,
    quiet: true,
    now: () => now,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    async function login() {
      const response = await fetch(base + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "session-test-password" }),
      });
      const data = await response.json();
      assert.equal(data.idleTimeoutMs, 900000);
      assert.ok(!/Max-Age|Expires/i.test(response.headers.get("set-cookie")));
      return {
        Cookie: response.headers.get("set-cookie").split(";")[0],
        "X-CSRF-Token": data.csrf,
      };
    }
    let headers = await login();
    const cookieOnly = { Cookie: headers.Cookie };
    assert.deepEqual(
      await (
        await fetch(base + "/api/session", { headers: cookieOnly })
      ).json(),
      { authenticated: false, idleTimeoutMs: 900000 },
    );
    assert.equal(
      (await fetch(base + "/api/admin/backup", { headers: cookieOnly })).status,
      403,
    );
    now += 14 * 60 * 1000;
    assert.equal(
      (await fetch(base + "/api/admin/cars", { headers })).status,
      200,
    );
    now += 60 * 1000;
    assert.equal(
      (await fetch(base + "/api/admin/cars", { headers })).status,
      401,
    );
    assert.equal(
      (await fetch(base + "/api/session/activity", { method: "POST", headers }))
        .status,
      401,
    );
    headers = await login();
    now += 14 * 60 * 1000;
    assert.equal(
      (await fetch(base + "/api/session/activity", { method: "POST", headers }))
        .status,
      200,
    );
    now += 2 * 60 * 1000;
    assert.equal(
      (await fetch(base + "/api/admin/cars", { headers })).status,
      200,
    );
    await fetch(base + "/api/logout", { method: "POST", headers });
    assert.equal(
      (await fetch(base + "/api/admin/cars", { headers })).status,
      401,
    );
  } finally {
    await new Promise((r) => server.close(r));
    instance.close();
    fs.rmSync(storage, { recursive: true, force: true });
  }
});
