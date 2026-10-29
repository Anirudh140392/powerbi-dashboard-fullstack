/**
 * Pivot ("Custom") view of a Report Studio report.
 *
 * The pivot summarises the same rows the Raw view shows. Every report field sits
 * in one area — Rows, Columns or Filters for dimensions, Values for KPIs — and
 * each KPI is aggregated over the rows that fall into a Row × Column cell.
 * Subtotals and grand totals aggregate the underlying rows, not the cells, so
 * an average total is the average of every row rather than of the cell averages.
 * Rows with no value for a dimension in the pivot are left out of it.
 * Weeks and periods follow the fiscal calendar (see fiscalCalendar.js).
 */
import dayjs from "dayjs";
import { FIELD_GROUPS } from "./reportStudioConfig";
import { formatPeriodBucket, formatWeekBucket, getFiscalPeriod, getFiscalWeek } from "./fiscalCalendar";
import { columnHeaderLabel, csvEscape, formatCellValue } from "./reportStudioUtils";

export const PIVOT_AREAS = [
    { id: "filters", label: "Filters" },
    { id: "columns", label: "Columns" },
    { id: "rows", label: "Rows" },
    { id: "values", label: "Values" },
];

export const AGGREGATIONS = { sum: "Sum", avg: "Avg", min: "Min", max: "Max", count: "Count" };

export const DATE_GRAINS = { day: "Day", week: "Week", period: "Period", month: "Month" };

export const VALUES_AXES = { columns: "Columns", rows: "Rows" };

/** The pivot is computed in the browser over all returned rows without limit. */
export const PIVOT_SOURCE_ROW_LIMIT = Infinity;

export const GRAND_TOTAL = "Grand Total";

// Separators for path keys; dimension values never contain these control characters.
const SEP = "\u0001";
const AXIS_SEP = "\u0002";

const isKpi = (field) => field.group === FIELD_GROUPS.KPI;

/** KPIs can only be summarised (Values); dimensions can only slice (Rows, Columns, Filters). */
export const canPlace = (field, area) => (area === "values") === isKpi(field);

const defaultArea = (field) => {
    if (isKpi(field)) return "values";
    return field.type === "date" ? "filters" : "rows";
};

/** Ratios and averages can't be summed across rows, so Sum is offered only for additive KPIs. */
export const aggregationOptions = (field) => Object.keys(AGGREGATIONS).filter((agg) => agg !== "sum" || field.additive);

export const getAggregation = (field, aggregations) => {
    const agg = aggregations[field.key];
    if (agg && aggregationOptions(field).includes(agg)) return agg;
    return field.additive ? "sum" : "avg";
};

export const valueLabel = (field, agg) => `${AGGREGATIONS[agg]} of ${field.label}`;

/**
 * Places every report field in exactly one area: where the user put it, else in
 * its default area (KPIs → Values, Date → Filters, other dimensions → Rows).
 * Returns the field keys of each area, in display order.
 */
export const resolvePivotLayout = (fields, areas) => {
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const layout = Object.fromEntries(
        PIVOT_AREAS.map(({ id }) => [id, (areas[id] || []).filter((k) => byKey.has(k) && canPlace(byKey.get(k), id))])
    );
    const placed = new Set(Object.values(layout).flat());
    fields.filter((f) => !placed.has(f.key)).forEach((f) => layout[defaultArea(f)].push(f.key));
    return layout;
};

// ── Dimension values ──

const bucketDate = (value, grain) => {
    if (grain === "month") return value.slice(0, 7);
    if (grain === "period") return getFiscalPeriod(value).id;
    if (grain === "week") return getFiscalWeek(value).id;
    return value;
};

/** A date bucket's first and last day (ISO), from any date inside it. */
const bucketSpan = (value, grain) => {
    if (grain === "month") {
        const start = `${value.slice(0, 7)}-01`;
        return [start, dayjs(start).endOf("month").format("YYYY-MM-DD")];
    }
    if (grain === "period") {
        const { start, end } = getFiscalPeriod(value);
        return [start, end];
    }
    if (grain === "week") {
        const { start, end } = getFiscalWeek(value);
        return [start, end];
    }
    return [value, value];
};

const isBlank = (value) => value === null || value === undefined || value === "";

/**
 * Reads a row's value for a dimension, or null when the row has none; dates are
 * bucketed to the chosen grain, and each bucket's span is recorded in `spans`.
 */
