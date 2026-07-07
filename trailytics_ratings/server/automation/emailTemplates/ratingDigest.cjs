/**
 * MJML template for the rating-drop digest email.
 *
 * Why MJML: handwritten Outlook-safe HTML kept breaking (dark-mode auto-
 * inversion, swallowed gradients, blocked SVG). MJML compiles its tags
 * down to bgcolor-attribute tables + VML conditional-comment fallbacks
 * for Outlook, so we stop fighting the renderer on every change.
 *
 * The two custom bits MJML doesn't have primitives for — the inline
 * sparkline and the segmented rating thermometer — are emitted as raw
 * <table bgcolor> blocks via <mj-raw>. They render in every client.
 *
 * Exports `buildDigestMjml(rule, events, opts)` returning the MJML
 * string; the renderer in mjmlRenderer.cjs compiles it to HTML.
 */

const C = {
    bg:         '#f4f6fb',
    panel:      '#ffffff',
    border:     '#e2e8f0',
    inkStrong:  '#0f172a',
    ink:        '#1e293b',
    mute:       '#64748b',
    soft:       '#94a3b8',
    brand:      '#5b21b6',
    brandSoft:  '#ede9fe',
    brandTint:  '#f5f3ff',
    accent:     '#7c3aed',
    danger:     '#dc2626',
    dangerSoft: '#fef2f2',
    dangerInk:  '#7f1d1d',
    warn:       '#f59e0b',
    ok:         '#16a34a',
};

function escapeXml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function describeReason(reason, rule) {
    if (!reason) return 'Rating threshold tripped.';
    if (reason === 'absolute_floor') return `below floor ${rule.absolute_floor}★`;
    if (reason === 'drop_delta') return `dropped ≥ ${rule.drop_delta}★`;
    if (reason === 'both') {
        const parts = [];
        if (rule.absolute_floor != null) parts.push(`below floor ${rule.absolute_floor}★`);
        if (rule.drop_delta != null) parts.push(`dropped ≥ ${rule.drop_delta}★`);
        return parts.join(' and ') || 'threshold tripped';
    }
    return reason;
}

