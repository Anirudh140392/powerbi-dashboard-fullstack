/**
 * Rating-drop alert engine.
 *
 * Reads ratings.alert_rules, compares current vs. prior rating per product
 * from ratings.product_snapshots, records tripped rules into
 * ratings.alert_events (deduped per rule/product/day), and emails a digest
 * per rule via the SMTP mailer.
 *
 * Used by:
 *   - the Temporal alert-check activity (runAlertsForCompany)
 *   - POST /api/automation/alert-rules/:id/test (testRule — preview, no email)
 */
const { sendAlertEmail } = require('./mailer.cjs');
const { renderDigestHtml } = require('./mjmlRenderer.cjs');
const { buildCriticalAlertIcs } = require('./icsBuilder.cjs');
const { getMailerSettings, resolveScheduledAt } = require('./mailerSettings.cjs');
// Slack notifier removed — user requested. Slack code was here historically.

/**
 * Build the scope WHERE fragment + params for a rule.
 *
 * v4: uses array columns (platforms/brands/categories/web_pids) when present
 * AND backs off to the legacy single-value columns (platform/brand_filter/
 * category_filter) so older rules continue to evaluate identically.
 *
 * is_competitor_scope controls which side of the catalogue is scanned:
 *   'all'        — both Prestige + competitors
 *   'prestige'   — Prestige only (default; matches old behaviour)
 *   'competitors'— competitors only
 */
function buildScopeFilter(rule, startIndex) {
    const clauses = ['company_id = $1'];
    const params = [];
    let idx = startIndex;

    const scope = rule.is_competitor_scope || 'prestige';
    if (scope === 'prestige')         clauses.push('is_competitor = false');
    else if (scope === 'competitors') clauses.push('is_competitor = true');
    // scope === 'all' → no is_competitor clause

    // Platforms — array preferred, fall back to single
    const platforms = Array.isArray(rule.platforms) && rule.platforms.length
        ? rule.platforms
        : (rule.platform ? [rule.platform] : []);
    if (platforms.length > 0) {
        clauses.push(`LOWER(platform) = ANY(ARRAY[${platforms.map(() => `LOWER($${idx++})`).join(',')}])`);
        params.push(...platforms);
    }

    // Brands — array preferred, fall back to single + legacy brand_filter
    const brands = Array.isArray(rule.brands) && rule.brands.length
        ? rule.brands
        : (rule.brand_filter ? [rule.brand_filter] : (rule.scope_type === 'brand' && rule.scope_value ? [rule.scope_value] : []));
    if (brands.length > 0) {
        clauses.push(`LOWER(brand) = ANY(ARRAY[${brands.map(() => `LOWER($${idx++})`).join(',')}])`);
        params.push(...brands);
    }

    // Categories — array preferred
    const categories = Array.isArray(rule.categories) && rule.categories.length
        ? rule.categories
        : (rule.category_filter ? [rule.category_filter] : (rule.scope_type === 'category' && rule.scope_value ? [rule.scope_value] : []));
    if (categories.length > 0) {
        clauses.push(`LOWER(category) = ANY(ARRAY[${categories.map(() => `LOWER($${idx++})`).join(',')}])`);
        params.push(...categories);
    }

    // Specific SKUs — array preferred, fall back to scope_value when scope_type='product'
    const webPids = Array.isArray(rule.web_pids) && rule.web_pids.length
        ? rule.web_pids
        : (rule.scope_type === 'product' && rule.scope_value ? [rule.scope_value] : []);
    if (webPids.length > 0) {
        clauses.push(`web_pid = ANY($${idx++}::text[])`);
        params.push(webPids);
    }

    if (rule.classification) {
        clauses.push(`pareto_status = $${idx++}`);
        params.push(rule.classification);
    }
    return { where: clauses.join(' AND '), params, nextIndex: idx };
}

/**
 * Returns the candidate events for a rule WITHOUT inserting or emailing.
 * Each candidate: { web_pid, platform, product_name, previous_rating,
 *                   current_rating, delta, reason, snapshot_date }
 *
 * If rule.or_group is set, evaluation runs as:
 *   WHERE company_id=$1 AND (primary_filters OR or_group_filters)
 * which lets admins write rules like "Prestige Pressure Cookers below 3.5
 * OR Bajaj Mixer Grinders below 3.0" in a single rule.
 */
/**
 * Attach a real weekly rating series to each candidate so the digest's
 * sparkline + 8-week chart reflect actual history instead of the synthetic
 * "prev repeated, then now" placeholder. One batched query over the
 * ratings.weekly_rating_trend view. The view already excludes cross-break
 * artefacts from its WoW deltas; here we only need the rating series itself.
 */
async function attachWeeklyTrend(pool, companyId, candidates) {
    if (!candidates.length) return;
    const webPids = [...new Set(candidates.map(c => c.web_pid).filter(Boolean))];
    if (!webPids.length) return;
    const { rows } = await pool.query(
        `SELECT web_pid, platform, array_agg(rating ORDER BY week_start) AS ratings
         FROM ratings.weekly_rating_trend
         WHERE company_id = $1 AND web_pid = ANY($2::text[])
         GROUP BY web_pid, platform`,
        [companyId, webPids]
    );
    const map = new Map();
    for (const r of rows) {
        map.set(`${r.web_pid}||${String(r.platform).toLowerCase()}`,
            (r.ratings || []).filter(v => v != null).map(Number));
    }
    for (const c of candidates) {
        const series = map.get(`${c.web_pid}||${String(c.platform).toLowerCase()}`);
        if (series && series.length >= 2) {
            c.trend = series.slice(-14);       // 14-bar sparkline
            c.weekly_trend = series.slice(-8); // 8-week mini chart
        }
    }
}

