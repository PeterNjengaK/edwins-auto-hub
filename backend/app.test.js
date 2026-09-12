const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("./app");
const sample = require("./seed")[0];

test("inventory, enquiries, access control, and restart persistence", async () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "edwins-test-"));
  let instance, server, base;
  async function start() {
    instance = createApp({
      storage,
      password: "test-password-only-2026",
      seed: false,
      quiet: true,
    });
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
  }
  async function request(url, method = "GET", body, headers = {}) {
    return fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  try {
    await start();
    assert.equal((await request("/api/cars", "POST", sample)).status, 401);
    assert.equal((await request("/api/enquiries")).status, 401);
    assert.equal(
      (await request("/api/login", "POST", { password: "wrong" })).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/login",
          "POST",
          { password: "test-password-only-2026" },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    const login = await request("/api/login", "POST", {
      password: "test-password-only-2026",
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    const { csrf } = await login.json();
    const headers = { Cookie: cookie, "X-CSRF-Token": csrf };
    assert.equal(
      (await request("/api/cars", "POST", sample, { Cookie: cookie })).status,
      403,
    );
    assert.equal(
      (await request("/api/cars", "POST", { ...sample, price: -10 }, headers))
        .status,
      400,
    );
    assert.equal(
      (
        await request(
          "/api/cars",
          "POST",
          { ...sample, images: ["javascript:alert(1)"] },
          headers,
        )
      ).status,
      400,
    );
    const created = await request(
      "/api/cars",
      "POST",
      { ...sample, id: "client-controlled" },
      headers,
    );
    assert.equal(created.status, 201);
    const car = await created.json();
    assert.notEqual(car.id, "client-controlled");
    assert.equal(car.demo, false);
    const updated = { ...car, model: "Updated model", id: "overwrite-attempt" };
    delete updated.images;
    const edit = await request(`/api/cars/${car.id}`, "PUT", updated, headers);
    assert.equal(edit.status, 200);
    const edited = await edit.json();
    assert.equal(edited.id, car.id);
    assert.deepEqual(edited.images, car.images);
    const enquiry = {
      name: "Test Customer",
      email: "customer@example.com",
      message: "<img src=x onerror=alert(1)>",
      consent: true,
      type: "vehicle",
      carId: car.id,
    };
    assert.equal(
      (await request("/api/enquiries", "POST", { ...enquiry, consent: false }))
        .status,
      400,
    );
    assert.equal(
      (
        await request("/api/enquiries", "POST", {
          ...enquiry,
          email: "invalid",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/enquiries", "POST", {
          ...enquiry,
          carId: "missing",
        })
      ).status,
      400,
    );
    const submitted = await request("/api/enquiries", "POST", enquiry);
    assert.equal(submitted.status, 201);
    const { id } = await submitted.json();
    assert.equal(
      (
        await request(
          `/api/enquiries/${id}`,
          "PATCH",
          { status: "Closed" },
          headers,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("/backend/storage/local-admin-password.txt")).status,
      404,
    );
    assert.equal((await request("/.env")).status, 404);
    assert.equal((await request("/api/cars/missing")).status, 404);
    await stop();
    await start();
    const restored = await (await request("/api/cars")).json();
    assert.equal(restored.length, 1);
    assert.equal(restored[0].model, "Updated model");
    assert.equal(
      (await request("/api/enquiries", "GET", undefined, headers)).status,
      401,
    );
    const nextLogin = await request("/api/login", "POST", {
      password: "test-password-only-2026",
    });
    const nextCookie = nextLogin.headers.get("set-cookie").split(";")[0];
    const nextSession = await nextLogin.json();
    const nextHeaders = {
      Cookie: nextCookie,
      "X-CSRF-Token": nextSession.csrf,
    };
    const inbox = await (
      await request("/api/enquiries", "GET", undefined, nextHeaders)
    ).json();
    assert.equal(inbox[0].status, "Closed");
    assert.equal(inbox[0].message, enquiry.message);
    assert.equal(
      (await request(`/api/cars/${car.id}`, "DELETE", undefined, nextHeaders))
        .status,
      200,
    );
    assert.equal((await request(`/api/cars/${car.id}`)).status, 404);
    assert.equal(
      (await request("/api/logout", "POST", {}, nextHeaders)).status,
      200,
    );
    assert.equal(
      (await request("/api/enquiries", "GET", undefined, nextHeaders)).status,
      401,
    );
  } finally {
    if (server?.listening) await stop();
    fs.rmSync(storage, { recursive: true, force: true });
  }
});
