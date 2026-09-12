const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createApp } = require("./app");

test("connected management: draft to listing, enquiry to sale, settings, backup, and persistent password rotation", async () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "edwins-management-"));
  let app,
    server,
    base,
    headers = {};
  const initial = "management-test-password";
  async function start() {
    app = createApp({ storage, password: initial, seed: false, quiet: true });
    server = app.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((r) => server.close(r));
    app.close();
  }
  async function request(url, method = "GET", body, auth = true) {
    return fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", ...(auth ? headers : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function login(password = initial) {
    const response = await request("/api/login", "POST", { password }, false);
    assert.equal(response.status, 200);
    headers = {
      Cookie: response.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": (await response.json()).csrf,
    };
  }
  try {
    await start();
    for (const url of [
      "/api/admin/cars",
      "/api/appointments",
      "/api/admin/activity",
      "/api/admin/export/enquiries",
      "/api/admin/backup",
    ])
      assert.equal((await request(url)).status, 401);
    await login();
    const business = {
      name: "Test Motors",
      phone: "+254 711 111 111",
      whatsapp: "254711111111",
      email: "sales@example.com",
      location: "Nakuru, Kenya",
      hours: "By appointment",
      tagline: "Drive something different.",
    };
    assert.equal((await request("/api/business", "PUT", business)).status, 200);
    assert.deepEqual(
      await (await request("/api/business", "GET", undefined, false)).json(),
      business,
    );
    const seller = {
      name: "Seller",
      email: "seller@example.com",
      phone: "0711111111",
      message: "Private seller details",
      consent: true,
      type: "sell",
      make: "Toyota",
      model: "Auris",
      year: 2020,
      price: 1800000,
      mileage: 40000,
      images: [],
    };
    const submission = await request("/api/enquiries", "POST", seller, false);
    assert.equal(submission.status, 201);
    const sellerId = (await submission.json()).id;
    const conversion = await request(
      `/api/enquiries/${sellerId}/draft`,
      "POST",
      {},
    );
    assert.equal(conversion.status, 201);
    let car = await conversion.json();
    assert.equal(car.publication, "Draft");
    assert.equal(car.description, "");
    assert.equal(
      (await request(`/api/enquiries/${sellerId}/draft`, "POST", {})).status,
      409,
    );
    assert.equal((await request("/api/cars")).status, 200);
    assert.equal((await (await request("/api/cars")).json()).length, 0);
    assert.equal((await request(`/api/cars/${car.id}`)).status, 404);
    assert.equal(
      (
        await request(`/api/cars/${car.id}`, "PUT", {
          ...car,
          publication: "Published",
        })
      ).status,
      400,
    );
    let updated = await request(`/api/cars/${car.id}`, "PUT", {
      ...car,
      publication: "Published",
      images: ["/images/toyota.jpg"],
      description: "Reviewed public description",
    });
    assert.equal(updated.status, 200);
    car = await updated.json();
    const publicCar = await (await request(`/api/cars/${car.id}`)).json();
    assert.equal(publicCar.sourceEnquiryId, undefined);
    assert.equal(publicCar.description, "Reviewed public description");
    assert.equal(
      (
        await request(`/api/cars/${car.id}`, "PUT", {
          ...car,
          updatedAt: "old-version",
        })
      ).status,
      409,
    );
    const buyer = {
      name: "=Buyer",
      email: "buyer@example.com",
      phone: "0711222333",
      message: "A viewing please",
      consent: true,
      type: "vehicle",
      carId: car.id,
    };
    const buyerResult = await request("/api/enquiries", "POST", buyer, false);
    assert.equal(buyerResult.status, 201);
    const buyerId = (await buyerResult.json()).id;
    assert.equal(
      (
        await request(`/api/enquiries/${buyerId}/manage`, "PATCH", {
          status: "In progress",
          priority: "High",
          followUp: "2027-01-20",
          note: "Private conversation note",
        })
      ).status,
      200,
    );
    const appointment = {
      enquiryId: buyerId,
      carId: car.id,
      startsAt: "2027-02-20T10:00:00.000Z",
      location: "Nakuru showroom",
      status: "Scheduled",
      notes: "Bring mechanic",
    };
    assert.equal(
      (await request("/api/appointments", "POST", appointment)).status,
      201,
    );
    assert.equal(
      (
        await request("/api/appointments", "POST", {
          ...appointment,
          startsAt: "2027-02-20T10:30:00.000Z",
        })
      ).status,
      409,
    );
    assert.equal((await request(`/api/cars/${car.id}`, "DELETE")).status, 409);
    assert.equal(
      (
        await request(`/api/enquiries/${buyerId}/sale`, "POST", {
          carId: car.id,
          price: 1750000,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(`/api/enquiries/${buyerId}/sale`, "POST", {
          carId: car.id,
          price: 1750000,
        })
      ).status,
      409,
    );
    const sold = await (await request(`/api/cars/${car.id}`)).json();
    assert.equal(sold.status, "Sold");
    assert.equal(sold.saleId, undefined);
    assert.equal(
      (
        await request(`/api/cars/${car.id}`, "PUT", {
          ...car,
          status: "Available",
        })
      ).status,
      409,
    );
    assert.equal(
      (await request("/api/enquiries", "POST", buyer, false)).status,
      409,
    );
    assert.equal(
      (await (await request("/api/appointments")).json())[0].status,
      "Cancelled",
    );
    const inbox = await (await request("/api/enquiries")).json();
    const won = inbox.find((q) => q.id === buyerId);
    assert.equal(won.status, "Won");
    assert.equal(won.followUp, "");
    assert.equal(won.notes[0].text, "Private conversation note");
    assert.equal(
      (await request(`/api/enquiries/${buyerId}`, "DELETE")).status,
      409,
    );
    const exported = await (
      await request("/api/admin/export/enquiries")
    ).text();
    assert.ok(exported.includes("'=Buyer"));
    const backup = await request("/api/admin/backup");
    assert.equal(backup.status, 200);
    const bytes = Buffer.from(await backup.arrayBuffer());
    assert.equal(bytes.subarray(0, 15).toString(), "SQLite format 3");
    const backupFile = path.join(storage, "verify.sqlite");
    fs.writeFileSync(backupFile, bytes);
    const backupDb = new DatabaseSync(backupFile);
    assert.equal(
      backupDb.prepare("SELECT COUNT(*) AS count FROM enquiries").get().count,
      2,
    );
    backupDb.close();
    assert.ok(
      (await (await request("/api/admin/activity")).json()).some(
        (x) => x.action === "Sale recorded",
      ),
    );
    assert.equal(
      (
        await request("/api/admin/password", "POST", {
          currentPassword: "bad",
          newPassword: "new-management-password",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/admin/password", "POST", {
          currentPassword: initial,
          newPassword: "new-management-password",
        })
      ).status,
      200,
    );
    assert.equal((await request("/api/admin/cars")).status, 401);
    await stop();
    await start();
    assert.equal(
      (await request("/api/login", "POST", { password: initial }, false))
        .status,
      401,
    );
    await login("new-management-password");
    assert.equal(
      (await (await request("/api/business")).json()).name,
      "Test Motors",
    );
    assert.equal(
      (await (await request("/api/enquiries")).json()).find(
        (q) => q.id === buyerId,
      ).sale.price,
      1750000,
    );
    assert.equal((await request("/admin/manifest.webmanifest")).status, 200);
    assert.equal((await request("/admin/sw.js")).status, 200);
  } finally {
    if (server?.listening) await stop();
    fs.rmSync(storage, { recursive: true, force: true });
  }
});