async function evaluateRule(pool, rule) {
    const primary = buildScopeFilter(rule, 2);
    let queryParams = [rule.company_id, ...primary.params];
    let whereSql = primary.where;

    // OR-group: a second set of filter columns (brand_filter, category_filter,
    // classification) that triggers as an alternate match path.
    if (rule.or_group && typeof rule.or_group === 'object') {
        const orRule = {
            ...rule,
            platform: rule.or_group.platform || null,
            scope_type: rule.or_group.scope_type || rule.scope_type,
            scope_value: rule.or_group.scope_value || null,
            brand_filter: rule.or_group.brand_filter || null,
            category_filter: rule.or_group.category_filter || null,
            classification: rule.or_group.classification || null,
        };
        const orFilter = buildScopeFilter(orRule, primary.nextIndex);
        // Strip the leading 'company_id = $1 AND is_competitor = false' from
        // the OR-group's WHERE — those constraints already apply globally and
        // we want the OR to act only on the actual scope columns.
        const orOnly = orFilter.where
            .replace(/^company_id = \$1 AND is_competitor = false AND /, '')
            .replace(/^company_id = \$1 AND is_competitor = false$/, 'TRUE');
        whereSql = `company_id = $1 AND is_competitor = false AND ((${primary.where.replace(/^company_id = \$1 AND is_competitor = false AND /, '').replace(/^company_id = \$1 AND is_competitor = false$/, 'TRUE')}) OR (${orOnly}))`;
        queryParams = [rule.company_id, ...primary.params, ...orFilter.params];
    }
    const where = whereSql;
    const params = queryParams.slice(1);  // for symmetry with old code
    void params; // silence unused

    // Lookback window in days for the avg-based comparison modes. The SQL
    // is identical otherwise — we just swap the INTERVAL.
    const avgDays = rule.comparison_window === '30day_avg' ? 30
        : rule.comparison_window === '7day_avg' ? 7
        : null;

    let sql;
    if (avgDays) {
        // Compare current snapshot to the average of the previous N days.
        // Fall back to masters.products.category / pareto_status when the
        // snapshot row's copy is NULL (historical rows from before the
        // categorisation backfill).
        sql = `
            WITH scoped AS (
                SELECT web_pid, platform, product_name, rating, rating_count,
                       category, pareto_status, snapshot_date,
                       ROW_NUMBER() OVER (PARTITION BY web_pid, platform ORDER BY snapshot_date DESC) AS rn
                FROM ratings.product_snapshots
                WHERE ${where}
            ),
            current AS (SELECT * FROM scoped WHERE rn = 1)
            SELECT c.web_pid, c.platform, c.product_name, c.rating_count, c.snapshot_date,
                   COALESCE(c.category, mp.category, mp.master_category) AS category,
                   COALESCE(c.pareto_status, mp.pareto_status) AS pareto_status,
                   c.rating AS current_rating,
                   (
                       SELECT AVG(s.rating)
                       FROM ratings.product_snapshots s
                       WHERE s.company_id = c2.company_id
                         AND s.web_pid = c.web_pid
                         AND s.platform = c.platform
                         AND s.is_competitor = false
                         -- Discontinuity guard: never average across a known
                         -- measurement break. Clamp the window start to the most
                         -- recent discontinuity at/before the current snapshot so
                         -- the average is all on the post-break side.
                         AND s.snapshot_date >= GREATEST(
                             c.snapshot_date - INTERVAL '${avgDays} days',
                             COALESCE((
                                 SELECT MAX(d.effective_date)
                                 FROM ratings.metric_discontinuities d
                                 WHERE (d.company_id = c2.company_id OR d.company_id IS NULL)
                                   AND d.effective_date <= c.snapshot_date
                             ), '-infinity'::date)
                         )
                         AND s.snapshot_date < c.snapshot_date
                   ) AS previous_rating
            FROM current c
            CROSS JOIN (SELECT $1::uuid AS company_id) c2
            LEFT JOIN masters.products mp
              ON mp.company_id = c2.company_id
             AND mp.product_external_id = c.web_pid
             AND LOWER(mp.platform) = LOWER(c.platform)
        `;
    } else {
        // previous_snapshot (default) — compare current to immediate prior.
        sql = `
            WITH scoped AS (
                SELECT web_pid, platform, product_name, rating, rating_count,
                       category, pareto_status, snapshot_date,
                       ROW_NUMBER() OVER (PARTITION BY web_pid, platform ORDER BY snapshot_date DESC) AS rn
                FROM ratings.product_snapshots
                WHERE ${where}
            )
            SELECT c.web_pid, c.platform, c.product_name, c.rating_count, c.snapshot_date,
                   COALESCE(c.category, mp.category, mp.master_category) AS category,
                   COALESCE(c.pareto_status, mp.pareto_status) AS pareto_status,
                   c.rating AS current_rating,
                   -- Discontinuity guard: drop the comparison when a known
                   -- measurement break falls between the prior and current
                   -- snapshot, so we don't report an artefact as a real drop.
                   CASE WHEN EXISTS (
                       SELECT 1 FROM ratings.metric_discontinuities d
                       WHERE (d.company_id = $1 OR d.company_id IS NULL)
                         AND d.effective_date >  p.snapshot_date
                         AND d.effective_date <= c.snapshot_date
                   ) THEN NULL ELSE p.rating END AS previous_rating
            FROM scoped c
            LEFT JOIN scoped p
              ON p.web_pid = c.web_pid AND p.platform = c.platform AND p.rn = 2
            LEFT JOIN masters.products mp
              ON mp.company_id = $1
             AND mp.product_external_id = c.web_pid
             AND LOWER(mp.platform) = LOWER(c.platform)
            WHERE c.rn = 1
        `;
    }

    const { rows } = await pool.query(sql, queryParams);
    void queryParams;

    const floor = rule.absolute_floor != null ? Number(rule.absolute_floor) : null;
    const delta = rule.drop_delta != null ? Number(rule.drop_delta) : null;
    const minCount = rule.min_rating_count || 0;

    const candidates = [];
    for (const row of rows) {
        const current = row.current_rating != null ? Number(row.current_rating) : null;
        if (current == null) continue;
        if (minCount > 0 && Number(row.rating_count || 0) < minCount) continue;

        const previous = row.previous_rating != null ? Number(row.previous_rating) : null;

        const tripsFloor = floor != null && current < floor;
        const tripsDelta =
            delta != null && previous != null && previous - current >= delta;

        if (!tripsFloor && !tripsDelta) continue;

        const reason = tripsFloor && tripsDelta ? 'both' : tripsFloor ? 'absolute_floor' : 'drop_delta';
        candidates.push({
            web_pid: row.web_pid,
            platform: row.platform,
            product_name: row.product_name,
            previous_rating: previous,
            current_rating: current,
            delta: previous != null ? Number((previous - current).toFixed(2)) : null,
            reason,
            snapshot_date: row.snapshot_date,
            // New fields powering the grouped digest + rating-count column.
            category: row.category || null,
            pareto_status: row.pareto_status || null,
            rating_count: row.rating_count != null ? Number(row.rating_count) : null,
        });
    }
    await attachWeeklyTrend(pool, rule.company_id, candidates);
    return candidates;
}

