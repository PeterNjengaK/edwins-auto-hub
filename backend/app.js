const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const seed = require("./seed");
const catalogueSeed = require("./catalogue-seed");
const { kind, title: listingTitle, validateProduct } = require("./catalogue");
const { management, transaction } = require("./management");
const root = path.join(__dirname, "..");
const clean = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const safeImage = (value) =>
  typeof value === "string" &&
  (/^\/images\/[a-zA-Z0-9._-]+$/.test(value) ||
    /^https:\/\//.test(value) ||
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) &&
  value.length <= 2800000;

function createApp(options = {}) {
  const production = process.env.NODE_ENV === "production";
  const storage = options.storage || path.join(__dirname, "storage");
  fs.mkdirSync(storage, { recursive: true });
  const db = new DatabaseSync(
    options.database || path.join(storage, "hub.sqlite"),
  );
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS cars (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS enquiries (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
  );
  if (
    !db.prepare("SELECT value FROM settings WHERE key = ?").get("initialized")
  ) {
    if (
      options.seed !== false &&
      process.env.SEED_DEMO !== "false" &&
      !production
    ) {
      const insert = db.prepare("INSERT INTO cars VALUES (?, ?)");
      for (const car of [...seed, ...catalogueSeed])
        insert.run(car.id, JSON.stringify(car));
    }
    db.prepare("INSERT INTO settings VALUES (?, ?)").run("initialized", "1");
  }
  const storedCredential = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("adminCredential");
  let password = options.password || process.env.ADMIN_PASSWORD;
  if (!storedCredential && !password && production)
    throw new Error("ADMIN_PASSWORD is required in production.");
  if (!storedCredential && !password) {
    const passwordFile = path.join(storage, "local-admin-password.txt");
    if (!fs.existsSync(passwordFile))
      fs.writeFileSync(passwordFile, randomBytes(18).toString("base64url"), {
        mode: 0o600,
      });
    password = fs.readFileSync(passwordFile, "utf8").trim();
    if (!options.quiet)
      console.log(`Local admin password is saved in ${passwordFile}`);
  }
  if (!storedCredential && password.length < 12)
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  let salt = storedCredential
    ? Buffer.from(JSON.parse(storedCredential.value).salt, "hex")
    : randomBytes(16);
  let passwordHash = storedCredential
    ? Buffer.from(JSON.parse(storedCredential.value).hash, "hex")
    : scryptSync(password, salt, 64);
  const verifyPassword = (value) =>
    timingSafeEqual(scryptSync(value, salt, 64), passwordHash);
  const setPassword = (value) => {
    const nextSalt = randomBytes(16),
      nextHash = scryptSync(value, nextSalt, 64);
    db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(
      "adminCredential",
      JSON.stringify({
        salt: nextSalt.toString("hex"),
        hash: nextHash.toString("hex"),
      }),
    );
    salt = nextSalt;
    passwordHash = nextHash;
    const bootstrapFile = path.join(storage, "local-admin-password.txt");
    if (fs.existsSync(bootstrapFile)) fs.rmSync(bootstrapFile);
  };
  const sessions = new Map();
  const sessionNow = options.now || Date.now;
  const idleTimeoutMs = options.idleTimeoutMs || 15 * 60 * 1000;
  const limits = new Map();
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    if (production) res.set("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (
        (origin && origin !== `${req.protocol}://${req.get("host")}`) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return res
          .status(403)
          .json({ message: "This request is not allowed." });
    }
    next();
  });
  app.use(express.json({ limit: "12mb" }));
  function limit(key, max, windowMs) {
    return (req, res, next) => {
      const id = `${key}:${req.ip}`;
      const now = Date.now();
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
      const bucket = limits.get(id) || { count: 0, until: now + windowMs };
      bucket.count += 1;
      limits.set(id, bucket);
      if (bucket.count > max)
        return res.status(429).json({
          message: "Too many attempts. Please try again in a few minutes.",
        });
      next();
    };
  }
  function session(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("hub_session="))
      ?.slice(12);
    const current = sessions.get(token);
    if (
      !current ||
      current.expires <= sessionNow() ||
      sessionNow() - current.lastActivity >= idleTimeoutMs
    ) {
      sessions.delete(token);
      return null;
    }
    return { ...current, token };
  }
  function admin(req, res, next) {
    const current = session(req);
    if (!current)
      return res.status(401).json({ message: "Please sign in to continue." });
    if (req.get("x-csrf-token") !== current.csrf)
      return res
        .status(403)
        .json({ message: "Your session has changed. Please sign in again." });
    req.session = current;
    next();
  }
  const { audit } = management({
    app,
    db,
    admin,
    sessions,
    verifyPassword,
    setPassword,
    storage,
  });
  const publicCar = (car) => {
    const { sourceEnquiryId, saleId, ...publicData } = car;
    return publicData;
  };
  const published = (car) => !["Draft", "Archived"].includes(car.publication);
  app.get("/api/listings", (req, res) =>
    res.json(
      db
        .prepare("SELECT data FROM cars ORDER BY rowid")
        .all()
        .map((r) => JSON.parse(r.data))
        .filter(published)
        .map(publicCar),
    ),
  );
  app.get("/api/listings/:id", (req, res) => {
    const row = db
      .prepare("SELECT data FROM cars WHERE id=?")
      .get(req.params.id);
    const item = row && JSON.parse(row.data);
    return item && published(item)
      ? res.json(publicCar(item))
      : res.status(404).json({ message: "Listing not found." });
  });
  app.get("/api/health", (req, res) =>
    res.json({ status: "ok", app: "edwins-auto-hub" }),
  );
  app.get("/api/cars", (req, res) =>
    res.json(
      db
        .prepare("SELECT data FROM cars ORDER BY rowid")
        .all()
        .map((row) => JSON.parse(row.data))
        .filter(published)
        .filter((car) => kind(car) === "vehicle")
        .map(publicCar),
    ),
  );
  app.get("/api/cars/:id", (req, res) => {
    const row = db
      .prepare("SELECT data FROM cars WHERE id = ?")
      .get(req.params.id);
    return row &&
      published(JSON.parse(row.data)) &&
      kind(JSON.parse(row.data)) === "vehicle"
      ? res.json(publicCar(JSON.parse(row.data)))
      : res.status(404).json({ message: "This vehicle could not be found." });
  });
  app.get("/api/session", (req, res) => {
    const current = session(req);
    const authenticated = !!current && req.get("x-csrf-token") === current.csrf;
    res.json({ authenticated, idleTimeoutMs });
  });
  app.post("/api/session/activity", admin, (req, res) => {
    sessions.get(req.session.token).lastActivity = sessionNow();
    res.json({ ok: true });
  });
  app.post("/api/login", limit("login", 10, 15 * 60 * 1000), (req, res) => {
    if (
      !timingSafeEqual(
        scryptSync(clean(req.body.password, 1024), salt, 64),
        passwordHash,
      )
    )
      return res.status(401).json({ message: "That password is incorrect." });
    for (const [key, value] of sessions)
      if (
        value.expires <= sessionNow() ||
        sessionNow() - value.lastActivity >= idleTimeoutMs
      )
        sessions.delete(key);
    const token = randomBytes(32).toString("hex");
    const csrf = randomBytes(24).toString("hex");
    sessions.set(token, {
      csrf,
      lastActivity: sessionNow(),
      expires: sessionNow() + 8 * 60 * 60 * 1000,
    });
    res.cookie("hub_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/",
    });
    res.json({ authenticated: true, csrf, idleTimeoutMs });
  });
  app.post("/api/logout", admin, (req, res) => {
    sessions.delete(req.session.token);
    res.clearCookie("hub_session", { path: "/" });
    res.json({ ok: true });
  });
  function validateCar(body, existing = {}) {
    const category = body.category || existing.category || "vehicle";
    if (category !== "vehicle")
      return validateProduct(body, existing, safeImage);
    if (existing.id && kind(existing) !== category)
      throw new Error("The category of an existing listing cannot be changed.");
    const car = { ...existing };
    car.category = "vehicle";
    car.publication = body.publication || existing.publication || "Published";
    if (!["Draft", "Published", "Archived"].includes(car.publication))
      throw new Error("Select a valid publication state.");
    if (existing.saleId && body.status !== "Sold")
      throw new Error("This vehicle has a recorded sale and must remain Sold.");
    car.updatedAt = new Date().toISOString();
    for (const key of ["make", "model", "engine", "color", "description"])
      car[key] = clean(body[key], key === "description" ? 3000 : 100);
    if (!car.make || !car.model)
      throw new Error("Make and model are required.");
    for (const [key, min, max] of [
      ["price", 1, 1000000000],
      ["year", 1950, new Date().getFullYear() + 1],
      ["mileage", 0, 2000000],
    ]) {
      const value = Number(body[key]);
      if (
        body[key] === "" ||
        body[key] == null ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
      )
        throw new Error(`Please enter a valid ${key}.`);
      car[key] = value;
    }
    for (const [key, values] of [
      [
        "body",
        ["Sedan", "SUV", "Hatchback", "Coupe", "Pickup", "Van", "Wagon"],
      ],
      ["fuel", ["Petrol", "Diesel", "Hybrid", "Electric"]],
      ["transmission", ["Automatic", "Manual"]],
      ["condition", ["Foreign used", "Locally used", "New", "Used"]],
      ["status", ["Available", "Reserved", "Sold"]],
    ]) {
      if (!values.includes(body[key]))
        throw new Error(`Please select a valid ${key}.`);
      car[key] = body[key];
    }
    const images =
      body.images === undefined ? existing.images || [] : body.images;
    if (
      !Array.isArray(images) ||
      (car.publication === "Published" && images.length < 1) ||
      images.length > 4 ||
      !images.every(safeImage)
    )
      throw new Error(
        "Add one to four JPG, PNG, or WebP images, up to 2 MB each.",
      );
    car.images = images;
    car.image = images[0];
    car.featured = body.featured === true;
    car.demo = existing.demo === true && body.demo !== false;
    car.features = Array.isArray(body.features)
      ? body.features
          .slice(0, 20)
          .map((x) => clean(x, 60))
          .filter(Boolean)
      : [];
    return car;
  }
  app.post("/api/cars", admin, (req, res) => {
    try {
      const car = {
        ...validateCar(req.body),
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        demo: false,
      };
      db.prepare("INSERT INTO cars VALUES (?, ?)").run(
        car.id,
        JSON.stringify(car),
      );
      audit("Listing added", listingTitle(car));
      res.status(201).json(car);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app.put("/api/cars/:id", admin, (req, res) => {
    const row = db
      .prepare("SELECT data FROM cars WHERE id = ?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ message: "Vehicle not found." });
    if (
      req.body.updatedAt &&
      req.body.updatedAt !==
        (JSON.parse(row.data).updatedAt || JSON.parse(row.data).createdAt)
    )
      return res.status(409).json({
        message:
          "This vehicle changed on another device. Close the editor and refresh before editing again.",
      });
    try {
      const car = validateCar(req.body, JSON.parse(row.data));
      transaction(db, () => {
        db.prepare("UPDATE cars SET data = ? WHERE id = ?").run(
          JSON.stringify(car),
          req.params.id,
        );
        if (car.status === "Sold" || !published(car)) {
          for (const row of db.prepare("SELECT data FROM appointments").all()) {
            const viewing = JSON.parse(row.data);
            if (viewing.carId === car.id && viewing.status === "Scheduled") {
              viewing.status = "Cancelled";
              db.prepare("UPDATE appointments SET data=? WHERE id=?").run(
                JSON.stringify(viewing),
                viewing.id,
              );
            }
          }
        }
        audit("Listing updated", listingTitle(car));
      });
      res.json(car);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  app.delete("/api/cars/:id", admin, (req, res) => {
    const row = db
      .prepare("SELECT data FROM cars WHERE id=?")
      .get(req.params.id);
    if (row && JSON.parse(row.data).saleId)
      return res.status(409).json({
        message: "Listings with recorded sales must be archived, not deleted.",
      });
    if (
      db
        .prepare("SELECT data FROM appointments")
        .all()
        .some((r) => {
          const a = JSON.parse(r.data);
          return a.carId === req.params.id && a.status === "Scheduled";
        })
    )
      return res.status(409).json({
        message: "Cancel scheduled viewings before deleting this listing.",
      });
    const result = transaction(db, () => {
      const result = db
        .prepare("DELETE FROM cars WHERE id=?")
        .run(req.params.id);
      if (result.changes) {
        for (const row of db.prepare("SELECT data FROM enquiries").all()) {
          const enquiry = JSON.parse(row.data);
          if (enquiry.convertedCarId === req.params.id) {
            delete enquiry.convertedCarId;
            db.prepare("UPDATE enquiries SET data=? WHERE id=?").run(
              JSON.stringify(enquiry),
              enquiry.id,
            );
          }
        }
        audit("Listing deleted", req.params.id);
      }
      return result;
    });
    res.status(result.changes ? 200 : 404).json({
      message: result.changes ? "Listing deleted." : "Vehicle not found.",
    });
  });
  app.post(
    "/api/enquiries",
    limit("enquiry", 15, 60 * 60 * 1000),
    (req, res) => {
      const b = req.body;
      const name = clean(b.name, 100),
        email = clean(b.email, 200),
        phone = clean(b.phone, 40),
        message = clean(b.message, 4000);
      if (b.website)
        return res
          .status(400)
          .json({ message: "Unable to submit this enquiry." });
      if (
        !name ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !message ||
        b.consent !== true
      )
        return res.status(400).json({
          message:
            "Please add your name, a valid email, a message, and your consent.",
        });
      if (phone && !/^[+\d\s()-]{7,40}$/.test(phone))
        return res
          .status(400)
          .json({ message: "Please enter a valid phone number." });
      const type = ["vehicle", "listing", "sell", "contact"].includes(b.type)
        ? b.type
        : "contact";
      let vehicle = null;
      if (type === "vehicle" || type === "listing") {
        const row = db
          .prepare("SELECT data FROM cars WHERE id = ?")
          .get(clean(b.carId));
        if (!row)
          return res
            .status(400)
            .json({ message: "This listing is no longer listed." });
        const car = JSON.parse(row.data);
        if (!published(car) || car.status === "Sold")
          return res
            .status(409)
            .json({ message: "This listing is not available for enquiries." });
        vehicle = `${listingTitle(car)}${car.demo ? " (sample)" : ""}`;
      }
      let details =
        type === "sell"
          ? {
              make: clean(b.make, 80),
              model: clean(b.model, 80),
              year: Number(b.year),
              price: Number(b.price),
              mileage: Number(b.mileage),
              condition: [
                "New",
                "Used",
                "Foreign used",
                "Locally used",
              ].includes(b.condition)
                ? b.condition
                : "Used",
            }
          : null;
      if (
        details &&
        (!b.category || b.category === "vehicle") &&
        (!details.make ||
          !details.model ||
          !Number.isInteger(details.year) ||
          details.year < 1950 ||
          details.year > new Date().getFullYear() + 1 ||
          !Number.isFinite(details.price) ||
          details.price <= 0 ||
          !Number.isFinite(details.mileage) ||
          details.mileage < 0)
      )
        return res.status(400).json({
          message: "Please complete the vehicle details with valid values.",
        });
      const images = type === "sell" && Array.isArray(b.images) ? b.images : [];
      if (type === "sell" && b.category && b.category !== "vehicle") {
        try {
          details = validateProduct(
            {
              ...b,
              title: b.listingTitle,
              publication: "Draft",
              status: "Available",
              images,
              features: [],
              featured: false,
            },
            {},
            safeImage,
          );
        } catch (error) {
          return res.status(400).json({ message: error.message });
        }
      }
      if (images.length > 4 || !images.every(safeImage))
        return res.status(400).json({
          message: "Please use up to four JPG, PNG, or WebP images, 2 MB each.",
        });
      const enquiry = {
        id: randomUUID(),
        name,
        email,
        phone,
        message,
        type,
        vehicle,
        carId: clean(b.carId),
        details,
        category: type === "sell" ? b.category || "vehicle" : undefined,
        images,
        status: "New",
        createdAt: new Date().toISOString(),
        consent: true,
      };
      db.prepare("INSERT INTO enquiries VALUES (?, ?)").run(
        enquiry.id,
        JSON.stringify(enquiry),
      );
      res.status(201).json({
        id: enquiry.id,
        message: "Your enquiry has been saved. Thank you for getting in touch.",
      });
    },
  );
  app.get("/api/enquiries", admin, (req, res) =>
    res.json(
      db
        .prepare("SELECT data FROM enquiries ORDER BY rowid DESC")
        .all()
        .map((row) => JSON.parse(row.data)),
    ),
  );
  app.patch("/api/enquiries/:id", admin, (req, res) => {
    if (!["New", "In progress", "Closed"].includes(req.body.status))
      return res.status(400).json({ message: "Invalid status." });
    const row = db
      .prepare("SELECT data FROM enquiries WHERE id = ?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ message: "Enquiry not found." });
    if (JSON.parse(row.data).sale)
      return res
        .status(409)
        .json({ message: "This enquiry has a recorded sale." });
    const enquiry = { ...JSON.parse(row.data), status: req.body.status };
    db.prepare("UPDATE enquiries SET data = ? WHERE id = ?").run(
      JSON.stringify(enquiry),
      enquiry.id,
    );
    res.json(enquiry);
  });
  app.get("/vendor/lucide.js", (req, res) =>
    res.sendFile(path.join(root, "node_modules/lucide/dist/umd/lucide.js")),
  );
  app.use(
    "/images",
    express.static(path.join(root, "images"), { maxAge: "1d" }),
  );
  for (const file of [
    "style.css",
    "script.js",
    "shared.js",
    "admin/admin.js",
    "admin/admin.css",
    "admin/management.js",
    "admin/management.css",
    "admin/install.js",
    "admin/session.js",
    "catalogue.js",
    "catalogue.css",
    "admin/catalogue.js",
    "admin/sw.js",
    "admin/manifest.webmanifest",
    "admin/offline.html",
  ])
    app.get(`/${file}`, (req, res) => res.sendFile(path.join(root, file)));
  app.get(["/admin", "/admin/", "/admin/index.html"], (req, res) =>
    res.sendFile(path.join(root, "admin/index.html")),
  );
  app.get(
    [
      "/",
      "/index.html",
      "/cars",
      "/cars/",
      "/cars/index.html",
      "/cars/car-details.html",
      "/saved",
      "/sell",
      "/sell/",
      "/sell/index.html",
      "/contact",
      "/contact/",
      "/contact/index.html",
      "/about",
      "/about/",
      "/about/index.html",
      "/privacy",
      "/catalogue/",
      "/parts/",
      "/properties/",
      "/listing/",
    ],
    (req, res) => res.sendFile(path.join(root, "index.html")),
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use((req, res) =>
    res.status(404).send("Page not found. Return to / to browse vehicles."),
  );
  app.use((error, req, res, next) => {
    if (error.type === "entity.too.large")
      return res.status(413).json({
        message:
          "Images are too large. Please use up to four images, 2 MB each.",
      });
    if (error instanceof SyntaxError)
      return res.status(400).json({ message: "Invalid request data." });
    console.error(error);
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  });
  return { app, close: () => db.close() };
}
module.exports = { createApp };
