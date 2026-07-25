// src/utils/alertEmailTemplate.js
// Generates styled dark-theme HTML email showing ONLY the triggered alert condition

export const generateAlertEmailHtml = ({
    alert,
    dbName,
    istNow,
    currency,
    metricDetails
}) => {
    const alertType = (alert.alert_type || 'low_osa').toLowerCase();

    const isRule1Active = alertType === 'low_osa' || (!alertType.includes('ads') && !alertType.includes('promo') && !alertType.includes('discount') && !alertType.includes('health'));
    const isRule2Active = alertType === 'low_osa_ads' || alertType.includes('ads');
    const isRule3Active = alertType === 'promo_discount_change' || alertType.includes('promo') || alertType.includes('discount');
    const isRule4Active = alertType === 'category_health' || alertType.includes('health');

    const platformsStr = Array.isArray(alert.platforms) && alert.platforms.length > 0 ? alert.platforms.join(', ') : 'All Platforms';
    const brandsStr = Array.isArray(alert.brands) && alert.brands.length > 0 ? alert.brands.join(', ') : 'All Brands';
    const operatorStr = alert.conditional_operator || '<';
    const thresholdStr = alert.threshold_value !== undefined ? alert.threshold_value : '85';
    const severityStr = alert.severity_level || 'Warning';

    let triggeredManifestHtml = '';

    if (isRule1Active) {
        triggeredManifestHtml = `
          <div class="stop active-rule">
            <div class="num">01</div>
            <div class="stop-body">
              <h3>Low OSA Alert <span class="active-badge">ACTIVE TRIGGER</span></h3>
              <p><strong>Formula:</strong> OSA = (Available SKUs / Total Listed SKUs) * 100</p>
              <p><strong>Condition:</strong> Category OSA &lt; Threshold (e.g. 85%)</p>
              <div class="rule-details-box">
                <div class="detail-item"><strong>Calculated OSA:</strong> <span class="highlight">${metricDetails.calculatedOSA || 'N/A'}</span></div>
                <div class="detail-item"><strong>Threshold:</strong> ${operatorStr} ${thresholdStr}%</div>
                <div class="detail-item"><strong>Platforms:</strong> ${platformsStr}</div>
                <div class="detail-item"><strong>Brands:</strong> ${brandsStr}</div>
              </div>
            </div>
            <div class="tag new">TRIGGERED</div>
          </div>
        `;
    } else if (isRule2Active) {
        triggeredManifestHtml = `
          <div class="stop active-rule">
            <div class="num">02</div>
            <div class="stop-body">
              <h3>Low OSA + Active Ads Alert <span class="active-badge">ACTIVE TRIGGER</span></h3>
              <p><strong>Formula:</strong> OSA &lt; Threshold AND Ad Spend &gt; 0</p>
              <p><strong>Condition:</strong> OSA below threshold with active ad spend</p>
              <div class="rule-details-box">
                <div class="detail-item"><strong>Calculated OSA:</strong> <span class="highlight">${metricDetails.calculatedOSA || 'N/A'}</span></div>
                <div class="detail-item"><strong>Ad Spend:</strong> <span class="highlight">${metricDetails.adSpend || 'N/A'}</span></div>
                <div class="detail-item"><strong>Threshold:</strong> ${operatorStr} ${thresholdStr}%</div>
                <div class="detail-item"><strong>Platforms:</strong> ${platformsStr}</div>
                <div class="detail-item"><strong>Brands:</strong> ${brandsStr}</div>
              </div>
            </div>
            <div class="tag new">TRIGGERED</div>
          </div>
        `;
    } else if (isRule3Active) {
        triggeredManifestHtml = `
          <div class="stop active-rule">
            <div class="num">03</div>
            <div class="stop-body">
              <h3>Sharp Promo/Discount Change Alert <span class="active-badge">ACTIVE TRIGGER</span></h3>
              <p><strong>Formula:</strong> Discount Shift% = ((Current - Baseline) / Baseline) * 100</p>
              <p><strong>Condition:</strong> Increase or decrease in discount &gt; 20%</p>
              <div class="rule-details-box">
                <div class="detail-item"><strong>Current Discount:</strong> <span class="highlight">${metricDetails.currentDiscount || 'N/A'}</span></div>
                <div class="detail-item"><strong>Baseline Discount:</strong> ${metricDetails.baselineDiscount || 'N/A'}</div>
                <div class="detail-item"><strong>Discount Shift:</strong> <span class="highlight">${metricDetails.discountShift || 'N/A'}</span></div>
                <div class="detail-item"><strong>Threshold:</strong> &gt; ${thresholdStr}%</div>
                <div class="detail-item"><strong>Platforms:</strong> ${platformsStr}</div>
                <div class="detail-item"><strong>Brands:</strong> ${brandsStr}</div>
              </div>
            </div>
            <div class="tag new">TRIGGERED</div>
          </div>
        `;
    } else if (isRule4Active) {
        triggeredManifestHtml = `
          <div class="stop active-rule">
            <div class="num">04</div>
            <div class="stop-body">
              <h3>Category Health Alert <span class="active-badge">ACTIVE TRIGGER</span></h3>
              <p><strong>Formula:</strong> Multi-metric comparison vs baseline / previous period</p>
              <p><strong>Condition:</strong> One or more metrics deteriorate beyond thresholds</p>
              <div class="rule-details-box">
                <div class="detail-item"><strong>Calculated OSA:</strong> <span class="highlight">${metricDetails.calculatedOSA || 'N/A'}</span></div>
                <div class="detail-item"><strong>Average Price:</strong> ${metricDetails.averagePrice || 'N/A'}</div>
                <div class="detail-item"><strong>ASP:</strong> ${metricDetails.averageASP || 'N/A'}</div>
                <div class="detail-item"><strong>Discount:</strong> ${metricDetails.averageDiscount || 'N/A'}</div>
                <div class="detail-item"><strong>Ad Spend:</strong> ${metricDetails.adSpend || 'N/A'}</div>
                <div class="detail-item"><strong>Threshold:</strong> ${thresholdStr}%</div>
                <div class="detail-item"><strong>Platforms:</strong> ${platformsStr}</div>
                <div class="detail-item"><strong>Brands:</strong> ${brandsStr}</div>
              </div>
            </div>
            <div class="tag new">TRIGGERED</div>
          </div>
        `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trailytics Alert Dispatch</title>
<style>
  :root {
    --bg: #12151A;
    --panel: #1B2028;
    --panel-2: #20262F;
    --line: #2B323C;
    --ink: #E9ECEF;
    --muted: #8B93A1;
    --lime: #C6FF3D;
    --amber: #FFB648;
    --coral: #FF6B4A;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #12151A;
    color: #E9ECEF;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    max-width: 800px;
    margin: 0 auto;
    padding: 30px 20px 60px;
  }

  /* Header */
  .console-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: #1B2028;
    border: 1px solid #2B323C;
    border-radius: 10px;
    margin-bottom: 24px;
  }
  .console-header .brand {
    display: flex; align-items: center; gap: 10px;
    font-family: 'JetBrains Mono', monospace, sans-serif;
    font-size: 12px;
    letter-spacing: 0.12em;
    color: #8B93A1;
    text-transform: uppercase;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #C6FF3D;
    box-shadow: 0 0 8px #C6FF3D;
    display: inline-block;
  }
  .console-header .ts {
    font-family: 'JetBrains Mono', monospace, sans-serif;
    font-size: 12px;
    color: #C6FF3D;
  }

  h1.title {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.1;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
    color: #ffffff;
  }
  .title .hi { color: #C6FF3D; }
  .title .alert-name { color: #FF6B4A; }
  p.subtitle {
    color: #8B93A1;
    font-size: 14px;
    margin: 0 0 28px;
  }

  section { margin-bottom: 36px; }
  .section-label {
    font-family: 'JetBrains Mono', monospace, sans-serif;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #C6FF3D;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Priority Manifest */
  .manifest {
    border: 1px solid #2B323C;
    border-radius: 12px;
    overflow: hidden;
    background: #1B2028;
  }
  .stop {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    padding: 18px 20px;
    position: relative;
  }
  .stop.active-rule {
    background: #20262F;
    border-left: 4px solid #C6FF3D;
  }
  .stop .num {
    font-family: 'JetBrains Mono', monospace, sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #C6FF3D;
    min-width: 32px;
  }
  .stop-body { flex: 1; }
  .stop-body h3 {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .stop-body p {
    margin: 0 0 4px;
    color: #8B93A1;
    font-size: 13px;
    line-height: 1.5;
  }
  .active-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 107, 74, 0.2);
    color: #FF6B4A;
    border: 1px solid rgba(255, 107, 74, 0.4);
    letter-spacing: 0.05em;
  }

  .rule-details-box {
    margin-top: 12px;
    padding: 12px 14px;
    background: #12151A;
    border: 1px solid #2B323C;
    border-radius: 8px;
    font-size: 12.5px;
    color: #E9ECEF;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
  }
  .rule-details-box .detail-item strong {
    color: #8B93A1;
    display: inline-block;
    min-width: 110px;
  }
  .rule-details-box .detail-item span.highlight {
    color: #C6FF3D;
    font-weight: 700;
  }

  .tag {
    font-family: 'JetBrains Mono', monospace, sans-serif;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 5px 10px;
    border-radius: 999px;
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .tag.new { color: #FF6B4A; border-color: rgba(255,107,74,0.35); background: rgba(255,107,74,0.08); }

  /* Summary Card */
  .summary-card {
    background: #1B2028;
    border: 1px solid #2B323C;
    border-radius: 12px;
    padding: 20px;
  }
  .summary-card table {
    width: 100%;
    border-collapse: collapse;
  }
  .summary-card td {
    padding: 10px;
    font-size: 13px;
    border-bottom: 1px solid #2B323C;
  }
  .summary-card tr:last-child td { border-bottom: none; }
  .summary-card td.label {
    color: #8B93A1;
    font-weight: 600;
    width: 200px;
  }
  .summary-card td.val {
    color: #ffffff;
    font-weight: 500;
  }

  footer {
    text-align: center;
    color: #8B93A1;
    font-family: 'JetBrains Mono', monospace, sans-serif;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 40px;
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div class="console-header">
    <div class="brand"><span class="dot"></span> Trailytics Intelligent Alerts — Dispatch</div>
    <div class="ts">${istNow} IST</div>
  </div>

  <h1 class="title">Intelligent Alert <span class="hi">Triggered</span>: <span class="alert-name">${alert.alert_name}</span></h1>
  <p class="subtitle">Notification dispatch for dashboard <strong>${dbName}</strong> [Severity: <strong>${severityStr}</strong>].</p>

  <!-- Priority Manifest Segment - Triggered Condition Only -->
  <section>
    <div class="section-label">Triggered Condition</div>
    <div class="manifest">
      ${triggeredManifestHtml}
    </div>
  </section>

  <!-- Summary Overview Section -->
  <section>
    <div class="section-label">Execution Summary</div>
    <div class="summary-card">
      <table>
        <tr>
          <td class="label">Rule Name</td>
          <td class="val" style="color: #C6FF3D; font-weight: 700;">${alert.alert_name}</td>
        </tr>
        <tr>
          <td class="label">Target Dashboard</td>
          <td class="val">${dbName}</td>
        </tr>
        <tr>
          <td class="label">Severity Level</td>
          <td class="val" style="color: #FF6B4A; font-weight: 700;">${severityStr}</td>
        </tr>
        <tr>
          <td class="label">Platforms Checked</td>
          <td class="val">${platformsStr}</td>
        </tr>
        <tr>
          <td class="label">Brands Checked</td>
          <td class="val">${brandsStr}</td>
        </tr>
        <tr>
          <td class="label">Trigger Condition</td>
          <td class="val">${metricDetails.conditionText || 'Condition met'}</td>
        </tr>
      </table>
    </div>
  </section>

  <footer>Trailytics Intelligent Alert Console · Automated Dispatch</footer>
</div>
</body>
</html>`;
};
