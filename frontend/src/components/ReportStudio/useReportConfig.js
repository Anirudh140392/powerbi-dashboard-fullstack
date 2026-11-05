import { useMemo, useReducer } from "react";
import { DEFAULT_CONFIG, FIELD_GROUPS, REPORT_FIELDS, REPORT_SOURCES } from "./reportStudioConfig";
import { isFieldAvailable, validateConfig } from "./reportStudioUtils";

// Required columns (Date) are pinned to the front and can't be removed or moved.
const REQUIRED_KEYS = REPORT_FIELDS.filter((f) => f.group === FIELD_GROUPS.REQUIRED).map((f) => f.key);
const SOURCE_ORDER = REPORT_SOURCES.map((s) => s.id);

export const reportConfigReducer = (state, action) => {
    switch (action.type) {
        case "toggleSource": {
            const next = state.sources.includes(action.id)
                ? state.sources.filter((id) => id !== action.id)
                : [...state.sources, action.id];
            return { ...state, sources: SOURCE_ORDER.filter((id) => next.includes(id)) };
        }
        case "toggleColumn": {
            if (REQUIRED_KEYS.includes(action.key)) return state;
            const columns = state.columns.includes(action.key)
                ? state.columns.filter((k) => k !== action.key)
                : [...state.columns, action.key];
            return { ...state, columns };
        }
        case "selectAll": {
            const available = REPORT_FIELDS
                .filter((f) => f.group !== FIELD_GROUPS.REQUIRED && isFieldAvailable(f, state.sources))
                .map((f) => f.key)
                .filter((k) => !state.columns.includes(k));
            return { ...state, columns: [...state.columns, ...available] };
        }
        case "clearOptional":
            return { ...state, columns: state.columns.filter((k) => REQUIRED_KEYS.includes(k)) };
        case "removeColumns":
            return { ...state, columns: state.columns.filter((k) => REQUIRED_KEYS.includes(k) || !action.keys.includes(k)) };
        case "moveColumn": {
            const from = state.columns.indexOf(action.key);
            const to = Math.min(Math.max(action.toIndex, REQUIRED_KEYS.length), state.columns.length - 1);
            if (from < 0 || from === to || REQUIRED_KEYS.includes(action.key)) return state;
            const columns = [...state.columns];
            columns.splice(from, 1);
            columns.splice(to, 0, action.key);
            return { ...state, columns };
        }
        case "setBrandScope":
            return { ...state, brandScope: action.scope };
        case "applyTemplate":
            return {
                // Saved templates carry their brand scope; built-in ones keep the current one.
                brandScope: action.template.brandScope || state.brandScope,
                sources: SOURCE_ORDER.filter((id) => action.template.sources.includes(id)),
                columns: [...REQUIRED_KEYS, ...action.template.columns.filter((k) => !REQUIRED_KEYS.includes(k))],
            };
        case "reset":
            return DEFAULT_CONFIG;
        default:
            return state;
    }
};

/** Report configuration state: selected sources, ordered columns and brand scope. */
export default function useReportConfig() {
    const [config, dispatch] = useReducer(reportConfigReducer, DEFAULT_CONFIG);

    const actions = useMemo(
        () => ({
            toggleSource: (id) => dispatch({ type: "toggleSource", id }),
            setBrandScope: (scope) => dispatch({ type: "setBrandScope", scope }),
            toggleColumn: (key) => dispatch({ type: "toggleColumn", key }),
            selectAll: () => dispatch({ type: "selectAll" }),
            clearOptional: () => dispatch({ type: "clearOptional" }),
            removeColumns: (keys) => dispatch({ type: "removeColumns", keys }),
            moveColumn: (key, toIndex) => dispatch({ type: "moveColumn", key, toIndex }),
            applyTemplate: (template) => dispatch({ type: "applyTemplate", template }),
            reset: () => dispatch({ type: "reset" }),
        }),
        []
    );

    const validation = useMemo(() => validateConfig(config), [config]);

    return { config, actions, validation };
}