// Compact brand pill — text-based (no images = no image-blocking issues).
function brandPillHtml() {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:4px 10px 4px 4px;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td bgcolor="${C.brand}" width="34" height="34" align="center" style="border-radius:8px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:15px;font-weight:800;letter-spacing:.5px;">
                TR
              </td>
              <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">
                <div style="font-size:12px;font-weight:700;color:${C.inkStrong};line-height:1;">Trailytics</div>
                <div style="font-size:10px;color:${C.mute};margin-top:3px;text-transform:uppercase;letter-spacing:1px;">Rating Intelligence</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="padding:0 8px;font-family:Arial,Helvetica,sans-serif;color:${C.soft};font-size:14px;">&middot;</td>
        <td style="padding:4px 4px 4px 4px;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">
          <span style="display:inline-block;background:${C.brandTint};color:${C.brand};padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:.5px;">PRESTIGE</span>
        </td>
      </tr>
    </table>`;
}

// Percentage rating-drop visualization — bar with current vs prior overlay.
function pctDropHtml(prev, now) {
    if (prev == null || now == null || prev === 0) return '';
    const pctDrop = ((prev - now) / prev) * 100;
    if (pctDrop <= 0) return '';
    const pctRounded = pctDrop.toFixed(1);
    // The bar is full = prior rating; the red overlay shows the drop.
    const dropPct = Math.min(100, pctDrop);
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${C.mute};font-weight:700;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">
          % drop
        </td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${C.danger};font-weight:800;padding-bottom:4px;">
          &minus;${pctRounded}%
        </td>
      </tr>
      <tr>
        <td colspan="2" bgcolor="#fee2e2" style="height:10px;font-size:0;line-height:0;border-radius:6px;mso-line-height-rule:exactly;padding:0;overflow:hidden;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
            <tr>
              <td bgcolor="${C.danger}" width="${dropPct.toFixed(0)}%" height="10" style="height:10px;font-size:0;line-height:0;mso-line-height-rule:exactly;border-radius:6px 0 0 6px;">&nbsp;</td>
              <td width="${(100 - dropPct).toFixed(0)}%" style="font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// Weekly mini-chart — last 8 weeks of weekly averages, smaller than the daily.
function weeklyChartHtml(values) {
    const target = 8;
    const v = (values || []).slice(-target);
    while (v.length < target) v.unshift(v.length ? v[0] : 3);
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min || 1;
    const maxH = 24;
    const barW = 18;
    const gapW = 6;
    const last = v[v.length - 1];
    const first = v[0];
    const accent = last < first ? C.danger : C.ok;
    const inactive = '#cbd5e1';
    let tds = '';
    v.forEach((val, i) => {
        const h = Math.max(2, Math.round(((val - min) / range) * maxH));
        const top = maxH - h;
        const color = i === v.length - 1 ? accent : inactive;
        const labelTop = i === v.length - 1
            ? `<div style="font-size:9px;font-weight:700;color:${accent};font-family:Arial,Helvetica,sans-serif;margin-bottom:2px;text-align:center;">${val.toFixed(1)}</div>`
            : `<div style="font-size:0;line-height:0;height:11px;">&nbsp;</div>`;
        tds += `<td width="${barW}" valign="bottom" align="center" style="padding:0;mso-line-height-rule:exactly;line-height:0;font-size:0;">`
            + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${barW}" style="border-collapse:collapse;">`
            + `<tr><td style="text-align:center;font-size:0;line-height:0;">${labelTop}</td></tr>`
            + `<tr><td height="${top}" width="${barW}" style="font-size:0;line-height:0;height:${top}px;">&nbsp;</td></tr>`
            + `<tr><td height="${h}" width="${barW}" bgcolor="${color}" style="height:${h}px;font-size:0;line-height:0;border-radius:3px;mso-line-height-rule:exactly;">&nbsp;</td></tr>`
            + `<tr><td style="font-size:9px;line-height:1;color:${C.soft};font-family:Arial,Helvetica,sans-serif;padding-top:4px;text-align:center;">W${target - i}</td></tr>`
            + `</table></td>`;
        if (i < v.length - 1) {
            tds += `<td width="${gapW}" style="font-size:0;line-height:0;">&nbsp;</td>`;
        }
    });
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:14px;border-top:1px dashed ${C.border};padding-top:14px;">
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.mute};padding-bottom:8px;">
          8-week trend
        </td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${C.soft};padding-bottom:8px;">
          oldest &rarr; latest
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>${tds}</tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// One-click mailto: action chips — pre-filled subjects let recipients
// register status (ACK / Investigating / Resolved) with one tap. The from
// address sees these as plain replies and a small webhook could parse them.
function actionChipsHtml(productName, webPid) {
    const encName = encodeURIComponent(productName || webPid || 'alert');
    const mk = (label, prefix, bg) =>
        `<td style="padding:0 4px 0 0;">
          <a href="mailto:${process.env.SMTP_USER || 'no-reply@trailytics.com'}?subject=${prefix}%20${encName}&body=Acknowledged%20via%20one-click%20action."
             style="display:inline-block;background:${bg};color:#ffffff;padding:7px 14px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:.5px;font-family:Arial,Helvetica,sans-serif;">${label}</a>
        </td>`;
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:14px;">
      <tr>
        ${mk('&#10003; ACK',      '%5BACK%5D',           '#16a34a')}
        ${mk('&#9203; INVESTIGATING', '%5BINVESTIGATING%5D', '#f59e0b')}
        ${mk('&#10004; RESOLVED', '%5BRESOLVED%5D',      '#0ea5e9')}
      </tr>
    </table>`;
}

// JSON-LD for Gmail action card — surfaces a "Open Dashboard" button in
// the email list view ABOVE the subject line (Gmail web + mobile).
function gmailActionJsonLd(rule, events, dashboardBase) {
    const target = events.length > 0 && events[0].web_pid
        ? `${dashboardBase}/?web_pid=${encodeURIComponent(events[0].web_pid)}`
        : dashboardBase;
    const ld = {
        '@context': 'http://schema.org',
        '@type': 'EmailMessage',
        potentialAction: {
            '@type': 'ViewAction',
            name: 'Open Dashboard',
            url: target,
        },
        description: `${events.length} rating drop${events.length === 1 ? '' : 's'} for rule "${rule.name}"`,
    };
    return `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

// Renders a 14-bar bgcolor sparkline as raw HTML for embedding in <mj-raw>.
function sparklineBarsHtml(values) {
    const barCount = 14;
    const bars = (values || []).slice(-barCount);
    while (bars.length < barCount) bars.unshift(bars.length ? bars[0] : 3);
    const min = Math.min(...bars);
    const max = Math.max(...bars);
    const range = max - min || 1;
    const maxH = 38;
    const barW = 14;
    const gapW = 2;
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
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>${tds}</tr>
    </table>
    <div style="font-size:10px;color:${C.mute};margin-top:6px;font-family:Arial,Helvetica,sans-serif;">
      rating trend &middot; ${last.toFixed(1)}★ now vs ${first.toFixed(1)}★ then
    </div>`;
}

function thermometerHtml(currentRating) {
    if (currentRating == null) return '';
    const pct = Math.max(0, Math.min(1, (currentRating || 0) / 5));
    const fullSegs = Math.round(pct * 20);
    let cells = '';
    for (let i = 0; i < 20; i++) {
        let color;
        if (i >= fullSegs) color = '#e2e8f0';
        else if (i < 8)  color = C.danger;
        else if (i < 14) color = C.warn;
        else             color = C.ok;
        cells += `<td bgcolor="${color}" width="5%" height="10" style="height:10px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>`;
    }
    return `<table role="presentation" cellpadding="0" cellspacing="2" border="0" width="100%" style="border-collapse:separate;border-spacing:2px 0;margin-top:6px;">
      <tr>${cells}</tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:4px;">
      <tr>
        <td align="left" style="font-size:10px;color:${C.soft};font-family:Arial,Helvetica,sans-serif;">1.0★</td>
        <td align="center" style="font-size:10px;color:${C.soft};font-family:Arial,Helvetica,sans-serif;">3.0★</td>
        <td align="right" style="font-size:10px;color:${C.soft};font-family:Arial,Helvetica,sans-serif;">5.0★</td>
      </tr>
    </table>`;
}

