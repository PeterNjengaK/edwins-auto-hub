// admin/admin.js

const API_URL = "http://localhost:5000/api/cars";
const form = document.getElementById("addCarForm");
const carList = document.getElementById("carList");

// Load all cars
const loadCars = async () => {
  const res = await fetch(API_URL);
  const cars = await res.json();

  carList.innerHTML = cars.map(car => `
    <div class="car-item">
      <div>
        <strong>${car.name}</strong> - ${car.price}
      </div>
      <div>
        <button onclick="deleteCar(${car.id})">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
};

// Add new car
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const newCar = {
    name: form.name.value,
    price: form.price.value,
    image: form.image.value,
    link: form.link.value
  };

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newCar)
  });

  form.reset();
  loadCars();
});

// Delete a car
const deleteCar = async (id) => {
  await fetch(`${API_URL}/${id}`, { method: "DELETE" });
  loadCars();
};

loadCars();
