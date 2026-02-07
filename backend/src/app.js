// app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import AllRoutes from "./routes.js";
import { connectDB } from "./config/db.js";
import { connectClickHouse } from "./config/clickhouse.js";
import redisClient from "./config/redis.js";
import cacheRoutes from "./routes/cache.js";
import "./models/associations.js";

// Set ENABLE_DEBUG_LOGS=true in .env to enable logs (default is suppressed in production)
if (process.env.ENABLE_DEBUG_LOGS == 'true') {
    // Store original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;

    // Override console.log to no-op (suppress output)
    console.log = function () { };

    // Keep console.warn but make it less verbose (optional)
    console.warn = function () { };

    // Suppress console.time and console.timeEnd (prevents timing label warnings)
    console.time = function () { };
    console.timeEnd = function () { };

    // Always keep console.error for debugging critical issues
    // console.error remains unchanged

    // Optional: Log once that debug mode is disabled
    console.error('[Performance Mode] Debug logging suppressed. Set ENABLE_DEBUG_LOGS=true to enable.');
}
// =========================================================================


// create app or middleware
const app = express();
app.use(cors());
app.use(express.json());

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Trailytics API",
            version: "1.0.0",
            description: "API documentation for Trailytics Dashboard",
        },
        servers: [
            {
                url: "http://3.7.138.75",
            },
        ],
    },
    apis: ["./src/routes/*.js"], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// 🚫 Disable caching for API responses
app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});


// MySQL connection disabled - using ClickHouse only
// connectDB()
//     .then(() => console.log("✅ MySQL DB Ready"))
//     .catch((err) => {
//         console.warn("⚠️  MySQL connection failed, continuing without MySQL:", err.message);
//     });

// Connect to ClickHouse (Primary database)
connectClickHouse()
    .then((connected) => {
        if (connected) {
            console.log("✅ ClickHouse DB Ready");
        }
    })
    .catch((err) => {
        console.warn("⚠️  ClickHouse connection failed:", err.message);
    });

// Connect to Redis
redisClient.connect()
    .then(async () => {
        console.log('✅ Redis connected');
        // Warm cache with common queries
        const { warmCommonCaches } = await import('./utils/cacheHelper.js');
        await warmCommonCaches();
    })
    .catch((err) => {
        console.error("⚠️  Redis connection failed, continuing without cache:", err.message);
    });

// Cache management routes
app.use("/api/cache", cacheRoutes);

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
// restart trigger 7