const makeReader = (field, grain, spans) => {
    if (field.type === "date") {
        const buckets = new Map();
        return (row) => {
            const value = row[field.key];
            let bucket = buckets.get(value);
            if (bucket === undefined) {
                bucket = isBlank(value) ? null : bucketDate(value, grain);
                buckets.set(value, bucket);
                if (bucket !== null && !spans.has(bucket)) spans.set(bucket, bucketSpan(value, grain));
            }
            return bucket;
        };
    }
    return (row) => {
        const value = row[field.key];
        return isBlank(value) ? null : String(value);
    };
};

export const formatDimensionValue = (field, value, grain) => {
    if (field.type !== "date") return value;
    if (grain === "month") return dayjs(`${value}-01`).format("MMM YYYY");
    if (grain === "period") return formatPeriodBucket(value);
    if (grain === "week") return formatWeekBucket(value);
    return dayjs(value).format("DD MMM YYYY");
};

const compareText = (a, b) => a.localeCompare(b, undefined, { numeric: true });

export const formatPivotValue = ({ field, agg }, value) => {
    if (agg !== "count") return formatCellValue(field, value);
    return value === null ? "—" : value.toLocaleString("en-IN");
};

/** Rates change in percentage points; everything else in percent. */
const changeUnit = ({ field, agg }) => (field.unit === "percent" && agg !== "count" ? "pp" : "pct");

export const formatChange = ({ value, unit }) => `${Math.abs(value).toFixed(1)}${unit === "pp" ? " pp" : "%"}`;

/** "up" | "down" | "flat", and whether that direction is good for the KPI. */
export const changeDirection = ({ field }, { value }) => {
    if (Math.abs(value) < 0.05) return { dir: "flat", good: null };
    const dir = value > 0 ? "up" : "down";
    return { dir, good: (dir === "up") !== (field.better === "lower") };
};

const HEAT_HUE_RED = 0;
const HEAT_HUE_GREEN = 130;

/**
 * Heatmap colours for a cell, red (worst) → amber → green (best). KPIs with a
 * `target` are coloured against it everywhere; others by their position in
 * `range`, which callers pass only for leaf cells (totals would skew it).
 */
export const heatmapStyle = ({ field, agg }, value, range) => {
    if (value === null || value === undefined) return undefined;
    let t;
    if (field.target && agg !== "count") t = value >= field.target.good ? 1 : value >= field.target.warn ? 0.5 : 0;
    else if (range && range.max > range.min) t = (value - range.min) / (range.max - range.min);
    else return undefined;
    if (field.better === "lower") t = 1 - t;
    const hue = Math.round(HEAT_HUE_RED + t * (HEAT_HUE_GREEN - HEAT_HUE_RED));
    return { backgroundColor: `hsl(${hue}, 75%, 92%)`, color: `hsl(${hue}, 65%, 26%)` };
};

// ── Aggregation ──

const newAcc = () => ({ sum: 0, count: 0, min: Infinity, max: -Infinity });

const mergeAcc = (into, from) => {
    into.sum += from.sum;
    into.count += from.count;
    into.min = Math.min(into.min, from.min);
    into.max = Math.max(into.max, from.max);
};

const finalize = (acc, agg) => {
    if (!acc?.count) return null;
    if (agg === "sum") return acc.sum;
    if (agg === "avg") return acc.sum / acc.count;
    if (agg === "min") return acc.min;
    if (agg === "max") return acc.max;
    return acc.count;
};

// ── Axis trees ──

const buildTree = (paths, dims, labelOf) => {
    const root = { key: "", path: [], level: -1, parent: null, children: new Map() };
    for (const path of paths) {
        let node = root;
        path.forEach((value, level) => {
            let child = node.children.get(value);
            if (!child) {
                const childPath = path.slice(0, level + 1);
                child = {
                    key: childPath.join(SEP),
                    path: childPath,
                    value,
                    label: labelOf(dims[level], value),
                    level,
                    parent: node,
                    children: new Map(),
                };
                node.children.set(value, child);
            }
            node = child;
        });
    }
    return root;
};

/** Replaces each node's children map with an array ordered by `compare`. */
const sortTree = (node, compare) => {
    node.children = [...node.children.values()].sort(compare);
    node.children.forEach((child) => sortTree(child, compare));
    return node;
};

