window.Inventory = (() => {
  const L = Listings,
    { escape: e, money, icon } = Hub;
  let category = "",
    condition = "";
  function render(target, search) {
    const result = cars.filter(
      (c) =>
        (!category || L.kind(c) === category) &&
        (!condition ||
          (c.condition === "New" ? "New" : c.condition ? "Used" : "") ===
            condition) &&
        `${L.title(c)} ${c.location || ""} ${c.partNumber || ""} ${c.compatibility || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    target.innerHTML = `<div class="inventory-filters">${L.select("Category", "inventory-category", [["", "All categories"], ...Object.entries(L.names)], category)}${L.select("Condition", "inventory-condition", [["", "Any condition"], "New", "Used"], condition)}</div><div class="table-wrap"><table><thead><tr><th>Listing</th><th>Category</th><th>Asking price</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead><tbody>${result.map((c) => `<tr><td><div class="table-car">${c.image ? `<img src="${e(c.image)}" alt="${e(L.title(c))}">` : ""}<div><strong>${e(L.title(c))}</strong><small>${e(c.condition || c.propertyType || "")}</small>${c.demo ? '<span class="demo-chip">Sample</span>' : ""}</div></div></td><td>${L.names[L.kind(c)]}</td><td>${money(c.price)}${L.kind(c) === "part" ? "<small> / unit</small>" : ""}</td><td>${e(L.summary(c))}${c.location ? `<br>${e(c.location)}` : ""}</td><td><span class="status-chip ${c.status.toLowerCase()}">${e(c.status)}</span></td><td><div class="table-actions"><a class="icon-button" href="${L.url(c)}" title="View listing" aria-label="View ${e(L.title(c))}">${icon("external-link")}</a><button class="icon-button" data-edit="${e(c.id)}" title="Edit listing" aria-label="Edit ${e(nameOf(c))}">${icon("pencil")}</button><button class="icon-button" data-delete="${e(c.id)}" title="Delete listing" aria-label="Delete ${e(nameOf(c))}">${icon("trash-2")}</button></div></td></tr>`).join("")}</tbody></table>${!result.length ? '<div class="admin-empty"><p>No matching listings.</p></div>' : ""}</div>`;
    target.querySelector("[name=inventory-category]").onchange = (event) => {
      category = event.target.value;
      renderContent();
    };
    target.querySelector("[name=inventory-condition]").onchange = (event) => {
      condition = event.target.value;
      renderContent();
    };
    Manager.enhance("inventory");
    Hub.icons();
  }
  function categoryControl(c) {
    document
      .querySelector("#car-form .form-grid")
      .insertAdjacentHTML("afterbegin", L.categorySelect(L.kind(c)));
    const select = document.querySelector("#car-form [name=category]");
    if (c.id) select.disabled = true;
    else
      select.onchange = () =>
        select.value === "vehicle" ? editCar() : edit(null, select.value);
  }
  function edit(id, category = "part") {
    const c = cars.find((c) => c.id === id) || { category };
    category = L.kind(c);
    editingId = id || null;
    existingImages = [...(c.images || [])];
    document.getElementById("editor-content").innerHTML =
      `<h2>${id ? "Edit listing" : "Add a listing"}</h2><form id="car-form"><div class="form-grid">${L.fields(category, c)}${L.input(category === "part" ? "Unit price (KSh)" : "Asking price (KSh)", "price", c.price, "number", 'required min="1" max="1000000000"')}${L.select("Status", "status", ["Available", "Reserved", "Sold"], c.status)}<div class="field span-2"><label for="edit-description">Description</label><textarea id="edit-description" name="description" maxlength="3000">${e(c.description)}</textarea></div><div class="field span-2"><label for="edit-features">Features (one per line)</label><textarea id="edit-features" name="features">${e((c.features || []).join("\n"))}</textarea></div><div class="field span-2"><label for="edit-photos">Listing photos</label><div id="existing-images" class="existing-images"></div><input id="edit-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></div>${c.demo ? '<p class="notice span-2">Illustrative sample. Create a new listing for actual stock.</p>' : ""}</div><div class="editor-actions"><button class="button outline" type="button" data-close>Cancel</button><button class="button" type="submit">${icon("check")}Save listing</button></div><div class="form-status" role="status"></div></form>`;
    renderImages();
    Manager.extendEditor(c);
    categoryControl(c);
    document.getElementById("car-form").onsubmit = async (event) => {
      event.preventDefault();
      const form = event.target,
        button = form.querySelector("[type=submit]"),
        status = form.querySelector(".form-status");
      button.disabled = true;
      status.textContent = "";
      try {
        const body = {
          ...Object.fromEntries(new FormData(form)),
          category,
          updatedAt: c.updatedAt || c.createdAt,
          images: [
            ...existingImages,
            ...(await Hub.images(form.elements.photos.files)),
          ],
          features: form.elements.features.value
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          featured: false,
        };
        delete body.photos;
        await authenticated(
          id ? `/api/cars/${id}` : "/api/cars",
          id ? "PUT" : "POST",
          body,
        );
        document.getElementById("editor-dialog").close();
        await load();
        Hub.toast("Listing saved.");
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    Hub.icons();
    const dialog = document.getElementById("editor-dialog");
    if (!dialog.open) dialog.showModal();
  }
  return { render, edit, categoryControl };
})();
