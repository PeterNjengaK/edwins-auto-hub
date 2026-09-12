window.Listings = (() => {
  const { escape: e, money, icon } = Hub;
  const names = {
    vehicle: "Cars",
    part: "Car parts",
    land: "Land & plots",
    house: "Houses",
  };
  const kind = (c) => c.category || "vehicle";
  const title = (c) =>
    kind(c) === "vehicle"
      ? `${c.year || ""} ${c.make || ""} ${c.model || ""}`.trim()
      : c.title;
  const url = (c) =>
    kind(c) === "vehicle"
      ? `/cars/car-details.html?id=${encodeURIComponent(c.id)}`
      : `/listing/?id=${encodeURIComponent(c.id)}`;
  const summary = (c) =>
    kind(c) === "part"
      ? `${c.partNumber} / ${c.quantity} in stock`
      : kind(c) === "land"
        ? `${c.propertyType} / ${c.area} ${c.areaUnit}`
        : kind(c) === "house"
          ? `${c.bedrooms} bedrooms / ${c.bathrooms} bathrooms`
          : `${Hub.number(c.mileage)} km / ${c.transmission}`;
  function input(
    label,
    key,
    value = "",
    type = "text",
    extra = "required",
    prefix = "listing",
  ) {
    return `<div class="field"><label for="${prefix}-${key}">${label}</label><input id="${prefix}-${key}" name="${key}" type="${type}" value="${e(value)}" ${extra}></div>`;
  }
  function select(label, key, values, value, prefix = "listing") {
    return `<div class="field"><label for="${prefix}-${key}">${label}</label><select id="${prefix}-${key}" name="${key}">${values
      .map((v) => {
        const [key, label] = Array.isArray(v) ? v : [v, v];
        return `<option value="${e(key)}" ${key === value ? "selected" : ""}>${e(label)}</option>`;
      })
      .join("")}</select></div>`;
  }
  function fields(category, c = {}, seller = false) {
    if (category === "vehicle") return "";
    let html =
      input(
        "Listing title",
        seller ? "listingTitle" : "title",
        c.title,
        "text",
        'required maxlength="200"',
      ) +
      input(
        "Location",
        "location",
        c.location,
        "text",
        `${category === "part" ? "" : "required"} maxlength="200"`,
      );
    if (category !== "land")
      html += select("Condition", "condition", ["New", "Used"], c.condition);
    if (category === "part")
      return (
        html +
        input("Part number / SKU", "partNumber", c.partNumber) +
        input("Brand", "brand", c.brand, "text", 'maxlength="150"') +
        input("Part type", "partType", c.partType) +
        input(
          "Compatible makes, models and years",
          "compatibility",
          c.compatibility,
          "text",
          'required maxlength="600"',
        ) +
        input(
          "Quantity in stock",
          "quantity",
          c.quantity ?? 1,
          "number",
          'required min="0" max="1000000" step="1"',
        )
      );
    html +=
      select(
        "Property type",
        "propertyType",
        category === "land"
          ? ["Land", "Plot"]
          : ["House", "Apartment", "Bungalow", "Maisonette", "Townhouse"],
        c.propertyType,
      ) +
      input(
        category === "house" ? "Floor area" : "Land area",
        "area",
        c.area,
        "number",
        'required min="0.01" max="100000000" step="any"',
      ) +
      select(
        "Area unit",
        "areaUnit",
        ["Acres", "Square metres"],
        c.areaUnit || (category === "house" ? "Square metres" : "Acres"),
      ) +
      select(
        "Tenure",
        "tenure",
        ["To be confirmed", "Freehold", "Leasehold"],
        c.tenure,
      );
    if (category === "house")
      html +=
        input(
          "Bedrooms",
          "bedrooms",
          c.bedrooms ?? 0,
          "number",
          'required min="0" max="100"',
        ) +
        input(
          "Bathrooms",
          "bathrooms",
          c.bathrooms ?? 0,
          "number",
          'required min="0" max="100"',
        );
    return html;
  }
  const categorySelect = (value) =>
    select("Category", "category", Object.entries(names), value);
  return {
    names,
    kind,
    title,
    url,
    summary,
    input,
    select,
    fields,
    categorySelect,
  };
})();

