
const path = require("path");
const dotenv = require("dotenv");

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");

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

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// Routes
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/cart", require("./routes/cartRoute"));
app.use("/api/orders", require("./routes/orderRoute"));// ... (add other routes here)

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
