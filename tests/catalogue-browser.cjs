const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../backend/app");
(async () => {
  const storage = fs.mkdtempSync(
    path.join(os.tmpdir(), "edwins-catalogue-ui-"),
  );
  const instance = createApp({
    storage,
    password: "catalogue-browser-password",
    quiet: true,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const browser = await chromium.launch(),
    errors = [];
  try {
    const context = await browser.newContext({
      baseURL: `http://127.0.0.1:${server.address().port}`,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (err) => errors.push(err.message));
    const output = path.join(__dirname, "..", "test-results");
    fs.mkdirSync(output, { recursive: true });
    async function layout(name) {
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map((img) => {
            img.loading = "eager";
            return img.decode().catch(() => {});
          }),
        );
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        name + " overflow",
      );
      assert.deepEqual(
        await page
          .locator("img")
          .evaluateAll((imgs) =>
            imgs.filter((img) => !img.naturalWidth).map((img) => img.src),
          ),
        [],
        name + " broken images",
      );
      await page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage: true,
      });
    }
    await page.goto("/parts/");
    await expect(page.locator(".listing-card")).toHaveCount(2);
    await page.getByLabel("Condition", { exact: true }).selectOption("Used");
    await expect(page.locator(".listing-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator(".listing-card")).toHaveCount(2);
    await page.getByLabel("Search", { exact: true }).fill("DEMO-KIT");
    await expect(page.locator(".listing-card")).toHaveCount(1);
    await page.locator("[data-save]").click();
    await page.goto("/saved");
    await expect(page.locator(".listing-card")).toHaveCount(1);
    await page.locator(".listing-card h3 a").click();
    await page.getByRole("button", { name: "Ask about this part" }).click();
    await page.getByLabel("Full name", { exact: true }).fill("Parts Buyer");
    await page.getByLabel("Email address").fill("parts@example.com");
    await page.locator("[name=consent]").check();
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await page.locator(".form-status.success").waitFor();
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of [
        "parts/",
        "properties/",
        "listing/?id=sample-new-house",
        "catalogue/",
      ]) {
        await page.goto("/" + route);
        await page.locator(".listing-card,.detail-layout").first().waitFor();
        await layout("multi-" + route.split("/")[0] + "-" + width);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const category of ["part", "land", "house"]) {
      await page.goto("/sell/");
      await page.getByLabel("Category", { exact: true }).selectOption(category);
      await page
        .getByLabel("Full name", { exact: true })
        .fill(category + " Seller");
      await page.getByLabel("Email address").fill(category + "@example.com");
      await page.getByLabel("Listing title").fill("Submitted " + category);
      await page.getByLabel("Location", { exact: true }).fill("Nakuru");
      if (category === "part") {
        await page.getByLabel("Part number / SKU").fill("REAL-101");
        await page.getByLabel("Part type", { exact: true }).fill("Brake pad");
        await page
          .getByLabel("Compatible makes, models and years")
          .fill("Toyota Auris 2020");
        await page.getByLabel("Quantity in stock").fill("3");
      } else {
        await page
          .getByLabel(category === "land" ? "Land area" : "Floor area", {
            exact: true,
          })
          .fill(category === "land" ? "0.125" : "180");
      }
      await page.getByLabel("Your asking price (KSh)").fill("100000");
      await page
        .getByLabel("Condition and other details")
        .fill("Private seller details");
      await page
        .getByLabel("Listing photos (optional)")
        .setInputFiles(
          path.join(
            __dirname,
            "..",
            "images",
            category === "part" ? "parts.jpg" : "land.jpg",
          ),
        );
      await page.locator("[name=consent]").check();
      await page.getByRole("button", { name: "Submit your listing" }).click();
      await page.locator(".form-status.success").waitFor();
    }
    await page.goto("/admin/");
    await page
      .getByLabel("Admin password", { exact: true })
      .fill("catalogue-browser-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Enquiries", exact: true }).click();
    for (const category of ["part", "land", "house"]) {
      const seller = page.locator(".enquiry-item").filter({
        has: page.getByRole("heading", {
          name: category + " Seller",
          exact: false,
        }),
      });
      await seller
        .getByRole("button", { name: "Create listing draft" })
        .click();
      await page
        .getByLabel("Publication", { exact: true })
        .selectOption("Published");
      await page
        .getByLabel("Description", { exact: true })
        .fill("Reviewed " + category);
      await page
        .getByRole("button", { name: "Save listing", exact: true })
        .click();
      await page.locator("#editor-dialog").waitFor({ state: "hidden" });
    }
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await page
      .getByRole("button", { name: "Add listing", exact: true })
      .click();
    await page
      .locator("#editor-dialog")
      .getByLabel("Category", { exact: true })
      .selectOption("part");
    await page.getByLabel("Listing title").fill("New admin part");
    await page.getByLabel("Part number / SKU").fill("ADMIN-1");
    await page.getByLabel("Part type", { exact: true }).fill("Filter");
    await page
      .getByLabel("Compatible makes, models and years")
      .fill("Example 2020");
    await page.getByLabel("Unit price (KSh)").fill("2000");
    await page
      .getByLabel("Listing photos", { exact: true })
      .setInputFiles(path.join(__dirname, "..", "images", "parts.jpg"));
    await page
      .getByRole("button", { name: "Save listing", exact: true })
      .click();
    await page.locator("#editor-dialog").waitFor({ state: "hidden" });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await layout("multi-admin-" + width);
    }
    const data = await (await context.request.get("/api/listings")).json();
    const part = data.find((c) => c.title === "Submitted part");
    assert.equal(part.quantity, 3);
    const buyer = await context.request.post("/api/enquiries", {
      data: {
        type: "listing",
        carId: part.id,
        name: "Stock Buyer",
        email: "stock@example.com",
        message: "Two units please",
        consent: true,
      },
    });
    assert.equal(buyer.status(), 201);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Refresh workspace", exact: true })
      .click();
    await page.getByRole("button", { name: "Enquiries", exact: true }).click();
    await page
      .locator(".enquiry-item")
      .filter({
        has: page.getByRole("heading", { name: "Stock Buyer", exact: false }),
      })
      .getByRole("button", { name: "Record sale", exact: true })
      .click();
    await page.getByLabel("Quantity sold").fill("2");
    await page.getByLabel("Final sale price (KSh)").fill("190000");
    await page.getByRole("checkbox").check();
    await page
      .locator("#management-dialog")
      .getByRole("button", { name: "Record sale", exact: true })
      .click();
    await page.locator("#management-dialog").waitFor({ state: "hidden" });
    const updated = await (
      await context.request.get("/api/listings/" + part.id)
    ).json();
    assert.equal(updated.quantity, 1);
    assert.equal(updated.status, "Available");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: multi-category browsing, filters, saved listings, seller submissions, admin publishing and creation, parts sales and desktop/tablet/mobile layouts.",
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
