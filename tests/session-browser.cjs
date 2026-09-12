const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { createApp } = require("../backend/app");
(async () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "edwins-session-ui-"));
  const instance = createApp({
    storage,
    password: "browser-session-password",
    quiet: true,
    idleTimeoutMs: 2000,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const baseURL = `http://127.0.0.1:${server.address().port}`,
    browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
    let page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    async function signIn() {
      await page
        .getByLabel("Admin password", { exact: true })
        .fill("browser-session-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("heading", { name: "Business overview" }).waitFor();
    }
    await page.goto("/admin/");
    await signIn();
    assert.ok(await page.locator(".admin-sidebar").isVisible());
    const side = await page.locator(".admin-sidebar").boundingBox(),
      content = await page.locator(".admin-workspace").boundingBox();
    assert.ok(side.x + side.width <= content.x);
    await page
      .getByRole("button", { name: "Add listing", exact: true })
      .click();
    await page.getByLabel("Make", { exact: true }).fill("Unsaved");
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.equal(await page.locator("#editor-content").innerText(), "");
    await signIn();
    await page.reload();
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    await signIn();
    await page.close();
    page = await context.newPage();
    await page.goto("/admin/");
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.equal(
      (await (await context.request.get("/api/session")).json()).authenticated,
      false,
    );
    await signIn();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Inventory CSV", exact: true })
      .click();
    const download = await downloadPromise;
    assert.ok(download.suggestedFilename().endsWith(".csv"));
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: idle logout clears dialogs, reload/closed windows require sign-in, left navigation, and authenticated CSV downloads.",
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