/** Leaf columns in display order, each group followed by its subtotal column. */
const flattenColumns = (node, subtotals, out = []) => {
    node.children.forEach((child) => {
        if (!child.children.length) {
            out.push({ type: "data", path: child.path });
            return;
        }
        flattenColumns(child, subtotals, out);
        if (subtotals) out.push({ type: "subtotal", path: child.path });
    });
    return out;
};

/**
 * A column's header text at one level of the column dimensions. A total column
 * is labelled at the level below its group (the grand total at the top level)
 * and is blank beneath that.
 */
const columnLabelAt = (col, level, format) => {
    const totalLevel = col.type === "grand" ? 0 : col.path.length;
    if (col.type === "data" || level < totalLevel) return format(level, col.path[level]);
    if (level > totalLevel) return "";
    return col.type === "grand" ? GRAND_TOTAL : "Total";
};

/**
 * One header row per column dimension. Adjacent columns of the same group merge
 * into one cell (`span` counts columns); total labels span down to the last
 * dimension row (`rowSpan`).
 */
const buildHeaderRows = (columns, dims, labelOf) =>
    dims.map((_, level) => {
        const cells = [];
        for (const col of columns) {
            const totalLevel = col.type === "grand" ? 0 : col.path.length;
            if (col.type !== "data" && level >= totalLevel) {
                if (level === totalLevel) {
                    const label = col.type === "grand" ? GRAND_TOTAL : "Total";
                    cells.push({ key: col.key, label, span: 1, rowSpan: dims.length - level, total: true });
                }
                continue;
            }
            const group = col.path.slice(0, level + 1).join(SEP);
            const last = cells[cells.length - 1];
            if (last?.group === group) last.span += 1;
            else cells.push({ key: `${level}${AXIS_SEP}${group}`, group, label: labelOf(dims[level], col.path[level]), span: 1, rowSpan: 1 });
        }
        return cells;
    });

const resolveSort = (sort, columns, values) => {
    if (sort?.by === "value") {
        const column = columns.find((c) => c.key === sort.column);
        const valueIndex = values.findIndex((v) => v.field.key === sort.value);
        if (column && valueIndex >= 0) return { ...sort, columnPath: column.path, valueIndex };
    }
    return { by: "label", dir: sort?.by === "label" ? sort.dir : "asc" };
};

/**
 * @param {object}   report  { totalRows, getRow(index), startDate?, endDate? (ISO) } from the report API
 * @param {object[]} fields  report fields the selected sources support
 * @param {object}   config  pivot configuration (see usePivotConfig)
 */