function severityFor(currentRating) {
    if (currentRating == null) return { bg: C.mute, label: 'UNKNOWN' };
    if (currentRating < 2)   return { bg: C.danger, label: 'CRITICAL' };
    if (currentRating < 3)   return { bg: '#ea580c', label: 'HIGH' };
    if (currentRating < 4)   return { bg: C.warn,  label: 'MEDIUM' };
    return { bg: C.ok, label: 'LOW' };
}

function severityChipHtml(currentRating) {
    const { bg, label } = severityFor(currentRating);
    const cls = label === 'CRITICAL' ? 'pulse-critical' : '';
    return `<span class="${cls}" style="display:inline-block;background:${bg};color:#ffffff;padding:4px 11px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:1.2px;font-family:Arial,Helvetica,sans-serif;">${label}</span>`;
}

function deltaChipHtml(delta) {
    if (delta == null || delta <= 0) return '';
    return `<span style="display:inline-block;background:${C.danger};color:#ffffff;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">&#9660; ${Number(delta).toFixed(2)}</span>`;
}

function buildHero(rule, events, pretty) {
    const cardCount = events.length;
    const subtitle = cardCount === 1 ? 'product tripped this rule' : 'products tripped this rule';
    return `
    <mj-section background-color="${C.brand}" padding="0" css-class="hero-wrap">
      <mj-group>
        <mj-column vertical-align="middle" width="75%" padding="28px 4px 28px 28px">
          <mj-text padding="0" color="#ede9fe" font-size="11px" font-weight="700" letter-spacing="1.5px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">
            Rating Intelligence Alert
          </mj-text>
          <mj-text padding="6px 0 0" color="#ffffff" font-size="26px" font-weight="800" line-height="1.2" font-family="Arial, Helvetica, sans-serif">
            ${escapeXml(rule.name)}
          </mj-text>
          <mj-text padding="10px 0 0" color="#e9d5ff" font-size="11px" font-family="Arial, Helvetica, sans-serif">
            ${escapeXml(pretty)} IST &middot; ${cardCount} ${subtitle}
          </mj-text>
        </mj-column>
        <mj-column vertical-align="middle" width="25%" padding="28px 28px 28px 4px">
          <mj-text align="right" padding="0" color="#ffffff" font-size="50px" font-weight="800" line-height="1" font-family="Arial, Helvetica, sans-serif">
            ${cardCount}
          </mj-text>
          <mj-text align="right" padding="6px 0 0" color="#ede9fe" font-size="10px" font-weight="700" letter-spacing="1.2px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">
            ${cardCount === 1 ? 'product' : 'products'}
          </mj-text>
        </mj-column>
      </mj-group>
    </mj-section>`;
}