function describeReason(reason, rule) {
    if (reason === 'both') return `below floor ${rule.absolute_floor} and dropped ≥ ${rule.drop_delta}`;
    if (reason === 'absolute_floor') return `below floor ${rule.absolute_floor}`;
    return `dropped ≥ ${rule.drop_delta}`;
}

// ============================================================================
// Rich HTML email — designed for Outlook desktop, Apple Mail, Gmail, mobile.
//
// HARD-LEARNT EMAIL RULES that drove this implementation:
//   1. Outlook ignores 'prefers-color-scheme: dark' and auto-inverts our
//      colors — fix by declaring color-scheme: light only in <meta> AND
//      using bgcolor= attributes (Outlook respects those even when dark
//      mode is forced on).
//   2. Outlook can swallow inline SVG and any CSS background-image, so
//      sparkline + thermometer must be built from <td bgcolor> bars
//      stacked in a real <table>.
//   3. CSS gradients lose to bgcolor in Outlook → hero uses a SOLID brand
//      colour plus an optional gradient overlay for clients that render it.
//   4. Every text-bearing <td> needs an explicit color so dark-mode
//      inversion can't hide it.
//   5. Layout = nested <table role=presentation>, not flex/grid.
//
// Plus: multi-SKU consolidation. The digest now leads with a summary
// strip (count, worst, biggest drop, affected platforms) and renders the
// per-SKU details below. For 4+ SKUs we drop into a compact-row view to
// keep the digest scannable.
// ============================================================================

const C = {
    bg:        '#f4f6fb',
    panel:     '#ffffff',
    border:    '#e2e8f0',
    inkStrong: '#0f172a',
    ink:       '#1e293b',
    mute:      '#64748b',
    soft:      '#94a3b8',
    brand:     '#5b21b6',
    brandSoft: '#ede9fe',
    accent:    '#7c3aed',
    danger:    '#dc2626',
    dangerSoft:'#fef2f2',
    dangerInk: '#7f1d1d',
    warn:      '#f59e0b',
    ok:        '#16a34a',
};

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Suggest the team most likely to own a given specific_issue. */
function suggestTeam(specificIssue) {
    const map = {
        Stopped_Working: 'QC',
        Manufacturing_Defects: 'Production',
        Build_Quality: 'Production',
        Cheap_Quality: 'Production',
        Coating_Issues: 'Production',
        Lid_Issues: 'Production',
        Handle_Issues: 'Production',
        Whistle_Issues: 'QC',
        Gas_Leakage: 'QC (Safety)',
        Steam_Leakage: 'QC',
        Heating_Performance: 'R&D',
        Cooking_Performance: 'R&D',
        Motor_Performance: 'R&D',
        Poor_Service: 'Customer Service',
        Delivery_Issues: 'Logistics',
        Damaged_In_Transit: 'Logistics',
        Overpriced: 'Marketing',
    };
    return map[specificIssue] || 'Quality / R&D';
}

/** Bar-chart sparkline built from <td bgcolor> — renders in every email client
 *  including Outlook desktop where inline SVG is unreliable. */
