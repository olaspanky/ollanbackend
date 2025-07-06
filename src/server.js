// backend/server.js
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: "./.env" }); // Adjust path for local .env file
}

const app = express();

// Connect to MongoDB only once
let isConnected = false;
const connectDB = async () => {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("MongoDB connected");
  }
};

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(upload.single("image")); // Apply multer globally for routes expecting a single image

// Routes
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/cart", require("./routes/cartRoute"));
app.use("/api/orders", require("./routes/orderRoute"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "Server error" });
});

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};

// Local dev support
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}