export const buildPivot = (report, fields, config) => {
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    const keys = resolvePivotLayout(fields, config.areas);
    const layout = {
        rows: keys.rows.map((k) => byKey[k]),
        columns: keys.columns.map((k) => byKey[k]),
        filters: keys.filters.map((k) => byKey[k]),
        values: keys.values.map((k) => {
            const field = byKey[k];
            const agg = getAggregation(field, config.aggregations);
            return { field, agg, label: valueLabel(field, agg) };
        }),
    };
    const sourceRows = report.totalRows;
    if (Number.isFinite(PIVOT_SOURCE_ROW_LIMIT) && sourceRows > PIVOT_SOURCE_ROW_LIMIT) {
        return { status: "too-large", layout, sourceRows };
    }

    const grain = config.dateGrain;
    const rowCount = layout.rows.length;
    const colCount = layout.columns.length;
    const dateSpans = new Map();
    const dims = [...layout.rows, ...layout.columns, ...layout.filters].map((field) => ({
        field,
        read: makeReader(field, grain, dateSpans),
        seen: new Set(),
        excluded: new Set(config.excluded[field.key] || []),
    }));

    const { currStart, currEnd, prevStart, prevEnd } = report.periods || {};
    const hasPeriods = Boolean(currStart && currEnd && prevStart && prevEnd);

    // Pass 1: one accumulator per distinct Row × Column path for current and previous period.
    const leaves = new Map();
    let matchedRows = 0;
    let currMatchedRows = 0;

    for (let i = 0; i < sourceRows; i += 1) {
        const row = report.getRow(i);
        const dimValues = dims.map((dim) => dim.read(row));
        // A row with no value for a pivot dimension is left out, so there's no blank group.
        if (dimValues.includes(null)) continue;
        let included = true;
        dims.forEach((dim, d) => {
            if (dim.excluded.has(dimValues[d])) included = false;
        });
        if (!included) continue;

        const rowDate = String(row.date || row.Date || row.DATE || "").slice(0, 10);
        const isCurrent = !hasPeriods || (rowDate >= currStart && rowDate <= currEnd);
        const isPrevious = hasPeriods && (rowDate >= prevStart && rowDate <= prevEnd);

        if (!isCurrent && !isPrevious) continue;

        if (isCurrent) {
            dims.forEach((dim, d) => dim.seen.add(dimValues[d]));
            currMatchedRows += 1;
        }
        matchedRows += 1;

        const rowPath = dimValues.slice(0, rowCount);
        const colPath = dimValues.slice(rowCount, rowCount + colCount);
        const id = rowPath.join(SEP) + AXIS_SEP + colPath.join(SEP);
        let leaf = leaves.get(id);
        if (!leaf) {
            leaf = {
                rowPath,
                colPath,
                accs: layout.values.map(newAcc),
                prevAccs: layout.values.map(newAcc),
                hasCurrent: false,
            };
            leaves.set(id, leaf);
        }
        if (isCurrent) leaf.hasCurrent = true;
        layout.values.forEach(({ field }, vi) => {
            const value = row[field.key];
            if (typeof value !== "number" || !Number.isFinite(value)) return;
            if (isCurrent) {
                const acc = leaf.accs[vi];
                acc.sum += value;
                acc.count += 1;
                if (value < acc.min) acc.min = value;
                if (value > acc.max) acc.max = value;
            }
            if (isPrevious) {
                const acc = leaf.prevAccs[vi];
                acc.sum += value;
                acc.count += 1;
                if (value < acc.min) acc.min = value;
                if (value > acc.max) acc.max = value;
            }
        });
    }

    // Pass 2: roll leaves up into every row-prefix × column-prefix (subtotals and totals).
    const cells = new Map();
    const prevCells = new Map();
    // When Date is on Rows, compare each current date row with the previous
    // period aggregated across dates, keyed by the remaining row dimensions.
    const dateRowIndexes = layout.rows
        .map((field, index) => (field.type === "date" ? index : -1))
        .filter((index) => index >= 0);
    const prevComparisonCells = new Map();
    const rowPaths = new Map();
    const colPaths = new Map();
    for (const leaf of leaves.values()) {
        if (!hasPeriods || leaf.hasCurrent) {
            rowPaths.set(leaf.rowPath.join(SEP), leaf.rowPath);
        }
        // Keep previous-only column members visible so the report can show
        // that they have no current value instead of silently dropping them.
        colPaths.set(leaf.colPath.join(SEP), leaf.colPath);
        for (let r = 0; r <= rowCount; r += 1) {
            const rowKey = leaf.rowPath.slice(0, r).join(SEP);
            for (let c = 0; c <= colCount; c += 1) {
                const key = rowKey + AXIS_SEP + leaf.colPath.slice(0, c).join(SEP);
                let accs = cells.get(key);
                if (!accs) {
                    accs = layout.values.map(newAcc);
                    cells.set(key, accs);
                }
                leaf.accs.forEach((acc, vi) => mergeAcc(accs[vi], acc));

                let prevAccs = prevCells.get(key);
                if (!prevAccs) {
                    prevAccs = layout.values.map(newAcc);
                    prevCells.set(key, prevAccs);
                }
                leaf.prevAccs.forEach((acc, vi) => mergeAcc(prevAccs[vi], acc));
            }
        }
        if (dateRowIndexes.length && leaf.prevAccs.some((acc) => acc.count)) {
            const comparisonRowPath = leaf.rowPath.filter((_, index) => !dateRowIndexes.includes(index));
            const key = comparisonRowPath.join(SEP) + AXIS_SEP + leaf.colPath.join(SEP);
            let accs = prevComparisonCells.get(key);
            if (!accs) {
                accs = layout.values.map(newAcc);
                prevComparisonCells.set(key, accs);
            }
            leaf.prevAccs.forEach((acc, vi) => mergeAcc(accs[vi], acc));
        }
    }
    const valueAt = (rowPath, colPath, vi) =>
        finalize(cells.get(rowPath.join(SEP) + AXIS_SEP + colPath.join(SEP))?.[vi], layout.values[vi].agg);

    const prevValueAt = (rowPath, colPath, vi) =>
        finalize(prevCells.get(rowPath.join(SEP) + AXIS_SEP + colPath.join(SEP))?.[vi], layout.values[vi].agg);

    const prevComparisonValueAt = (rowPath, colPath, vi) => {
        const comparisonRowPath = rowPath.filter((_, index) => !dateRowIndexes.includes(index));
        return finalize(
            prevComparisonCells.get(comparisonRowPath.join(SEP) + AXIS_SEP + colPath.join(SEP))?.[vi],
            layout.values[vi].agg
        );
    };

    // A week, period or month the report only partly covers says so, so its totals aren't misread.
    const { startDate: rangeStart, endDate: rangeEnd } = report;
    const labelOf = (field, value) => {
        const label = formatDimensionValue(field, value, grain);
        const span = field.type === "date" && dateSpans.get(value);
        if (!span || !rangeStart || !rangeEnd) return label;
        if (span[1] > rangeEnd) return `${label} (to ${dayjs(rangeEnd).format("DD MMM")})`;
        if (span[0] < rangeStart) return `${label} (from ${dayjs(rangeStart).format("DD MMM")})`;
        return label;
    };

    const byLabel = (a, b) => compareText(a.value, b.value);
    const colTree = sortTree(buildTree(colPaths.values(), layout.columns, labelOf), byLabel);
    const columns = colCount ? flattenColumns(colTree, config.subtotals) : [];
    if (!colCount || config.grandTotals) columns.push({ type: "grand", path: [] });

    // Track sequential previous column for when Date is in Columns
    const lastInGroup = new Map();
    columns.forEach((col) => {
        col.key = `${col.type}${AXIS_SEP}${col.path.join(SEP)}`;
        if (col.type !== "data") return;
        const group = col.path.slice(0, -1).join(SEP);
        col.prevPath = lastInGroup.get(group) || null;
        lastInGroup.set(group, col.path);
    });

    const hasDateInColumns = layout.columns.some((f) => f.type === "date");

    const changeAt = (rowPath, col, vi) => {
        const current = valueAt(rowPath, col.path, vi);
        if (current === null || current === undefined) return null;

        let previous = null;
        if (dateRowIndexes.length) {
            previous = prevComparisonValueAt(rowPath, col.path, vi);
        } else if (!hasDateInColumns) {
            // When Date is NOT in columns (e.g. Platform is in columns),
            // compare each column (Blinkit, Instamart, Zepto, Grand Total)
            // to ITS OWN value in the previous period!
            previous = prevValueAt(rowPath, col.path, vi);
        } else {
            // When Date IS in columns, compare to the preceding column in the group;
            // for the very first column in the group, compare to prevValueAt if available.
            if (col.prevPath) {
                previous = valueAt(rowPath, col.prevPath, vi);
            } else {
                previous = prevValueAt(rowPath, col.path, vi);
            }
        }

        if (previous === null || previous === undefined) return null;
        const unit = changeUnit(layout.values[vi]);
        if (unit === "pp") return { value: current - previous, unit };
        return previous === 0 ? null : { value: ((current - previous) / Math.abs(previous)) * 100, unit };
    };

    // The span of each value over leaf cells, for the heatmap.
    const valueRanges = layout.values.map(() => ({ min: Infinity, max: -Infinity }));
    for (const leaf of leaves.values()) {
        layout.values.forEach((v, vi) => {
            const value = finalize(leaf.accs[vi], v.agg);
            if (value === null) return;
            const range = valueRanges[vi];
            if (value < range.min) range.min = value;
            if (value > range.max) range.max = value;
        });
    }

    const sort = resolveSort(config.sort, columns, layout.values);
    let compareRows;
    if (sort.by === "value") {
        const metric = (node) => valueAt(node.path, sort.columnPath, sort.valueIndex);
        compareRows = (a, b) => {
            const x = metric(a);
            const y = metric(b);
            if (x === y) return byLabel(a, b);
            if (x === null) return 1;
            if (y === null) return -1;
            return sort.dir === "asc" ? x - y : y - x;
        };
    } else {
        compareRows = sort.dir === "desc" ? (a, b) => byLabel(b, a) : byLabel;
    }
    const rowTree = sortTree(buildTree(rowPaths.values(), layout.rows, labelOf), compareRows);

    const options = Object.fromEntries(
        dims.map(({ field, seen }) => [
            field.key,
            [...seen].sort(compareText).map((value) => ({ value, label: labelOf(field, value) })),
        ])
    );

    let status = "ready";
    if (!layout.values.length) status = "no-values";
    else if (!matchedRows) status = "filtered-out";

    return {
        status,
        layout,
        grain,
        valuesAxis: config.valuesAxis,
        heatmap: config.heatmap,
        compare: config.compare,
        canCompare: Boolean(layout.values.length > 0 && (hasPeriods || columns.some((col) => col.prevPath))),
        sourceRows: hasPeriods ? currMatchedRows : sourceRows,
        matchedRows: hasPeriods ? currMatchedRows : matchedRows,
        activeFilters: dims.filter((dim) => [...dim.excluded].some((v) => dim.seen.has(v))).length,
        options,
        rowTree,
        columns,
        headerRows: buildHeaderRows(columns, layout.columns, labelOf),
        sort,
        subtotals: config.subtotals,
        // Without row dimensions the grand total is the only row, so it always shows.
        showGrandRow: config.grandTotals || !rowCount,
        valueAt,
        changeAt,
        valueRanges,
    };
};

