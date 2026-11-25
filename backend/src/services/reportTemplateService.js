// src/services/reportTemplateService.js
// Report Studio templates users save, stored in admin_master.tb_report_template.
//
// Same storage pattern as tb_report_schedule: one row per template in a
// ReplacingMergeTree, every change inserts the whole row again with a higher
// `version`, and reads use FINAL. `config` is the template in the shape of
// the built-in ones in frontend/src/components/ReportStudio/reportStudioConfig.js,
// so the frontend applies both the same way.
import crypto from 'crypto';
import { insertAdminDB, queryAdminDB } from '../config/adminClickhouse.js';
import { istNow } from '../utils/reportScheduleTiming.js';

const TABLE = 'tb_report_template';
const CONFIG_VERSION = 1;
const MAX_CONFIG_BYTES = 50 * 1024;
export const MAX_PRIVATE_PER_USER = 50;
export const MAX_SHARED_PER_WORKSPACE = 100;

const SOURCES = ['pdp', 'kw', 'ms', 'pm'];
const VISIBILITIES = ['private', 'workspace'];
const PIVOT_AREAS = ['filters', 'columns', 'rows', 'values'];
const AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count'];
const DATE_GRAINS = ['day', 'week', 'period', 'month'];
const PERIOD_TYPES = { fiscal_periods: 39, last_days: 366 }; // type → largest count
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,40}$/;

export class TemplateValidationError extends Error {}

let tableReady = null;

/** Creates the table on first use. */
export const ensureReportTemplateTable = () => {
    tableReady ??= queryAdminDB(`
        CREATE TABLE IF NOT EXISTS ${TABLE}
        (
            id               String,
            db_id            String,
            created_by       String,
            created_by_name  String,
            created_at       String,
            name             String,
            description      String,
            visibility       LowCardinality(String),
            config           String,
            config_version   UInt8,
            use_count        UInt32,
            last_used_at     String,
            status           LowCardinality(String),
            version          UInt64
        )
        ENGINE = ReplacingMergeTree(version)
        ORDER BY id
    `).catch((error) => {
        tableReady = null;
        throw error;
    });
    return tableReady;
};

const fail = (message) => {
    throw new TemplateValidationError(message);
};

const keyList = (value, max = 60) => (Array.isArray(value) ? [...new Set(value.map(String).filter((k) => KEY_PATTERN.test(k)))].slice(0, max) : []);

/** The pivot settings, with anything unknown dropped (the frontend fills gaps with its defaults). */
const parsePivot = (pivot, { includeFilters }) => {
    if (!pivot || typeof pivot !== 'object') return {};
    const out = {
        areas: Object.fromEntries(PIVOT_AREAS.map((area) => [area, keyList(pivot.areas?.[area])])),
        aggregations: Object.fromEntries(
            Object.entries(pivot.aggregations || {}).filter(([k, agg]) => KEY_PATTERN.test(k) && AGGREGATIONS.includes(agg))
        ),
    };
    if (DATE_GRAINS.includes(pivot.dateGrain)) out.dateGrain = pivot.dateGrain;
    ['subtotals', 'grandTotals', 'heatmap', 'compare'].forEach((option) => {
        if (typeof pivot[option] === 'boolean') out[option] = pivot[option];
    });
    if (['columns', 'rows'].includes(pivot.valuesAxis)) out.valuesAxis = pivot.valuesAxis;
    const { sort } = pivot;
    if (sort && ['value', 'label'].includes(sort.by) && ['asc', 'desc'].includes(sort.dir)) {
        out.sort = { by: sort.by, dir: sort.dir };
        if (sort.by === 'value') Object.assign(out.sort, { column: String(sort.column ?? ''), value: String(sort.value ?? '') });
    }
    // Hidden filter values are kept only when the user chose to include them.
    if (includeFilters && pivot.excluded && typeof pivot.excluded === 'object') {
        out.excluded = Object.fromEntries(
            Object.entries(pivot.excluded)
                .filter(([k, values]) => KEY_PATTERN.test(k) && Array.isArray(values) && values.length)
                .map(([k, values]) => [k, values.slice(0, 2000).map(String)])
        );
    }
    return out;
};

const parsePeriod = (period) => {
    if (!period) return null;
    const max = PERIOD_TYPES[period.type];
    const count = Number(period.count);
    if (!max || !Number.isInteger(count) || count < 1 || count > max) fail('The saved date range isn\'t valid.');
    return { type: period.type, count };
};

/**
 * Checks and normalises a create/update body: { name, description, visibility, config }.
 * `config` is { view, sources, columns, brandScope, pivot, period, includeFilters }.
 */
