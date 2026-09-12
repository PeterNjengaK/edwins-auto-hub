window.Manager = (() => {
  const { escape: e, money, icon: i } = Hub;
  let appointments = [],
    activity = [],
    business = {},
    inventoryFilter = "All",
    enquiryFilter = "All";
  const tabs = [
    ["overview", "layout-dashboard", "Overview"],
    ["viewings", "calendar-days", "Viewings"],
    ["customers", "users", "Customers"],
    ["reports", "chart-no-axes-combined", "Reports"],
    ["settings", "settings", "Settings"],
    ["activity", "history", "Activity"],
  ];
  const label = (c) => (c ? Listings.title(c) : "Removed listing");
  const date = (value) =>
    value
      ? new Date(value).toLocaleString("en-KE", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const due = (x) =>
    x.followUp &&
    x.followUp <= today() &&
    !["Closed", "Won", "Lost"].includes(x.status);
  const badge = (value, cls = "") =>
    `<span class="status-chip ${cls}">${e(value)}</span>`;
  const empty = (text) =>
    `<div class="admin-empty">${i("inbox")}<p>${e(text)}</p></div>`;
  const input = (name, title, value = "", type = "text", extra = "") =>
    `<div class="field"><label for="manager-${name}">${title}</label><input id="manager-${name}" name="${name}" type="${type}" value="${e(value)}" ${extra}></div>`;
  const select = (name, title, options, value = "") =>
    `<div class="field"><label for="manager-${name}">${title}</label><select id="manager-${name}" name="${name}">${options
      .map((v) => {
        const pair = Array.isArray(v) ? v : [v, v];
        return `<option value="${e(pair[0])}" ${String(pair[0]) === String(value) ? "selected" : ""}>${e(pair[1])}</option>`;
      })
      .join("")}</select></div>`;
  const statusOptions = ["New", "In progress", "Won", "Lost", "Closed"];
  const dialog = () => document.getElementById("management-dialog");
  function show(html) {
    document.getElementById("management-content").innerHTML = html;
    Hub.icons();
    if (!dialog().open) dialog().showModal();
  }
  function form(title, contents, button = "Save changes") {
    return `<h2>${title}</h2><form id="manager-form"><div class="form-grid">${contents}</div><div class="editor-actions"><button type="button" data-manager-close class="button outline">Cancel</button><button type="submit" class="button">${i("check")}${button}</button></div><div class="form-status" role="status"></div></form>`;
  }
  function bind(action, success = "Changes saved.") {
    document
      .getElementById("manager-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const f = event.target,
          button = f.querySelector("[type=submit]"),
          status = f.querySelector(".form-status");
        button.disabled = true;
        status.textContent = "";
        try {
          await action(Object.fromEntries(new FormData(f)));
          dialog().close();
          await load();
          Hub.toast(success);
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      });
  }
  function manageEnquiry(id) {
    const q = enquiries.find((x) => x.id === id);
    if (!q) return;
    const notes = (q.notes || [])
      .slice()
      .reverse()
      .map(
        (n) =>
          `<div class="note-entry"><time>${date(n.at)}</time><p>${e(n.text)}</p></div>`,
      )
      .join("");
    show(
      form(
        "Follow up with " + e(q.name),
        `${select("status", "Stage", statusOptions, q.status)}${select("priority", "Priority", ["Normal", "High", "Low"], q.priority || "Normal")}${input("followUp", "Next follow-up", q.followUp, "date")}<div class="field span-2"><label for="manager-note">Add a private note</label><textarea id="manager-note" name="note" maxlength="3000" placeholder="Conversation details or next steps"></textarea></div>${q.sale ? `<div class="notice span-2">Sale recorded: ${money(q.sale.price)} on ${date(q.sale.at)}.</div>` : ""}`,
      ) +
        `<section class="notes-section"><h3>Conversation history</h3>${notes || "<p>No private notes yet.</p>"}</section>`,
    );
    bind((b) => authenticated(`/api/enquiries/${id}/manage`, "PATCH", b));
  }
  function viewing(id = "", enquiryId = "") {
    const item = appointments.find((x) => x.id === id) || {},
      linked = enquiries.find((x) => x.id === (item.enquiryId || enquiryId));
    let local = "";
    if (item.startsAt) {
      const d = new Date(item.startsAt);
      local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }
    show(
      form(
        id ? "Update viewing" : "Arrange a viewing",
        `${select("enquiryId", "Customer enquiry", [["", "Choose a customer"], ...enquiries.filter((q) => q.type !== "sell").map((q) => [q.id, `${q.name}${q.vehicle ? " / " + q.vehicle : ""}`])], item.enquiryId || enquiryId)}${select("carId", "Listing", [["", "Choose a listing"], ...cars.map((c) => [c.id, label(c)])], item.carId || linked?.carId)}${input("startsAt", "Date and time", local, "datetime-local", "required")}${select("status", "Status", ["Scheduled", "Completed", "Cancelled"], item.status || "Scheduled")}${input("location", "Meeting point", item.location || business.location, "text", 'required maxlength="200"')}<div class="field span-2"><label for="manager-notes">Private viewing notes</label><textarea id="manager-notes" name="notes" maxlength="2000">${e(item.notes)}</textarea></div><p class="field-hint span-2">${e(Intl.DateTimeFormat().resolvedOptions().timeZone)} time. Bookings are stored as a shared schedule.</p>`,
        "Save viewing",
      ),
    );
    document
      .querySelector("[name=enquiryId]")
      .addEventListener("change", (event) => {
        const q = enquiries.find((q) => q.id === event.target.value);
        if (q?.carId)
          document.querySelector("#manager-form [name=carId]").value = q.carId;
      });
    bind(
      (b) =>
        authenticated(
          id ? `/api/appointments/${id}` : "/api/appointments",
          id ? "PUT" : "POST",
          { ...b, startsAt: new Date(b.startsAt).toISOString() },
        ),
      "Viewing saved.",
    );
  }
  function recordSale(id) {
    const q = enquiries.find((x) => x.id === id);
    const available = cars.filter(
      (c) =>
        !c.demo &&
        c.status !== "Sold" &&
        !["Draft", "Archived"].includes(c.publication) &&
        (!q.carId || c.id === q.carId),
    );
    show(
      form(
        "Record a completed sale",
        `<p class="span-2">Confirm the completed transaction below. No payment is collected.</p>${select("carId", "Listing", [["", "Choose a listing"], ...available.map((c) => [c.id, label(c)])], q.carId)}${input("quantity", "Quantity sold", 1, "number", 'required min="1" max="1000000"')}${input("price", "Final sale price (KSh)", "", "number", 'required min="1" max="1000000000"')}<label class="check-field span-2"><input type="checkbox" required>I confirm that this sale has been completed.</label>`,
        "Record sale",
      ),
    );
    bind(
      (b) => authenticated(`/api/enquiries/${id}/sale`, "POST", b),
      "Sale recorded and inventory updated.",
    );
  }
  function deleteEnquiry(id) {
    show(
      form(
        "Delete this enquiry?",
        '<p class="span-2">The customer details, photos, private notes, and linked viewings will be permanently removed. Any converted vehicle listing is kept.</p><label class="check-field span-2"><input type="checkbox" required>I confirm this enquiry can be deleted.</label>',
        "Delete enquiry",
      ),
    );
    bind(
      () => authenticated(`/api/enquiries/${id}`, "DELETE"),
      "Enquiry deleted.",
    );
  }
  function enquiriesView(target, search) {
    const result = enquiries.filter(
      (q) =>
        `${q.name} ${q.email} ${q.message} ${q.vehicle || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (enquiryFilter === "All" ||
          (enquiryFilter === "Overdue"
            ? due(q)
            : enquiryFilter === "Seller submissions"
              ? q.type === "sell"
              : q.status === enquiryFilter)),
    );
    target.innerHTML = `<div class="manager-section-head"><span>${result.length} enquiries</span><select id="enquiry-filter" aria-label="Filter enquiries">${["All", "Overdue", "Seller submissions", ...statusOptions].map((v) => `<option ${v === enquiryFilter ? "selected" : ""}>${v}</option>`).join("")}</select><a class="text-link" href="/api/admin/export/enquiries">${i("download")}Export CSV</a></div><div class="enquiry-list">${result.map((q) => `<article class="enquiry-item"><div class="enquiry-heading"><div><h3>${e(q.name)} ${badge(q.type === "sell" ? "Seller submission" : ["vehicle", "listing"].includes(q.type) ? "Listing enquiry" : "General enquiry")}${q.priority === "High" ? badge("High priority", "priority-high") : ""}</h3><p>${date(q.createdAt)} &middot; ${e(q.vehicle || "General conversation")}</p></div><select data-enquiry-status="${q.id}" aria-label="Status for ${e(q.name)}" ${q.sale ? "disabled" : ""}>${statusOptions.map((v) => `<option ${v === q.status ? "selected" : ""}>${v}</option>`).join("")}</select></div><p class="enquiry-message">${e(q.message)}</p>${q.details ? `<p class="enquiry-details">${e(Listings.title(q.details))} &middot; ${money(q.details.price)} &middot; ${e(q.details.category && q.details.category !== "vehicle" ? Listings.summary(q.details) : Hub.number(q.details.mileage) + " km")}</p>` : ""}<div class="enquiry-contact"><a href="mailto:${e(q.email)}">${i("mail")}${e(q.email)}</a>${q.phone ? `<a href="tel:${e(q.phone)}">${i("phone")}${e(q.phone)}</a>` : ""}${q.followUp ? `<span class="${due(q) ? "due-date" : ""}">${i("calendar-clock")} Follow up ${e(q.followUp)}</span>` : ""}</div>${q.images?.length ? `<div class="enquiry-photos">${q.images.map((image, n) => `<img src="${e(image)}" alt="Seller photo ${n + 1}" loading="lazy">`).join("")}</div>` : ""}<div class="enquiry-actions"><button class="button outline small" data-manage-enquiry="${q.id}">${i("notebook-pen")}Notes & follow-up${q.notes?.length ? " (" + q.notes.length + ")" : ""}</button>${q.type === "sell" ? (q.convertedCarId ? `<button class="button outline small" data-edit="${q.convertedCarId}">${i("car-front")}Open listing draft</button>` : `<button class="button outline small" data-create-draft="${q.id}">${i("file-plus-2")}Create listing draft</button>`) : `<button class="button outline small" data-schedule="${q.id}">${i("calendar-plus")}Arrange viewing</button>${!q.sale ? `<button class="button outline small" data-record-sale="${q.id}">${i("badge-check")}Record sale</button>` : badge("Sale: " + money(q.sale.price))}`}<button class="icon-button" data-delete-enquiry="${q.id}" title="Delete enquiry" aria-label="Delete enquiry from ${e(q.name)}" ${q.sale ? "disabled" : ""}>${i("trash-2")}</button></div></article>`).join("") || empty("No enquiries match this view.")}</div>`;
    document.getElementById("enquiry-filter").onchange = (event) => {
      enquiryFilter = event.target.value;
      renderContent();
    };
    target.querySelectorAll("[data-enquiry-status]").forEach(
      (s) =>
        (s.onchange = async () => {
          const q = enquiries.find((q) => q.id === s.dataset.enquiryStatus);
          s.disabled = true;
          try {
            await authenticated(`/api/enquiries/${q.id}/manage`, "PATCH", {
              status: s.value,
              priority: q.priority || "Normal",
              followUp: q.followUp || "",
            });
            await load();
          } catch (error) {
            s.value = q.status;
            Hub.toast(error.message);
          } finally {
            s.disabled = false;
          }
        }),
    );
  }
  function overview(target) {
    const overdue = enquiries.filter(due),
      next = appointments
        .filter((a) => a.status === "Scheduled")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const real = cars.filter((c) => !c.demo),
      sold = enquiries.filter((q) => q.sale);
    target.innerHTML = `<div class="overview-metrics"><div><span>Live stock value</span><strong>${money(real.filter((c) => c.status === "Available" && !["Draft", "Archived"].includes(c.publication)).reduce((n, c) => n + c.price * (Listings.kind(c) === "part" ? c.quantity : 1), 0))}</strong></div><div><span>Follow-ups due</span><strong>${overdue.length}</strong></div><div><span>Scheduled viewings</span><strong>${next.length}</strong></div><div><span>Recorded sales</span><strong>${sold.length}</strong></div></div><div class="manager-two-columns"><section><div class="manager-section-head"><h2>Follow-ups to make</h2></div>${overdue.map((q) => `<button class="task-row" data-manage-enquiry="${q.id}"><span><strong>${e(q.name)}</strong><small>${e(q.vehicle || q.email)}</small></span><span class="due-date">${e(q.followUp)} ${i("arrow-right")}</span></button>`).join("") || empty("You have no overdue follow-ups.")}</section><section><div class="manager-section-head"><h2>Upcoming viewings</h2><button class="icon-button" data-new-viewing title="Arrange a viewing" aria-label="Arrange a viewing">${i("plus")}</button></div>${
      next
        .slice(0, 8)
        .map(
          (a) =>
            `<button class="task-row" data-edit-viewing="${a.id}"><span><strong>${e(enquiries.find((q) => q.id === a.enquiryId)?.name || "Customer")}</strong><small>${e(label(cars.find((c) => c.id === a.carId)))}</small></span><span>${date(a.startsAt)}</span></button>`,
        )
        .join("") || empty("No viewings scheduled.")
    }</section></div>`;
  }
  function viewings(target, search) {
    const result = appointments
      .filter((a) =>
        `${label(cars.find((c) => c.id === a.carId))} ${enquiries.find((q) => q.id === a.enquiryId)?.name || ""} ${a.location}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    target.innerHTML = `<div class="manager-section-head"><h2>Viewing schedule</h2><button class="button small" data-new-viewing>${i("plus")}Arrange viewing</button></div><p class="field-hint">${e(Intl.DateTimeFormat().resolvedOptions().timeZone)} time</p><div class="viewing-list">${result.map((a) => `<article class="viewing-row"><div class="viewing-date"><strong>${new Date(a.startsAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</strong><span>${new Date(a.startsAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</span></div><div><h3>${e(label(cars.find((c) => c.id === a.carId)))}</h3><p>${e(enquiries.find((q) => q.id === a.enquiryId)?.name || "Removed customer")} &middot; ${e(a.location)}</p>${a.notes ? `<p>${e(a.notes)}</p>` : ""}</div>${badge(a.status)}<button class="icon-button" data-edit-viewing="${a.id}" title="Edit viewing" aria-label="Edit viewing">${i("pencil")}</button></article>`).join("") || empty("No viewings scheduled yet.")}</div>`;
  }
  function customers(target, search) {
    const contacts = new Map();
    for (const q of enquiries) {
      const key = q.email.toLowerCase();
      if (!contacts.has(key))
        contacts.set(key, {
          name: q.name,
          email: q.email,
          phone: q.phone,
          items: [],
        });
      contacts.get(key).items.push(q);
    }
    const result = [...contacts.values()].filter((c) =>
      `${c.name} ${c.email} ${c.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    target.innerHTML = `<div class="manager-section-head"><h2>Customer relationships</h2><span>${result.length} contacts</span></div><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Conversations</th><th>Latest enquiry</th></tr></thead><tbody>${result.map((c) => `<tr><td><strong>${e(c.name)}</strong></td><td><a href="mailto:${e(c.email)}">${e(c.email)}</a><br>${e(c.phone)}</td><td>${c.items.length}</td><td><button class="button outline small" data-manage-enquiry="${c.items[0].id}">${e(c.items[0].status)} ${i("arrow-up-right")}</button></td></tr>`).join("")}</tbody></table>${!result.length ? empty("Customers appear when they send an enquiry.") : ""}</div>`;
  }
  function reports(target) {
    const sales = enquiries.filter((q) => q.sale),
      total = sales.reduce((n, q) => n + q.sale.price, 0),
      stages = statusOptions.map((s) => ({
        name: s,
        count: enquiries.filter((q) => q.status === s).length,
      }));
    target.innerHTML = `<div class="manager-section-head"><h2>Sales & enquiry reports</h2><a class="text-link" href="/api/admin/export/sales">${i("download")}Sales CSV</a></div><div class="overview-metrics"><div><span>Recorded sale value</span><strong>${money(total)}</strong></div><div><span>Completed sales</span><strong>${sales.length}</strong></div><div><span>Open enquiries</span><strong>${enquiries.filter((q) => ["New", "In progress"].includes(q.status)).length}</strong></div><div><span>Draft listings</span><strong>${cars.filter((c) => c.publication === "Draft").length}</strong></div></div><div class="manager-two-columns"><section><h3>Enquiry pipeline</h3><div class="pipeline">${stages.map((s) => `<div><span>${s.name}</span><progress max="${Math.max(enquiries.length, 1)}" value="${s.count}" aria-label="${s.name}"></progress><strong>${s.count}</strong></div>`).join("")}</div></section><section><h3>Completed sales</h3>${sales.map((q) => `<div class="task-row"><span><strong>${e(q.sale.vehicle)}</strong><small>${date(q.sale.at)}</small></span><strong>${money(q.sale.price)}</strong></div>`).join("") || empty("Completed sales will appear here.")}</section></div>`;
  }
  function settings(target) {
    target.innerHTML = `<div class="manager-section-head"><h2>Business settings</h2><button class="button outline small" data-install-admin>${i("download")}Install admin app</button></div><div class="manager-two-columns settings-columns"><section><form id="business-form" class="form-grid">${input("name", "Business name", business.name, "text", 'required maxlength="200"')}${input("phone", "Phone number", business.phone, "tel", 'required maxlength="40"')}${input("email", "Email", business.email, "email", "required")}${input("whatsapp", "WhatsApp (country code + digits)", business.whatsapp, "text", 'required pattern="[0-9]{7,15}"')}${input("location", "Location", business.location, "text", "required")}${input("hours", "Viewing hours", business.hours)}<div class="span-2">${input("tagline", "Homepage tagline", business.tagline, "text", 'maxlength="150"')}</div><button class="button" type="submit">${i("save")}Save business details</button><div class="form-status span-2" role="status"></div></form></section><section class="settings-security"><h3>Account security</h3><form id="password-form"><div class="field"><label for="current-password">Current password</label><input id="current-password" name="currentPassword" type="password" required autocomplete="current-password"></div><div class="field"><label for="new-password">New password</label><input id="new-password" name="newPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></div><div class="field"><label for="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></div><button class="button outline" type="submit">${i("key-round")}Change password</button><div class="form-status" role="status"></div></form><hr><h3>Data & backups</h3><div class="data-actions"><a class="button outline" href="/api/admin/backup">${i("database-backup")}Download database backup</a><a class="text-link" href="/api/admin/export/inventory">${i("download")}Inventory CSV</a><a class="text-link" href="/api/admin/export/enquiries">${i("download")}Enquiries CSV</a></div></section></div>`;
    document.getElementById("business-form").onsubmit = async (event) => {
      event.preventDefault();
      const f = event.target,
        b = f.querySelector("button"),
        s = f.querySelector(".form-status");
      b.disabled = true;
      s.textContent = "";
      try {
        business = await authenticated(
          "/api/business",
          "PUT",
          Object.fromEntries(new FormData(f)),
        );
        await Hub.loadBusiness();
        s.classList.add("success");
        s.textContent = "Saved. Your website now uses these business details.";
      } catch (error) {
        s.classList.remove("success");
        s.textContent = error.message;
      } finally {
        b.disabled = false;
      }
    };
    document.getElementById("password-form").onsubmit = async (event) => {
      event.preventDefault();
      const f = event.target,
        b = f.querySelector("button"),
        s = f.querySelector(".form-status"),
        body = Object.fromEntries(new FormData(f));
      if (body.newPassword !== body.confirmPassword) {
        s.textContent = "New passwords do not match.";
        return;
      }
      b.disabled = true;
      try {
        await authenticated("/api/admin/password", "POST", body);
        csrf = "";
        login();
        Hub.toast("Password changed. Sign in with your new password.");
      } catch (error) {
        s.textContent = error.message;
      } finally {
        b.disabled = false;
      }
    };
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-manager-close")) dialog().close();
    if (button.dataset.manageEnquiry)
      manageEnquiry(button.dataset.manageEnquiry);
    if (button.dataset.schedule) viewing("", button.dataset.schedule);
    if (button.hasAttribute("data-new-viewing")) viewing();
    if (button.dataset.editViewing) viewing(button.dataset.editViewing);
    if (button.dataset.recordSale) recordSale(button.dataset.recordSale);
    if (button.dataset.deleteEnquiry)
      deleteEnquiry(button.dataset.deleteEnquiry);
    if (button.hasAttribute("data-refresh-admin")) {
      button.disabled = true;
      await load();
      Hub.toast("Workspace refreshed.");
    }
    if (button.dataset.createDraft) {
      button.disabled = true;
      try {
        const car = await authenticated(
          `/api/enquiries/${button.dataset.createDraft}/draft`,
          "POST",
          {},
        );
        await load();
        editCar(car.id);
        Hub.toast(
          "Draft created. Review the specifications before publishing.",
        );
      } catch (error) {
        Hub.toast(error.message);
      } finally {
        button.disabled = false;
      }
    }
  });
  return {
    clear() {
      appointments = [];
      activity = [];
      business = {};
    },
    async load() {
      const current = csrf;
      const data = await Promise.all([
        authenticated("/api/appointments"),
        authenticated("/api/admin/activity"),
        Hub.api("/api/business"),
      ]);
      if (csrf === current) [appointments, activity, business] = data;
    },
    decorate() {
      const nav = document.querySelector(".admin-tabs");
      if (!nav) return;
      nav.insertAdjacentHTML(
        "afterbegin",
        tabs
          .filter((t) => t[0] === "overview")
          .map(
            (t) =>
              `<button data-tab="${t[0]}" class="${tab === t[0] ? "active" : ""}" aria-pressed="${tab === t[0]}">${i(t[1])}${t[2]}</button>`,
          )
          .join(""),
      );
      nav.insertAdjacentHTML(
        "beforeend",
        tabs
          .filter((t) => t[0] !== "overview")
          .map(
            (t) =>
              `<button data-tab="${t[0]}" class="${tab === t[0] ? "active" : ""}" aria-pressed="${tab === t[0]}">${i(t[1])}${t[2]}</button>`,
          )
          .join(""),
      );
      document
        .querySelector(".admin-title-actions")
        .insertAdjacentHTML(
          "afterbegin",
          `<button class="icon-button" data-refresh-admin title="Refresh workspace" aria-label="Refresh workspace">${i("refresh-cw")}</button><button class="icon-button" data-install-admin title="Install admin app" aria-label="Install admin app">${i("monitor-down")}</button>`,
        );
      document.querySelector(".admin-search").hidden = [
        "overview",
        "settings",
        "reports",
        "activity",
      ].includes(tab);
      const workspace = document.querySelector(".admin-workspace");
      const layout = document.createElement("div");
      layout.className = "admin-layout";
      const sidebar = document.createElement("aside");
      sidebar.className = "admin-sidebar";
      sidebar.setAttribute("aria-label", "Admin tools");
      sidebar.innerHTML = '<div class="sidebar-caption">WORKSPACE</div>';
      for (const button of nav.querySelectorAll("button")) {
        const name = button.textContent.trim();
        button.setAttribute("aria-label", name);
        button.title = name;
        for (const child of [...button.childNodes])
          if (child.nodeType === Node.TEXT_NODE) child.remove();
        const label = document.createElement("span");
        label.className = "nav-label";
        label.textContent = name;
        button.append(label);
      }
      sidebar.append(nav);
      workspace.before(layout);
      layout.append(sidebar, workspace);
      Hub.icons();
    },
    render(view, target, search) {
      if (view === "enquiries") enquiriesView(target, search);
      else if (view === "overview") overview(target);
      else if (view === "viewings") viewings(target, search);
      else if (view === "customers") customers(target, search);
      else if (view === "reports") {
        reports(target);
        target.insertAdjacentHTML(
          "beforeend",
          `<section class="category-report"><h3>Sales by category</h3><div class="table-wrap"><table><thead><tr><th>Category</th><th>Transactions</th><th>Units sold</th><th>Recorded value</th></tr></thead><tbody>${Object.entries(
            Listings.names,
          )
            .map(([key, name]) => {
              const rows = enquiries.filter(
                (q) => q.sale && (q.sale.category || "vehicle") === key,
              );
              return `<tr><td>${name}</td><td>${rows.length}</td><td>${rows.reduce((n, q) => n + (q.sale.quantity || 1), 0)}</td><td>${money(rows.reduce((n, q) => n + q.sale.price, 0))}</td></tr>`;
            })
            .join("")}</tbody></table></div></section>`,
        );
      } else if (view === "settings") settings(target);
      else if (view === "activity")
        target.innerHTML = `<div class="manager-section-head"><h2>Recent activity</h2><span>Latest 100 events</span></div>${activity.map((a) => `<div class="activity-row">${i("circle-check")}<div><strong>${e(a.action)}</strong><p>${e(a.subject)}</p></div><time>${date(a.at)}</time></div>`).join("") || empty("Changes to your dealership will appear here.")}`;
      else return false;
      return true;
    },
    enhance(view) {
      if (view !== "inventory") return;
      const target = document.getElementById("admin-content");
      target.insertAdjacentHTML(
        "afterbegin",
        `<div class="manager-section-head"><span>${cars.length} listings in inventory</span><select id="publication-filter" aria-label="Filter publication">${["All", "Published", "Draft", "Archived"].map((v) => `<option ${inventoryFilter === v ? "selected" : ""}>${v}</option>`).join("")}</select><a class="text-link" href="/api/admin/export/inventory">${i("download")}Export CSV</a></div>`,
      );
      target.querySelectorAll("tbody tr").forEach((row) => {
        const c = cars.find(
          (c) => c.id === row.querySelector("[data-edit]")?.dataset.edit,
        );
        if (!c) return;
        const state = c.publication || "Published";
        row.hidden = inventoryFilter !== "All" && state !== inventoryFilter;
        row
          .querySelector(".table-car small")
          .insertAdjacentHTML(
            "afterend",
            `<span class="publication-label">${state}</span>`,
          );
        if (!c.image) {
          row.querySelector("img")?.remove();
        }
        if (state !== "Published") row.querySelector("a.icon-button")?.remove();
      });
      document.getElementById("publication-filter").onchange = (event) => {
        inventoryFilter = event.target.value;
        renderContent();
      };
      Hub.icons();
    },
    extendEditor(car) {
      document
        .querySelector("#car-form .form-grid")
        .insertAdjacentHTML(
          "afterbegin",
          `${select("publication", "Publication", ["Draft", "Published", "Archived"], car.publication || "Published")}`,
        );
      if (car.sourceEnquiryId)
        document
          .querySelector("#car-form .form-grid")
          .insertAdjacentHTML(
            "afterbegin",
            '<p class="notice span-2">Seller details are private. Verify the specifications and add a public description before publishing this draft.</p>',
          );
    },
  };
})();