window.Catalogue = (() => {
  const { escape: e, money, icon, api } = Hub;
  const L = Listings;
  let inventory = [];
  function card(c) {
    return `<article class="listing-card"><div class="car-photo"><a href="${L.url(c)}"><img src="${e(c.image)}" alt="${e(L.title(c))}${c.demo ? " - illustrative photo" : ""}" loading="lazy" width="700" height="450"></a><span class="photo-badge">${e(c.status === "Available" ? c.condition || c.propertyType : c.status)}</span><button class="icon-button save-button" data-save="${e(c.id)}" aria-label="Save listing">${icon("heart")}</button>${c.demo ? '<span class="demo-label">Sample listing</span>' : ""}</div><div class="car-content"><div class="car-meta"><span>${L.names[L.kind(c)]}</span><span>${e(c.location || "Nairobi")}</span></div><h3><a href="${L.url(c)}">${e(L.title(c))}</a></h3><p class="listing-spec">${e(L.summary(c))}</p>${L.kind(c) === "part" ? `<p class="listing-spec">${e(c.compatibility)}</p>` : ""}<div class="listing-price"><strong>${money(c.price)}</strong>${L.kind(c) === "part" ? "<small>per unit</small>" : ""}<a class="icon-button" href="${L.url(c)}" title="View listing" aria-label="View ${e(L.title(c))}">${icon("arrow-up-right")}</a></div></div></article>`;
  }
  async function show(mode) {
    inventory = await api("/api/listings");
    if (mode === "detail") return detail();
    const categories =
      mode === "parts"
        ? ["part"]
        : mode === "properties"
          ? ["land", "house"]
          : Object.keys(L.names);
    const heading =
      mode === "saved"
        ? "Your saved listings"
        : mode === "parts"
          ? "New & used car parts"
          : mode === "properties"
            ? "Land, plots & houses"
            : "Explore the collection";
    document.title = `${heading} | Edwin's Auto Hub`;
    const q = new URLSearchParams(location.search);
    main.innerHTML = `<section class="container section marketplace"><div class="section-head"><div><span class="eyebrow">EDWIN'S AUTO HUB</span><h1>${heading}</h1></div><a class="text-link" href="/sell/">Sell with us ${icon("arrow-up-right")}</a></div><form id="listing-filters" class="listing-filters">${L.input("Search", "q", q.get("q") || "", "search", "", "filter")}${L.select("Category", "category", [["", "All categories"], ...categories.map((k) => [k, L.names[k]])], q.get("category") || "", "filter")}${L.select("Condition", "condition", [["", "Any condition"], "New", "Used"], q.get("condition") || "", "filter")}${L.input("Location", "location", q.get("location") || "", "search", "", "filter")}${L.input("Maximum price (KSh)", "max", q.get("max") || "", "number", 'min="0"', "filter")}${L.select(
      "Sort by",
      "sort",
      [
        ["newest", "Newest first"],
        ["low", "Price: low to high"],
        ["high", "Price: high to low"],
      ],
      q.get("sort") || "newest",
      "filter",
    )}<button type="reset" class="button outline">${icon("rotate-ccw")}Reset</button></form><div id="listing-results" aria-live="polite"></div></section>`;
    const form = document.getElementById("listing-filters");
    const render = () => {
      const v = Object.fromEntries(new FormData(form));
      const result = inventory.filter(
        (c) =>
          categories.includes(L.kind(c)) &&
          (mode !== "saved" || saved.includes(c.id)) &&
          (!v.category || L.kind(c) === v.category) &&
          (!v.condition ||
            (c.condition === "New" ? "New" : c.condition ? "Used" : "") ===
              v.condition) &&
          `${L.title(c)} ${c.partNumber || ""} ${c.compatibility || ""} ${c.propertyType || ""}`
            .toLowerCase()
            .includes(v.q.toLowerCase()) &&
          (c.location || "Nairobi")
            .toLowerCase()
            .includes(v.location.toLowerCase()) &&
          (!v.max || c.price <= Number(v.max)),
      );
      result.sort(
        v.sort === "low"
          ? (a, b) => a.price - b.price
          : v.sort === "high"
            ? (a, b) => b.price - a.price
            : (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
      );
      document.getElementById("listing-results").innerHTML =
        `<p class="result-count">${result.length} listings</p>${result.some((c) => c.demo) ? sampleNote : ""}<div class="cars-grid">${result.map(card).join("")}</div>${!result.length ? '<div class="empty-state"><h2>No matching listings</h2><p>Try another category or price range.</p></div>' : ""}`;
      const params = new URLSearchParams(
        Object.entries(v).filter(
          ([k, value]) => value && !(k === "sort" && value === "newest"),
        ),
      );
      history.replaceState(
        {},
        "",
        location.pathname + (params.size ? "?" + params : ""),
      );
      refreshUI();
    };
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", render);
    form.addEventListener("reset", () => {
      setTimeout(() => {
        for (const element of form.elements)
          if (element.name)
            element.value = element.name === "sort" ? "newest" : "";
        render();
      }, 0);
    });
    render();
  }
  function detail() {
    const c = inventory.find(
      (c) => c.id === new URLSearchParams(location.search).get("id"),
    );
    if (!c) {
      main.innerHTML =
        '<section class="container section"><h1>Listing unavailable</h1><a class="button" href="/catalogue/">Browse the collection</a></section>';
      return;
    }
    document.title = `${L.title(c)} | Edwin's Auto Hub`;
    const specs =
      L.kind(c) === "part"
        ? [
            ["Part number", c.partNumber],
            ["Brand", c.brand || "Ask us"],
            ["Part type", c.partType],
            ["Condition", c.condition],
            ["Stock", c.quantity],
            ["Compatibility", c.compatibility],
          ]
        : [
            ["Property type", c.propertyType],
            ["Location", c.location],
            ["Area", `${c.area} ${c.areaUnit}`],
            ["Tenure", c.tenure],
            ...(L.kind(c) === "house"
              ? [
                  ["Condition", c.condition],
                  ["Bedrooms", c.bedrooms],
                  ["Bathrooms", c.bathrooms],
                ]
              : []),
          ];
    main.innerHTML = `<div class="container detail-wrap"><div class="breadcrumb"><a href="/catalogue/">Collection</a>${icon("chevron-right")}<span>${L.names[L.kind(c)]}</span></div><div class="detail-top"><div><span class="eyebrow">${L.names[L.kind(c)]}</span><h1>${e(L.title(c))}</h1><p>${icon("map-pin")}${e(c.location)}</p></div><button class="icon-button" data-save="${e(c.id)}" aria-label="Save listing">${icon("heart")}</button></div><div class="detail-layout"><div><div class="gallery-main"><img id="listing-image" src="${e(c.image)}" alt="${e(L.title(c))}" width="1000" height="700">${c.demo ? '<span class="demo-label">Sample / illustrative photo</span>' : ""}</div><div class="gallery-thumbs">${c.images.map((src, n) => `<button data-listing-photo="${n}" aria-label="View photo ${n + 1}" aria-pressed="${n === 0}" class="${n === 0 ? "active" : ""}"><img src="${e(src)}" alt="Photo ${n + 1}"></button>`).join("")}</div><dl class="listing-specs">${specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join("")}</dl><section class="detail-section"><h2>About this ${L.kind(c) === "part" ? "part" : "property"}</h2><p>${e(c.description)}</p><div class="features-list">${(c.features || []).map((f) => `<span>${icon("check")}${e(f)}</span>`).join("")}</div></section><p class="notice">${c.demo ? "Illustrative sample only, not an actual offer for sale." : L.kind(c) === "part" ? "Confirm compatibility and condition before purchasing." : "Arrange an inspection and verify ownership, tenure, boundaries and transaction documents independently before purchase."}</p></div><aside class="detail-summary"><span class="status-label">${e(c.status)}</span><div class="detail-price">${money(c.price)}</div><p>${L.kind(c) === "part" ? "Asking price per unit" : "Asking price"}</p><button class="button full" id="listing-enquire" ${c.status === "Sold" ? "disabled" : ""}>${icon("messages-square")}${c.status === "Sold" ? "Sold" : L.kind(c) === "part" ? "Ask about this part" : "Arrange a viewing"}</button><a class="button outline full" href="/contact/">${icon("phone")}Contact Edwin</a></aside></div></div>`;
    document.querySelectorAll("[data-listing-photo]").forEach(
      (b) =>
        (b.onclick = () => {
          document.getElementById("listing-image").src =
            c.images[Number(b.dataset.listingPhoto)];
          document.querySelectorAll("[data-listing-photo]").forEach((el) => {
            el.classList.toggle("active", el === b);
            el.setAttribute("aria-pressed", el === b);
          });
        }),
    );
    document.getElementById("listing-enquire").onclick = () => {
      document.getElementById("enquiry-content").innerHTML =
        `<h2>${e(L.title(c))}</h2><p>${money(c.price)}${c.demo ? " / Sample listing" : ""}</p><form id="listing-enquiry"><div class="form-grid">${contactFields()}<div class="field span-2"><label for="message">Your message</label><textarea id="message" name="message" required maxlength="4000">I'd like more information about this listing.</textarea></div>${consent()}<button class="button span-2" type="submit">Send enquiry ${icon("arrow-up-right")}</button></div><div class="form-status" role="status" tabindex="-1"></div></form>`;
      bindEnquiry(document.getElementById("listing-enquiry"), "listing", c.id);
      Hub.icons();
      document.getElementById("enquiry-dialog").showModal();
    };
    refreshUI();
  }
  function seller() {
    formPage(true);
    document.title = "Sell with Edwin | Cars, parts & property";
    document.querySelector(".form-intro h1").textContent =
      "Cars, parts, land & homes.";
    document.querySelector(".form-intro > p").textContent =
      "Tell us what you would like to sell. Edwin will review the details and contact you about the next steps.";
    document.querySelector(".steps").remove();
    document.querySelector(".form-panel h2").textContent =
      "What would you like to sell?";
    const form = document.getElementById("public-form"),
      grid = form.querySelector(".form-grid");
    const originalFields = ["make", "model", "vehicle-year", "mileage"].map(
      (id) => document.getElementById(id).closest(".field"),
    );
    const wrapper = document.createElement("div");
    wrapper.className = "form-grid span-2";
    wrapper.id = "seller-details";
    originalFields[0].before(wrapper);
    originalFields.forEach((el) => wrapper.append(el));
    const vehicleHTML =
      wrapper.innerHTML +
      L.select(
        "Condition",
        "condition",
        ["New", "Used", "Foreign used", "Locally used"],
        "Used",
      );
    grid.insertAdjacentHTML("afterbegin", L.categorySelect("vehicle"));
    const category = form.elements.category;
    const change = () => {
      wrapper.innerHTML =
        category.value === "vehicle"
          ? vehicleHTML
          : L.fields(category.value, {}, true);
      Hub.icons();
    };
    category.onchange = change;
    change();
    form.addEventListener("reset", () => setTimeout(change, 0));
    form.querySelector('label[for="photos"]').textContent =
      "Listing photos (optional)";
    form.querySelector("[type=submit]").innerHTML =
      `Submit your listing ${icon("arrow-up-right")}`;
  }
  function homeSections() {
    const hero = document.querySelector(".hero");
    const band = document.createElement("section");
    band.className = "category-band container";
    band.innerHTML = [
      ["Cars", "New & used", "/cars/", "/images/toyota.jpg"],
      ["Car parts", "New & used", "/parts/", "/images/parts.jpg"],
      [
        "Land & plots",
        "Space for your plans",
        "/properties/?category=land",
        "/images/land.jpg",
      ],
      [
        "Houses",
        "New & used homes",
        "/properties/?category=house",
        "/images/house-new.jpg",
      ],
    ]
      .map(
        ([name, sub, url, img]) =>
          `<a href="${url}" class="category-tile"><img src="${img}" alt="${name} - illustrative category photo" width="500" height="300"><div><h2>${name}</h2><span>${sub}</span>${icon("arrow-up-right")}</div></a>`,
      )
      .join("");
    if (hero) hero.after(band);
    else main.prepend(band);
  }
  return { show, seller, homeSections };
})();