function sparklineBars(values, opts = {}) {
    const w = opts.width || 220;
    const barCount = 14;
    const bars = (values || []).slice(-barCount);
    while (bars.length < barCount) bars.unshift(bars.length ? bars[0] : 3);
    const min = Math.min(...bars);
    const max = Math.max(...bars);
    const range = max - min || 1;
    const maxH = 38; // px
    const gapW = 2;
    const barW = Math.max(4, Math.floor((w - (barCount - 1) * gapW) / barCount));
    const last = bars[bars.length - 1];
    const first = bars[0];
    const trendDown = last < first;
    const accent = trendDown ? C.danger : C.ok;
    const inactive = trendDown ? '#fecaca' : '#bbf7d0';

    let tds = '';
    bars.forEach((v, i) => {
        const h = Math.max(3, Math.round(((v - min) / range) * maxH));
        const top = maxH - h;
        const color = i === bars.length - 1 ? accent : inactive;
        tds += `<td width="${barW}" valign="bottom" align="center" style="padding:0;mso-line-height-rule:exactly;line-height:0;font-size:0;height:${maxH}px;">`
            + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${barW}" style="border-collapse:collapse;">`
            + `<tr><td height="${top}" width="${barW}" style="font-size:0;line-height:0;height:${top}px;">&nbsp;</td></tr>`
            + `<tr><td height="${h}" width="${barW}" bgcolor="${color}" style="height:${h}px;font-size:0;line-height:0;border-radius:2px;mso-line-height-rule:exactly;">&nbsp;</td></tr>`
            + `</table></td>`;
        if (i < bars.length - 1) {
            tds += `<td width="${gapW}" style="font-size:0;line-height:0;">&nbsp;</td>`;
        }
    });
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${w}" style="border-collapse:collapse;width:${w}px;">
      <tr>${tds}</tr>
    </table>
    <div style="font-size:10px;color:${C.mute};margin-top:4px;font-family:Arial,Helvetica,sans-serif;">
      14-day rating · last ${last.toFixed(1)}★ vs ${first.toFixed(1)}★
    </div>`;
}

/** Rating bar from 0★ to 5★ — segmented <td> blocks, Outlook-safe. */
function ratingThermometer(currentRating) {
    if (currentRating == null) return '';
    const pct = Math.max(0, Math.min(1, (currentRating || 0) / 5));
    const fullSegs = Math.round(pct * 20); // 20-segment bar, fine-grained
    let cells = '';
    for (let i = 0; i < 20; i++) {
        let color;
        if (i >= fullSegs) color = '#e2e8f0';
        else if (i < 8)  color = C.danger;   // 0-2.0
        else if (i < 14) color = C.warn;     // 2.0-3.5
        else             color = C.ok;       // 3.5-5
        cells += `<td bgcolor="${color}" width="5%" height="10" style="height:10px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>`;
    }
    return `<table role="presentation" cellpadding="0" cellspacing="1" border="0" width="100%" style="border-collapse:separate;border-spacing:2px 0;">
      <tr>${cells}</tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:2px;">
      <tr>
        <td align="left" style="font-size:10px;color:${C.soft};font-family:Arial,Helvetica,sans-serif;">1.0★</td>
        <td align="center" style="font-size:10px;color:${C.soft};font-family:Arial,Helvetica,sans-serif;">3.0★</td>
        <td align="right" style="font-size:10px;color:${C.soft};font-family:Arial,Helvetica,sans-serif;">5.0★</td>
      </tr>
    </table>`;
}

/** Severity chip — text color always white on solid bgcolor, dark-mode safe. */
function severityChip(currentRating) {
    if (currentRating == null) return '';
    let bg, label;
    if (currentRating < 2) { bg = C.danger; label = 'CRITICAL'; }
    else if (currentRating < 3) { bg = '#ea580c'; label = 'HIGH'; }
    else if (currentRating < 4) { bg = C.warn; label = 'MEDIUM'; }
    else { bg = C.ok; label = 'LOW'; }
    return `<span style="display:inline-block;background:${bg};color:#ffffff;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;mso-text-raise:0;">${label}</span>`;
}

function deltaChip(delta) {
    if (delta == null || delta <= 0) return '';
    return `<span style="display:inline-block;background:${C.danger};color:#ffffff;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">&#9660; ${delta.toFixed(2)}</span>`;
}

