const {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const defaults = {
  name: "Edwin's Auto Hub",
  phone: "+254 708 942 431",
  email: "peter.njengakihoro@gmail.com",
  whatsapp: "254708942431",
  location: "Nairobi, Kenya",
  hours: "Viewings by appointment",
  tagline: "Your next drive. A better beginning.",
};
const text = (v, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const read = (db, table) =>
  db
    .prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`)
    .all()
    .map((r) => JSON.parse(r.data));
const get = (db, table, id) => {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
  return row ? JSON.parse(row.data) : null;
};
const save = (db, table, item) =>
  db
    .prepare(`INSERT OR REPLACE INTO ${table} (id,data) VALUES (?,?)`)
    .run(item.id, JSON.stringify(item));
const now = () => new Date().toISOString();
function transaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
function csv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let v = String(value ?? "");
          if (/^[\s]*[=+@-]/.test(v)) v = "'" + v;
          return '"' + v.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}

function management({
  app,
  db,
  admin,
  sessions,
  verifyPassword,
  setPassword,
  storage,
}) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, data TEXT NOT NULL);",
  );
  function business() {
    const row = db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get("business");
    return { ...defaults, ...(row ? JSON.parse(row.value) : {}) };
  }
  function audit(action, subject = "") {
    save(db, "activity", {
      id: randomUUID(),
      action,
      subject: text(subject, 200),
      at: now(),
    });
  }
  app.get("/api/business", (req, res) => res.json(business()));
  app.put("/api/business", admin, (req, res) => {
    const b = req.body;
    if (
      !text(b.name) ||
      !/^[+\d\s()-]{7,40}$/.test(b.phone || "") ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "") ||
      !/^\d{7,15}$/.test(b.whatsapp || "") ||
      !text(b.location)
    )
      return res.status(400).json({
        message:
          "Add a business name, valid contact details, WhatsApp number with country code, and location.",
      });
    const data = Object.fromEntries(
      Object.keys(defaults).map((k) => [
        k,
        text(b[k], k === "tagline" ? 150 : 200),
      ]),
    );
    transaction(db, () => {
      db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?)").run(
        "business",
        JSON.stringify(data),
      );
      audit("Business settings updated", data.name);
    });
    res.json(data);
  });
  app.get("/api/admin/cars", admin, (req, res) =>
    res.json(read(db, "cars").reverse()),
  );
  app.get("/api/admin/activity", admin, (req, res) =>
    res.json(
      db
        .prepare("SELECT data FROM activity ORDER BY rowid DESC LIMIT 100")
        .all()
        .map((r) => JSON.parse(r.data)),
    ),
  );
  app.post("/api/admin/password", admin, (req, res) => {
    if (!verifyPassword(text(req.body.currentPassword, 1024)))
      return res
        .status(400)
        .json({ message: "Current password is incorrect." });
    const password = req.body.newPassword;
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      return res
        .status(400)
        .json({ message: "Use a new password between 12 and 128 characters." });
    if (verifyPassword(password))
      return res.status(400).json({ message: "Choose a different password." });
    setPassword(password);
    sessions.clear();
    res.clearCookie("hub_session", { path: "/" });
    audit("Admin password changed");
    res.json({ message: "Password changed. Sign in again on each device." });
  });
  app.patch("/api/enquiries/:id/manage", admin, (req, res) => {
    const enquiry = get(db, "enquiries", req.params.id);
    if (!enquiry)
      return res.status(404).json({ message: "Enquiry not found." });
    const b = req.body;
    if (
      !["New", "In progress", "Won", "Lost", "Closed"].includes(b.status) ||
      !["Normal", "High", "Low"].includes(b.priority)
    )
      return res
        .status(400)
        .json({ message: "Select a valid status and priority." });
    if (
      b.followUp &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(b.followUp) ||
        Number.isNaN(Date.parse(b.followUp)) ||
        new Date(b.followUp).toISOString().slice(0, 10) !== b.followUp)
    )
      return res
        .status(400)
        .json({ message: "Choose a valid follow-up date." });
    if (enquiry.sale && b.status !== "Won")
      return res.status(409).json({
        message: "This enquiry has a recorded sale. Its status remains Won.",
      });
    enquiry.status = b.status;
    enquiry.priority = b.priority;
    enquiry.followUp = b.followUp || "";
    enquiry.updatedAt = now();
    if (text(b.note, 3000))
      enquiry.notes = [
        ...(enquiry.notes || []),
        { id: randomUUID(), text: text(b.note, 3000), at: now() },
      ];
    transaction(db, () => {
      save(db, "enquiries", enquiry);
      audit("Enquiry updated", enquiry.name);
    });
    res.json(enquiry);
  });
  app.delete("/api/enquiries/:id", admin, (req, res) => {
    const enquiry = get(db, "enquiries", req.params.id);
    if (!enquiry)
      return res.status(404).json({ message: "Enquiry not found." });
    if (enquiry.sale)
      return res
        .status(409)
        .json({ message: "Enquiries with recorded sales cannot be deleted." });
    transaction(db, () => {
      for (const appointment of read(db, "appointments").filter(
        (a) => a.enquiryId === enquiry.id,
      ))
        db.prepare("DELETE FROM appointments WHERE id=?").run(appointment.id);
      db.prepare("DELETE FROM enquiries WHERE id=?").run(enquiry.id);
      for (const car of read(db, "cars").filter(
        (c) => c.sourceEnquiryId === enquiry.id,
      )) {
        delete car.sourceEnquiryId;
        save(db, "cars", car);
      }
      audit("Enquiry and linked viewings deleted", enquiry.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/enquiries/:id/draft", admin, (req, res) => {
    const enquiry = get(db, "enquiries", req.params.id);
    if (!enquiry || enquiry.type !== "sell")
      return res.status(404).json({ message: "Seller submission not found." });
    if (enquiry.convertedCarId)
      return res
        .status(409)
        .json({ message: "This submission already has an inventory record." });
    const d = enquiry.details;
    const car = {
      id: randomUUID(),
      make: d.make,
      model: d.model,
      year: d.year,
      price: d.price,
      mileage: d.mileage,
      body: "Sedan",
      fuel: "Petrol",
      transmission: "Automatic",
      engine: "",
      color: "",
      condition: "Locally used",
      status: "Available",
      publication: "Draft",
      features: [],
      description: "",
      image: enquiry.images?.[0] || "",
      images: enquiry.images || [],
      demo: false,
      featured: false,
      sourceEnquiryId: enquiry.id,
      createdAt: now(),
      updatedAt: now(),
    };
    transaction(db, () => {
      save(db, "cars", car);
      enquiry.convertedCarId = car.id;
      enquiry.status = "In progress";
      save(db, "enquiries", enquiry);
      audit("Seller submission converted to draft", `${car.make} ${car.model}`);
    });
    res.status(201).json(car);
  });
  app.post("/api/enquiries/:id/sale", admin, (req, res) => {
    const enquiry = get(db, "enquiries", req.params.id);
    const car = get(db, "cars", text(req.body.carId));
    const price = Number(req.body.price);
    if (!enquiry || !car)
      return res
        .status(404)
        .json({ message: "Select an existing enquiry and vehicle." });
    if (enquiry.type === "sell")
      return res.status(400).json({
        message:
          "Record a sale against a buyer enquiry, not a seller submission.",
      });
    if (enquiry.carId && enquiry.carId !== car.id)
      return res
        .status(400)
        .json({ message: "Choose the vehicle linked to this enquiry." });
    if (
      car.demo ||
      car.publication === "Draft" ||
      car.publication === "Archived"
    )
      return res
        .status(400)
        .json({ message: "A sale requires a real, published vehicle." });
    if (car.status === "Sold" || enquiry.sale)
      return res
        .status(409)
        .json({ message: "A sale has already been recorded." });
    if (!Number.isInteger(price) || price <= 0 || price > 1000000000)
      return res
        .status(400)
        .json({ message: "Enter a valid final sale price in KSh." });
    transaction(db, () => {
      const sale = {
        id: randomUUID(),
        carId: car.id,
        vehicle: `${car.year} ${car.make} ${car.model}`,
        price,
        at: now(),
      };
      enquiry.sale = sale;
      enquiry.carId = car.id;
      enquiry.vehicle = sale.vehicle;
      enquiry.status = "Won";
      enquiry.followUp = "";
      car.status = "Sold";
      car.updatedAt = now();
      car.saleId = sale.id;
      save(db, "cars", car);
      save(db, "enquiries", enquiry);
      for (const appointment of read(db, "appointments").filter(
        (a) => a.carId === car.id && a.status === "Scheduled",
      )) {
        appointment.status = "Cancelled";
        save(db, "appointments", appointment);
      }
      audit("Sale recorded", sale.vehicle);
    });
    res.json(enquiry);
  });
  app.get("/api/appointments", admin, (req, res) =>
    res.json(read(db, "appointments")),
  );
  function appointment(req, res) {
    const existing = req.params.id
      ? get(db, "appointments", req.params.id)
      : null;
    if (req.params.id && !existing)
      return res.status(404).json({ message: "Viewing not found." });
    const b = req.body,
      enquiry = get(db, "enquiries", text(b.enquiryId)),
      car = get(db, "cars", text(b.carId));
    if (!enquiry || !car)
      return res
        .status(400)
        .json({ message: "Choose a customer enquiry and vehicle." });
    if (enquiry.type === "vehicle" && enquiry.carId !== car.id)
      return res
        .status(400)
        .json({ message: "Choose the vehicle linked to this enquiry." });
    const date = new Date(b.startsAt);
    if (
      !b.startsAt ||
      !Number.isFinite(date.getTime()) ||
      !text(b.location) ||
      !["Scheduled", "Completed", "Cancelled"].includes(b.status)
    )
      return res
        .status(400)
        .json({ message: "Add a valid date, meeting point, and status." });
    if (
      b.status === "Scheduled" &&
      (car.status === "Sold" || ["Draft", "Archived"].includes(car.publication))
    )
      return res
        .status(409)
        .json({ message: "This vehicle is not available for a viewing." });
    if (
      b.status === "Scheduled" &&
      read(db, "appointments").some(
        (a) =>
          a.id !== existing?.id &&
          a.status === "Scheduled" &&
          a.carId === car.id &&
          Math.abs(Date.parse(a.startsAt) - date.getTime()) < 60 * 60 * 1000,
      )
    )
      return res.status(409).json({
        message: "This car already has a viewing within an hour of that time.",
      });
    const item = {
      id: existing?.id || randomUUID(),
      enquiryId: enquiry.id,
      carId: car.id,
      startsAt: date.toISOString(),
      location: text(b.location),
      status: b.status,
      notes: text(b.notes, 2000),
      createdAt: existing?.createdAt || now(),
    };
    transaction(db, () => {
      save(db, "appointments", item);
      audit(
        existing ? "Viewing updated" : "Viewing scheduled",
        `${car.make} ${car.model}`,
      );
    });
    res.status(existing ? 200 : 201).json(item);
  }
  app.post("/api/appointments", admin, appointment);
  app.put("/api/appointments/:id", admin, appointment);
  app.get("/api/admin/export/:type", admin, (req, res) => {
    const kind = req.params.type;
    let rows;
    if (kind === "inventory")
      rows = [
        [
          "ID",
          "Make",
          "Model",
          "Year",
          "Price KSh",
          "Mileage",
          "Status",
          "Publication",
          "Sample",
        ],
        ...read(db, "cars").map((c) => [
          c.id,
          c.make,
          c.model,
          c.year,
          c.price,
          c.mileage,
          c.status,
          c.publication || "Published",
          !!c.demo,
        ]),
      ];
    else if (kind === "enquiries")
      rows = [
        [
          "ID",
          "Name",
          "Email",
          "Phone",
          "Type",
          "Vehicle",
          "Status",
          "Priority",
          "Follow-up",
          "Message",
          "Received",
        ],
        ...read(db, "enquiries").map((e) => [
          e.id,
          e.name,
          e.email,
          e.phone,
          e.type,
          e.vehicle,
          e.status,
          e.priority || "Normal",
          e.followUp,
          e.message,
          e.createdAt,
        ]),
      ];
    else if (kind === "sales")
      rows = [
        ["Sale ID", "Vehicle", "Price KSh", "Date", "Enquiry ID"],
        ...read(db, "enquiries")
          .filter((e) => e.sale)
          .map((e) => [
            e.sale.id,
            e.sale.vehicle,
            e.sale.price,
            e.sale.at,
            e.id,
          ]),
      ];
    else return res.status(404).json({ message: "Export not found." });
    res
      .attachment(`edwins-${kind}-${now().slice(0, 10)}.csv`)
      .type("text/csv")
      .send("\uFEFF" + csv(rows));
  });
  app.get("/api/admin/backup", admin, (req, res, next) => {
    const file = path.join(storage, `backup-${randomUUID()}.sqlite`);
    try {
      db.prepare("VACUUM INTO ?").run(file);
      res.download(
        file,
        `edwins-backup-${now().slice(0, 10)}.sqlite`,
        (error) => {
          fs.rmSync(file, { force: true });
          if (error && !res.headersSent) next(error);
        },
      );
    } catch (error) {
      fs.rmSync(file, { force: true });
      next(error);
    }
  });
  return { audit, business };
}
module.exports = { management, defaults, csv, transaction };
