// backend/server.js
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 5000;

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // Allow larger JSON payloads for image uploads

// ✅ Routes
const carsRouter = require("./routes/cars");
app.use("/api/cars", carsRouter);

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚗 Edwin's backend server running at http://localhost:${PORT}`);
});
