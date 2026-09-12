const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../backend/app");
(async () => {
  const storage = fs.mkdtempSync(
    path.join(os.tmpdir(), "edwins-ui-management-"),
  );
  const instance = createApp({
    storage,
    password: "browser-management-password",
    quiet: true,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const baseURL = `http://127.0.0.1:${server.address().port}`,
    browser = await chromium.launch();
  const output = path.join(__dirname, "..", "test-results");
  fs.mkdirSync(output, { recursive: true });
  try {
    const context = await browser.newContext({
        baseURL,
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const seller = await context.request.post("/api/enquiries", {
      data: {
        type: "sell",
        name: "Seller Example",
        email: "seller@example.com",
        consent: true,
        make: "Toyota",
        model: "Auris",
        year: 2020,
        price: 1800000,
        mileage: 45000,
        message: "Private details",
        images: ["/images/toyota.jpg"],
      },
    });
    assert.equal(seller.status(), 201);
    await page.goto("/admin/");
    await page
      .getByLabel("Admin password", { exact: true })
      .fill("browser-management-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Enquiries", exact: true }).click();
    await page.getByRole("button", { name: "Create listing draft" }).click();
    await page
      .getByLabel("Publication", { exact: true })
      .selectOption("Published");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Reviewed, ready for a viewing.");
    await page
      .getByRole("button", { name: "Save vehicle", exact: true })
      .click();
    await page.locator("#editor-dialog").waitFor({ state: "hidden" });
    const cars = await (await context.request.get("/api/cars")).json(),
      car = cars.find((c) => c.model === "Auris");
    assert.ok(car);
    assert.equal(car.sourceEnquiryId, undefined);
    await context.request.post("/api/enquiries", {
      data: {
        type: "vehicle",
        carId: car.id,
        name: "Buyer Example",
        email: "buyer@example.com",
        message: "I would like a viewing.",
        consent: true,
      },
    });
    await page
      .getByRole("button", { name: "Refresh workspace", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Buyer Example", exact: false })
      .waitFor();
    const buyer = page.locator(".enquiry-item").filter({
      has: page.getByRole("heading", { name: "Buyer Example", exact: false }),
    });
    await buyer.getByRole("button", { name: "Notes & follow-up" }).click();
    await page.getByLabel("Priority", { exact: true }).selectOption("High");
    await page.getByLabel("Next follow-up").fill("2020-01-01");
    await page
      .getByLabel("Add a private note")
      .fill("Discussed inspection and budget.");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.locator("#management-dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: /Buyer Example/ }).waitFor();
    await page.getByRole("button", { name: "Enquiries", exact: true }).click();
    await buyer.getByRole("button", { name: "Arrange viewing" }).click();
    await page.getByLabel("Date and time").fill("2027-06-20T10:00");
    await page
      .getByRole("button", { name: "Save viewing", exact: true })
      .click();
    await page.locator("#management-dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Viewings", exact: true }).click();
    await page
      .getByRole("heading", { name: "2020 Toyota Auris", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Enquiries", exact: true }).click();
    await buyer
      .getByRole("button", { name: "Record sale", exact: true })
      .click();
    await page.getByLabel("Final sale price (KSh)").fill("1700000");
    await page.getByRole("checkbox").check();
    await page
      .locator("#management-dialog")
      .getByRole("button", { name: "Record sale", exact: true })
      .click();
    await page.locator("#management-dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Reports", exact: true }).click();
    await page.getByText("KSh 1,700,000", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("Business name", { exact: true })
      .fill("Edwin Test Motors");
    await page
      .getByLabel("Phone number", { exact: true })
      .fill("+254 711 222 333");
    await page.getByRole("button", { name: "Save business details" }).click();
    await page.locator(".form-status.success").waitFor();
    const customerPage = await context.newPage();
    await customerPage.goto("/contact/");
    await customerPage.locator('a[href="tel:+254711222333"]').first().waitFor();
    assert.ok(
      (
        await customerPage.locator(".brand-wordmark").first().innerText()
      ).includes("Edwin Test Motors"),
    );
    await customerPage.close();
    await page
      .getByRole("button", { name: "Install admin app", exact: true })
      .last()
      .click();
    await page
      .getByRole("heading", { name: "Install Edwin's Manager" })
      .waitFor();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const manifest = await (
      await context.request.get("/admin/manifest.webmanifest")
    ).json();
    assert.equal(manifest.display, "standalone");
    for (const icon of manifest.icons) {
      assert.equal((await context.request.get(icon.src)).status(), 200);
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page
      .getByLabel("Admin password", { exact: true })
      .fill("browser-management-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const view of [
        "Overview",
        "Enquiries",
        "Viewings",
        "Customers",
        "Reports",
        "Settings",
        "Activity",
      ]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${view} overflow at ${width}`,
        );
        await page.screenshot({
          path: path.join(output, `manager-${view.toLowerCase()}-${width}.png`),
          fullPage: true,
        });
      }
    }
    const keys = await page.evaluate(async () => {
      const result = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys())
          result.push(request.url);
      }
      return result;
    });
    assert.ok(keys.length > 0);
    assert.ok(!keys.some((key) => key.includes("/api/")));
    await context.setOffline(true);
    await page.goto("/admin/");
    await page.getByRole("heading", { name: "Let's reconnect." }).waitFor();
    await context.setOffline(false);
    await page.getByRole("link", { name: "Try again" }).click();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: seller drafts, private notes, follow-ups, linked viewings, sale records, public business settings, install manifest, private-data cache exclusion, offline recovery, and desktop/tablet/phone admin screenshots.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    instance.close();
    fs.rmSync(storage, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
