// src/utils/reportScheduleTiming.js
// When a scheduled report is due and which dates it covers. Schedules run on
// IST wall-clock time; dates are YYYY-MM-DD strings, times HH:mm.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

/** A failed delivery is retried on later job runs the same day, up to this many attempts. */
export const MAX_ATTEMPTS = 3;
/** A delivery still marked 'sending' after this long was interrupted, and counts as failed. */
const STALE_SENDING_MS = 30 * 60 * 1000;

export const FREQUENCIES = ['daily', 'weekly', 'monthly'];

export const DATE_WINDOWS = {
    yesterday: 'Yesterday',
    last_7_days: 'Last 7 days',
    last_week: 'Last week (Mon–Sun)',
    month_to_date: 'Month to date',
    last_month: 'Last month',
};

/** IST date and time of a moment: { date: 'YYYY-MM-DD', time: 'HH:mm' }. */
export const istNow = (now = new Date()) => {
    const d = new Date(now.getTime() + IST_OFFSET_MS);
    return {
        date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
        time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
        dateTime: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
    };
};

export const addDays = (date, days) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

/** 1 = Monday … 7 = Sunday. */
export const dayOfWeek = (date) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

const lastDayOfMonth = (date) => {
    const [y, m] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Whether a schedule sends on this date. A monthly day past the month's end sends on its last day. */
export const runsOn = (schedule, date) => {
    if (schedule.frequency === 'weekly') return dayOfWeek(date) === Number(schedule.day_of_week);
    if (schedule.frequency === 'monthly') {
        return Number(date.slice(8, 10)) === Math.min(Number(schedule.day_of_month), lastDayOfMonth(date));
    }
    return true;
};

/** Today's slot has already passed (or is now): a new or edited schedule skips it rather than sending at once. */
export const slotPassedToday = (schedule, now = new Date()) => {
    const { date, time } = istNow(now);
    return runsOn(schedule, date) && time >= schedule.send_time;
};

/**
 * Due when today is a send day, the send time has passed, and today's delivery
 * hasn't happened yet — or it failed (or was interrupted) and attempts remain.
 */
export const isDue = (schedule, now = new Date()) => {
    const { date, time } = istNow(now);
    if (schedule.status !== 'active' || !runsOn(schedule, date) || time < schedule.send_time) return false;
    if (schedule.last_period !== date) return true;
    if (Number(schedule.attempts) >= MAX_ATTEMPTS) return false;
    if (schedule.last_status === 'failed') return true;
    return schedule.last_status === 'sending' && now.getTime() - Number(schedule.version) > STALE_SENDING_MS;
};

/** Next delivery as 'YYYY-MM-DD HH:mm' IST, or null when paused. */
export const nextSendAt = (schedule, now = new Date()) => {
    if (schedule.status !== 'active') return null;
    const { date, time } = istNow(now);
    for (let i = 0; i <= 62; i += 1) {
        const day = addDays(date, i);
        if (!runsOn(schedule, day)) continue;
        if (i === 0 && (time >= schedule.send_time || schedule.last_period === date)) continue;
        return `${day} ${schedule.send_time}`;
    }
    return null;
};

/** The dates a delivery on `today` covers; data is complete up to yesterday. */
export const resolveDateWindow = (window, today) => {
    const yesterday = addDays(today, -1);
    switch (window) {
        case 'last_7_days':
            return { startDate: addDays(yesterday, -6), endDate: yesterday };
        case 'last_week': {
            const monday = addDays(today, 1 - dayOfWeek(today));
            return { startDate: addDays(monday, -7), endDate: addDays(monday, -1) };
        }
        case 'month_to_date':
            return { startDate: `${yesterday.slice(0, 8)}01`, endDate: yesterday };
        case 'last_month': {
            const lastOfPrevious = addDays(`${today.slice(0, 8)}01`, -1);
            return { startDate: `${lastOfPrevious.slice(0, 8)}01`, endDate: lastOfPrevious };
        }
        default:
            return { startDate: yesterday, endDate: yesterday };
    }
};
