const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("./app");

test("multi-category inventory, seller drafts, appointments, part quantities and property sales stay connected", async () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "edwins-catalogue-"));
  const app = createApp({
    storage,
    password: "catalogue-test-password",
    seed: false,
    quiet: true,
  });
  const server = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let auth = {};
  const request = (url, method = "GET", body, admin = true) =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", ...(admin ? auth : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const createEnquiry = async (type, body = {}) => {
    const r = await request(
      "/api/enquiries",
      "POST",
      {
        name: "Catalogue customer",
        email: "customer@example.com",
        message: "Private submission message",
        consent: true,
        type,
        ...body,
      },
      false,
    );
    assert.equal(r.status, 201, await r.clone().text());
    return (await r.json()).id;
  };
  try {
    const login = await request(
      "/api/login",
      "POST",
      { password: "catalogue-test-password" },
      false,
    );
    auth = {
      Cookie: login.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": (await login.json()).csrf,
    };
    const common = {
      price: 100000,
      description: "Reviewed listing",
      publication: "Published",
      status: "Available",
      images: ["/images/parts.jpg"],
      features: [],
      location: "Nakuru",
      condition: "New",
    };
    const part = {
      ...common,
      category: "part",
      title: "Service kit",
      partNumber: "KIT-101",
      partType: "Service kit",
      brand: "Example",
      compatibility: "Toyota Auris 2020",
      quantity: 3,
    };
    const land = {
      ...common,
      category: "land",
      title: "Nakuru plot",
      propertyType: "Plot",
      area: 0.125,
      areaUnit: "Acres",
      tenure: "To be confirmed",
    };
    const house = {
      ...common,
      category: "house",
      title: "Family house",
      propertyType: "House",
      area: 180,
      areaUnit: "Square metres",
      tenure: "Freehold",
      bedrooms: 3,
      bathrooms: 2,
      condition: "Used",
    };
    const items = [];
    for (const body of [part, land, house]) {
      const r = await request("/api/cars", "POST", body);
      assert.equal(r.status, 201, await r.clone().text());
      items.push(await r.json());
    }
    assert.equal((await (await request("/api/listings")).json()).length, 3);
    assert.equal((await (await request("/api/cars")).json()).length, 0);
    for (const item of items) {
      assert.equal((await request(`/api/cars/${item.id}`)).status, 404);
      assert.equal((await request(`/api/listings/${item.id}`)).status, 200);
    }
    assert.equal(
      (
        await request(`/api/cars/${items[0].id}`, "PUT", {
          ...items[0],
          category: "house",
        })
      ).status,
      400,
    );
    assert.equal(
      (await request("/api/cars", "POST", { ...part, quantity: -1 })).status,
      400,
    );
    assert.equal(
      (await request("/api/cars", "POST", { ...land, area: 0 })).status,
      400,
    );
    assert.equal(
      (await request("/api/cars", "POST", { ...house, condition: "Unknown" }))
        .status,
      400,
    );
    for (const body of [part, land, house]) {
      const id = await createEnquiry("sell", {
        ...body,
        listingTitle: body.title,
      });
      const r = await request(`/api/enquiries/${id}/draft`, "POST", {});
      assert.equal(r.status, 201);
      const draft = await r.json();
      assert.equal(draft.category, body.category);
      assert.equal(draft.title, body.title);
      assert.equal(draft.description, "");
      assert.equal(draft.demo, false);
      assert.equal((await request(`/api/listings/${draft.id}`)).status, 404);
      const published = await request(`/api/cars/${draft.id}`, "PUT", {
        ...draft,
        publication: "Published",
        description: "Reviewed",
      });
      assert.equal(published.status, 200);
      assert.equal(
        (await (await request(`/api/listings/${draft.id}`)).json())
          .sourceEnquiryId,
        undefined,
      );
    }
    const buyer = await createEnquiry("listing", { carId: items[0].id });
    assert.equal(
      (
        await request(`/api/enquiries/${buyer}/sale`, "POST", {
          carId: items[0].id,
          price: 200000,
          quantity: 4,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/enquiries/${buyer}/sale`, "POST", {
          carId: items[0].id,
          price: 200000,
          quantity: 2,
        })
      ).status,
      200,
    );
    const stock = await (await request(`/api/listings/${items[0].id}`)).json();
    assert.equal(stock.quantity, 1);
    assert.equal(stock.status, "Available");
    assert.equal(
      (
        await request(`/api/cars/${items[0].id}`, "PUT", {
          ...items[0],
          quantity: 3,
        })
      ).status,
      409,
      "stale editor cannot undo a sale",
    );
    const finalBuyer = await createEnquiry("listing", { carId: items[0].id });
    assert.equal(
      (
        await request(`/api/enquiries/${finalBuyer}/sale`, "POST", {
          carId: items[0].id,
          price: 100000,
          quantity: 1,
        })
      ).status,
      200,
    );
    const soldPart = await (
      await request(`/api/listings/${items[0].id}`)
    ).json();
    assert.equal(soldPart.quantity, 0);
    assert.equal(soldPart.status, "Sold");
    assert.equal(
      (await request(`/api/cars/${items[0].id}`, "DELETE")).status,
      409,
    );
    for (const property of items.slice(1)) {
      const customer = await createEnquiry("listing", { carId: property.id });
      const appointment = {
        enquiryId: customer,
        carId: property.id,
        startsAt: "2027-10-10T12:00:00Z",
        location: "Site entrance",
        status: "Scheduled",
      };
      assert.equal(
        (
          await request("/api/appointments", "POST", {
            ...appointment,
            carId: items[0].id,
          })
        ).status,
        400,
      );
      assert.equal(
        (await request("/api/appointments", "POST", appointment)).status,
        201,
      );
      assert.equal(
        (
          await request(`/api/enquiries/${customer}/sale`, "POST", {
            carId: property.id,
            price: 100000,
            quantity: 2,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(`/api/enquiries/${customer}/sale`, "POST", {
            carId: property.id,
            price: 100000,
          })
        ).status,
        200,
      );
      assert.equal(
        (await (await request(`/api/listings/${property.id}`)).json()).status,
        "Sold",
      );
      const updated = (await (await request("/api/admin/cars")).json()).find(
        (c) => c.id === property.id,
      );
      assert.equal(
        (
          await request(`/api/cars/${property.id}`, "PUT", {
            ...updated,
            status: "Available",
          })
        ).status,
        400,
      );
    }
    assert.ok(
      (await (await request("/api/appointments")).json()).every(
        (a) => a.status === "Cancelled",
      ),
    );
    const sales = await (await request("/api/admin/export/sales")).text();
    assert.match(sales, /Quantity/);
    assert.match(sales, /Service kit/);
    assert.match(sales, /house/);
    const csv = await (await request("/api/admin/export/inventory")).text();
    assert.match(csv, /Category/);
    assert.match(csv, /Nakuru plot/);
  } finally {
    await new Promise((r) => server.close(r));
    app.close();
    fs.rmSync(storage, { recursive: true, force: true });
  }
});
