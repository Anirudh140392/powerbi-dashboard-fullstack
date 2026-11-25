import { DEFAULT_PIVOT_CONFIG } from "./usePivotConfig";
import { FISCAL_PERIODS } from "./fiscalCalendar";

/**
 * Templates users save from Report Studio (backend/src/services/reportTemplateService.js).
 * A saved template's `config` has the shape of a built-in template, plus its view,
 * brand scope and an optional relative date range, so both apply the same way.
 */

/** A saved template as the gallery and applyTemplate read it. */
export const toGalleryTemplate = (saved) => ({
    ...saved.config,
    id: saved.id,
    label: saved.name,
    description: saved.description,
    saved,
});

/** "Last 2 periods", "Last 28 days". */
export const describePeriod = (period) => {
    if (!period) return "";
    const plural = period.count === 1 ? "" : "s";
    return period.type === "fiscal_periods" ? `Last ${period.count} period${plural}` : `Last ${period.count} day${plural}`;
};

/** The current reporting period as a relative range a template can store, or null before dates load. */
export const currentPeriod = ({ fiscal, period, range }) => {
    if (fiscal) {
        const from = FISCAL_PERIODS.findIndex((p) => p.id === period.from);
        const to = FISCAL_PERIODS.findIndex((p) => p.id === period.to);
        return from >= 0 && to >= from ? { type: "fiscal_periods", count: to - from + 1 } : null;
    }
    return range ? { type: "last_days", count: range.end.diff(range.start, "day") + 1 } : null;
};

// The pivot settings a template records; `excluded` only when it was saved with filters.
const PIVOT_KEYS = ["areas", "aggregations", "dateGrain", "sort", "subtotals", "grandTotals", "valuesAxis", "heatmap", "compare"];

/** JSON with object keys sorted, so equal settings compare equal whatever order they were built in. */
const stable = (value) => JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v
);

const setupOf = ({ view, sources, columns, brandScope, pivot }, withFilters) => {
    const full = { ...DEFAULT_PIVOT_CONFIG, ...pivot };
    // A cleared filter leaves an empty list behind; it hides nothing.
    full.excluded = Object.fromEntries(Object.entries(full.excluded || {}).filter(([, values]) => values.length));
    const keys = withFilters ? [...PIVOT_KEYS, "excluded"] : PIVOT_KEYS;
    return stable({ view, sources, columns, brandScope, pivot: Object.fromEntries(keys.map((k) => [k, full[k] ?? null])) });
};

/** Whether the report on screen differs from the saved template it was applied from. */
export const isModifiedFrom = (template, current) => {
    const withFilters = Boolean(template.pivot?.excluded);
    return setupOf(template, withFilters) !== setupOf(current, withFilters);
};
