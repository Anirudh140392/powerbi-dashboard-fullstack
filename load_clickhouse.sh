#!/bin/bash
# ClickHouse Data Loader for rb_kw table
# Loads all CSV data without skipping any rows or columns

CLICKHOUSE_HOST="localhost"
CLICKHOUSE_PORT="9000"
CLICKHOUSE_USER="default"
CLICKHOUSE_PASSWORD="12345678"
CLICKHOUSE_DB="GCPL"
TABLE="rb_kw"
CSV_FILE="/home/asus/Downloads/rb_kw 1/rb_kw.csv"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking file...${NC}"
if [ ! -f "$CSV_FILE" ]; then
    echo -e "${RED}❌ File not found: $CSV_FILE${NC}"
    exit 1
fi

TOTAL_ROWS=$(wc -l < "$CSV_FILE")
DATA_ROWS=$((TOTAL_ROWS - 1))
echo -e "${GREEN}📊 Total rows in file: $TOTAL_ROWS (header + $DATA_ROWS data rows)${NC}"

echo -e "\n${YELLOW}🔗 Testing ClickHouse connection...${NC}"
if ! clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --query="SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to ClickHouse${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

# Create database if not exists
clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --query="CREATE DATABASE IF NOT EXISTS $CLICKHOUSE_DB"

# Drop existing table
echo -e "${YELLOW}🗑️  Dropping existing table...${NC}"
clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --database="$CLICKHOUSE_DB" --query="DROP TABLE IF EXISTS $TABLE"

# Create table with all 44 columns matching CSV structure exactly
echo -e "${YELLOW}📋 Creating table with all 44 columns...${NC}"
clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --database="$CLICKHOUSE_DB" --query="
CREATE TABLE $TABLE (
    kw_data_id Nullable(String),
    crawl_id Nullable(String),
    kw_crawl_date Nullable(String),
    pf_id Nullable(String),
    platform_name Nullable(String),
    location_id Nullable(String),
    location_name Nullable(String),
    pincode Nullable(String),
    pincode_area Nullable(String),
    brand_id Nullable(String),
    brand_name Nullable(String),
    brand_name_th Nullable(String),
    brand_crawl Nullable(String),
    keyword_id Nullable(String),
    keyword Nullable(String),
    web_pid Nullable(String),
    keyword_type Nullable(String),
    keyword_search_rank Nullable(String),
    keyword_search_product_id Nullable(String),
    keyword_search_product Nullable(String),
    keyword_is_rb_product Nullable(String),
    keyword_is_rb_product_all Nullable(String),
    keyword_page_url Nullable(String),
    spons_flag Nullable(String),
    price_sp Nullable(String),
    pdp_discount_value Nullable(String),
    pdp_rating_value Nullable(String),
    content_score Nullable(String),
    osa_remark Nullable(String),
    LANGUAGE Nullable(String),
    created_on Nullable(String),
    created_by Nullable(String),
    modified_on Nullable(String),
    modified_by Nullable(String),
    WEEK Nullable(String),
    MONTH Nullable(String),
    QUARTER Nullable(String),
    YEAR Nullable(String),
    status Nullable(String),
    is_competitor_product Nullable(String),
    page Nullable(String),
    keyword_category Nullable(String),
    weightage Nullable(String),
    grammage Nullable(String)
) ENGINE = MergeTree()
ORDER BY tuple()
SETTINGS allow_nullable_key = 1
"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to create table${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Table created with 44 columns${NC}"

# Load data - CSV format with header
echo -e "${YELLOW}📦 Loading ALL data into ClickHouse...${NC}"
echo -e "${YELLOW}   This may take several minutes for 6.2M rows...${NC}"

clickhouse-client \
    --host="$CLICKHOUSE_HOST" \
    --port="$CLICKHOUSE_PORT" \
    --user="$CLICKHOUSE_USER" \
    --password="$CLICKHOUSE_PASSWORD" \
    --database="$CLICKHOUSE_DB" \
    --input_format_csv_skip_first_lines=1 \
    --format_csv_delimiter=',' \
    --input_format_csv_empty_as_default=1 \
    --format_csv_allow_single_quotes=0 \
    --format_csv_allow_double_quotes=1 \
    --query="INSERT INTO $TABLE FORMAT CSV" < "$CSV_FILE"

LOAD_STATUS=$?

if [ $LOAD_STATUS -ne 0 ]; then
    echo -e "${RED}❌ Load failed${NC}"
    echo "First 2 rows:"
    head -2 "$CSV_FILE"
    exit 1
fi

FINAL=$(clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --database="$CLICKHOUSE_DB" --query="SELECT count() FROM $TABLE")
echo -e "${GREEN}🎉 Done! Total rows loaded: $FINAL${NC}"

# Verify we got all rows
if [ "$FINAL" -eq "$DATA_ROWS" ]; then
    echo -e "${GREEN}✅ SUCCESS: All $DATA_ROWS data rows loaded!${NC}"
else
    DIFF=$((DATA_ROWS - FINAL))
    if [ $DIFF -lt 0 ]; then
        DIFF=$((FINAL - DATA_ROWS))
    fi
    echo -e "${YELLOW}⚠️  Loaded $FINAL rows (expected $DATA_ROWS, diff: $DIFF)${NC}"
fi

# Sample data to verify content
echo -e "\n${YELLOW}📊 Sample data with key columns:${NC}"
clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --database="$CLICKHOUSE_DB" --query="SELECT kw_crawl_date, platform_name, brand_name, keyword, keyword_is_rb_product FROM $TABLE LIMIT 5"

# Check date range
echo -e "\n${YELLOW}📊 Date Range in rb_kw:${NC}"
clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --database="$CLICKHOUSE_DB" --query="SELECT MIN(kw_crawl_date), MAX(kw_crawl_date), count() FROM $TABLE"

# Data statistics by platform
echo -e "\n${YELLOW}📊 Data by Platform:${NC}"
clickhouse-client --host="$CLICKHOUSE_HOST" --port="$CLICKHOUSE_PORT" --user="$CLICKHOUSE_USER" --password="$CLICKHOUSE_PASSWORD" --database="$CLICKHOUSE_DB" --query="SELECT platform_name, count() as rows, countIf(keyword_is_rb_product = '1') as rb_products FROM $TABLE GROUP BY platform_name ORDER BY rows DESC"

echo -e "\n${GREEN}✅ Load complete!${NC}"