/** Full-detail card — used when events.length <= 3. */
function eventCard(e, dashboardBase) {
    const product = e.product_name || e.web_pid || e.scope_value || 'Unknown product';
    const prev = e.previous_rating != null ? Number(e.previous_rating) : null;
    const now  = e.current_rating != null ? Number(e.current_rating)  : null;
    const delta = e.delta != null ? Number(e.delta) : (prev != null && now != null ? prev - now : null);
    const trend = e.trend && e.trend.length >= 2 ? e.trend
        : (prev != null && now != null ? Array(13).fill(prev).concat([now]) : []);
    const team = suggestTeam(e.specific_issue);
    const deepLink = e.web_pid && dashboardBase
        ? `${dashboardBase}/?web_pid=${encodeURIComponent(e.web_pid)}`
        : (dashboardBase || '#');
    const quotes = (e.sample_negatives || []).slice(0, 3).map(q => `
      <tr><td style="padding:4px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.dangerSoft}" style="border-collapse:collapse;border-left:3px solid ${C.danger};">
          <tr><td style="padding:8px 12px;font-size:12px;font-style:italic;font-family:Arial,Helvetica,sans-serif;color:${C.dangerInk};line-height:1.45;">
            &ldquo;${escapeHtml(q).slice(0, 240)}&rdquo;
          </td></tr>
        </table>
      </td></tr>`).join('');

    return `
  <tr><td style="padding:0 0 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="border-collapse:collapse;border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
      <tr>
        <td bgcolor="${C.brand}" style="background:${C.brand};padding:16px 20px;border-bottom:4px solid ${C.danger};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:10px;letter-spacing:1.2px;font-weight:700;color:#e0e7ff;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Rating drop &middot; ${escapeHtml(e.platform || 'Unknown')}</div>
                <div style="font-size:17px;font-weight:700;color:#ffffff;margin-top:4px;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${escapeHtml(product)}</div>
              </td>
              <td align="right" valign="top" style="vertical-align:top;padding-left:12px;width:120px;">
                ${severityChip(now)}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td bgcolor="${C.panel}" style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="55%" valign="top" style="padding:0 16px 0 0;color:${C.ink};">
                <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${C.mute};text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">14-day trend</div>
                ${sparklineBars(trend)}
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:14px;">
                  <tr>
                    <td valign="bottom" style="font-family:Arial,Helvetica,sans-serif;color:${C.danger};font-size:36px;font-weight:800;line-height:1;padding-right:12px;">
                      ${now != null ? now.toFixed(1) : '—'}<span style="font-size:18px;color:${C.soft};">★</span>
                    </td>
                    <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${C.mute};">
                      was <strong style="color:${C.inkStrong};">${prev != null ? prev.toFixed(1) : '—'}★</strong>
                      <div style="margin-top:4px;">${deltaChip(delta)}</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:14px;">${ratingThermometer(now)}</div>
              </td>
              <td width="45%" valign="top" style="padding:0 0 0 16px;border-left:1px solid ${C.border};color:${C.ink};">
                <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${C.mute};text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">Suggested owner</div>
                <div style="font-size:16px;font-weight:700;color:${C.inkStrong};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(team)}</div>
                <div style="font-size:11px;color:${C.mute};margin-top:2px;font-family:Arial,Helvetica,sans-serif;">${e.specific_issue ? `Driver: ${escapeHtml(e.specific_issue.replace(/_/g, ' '))}` : 'Investigate the driver'}</div>

                <div style="margin-top:16px;font-size:10px;font-weight:700;letter-spacing:1px;color:${C.mute};text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Reason</div>
                <div style="font-size:12px;color:${C.inkStrong};margin-top:2px;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">${escapeHtml(describeReason(e.reason, { absolute_floor: e.rule_absolute_floor, drop_delta: e.rule_drop_delta }))}</div>
              </td>
            </tr>
            ${quotes ? `<tr><td colspan="2" style="padding-top:18px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${C.mute};text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;margin-bottom:6px;">Recent verbatim</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${quotes}
              </table>
            </td></tr>` : ''}
            <tr><td colspan="2" align="center" style="padding-top:18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr><td bgcolor="${C.brand}" style="border-radius:8px;">
                  <a href="${escapeHtml(deepLink)}" target="_blank" style="display:inline-block;padding:10px 24px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:.3px;">Open in dashboard &rarr;</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

/** Format a rating count compactly: 12 → "12", 1.2K, 45.6K, 1.3L (Indian
 *  lakhs since the user base is India). */
function fmtRatingCount(n) {
    if (n == null) return '—';
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '—';
    if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1000)     return `${(v / 1000).toFixed(1)}K`;
    return String(v);
}

/** Compact row — used when events.length > 3 to keep digest scannable.
 *  Now includes a Ratings (count) column so recipients can judge whether
 *  a drop matters (10 ratings vs 10,000). */
function eventRow(e, dashboardBase, oddRow) {
    const product = e.product_name || e.web_pid || e.scope_value || 'Unknown product';
    const prev = e.previous_rating != null ? Number(e.previous_rating) : null;
    const now  = e.current_rating != null ? Number(e.current_rating)  : null;
    const delta = e.delta != null ? Number(e.delta) : (prev != null && now != null ? prev - now : null);
    const deepLink = e.web_pid && dashboardBase
        ? `${dashboardBase}/?web_pid=${encodeURIComponent(e.web_pid)}`
        : (dashboardBase || '#');
    const rowBg = oddRow ? '#fafbfc' : C.panel;
    return `
    <tr>
      <td bgcolor="${rowBg}" style="padding:12px 16px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;color:${C.inkStrong};font-size:13px;">
        <a href="${escapeHtml(deepLink)}" target="_blank" style="color:${C.inkStrong};text-decoration:none;font-weight:600;">${escapeHtml(product)}</a>
        <div style="font-size:11px;color:${C.mute};margin-top:2px;">${escapeHtml(e.platform || '')}${e.specific_issue ? ` &middot; ${escapeHtml(e.specific_issue.replace(/_/g, ' '))}` : ''}</div>
      </td>
      <td bgcolor="${rowBg}" align="center" style="padding:12px 8px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${C.mute};white-space:nowrap;">
        ${prev != null ? prev.toFixed(1) : '—'}★
      </td>
      <td bgcolor="${rowBg}" align="center" style="padding:12px 8px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:${C.danger};white-space:nowrap;">
        ${now != null ? now.toFixed(1) : '—'}★
      </td>
      <td bgcolor="${rowBg}" align="center" style="padding:12px 8px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.ink};white-space:nowrap;">
        ${fmtRatingCount(e.rating_count)}
      </td>
      <td bgcolor="${rowBg}" align="right" style="padding:12px 16px;border-bottom:1px solid ${C.border};white-space:nowrap;">
        ${deltaChip(delta)}
      </td>
    </tr>`;
}

/** Group events by category → classification (Pareto / Non-Pareto / NPD / unclassified).
 *  Returns ordered array of { category, groups: [{ classification, events }] }. */
function groupEventsByCategoryAndClassification(events) {
    const byCategory = new Map();
    for (const e of events) {
        const cat = e.category || 'Uncategorised';
        const cls = e.pareto_status || 'Unclassified';
        if (!byCategory.has(cat)) byCategory.set(cat, new Map());
        const inner = byCategory.get(cat);
        if (!inner.has(cls)) inner.set(cls, []);
        inner.get(cls).push(e);
    }
    // Order categories by total event count desc.
    const categoryOrder = [...byCategory.entries()]
        .sort((a, b) => {
            const aCount = [...a[1].values()].reduce((s, arr) => s + arr.length, 0);
            const bCount = [...b[1].values()].reduce((s, arr) => s + arr.length, 0);
            return bCount - aCount;
        });
    // Order classifications: Pareto > NPD > Non-Pareto > Unclassified
    const clsOrder = { 'Pareto': 0, 'NPD': 1, 'Non-Pareto': 2 };
    return categoryOrder.map(([category, inner]) => ({
        category,
        groups: [...inner.entries()]
            .sort((a, b) => (clsOrder[a[0]] ?? 9) - (clsOrder[b[0]] ?? 9))
            .map(([classification, evs]) => ({ classification, events: evs })),
    }));
}

/** Color pill for classification badges in the digest. */
function classificationPill(cls) {
    const map = {
        'Pareto':     { bg: '#fef3c7', fg: '#92400e' },
        'NPD':        { bg: '#dbeafe', fg: '#1e40af' },
        'Non-Pareto': { bg: '#e2e8f0', fg: '#475569' },
    };
    const c = map[cls] || { bg: '#f1f5f9', fg: '#64748b' };
    return `<span style="display:inline-block;background:${c.bg};color:${c.fg};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(cls)}</span>`;
}

