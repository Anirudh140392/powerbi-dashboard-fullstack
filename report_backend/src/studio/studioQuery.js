/**
 * Builds the Report Studio query: one row per Date + selected dimensions, with
 * the selected KPIs aggregated to that grain, for own brands only.
 *
 * Each selected source is aggregated on its own, then the sources are stacked
 * with UNION ALL and regrouped on the shared keys, so a key present in only
 * one source still gets a row. Text keys are compared as lower(trim()), which
 * keeps a stray capital from splitting a group.
 */
import { getTableColumns } from '../utils/schemaHelper.js';
import { LOCATION_TABLE, STUDIO_DIMENSIONS, STUDIO_SOURCES, UPPERCASE_WEB_PID_PLATFORMS } from './studioFields.js';
import { OWN_BRAND, STUDIO_KPIS } from './studioKpis.js';

const DATE_KEY = 'date';
const UNIT_SUFFIX = { currency: '₹', percent: '%', ratio: 'x' };
const NULL_FLOAT = 'CAST(NULL AS Nullable(Float64))';

export class StudioRequestError extends Error {}

class MissingColumnError extends Error {}

const ident = (name) => `\`${name.replace(/`/g, '``')}\``;
const keyAlias = (key) => `k_${key}`;
const kpiAlias = (key) => `v_${key}`;
const kindOf = (key) => STUDIO_KPIS[key].kind || 'plain';

/** Validates the request's sources, columns and dates against the registry. */
export function parseStudioRequest(query) {
    const list = (value) => [...new Set(String(value || '').split(',').map((s) => s.trim()).filter(Boolean))];
    const sources = list(query.sources);
    const columns = list(query.columns);
    const { startDate, endDate } = query;

    if (!sources.length) throw new StudioRequestError('Select at least one data source.');
    const badSource = sources.find((s) => !STUDIO_SOURCES[s]);
    if (badSource) throw new StudioRequestError(`Unknown source: ${badSource}`);
    const badColumn = columns.find((k) => k !== DATE_KEY && !STUDIO_DIMENSIONS[k] && !STUDIO_KPIS[k]);
    if (badColumn) throw new StudioRequestError(`Unknown column: ${badColumn}`);
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDate.test(startDate || '') || !isoDate.test(endDate || '')) {
        throw new StudioRequestError('startDate and endDate must be YYYY-MM-DD.');
    }

    // Date always leads; the rest keep the order the user arranged.
    const ordered = [DATE_KEY, ...columns.filter((k) => k !== DATE_KEY)];
    const [start, end] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
    return { sources, columns: ordered, startDate: start, endDate: end };
}

/** SQL fragments for one source table's columns; each throws MissingColumnError for a column the tenant lacks. */
function makeResolver(columns) {
    const name = (logical) => {
        const actual = columns.get(logical.toLowerCase());
        if (!actual) throw new MissingColumnError(logical);
        return actual;
    };
    const col = (logical) => `t.${ident(name(logical))}`;
    return {
        col,
        /** Numeric value of a column, whether it's stored as a number or a string. */
        num: (logical) => {
            const type = columns.types?.get(name(logical)) || '';
            return type.includes('String') ? `toFloat64OrNull(${col(logical)})` : `toFloat64(${col(logical)})`;
        },
        /** Normalised text key of a column. */
        text: (logical) => `lower(trim(toString(ifNull(${col(logical)}, ''))))`,
    };
}

/** Builds an SQL fragment, or null when it needs a column the tenant lacks. */
const attempt = (build) => {
    try {
        return build();
    } catch (error) {
        if (error instanceof MissingColumnError) return null;
        throw error;
    }
};

function dimensionSql(sourceId, key, c, locationColumns) {
    const dim = STUDIO_DIMENSIONS[key];
    if (dim.lookup) {
        const lookup = dim.lookup[sourceId];
        if (!lookup || !['location', 'region'].every((col) => locationColumns?.has(col))) throw new MissingColumnError(key);
        c.text(lookup.city); // the join below needs the city column
        return `ifNull(loc.top_region, '')`;
    }
    const column = dim.columns[sourceId];
    if (!column) throw new MissingColumnError(key);
    return c.text(column);
}