// ── CSV ──

const csvNumber = (value) => (value === null ? "" : Math.round(value * 100) / 100);

const csvValueLabel = ({ field, agg }) =>
    agg === "count" ? valueLabel(field, agg) : `${AGGREGATIONS[agg]} of ${columnHeaderLabel(field)}`;

/**
 * The pivot as CSV, in tabular form: one column per row dimension with labels
 * repeated on every row, so the file filters cleanly in a spreadsheet. With
 * values on rows, a Metric column names each line's KPI. "Change vs previous"
 * adds a change column after every comparable value. Like the raw export,
 * dimension values (ISO dates, period ids) and numbers are written unformatted.
 */
export const buildPivotCsv = (pivot) => {
    const { layout, columns, rowTree, valueAt, changeAt } = pivot;
    const onRows = pivot.valuesAxis === "rows";
    const rawLabel = (_, value) => value;

    // Output columns: every column × value (or × the line's value, on rows), each optionally followed by its change.
    const outputs = columns.flatMap((col) =>
        (onRows ? [null] : layout.values.map((_, vi) => vi)).flatMap((vi) =>
            pivot.compare ? [{ col, vi }, { col, vi, change: true }] : [{ col, vi }]
        )
    );
    const valueHeader = ({ vi, change }) => {
        if (onRows) return change ? "Change vs previous" : "";
        const v = layout.values[vi];
        return change ? `Change in ${v.field.label} (${changeUnit(v) === "pp" ? "pp" : "%"})` : csvValueLabel(v);
    };

    const rowWidth = Math.max(1, layout.rows.length);
    const labelWidth = rowWidth + (onRows ? 1 : 0);
    const pad = (labels) => [...labels, ...Array(rowWidth - labels.length).fill("")];

    const lines = layout.columns.map((dim, level) => [
        ...Array(labelWidth - 1).fill(""),
        dim.label,
        ...outputs.map(({ col }) => columnLabelAt(col, level, rawLabel)),
    ]);
    lines.push([...pad(layout.rows.map((f) => f.label)), ...(onRows ? ["Metric"] : []), ...outputs.map(valueHeader)]);

    const cells = (rowPath, lineVi) =>
        outputs.map(({ col, vi, change }) => {
            const index = vi ?? lineVi;
            if (layout.values[index].field.unavailable && layout.values[index].agg !== "count") return "NA";
            return csvNumber(change ? changeAt(rowPath, col, index)?.value ?? null : valueAt(rowPath, col.path, index));
        });
    const emit = (rowPath, labels) => {
        if (!onRows) lines.push([...pad(labels), ...cells(rowPath)]);
        else layout.values.forEach((v, vi) => lines.push([...pad(labels), v.field.label, ...cells(rowPath, vi)]));
    };

    const walk = (node) =>
        node.children.forEach((child) => {
            if (!child.children.length) {
                emit(child.path, child.path);
                return;
            }
            if (pivot.subtotals) emit(child.path, [...child.path, "Total"]);
            walk(child);
        });
    walk(rowTree);
    if (pivot.showGrandRow) emit([], [GRAND_TOTAL]);

    return `\uFEFF${lines.map((line) => line.map(csvEscape).join(",")).join("\r\n")}\r\n`;
};
