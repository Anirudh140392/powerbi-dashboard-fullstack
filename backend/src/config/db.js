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
    pool: {
      max: 50,        // Increased from 10 to handle parallel SOS queries
      min: 5,         // Maintain minimum connections
      acquire: 120000, // Increased from 60s to 120s
      idle: 20000,    // increased idle timeout
      evict: 10000    // Check for idle connections every 10s
    },
    dialectOptions: {
      connectTimeout: 120000, // Increased from 60s to 120s
    },
    retry: {
      max: 3, // Retry failed queries up to 3 times
      match: [
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /PROTOCOL_CONNECTION_LOST/,
      ]
    }
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
