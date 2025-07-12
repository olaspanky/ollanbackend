
// const path = require("path");
// const dotenv = require("dotenv");

// if (process.env.NODE_ENV !== "production") {
//   dotenv.config({ path: path.resolve(__dirname, "../.env") });
// }

// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const fs = require("fs");

// const app = express();

// // Connect to MongoDB only once
// let isConnected = false;
// const connectDB = async () => {
//   if (!isConnected) {
//     await mongoose.connect(process.env.MONGO_URI);
//     isConnected = true;
//     console.log("MongoDB connected");
//   }
// };

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



// // Routes
// app.use("/api/auth", require("./routes/authRoute"));
// app.use("/api/user", require("./routes/userRoute"));
// app.use("/api/products", require("./routes/productRoute"));
// app.use("/api/cart", require("./routes/cartRoute"));
// app.use("/api/orders", require("./routes/orderRoute"));// ... (add other routes here)

// module.exports = async (req, res) => {
//   await connectDB();
//   return app(req, res);
// };

// // Local dev support
// if (process.env.NODE_ENV !== "production") {
//   const PORT = process.env.PORT || 5000;
//   connectDB().then(() => {
//     app.listen(PORT, () => {
//       console.log(`Server running on http://localhost:${PORT}`);
//     });
//   });
// }

const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// MongoDB connection with singleton pattern
let isConnected = false;
const connectDB = async () => {
  if (!isConnected) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      isConnected = true;
      console.log("MongoDB connected");
    } catch (error) {
      console.error("MongoDB connection error:", error);
      // Don't exit in serverless environment
      if (!process.env.VERCEL) {
        process.exit(1);
      }
    }
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check routes
app.get("/", (req, res) => {
  res.json({ 
    message: "Pharmacy Marketplace API is running!",
    platform: process.env.VERCEL ? "Vercel" : "Fly.io",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    platform: process.env.VERCEL ? "Vercel" : "Fly.io",
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/cart", require("./routes/cartRoute"));
app.use("/api/orders", require("./routes/orderRoute"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// VERCEL: Export as serverless function
if (process.env.VERCEL) {
  module.exports = async (req, res) => {
    await connectDB();
    return app(req, res);
  };
} else {
  // FLY.IO: Start traditional server
  const PORT = process.env.PORT || 3000;
  
  const startServer = async () => {
    try {
      await connectDB();
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  };
  
  startServer();
}