function buildSummaryStrip(events) {
    if (events.length <= 1) return '';
    const ratings = events.map(e => e.current_rating).filter(v => v != null).map(Number);
    const worst = ratings.length ? Math.min(...ratings) : null;
    const biggest = events.reduce((best, e) => {
        const d = Number(e.delta || 0);
        return d > (best?.d || 0) ? { d, p: e.product_name || e.web_pid } : best;
    }, null);
    const platforms = [...new Set(events.map(e => e.platform).filter(Boolean))];
    const sev = severityFor(worst);

    const cell = (label, value, sub) => `
      <mj-column padding="0 4px" background-color="${C.panel}" border="1px solid ${C.border}" border-radius="10px" padding="14px 16px">
        <mj-text padding="0" color="${C.mute}" font-size="10px" font-weight="700" letter-spacing="1px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">${label}</mj-text>
        <mj-text padding="6px 0 0" color="${C.inkStrong}" font-size="22px" font-weight="800" line-height="1" font-family="Arial, Helvetica, sans-serif">${value}</mj-text>
        ${sub ? `<mj-text padding="6px 0 0" color="${C.mute}" font-size="11px" font-family="Arial, Helvetica, sans-serif">${sub}</mj-text>` : ''}
      </mj-column>`;

    return `
    <mj-section padding="18px 0 0">
      ${cell('Products tripped', String(events.length), platforms.length ? escapeXml(platforms.join(' &middot; ')) : 'all platforms')}
      ${cell('Worst rating', worst != null ? `${worst.toFixed(1)}★` : '—', `<span style="display:inline-block;background:${sev.bg};color:#ffffff;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;letter-spacing:1px;">${sev.label}</span>`)}
      ${cell('Biggest drop', biggest ? `&#9660; ${biggest.d.toFixed(2)}` : '—', biggest ? escapeXml(String(biggest.p).slice(0, 36)) : '')}
    </mj-section>`;
}

function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function buildEventCard(e, dashboardBase) {
    const fullProduct = e.product_name || e.web_pid || e.scope_value || 'Unknown product';
    const product = truncate(fullProduct, 90);
    const prev = e.previous_rating != null ? Number(e.previous_rating) : null;
    const now  = e.current_rating != null ? Number(e.current_rating)  : null;
    const delta = e.delta != null ? Number(e.delta) : (prev != null && now != null ? prev - now : null);
    const trend = e.trend && e.trend.length >= 2 ? e.trend
        : (prev != null && now != null ? Array(13).fill(prev).concat([now]) : []);
    const team = suggestTeam(e.specific_issue);
    // Land on the Master tab with this SKU pre-searched so the user sees the
    // product's row + can click into trend, AI inspect, competitor mapping.
    const deepLink = e.web_pid && dashboardBase
        ? `${dashboardBase}/?tab=master&web_pid=${encodeURIComponent(e.web_pid)}`
        : (dashboardBase || '#');

    const quotesHtml = (e.sample_negatives || []).slice(0, 3).map(q => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.dangerSoft}" style="border-collapse:collapse;border-left:3px solid ${C.danger};margin:6px 0;">
        <tr><td style="padding:8px 12px;font-size:12px;font-style:italic;font-family:Arial,Helvetica,sans-serif;color:${C.dangerInk};line-height:1.45;">
          &ldquo;${escapeXml(q).slice(0, 240)}&rdquo;
        </td></tr>
      </table>`).join('');

    return `
    <mj-wrapper border="1px solid ${C.border}" border-radius="14px" padding="18px 0 0" background-color="${C.panel}">
      <mj-section background-color="${C.brand}" padding="14px 18px" border-radius="14px 14px 0 0">
        <mj-column width="78%" vertical-align="top" padding="0 8px 0 0">
          <mj-text padding="0" color="#e0e7ff" font-size="10px" font-weight="700" letter-spacing="1.2px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">
            Rating drop &middot; ${escapeXml(e.platform || 'Unknown')}
          </mj-text>
          <mj-text padding="4px 0 0" color="#ffffff" font-size="16px" font-weight="700" line-height="1.3" font-family="Arial, Helvetica, sans-serif" css-class="event-title">
            ${escapeXml(product)}
          </mj-text>
        </mj-column>
        <mj-column width="22%" vertical-align="top" padding="2px 0 0">
          <mj-raw><div style="text-align:right;">${severityChipHtml(now)}</div></mj-raw>
        </mj-column>
      </mj-section>

      <mj-section background-color="${C.panel}" padding="18px">
        <mj-column width="55%" padding="0 12px 0 0">
          <mj-text padding="0" color="${C.mute}" font-size="10px" font-weight="700" letter-spacing="1px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">Rating trend</mj-text>
          <mj-raw>${sparklineBarsHtml(trend)}</mj-raw>
          <mj-raw>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:14px;">
              <tr>
                <td valign="bottom" style="font-family:Arial,Helvetica,sans-serif;color:${C.danger};font-size:36px;font-weight:800;line-height:1;padding-right:12px;">
                  ${now != null ? now.toFixed(1) : '—'}<span style="font-size:18px;color:${C.soft};">★</span>
                </td>
                <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${C.mute};">
                  was <strong style="color:${C.inkStrong};">${prev != null ? prev.toFixed(1) : '—'}★</strong>
                  <div style="margin-top:4px;">${deltaChipHtml(delta)}</div>
                  <div style="margin-top:6px;font-size:11px;color:${C.mute};">
                    <strong style="color:${C.inkStrong};">${fmtRatingCount(e.rating_count)}</strong> ratings
                    ${e.pareto_status ? ` &middot; ${classificationPillHtml(e.pareto_status)}` : ''}
                  </div>
                </td>
              </tr>
            </table>
          </mj-raw>
          <mj-raw>${thermometerHtml(now)}</mj-raw>
          <mj-raw>${pctDropHtml(prev, now)}</mj-raw>
        </mj-column>
        <mj-column width="45%" padding="0 0 0 12px" border-left="1px solid ${C.border}">
          <mj-text padding="0" color="${C.mute}" font-size="10px" font-weight="700" letter-spacing="1px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">Suggested owner</mj-text>
          <mj-text padding="6px 0 0" color="${C.inkStrong}" font-size="16px" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(team)}</mj-text>
          <mj-text padding="2px 0 0" color="${C.mute}" font-size="11px" font-family="Arial, Helvetica, sans-serif">${e.specific_issue ? `Driver: ${escapeXml(e.specific_issue.replace(/_/g, ' '))}` : 'Investigate the driver'}</mj-text>

          <mj-text padding="14px 0 0" color="${C.mute}" font-size="10px" font-weight="700" letter-spacing="1px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">Reason</mj-text>
          <mj-text padding="2px 0 0" color="${C.inkStrong}" font-size="12px" font-family="Arial, Helvetica, sans-serif" line-height="1.5">${escapeXml(describeReason(e.reason, { absolute_floor: e.rule_absolute_floor, drop_delta: e.rule_drop_delta }))}</mj-text>
        </mj-column>
      </mj-section>

      ${quotesHtml ? `
      <mj-section background-color="${C.panel}" padding="0 18px 6px">
        <mj-column>
          <mj-text padding="0" color="${C.mute}" font-size="10px" font-weight="700" letter-spacing="1px" text-transform="uppercase" font-family="Arial, Helvetica, sans-serif">Recent verbatim</mj-text>
          <mj-raw>${quotesHtml}</mj-raw>
        </mj-column>
      </mj-section>` : ''}

      <mj-section background-color="${C.panel}" padding="0 18px">
        <mj-column>
          <mj-raw>${weeklyChartHtml(e.weekly_trend || trend)}</mj-raw>
        </mj-column>
      </mj-section>

      <mj-section background-color="${C.panel}" padding="14px 18px 18px" border-radius="0 0 14px 14px">
        <mj-column>
          <mj-button background-color="${C.brand}" color="#ffffff" font-size="13px" font-weight="700" padding="6px 0" inner-padding="10px 24px" border-radius="8px" href="${escapeXml(deepLink)}" font-family="Arial, Helvetica, sans-serif">
            Open in dashboard &rarr;
          </mj-button>
          <mj-raw>${actionChipsHtml(product, e.web_pid)}</mj-raw>
        </mj-column>
      </mj-section>
    </mj-wrapper>`;
}

