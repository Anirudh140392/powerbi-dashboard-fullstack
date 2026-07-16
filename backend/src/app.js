// app.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import AllRoutes from "./routes.js";
import { connectDB } from "./config/db.js";
import { connectClickHouse, asyncStorageMiddleware } from "./config/clickhouse.js";
import redisClient from "./config/redis.js";
import cacheRoutes from "./routes/cache.js";
import authRoutes from "./routes/auth.js";
import { authMiddleware } from "./helper/authMiddleware.js";
import { platformPermissionMiddleware } from "./helper/permissionMiddleware.js";
import { initSocket } from "./config/socket.js";
import { ensureDeviceTokenColumn } from "./services/deviceService.js";
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

// CORS: allow credentials (cookies) from frontend origins
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);
        // Allow any origin in dev, or specific origins in production
        return callback(null, true);
    },
    credentials: true,  // Required for HTTP-only cookies
}));

// Cookie parser — reads device_token HTTP-only cookie
app.use(cookieParser());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

// AsyncLocalStorage middleware - wraps every request in a storage context
// This MUST be before any routes that use queryClickHouse
app.use(asyncStorageMiddleware);

// Auth request logger middleware
import fs from 'fs';
app.use("/api/auth/verify", (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                headers: req.headers,
                response: {
                    success: data.success,
                    error: data.error,
                    user: data.user ? {
                        email: data.user.email,
                        dbName: data.user.dbName,
                        dbLogoUrlLength: data.user.dbLogoUrl ? data.user.dbLogoUrl.length : 0,
                        role: data.user.role
                    } : null
                }
            };
            fs.appendFileSync('verify_requests.log', JSON.stringify(logEntry, null, 2) + "\n---\n");
        } catch (e) {
            console.error("Failed to write request log:", e.message);
        }
        return originalJson.apply(this, arguments);
    };
    next();
});

// Auth routes (PUBLIC - no JWT required)
app.use("/api/auth", authRoutes);


// MySQL connection disabled - using ClickHouse only
// connectDB()
//     .then(() => console.log("✅ MySQL DB Ready"))
//     .catch((err) => {
//         console.warn("⚠️  MySQL connection failed, continuing without MySQL:", err.message);
//     });

// Connect to ClickHouse (Primary database)
connectClickHouse()
    .then(async (connected) => {
        if (connected) {
            console.log("✅ ClickHouse DB Ready");
            // Ensure device_token column exists in tb_user
            await ensureDeviceTokenColumn();
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

// JWT Authentication middleware - protects all /api/* routes below this point
app.use("/api", authMiddleware);
app.use("/api", platformPermissionMiddleware);

// all Routes (PROTECTED - JWT required)
AllRoutes(app);


// Health endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
    console.log(`✅ Backend running on: http://localhost:${port}`);
});

// Initialize WebSocket server for real-time notifications
initSocket(server);

// Extend server timeout to 10 minutes (600,000ms) for large report downloads
server.timeout = 10 * 60 * 1000;
server.keepAliveTimeout = 10 * 60 * 1000;

export default app; // ESM export
// restart trigger 10
