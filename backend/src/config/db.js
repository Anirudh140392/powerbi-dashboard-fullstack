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
      max: 200,       // Increased from 200 to handle burst of concurrent SOS queries
      min: 15,        // Minimum connections to keep available
      acquire: 280000, // 3 minutes - wait longer for connection instead of timing out
      idle: 60000,    // 1 minute idle timeout
      evict: 10000,   // Check for idle connections every 10000ms
      maxUses: 10000  // Recycle connections to prevent memory leaks
    },
    dialectOptions: {
      connectTimeout: 120000, // 2 minute for initial connection
      // MySQL2-specific settings
      socketPath: undefined,
      supportBigNumbers: true,
      bigNumberStrings: false,
      dateStrings: false,
      multipleStatements: true  // Enable for potential batch operations
      // Note: MySQL2 doesn't support statementCacheSize through Sequelize
    },
    query: {
      timeout: 60000  // 1 minute query timeout (increased for SOS queries on rb_kw)
    },
    retry: {
      max: 3, // Reduced retries to fail faster
      match: [
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /PROTOCOL_CONNECTION_LOST/,
        /ER_LOCK_WAIT_TIMEOUT/,
        /ER_LOCK_DEADLOCK/,
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