export const parseTemplateInput = (body) => {
    const name = String(body.name || '').trim();
    if (!name) fail('Give the template a name.');
    if (name.length > 80) fail('Keep the name under 80 characters.');
    const description = String(body.description || '').trim();
    if (description.length > 200) fail('Keep the description under 200 characters.');
    const visibility = VISIBILITIES.includes(body.visibility) ? body.visibility : 'private';

    const raw = body.config || {};
    const sources = Array.isArray(raw.sources) ? SOURCES.filter((s) => raw.sources.includes(s)) : [];
    if (!sources.length) fail('The template needs at least one data source.');
    const columns = keyList(raw.columns);
    if (!columns.length) fail('The template needs at least one column.');

    const config = {
        view: raw.view === 'custom' ? 'custom' : 'raw',
        sources,
        columns,
        brandScope: raw.brandScope === 'all' ? 'all' : 'own',
        pivot: parsePivot(raw.pivot, { includeFilters: Boolean(raw.includeFilters) }),
        period: parsePeriod(raw.period),
    };
    if (Buffer.byteLength(JSON.stringify(config)) > MAX_CONFIG_BYTES) fail('The template is too large to save. Clear some pivot filters and try again.');
    return { name, description, visibility, config };
};

const fromRow = (row) => ({
    ...row,
    config: JSON.parse(row.config || '{}'),
    config_version: Number(row.config_version),
    use_count: Number(row.use_count),
    version: Number(row.version),
});

const save = async (template) => {
    const row = {
        ...template,
        config: JSON.stringify(template.config),
        // Strictly increasing, so a change written in the same millisecond still wins.
        version: Math.max(Date.now(), Number(template.version || 0) + 1),
    };
    await insertAdminDB(TABLE, [row]);
    return { ...template, version: row.version };
};

/** The template as the API returns it. */
export const toClient = (template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    visibility: template.visibility,
    config: template.config,
    createdBy: template.created_by,
    createdByName: template.created_by_name,
    createdAt: template.created_at,
    useCount: template.use_count,
    lastUsedAt: template.last_used_at,
});

/** The user's own templates and the workspace's shared ones, most used first. */
export const listTemplates = async (dbId, email) => {
    await ensureReportTemplateTable();
    const rows = await queryAdminDB(
        `SELECT * FROM ${TABLE} FINAL
         WHERE db_id = {dbId:String} AND status = 'active' AND (visibility = 'workspace' OR created_by = {email:String})
         ORDER BY last_used_at DESC, name`,
        { dbId, email }
    );
    return rows.map(fromRow);
};

export const getTemplate = async (id) => {
    await ensureReportTemplateTable();
    const [row] = await queryAdminDB(`SELECT * FROM ${TABLE} FINAL WHERE id = {id:String} AND status = 'active' LIMIT 1`, { id });
    return row ? fromRow(row) : null;
};

/** Name clashes and the per-user / per-workspace limits, checked against the templates the user can see. */
const checkLimits = (existing, { name, visibility, created_by }, id = null) => {
    const others = existing.filter((t) => t.id !== id);
    const mine = others.filter((t) => t.created_by === created_by);
    if (mine.some((t) => t.name.toLowerCase() === name.toLowerCase())) fail(`You already have a template called "${name}".`);
    if (visibility === 'private' && mine.filter((t) => t.visibility === 'private').length >= MAX_PRIVATE_PER_USER) {
        fail(`You can keep up to ${MAX_PRIVATE_PER_USER} private templates. Delete one to save another.`);
    }
    if (visibility === 'workspace' && others.filter((t) => t.visibility === 'workspace').length >= MAX_SHARED_PER_WORKSPACE) {
        fail(`This workspace has ${MAX_SHARED_PER_WORKSPACE} shared templates, the most it can hold. Delete one to share another.`);
    }
};

export const createTemplate = async ({ user, dbId, body }) => {
    const input = parseTemplateInput(body);
    const createdBy = String(user.email || '').toLowerCase();
    checkLimits(await listTemplates(dbId, createdBy), { ...input, created_by: createdBy });
    return save({
        id: crypto.randomUUID(),
        db_id: dbId,
        created_by: createdBy,
        created_by_name: String(user.userName || ''),
        created_at: istNow().dateTime,
        ...input,
        config_version: CONFIG_VERSION,
        use_count: 0,
        last_used_at: '',
        status: 'active',
    });
};

/** Rename, re-describe, share/unshare, or overwrite the setup — whichever fields the body carries. */
export const updateTemplate = async (existing, body) => {
    const input = parseTemplateInput({
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        visibility: body.visibility ?? existing.visibility,
        // Without a new setup the saved one stays, filters and date range included.
        config: body.config ?? { ...existing.config, includeFilters: true },
    });
    checkLimits(await listTemplates(existing.db_id, existing.created_by), { ...input, created_by: existing.created_by }, existing.id);
    return save({ ...existing, ...input, config_version: CONFIG_VERSION });
};

export const deleteTemplate = (existing) => save({ ...existing, status: 'deleted' });

export const markTemplateUsed = (existing) => save({ ...existing, use_count: existing.use_count + 1, last_used_at: istNow().dateTime });
