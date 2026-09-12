const { escape: esc, money, number, icon, api } = Hub;
const main = document.getElementById("main");
let cars = [];
let saved = [];
try {
  const value = JSON.parse(localStorage.getItem("edwin-saved") || "[]");
  if (Array.isArray(value)) saved = value.filter((x) => typeof x === "string");
} catch {}
const nameOf = (car) => `${car.make} ${car.model}`;
const detailUrl = (car) =>
  `/cars/car-details.html?id=${encodeURIComponent(car.id)}`;
const options = (values, selected = "", first = "Any") =>
  `<option value="">${first}</option>` +
  values
    .map(
      (v) =>
        `<option ${String(selected) === String(v) ? "selected" : ""} value="${esc(v)}">${esc(v)}</option>`,
    )
    .join("");
const sampleNote =
  '<div class="sample-notice">' +
  icon("info") +
  "<span>Sample inventory for this preview. Photos and specifications are illustrative.</span></div>";
function updateSaved() {
  const count = document.getElementById("saved-count");
  count.textContent = saved.length;
  count.hidden = saved.length === 0;
  document.querySelectorAll("[data-save]").forEach((button) => {
    const active = saved.includes(button.dataset.save);
    button.classList.toggle("is-saved", active);
    button.setAttribute("aria-pressed", active);
    button.setAttribute(
      "aria-label",
      active ? "Remove from saved listings" : "Save listing",
    );
    button.title = active ? "Remove from saved listings" : "Save listing";
  });
}
function card(car) {
  return `<article class="car-card"><div class="car-photo"><a href="${detailUrl(car)}" aria-label="View ${esc(nameOf(car))}"><img src="${esc(car.image)}" alt="${esc(nameOf(car))}${car.demo ? " - illustrative photo" : ""}" loading="lazy" width="700" height="450"></a><span class="photo-badge">${esc(car.status === "Available" ? car.condition : car.status)}</span><button class="icon-button save-button" data-save="${esc(car.id)}" aria-label="Save listing">${icon("heart")}</button>${car.demo ? '<span class="demo-label">Sample vehicle</span>' : ""}</div><div class="car-content"><div class="car-meta"><span>${esc(car.year)}</span><span>${esc(car.body)}</span></div><h3><a href="${detailUrl(car)}">${esc(nameOf(car))}</a></h3><div class="car-specs"><span>${icon("gauge")}${number(car.mileage)} km</span><span>${icon("settings-2")}${esc(car.transmission)}</span><span>${icon("fuel")}${esc(car.fuel)}</span></div><div class="car-bottom"><strong class="car-price">${money(car.price)}</strong><a href="${detailUrl(car)}" aria-label="View ${esc(nameOf(car))}" title="View vehicle">${icon("arrow-up-right")}</a></div></div></article>`;
}
function refreshUI() {
  Hub.icons();
  updateSaved();
  Hub.applyBusiness();
}
function home() {
  main.innerHTML = `<section class="hero"><img class="hero-photo" src="/images/mercedes.jpg" alt="Silver Mercedes-Benz photographed on an open road" fetchpriority="high" width="1600" height="1067"><div class="container hero-content"><span class="eyebrow">CARS. PARTS. LAND. HOMES.</span><h1>Edwin's Auto Hub<span>Your next drive. A better beginning.</span></h1><p>New and used cars and parts. Land, plots and homes. Explore your next move with Edwin.</p><div class="hero-links"><a class="button" href="/cars/">Find your next car ${icon("arrow-up-right")}</a><a class="text-link" href="/sell/">Sell your car ${icon("arrow-right")}</a></div><div class="hero-bottom"><span class="hero-note">${icon("map-pin")} Based in Nairobi. Here for your next move.</span></div></div><span class="hero-caption">The collection / illustrative photography</span></section>
  <section class="search-band" aria-label="Find a vehicle"><form id="quick-search" class="container quick-search"><div class="field"><label for="quick-make">Choose a make</label><select id="quick-make" name="make">${options([...new Set(cars.map((c) => c.make))].sort(), "", "All makes")}</select></div><div class="field"><label for="quick-body">Your kind of car</label><select id="quick-body" name="body">${options(["Sedan", "SUV", "Hatchback", "Coupe", "Pickup"], "", "All body types")}</select></div><div class="field"><label for="quick-budget">Your budget</label><select id="quick-budget" name="max">${budgetOptions()}</select></div><button class="button dark" type="submit">${icon("search")} Search cars</button></form></section>
  <div class="trust-strip"><div class="container trust-inner"><span class="trust-item">${icon("car-front")} Cars for your everyday</span><span class="trust-item">${icon("messages-square")} A real person to talk to</span><span class="trust-item">${icon("banknote")} Prices in Kenya shillings</span><span class="trust-item">${icon("key-round")} Viewings by appointment</span></div></div>
  <section class="section container"><div class="section-head"><div><span class="eyebrow">FIND YOUR NEXT CHAPTER</span><h2>A good place to start.</h2><p>Different drives. One destination: the right car for you.</p></div><a href="/cars/" class="text-link">Explore all cars ${icon("arrow-up-right")}</a></div><div class="body-tabs" role="group" aria-label="Vehicle body type"><button class="body-tab active" data-home-body="" aria-pressed="true">All cars</button>${["Sedan", "SUV", "Coupe"].map((b) => `<button class="body-tab" data-home-body="${b}" aria-pressed="false">${icon(b === "SUV" ? "truck" : "car-front")}${b === "SUV" ? "SUVs" : b + "s"}</button>`).join("")}</div><div class="cars-grid" id="featured-grid"></div>${cars.some((c) => c.demo) ? sampleNote : ""}</section>
  <section class="why-section section"><div class="container why-grid"><img class="editorial-image" src="/images/porsche.jpg" alt="A black Porsche travelling along an open road" loading="lazy" width="700" height="600"><div class="why-copy"><span class="eyebrow">MORE THAN A SET OF KEYS</span><h2>A little less searching.<br>A lot more driving.</h2><p>Buying a car is a big decision. We make room for the questions, the details, and the test drive before you decide.</p><div class="why-points"><div class="why-point"><span>${icon("messages-square")}</span><div><h3>Start with a conversation</h3><p>Your budget, your routine, your next adventure.</p></div></div><div class="why-point"><span>${icon("scan-search")}</span><div><h3>Get into the details</h3><p>Discuss condition, history, and an independent inspection.</p></div></div><div class="why-point"><span>${icon("key-round")}</span><div><h3>Make the next move yours</h3><p>Arrange a viewing and take your time deciding.</p></div></div></div><a class="text-link" href="/about/">Get to know Edwin's ${icon("arrow-up-right")}</a></div></div></section>
  <section class="sell-band"><div class="container"><div><span class="eyebrow">READY FOR SOMETHING NEW?</span><h2>Your car's next chapter starts here.</h2><p>Tell us what you're driving. Let's talk about what comes next.</p></div><a href="/sell/" class="button dark">Sell your car ${icon("arrow-up-right")}</a></div></section>
  <section class="section container faq-grid"><div><span class="eyebrow">BEFORE YOU HIT THE ROAD</span><h2>A few things you might be wondering.</h2><p>Still have a question? We're a conversation away.</p><a href="/contact/" class="text-link" style="margin-top:20px">Talk to us ${icon("arrow-up-right")}</a></div><div class="faq-list"><details><summary>Can I view a car before deciding?</summary><p>Yes. Send an enquiry from the vehicle page or call us to arrange a viewing in Nairobi. We'll confirm availability and a meeting point with you.</p></details><details><summary>Can you help me sell my current car?</summary><p>Submit your vehicle details and photos on the Sell your car page. Edwin can then discuss the vehicle, your expectations, and the next steps with you.</p></details><details><summary>Can I bring an independent mechanic?</summary><p>Tell us when you arrange your viewing so we can discuss inspection arrangements for the vehicle you're interested in.</p></details><details><summary>How do I enquire about a specific car?</summary><p>Open the vehicle listing and choose Enquire about this car. You can also call or start a WhatsApp conversation directly from that page.</p></details></div></section>`;
  showFeatured("");
  document
    .getElementById("quick-search")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const query = new URLSearchParams();
      for (const [key, value] of new FormData(event.target))
        if (value) query.set(key, value);
      location.href = `/cars/?${query}`;
    });
}
function showFeatured(body) {
  const matching = cars
    .filter((c) => c.status !== "Sold" && (!body || c.body === body))
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3);
  document.getElementById("featured-grid").innerHTML = matching.length
    ? matching.map(card).join("")
    : empty(
        "No cars in this collection yet.",
        "Explore the full catalogue or get in touch about sourcing a vehicle.",
      );
  document.querySelectorAll("[data-home-body]").forEach((b) => {
    b.classList.toggle("active", b.dataset.homeBody === body);
    b.setAttribute("aria-pressed", b.dataset.homeBody === body);
  });
  refreshUI();
}
function budgetOptions(selected = "") {
  return (
    '<option value="">Any budget</option>' +
    [1500000, 3000000, 5000000, 8000000, 15000000]
      .map(
        (v) =>
          `<option value="${v}" ${String(v) === selected ? "selected" : ""}>Up to ${money(v)}</option>`,
      )
      .join("")
  );
}
function empty(
  title,
  text,
  action = '<a href="/cars/" class="button outline">Explore all cars</a>',
) {
  return `<div class="empty-state">${icon("car-front")}<h2>${title}</h2><p>${text}</p>${action}</div>`;
}
function catalogue(savedOnly = false) {
  document.title = `${savedOnly ? "Saved cars" : "Find a car"} | Edwin's Auto Hub`;
  const query = new URLSearchParams(location.search);
  main.innerHTML = `<section class="page-heading"><div class="container"><div class="breadcrumb"><a href="/">Home</a>${icon("chevron-right")}<span>${savedOnly ? "Saved cars" : "Find a car"}</span></div><span class="eyebrow">${savedOnly ? "YOUR PERSONAL SHORTLIST" : "THE RIGHT CAR. YOUR WAY."}</span><h1>${savedOnly ? "Worth a second look." : "Find your next drive."}</h1><p>${savedOnly ? "All the cars that caught your eye, in one place." : "Explore the collection. Narrow it down. Make it yours."}</p></div></section><div class="container catalogue-layout"><button id="toggle-filters" class="button outline filter-mobile" aria-expanded="false" aria-controls="filters">${icon("sliders-horizontal")} Filter cars</button><aside class="filter-sidebar" id="filters"><div class="filter-title"><h2>Filters</h2><button class="reset-button" id="reset-filters">Reset all</button></div><form id="filter-form"><div class="field"><label for="filter-q">Search vehicles</label><div class="search-input">${icon("search")}<input id="filter-q" name="q" placeholder="Make or model" value="${esc(query.get("q") || "")}"></div></div><div class="field"><label for="filter-make">Make</label><select id="filter-make" name="make">${options([...new Set(cars.map((c) => c.make))].sort(), query.get("make"), "All makes")}</select></div><div class="field"><label for="filter-body">Body type</label><select id="filter-body" name="body">${options(["Sedan", "SUV", "Hatchback", "Coupe", "Pickup", "Van", "Wagon"], query.get("body"), "All body types")}</select></div><div class="field"><label for="filter-max">Maximum price</label><select name="max" id="filter-max">${budgetOptions(query.get("max"))}</select></div><div class="field"><label for="filter-year">Year from</label><select name="year" id="filter-year">${options([2024, 2022, 2020, 2018, 2015, 2010], query.get("year"), "Any year")}</select></div><div class="field"><label for="filter-fuel">Fuel type</label><select name="fuel" id="filter-fuel">${options(["Petrol", "Diesel", "Hybrid", "Electric"], query.get("fuel"), "Any fuel")}</select></div><div class="field"><label for="filter-transmission">Transmission</label><select name="transmission" id="filter-transmission">${options(["Automatic", "Manual"], query.get("transmission"), "Any transmission")}</select></div><label class="check-field"><input type="checkbox" name="available" ${query.get("available") ? "checked" : ""}>Available vehicles only</label></form><div class="filter-hint"><h3>Something specific in mind?</h3><p>Tell us what you're looking for. Let's find your next drive together.</p><a href="/contact/" class="text-link">Talk to Edwin ${icon("arrow-up-right")}</a></div></aside><section aria-label="Vehicle results"><div class="catalogue-toolbar"><p id="result-count" role="status"></p><select id="sort" aria-label="Sort vehicles"><option value="featured">Featured first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="year">Year: newest first</option><option value="mileage">Lowest mileage</option></select></div><div class="cars-grid" id="results"></div>${cars.some((c) => c.demo) ? sampleNote : ""}</section></div>`;
  document.getElementById("sort").value = [
    "featured",
    "price-low",
    "price-high",
    "year",
    "mileage",
  ].includes(query.get("sort"))
    ? query.get("sort")
    : "featured";
  const apply = () => applyFilters(savedOnly);
  document
    .getElementById("filter-form")
    .insertAdjacentHTML(
      "beforeend",
      Listings.select(
        "Condition",
        "condition",
        [["", "Any condition"], "New", "Used"],
        query.get("condition") || "",
        "filter",
      ),
    );
  document.getElementById("filter-form").addEventListener("input", apply);
  document
    .getElementById("filter-form")
    .addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("sort").addEventListener("change", apply);
  document.getElementById("reset-filters").addEventListener("click", () => {
    for (const field of document.getElementById("filter-form").elements) {
      if (field.type === "checkbox") field.checked = false;
      else field.value = "";
    }
    document.getElementById("sort").value = "featured";
    apply();
  });
  document.getElementById("toggle-filters").addEventListener("click", (e) => {
    const open = document.getElementById("filters").classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", open);
  });
  apply();
}
function applyFilters(savedOnly = false) {
  const values = Object.fromEntries(
    new FormData(document.getElementById("filter-form")),
  );
  let result = cars.filter(
    (c) =>
      (!savedOnly || saved.includes(c.id)) &&
      (!values.q ||
        `${c.year} ${nameOf(c)}`
          .toLowerCase()
          .includes(values.q.toLowerCase())) &&
      (!values.make || c.make === values.make) &&
      (!values.condition ||
        (c.condition === "New" ? "New" : "Used") === values.condition) &&
      (!values.body || c.body === values.body) &&
      (!values.fuel || c.fuel === values.fuel) &&
      (!values.transmission || c.transmission === values.transmission) &&
      (!values.max || c.price <= Number(values.max)) &&
      (!values.year || c.year >= Number(values.year)) &&
      (!values.available || c.status === "Available"),
  );
  const sort = document.getElementById("sort").value;
  const comparisons = {
    featured: (a, b) => Number(b.featured) - Number(a.featured),
    "price-low": (a, b) => a.price - b.price,
    "price-high": (a, b) => b.price - a.price,
    year: (a, b) => b.year - a.year,
    mileage: (a, b) => a.mileage - b.mileage,
  };
  result.sort(comparisons[sort]);
  document.getElementById("result-count").textContent =
    `${result.length} ${result.length === 1 ? "vehicle" : "vehicles"} ${savedOnly ? "in your shortlist" : "to explore"}`;
  document.getElementById("results").innerHTML = result.length
    ? result.map(card).join("")
    : empty(
        savedOnly ? "Your shortlist is waiting." : "No cars match just yet.",
        savedOnly
          ? "Tap the heart on a vehicle to save it here."
          : "Try a different make or a wider budget.",
        savedOnly
          ? undefined
          : '<button class="button outline" data-clear-filters>Clear filters</button>',
      );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value) query.set(key, value);
  if (sort !== "featured") query.set("sort", sort);
  history.replaceState(
    {},
    "",
    `${location.pathname}${query.size ? "?" + query : ""}`,
  );
  refreshUI();
}
function detail() {
  const car = cars.find(
    (c) => c.id === new URLSearchParams(location.search).get("id"),
  );
  if (!car) {
    main.innerHTML = `<section class="section container">${empty("This car is no longer here.", "The listing may have been removed. There are more cars to explore.")}</section>`;
    return;
  }
  document.title = `${car.year} ${nameOf(car)} | Edwin's Auto Hub`;
  const whatsapp = `https://wa.me/254708942431?text=${encodeURIComponent(`Hi Edwin, I'm interested in the ${car.year} ${nameOf(car)}${car.demo ? " (sample listing)" : ""}. ${location.href}`)}`;
  main.innerHTML = `<div class="container detail-wrap"><div class="breadcrumb"><a href="/">Home</a>${icon("chevron-right")}<a href="/cars/">Find a car</a>${icon("chevron-right")}<span>${esc(nameOf(car))}</span></div><div class="detail-top"><div><span class="eyebrow">${esc(car.condition)} / ${esc(car.body)}</span><h1>${car.year} ${esc(nameOf(car))}</h1><p>${icon("map-pin")} Nairobi, Kenya</p></div><button class="button outline save-button" data-save="${esc(car.id)}">${icon("heart")} Save this car</button></div><div class="detail-layout"><div><div class="gallery-main"><img id="gallery-image" src="${esc(car.image)}" alt="${esc(nameOf(car))}${car.demo ? " - illustrative photo" : ""}" width="1000" height="700">${car.demo ? '<span class="demo-label">Sample vehicle / illustrative photo</span>' : ""}</div><div class="gallery-thumbs">${car.images.map((image, i) => `<button data-gallery="${i}" class="${i === 0 ? "active" : ""}" aria-label="View photo ${i + 1}" aria-pressed="${i === 0}"><img src="${esc(image)}" alt="Photo ${i + 1}"></button>`).join("")}</div><div class="spec-grid">${[
    ["calendar", "Year", car.year],
    ["gauge", "Mileage", number(car.mileage) + " km"],
    ["settings-2", "Transmission", car.transmission],
    ["fuel", "Fuel", car.fuel],
    ["cog", "Engine", car.engine || "Ask us"],
    ["palette", "Colour", car.color || "Ask us"],
  ]
    .map(
      ([i, label, value]) =>
        `<div class="spec-item">${icon(i)}<span>${label}</span><strong>${esc(value)}</strong></div>`,
    )
    .join(
      "",
    )}</div><section class="detail-section"><h2>Meet your next drive.</h2><p>${esc(car.description)}</p></section><section class="detail-section"><h2>The details that matter.</h2><div class="features-list">${car.features.map((f) => `<span>${icon("check")}${esc(f)}</span>`).join("") || "<p>Contact us for equipment details.</p>"}</div></section>${car.demo ? '<p class="notice">This is a sample listing for the local preview. It is not an offer for an actual vehicle. Photos, specifications, and prices are illustrative.</p>' : '<p class="notice">Confirm specifications, condition, and availability with Edwin before making a purchase.</p>'}</div><aside class="detail-summary"><span class="status-label">${esc(car.status)}${car.demo ? " / Sample listing" : ""}</span><div class="detail-price">${money(car.price)}</div><p>${car.demo ? "Illustrative asking price" : "Asking price in Kenya shillings"}</p><button class="button full" data-enquire="${esc(car.id)}" ${car.status === "Sold" ? "disabled" : ""}>${icon("messages-square")}${car.status === "Sold" ? "This vehicle is sold" : "Enquire about this car"}</button><a href="${whatsapp}" target="_blank" rel="noopener" class="button outline full">${icon("message-circle")}Chat on WhatsApp</a><a href="tel:+254708942431" class="button outline full">${icon("phone")}+254 708 942 431</a><hr><h3>Let's arrange a closer look.</h3><p class="seller-note">Get in touch to discuss the vehicle and arrange a viewing. No payment is taken on this website.</p></aside></div></div><section class="section why-section"><div class="container"><div class="section-head"><div><span class="eyebrow">KEEP EXPLORING</span><h2>A few more possibilities.</h2></div><a class="text-link" href="/cars/">All vehicles ${icon("arrow-up-right")}</a></div><div class="cars-grid">${cars
    .filter((c) => c.id !== car.id && c.status !== "Sold")
    .slice(0, 3)
    .map(card)
    .join("")}</div></div></section>`;
  document.querySelectorAll("[data-gallery]").forEach((button) =>
    button.addEventListener("click", () => {
      document.getElementById("gallery-image").src =
        car.images[Number(button.dataset.gallery)];
      document.querySelectorAll("[data-gallery]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", b === button);
      });
    }),
  );
}
function contactFields() {
  return `<div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" required maxlength="100" placeholder="Your name"></div><div class="field"><label for="phone">Phone number <span class="optional">(optional)</span></label><input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="40" placeholder="+254"></div><div class="field span-2"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="200" placeholder="you@example.com"></div>`;
}
function consent() {
  return '<div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="check-field span-2"><input type="checkbox" name="consent" required><span>I agree to be contacted about my enquiry. Read the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.</span></label>';
}
function bindEnquiry(form, type, carId = "") {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector(".form-status");
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "Sending...";
    status.textContent = "";
    status.classList.remove("success");
    try {
      const body = {
        ...Object.fromEntries(new FormData(form)),
        type,
        carId,
        consent: form.elements.consent.checked,
      };
      delete body.photos;
      if (form.elements.photos)
        body.images = await Hub.images(form.elements.photos.files);
      const result = await api("/api/enquiries", {
        method: "POST",
        body: JSON.stringify(body),
      });
      form.reset();
      status.classList.add("success");
      status.textContent = `Thank you. Your enquiry has been received. Reference: ${result.id.slice(0, 8).toUpperCase()}.`;
      status.focus();
    } catch (error) {
      status.textContent =
        error.message || "Could not send your enquiry. Please try again.";
    } finally {
      button.disabled = false;
      button.innerHTML = original;
      Hub.icons();
    }
  });
}
function openEnquiry(id) {
  const car = cars.find((c) => c.id === id);
  const dialog = document.getElementById("enquiry-dialog");
  document.getElementById("enquiry-content").innerHTML =
    `<h2>Let's talk about this car.</h2><p>${esc(car.year + " " + nameOf(car))} &middot; ${money(car.price)}${car.demo ? " &middot; Sample listing" : ""}</p><form id="vehicle-enquiry"><div class="form-grid">${contactFields()}<div class="field span-2"><label for="message">Your message</label><textarea id="message" name="message" required maxlength="4000">I'd like to know more about this ${esc(nameOf(car))} and arrange a viewing.</textarea></div>${consent()}<button type="submit" class="button span-2">Send enquiry ${icon("arrow-up-right")}</button></div><div class="form-status" role="status" tabindex="-1"></div></form>`;
  bindEnquiry(document.getElementById("vehicle-enquiry"), "vehicle", id);
  Hub.icons();
  dialog.showModal();
}
function formPage(sell = false) {
  document.title = `${sell ? "Sell your car" : "Contact"} | Edwin's Auto Hub`;
  main.innerHTML = `<div class="container form-page"><section class="form-intro"><span class="eyebrow">${sell ? "MAKE ROOM FOR WHAT'S NEXT" : "GOOD CONVERSATIONS START HERE"}</span><h1>${sell ? "Your car has another chapter." : "Let's discuss your next move."}</h1><p>${sell ? "Tell us a little about your vehicle. We'll review the details and get in touch to discuss the possibilities." : "A question about a car, part, land or house? Something specific on your wish list? Reach out. We're here to talk it through."}</p>${sell ? `<div class="steps"><div class="step"><span class="step-number">01</span><div><h3>Tell us about your car</h3><p>Share the basics, your asking price, and a few clear photos.</p></div></div><div class="step"><span class="step-number">02</span><div><h3>Have a conversation</h3><p>We'll discuss the condition, history, and your expectations.</p></div></div><div class="step"><span class="step-number">03</span><div><h3>Agree on the next steps</h3><p>Arrange a viewing and discuss an approach that works for you.</p></div></div></div>` : `<div class="contact-options"><div class="contact-option">${icon("phone")}<div><strong>Give us a call</strong><a href="tel:+254708942431">+254 708 942 431</a></div></div><div class="contact-option">${icon("message-circle")}<div><strong>A quick chat?</strong><a href="https://wa.me/254708942431" target="_blank" rel="noopener">Find us on WhatsApp ${icon("arrow-up-right")}</a></div></div><div class="contact-option">${icon("mail")}<div><strong>Drop us a line</strong><a href="mailto:peter.njengakihoro@gmail.com">peter.njengakihoro@gmail.com</a></div></div><div class="contact-option">${icon("map-pin")}<div><strong>Nairobi, Kenya</strong><p>Viewings by appointment. Contact us for a meeting point.</p></div></div></div>`}</section><section class="form-panel"><h2>${sell ? "Tell us what you're driving." : "What's on your mind?"}</h2><p>${sell ? "Your details stay private. Submissions are reviewed before any listing is published." : "Leave your details and a message for Edwin."}</p><form id="public-form"><div class="form-grid">${contactFields()}${sell ? `<div class="field"><label for="make">Car make</label><input id="make" name="make" required maxlength="80" placeholder="e.g. Toyota"></div><div class="field"><label for="model">Model</label><input id="model" name="model" required maxlength="80" placeholder="e.g. Fielder"></div><div class="field"><label for="vehicle-year">Year of manufacture</label><input id="vehicle-year" name="year" type="number" required min="1950" max="${new Date().getFullYear() + 1}" placeholder="2019"></div><div class="field"><label for="mileage">Mileage (km)</label><input id="mileage" name="mileage" type="number" required min="0" max="2000000" placeholder="45000"></div><div class="field span-2"><label for="price">Your asking price (KSh)</label><input id="price" name="price" type="number" required min="1" max="1000000000" placeholder="1500000"></div><div class="field span-2"><label for="photos">Vehicle photos (optional)</label><div class="upload-box">${icon("image-plus")}<input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"></div><small>Up to 4 photos. JPG, PNG or WebP. 2 MB per photo.</small></div>` : ""}<div class="field span-2"><label for="message">${sell ? "Condition and other details" : "Your message"}</label><textarea id="message" name="message" required maxlength="4000" placeholder="${sell ? "Tell us about the condition, service history, and anything else we should know." : "Tell us how we can help."}"></textarea></div>${consent()}<button type="submit" class="button span-2">${sell ? "Submit your vehicle" : "Send message"} ${icon("arrow-up-right")}</button></div><div class="form-status" role="status" tabindex="-1"></div></form></section></div>`;
  bindEnquiry(
    document.getElementById("public-form"),
    sell ? "sell" : "contact",
  );
}
function about() {
  document.title = "Our story | Edwin's Auto Hub";
  main.innerHTML = `<section class="section container"><div class="story-heading"><span class="eyebrow">NAIROBI ROOTS. A PASSION FOR THE ROAD.</span><h1>Good cars.<br>Real conversations.</h1><p>Edwin's Auto Hub brings a personal approach to buying and selling cars, car parts, land, plots and houses in Kenya. It starts with understanding what you need, and taking the time to find the right next step.</p></div><img class="story-image" src="/images/bmw.jpg" alt="A silver BMW on an open stretch of road" width="1240" height="420"><div class="story-values"><div>${icon("messages-square")}<h3>People before paperwork.</h3><p>A first car, a family upgrade, or something just for you. We want to hear the story behind your search.</p></div><div>${icon("scan-search")}<h3>Room for every question.</h3><p>From the mileage to the maintenance history, ask what matters to you. Discuss inspection arrangements before deciding.</p></div><div>${icon("compass")}<h3>Your journey, your decision.</h3><p>Explore the options, arrange a viewing, and choose at your own pace. We're here to help you move forward.</p></div></div></section><section class="sell-band"><div class="container"><div><span class="eyebrow">LET'S GET STARTED</span><h2>The right car starts with a conversation.</h2></div><a class="button dark" href="/contact/">Meet your next move ${icon("arrow-up-right")}</a></div></section>`;
}
function privacy() {
  document.title = "Privacy | Edwin's Auto Hub";
  main.innerHTML = `<section class="section container prose"><span class="eyebrow">YOUR INFORMATION</span><h1>Privacy notice</h1><h2>What we collect</h2><p>When you send an enquiry, we collect the name, email, optional phone number, message, and listing information or photos you provide. Please do not upload identification documents or financial records.</p><h2>Why we collect it</h2><p>Your information is used to respond to your enquiry, discuss a listing, or review a car, part or property you wish to sell. Seller submissions are private and are not automatically published.</p><h2>Storage and access</h2><p>In this local preview, enquiries are stored on the computer running this website and are accessible through the password-protected admin dashboard. No automated email is sent. Hosting, retention, and any additional service providers will be confirmed before public launch.</p><h2>Saved listings and sessions</h2><p>Saved listing IDs are kept in your browser's local storage. Admin sign-in uses an essential session cookie. This website does not include advertising trackers or analytics.</p><h2>External services</h2><p>WhatsApp and email links open your chosen service, whose own privacy terms apply. Vehicle images supplied as external links are loaded from their source websites.</p><h2>Contact and deletion requests</h2><p>To request access, correction, or deletion of your enquiry, contact <a href="mailto:peter.njengakihoro@gmail.com">peter.njengakihoro@gmail.com</a> or call +254 708 942 431. A final retention policy will be established before launch.</p></section>`;
}
document.addEventListener("click", (event) => {
  const save = event.target.closest("[data-save]");
  if (save) {
    const id = save.dataset.save;
    saved = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    try {
      localStorage.setItem("edwin-saved", JSON.stringify(saved));
    } catch {
      Hub.toast("Saved for this visit. Browser storage is unavailable.");
    }
    updateSaved();
    if (location.pathname === "/saved") Catalogue.show("saved");
  }
  const tab = event.target.closest("[data-home-body]");
  if (tab) showFeatured(tab.dataset.homeBody);
  const enquiry = event.target.closest("[data-enquire]");
  if (enquiry) openEnquiry(enquiry.dataset.enquire);
  if (event.target.closest("[data-close-dialog]"))
    document.getElementById("enquiry-dialog").close();
  if (event.target.closest("[data-clear-filters]"))
    document.getElementById("reset-filters").click();
});
document.querySelector(".menu-toggle").addEventListener("click", (event) => {
  const open = document.getElementById("main-nav").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", open);
  event.currentTarget.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.getElementById("main-nav").classList.remove("open");
    document
      .querySelector(".menu-toggle")
      .setAttribute("aria-expanded", "false");
  }
});
document.addEventListener(
  "error",
  (event) => {
    if (event.target.tagName === "IMG") {
      event.target.classList.add("image-failed");
      event.target.alt = "Vehicle photo unavailable";
    }
  },
  true,
);
window.addEventListener("storage", (event) => {
  if (event.key === "edwin-saved") {
    try {
      const value = JSON.parse(event.newValue || "[]");
      saved = Array.isArray(value) ? value : [];
    } catch {
      saved = [];
    }
    updateSaved();
    if (location.pathname === "/saved") Catalogue.show("saved");
  }
});
document.getElementById("year").textContent = new Date().getFullYear();
async function init() {
  try {
    await Hub.loadBusiness();
  } catch {}
  const path = location.pathname;
  const section = path.startsWith("/cars")
    ? "cars"
    : path.startsWith("/sell")
      ? "sell"
      : path.startsWith("/contact")
        ? "contact"
        : path.startsWith("/about")
          ? "about"
          : path === "/" || path === "/index.html"
            ? "home"
            : "";
  document.querySelector(`[data-nav="${section}"]`)?.classList.add("active");
  document
    .querySelector(`[data-nav="${section}"]`)
    ?.setAttribute("aria-current", "page");
  refreshUI();
  const extraSection = path.startsWith("/parts")
    ? "parts"
    : path.startsWith("/properties")
      ? "properties"
      : "";
  if (extraSection) {
    const nav = document.querySelector(`[data-nav="${extraSection}"]`);
    nav?.classList.add("active");
    nav?.setAttribute("aria-current", "page");
  }
  if (section === "contact") formPage();
  else if (section === "sell") Catalogue.seller();
  else if (section === "about") about();
  else if (path === "/privacy") privacy();
  else {
    try {
      const route = {
        "/parts/": "parts",
        "/properties/": "properties",
        "/catalogue/": "all",
        "/listing/": "detail",
        "/saved": "saved",
      }[path];
      if (route) {
        await Catalogue.show(route);
        refreshUI();
        return;
      }
      cars = await api("/api/cars");
      if (path.includes("car-details")) detail();
      else if (section === "cars" || path === "/saved")
        catalogue(path === "/saved");
      else {
        home();
        Catalogue.homeSections();
      }
    } catch {
      main.innerHTML = `<section class="container section">${empty("We couldn't load the collection.", "Please try again. You can also call us on +254 708 942 431.", '<button class="button" id="retry">Try again</button>')}</section>`;
      document.getElementById("retry").addEventListener("click", init);
    }
  }
  refreshUI();
}
init();
