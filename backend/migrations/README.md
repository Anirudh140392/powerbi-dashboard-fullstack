# Watch Tower Performance Optimization - Database Migrations

## Overview

This directory contains SQL migration files to optimize Watch Tower dashboard performance by adding necessary database indexes.

## Performance Impact

**Expected Results:**
- Dashboard load time: **2-3 minutes → 5-15 seconds** ⚡
- Query execution: **10-50x faster**
- Database CPU usage: **Significant reduction**

## Migration Files

| File | Table | Impact | Description |
|------|-------|--------|-------------|
| `001_add_rbpdp_olap_indexes.sql` | `rb_pdp_olap` | 10-50x faster | Main data table indexes |
| `002_add_rbkw_indexes.sql` | `rb_kw` | 20-100x faster | SOS calculation indexes |
| `003_add_rbbrandms_indexes.sql` | `rb_brand_ms` | 10-30x faster | Market share indexes |
| `004_add_rcasku_indexes.sql` | `rca_sku_dim` | 10-20x faster | SKU dimension indexes |

## Indexes Created

### rb_pdp_olap (Main Data Table)
- `idx_rbpdp_date_platform` - Date and platform filtering
- `idx_rbpdp_brand_date` - Brand-specific queries
- `idx_rbpdp_location_date` - Location filtering
- `idx_rbpdp_category_date` - Category filtering
- `idx_rbpdp_product_platform_date` - SKU queries (By Skus page)
- `idx_rbpdp_comp_flag_date` - Promo calculations
- `idx_rbpdp_osa_calc` - Availability calculations
- `idx_rbpdp_webpid` - JOIN operations

### rb_kw (Keyword Search Table)
- `idx_rbkw_crawl_platform_brand` - Primary SOS queries
- `idx_rbkw_spons_flag_date` - Sponsored/organic filtering
- `idx_rbkw_location_date` - Location-based SOS
- `idx_rbkw_category_date` - Category-based SOS
- `idx_rbkw_platform` - Platform filtering

### rb_brand_ms (Market Share Table)
- `idx_brandms_created_platform_brand` - Primary market share queries
- `idx_brandms_category_date` - Category market share
- `idx_brandms_location_date` - Location market share
- `idx_brandms_platform` - Platform filtering

### rca_sku_dim (SKU Dimension Table)
- `idx_rcasku_platform_category` - Category overview
- `idx_rcasku_brandname` - Brand listing
- `idx_rcasku_location` - Location filtering
- `idx_rcasku_pf_cat_loc` - Combined filters

## Running Migrations

### Option 1: Automated Script (Recommended)

```bash
cd backend/migrations
./run_migrations.sh
```

The script will:
1. Prompt for database credentials
2. Show a confirmation dialog
3. Run all migrations in order
4. Display success/failure for each migration

### Option 2: Manual Execution

Run each SQL file manually in order:

```bash
# Update these with your database credentials
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="gcpl"
DB_USER="root"

# Run migrations
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" < 001_add_rbpdp_olap_indexes.sql
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" < 002_add_rbkw_indexes.sql
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" < 003_add_rbbrandms_indexes.sql
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" < 004_add_rcasku_indexes.sql
```

### Option 3: Using Database Client

1. Open your database client (MySQL Workbench, phpMyAdmin, etc.)
2. Connect to the `gcpl` database
3. Execute each SQL file in numerical order

## Important Considerations

### ⚠️  Before Running Migrations

1. **Timing**: Run during low-traffic hours (index creation locks tables briefly)
2. **Table Size**: Larger tables take longer to index (1-5 minutes per table)
3. **Backup**: Ensure you have a recent database backup
4. **Disk Space**: Indexes require additional disk space (~10-20% of table size)

### 🔒 Table Locking

Index creation will lock tables temporarily:
- **Small tables** (< 1M rows): 10-30 seconds
- **Medium tables** (1-10M rows): 1-3 minutes  
- **Large tables** (> 10M rows): 3-10 minutes

During this time, write operations will be queued (reads still work).

### ✅ Verification

After running migrations, verify indexes were created:

```sql
-- Check rb_pdp_olap indexes
SHOW INDEX FROM rb_pdp_olap;

-- Check rb_kw indexes
SHOW INDEX FROM rb_kw;

-- Check rb_brand_ms indexes
SHOW INDEX FROM rb_brand_ms;

-- Check rca_sku_dim indexes
SHOW INDEX FROM rca_sku_dim;
```

You should see multiple indexes per table listed.

## Testing Performance

### Before Metrics
1. Note current dashboard load time
2. Check database slow query log
3. Monitor CPU usage

### After Metrics
1. Load Watch Tower dashboard with filters
2. Expected load time: **5-15 seconds**
3. Check slow query log (should be empty)
4. Monitor CPU usage (should be lower)

## Rollback (If Needed)

If you need to remove the indexes:

```sql
-- rb_pdp_olap
DROP INDEX idx_rbpdp_date_platform ON rb_pdp_olap;
DROP INDEX idx_rbpdp_brand_date ON rb_pdp_olap;
DROP INDEX idx_rbpdp_location_date ON rb_pdp_olap;
DROP INDEX idx_rbpdp_category_date ON rb_pdp_olap;
DROP INDEX idx_rbpdp_product_platform_date ON rb_pdp_olap;
DROP INDEX idx_rbpdp_comp_flag_date ON rb_pdp_olap;
DROP INDEX idx_rbpdp_osa_calc ON rb_pdp_olap;
DROP INDEX idx_rbpdp_webpid ON rb_pdp_olap;

-- rb_kw
DROP INDEX idx_rbkw_crawl_platform_brand ON rb_kw;
DROP INDEX idx_rbkw_spons_flag_date ON rb_kw;
DROP INDEX idx_rbkw_location_date ON rb_kw;
DROP INDEX idx_rbkw_category_date ON rb_kw;
DROP INDEX idx_rbkw_platform ON rb_kw;

-- rb_brand_ms
DROP INDEX idx_brandms_created_platform_brand ON rb_brand_ms;
DROP INDEX idx_brandms_category_date ON rb_brand_ms;
DROP INDEX idx_brandms_location_date ON rb_brand_ms;
DROP INDEX idx_brandms_platform ON rb_brand_ms;

-- rca_sku_dim
DROP INDEX idx_rcasku_platform_category ON rca_sku_dim;
DROP INDEX idx_rcasku_brandname ON rca_sku_dim;
DROP INDEX idx_rcasku_location ON rca_sku_dim;
DROP INDEX idx_rcasku_pf_cat_loc ON rca_sku_dim;
```

## Troubleshooting

### Issue: Migration fails with "Index already exists"
**Solution**: The index was already created. This is safe to ignore or use `IF NOT EXISTS` clause.

### Issue: Table locked during peak hours
**Solution**: Wait for migration to complete or cancel and run during low-traffic hours.

### Issue: Out of disk space
**Solution**: Free up disk space before running migrations. Indexes require ~10-20% additional space.

### Issue: Slow migration process
**Solution**: This is normal for large tables. Be patient and don't interrupt the process.

## Support

If you encounter issues:
1. Check the MySQL error log
2. Verify database credentials
3. Ensure sufficient disk space
4. Contact database administrator if problems persist

## Next Steps

After running these migrations successfully:
- Monitor dashboard performance
- Check for any UI issues
- Verify all metrics display correctly
- Consider Phase 2 optimizations (if needed)