function topStatsStrip(events) {
    const count = events.length;
    const ratings = events.map(e => e.current_rating).filter(v => v != null).map(Number);
    const worst = ratings.length ? Math.min(...ratings) : null;
    const biggest = events.reduce((best, e) => {
        const d = Number(e.delta || 0);
        return d > (best?.d || 0) ? { d, p: e.product_name || e.web_pid } : best;
    }, null);
    const platforms = [...new Set(events.map(e => e.platform).filter(Boolean))];

    const cell = (label, value, sub) => `
      <td bgcolor="${C.panel}" align="left" style="padding:14px 16px;border:1px solid ${C.border};border-radius:10px;font-family:Arial,Helvetica,sans-serif;color:${C.ink};">
        <div style="font-size:10px;color:${C.mute};text-transform:uppercase;letter-spacing:1px;font-weight:700;">${label}</div>
        <div style="font-size:22px;color:${C.inkStrong};font-weight:800;line-height:1;margin-top:6px;">${value}</div>
        ${sub ? `<div style="font-size:11px;color:${C.mute};margin-top:4px;">${sub}</div>` : ''}
      </td>`;

    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0" style="border-collapse:separate;margin:0 -6px 18px;">
      <tr>
        ${cell('Products tripped', String(count), platforms.length ? `${platforms.join(' &middot; ')}` : 'all platforms')}
        ${cell('Worst rating', worst != null ? `${worst.toFixed(1)}★` : '—', worst != null ? severityChip(worst) : '')}
        ${cell('Biggest drop', biggest ? `&#9660; ${biggest.d.toFixed(2)}` : '—', biggest ? escapeHtml(String(biggest.p).slice(0, 40)) : '')}
      </tr>
    </table>`;
}

function buildDigestHtml(rule, events, opts = {}) {
    const dashboardBase = opts.dashboardBase || process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
    const now = new Date();
    const pretty = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const cardCount = events.length;
    const useCompact = cardCount > 3;

    // Grouped table column headers — used by every category/classification block
    // in compact mode. Includes the new "Ratings" count column.
    const headerRow = `
        <tr bgcolor="${C.brandSoft}">
          <td align="left"   style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Product</td>
          <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Prev</td>
          <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Now</td>
          <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Ratings</td>
          <td align="right"  style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Drop</td>
        </tr>`;

    let detailHtml;
    if (useCompact) {
        // Grouped layout: Category heading → Classification sub-heading → SKU rows.
        const grouped = groupEventsByCategoryAndClassification(events);
        const blocks = grouped.map(({ category, groups }) => {
            const catCount = groups.reduce((s, g) => s + g.events.length, 0);
            const catHeader = `
                <tr><td style="padding:16px 4px 6px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;color:${C.inkStrong};">
                        ${escapeHtml(category)}
                      </td>
                      <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.mute};">
                        ${catCount} SKU${catCount === 1 ? '' : 's'}
                      </td>
                    </tr>
                  </table>
                </td></tr>`;
            const groupBlocks = groups.map(({ classification, events: evs }) => `
                <tr><td style="padding:0 0 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="border-collapse:collapse;border:1px solid ${C.border};border-radius:10px;overflow:hidden;">
                    <tr><td style="padding:8px 16px;background:#f8fafc;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.mute};">
                      ${classificationPill(classification)} <span style="margin-left:6px;">${evs.length} SKU${evs.length === 1 ? '' : 's'}</span>
                    </td></tr>
                    <tr><td style="padding:0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        ${headerRow}
                        ${evs.map((e, i) => eventRow(e, dashboardBase, i % 2 === 1)).join('')}
                      </table>
                    </td></tr>
                  </table>
                </td></tr>`).join('');
            return catHeader + groupBlocks;
        }).join('');
        detailHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:18px;">
            ${blocks}
        </table>`;
    } else {
        detailHtml = events.map(e => eventCard(e, dashboardBase)).join('');
    }

    const detailWrap = useCompact ? detailHtml : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${detailHtml}</table>`;

    return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<meta name="x-apple-disable-message-reformatting">
<title>Rating drop alert</title>
<!--[if mso]>
<style type="text/css">
  body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  .button-td a { padding: 12px 24px !important; }
</style>
<xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style type="text/css">
  :root { color-scheme: light only; supported-color-schemes: light only; }
  body { margin:0; padding:0; background:${C.bg}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  a { color:${C.brand}; text-decoration:none; }
  /* Force light even when client tries to invert */
  [data-ogsc] body, [data-ogsb] body { background:${C.bg} !important; }
  @media only screen and (max-width:600px){
    .stack { display:block !important; width:100% !important; padding:0 0 12px !important; border-left:none !important; border-top:1px solid ${C.border}; padding-top:14px !important; margin-top:14px !important; }
    .summary-cell { display:block !important; width:100% !important; margin-bottom:8px; }
    .hero-name { font-size:22px !important; }
  }
</style>
</head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background:${C.bg};">

<!-- Outlook background colour fallback wrapper -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.bg}" style="border-collapse:collapse;background:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="680" style="border-collapse:collapse;width:100%;max-width:680px;">

  <!-- HERO -->
  <tr><td bgcolor="${C.brand}" style="background:${C.brand};padding:0;border-radius:18px 18px 0 0;">
    <!--[if mso]>
    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:680px;">
      <v:fill type="gradient" color="${C.accent}" color2="${C.danger}" angle="135"/>
      <v:textbox inset="0,0,0,0"><div>
    <![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.brand}" style="border-collapse:collapse;background:${C.brand};background-image:linear-gradient(135deg,${C.accent} 0%,${C.danger} 100%);border-radius:18px 18px 0 0;">
      <tr><td style="padding:28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td valign="middle" style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:#ede9fe;">Rating Intelligence Alert</div>
              <div class="hero-name" style="font-size:26px;font-weight:800;color:#ffffff;margin-top:6px;line-height:1.2;">${escapeHtml(rule.name)}</div>
              <div style="font-size:11px;color:#e9d5ff;margin-top:10px;">${escapeHtml(pretty)} IST &middot; automated digest</div>
            </td>
            <td align="right" valign="middle" width="100" style="padding-left:12px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
              <div style="font-size:46px;font-weight:800;line-height:1;color:#ffffff;">${cardCount}</div>
              <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#ede9fe;margin-top:4px;">${cardCount === 1 ? 'product' : 'products'}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
    <!--[if mso]></div></v:textbox></v:rect><![endif]-->
  </td></tr>

  <!-- SUMMARY STATS (only meaningful when more than one event) -->
  ${cardCount > 1 ? `<tr><td style="padding:18px 0 0;">${topStatsStrip(events)}</td></tr>` : ''}

  <!-- EVENT DETAILS -->
  <tr><td style="padding:${cardCount > 1 ? '0' : '18px 0 0'};">
    ${detailWrap}
  </td></tr>

  <!-- FOOTER -->
  <tr><td bgcolor="${C.panel}" style="padding:18px 20px;border:1px solid ${C.border};border-radius:0 0 14px 14px;font-family:Arial,Helvetica,sans-serif;color:${C.mute};font-size:11px;line-height:1.6;">
    <strong style="color:${C.inkStrong};">${escapeHtml(rule.name)}</strong>${rule.scope_type ? ` &middot; scope: ${escapeHtml(rule.scope_type)}${rule.scope_value ? ` = ${escapeHtml(rule.scope_value)}` : ''}` : ''}<br>
    Threshold:${rule.absolute_floor != null ? ` floor &lt; ${rule.absolute_floor}★` : ''}${rule.absolute_floor != null && rule.drop_delta != null ? ' or' : ''}${rule.drop_delta != null ? ` drop &ge; ${rule.drop_delta}★` : ''}<br>
    Tune or disable this rule in Settings &rarr; Alert Rules.
  </td></tr>

  <!-- TINY BRAND LINE -->
  <tr><td align="center" style="padding:14px 0;font-family:Arial,Helvetica,sans-serif;color:${C.soft};font-size:10px;">
    Prestige Rating Intelligence &middot; powered by Trailytics
  </td></tr>

</table>

</td></tr>
</table>

</body></html>`;
}

