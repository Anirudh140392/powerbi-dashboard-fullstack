# Trailytics Backend Server

Backend API server for the Trailytics Dashboard application, built with Node.js, Express, and MySQL.

## 📋 Prerequisites

- **Node.js**: v16.x or higher
- **npm**: v8.x or higher
- **MySQL**: v8.x or higher
- **Redis**: v7.x or higher (for caching)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the backend root directory:

```env
# Database Configuration
DB_HOST=15.207.197.27
DB_PORT=3306
DB_USER=readonly_user
DB_PASSWORD=Readonly@123
DB_NAME=gcpl

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=true
REDIS_DEFAULT_TTL=1800

# Server Configuration
PORT=5000
```

### 3. Setup Redis (Required for Caching)

#### Install Redis Server

```bash
# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y
```

#### Start Redis Service

```bash
# Start Redis
sudo systemctl start redis-server

# Enable Redis to start on boot
sudo systemctl enable redis-server

# Check Redis status
sudo systemctl status redis-server
```

#### Verify Redis is Running

```bash
# Test Redis connection (should return "PONG")
redis-cli ping
```

### 4. Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

### 5. Verify Server is Running

You should see:
```
✅ Backend running on: http://localhost:5000
✅ Redis client connecting...
✅ Redis client ready
✅ Redis connection successful
✅ Connected to MySQL via Sequelize
✅ DB Ready
```

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with auto-reload (nodemon) |
| `npm start` | Start production server |
| `npm test` | Run tests (not configured yet) |

---

## 🗄️ Database

### Tables Used
- `rb_pdp_olap` - Performance data (sales, ad metrics, ROAS)
- `rb_kw_rank` - Keyword ranking data
- `rb_brand_ms` - Market share data
- `rca_sku_dim` - SKU dimension data
- `tb_zepto_brand_sales_analytics` - Zepto platform data
- `tb_blinkit_sales_data` - Blinkit platform data

### Connection
The application uses **Sequelize ORM** for database operations with automatic connection pooling.

---

## ⚡ Redis Caching

### Purpose
Redis caching is used to dramatically improve API response times for the Watch Tower dashboard.

### Performance Impact
- **Without Cache**: 2-5 seconds per request
- **With Cache**: 100-300ms per request (80-90% faster!)

### Cache Configuration

#### Enable/Disable Caching
```env
REDIS_ENABLED=true   # Enable caching
REDIS_ENABLED=false  # Disable caching
```

#### Adjust Cache Duration (TTL)
```env
# Default: 30 minutes (1800 seconds)
REDIS_DEFAULT_TTL=1800

# Examples:
REDIS_DEFAULT_TTL=900    # 15 minutes
REDIS_DEFAULT_TTL=3600   # 1 hour
REDIS_DEFAULT_TTL=7200   # 2 hours
```

### Cache Management API

#### Get Cache Statistics
```bash
curl http://localhost:5000/api/cache/stats
```

#### Clear All Cache
```bash
curl -X POST http://localhost:5000/api/cache/clear
```

#### Clear Specific Pattern
```bash
curl -X DELETE http://localhost:5000/api/cache/clear/summary
```

---

## 🔧 Redis Troubleshooting

### Issue: Redis Connection Refused

**Error:**
```
Redis Client Error: Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Check if Redis is running
sudo systemctl status redis-server

# If not running, start it
sudo systemctl start redis-server

# Test connection
redis-cli ping
```

### Issue: Redis Not Installed

**Solution:**
```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl start redis-server
```

### Issue: Stale Data in Cache

**Solution:**
```bash
# Clear all cache
curl -X POST http://localhost:5000/api/cache/clear

# Or restart backend server (clears all cache)
```

---

## 📚 API Documentation

### Swagger UI
Access interactive API documentation at:
```
http://localhost:5000/api-docs
```

### Main Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/watchtower` | GET | Get Watch Tower dashboard data |
| `/api/watchtower/summary-metrics` | GET | Get summary metrics |
| `/api/watchtower/trend` | GET | Get trend data |
| `/api/watchtower/brands` | GET | Get brands list |
| `/api/watchtower/platforms` | GET | Get platforms list |
| `/api/watchtower/locations` | GET | Get locations list |
| `/api/watchtower/categories` | GET | Get categories list |
| `/api/cache/stats` | GET | Get Redis cache statistics |
| `/api/cache/clear` | POST | Clear all cache |
| `/health` | GET | Health check endpoint |

---

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── app.js              # Main application entry point
│   ├── routes.js           # Route definitions
│   ├── config/
│   │   ├── db.js          # Database configuration
│   │   └── redis.js       # Redis client setup
│   ├── models/            # Sequelize models
│   ├── services/          # Business logic
│   │   └── watchTowerService.js
│   ├── routes/            # Route handlers
│   │   └── cache.js       # Cache management routes
│   ├── utils/             # Utility functions
│   │   └── cacheHelper.js # Redis caching helpers
│   └── helper/            # Helper modules
├── .env                   # Environment variables
├── package.json           # Dependencies
└── README.md             # This file
```

---

## 🔐 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | MySQL host address | - | ✅ |
| `DB_PORT` | MySQL port | 3306 | ✅ |
| `DB_USER` | MySQL username | - | ✅ |
| `DB_PASSWORD` | MySQL password | - | ✅ |
| `DB_NAME` | Database name | - | ✅ |
| `REDIS_HOST` | Redis host address | 127.0.0.1 | ❌ |
| `REDIS_PORT` | Redis port | 6379 | ❌ |
| `REDIS_PASSWORD` | Redis password | - | ❌ |
| `REDIS_DB` | Redis database number | 0 | ❌ |
| `REDIS_ENABLED` | Enable/disable caching | true | ❌ |
| `REDIS_DEFAULT_TTL` | Cache duration (seconds) | 1800 | ❌ |
| `PORT` | Server port | 5000 | ❌ |

---

## 🐛 Common Issues

### Port Already in Use
```bash
# Kill process on port 5000
sudo lsof -ti:5000 | xargs kill -9

# Or use a different port
PORT=5001 npm run dev
```

### Database Connection Failed
- Verify database credentials in `.env`
- Check if MySQL server is running
- Ensure network connectivity to database host

### Cannot Find Module Errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Performance Monitoring

### Cache Hit Rate
Monitor cache performance in server logs:
```
✅ Cache HIT: watchtower:summary:zepto:aer:agra   # Fast (cached)
❌ Cache MISS: watchtower:summary:blinkit:dove:delhi  # Slow (DB query)
```

**Target Hit Rate**: 70%+ after warm-up period

### Response Times
- Cache HIT: ~100-300ms
- Cache MISS: ~2-5 seconds

---

## 🚦 Health Check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok"
}
```

---

## 📝 Notes

- The application uses **ESM** (ES Modules) - all imports use `import` syntax
- **Nodemon** automatically restarts the server on code changes
- **Redis caching** is optional but highly recommended for production
- All API responses have caching disabled via headers (HTTP cache, not Redis)

---

## 📞 Support

For issues or questions, contact the development team.

---

## 🎯 Quick Checklist

- [ ] Node.js installed
- [ ] MySQL credentials configured in `.env`
- [ ] Redis server installed and running
- [ ] Dependencies installed (`npm install`)
- [ ] Server starts without errors (`npm run dev`)
- [ ] Redis connection successful (check logs)
- [ ] Database connection successful (check logs)
- [ ] Health endpoint responds (`curl localhost:5000/health`)

**Happy coding! 🚀**
