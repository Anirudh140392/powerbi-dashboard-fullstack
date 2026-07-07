/**
 * Per-company mailer settings backed by ratings.mailer_settings (jsonb).
 *
 * Wraps a small SQL surface around the settings table and exposes typed
 * helpers with defaults so the rest of the backend never has to deal with
 * missing keys.
 *
 * Settings shape (all optional, defaults below):
 *   calendarInvite: {
 *     enabled: boolean (default: false)             // attach .ics?
 *     schedulePreset: string                        // when the event fires
 *        one of: 'next_10am' | 'tomorrow_10am'
 *                | 'plus_1_day_10am' | 'plus_2_days_10am' | 'plus_3_days_10am'
 *                | 'next_monday_10am' | 'next_business_day_10am'
 *     scheduleTimeHHMM: string ('10:00')           // local-time of event (IST)
 *     durationMinutes: number (30)
 *     reminderMinutes: number (15)
 *     onlyForCritical: boolean (true)              // only attach when severity is CRITICAL
 *   }
 *   threading: { enabled: boolean (default: true) }
 *   highPriority: {
 *     enabled: boolean (true)
 *     criticalThreshold: number (2.0)              // worst rating below this triggers high-priority
 *   }
 *   actionChips: { enabled: boolean (true) }
 *   gmailAction: { enabled: boolean (true) }
 *   listUnsubscribe: {
 *     enabled: boolean (true)
 *     overrideUrl: string|null
 *   }
 *   defaults: {
 *     defaultRecipients: string[]                  // CSV in UI; empty = use ALERT_DEFAULT_RECIPIENTS env
 *   }
 */

const DEFAULTS = {
    calendarInvite: {
        enabled: false,
        schedulePreset: 'tomorrow_10am',
        scheduleTimeHHMM: '10:00',
        durationMinutes: 30,
        reminderMinutes: 15,
        onlyForCritical: true,
    },
    threading: { enabled: true },
    highPriority: { enabled: true, criticalThreshold: 2.0 },
    actionChips: { enabled: true },
    gmailAction: { enabled: true },
    listUnsubscribe: { enabled: true, overrideUrl: null },
    defaults: { defaultRecipients: [] },
};

function deepMerge(target, source) {
    const out = Array.isArray(target) ? target.slice() : { ...target };
    for (const k of Object.keys(source || {})) {
        const sv = source[k];
        if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
            out[k] = deepMerge(target?.[k] || {}, sv);
        } else if (sv !== undefined) {
            out[k] = sv;
        }
    }
    return out;
}

async function getMailerSettings(pool, companyId) {
    const { rows } = await pool.query(
        `SELECT settings FROM ratings.mailer_settings WHERE company_id = $1`,
        [companyId]
    );
    const stored = rows[0]?.settings || {};
    return deepMerge(DEFAULTS, stored);
}

async function putMailerSettings(pool, companyId, patch) {
    // Re-read so updates are merged on top of whatever's stored, not blown away.
    const current = await getMailerSettings(pool, companyId);
    const merged = deepMerge(current, patch || {});
    // Strip any keys not in DEFAULTS to keep the surface small + safe.
    const sanitized = {};
    for (const k of Object.keys(DEFAULTS)) sanitized[k] = merged[k];
    await pool.query(
        `INSERT INTO ratings.mailer_settings (company_id, settings, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (company_id) DO UPDATE
            SET settings = EXCLUDED.settings,
                updated_at = NOW()`,
        [companyId, JSON.stringify(sanitized)]
    );
    return sanitized;
}

/**
 * Resolve the schedulePreset string into an actual JS Date relative to now.
 * Returns null on unknown preset.
 */
function resolveScheduledAt(preset, hhmm) {
    const [hh, mm] = String(hhmm || '10:00').split(':').map(n => parseInt(n, 10) || 0);
    // Compute "today at hh:mm IST" → Date. IST is UTC+5:30.
    const now = new Date();
    const todayIstAtTime = new Date(now);
    todayIstAtTime.setUTCHours(hh - 5, mm - 30, 0, 0);
    if (mm - 30 < 0) todayIstAtTime.setUTCHours(hh - 6, mm + 30, 0, 0);

    const addDays = (d, n) => {
        const out = new Date(d);
        out.setUTCDate(out.getUTCDate() + n);
        return out;
    };

    switch (preset) {
        case 'next_10am': {
            // Today's hh:mm if still in the future, else tomorrow's
            return todayIstAtTime > now ? todayIstAtTime : addDays(todayIstAtTime, 1);
        }
        case 'tomorrow_10am':       return addDays(todayIstAtTime, 1);
        case 'plus_1_day_10am':     return addDays(todayIstAtTime, 1);
        case 'plus_2_days_10am':    return addDays(todayIstAtTime, 2);
        case 'plus_3_days_10am':    return addDays(todayIstAtTime, 3);
        case 'next_monday_10am': {
            // 0 = Sun, 1 = Mon, ... ; advance until day-of-week is 1
            let d = addDays(todayIstAtTime, 1);
            while (d.getUTCDay() !== 1) d = addDays(d, 1);
            return d;
        }
        case 'next_business_day_10am': {
            let d = addDays(todayIstAtTime, 1);
            while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = addDays(d, 1);
            return d;
        }
        default: return addDays(todayIstAtTime, 1);
    }
}

module.exports = { getMailerSettings, putMailerSettings, resolveScheduledAt, DEFAULTS };