/**
 * Evaluate all enabled rules for a company, persist new alert events, email digests.
 *
 * @param {import('pg').Pool} pool
 * @param {string} companyId
 * @param {object} [opts]
 * @param {string} [opts.automationRunId]  Links events to a pipeline run.
 * @param {boolean} [opts.dryRun]          Evaluate + return, but do not insert or email.
 * @returns {Promise<{rulesEvaluated:number, eventsCreated:number, emailsSent:number, errors:string[]}>}
 */
async function runAlertsForCompany(pool, companyId, opts = {}) {
    const { automationRunId = null, dryRun = false, ruleId = null } = opts;
    const summary = { rulesEvaluated: 0, eventsCreated: 0, emailsSent: 0, errors: [] };

    // When ruleId is provided (instant trigger on rule create/activate), evaluate
    // only that rule. Otherwise evaluate every enabled rule for the company.
    const { rows: rules } = ruleId
        ? await pool.query(
            `SELECT * FROM ratings.alert_rules WHERE company_id = $1 AND id = $2 AND enabled = true`,
            [companyId, ruleId]
        )
        : await pool.query(
            `SELECT * FROM ratings.alert_rules WHERE company_id = $1 AND enabled = true`,
            [companyId]
        );

    for (const rule of rules) {
        summary.rulesEvaluated++;
        let candidates;
        try {
            candidates = await evaluateRule(pool, rule);
        } catch (e) {
            summary.errors.push(`rule ${rule.id} evaluate failed: ${e.message}`);
            continue;
        }
        if (candidates.length === 0) continue;

        if (dryRun) {
            summary.eventsCreated += candidates.length;
            continue;
        }

        // Insert with same-day dedupe; only newly-inserted rows proceed to email.
        const newEvents = [];
        for (const c of candidates) {
            try {
                const { rows: inserted } = await pool.query(
                    `INSERT INTO ratings.alert_events
                       (rule_id, company_id, run_id, scope_type, scope_value, web_pid,
                        product_name, platform, previous_rating, current_rating, delta,
                        reason, snapshot_date, category, pareto_status, rating_count)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                     ON CONFLICT (rule_id, COALESCE(web_pid,''), snapshot_date) DO NOTHING
                     RETURNING id`,
                    [
                        rule.id, companyId, automationRunId, rule.scope_type, rule.scope_value,
                        c.web_pid, c.product_name, c.platform, c.previous_rating,
                        c.current_rating, c.delta, c.reason, c.snapshot_date,
                        c.category || null, c.pareto_status || null, c.rating_count != null ? c.rating_count : null,
                    ]
                );
                if (inserted.length > 0) {
                    newEvents.push({ ...c, id: inserted[0].id });
                }
            } catch (e) {
                summary.errors.push(`rule ${rule.id} insert failed: ${e.message}`);
            }
        }

        if (newEvents.length === 0) continue;
        summary.eventsCreated += newEvents.length;

        try {
            const html = await renderDigestHtml(rule, newEvents);
            const worst = newEvents.reduce((m, e) => {
                const r = e.current_rating;
                return r != null && r < (m ?? 99) ? r : m;
            }, null);

            // Consult per-company mailer settings so admins can flip features
            // (calendar invite, priority threshold, threading) without code changes.
            const ms = await getMailerSettings(pool, companyId);
            const critThreshold = ms.highPriority.enabled
                ? ms.highPriority.criticalThreshold
                : -Infinity;
            const priority = worst != null && worst < critThreshold ? 'high' : 'normal';

            const attachments = [];
            const calCfg = ms.calendarInvite;
            const shouldAttachCalendar = calCfg.enabled
                && (!calCfg.onlyForCritical || priority === 'high');
            if (shouldAttachCalendar) {
                const recipientForIcs = (rule.recipients && rule.recipients[0]) || null;
                attachments.push(buildCriticalAlertIcs({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    events: newEvents,
                    dashboardUrl: newEvents[0]?.web_pid
                        ? `${process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app'}/?tab=master&web_pid=${encodeURIComponent(newEvents[0].web_pid)}`
                        : process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app',
                    organizerEmail: process.env.SMTP_USER,
                    attendeeEmail: recipientForIcs,
                    scheduledAt: resolveScheduledAt(calCfg.schedulePreset, calCfg.scheduleTimeHHMM),
                    durationMinutes: calCfg.durationMinutes,
                    reminderMinutes: calCfg.reminderMinutes,
                }));
            }

            // Action gating — only send email if rule.actions includes 'email'.
            // Default (legacy rules without actions column) = ['email'] so
            // existing rules continue to email.
            const ruleActions = Array.isArray(rule.actions) && rule.actions.length
                ? rule.actions
                : ['email'];

            if (ruleActions.includes('email')) {
                await sendAlertEmail({
                    to: rule.recipients && rule.recipients.length ? rule.recipients : [],
                    subject: `[Ratings] ${newEvents.length} rating drop(s) — ${rule.name}`,
                    html,
                    priority,
                    threadKey: ms.threading.enabled ? `rule-${rule.id}` : undefined,
                    attachments: attachments.length ? attachments : undefined,
                    unsubscribeUrl: ms.listUnsubscribe.enabled ? (ms.listUnsubscribe.overrideUrl || undefined) : null,
                });
            }

            // In-app notifications — write one row per recipient user (matched
            // by lower(email)). Users see them in the header bell dropdown.
            if (ruleActions.includes('in_app')) {
                const emails = (rule.recipients && rule.recipients.length ? rule.recipients : [])
                    .map(e => String(e).toLowerCase());
                if (emails.length > 0) {
                    try {
                        const { rows: targetUsers } = await pool.query(
                            `SELECT id FROM ratings.users WHERE LOWER(email) = ANY($1::text[])`,
                            [emails]
                        );
                        const worstNow = newEvents.reduce((m, e) => {
                            const r = e.current_rating;
                            return r != null && r < (m ?? 99) ? r : m;
                        }, null);
                        const title = `${newEvents.length} rating drop${newEvents.length === 1 ? '' : 's'} — ${rule.name}`;
                        const body = newEvents.slice(0, 3)
                            .map(e => `${e.product_name || e.web_pid} → ${e.current_rating}★`)
                            .join(' · ');
                        const linkUrl = `/?tab=rules&sub=alert-events&rule=${rule.id}`;
                        for (const u of targetUsers) {
                            await pool.query(
                                `INSERT INTO ratings.notifications
                                   (user_id, company_id, kind, title, body, payload, link_url)
                                 VALUES ($1, $2, 'rating_drop', $3, $4, $5::jsonb, $6)`,
                                [u.id, companyId, title, body, JSON.stringify({
                                    ruleId: rule.id,
                                    ruleName: rule.name,
                                    eventCount: newEvents.length,
                                    worstRating: worstNow,
                                }), linkUrl]
                            );
                        }
                    } catch (e) {
                        summary.errors.push(`rule ${rule.id} in-app notif failed: ${e.message}`);
                    }
                }
            }

            summary.emailsSent++;
            await pool.query(
                `UPDATE ratings.alert_events SET email_sent = true WHERE id = ANY($1::uuid[])`,
                [newEvents.map((e) => e.id)]
            );
        } catch (e) {
            summary.errors.push(`rule ${rule.id} email failed: ${e.message}`);
            await pool.query(
                `UPDATE ratings.alert_events SET email_error = $1 WHERE id = ANY($2::uuid[])`,
                [e.message, newEvents.map((ev) => ev.id)]
            );
        }
    }

    return summary;
}

/**
 * Preview a single rule: returns the events it would fire right now.
 * Does not insert or email.
 */
async function testRule(pool, ruleId, companyId) {
    const { rows } = await pool.query(
        `SELECT * FROM ratings.alert_rules WHERE id = $1 AND company_id = $2`,
        [ruleId, companyId]
    );
    if (rows.length === 0) {
        const err = new Error('Alert rule not found');
        err.code = 'NOT_FOUND';
        throw err;
    }
    const rule = rows[0];
    const candidates = await evaluateRule(pool, rule);
    return {
        rule: { id: rule.id, name: rule.name, scope_type: rule.scope_type, scope_value: rule.scope_value },
        wouldTrigger: candidates.length,
        events: candidates,
    };
}

module.exports = { runAlertsForCompany, testRule, evaluateRule, buildDigestHtml, renderDigestHtml };
