import dayjs from "dayjs";
import { formatKpiValue } from "../../utils/formatters";
import { FIELD_GROUPS, FIELDS_BY_KEY, SOURCES_BY_ID, UNIT_SUFFIX } from "./reportStudioConfig";

/** Source ids a field can be read from. */
export const getFieldSources = (field) =>
    field.group === FIELD_GROUPS.KPI ? [field.source] : Object.keys(field.columns || {});

/**
 * A KPI is available when its source is selected; a dimension only when every
 * selected source has it (combined sources join on Date + shared dimensions).
 */
export const isFieldAvailable = (field, sources) => {
    if (!sources.length) return false;
    const fieldSources = getFieldSources(field);
    if (field.group === FIELD_GROUPS.KPI) return sources.includes(field.source);
    return sources.every((s) => fieldSources.includes(s));
};

/** Human-readable reason a field can't be used with the selected sources. */
export const getUnavailableReason = (field, sources) => {
    if (!sources.length) return "Select a data source first";
    if (field.group === FIELD_GROUPS.KPI) {
        return `Requires ${SOURCES_BY_ID[field.source].label}`;
    }
    const fieldSources = getFieldSources(field);
    const missing = sources.filter((s) => !fieldSources.includes(s)).map((s) => SOURCES_BY_ID[s].label);
    return `Not available in ${missing.join(", ")}`;
};

export const isFilterActive = (value) => value !== undefined && value !== "All";

export const validateConfig = ({ sources, columns }) => {
    const unsupported = columns
        .map((key) => FIELDS_BY_KEY[key])
        .filter((field) => field.group !== FIELD_GROUPS.REQUIRED && !isFieldAvailable(field, sources));
    const errors = [];
    if (!sources.length) errors.push("Select at least one data source.");
    if (unsupported.length) {
        errors.push(
            `${unsupported.length === 1 ? "1 column isn't" : `${unsupported.length} columns aren't`} supported by the selected sources.`
        );
    }
    return { isValid: errors.length === 0, errors, unsupported: unsupported.map((f) => f.key) };
};

/** Column letters as in a spreadsheet: A … Z, AA, AB … */
export const columnLetter = (index) => {
    let n = index + 1;
    let letters = "";
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
};

const UNIT_FORMAT_KEY = { currency: "spend", percent: "share", ratio: "roas" };

/** Preview formatting follows the app's KPI conventions (₹ K/Lacs/Cr, %, x). */
export const formatCellValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field.type === "date") return dayjs(value).format("DD MMM YYYY");
    if (field.group !== FIELD_GROUPS.KPI) return String(value);
    if (field.unit === "number") {
        return Math.abs(value) >= 1000 ? formatKpiValue(value, "count") : String(Math.round(value));
    }
    return formatKpiValue(value, UNIT_FORMAT_KEY[field.unit]);
};

/** Business-friendly header, with the unit spelled out for numeric columns. */
export const columnHeaderLabel = (field) =>
    UNIT_SUFFIX[field.unit] ? `${field.label} (${UNIT_SUFFIX[field.unit]})` : field.label;

export const csvEscape = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/**
 * Builds the CSV text for every row of the report. Values are written raw
 * (ISO dates, unformatted numbers) so the file stays machine-readable; the BOM
 * lets Excel detect UTF-8 for the ₹ in the headers.
 */
export const buildCsv = (fields, report) => {
    const lines = [fields.map((f) => csvEscape(columnHeaderLabel(f))).join(",")];
    for (let i = 0; i < report.totalRows; i += 1) {
        const row = report.getRow(i);
        lines.push(fields.map((f) => csvEscape(row[f.key])).join(","));
    }
    return `\uFEFF${lines.join("\r\n")}\r\n`;
};

export const buildFileName = (sources, start, end, { sample = false } = {}) => {
    const sourcePart = sources.join("-");
    const range = `${dayjs(start).format("YYYY-MM-DD")}_to_${dayjs(end).format("YYYY-MM-DD")}`;
    return `report_studio_${sourcePart}_${range}${sample ? "_sample" : ""}.csv`;
};
