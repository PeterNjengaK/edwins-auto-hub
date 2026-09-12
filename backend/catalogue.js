const categories = ["vehicle", "part", "land", "house"];
const kind = (item) => item.category || "vehicle";
const title = (item) =>
  kind(item) === "vehicle"
    ? `${item.year || ""} ${item.make || ""} ${item.model || ""}`.trim()
    : item.title;
const text = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
function validateProduct(body, existing, safeImage) {
  const category = body.category || existing.category;
  if (!categories.includes(category) || category === "vehicle")
    throw new Error("Choose a valid listing category.");
  if (existing.id && kind(existing) !== category)
    throw new Error("The category of an existing listing cannot be changed.");
  const item = {
    ...existing,
    category,
    title: text(body.title),
    description: text(body.description, 3000),
    location: text(body.location),
    publication: body.publication || existing.publication || "Published",
    status: body.status,
    featured: body.featured === true,
    demo: existing.demo === true,
    updatedAt: new Date().toISOString(),
  };
  if (!item.title) throw new Error("Listing title is required.");
  if (
    !["Draft", "Published", "Archived"].includes(item.publication) ||
    !["Available", "Reserved", "Sold"].includes(item.status)
  )
    throw new Error("Choose valid publication and availability states.");
  if (existing.saleId && category !== "part" && item.status !== "Sold")
    throw new Error("A sold property must remain Sold.");
  function numeric(key, min, max, integer = true) {
    const n = Number(body[key]);
    if (
      body[key] == null ||
      body[key] === "" ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (integer && !Number.isInteger(n))
    )
      throw new Error(`Enter a valid ${key}.`);
    item[key] = n;
  }
  numeric("price", 1, 1000000000);
  const images =
    body.images === undefined ? existing.images || [] : body.images;
  if (
    !Array.isArray(images) ||
    images.length > 4 ||
    (item.publication === "Published" && !images.length) ||
    !images.every(safeImage)
  )
    throw new Error(
      "Add up to four valid images; published listings need at least one.",
    );
  item.images = images;
  item.image = images[0] || "";
  item.features = Array.isArray(body.features)
    ? body.features
        .map((v) => text(v, 60))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  if (category === "part" || category === "house") {
    if (!["New", "Used"].includes(body.condition))
      throw new Error("Choose New or Used condition.");
    item.condition = body.condition;
  }
  if (category === "part") {
    for (const key of ["partNumber", "brand", "compatibility", "partType"])
      item[key] = text(body[key], key === "compatibility" ? 600 : 150);
    if (!item.partNumber || !item.compatibility || !item.partType)
      throw new Error("Add a part number, part type, and compatibility.");
    numeric("quantity", 0, 1000000);
    if (item.quantity === 0) item.status = "Sold";
    if (item.quantity > 0 && item.status === "Sold")
      throw new Error("Stock is above zero. Choose Available or Reserved.");
  } else {
    if (!item.location) throw new Error("Property location is required.");
    numeric("area", 0.01, 100000000, false);
    if (!["Acres", "Square metres"].includes(body.areaUnit))
      throw new Error("Choose an area unit.");
    item.areaUnit = body.areaUnit;
    if (!["Freehold", "Leasehold", "To be confirmed"].includes(body.tenure))
      throw new Error("Choose the tenure.");
    item.tenure = body.tenure;
    if (category === "land") {
      if (!["Land", "Plot"].includes(body.propertyType))
        throw new Error("Choose Land or Plot.");
      item.propertyType = body.propertyType;
    } else {
      if (
        !["House", "Apartment", "Bungalow", "Maisonette", "Townhouse"].includes(
          body.propertyType,
        )
      )
        throw new Error("Choose a house type.");
      item.propertyType = body.propertyType;
      numeric("bedrooms", 0, 100);
      numeric("bathrooms", 0, 100);
    }
  }
  return item;
}
module.exports = { categories, kind, title, validateProduct };
