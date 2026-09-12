/* Shared formatting and request helpers keep public and admin views consistent. */
window.Hub = {
  business: null,
  businessText: new WeakMap(),
  async loadBusiness() {
    this.business = await this.api("/api/business");
    this.applyBusiness();
    return this.business;
  },
  applyBusiness() {
    const b = this.business;
    if (!b || document.body.classList.contains("admin-body")) return;
    const replacements = [
      ["Edwin's Auto Hub", b.name],
      ["+254 708 942 431", b.phone],
      ["+254 708 942431", b.phone],
      ["peter.njengakihoro@gmail.com", b.email],
      ["Nairobi, Kenya", b.location],
      ["Your next drive. A better beginning.", b.tagline],
      ["Viewings by appointment", b.hours],
    ];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (
        node.parentElement?.closest(
          "script,style,textarea,.car-card,.enquiry-item",
        )
      )
        continue;
      if (!this.businessText.has(node))
        this.businessText.set(node, node.textContent);
      let value = this.businessText.get(node);
      for (const [original, updated] of replacements)
        value = value.replaceAll(original, updated);
      if (node.textContent !== value) node.textContent = value;
    }
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      a.href = "tel:" + b.phone.replace(/[^+\d]/g, "");
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      a.href = "mailto:" + b.email;
    });
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach((a) => {
      const url = new URL(a.href);
      url.pathname = "/" + b.whatsapp;
      a.href = url.href;
    });
    document.querySelectorAll(".brand-wordmark").forEach((node) => {
      if (!node.dataset.originalBrand)
        node.dataset.originalBrand = node.innerHTML;
      if (b.name === "Edwin's Auto Hub")
        node.innerHTML = node.dataset.originalBrand;
      else node.textContent = b.name;
    });
  },
  escape(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  },
  money(value) {
    return `KSh ${new Intl.NumberFormat("en-KE").format(value)}`;
  },
  number(value) {
    return new Intl.NumberFormat("en-KE").format(value);
  },
  icon(name, extra = "") {
    return `<i data-lucide="${name}" ${extra}></i>`;
  },
  icons() {
    window.lucide?.createIcons({
      attrs: { "stroke-width": 1.7, "aria-hidden": "true" },
    });
  },
  async api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(
        data.message || "Unable to complete the request.",
      );
      error.status = response.status;
      throw error;
    }
    return data;
  },
  async images(files) {
    if (files.length > 4) throw new Error("Choose up to four photos.");
    return Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise((resolve, reject) => {
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > 2 * 1024 * 1024
            )
              return reject(
                new Error("Use JPG, PNG, or WebP photos, up to 2 MB each."),
              );
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () =>
              reject(
                new Error("Could not read that photo. Please choose it again."),
              );
            reader.readAsDataURL(file);
          }),
      ),
    );
  },
  toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 3500);
  },
};
