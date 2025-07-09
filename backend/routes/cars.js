// routes/cars.js
const express = require("express");
const router = express.Router();

let cars = [];

// GET all cars
router.get("/", (req, res) => {
  res.json(cars);
});

// GET single car by ID
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const car = cars.find(c => c.id === id);

  if (car) {
    res.json(car);
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});

// POST new car
router.post("/", (req, res) => {
  const newCar = { id: Date.now(), ...req.body };
  cars.push(newCar);
  res.status(201).json(newCar);
});

// PUT update car
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = cars.findIndex(c => c.id === id);

  if (index !== -1) {
    cars[index] = { ...cars[index], ...req.body };
    res.json(cars[index]);
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});

// DELETE car
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const initialLength = cars.length;
  cars = cars.filter(c => c.id !== id);

  if (cars.length < initialLength) {
    res.json({ message: "Car deleted" });
  } else {
    res.status(404).json({ message: "Car not found" });
  }
});

module.exports = router;
