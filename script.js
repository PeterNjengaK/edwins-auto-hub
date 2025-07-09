// script.js
console.log("Welcome to Edwin's Auto Hub!");

// =============================
// 🧠 Dynamic Car Listings Loader
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const carGrid = document.getElementById("carGrid");

  function loadCars() {
    fetch("http://localhost:5000/api/cars")
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((cars) => {
        if (cars.length === 0) {
          carGrid.innerHTML = "<p>No cars available yet.</p>";
          return;
        }

        carGrid.innerHTML = cars.map(car => `
          <div class="car-card">
            <img src="${car.image}" alt="${car.name}">
            <h3>${car.name}</h3>
            <p><strong>Ksh:</strong> ${car.price}</p>
            <p><em>${car.condition}</em> • ${car.year} • ${car.mileage} km</p>
            <p>${car.description}</p>
          </div>
        `).join('');
      })
      .catch(err => {
        carGrid.innerHTML = "<p>⚠️ Failed to load cars. Please try again later.</p>";
        console.error("Error loading cars:", err);
      });
  }

  if (carGrid) {
    loadCars();

    // 🔁 Listen for admin updates (real-time refresh)
    const channel = new BroadcastChannel("carUpdates");
    channel.onmessage = (e) => {
      if (e.data === "refresh") {
        console.log("🔄 Refreshing car list due to admin update...");
        loadCars();
      }
    };
  }
});

// =============================
// ✅ Form Submission Handlers
// =============================

// Sell Your Car Form
const sellForm = document.getElementById("sellForm");
if (sellForm) {
  sellForm.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("sellMessage").textContent = "✅ Thanks! Your car has been submitted.";
    document.getElementById("sellMessage").style.display = "block";
    sellForm.reset();
  });
}

// Contact Form
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("contactMessage").textContent = "✅ Message sent! We’ll get back to you soon.";
    document.getElementById("contactMessage").style.display = "block";
    contactForm.reset();
  });
}
