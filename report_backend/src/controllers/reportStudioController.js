import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { queryClickHouse, streamClickHouse } from '../config/clickhouse.js';
import { buildStudioQuery, parseStudioRequest, StudioRequestError } from '../studio/studioQuery.js';
import { applyQcDateFilter } from '../helper/qcDateHelper.js';

/** The pivot summarises at most this many rows (PIVOT_SOURCE_ROW_LIMIT in the frontend). */
export const STUDIO_ROWS_LIMIT = null;
const MAX_PAGE_SIZE = 500;

// Counts come back as numbers rather than quoted strings, and blanks in a CSV as empty cells.
const SETTINGS = { output_format_json_quote_64bit_integers: 0 };
const CSV_SETTINGS = { ...SETTINGS, format_csv_null_representation: '' };

const handleError = (res, label, error) => {
    if (error instanceof StudioRequestError) return res.status(400).json({ error: error.message });
    console.error(`[ReportStudio] ${label} failed:`, error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to build the report' });
    else res.destroy(error);
};

/** The validated request; only QC users can report on today, everyone else up to yesterday. */
const parseRequest = (req) => applyQcDateFilter(parseStudioRequest(req.query), req);

const countRows = async (sql, params) => {
    const [row] = await queryClickHouse(`SELECT count() AS total FROM (${sql})`, params, SETTINGS);
    return Number(row?.total || 0);
};

/** GET /studio/preview — one page of the report. */
export const previewStudioReport = async (req, res) => {
    try {
        const request = parseRequest(req);
        const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), MAX_PAGE_SIZE);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const { sql, params, unavailable } = await buildStudioQuery(request);
        if (!sql) return res.json({ totalRows: 0, rows: [], page, pageSize, unavailable });

        const [totalRows, rows] = await Promise.all([
            countRows(sql, params),
            queryClickHouse(`${sql} LIMIT {limit:UInt32} OFFSET {offset:UInt64}`, { ...params, limit: pageSize, offset: (page - 1) * pageSize }, SETTINGS),
        ]);
        res.json({ totalRows, rows, page, pageSize, unavailable });
    } catch (error) {
        handleError(res, 'preview', error);
    }
};

/** GET /studio/rows — every row, for the pivot. */
export const getStudioRows = async (req, res) => {
    try {
        const request = parseRequest(req);
        const { sql, params, unavailable } = await buildStudioQuery(request);
        if (!sql) return res.json({ status: 'ok', totalRows: 0, rows: [], unavailable });

        const rows = await queryClickHouse(sql, params, SETTINGS);
        res.json({ status: 'ok', totalRows: rows.length, rows, unavailable });
    } catch (error) {
        handleError(res, 'rows', error);
    }
};

/** GET /studio/export — the whole report as CSV, streamed straight from ClickHouse. */
export const exportStudioReport = async (req, res) => {
    try {
        const request = parseRequest(req);
        const { sql, params } = await buildStudioQuery(request, { csv: true });
        if (!sql) return res.status(204).end();

        const stream = await streamClickHouse(sql, params, CSV_SETTINGS, 'CSVWithNames');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="report_studio_${request.sources.join('-')}_${request.startDate}_to_${request.endDate}.csv"`);
        // The BOM lets Excel read the ₹ in the headers as UTF-8.
        res.write('\uFEFF');
        const toText = new Transform({
            objectMode: true,
            transform(rows, _encoding, callback) {
                callback(null, rows.map((row) => `${row.text}\r\n`).join(''));
            },
        });
        await pipeline(stream, toText, res);
    } catch (error) {
        handleError(res, 'export', error);
    }
};
