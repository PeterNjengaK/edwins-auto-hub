const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createApp } = require("../backend/app");

(async () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "edwins-browser-"));
  const password = "browser-test-password-2026";
  const instance = createApp({ storage, password, quiet: true });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const output = path.join(__dirname, "..", "test-results");
  fs.mkdirSync(output, { recursive: true });
  const errors = [];
  try {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    async function checkLayout(name) {
      await page.evaluate(async () => {
        await Promise.all(
          Array.from(document.images).map((image) => {
            image.loading = "eager";
            return image.decode().catch(() => {});
          }),
        );
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${name}: horizontal overflow`,
      );
      const broken = await page
        .locator("img")
        .evaluateAll((images) =>
          images
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => img.src),
        );
      assert.deepEqual(broken, [], `${name}: broken images`);
      await page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage: true,
      });
    }
    await page.goto("/");
    await page.locator(".car-card").first().waitFor();
    assert.equal(await page.locator(".car-card").count(), 3);
    await checkLayout("home-desktop");
    await page.getByRole("button", { name: "SUVs", exact: true }).click();
    assert.equal(await page.locator(".car-card, .listing-card").count(), 1);
    await page.getByRole("button", { name: "All cars", exact: true }).click();
    await page.locator("[data-save]").first().click();
    await page.goto("/saved");
    await page.locator(".listing-card").waitFor();
    assert.equal(await page.locator(".car-card, .listing-card").count(), 1);
    await page.reload();
    await page.locator(".listing-card").waitFor();
    await page.goto("/cars/");
    await page.locator("#filter-make").selectOption("Toyota");
    assert.equal(await page.locator(".car-card, .listing-card").count(), 1);
    await page.locator("#filter-max").selectOption("1500000");
    await page.getByText("No cars match just yet.").waitFor();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    assert.equal(await page.locator(".car-card").count(), 6);
    await page.locator("#sort").selectOption("price-low");
    assert.match(
      await page.locator(".car-card h3").first().innerText(),
      /Toyota/,
    );
    await checkLayout("catalogue-desktop");
    await page.locator(".car-card h3 a").first().click();
    await page.locator("[data-enquire]").waitFor();
    await checkLayout("vehicle-desktop");
    await page.locator("[data-enquire]").click();
    await page
      .getByLabel("Full name", { exact: true })
      .fill("Browser Customer");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("browser@example.com");
    await page.locator('[name="consent"]').check();
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await page.locator(".form-status.success").waitFor();
    await page.getByRole("button", { name: "Close enquiry" }).click();
    await page.goto("/sell/");
    await page.getByLabel("Full name", { exact: true }).fill("Seller Test");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("seller@example.com");
    await page.getByLabel("Car make", { exact: true }).fill("Toyota");
    await page.getByLabel("Model", { exact: true }).fill("Vitz");
    await page.getByLabel("Year of manufacture").fill("2020");
    await page.getByLabel("Mileage (km)").fill("45000");
    await page.getByLabel("Your asking price (KSh)").fill("1500000");
    await page
      .getByLabel("Condition and other details")
      .fill("Well maintained test vehicle.");
    await page.locator('[name="consent"]').check();
    await page.getByRole("button", { name: "Submit your listing" }).click();
    await page.locator(".form-status.success").waitFor();
    await page.goto("/admin/");
    await page.getByLabel("Admin password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Business overview" }).waitFor();
    await checkLayout("admin-desktop");
    await page.getByRole("button", { name: "Enquiries", exact: true }).click();
    assert.equal(await page.locator(".enquiry-item").count(), 2);
    await page
      .locator("[data-enquiry-status]")
      .first()
      .selectOption("In progress");
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await page
      .getByRole("button", { name: "Add listing", exact: true })
      .click();
    await page.getByLabel("Make", { exact: true }).fill("Test");
    await page.getByLabel("Model", { exact: true }).fill("Roadster");
    await page.getByLabel("Year", { exact: true }).fill("2021");
    await page
      .getByLabel("Asking price (KSh)", { exact: true })
      .fill("2000000");
    await page
      .getByLabel("Vehicle photos", { exact: true })
      .setInputFiles(path.join(__dirname, "..", "images", "porsche.jpg"));
    await page
      .getByRole("button", { name: "Save vehicle", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit Test Roadster", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Edit Test Roadster", exact: true })
      .click();
    assert.equal(await page.locator(".existing-image").count(), 1);
    await page
      .getByLabel("Asking price (KSh)", { exact: true })
      .fill("2100000");
    await page
      .getByRole("button", { name: "Save vehicle", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit Test Roadster", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Delete Test Roadster", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete vehicle", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete Test Roadster", exact: true })
      .waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    for (const width of [390, 768, 1920]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      for (const route of [
        "/",
        "/cars/",
        "/cars/car-details.html?id=mercedes-amg-gt",
        "/sell/",
        "/contact/",
        "/about/",
        "/privacy",
        "/saved",
      ]) {
        await page.goto(route);
        await page.locator("main h1, main h2").first().waitFor();
        await checkLayout(
          `${route === "/" ? "home" : route.split("/")[1]}-${width}`,
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .locator("#main-nav")
      .getByRole("link", { name: "Find a car" })
      .click();
    await page.getByRole("button", { name: "Filter cars" }).click();
    await page.locator("#filter-body").selectOption("SUV");
    assert.equal(await page.locator(".car-card, .listing-card").count(), 1);
    assert.deepEqual(errors, [], "Browser console errors");
    console.log(
      "PASS: browsing, filters, saved cars, enquiries, seller form, admin CRUD, image preservation, enquiry status, logout, mobile navigation, and responsive screenshots.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    instance.close();
    fs.rmSync(storage, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
