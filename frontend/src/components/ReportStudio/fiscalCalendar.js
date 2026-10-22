/**
 * Fiscal calendar for Report Studio: the Week and Period date grains and the
 * reporting-period picker.
 *
 * Periods are listed per fiscal year exactly as the client publishes them, so a
 * 53-week year or a 5-week period is a data change only. Weeks are counted from
 * the start of their period (W1 … W4). Dates outside the listed years fall back
 * to 28-day periods, 13 to a year, continuing from the nearest listed period.
 *
 * To add a year, append it to FISCAL_CALENDAR.years.
 */
import dayjs from "dayjs";

export const FISCAL_CALENDAR = {
    name: "Mars",
    years: {
        2026: [
            ["2025-12-28", "2026-01-24"],
            ["2026-01-25", "2026-02-21"],
            ["2026-02-22", "2026-03-21"],
            ["2026-03-22", "2026-04-18"],
            ["2026-04-19", "2026-05-16"],
            ["2026-05-17", "2026-06-13"],
            ["2026-06-14", "2026-07-11"],
            ["2026-07-12", "2026-08-08"],
            ["2026-08-09", "2026-09-05"],
            ["2026-09-06", "2026-10-03"],
            ["2026-10-04", "2026-10-31"],
            ["2026-11-01", "2026-11-28"],
            ["2026-11-29", "2026-12-26"],
        ],
    },
};

const PERIODS_PER_YEAR = 13;
const PERIOD_DAYS = 28;
const DAY_MS = 86400000;

// Whole-day arithmetic on ISO dates, free of time zones.
const toDay = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
const toIso = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const periodId = (year, period) => `${year}-P${String(period).padStart(2, "0")}`;

const makePeriod = (year, period, startDay, endDay) => ({
    id: periodId(year, period),
    year,
    period,
    start: toIso(startDay),
    end: toIso(endDay),
    startDay,
    endDay,
});

/** Every listed period, oldest first. */
export const FISCAL_PERIODS = Object.entries(FISCAL_CALENDAR.years)
    .flatMap(([year, periods]) => periods.map(([start, end], i) => makePeriod(Number(year), i + 1, toDay(start), toDay(end))))
    .sort((a, b) => a.startDay - b.startDay);

const PERIODS_BY_ID = new Map(FISCAL_PERIODS.map((p) => [p.id, p]));

/** A 28-day period `offset` periods away from a reference period starting on `refStart`. */
const extrapolate = (ref, refStart, offset) => {
    const index = ref.year * PERIODS_PER_YEAR + ref.period - 1 + offset;
    const year = Math.floor(index / PERIODS_PER_YEAR);
    const startDay = refStart + offset * PERIOD_DAYS;
    return makePeriod(year, index - year * PERIODS_PER_YEAR + 1, startDay, startDay + PERIOD_DAYS - 1);
};

/** The fiscal period containing an ISO date (YYYY-MM-DD). */
export const getFiscalPeriod = (iso) => {
    const day = toDay(iso);
    const listed = FISCAL_PERIODS.find((p) => day >= p.startDay && day <= p.endDay);
    if (listed) return listed;
    const first = FISCAL_PERIODS[0];
    if (day < first.startDay) return extrapolate(first, first.startDay, Math.floor((day - first.startDay) / PERIOD_DAYS));
    // After the last listed period: count on as if it were 28 days long.
    const last = FISCAL_PERIODS[FISCAL_PERIODS.length - 1];
    const lastStart = last.endDay + 1 - PERIOD_DAYS;
    return extrapolate(last, lastStart, Math.floor((day - lastStart) / PERIOD_DAYS));
};

/** The fiscal week containing an ISO date, identified as "2026-P10-W2". */
export const getFiscalWeek = (iso) => {
    const period = getFiscalPeriod(iso);
    const week = Math.floor((toDay(iso) - period.startDay) / 7) + 1;
    const startDay = period.startDay + (week - 1) * 7;
    return { id: `${period.id}-W${week}`, period, week, start: toIso(startDay), end: toIso(Math.min(startDay + 6, period.endDay)) };
};

/** A listed period by id ("2026-P10"). */
export const getPeriodById = (id) => PERIODS_BY_ID.get(id) || null;

export const periodLabel = (period) => `P${period.period} ${period.year}`;

export const periodRangeLabel = (period) => {
    const start = dayjs(period.start);
    const end = dayjs(period.end);
    return `${start.format(start.year() === end.year() ? "DD MMM" : "DD MMM YY")} – ${end.format("DD MMM YY")}`;
};

/** Labels for bucketed date values (see pivotUtils): "P10 2026", "P10 W2 · 13 Sep". */
export const formatPeriodBucket = (id) => {
    const match = /^(\d{4})-P(\d{2})$/.exec(id);
    return match ? `P${Number(match[2])} ${match[1]}` : id;
};

export const formatWeekBucket = (id) => {
    const match = /^(\d{4})-P(\d{2})-W(\d+)$/.exec(id);
    if (!match) return id;
    const [, year, period, week] = match;
    const label = `P${Number(period)} W${week}`;
    const listed = getPeriodById(`${year}-P${period}`);
    return listed ? `${label} · ${dayjs(toIso(listed.startDay + (week - 1) * 7)).format("DD MMM")}` : `${label} ${year}`;
};

/** The listed period containing `date`, else the latest listed one that has started. */
export const currentListedPeriod = (date = dayjs()) => {
    const iso = dayjs(date).format("YYYY-MM-DD");
    const day = toDay(iso);
    return FISCAL_PERIODS.filter((p) => p.startDay <= day).pop() || FISCAL_PERIODS[0];
};

/** The last `count` listed periods up to and including the current one. */
export const lastPeriods = (count, date = dayjs()) => {
    const current = currentListedPeriod(date);
    const index = FISCAL_PERIODS.indexOf(current);
    return { from: FISCAL_PERIODS[Math.max(0, index - count + 1)].id, to: current.id };
};

/** The listed periods of the current fiscal year so far. */
export const yearToDate = (date = dayjs()) => {
    const current = currentListedPeriod(date);
    const first = FISCAL_PERIODS.find((p) => p.year === current.year);
    return { from: first.id, to: current.id };
};

/** Date range covered by a period selection, ending no later than today. */
export const resolvePeriodRange = ({ from, to }, today = dayjs()) => {
    const fromPeriod = getPeriodById(from);
    const toPeriod = getPeriodById(to);
    if (!fromPeriod || !toPeriod) return null;
    const end = dayjs(toPeriod.end);
    const todayStart = dayjs(today).startOf("day");
    return { start: dayjs(fromPeriod.start), end: end.isAfter(todayStart) ? todayStart : end };
};