/** Compact count helper — 12 / 1.2K / 1.3L (Indian lakhs). */
function fmtRatingCount(n) {
    if (n == null) return '—';
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '—';
    if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1000)     return `${(v / 1000).toFixed(1)}K`;
    return String(v);
}

/** Coloured pill for the Pareto / NPD / Non-Pareto classification badges. */
function classificationPillHtml(cls) {
    const map = {
        'Pareto':     { bg: '#fef3c7', fg: '#92400e' },
        'NPD':        { bg: '#dbeafe', fg: '#1e40af' },
        'Non-Pareto': { bg: '#e2e8f0', fg: '#475569' },
    };
    const c = map[cls] || { bg: '#f1f5f9', fg: '#64748b' };
    return `<span style="display:inline-block;background:${c.bg};color:${c.fg};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:0.5px;font-family:Arial,Helvetica,sans-serif;">${escapeXml(cls)}</span>`;
}

/** Walk events → { Category → [Pareto | NPD | Non-Pareto | Unclassified] → SKUs }.
 *  Ordered by total SKU count desc per category, then classification priority. */
function groupEventsByCategoryAndClassification(events) {
    const byCat = new Map();
    for (const e of events) {
        const cat = e.category || 'Uncategorised';
        const cls = e.pareto_status || 'Unclassified';
        if (!byCat.has(cat)) byCat.set(cat, new Map());
        const inner = byCat.get(cat);
        if (!inner.has(cls)) inner.set(cls, []);
        inner.get(cls).push(e);
    }
    const catOrder = [...byCat.entries()].sort((a, b) => {
        const aN = [...a[1].values()].reduce((s, arr) => s + arr.length, 0);
        const bN = [...b[1].values()].reduce((s, arr) => s + arr.length, 0);
        return bN - aN;
    });
    const clsOrder = { 'Pareto': 0, 'NPD': 1, 'Non-Pareto': 2 };
    return catOrder.map(([category, inner]) => ({
        category,
        groups: [...inner.entries()]
            .sort((a, b) => (clsOrder[a[0]] ?? 9) - (clsOrder[b[0]] ?? 9))
            .map(([classification, evs]) => ({ classification, events: evs })),
    }));
}

