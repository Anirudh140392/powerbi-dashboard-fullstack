# ClickHouse Data Mapping Guide: Trailytics Ratings

This document outlines how ClickHouse tables and their specific columns are utilized across the various pages and sections of the Trailytics PowerBI Dashboard project.

---

## 1. Overview (Dashboard)
**Path:** `/frontend/src/components/Dashboard.tsx`
**Purpose:** High-level executive summary, metric cards, and trend lines.

### `ml_reviews`
*   **`rating`**, **`ml_inferred_rating`**: Averaged to display the overall User Rating and ML-Inferred Rating on the metric cards.
*   **`sentiment`**: Aggregated to calculate Total Positive, Negative, and Neutral review counts.
*   **`web_pid`**: Counted dynamically (DISTINCT) to show the "Unique Products" metric.
*   **`category`**: Used to count "Unique Categories".
*   **`review_date`**: Core axis for filtering and rendering timeline charts (Sentiment Trends, Volume Trends).
*   **`platform`**, **`brand`**: Used for global filtering across the page.

### `product_snapshots`
*   **`rating`**, **`rating_count`**: Used to calculate the weighted "Avg Platform Rating" and "Total PDP Ratings" metric cards.
*   **`price_rp`**, **`price_sp`**: Used by the Global Filter Bar to filter metrics by price bands (Selling Price vs Regular Price).
*   **`pareto_status`**: Used to filter dashboard metrics by high-performing (Pareto) vs NPD/Non-Pareto items.

### `products`
*   **`mrp`**, **`selling_price`**, **`mop`**: Act as fallback values when snapshot prices are missing.
*   **`category`**, **`pareto_status`**: Used to resolve missing categorization in snapshots.

---

## 2. Executive Insights (Issues)
**Path:** `/frontend/src/components/ExecutiveInsights.tsx`, `IssueDrilldownModal.tsx`, `AsinIssueModal.tsx`
**Purpose:** Actionable insights grouping negative reviews into specific, team-assigned issues.

### `ml_reviews`
*   **`specific_issue`**: The core column for this page. Used to group negative reviews into named issues (e.g., "Packaging Damage", "Battery Life").
*   **`sentiment`**: Filtered primarily for 'Negative' to surface these issues.
*   **`rating`**: Averages the impact of an issue (e.g., "This issue causes an average rating of 1.4").
*   **`review_text`**: Displayed inside the `IssueDrilldownModal` to provide qualitative proof to stakeholders.
*   **`brand`**, **`product_name`**, **`platform`**: Displayed to identify exactly which SKUs are impacted by the issue.

### `stakeholder_mappings`
*   **`sentiment_subcategory`**: Joined with `ml_reviews.specific_issue`.
*   **`stakeholder`**: Maps the issue to the responsible internal department (e.g., 'Logistics', 'QA', 'Marketing') so the UI can group issues by team in the Stakeholder Slider.

### `product_snapshots`
*   **`rating`**, **`rating_count`**: Establishes the baseline health of the SKUs affected by the issues.

---

## 3. Review Intelligence Explorer
**Path:** `/frontend/src/components/ReviewIntelligenceExplorer.tsx`, `ReviewList.tsx`
**Purpose:** Granular search, filtering, and tabular exploration of individual reviews.

### `ml_reviews`
*   **All Columns** (`review_title`, `review_text`, `rating`, `sentiment`, `specific_issue`, `category`, `material`, `wattage`, `is_verified_purchase`, `review_date`, `reviewer_name`, `quality_score`): Directly bound to the data grid for user exploration and CSV export.
*   **`platform`**, **`web_pid`**: Context columns for cross-referencing.

---

## 4. Competitor Intelligence
**Path:** `/frontend/src/components/CompetitorIntelligence.tsx`, `CompetitorRadarChart.tsx`
**Purpose:** Benchmarking own brand performance against market competitors.

### `ml_reviews`
*   **`brand`**: The primary grouping column. Compares "Own Brand" vs array of competitor brands.
*   **`sentiment`**, **`rating`**: Used to compare Share of Voice (review volume) and qualitative satisfaction against competitors.

### `product_snapshots`
*   **`is_competitor`**: Boolean flag (1/0) used to bifurcate the dataset into 'Us vs Them'.
*   **`price_sp`**, **`price_rp`**: Plotted on radar charts to compare our pricing strategy against competitor pricing.
*   **`rating`**: Platform official rating compared against competitor official ratings.

---

## 5. Category Health View
**Path:** `/frontend/src/components/CategoryHealthView.tsx`, `SegmentMatrixView.tsx`
**Purpose:** Macro-level performance analysis across different product categories.

### `ml_reviews`
*   **`category`** (Resolved): The primary GROUP BY axis for the page.
*   **`sentiment`**: Used to calculate the health score of the category.

### `product_snapshots`
*   **`price_sp`**: Used in the `SegmentMatrixView` to bucket products into Price Segments (e.g., Premium, Mid-Tier, Budget) within a given category.
*   **`rating`**, **`rating_count`**: Used to calculate the market saturation and platform health of the category.

---

## 6. Action Intelligence Hub (ML Automation & Audit)
**Path:** `/frontend/src/components/ActionIntelligenceHub.tsx`
**Purpose:** Pending audits, training set verification, and ML model configuration.

### `ml_reviews`
*   **`id`**, **`product_name`**, **`review_text`**, **`rating`**: Displayed to the human auditor to verify ML predictions.
*   **`sentiment`**, **`specific_issue`**, **`category`**, **`material`**, **`wattage`**: The actual ML-inferred values that the user is auditing, editing, and committing to the training set.

---

## 7. Raw Data Lake
**Path:** `/frontend/src/components/RawDataLake.tsx`
**Purpose:** Unrestricted access to backend data.

### `ml_reviews` & `product_snapshots`
*   **All Columns**: Exposed directly to the frontend table view, allowing data analysts to apply un-opinionated filters and extract raw CSV files.