/**
 * Resolves the request against the tenant's schema: which sources can be read,
 * the SQL for every key and KPI per source, and which fields are unavailable.
 */
async function planReport({ sources, columns }) {
    const dimKeys = columns.filter((k) => STUDIO_DIMENSIONS[k]);
    const kpiKeys = columns.filter((k) => STUDIO_KPIS[k]);

    const [schemas, locationColumns] = await Promise.all([
        Promise.all(sources.map((id) => getTableColumns(STUDIO_SOURCES[id].table))),
        dimKeys.includes('region') ? getTableColumns(LOCATION_TABLE) : null,
    ]);

    const sourcePlans = [];
    sources.forEach((id, i) => {
        if (!schemas[i].size) return; // table missing for this tenant
        const c = makeResolver(schemas[i]);
        const dateCol = attempt(() => c.col(STUDIO_SOURCES[id].date));
        const own = OWN_BRAND[id] || {};
        const filter = own.filter ? attempt(() => own.filter(c)) : '';
        const ownRows = own.ownRows ? attempt(() => own.ownRows(c)) : '';
        // Without its date or own-brand column a source can't be reported on.
        if (!dateCol || filter === null || ownRows === null) return;

        const dims = Object.fromEntries(dimKeys.map((k) => [k, attempt(() => dimensionSql(id, k, c, locationColumns))]));
        const kpis = Object.fromEntries(
            kpiKeys
                .filter((k) => STUDIO_KPIS[k].source === id && STUDIO_KPIS[k].sql)
                .map((k) => [k, attempt(() => STUDIO_KPIS[k].sql(c))])
                .filter(([, sql]) => sql)
        );
        sourcePlans.push({ id, c, dateCol, filter, ownRows, dims, kpis });
    });

    // A dimension must come from every readable source; a KPI from its own.
    const unavailable = new Set([
        ...dimKeys.filter((k) => !sourcePlans.length || sourcePlans.some((p) => !p.dims[k])),
        ...kpiKeys.filter((k) => !sourcePlans.some((p) => p.kpis[k])),
    ]);
    return { sourcePlans, kpiKeys, unavailable, keyDims: dimKeys.filter((k) => !unavailable.has(k)) };
}

/** The aggregated subquery for one source: keys k_*, and KPI values v_* (null for other sources' KPIs). */
function sourceSubquery(plan, { keyDims, kpiKeys }) {
    const { c } = plan;
    const keyNames = [keyAlias(DATE_KEY), ...keyDims.map(keyAlias)];
    const kpis = kpiKeys.filter((k) => plan.kpis[k]);

    const innerSelect = [`toDate(${plan.dateCol}) AS ${keyAlias(DATE_KEY)}`, ...keyDims.map((k) => `${plan.dims[k]} AS ${keyAlias(k)}`)];
    for (const k of kpis) {
        const sql = plan.kpis[k];
        if (kindOf(k) === 'plain') innerSelect.push(`${sql} AS ${kpiAlias(k)}`);
        if (sql.num) innerSelect.push(`${sql.num} AS n_${k}`);
        if (sql.den) innerSelect.push(`${sql.den} AS d_${k}`);
    }
    if (plan.ownRows) innerSelect.push(`${plan.ownRows} AS own_rows`);

    let region = '';
    if (keyDims.includes('region')) {
        // Each city counts in the region most of its dark stores are in.
        region = `LEFT JOIN (
                SELECT lower(trim(location)) AS city, topK(1)(lower(trim(region)))[1] AS top_region
                FROM ${LOCATION_TABLE}
                WHERE ifNull(region, '') != ''
                GROUP BY city
            ) AS loc ON loc.city = ${c.text(STUDIO_DIMENSIONS.region.lookup[plan.id].city)}`;
    }

    const where = [`${plan.dateCol} >= {startDate:Date}`, `${plan.dateCol} < {endDate:Date} + 1`, plan.filter].filter(Boolean);
    const inner = `SELECT ${innerSelect.join(', ')}
            FROM ${STUDIO_SOURCES[plan.id].table} AS t
            ${region}
            WHERE ${where.join(' AND ')}
            GROUP BY ${keyNames.join(', ')}`;

    // Share and context KPIs sum their denominator across the item dimensions
    // (brand, product, Web PID), so a brand's share is of the whole.
    const contextKeys = [keyAlias(DATE_KEY), ...keyDims.filter((k) => !STUDIO_DIMENSIONS[k].item).map(keyAlias)];
    const contextDen = (k) => `sum(d_${k}) OVER (PARTITION BY ${contextKeys.join(', ')})`;
    // Every source lists all KPIs in request order: UNION ALL matches columns by position.
    const values = kpiKeys.map((k) => {
        if (!plan.kpis[k]) return `${NULL_FLOAT} AS ${kpiAlias(k)}`;
        if (kindOf(k) === 'share') return `n_${k} / nullIf(${contextDen(k)}, 0) * 100 AS ${kpiAlias(k)}`;
        if (kindOf(k) === 'context') return `${contextDen(k)} AS ${kpiAlias(k)}`;
        return kpiAlias(k);
    });
    const outer = `SELECT ${[...keyNames, ...values].join(', ')}${plan.ownRows ? ', own_rows' : ''} FROM (${inner})`;

    // Grouped by an item dimension, competitor rows were only kept for the denominators.
    const byItem = keyDims.some((k) => STUDIO_DIMENSIONS[k].item);
    if (!plan.ownRows) return outer;
    return `SELECT * EXCEPT (own_rows) FROM (${outer})${byItem ? ' WHERE own_rows > 0' : ''}`;
}

