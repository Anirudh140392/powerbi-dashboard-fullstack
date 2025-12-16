#!/bin/bash

# =====================================================
# Database Index Migration Runner
# =====================================================
# This script applies all index migrations to optimize
# Watch Tower dashboard performance
#
# Usage: ./run_migrations.sh
# =====================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}Watch Tower Performance Optimization${NC}"
echo -e "${YELLOW}Database Index Migration${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo ""

# Database credentials (update these or use environment variables)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-gcpl}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS}"

if [ -z "$DB_PASS" ]; then
    echo -e "${YELLOW}Enter MySQL password:${NC}"
    read -s DB_PASS
    echo ""
fi

# Function to run a migration file
run_migration() {
    local file=$1
    local filename=$(basename "$file")
    
    echo -e "${YELLOW}Running migration: ${filename}${NC}"
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$file"; then
        echo -e "${GREEN}✓ ${filename} completed successfully${NC}"
        echo ""
    else
        echo -e "${RED}✗ ${filename} failed${NC}"
        exit 1
    fi
}

# Warning message
echo -e "${YELLOW}⚠️  CAUTION: ${NC}"
echo "This will add indexes to the database tables."
echo "Index creation may lock tables briefly (1-2 minutes per table)."
echo "Best to run during low-traffic hours."
echo ""
echo -e "${YELLOW}Do you want to continue? (yes/no):${NC} "
read -r response

if [ "$response" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${GREEN}Starting migrations...${NC}"
echo ""

# Run migrations in order
run_migration "migrations/001_add_rbpdp_olap_indexes.sql"
run_migration "migrations/002_add_rbkw_indexes.sql"
run_migration "migrations/003_add_rbbrandms_indexes.sql"
run_migration "migrations/004_add_rcasku_indexes.sql"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}All migrations completed successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo "Indexes created. Your Watch Tower dashboard should now be significantly faster."
echo "Expected improvement: 10-50x faster query execution"
echo ""
echo "To verify indexes were created, run:"
echo "  mysql> SHOW INDEX FROM rb_pdp_olap;"
echo "  mysql> SHOW INDEX FROM rb_kw;"
echo "  mysql> SHOW INDEX FROM rb_brand_ms;"
echo "  mysql> SHOW INDEX FROM rca_sku_dim;"
