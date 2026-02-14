# Checking and Using Existing Database Indexes

## Quick Guide

You're absolutely right! If indexes already exist, we should **use them** instead of creating new ones.

## Step 1: Check What Indexes Exist

Run this command from your backend directory:

```bash
# Option 1: Save to file
mysql -h 15.207.197.27 -u your_username -p your_database_name < check_existing_indexes.sql > existing_indexes.txt

# Option 2: Interactive
mysql -h 15.207.197.27 -u your_username -p your_database_name
mysql> SHOW INDEX FROM rb_pdp_olap;
mysql> SHOW INDEX FROM rb_kw;
mysql> SHOW INDEX FROM rb_brand_ms;
```

## Step 2: Share the Results

Once you run the checks, share the output with me. I'll analyze:

1. **What indexes exist** on each table
2. **Which columns are indexed**
3. **Whether they're composite indexes** (multiple columns)
4. **If they're being used** by our current queries

## Step 3: Optimize Queries

Based on what indexes exist, I'll:

### If Indexes Exist ✅
- **Rewrite queries** to use the existing indexes
- **Reorder WHERE clauses** to match index column order
- **Add query hints** to force index usage if needed
- **Achieve the same performance** as new indexes!

### If No Indexes Exist ❌
- We're back to the DBA request
- The queries are already optimized
- Just need the indexes created

## Common Index Patterns

### Primary Keys (Always Indexed)
```sql
-- Every table has a primary key which is automatically indexed
id INT PRIMARY KEY  -- Auto-indexed
```

### Possible Existing Indexes
```sql
-- These might already exist:
DATE column  -- Very common for time-series data
Platform + DATE  -- Common composite index
Brand + DATE  -- Common composite index
```

## How to Use Existing Indexes

### Example: If `DATE` index exists

**Current Query:**
```sql
SELECT * FROM rb_pdp_olap
WHERE Platform = 'Zepto' AND DATE BETWEEN '2024-01-01' AND '2024-12-31'
```

**Optimized for DATE Index:**
```sql
SELECT * FROM rb_pdp_olap
WHERE DATE BETWEEN '2024-01-01' AND '2024-12-31'  -- Use DATE index first
AND Platform = 'Zepto'
```

### Example: If `Platform, DATE` composite index exists

**Perfect! Already optimized:**
```sql
SELECT * FROM rb_pdp_olap
WHERE Platform = 'Zepto'  -- Match composite index order
AND DATE BETWEEN '2024-01-01' AND '2024-12-31'
```

## Quick Check (You Can Run This)

Here's a simple query to check the most important table:

```sql
-- Check rb_pdp_olap indexes
SHOW INDEX FROM rb_pdp_olap;
```

**What to look for:**
- `Key_name`: Name of the index
- `Column_name`: Which column is indexed
- `Seq_in_index`: Position in composite index

**Example Output:**
```
Table        | Key_name  | Column_name | Seq_in_index
rb_pdp_olap  | PRIMARY   | id          | 1
rb_pdp_olap  | idx_date  | DATE        | 1
rb_pdp_olap  | idx_plat  | Platform    | 1
```

This means:
- ✅ `id` is indexed (primary key)
- ✅ `DATE` has an index
- ✅ `Platform` has an index

## Let's Find Out!

**Can you run one of these?**

1. **Quick check** (just rb_pdp_olap):
   ```sql
   SHOW INDEX FROM rb_pdp_olap;
   ```

2. **Full check** (all tables):
   ```bash
   mysql -h 15.207.197.27 -u your_username -p gcpl < check_existing_indexes.sql
   ```

Share the results and I'll immediately optimize your queries to use whatever indexes exist!

## Why This Matters

**If indexes exist:**
- 🚀 No DBA needed!
- 🚀 Immediate performance boost
- 🚀 Just rewrite queries to leverage them

**If no indexes exist:**
- Still need DBA for index creation
- But now we know for sure what's needed
