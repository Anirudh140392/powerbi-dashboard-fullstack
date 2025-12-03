// app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import AllRoutes from "./routes.js";
import { connectDB } from "./config/db.js";


// create app or middleware
const app = express();
app.use(cors());
app.use(express.json());


// 🚫 Disable caching for API responses
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});


// Connect to DB via Sequelize
connectDB().then(() => console.log("✅ DB Ready")).catch(console.error);
// all Routes
AllRoutes(app);


// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`✅ Backend running on: http://localhost:${port}`);
});

export default app; // ESM export
