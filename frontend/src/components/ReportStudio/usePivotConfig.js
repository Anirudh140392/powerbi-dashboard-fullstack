import { useMemo, useReducer } from "react";
import { FIELDS_BY_KEY } from "./reportStudioConfig";

export const DEFAULT_PIVOT_CONFIG = {
    // Field keys the user has placed, per area; unplaced fields go to their default area.
    areas: { filters: [], columns: [], rows: [], values: [] },
    aggregations: {},
    // Dimension values hidden by a filter, so values new to the data still show.
    excluded: {},
    dateGrain: "month",
    sort: null,
    subtotals: true,
    grandTotals: true,
};

export const pivotConfigReducer = (state, action) => {
    switch (action.type) {
        case "moveField": {
            // `layout` is the resolved layout on screen, so `index` matches what the user sees.
            const areas = Object.fromEntries(Object.entries(action.layout).map(([id, keys]) => [id, keys.filter((k) => k !== action.key)]));
            const target = areas[action.area];
            let index = action.index ?? target.length;
            const from = action.layout[action.area].indexOf(action.key);
            if (from >= 0 && from < index) index -= 1;
            target.splice(Math.min(Math.max(index, 0), target.length), 0, action.key);
            return { ...state, areas };
        }
        case "setAggregation":
            return { ...state, aggregations: { ...state.aggregations, [action.key]: action.agg } };
        case "setExcluded":
            return { ...state, excluded: { ...state.excluded, [action.key]: action.values } };
        case "clearFilters":
            return { ...state, excluded: {} };
        case "setDateGrain": {
            // Date filters name buckets of the previous grain, so they no longer apply.
            const excluded = Object.fromEntries(Object.entries(state.excluded).filter(([k]) => FIELDS_BY_KEY[k]?.type !== "date"));
            return { ...state, dateGrain: action.grain, excluded };
        }
        case "setSort":
            return { ...state, sort: action.sort };
        case "toggleOption":
            return { ...state, [action.option]: !state[action.option] };
        case "reset":
            return DEFAULT_PIVOT_CONFIG;
        default:
            return state;
    }
};

/** Custom (pivot) view configuration: field areas, aggregations, filters, sort and totals. */
export default function usePivotConfig() {
    const [pivotConfig, dispatch] = useReducer(pivotConfigReducer, DEFAULT_PIVOT_CONFIG);

    const pivotActions = useMemo(
        () => ({
            moveField: (layout, key, area, index) => dispatch({ type: "moveField", layout, key, area, index }),
            setAggregation: (key, agg) => dispatch({ type: "setAggregation", key, agg }),
            setExcluded: (key, values) => dispatch({ type: "setExcluded", key, values }),
            clearFilters: () => dispatch({ type: "clearFilters" }),
            setDateGrain: (grain) => dispatch({ type: "setDateGrain", grain }),
            setSort: (sort) => dispatch({ type: "setSort", sort }),
            toggleOption: (option) => dispatch({ type: "toggleOption", option }),
            reset: () => dispatch({ type: "reset" }),
        }),
        []
    );

    return { pivotConfig, pivotActions };
}
