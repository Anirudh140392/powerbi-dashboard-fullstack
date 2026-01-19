// src/db.js
import { Sequelize } from "sequelize";


const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.DB_PORT || 3306,
    logging: false, // set true if you want SQL logs
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to MySQL via Sequelize");
  } catch (err) {
    console.error("❌ Unable to connect to the database:", err);
    throw err;
  }
};

export default sequelize;
