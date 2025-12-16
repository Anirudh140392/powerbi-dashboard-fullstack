#!/bin/bash

# =====================================================
# EMERGENCY: Fix Connection Pool Exhaustion
# =====================================================
# This script applies database indexes to fix the
# connection timeout errors you're experiencing
#
# Run this NOW to fix the performance issues
# =====================================================

set -e

echo "=========================================="
echo "EMERGENCY DATABASE FIX"
echo "=========================================="
echo ""
echo "This will add indexes to fix connection timeouts"
echo ""

# Database credentials from environment or use defaults
DB_HOST="${DB_HOST:-15.207.197.27}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-gcpl}"
DB_USER="${DB_USER:-trackgodrej}"

if [ -z "$DB_PASS" ]; then
    echo "Enter MySQL password for user '$DB_USER':"
    read -s DB_PASS
    echo ""
fi

echo "Connecting to: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Test connection first
echo "Testing database connection..."
if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1" > /dev/null 2>&1; then
    echo "✓ Connection successful"
    echo ""
else
    echo "✗ Connection failed. Please check credentials."
    exit 1
fi

echo "Creating indexes (this will take 2-5 minutes)..."
echo ""

# Run all migrations
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOF
-- rb_kw indexes (MOST CRITICAL - fixes SOS timeouts)
CREATE INDEX IF NOT EXISTS idx_rbkw_crawl_platform_brand ON rb_kw(kw_crawl_date, platform_name, brand_name);
CREATE INDEX IF NOT EXISTS idx_rbkw_spons_flag_date ON rb_kw(spons_flag, kw_crawl_date);

-- rb_pdp_olap indexes (fixes general queries)
CREATE INDEX IF NOT EXISTS idx_rbpdp_date_platform ON rb_pdp_olap(DATE, Platform);
CREATE INDEX IF NOT EXISTS idx_rbpdp_brand_date ON rb_pdp_olap(Brand, DATE);

-- rb_brand_ms indexes (fixes market share)
CREATE INDEX IF NOT EXISTS idx_brandms_created_platform_brand ON rb_brand_ms(created_on, Platform, brand);

SELECT 'Indexes created successfully!' AS status;
EOF

echo ""
echo "=========================================="
echo "✓ EMERGENCY FIX COMPLETE"
echo "=========================================="
echo ""
echo "The most critical indexes have been added."
echo "Your dashboard should now load much faster."
echo ""
echo "Please restart your backend server:"
echo "  Press Ctrl+C in the backend terminal"
echo "  Then run: npm run dev"
echo ""
