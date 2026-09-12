const { escape: esc, money, number, icon, api } = Hub;
const main = document.getElementById("admin-main");
let csrf = "",
  cars = [],
  enquiries = [],
  tab = "inventory",
  search = "",
  editingId = null,
  existingImages = [],
  deleteId = null;
const nameOf = (c) => c.title || `${c.make} ${c.model}`;
const authenticated = async (url, method = "GET", body) => {
  const current = csrf;
  try {
    return await api(url, {
      method,
      headers: { "X-CSRF-Token": csrf },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (current && current === csrf && [401, 403].includes(error.status))
      AdminSession.expire("Your session has ended. Please sign in again.");
    throw error;
  }
};
function login() {
  AdminSession.stop();
  csrf = "";
  cars = [];
  enquiries = [];
  Manager.clear();
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  document
    .querySelectorAll("#editor-content,#management-content")
    .forEach((node) => {
      node.textContent = "";
    });
  main.innerHTML = `<section class="login-panel">${icon("lock-keyhole")}<span class="eyebrow">EDWIN'S AUTO HUB</span><h1>Welcome back.</h1><p>Sign in to manage your listings and enquiries.</p><form id="login-form"><div class="field"><label for="password">Admin password</label><div class="password-wrap"><input id="password" name="password" type="password" required autocomplete="current-password"><button type="button" class="icon-button" id="show-password" aria-label="Show password" title="Show password">${icon("eye")}</button></div></div><button type="submit" class="button full">Sign in ${icon("arrow-right")}</button><div id="login-status" class="form-status" role="alert"></div></form></section>`;
  document.getElementById("show-password").addEventListener("click", (e) => {
    const input = document.getElementById("password");
    input.type = input.type === "password" ? "text" : "password";
    e.currentTarget.setAttribute(
      "aria-label",
      input.type === "password" ? "Show password" : "Hide password",
    );
  });
  document
    .getElementById("login-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = e.target.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ password: e.target.elements.password.value }),
        });
        csrf = result.csrf;
        AdminSession.start(result);
        await load();
      } catch (error) {
        document.getElementById("login-status").textContent = error.message;
        button.disabled = false;
      }
    });
  Hub.icons();
}
async function load() {
  if (!csrf) return login();
  const current = csrf;
  try {
    [cars, enquiries] = await Promise.all([
      authenticated("/api/admin/cars"),
      authenticated("/api/enquiries"),
    ]);
    await Manager.load();
    if (csrf !== current) return;
    dashboard();
  } catch (error) {
    if (csrf !== current) return;
    if (error.status === 401) login();
    else {
      main.innerHTML = `<div class="admin-error"><h1>Unable to load the dashboard.</h1><p>${esc(error.message)}</p><button class="button" id="reload">Try again</button></div>`;
      document.getElementById("reload").addEventListener("click", load);
    }
  }
}
function dashboard() {
  main.innerHTML = `<div class="admin-workspace"><div class="admin-title"><div><span class="eyebrow">YOUR WORKSPACE</span><h1>Business overview</h1><p>Keep your collection current and your conversations moving.</p></div><div class="admin-title-actions"><button class="button outline small" id="logout">${icon("log-out")}Sign out</button><button class="button small" id="add-car">${icon("plus")}Add listing</button></div></div><div class="admin-stats"><div class="admin-stat"><span>Total listings</span><strong>${cars.length}</strong></div><div class="admin-stat"><span>Available</span><strong>${cars.filter((c) => c.status === "Available").length}</strong></div><div class="admin-stat"><span>New enquiries</span><strong>${enquiries.filter((e) => e.status === "New").length}</strong></div><div class="admin-stat"><span>Total enquiries</span><strong>${enquiries.length}</strong></div></div><div class="admin-toolbar"><div class="admin-tabs" role="group" aria-label="Dashboard view"><button data-tab="inventory" class="${tab === "inventory" ? "active" : ""}" aria-pressed="${tab === "inventory"}">${icon("car-front")} Inventory</button><button data-tab="enquiries" class="${tab === "enquiries" ? "active" : ""}" aria-pressed="${tab === "enquiries"}">${icon("inbox")} Enquiries</button></div><div class="field admin-search"><label for="admin-search" class="field-label">Search ${tab}</label><div class="search-input">${icon("search")}<input id="admin-search" placeholder="${tab === "inventory" ? "Search title, SKU or location" : "Search name, email or message"}" value="${esc(search)}"></div></div></div><div id="admin-content"></div></div>`;
  document.getElementById("logout").addEventListener("click", async () => {
    try {
      await authenticated("/api/logout", "POST");
      csrf = "";
      login();
    } catch (error) {
      Hub.toast(error.message);
    }
  });
  document.getElementById("add-car").addEventListener("click", () => editCar());
  document.getElementById("admin-search").addEventListener("input", (e) => {
    search = e.target.value;
    renderContent();
  });
  renderContent();
  Manager.decorate();
}
function renderContent() {
  const target = document.getElementById("admin-content");
  if (tab === "inventory") {
    Inventory.render(target, search);
    return;
  }
  if (Manager.render(tab, target, search)) {
    Hub.icons();
    return;
  }
  if (tab === "inventory") {
    const result = cars.filter((c) =>
      `${c.year} ${nameOf(c)}`.toLowerCase().includes(search.toLowerCase()),
    );
    target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Asking price</th><th>Mileage</th><th>Status</th><th>Actions</th></tr></thead><tbody>${result.map((c) => `<tr><td><div class="table-car"><img src="${esc(c.image)}" alt="${esc(nameOf(c))}"><div><strong>${esc(nameOf(c))}</strong><small>${c.year} &middot; ${esc(c.condition)}</small>${c.demo ? '<span class="demo-chip">Sample</span>' : ""}</div></div></td><td>${money(c.price)}</td><td>${number(c.mileage)} km</td><td><span class="status-chip ${c.status.toLowerCase()}">${esc(c.status)}</span></td><td><div class="table-actions"><a class="icon-button" href="/cars/car-details.html?id=${encodeURIComponent(c.id)}" aria-label="View ${esc(nameOf(c))}" title="View listing">${icon("external-link")}</a><button class="icon-button" data-edit="${esc(c.id)}" aria-label="Edit ${esc(nameOf(c))}" title="Edit vehicle">${icon("pencil")}</button><button class="icon-button" data-delete="${esc(c.id)}" aria-label="Delete ${esc(nameOf(c))}" title="Delete vehicle">${icon("trash-2")}</button></div></td></tr>`).join("")}</tbody></table>${!result.length ? '<div class="admin-empty"><p>No matching vehicles.</p></div>' : ""}</div>`;
  } else {
    const result = enquiries.filter((e) =>
      `${e.name} ${e.email} ${e.message} ${e.vehicle || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    target.innerHTML = `<div class="enquiry-list">${result.map((e) => `<article class="enquiry-item"><div class="enquiry-heading"><div><h3>${esc(e.name)} <span class="status-chip">${e.type === "sell" ? "Selling a car" : e.type === "vehicle" ? "Vehicle enquiry" : "General enquiry"}</span></h3><p>${esc(new Date(e.createdAt).toLocaleString("en-KE"))} &middot; Ref ${e.id.slice(0, 8).toUpperCase()}${e.vehicle ? " &middot; " + esc(e.vehicle) : ""}</p></div><select data-enquiry-status="${e.id}" aria-label="Status for ${esc(e.name)}">${["New", "In progress", "Closed"].map((v) => `<option ${e.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><p class="enquiry-message">${esc(e.message)}</p>${e.details ? `<p class="enquiry-details">${esc(e.details.year)} ${esc(e.details.make)} ${esc(e.details.model)} &middot; ${money(e.details.price)} &middot; ${number(e.details.mileage)} km</p>` : ""}<div class="enquiry-contact"><a href="mailto:${esc(e.email)}">${icon("mail")}${esc(e.email)}</a>${e.phone ? `<a href="tel:${esc(e.phone)}">${icon("phone")}${esc(e.phone)}</a>` : ""}</div>${e.images?.length ? `<div class="enquiry-photos">${e.images.map((image, i) => `<img src="${esc(image)}" alt="Submitted vehicle photo ${i + 1}" loading="lazy">`).join("")}</div>` : ""}</article>`).join("") || '<div class="admin-empty"><p>No enquiries to show yet.</p></div>'}</div>`;
    target.querySelectorAll("[data-enquiry-status]").forEach((select) =>
      select.addEventListener("change", async () => {
        const previous = enquiries.find(
          (e) => e.id === select.dataset.enquiryStatus,
        ).status;
        select.disabled = true;
        try {
          await authenticated(
            `/api/enquiries/${select.dataset.enquiryStatus}`,
            "PATCH",
            { status: select.value },
          );
          await load();
          Hub.toast("Enquiry status updated.");
        } catch (error) {
          select.value = previous;
          Hub.toast(error.message);
        } finally {
          select.disabled = false;
        }
      }),
    );
  }
  Hub.icons();
  Manager.enhance(tab);
}
function field(label, key, value = "", type = "text", extra = "") {
  return `<div class="field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function selectField(label, key, values, current) {
  return `<div class="field"><label for="edit-${key}">${label}</label><select id="edit-${key}" name="${key}">${values.map((v) => `<option ${v === current ? "selected" : ""}>${v}</option>`).join("")}</select></div>`;
}
function editCar(id) {
  if (id && Listings.kind(cars.find((c) => c.id === id) || {}) !== "vehicle")
    return Inventory.edit(id);
  editingId = id || null;
  const car = cars.find((c) => c.id === id) || {};
  existingImages = [...(car.images || [])];
  document.getElementById("editor-content").innerHTML =
    `<h2>${id ? "Edit vehicle" : "Add a vehicle"}</h2><form id="car-form"><div class="form-grid">${field("Make", "make", car.make, "text", 'required maxlength="100"')}${field("Model", "model", car.model, "text", 'required maxlength="100"')}${field("Year", "year", car.year, "number", `required min="1950" max="${new Date().getFullYear() + 1}"`)}${field("Asking price (KSh)", "price", car.price, "number", 'required min="1" max="1000000000"')}${field("Mileage (km)", "mileage", car.mileage ?? 0, "number", 'required min="0" max="2000000"')}${selectField("Body type", "body", ["Sedan", "SUV", "Hatchback", "Coupe", "Pickup", "Van", "Wagon"], car.body)}${selectField("Fuel", "fuel", ["Petrol", "Diesel", "Hybrid", "Electric"], car.fuel)}${selectField("Transmission", "transmission", ["Automatic", "Manual"], car.transmission)}${field("Engine", "engine", car.engine, "text", 'maxlength="100" placeholder="e.g. 2.0L"')}${field("Colour", "color", car.color, "text", 'maxlength="100"')}${selectField("Condition", "condition", ["Foreign used", "Locally used", "New", "Used"], car.condition)}${selectField("Status", "status", ["Available", "Reserved", "Sold"], car.status)}<div class="field span-2"><label for="edit-description">Description</label><textarea id="edit-description" name="description" maxlength="3000">${esc(car.description)}</textarea></div><div class="field span-2"><label for="edit-features">Features (one per line)</label><textarea id="edit-features" name="features">${esc((car.features || []).join("\n"))}</textarea></div><div class="field span-2"><label for="edit-photos">Vehicle photos</label><div id="existing-images" class="existing-images"></div><input id="edit-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Up to 4 photos total. 2 MB each. The first photo is the cover. Existing photos are kept unless removed.</small></div><label class="check-field span-2"><input name="featured" type="checkbox" ${car.featured ? "checked" : ""}>Feature on the homepage</label>${car.demo ? '<p class="notice span-2">This sample remains labelled as illustrative. Create a new listing with actual vehicle details and photos for real stock.</p>' : ""}</div><div class="editor-actions"><button class="button outline" type="button" data-close>Cancel</button><button class="button" type="submit">${icon("check")}Save vehicle</button></div><div class="form-status" role="status"></div></form>`;
  renderImages();
  Manager.extendEditor(car);
  Inventory.categoryControl(car);
  document
    .getElementById("car-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target,
        button = form.querySelector('[type="submit"]'),
        status = form.querySelector(".form-status");
      button.disabled = true;
      status.textContent = "";
      try {
        const images = [
          ...existingImages,
          ...(await Hub.images(form.elements.photos.files)),
        ];
        if (
          (form.elements.publication.value === "Published" && !images.length) ||
          images.length > 4
        )
          throw new Error("Please add between one and four photos.");
        const body = {
          ...Object.fromEntries(new FormData(form)),
          updatedAt: car.updatedAt || car.createdAt,
          images,
          featured: form.elements.featured.checked,
          features: form.elements.features.value
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        };
        delete body.photos;
        await authenticated(
          editingId ? `/api/cars/${editingId}` : "/api/cars",
          editingId ? "PUT" : "POST",
          body,
        );
        document.getElementById("editor-dialog").close();
        await load();
        Hub.toast("Vehicle saved.");
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  Hub.icons();
  document.getElementById("editor-dialog").showModal();
}
function renderImages() {
  document.getElementById("existing-images").innerHTML = existingImages
    .map(
      (image, i) =>
        `<div class="existing-image"><img src="${esc(image)}" alt="Vehicle photo ${i + 1}"><button type="button" class="icon-button" data-remove-image="${i}" title="Remove photo" aria-label="Remove photo ${i + 1}">${icon("x")}</button></div>`,
    )
    .join("");
  Hub.icons();
}
document.addEventListener("click", (event) => {
  const tabs = event.target.closest("[data-tab]");
  if (tabs) {
    tab = tabs.dataset.tab;
    search = "";
    dashboard();
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) editCar(edit.dataset.edit);
  if (event.target.closest("[data-close]"))
    document.getElementById("editor-dialog").close();
  const remove = event.target.closest("[data-remove-image]");
  if (remove) {
    existingImages.splice(Number(remove.dataset.removeImage), 1);
    renderImages();
  }
  const del = event.target.closest("[data-delete]");
  if (del) {
    deleteId = del.dataset.delete;
    document.getElementById("delete-error").textContent = "";
    document.getElementById("confirm-dialog").showModal();
  }
});
document
  .getElementById("cancel-delete")
  .addEventListener("click", () =>
    document.getElementById("confirm-dialog").close(),
  );
document
  .getElementById("confirm-delete")
  .addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
      await authenticated(`/api/cars/${deleteId}`, "DELETE");
      document.getElementById("confirm-dialog").close();
      await load();
      Hub.toast("Listing deleted.");
    } catch (error) {
      document.getElementById("delete-error").textContent = error.message;
    } finally {
      event.target.disabled = false;
    }
  });
async function init() {
  login();
  Hub.icons();
}
init();