/** Final display expression for a dimension key. */
function displayExpr(key, keyDims) {
    const col = keyAlias(key);
    const { display } = STUDIO_DIMENSIONS[key];
    if (display === 'initcap') return `initcap(${col})`;
    if (display === 'web_pid' && keyDims.includes('platform')) {
        const list = UPPERCASE_WEB_PID_PLATFORMS.map((p) => `'${p}'`).join(', ');
        return `if(multiSearchAny(${keyAlias('platform')}, [${list}]), upper(${col}), ${col})`;
    }
    return col;
}

/** CSV header: business label, with the unit for numeric columns. */
const csvHeader = (key) => {
    if (key === DATE_KEY) return 'Date';
    const field = STUDIO_DIMENSIONS[key] || STUDIO_KPIS[key];
    const suffix = UNIT_SUFFIX[field.unit];
    return suffix ? `${field.label} (${suffix})` : field.label;
};

/**
 * Builds the report SQL, ordered by its keys. With `csv`, columns carry their
 * business headers, KPIs are rounded to 2 places and unavailable ones read NA.
 * @returns {Promise<{ sql: string|null, params: object, unavailable: string[] }>}
 *   sql is null when none of the selected sources exists for this tenant.
 */
export async function buildStudioQuery(request, { csv = false } = {}) {
    const plan = await planReport(request);
    const { sourcePlans, keyDims, kpiKeys, unavailable } = plan;
    const params = { startDate: request.startDate, endDate: request.endDate };
    if (!sourcePlans.length) return { sql: null, params, unavailable: [...unavailable] };

    const keyNames = [keyAlias(DATE_KEY), ...keyDims.map(keyAlias)];
    const subqueries = sourcePlans.map((p) => sourceSubquery(p, plan));
    const combined = subqueries.length === 1
        ? subqueries[0]
        : `SELECT ${[...keyNames, ...kpiKeys.map((k) => `max(${kpiAlias(k)}) AS ${kpiAlias(k)}`)].join(', ')}
            FROM (${subqueries.join('\nUNION ALL\n')})
            GROUP BY ${keyNames.join(', ')}`;

    const select = request.columns.map((key) => {
        const as = `AS ${ident(csv ? csvHeader(key) : key)}`;
        if (key === DATE_KEY) return `${keyAlias(DATE_KEY)} ${as}`;
        if (unavailable.has(key)) return STUDIO_KPIS[key] && !csv ? `${NULL_FLOAT} ${as}` : `'NA' ${as}`;
        if (STUDIO_KPIS[key]) return csv ? `round(${kpiAlias(key)}, 2) ${as}` : `${kpiAlias(key)} ${as}`;
        return `${displayExpr(key, keyDims)} ${as}`;
    });

    const sql = `SELECT ${select.join(', ')}
        FROM (${combined})
        ORDER BY ${keyNames.join(', ')}`;
    return { sql, params, unavailable: [...unavailable] };
}