/** Single SKU row used inside every grouped table block. Adds the Ratings
 *  count column the client asked for. */
function compactRow(e, dashboardBase, oddRow) {
    const product = e.product_name || e.web_pid || e.scope_value || 'Unknown';
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
        <a href="${escapeXml(deepLink)}" target="_blank" style="color:${C.inkStrong};text-decoration:none;font-weight:600;">${escapeXml(product)}</a>
        <div style="font-size:11px;color:${C.mute};margin-top:2px;">${escapeXml(e.platform || '')}${e.specific_issue ? ` &middot; ${escapeXml(e.specific_issue.replace(/_/g, ' '))}` : ''}</div>
      </td>
      <td bgcolor="${rowBg}" align="center" style="padding:12px 8px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${C.mute};white-space:nowrap;">${prev != null ? prev.toFixed(1) : '—'}★</td>
      <td bgcolor="${rowBg}" align="center" style="padding:12px 8px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:${C.danger};white-space:nowrap;">${now != null ? now.toFixed(1) : '—'}★</td>
      <td bgcolor="${rowBg}" align="center" style="padding:12px 8px;border-bottom:1px solid ${C.border};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${C.ink};white-space:nowrap;">${fmtRatingCount(e.rating_count)}</td>
      <td bgcolor="${rowBg}" align="right" style="padding:12px 16px;border-bottom:1px solid ${C.border};white-space:nowrap;">${deltaChipHtml(delta)}</td>
    </tr>`;
}

const COMPACT_HEADER_ROW = `
    <tr bgcolor="${C.brandSoft}">
      <td align="left"   style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Product</td>
      <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Prev</td>
      <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Now</td>
      <td align="center" style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Ratings</td>
      <td align="right"  style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:1px;">Drop</td>
    </tr>`;

function buildCompactTable(events, dashboardBase) {
    // Grouped layout: Category heading → Classification sub-heading → SKU table.
    // Client request: group SKUs by category + by (Pareto / Non-Pareto / NPD)
    // and surface the Ratings count next to each SKU.
    const grouped = groupEventsByCategoryAndClassification(events);
    const blocks = grouped.map(({ category, groups }) => {
        const catCount = groups.reduce((s, g) => s + g.events.length, 0);
        const catHeader = `
            <tr><td style="padding:18px 4px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;color:${C.inkStrong};">
                    ${escapeXml(category)}
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
                  ${classificationPillHtml(classification)} <span style="margin-left:6px;">${evs.length} SKU${evs.length === 1 ? '' : 's'}</span>
                </td></tr>
                <tr><td style="padding:0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    ${COMPACT_HEADER_ROW}
                    ${evs.map((e, i) => compactRow(e, dashboardBase, i % 2 === 1)).join('')}
                  </table>
                </td></tr>
              </table>
            </td></tr>`).join('');
        return catHeader + groupBlocks;
    }).join('');

    return `
    <mj-section padding="18px 0 0">
      <mj-column padding="0">
        <mj-raw>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            ${blocks}
          </table>
        </mj-raw>
      </mj-column>
    </mj-section>`;
}

function buildFooter(rule) {
    return `
    <mj-section padding="18px 0 0" background-color="${C.panel}" border="1px solid ${C.border}" border-radius="14px">
      <mj-column padding="14px 20px">
        <mj-text padding="0" color="${C.mute}" font-size="11px" font-family="Arial, Helvetica, sans-serif" line-height="1.6">
          <strong style="color:${C.inkStrong};">${escapeXml(rule.name)}</strong>${rule.scope_type ? ` &middot; scope: ${escapeXml(rule.scope_type)}${rule.scope_value ? ` = ${escapeXml(rule.scope_value)}` : ''}` : ''}<br/>
          Threshold:${rule.absolute_floor != null ? ` floor &lt; ${rule.absolute_floor}★` : ''}${rule.absolute_floor != null && rule.drop_delta != null ? ' or' : ''}${rule.drop_delta != null ? ` drop &ge; ${rule.drop_delta}★` : ''}<br/>
          Tune or disable this rule in Settings &rarr; Alert Rules.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="14px 0">
      <mj-column>
        <mj-text align="center" padding="0" color="${C.soft}" font-size="10px" font-family="Arial, Helvetica, sans-serif">
          Prestige Rating Intelligence &middot; powered by Trailytics
        </mj-text>
      </mj-column>
    </mj-section>`;
}

function buildDigestMjml(rule, events, opts = {}) {
    const dashboardBase = opts.dashboardBase || process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';
    const now = new Date();
    const pretty = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const cardCount = events.length;
    const useCompact = cardCount > 3;

    const details = useCompact
        ? buildCompactTable(events, dashboardBase)
        : events.map(e => buildEventCard(e, dashboardBase)).join('');

    const worst = events.reduce((m, e) => {
        const r = e.current_rating;
        return r != null && r < (m ?? 99) ? r : m;
    }, null);
    const isCritical = worst != null && worst < 2;

    return `<mjml>
  <mj-head>
    <mj-title>Rating drop alert — ${escapeXml(rule.name)}</mj-title>
    <mj-preview>${cardCount} ${cardCount === 1 ? 'product' : 'products'} tripped${worst != null ? `, worst ${worst.toFixed(1)}★` : ''} · automated digest</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, Helvetica, sans-serif" />
      <mj-section background-color="${C.bg}" />
      <mj-text color="${C.ink}" font-size="14px" line-height="1.5" />
    </mj-attributes>
    <mj-raw>
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light only">
      <meta name="x-apple-disable-message-reformatting">
      ${gmailActionJsonLd(rule, events, dashboardBase)}
    </mj-raw>
    <mj-style>
      :root { color-scheme: light only; supported-color-schemes: light only; }
      [data-ogsc] .mj-body, [data-ogsb] .mj-body { background-color: ${C.bg} !important; }
      a { color: ${C.brand}; text-decoration: none; }
      /* Long product names should wrap instead of overflowing into the chip column. */
      .event-title { word-break: break-word; overflow-wrap: anywhere; }
      /* Pulsing severity chip — supported by Apple Mail, iOS Mail, Gmail web.
         Outlook ignores @keyframes gracefully — chip just stays static. */
      @keyframes pulse-severity { 0% { transform: scale(1); opacity:1; } 50% { transform: scale(1.06); opacity:.92; } 100% { transform: scale(1); opacity:1; } }
      .pulse-critical { animation: pulse-severity 1.4s ease-in-out infinite; transform-origin: center; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${C.bg}" width="680px">
    <mj-section padding="0 0 6px">
      <mj-column>
        <mj-raw>${brandPillHtml()}</mj-raw>
      </mj-column>
    </mj-section>
    ${buildHero(rule, events, pretty)}
    ${buildSummaryStrip(events)}
    ${details}
    ${buildFooter(rule)}
  </mj-body>
</mjml>`;
}

module.exports.isCritical = (events) => {
    const ratings = (events || []).map(e => e.current_rating).filter(v => v != null).map(Number);
    if (!ratings.length) return false;
    return Math.min(...ratings) < 2;
};

module.exports = { buildDigestMjml };
