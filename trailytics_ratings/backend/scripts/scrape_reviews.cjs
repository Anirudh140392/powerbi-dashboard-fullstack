/**
 * Amazon Review Bulk Downloader (Node.js)
 * ========================================
 * Scrapes reviews for ASINs from an Excel file, with dual-sort (recent + top),
 * deduplication, star breakdown, variant capture, and XLSX export.
 *
 * Usage:
 *   node scripts/scrape_reviews.cjs [--test-asin B084KR66J1] [--resume]
 *
 * Before running:
 *   1. Copy your Amazon cookie string into the cookie file path below
 *   2. npm install xlsx cheerio
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const cheerio = require('cheerio');

// ---------------------------------------------------------------------------
// Config — loaded from JSON file, NOT hardcoded
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(__dirname, 'scrape_reviews_config.json');

const DEFAULT_CONFIG = {
  min_review_count: 500,
  page_size: 10,
  delay_min_ms: 4000,
  delay_max_ms: 8000,
  sort_modes: ['recent', 'helpful'],
  domain: 'www.amazon.in',
  input_file: 'C:\\Users\\monst\\Downloads\\rating review asin.xlsx',
  output_file: 'C:\\Users\\monst\\Downloads\\amazon_reviews_output.xlsx',
  progress_file: 'C:\\Users\\monst\\Downloads\\scrape_reviews_progress.json',
  cookie_file: 'C:\\Users\\monst\\Downloads\\amazon_cookies.txt',
  csrf_file: 'C:\\Users\\monst\\Downloads\\amazon_csrf.txt',
};

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return { ...DEFAULT_CONFIG, ...cfg };
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return { ...DEFAULT_CONFIG };
}

// ---------------------------------------------------------------------------
// User agents pool (rotated randomly)
// ---------------------------------------------------------------------------
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(config) {
  const ms = config.delay_min_ms + Math.random() * (config.delay_max_ms - config.delay_min_ms);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCookies(config) {
  const cookieFile = config.cookie_file;
  if (!fs.existsSync(cookieFile)) {
    console.error(`  ✗ Cookie file not found: ${cookieFile}`);
    console.error(`    Create it by copying your browser cookie string into that file.`);
    console.error(`    (one long string: session-id=xxx; i18n-prefs=INR; ...)`);
    process.exit(1);
  }
  const raw = fs.readFileSync(cookieFile, 'utf8').trim();
  console.log(`  ✓ Loaded cookies (${raw.length} chars)`);
  return raw;
}

function loadCsrfToken(config) {
  const csrfFile = config.csrf_file;
  if (!fs.existsSync(csrfFile)) {
    console.error(`  ✗ CSRF token file not found: ${csrfFile}`);
    console.error(`    How to get it:`);
    console.error(`    1. Open any Amazon product review page in your browser`);
    console.error(`    2. Open DevTools → Network tab`);
    console.error(`    3. Click any star filter or pagination button`);
    console.error(`    4. Find the AJAX request to /portal/customer-reviews/ajax/reviews/get/...`);
    console.error(`    5. Copy the 'anti-csrftoken-a2z' request header value`);
    console.error(`    6. Paste into: ${csrfFile}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(csrfFile, 'utf8').trim();
  console.log(`  ✓ Loaded CSRF token (${raw.length} chars)`);
  return raw;
}

// ---------------------------------------------------------------------------
// Sentiment scoring (simple keyword-based, no deps)
// ---------------------------------------------------------------------------
const POSITIVE_WORDS = new Set([
  'excellent', 'amazing', 'great', 'good', 'love', 'best', 'perfect',
  'wonderful', 'awesome', 'fantastic', 'happy', 'satisfied', 'quality',
  'recommend', 'value', 'worth', 'durable', 'sturdy', 'nice', 'superb',
  'brilliant', 'outstanding', 'reliable', 'strong', 'beautiful',
  'impressed', 'premium', 'solid', 'comfortable', 'useful',
]);
const NEGATIVE_WORDS = new Set([
  'bad', 'poor', 'worst', 'terrible', 'horrible', 'awful', 'waste',
  'broken', 'defective', 'disappointed', 'cheap', 'flimsy', 'leak',
  'damage', 'rust', 'crack', 'fake', 'useless', 'pathetic', 'regret',
  'return', 'refund', 'fail', 'issue', 'problem', 'complaint',
  'missing', 'wrong', 'delayed', 'stuck', 'danger',
]);

function computeSentiment(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);
  let pos = 0, neg = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) pos++;
    if (NEGATIVE_WORDS.has(w)) neg++;
  }
  const total = pos + neg;
  return total === 0 ? 0 : Math.round(((pos - neg) / total) * 100) / 100;
}

// Star filter values for Amazon product-reviews page
const STAR_FILTERS = ['one_star', 'two_star', 'three_star', 'four_star', 'five_star'];
const MAX_PAGES_PER_STAR = 10; // Amazon caps at ~100 reviews per star filter (10 pages × 10)

// ---------------------------------------------------------------------------
// GET a product-reviews page — for summary (unfiltered) OR first page of a star filter
// Returns { summary?, reviews[], csrfToken? }
// ---------------------------------------------------------------------------
async function fetchReviewsPageGET(asin, sortBy, cookieStr, config, filterByStar = '') {
  let url = `https://${config.domain}/product-reviews/${asin}?ie=UTF8&reviewerType=all_reviews&sortBy=${sortBy}&pageNumber=1`;
  if (filterByStar) url += `&filterByStar=${filterByStar}`;
  const ua = randomUA();
  const headers = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
    'Cookie': cookieStr,
    'Sec-Ch-Ua': '"Chromium";v="146", "Microsoft Edge";v="146", "Not:A-Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  };

  try {
    const resp = await fetch(url, { headers, redirect: 'follow' });
    if (!resp.ok) {
      console.log(`    ✗ HTTP ${resp.status}`);
      return null;
    }
    const html = await resp.text();

    // CAPTCHA check
    if (html.includes('validateCaptcha') || html.includes('Sorry, we just need to make sure')) {
      console.log(`    ✗ CAPTCHA! Pausing 60s...`);
      await new Promise(r => setTimeout(r, 60000));
      return null;
    }

    // Sign-in redirect check
    if (html.includes('ap_email') && html.includes('Sign-In')) {
      console.log(`    ✗ Redirected to sign-in! Cookies may be expired.`);
      return null;
    }

    const $ = cheerio.load(html);
    const result = { reviews: [] };

    // Extract CSRF token for AJAX pagination
    // Look for anti-csrftoken-a2z in meta, data attributes, or script blocks
    const csrfMeta = $('meta[name="anti-csrftoken-a2z"]').attr('content');
    if (csrfMeta) {
      result.csrfToken = csrfMeta;
    } else {
      // Try to find in page source (sometimes in JS or data attributes)
      const csrfMatch = html.match(/anti-csrftoken-a2z['"]\s*(?::|content=)['"]\s*([^'"]+)/i);
      if (csrfMatch) result.csrfToken = csrfMatch[1];
    }

    // Parse reviews from this page
    $('[data-hook="review"]').each((_, el) => {
      const review = parseSingleReview($, $(el), asin, sortBy);
      if (review && review.review_id) {
        result.reviews.push(review);
      }
    });

    // If NO star filter, extract summary data (used for initial scan)
    if (!filterByStar) {
      const summary = { asin, star_breakdown: {} };
      summary.product_title = $('a[data-hook="product-link"]').text().trim();

      const starText = $('[data-hook="average-star-rating"] .a-icon-alt').text().trim();
      const starMatch = starText.match(/([\d.]+)\s+out\s+of\s+5/);
      summary.overall_rating = starMatch ? parseFloat(starMatch[1]) : null;

      const totalText = $('[data-hook="total-review-count"]').text().trim();
      const totalMatch = totalText.match(/([\d,]+)/);
      summary.total_ratings_count = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : 0;

      // Customer REVIEW count (actual written reviews, NOT ratings)
      summary.customer_review_count = 0;
      const crMatch = html.match(/(\d[\d,]*)\s+customer\s+review/i);
      if (crMatch) {
        summary.customer_review_count = parseInt(crMatch[1].replace(/,/g, ''), 10);
      }
      if (!summary.customer_review_count) {
        const filterText = $('[data-hook="cr-filter-info-review-rating-count"]').text().trim();
        const fiMatch = filterText.match(/([\d,]+)\s+with\s+review/i);
        if (fiMatch) summary.customer_review_count = parseInt(fiMatch[1].replace(/,/g, ''), 10);
      }
      if (!summary.customer_review_count && summary.total_ratings_count > 0) {
        summary.customer_review_count = summary.total_ratings_count;
      }

      // Star histogram
      $('table#histogramTable tr, tr.a-histogram-row').each((_, row) => {
        const text = $(row).text();
        const sMatch = text.match(/(\d)\s*star/i);
        const pMatch = text.match(/(\d+)\s*%/);
        if (sMatch && pMatch) {
          const star = parseInt(sMatch[1], 10);
          const pct = parseInt(pMatch[1], 10);
          summary.star_breakdown[star] = {
            pct,
            count: summary.total_ratings_count > 0 ? Math.round(summary.total_ratings_count * pct / 100) : 0,
          };
        }
      });
      for (let s = 1; s <= 5; s++) {
        if (!summary.star_breakdown[s]) summary.star_breakdown[s] = { pct: 0, count: 0 };
      }
      result.summary = summary;
    }

    return result;
  } catch (err) {
    console.log(`    ✗ Error GET ${asin}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AJAX POST to fetch paginated reviews (pages 2+)
// This is the endpoint Amazon's browser JS uses for star-filtered pagination
// Returns { reviews[] }
// ---------------------------------------------------------------------------
async function fetchReviewsAjax(asin, sortBy, pageNumber, cookieStr, config, filterByStar, csrfToken, refererUrl) {
  const ajaxUrl = `https://${config.domain}/portal/customer-reviews/ajax/reviews/get/ref=cm_cr_getr_d_paging_btm_next_${pageNumber}`;
  const ua = randomUA();

  const body = new URLSearchParams({
    sortBy,
    reviewerType: '',
    formatType: '',
    mediaType: '',
    filterByStar: filterByStar || '',
    filterByAge: '',
    pageNumber: String(pageNumber),
    filterByLanguage: '',
    filterByKeyword: '',
    shouldAppend: 'undefined',
    deviceType: 'desktop',
    canShowIntHeader: 'undefined',
    reviewsShown: 'undefined',
    reftag: `cm_cr_getr_d_paging_btm_next_${pageNumber}`,
    pageSize: '10',
    asin,
    scope: 'reviewsAjax1',
  }).toString();

  const headers = {
    'User-Agent': ua,
    'Accept': 'text/html,*/*',
    'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'Cookie': cookieStr,
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Ch-Ua': '"Chromium";v="146", "Microsoft Edge";v="146", "Not:A-Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Referer': refererUrl || `https://${config.domain}/product-reviews/${asin}`,
  };

  // Add CSRF token if available
  if (csrfToken) {
    headers['anti-csrftoken-a2z'] = csrfToken;
  }

  try {
    const resp = await fetch(ajaxUrl, { method: 'POST', headers, body, redirect: 'follow' });
    if (!resp.ok) {
      if (resp.status === 403) {
        console.log(`    ✗ AJAX 403 (CSRF expired)`);
        return { is403: true, reviews: [] };
      }
      console.log(`    ✗ AJAX HTTP ${resp.status}`);
      return null;
    }
    const text = await resp.text();

    // CAPTCHA / sign-in check
    if (text.includes('validateCaptcha') || (text.includes('ap_email') && text.includes('Sign-In'))) {
      console.log(`    ✗ CAPTCHA/Sign-in on AJAX! Pausing 60s...`);
      await new Promise(r => setTimeout(r, 60000));
      return null;
    }

    // Parse &&&-delimited response
    // Each chunk is a JSON array: ["action", "selector", "html"]
    const chunks = text.split('&&&').map(c => c.trim()).filter(Boolean);
    let reviewHtml = '';

    for (const chunk of chunks) {
      try {
        const parsed = JSON.parse(chunk);
        // Look for append to #cm_cr-review_list containing review HTML
        if (Array.isArray(parsed) && parsed.length >= 3) {
          const [action, selector, html] = parsed;
          if ((action === 'append' || action === 'update') &&
              selector === '#cm_cr-review_list' && html &&
              html.includes('data-hook="review"')) {
            reviewHtml += html;
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (!reviewHtml) return { reviews: [] };

    // Parse reviews from the HTML fragments
    const $ = cheerio.load(reviewHtml);
    const reviews = [];
    $('[data-hook="review"]').each((_, el) => {
      const review = parseSingleReview($, $(el), asin, sortBy);
      if (review && review.review_id) {
        reviews.push(review);
      }
    });

    return { reviews };
  } catch (err) {
    console.log(`    ✗ AJAX Error ${asin} p=${pageNumber}: ${err.message}`);
    return null;
  }
}

function parseSingleReview($, $item, asin, sortMode) {
  const review = { asin, sort_mode: sortMode };

  // Review ID
  review.review_id = $item.attr('id') || '';

  // Reviewer name
  review.reviewer_name = $item.find('span.a-profile-name').first().text().trim();

  // Star rating
  const starEl = $item.find('i[data-hook="review-star-rating"]');
  if (starEl.length) {
    const cls = starEl.attr('class') || '';
    const starMatch = cls.match(/a-star-(\d)/);
    review.star_rating = starMatch ? parseInt(starMatch[1], 10) : null;
    // Also try alt text for decimal precision
    const altText = starEl.find('span.a-icon-alt').text();
    const altMatch = altText.match(/([\d.]+)\s+out/);
    if (altMatch) review.star_rating = parseFloat(altMatch[1]);
  } else {
    review.star_rating = null;
  }

  // Review title
  const titleEl = $item.find('a[data-hook="review-title"]');
  if (titleEl.length) {
    // Title is in the last span (after the star icon span)
    const spans = titleEl.find('span');
    review.review_title = spans.last().text().trim();
  } else {
    review.review_title = '';
  }

  // Review date + country
  const dateText = $item.find('span[data-hook="review-date"]').text().trim();
  review.review_date_raw = dateText;

  const countryMatch = dateText.match(/Reviewed\s+in\s+(.+?)\s+on\s+/i);
  review.country = countryMatch ? countryMatch[1] : '';

  const dateMatch = dateText.match(/on\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[1]);
      review.review_date = !isNaN(d) ? d.toISOString().slice(0, 10) : dateMatch[1];
    } catch {
      review.review_date = dateMatch[1];
    }
  } else {
    review.review_date = '';
  }

  // Variant
  review.variant = $item.find('a[data-hook="format-strip"]').text().trim();

  // Verified purchase
  review.verified_purchase = $item.find('span[data-hook="avp-badge"]').length > 0;

  // Review body
  const bodyEl = $item.find('span[data-hook="review-body"]');
  if (bodyEl.length) {
    // Get text from inner spans, skip video blocks
    const innerSpans = bodyEl.find('> span');
    if (innerSpans.length) {
      review.review_body = innerSpans.map((_, s) => {
        if ($(s).find('.video-block').length) return '';
        return $(s).text().trim();
      }).get().filter(Boolean).join(' ');
    } else {
      review.review_body = bodyEl.text().trim();
    }
  } else {
    review.review_body = '';
  }

  // Helpful count
  const helpfulText = $item.find('span[data-hook="helpful-vote-statement"]').text().trim();
  if (helpfulText) {
    const helpMatch = helpfulText.match(/(\d[\d,]*)/);
    if (helpMatch) {
      review.helpful_count = parseInt(helpMatch[1].replace(/,/g, ''), 10);
    } else if (helpfulText.toLowerCase().includes('one')) {
      review.helpful_count = 1;
    } else {
      review.helpful_count = 0;
    }
  } else {
    review.helpful_count = 0;
  }

  // Images
  const imgTiles = $item.find('img.review-image-tile, img[class*="review-image"]');
  review.has_images = imgTiles.length > 0 || $item.find('[class*="review-image"]').length > 0;
  review.image_count = imgTiles.length || ($item.find('[class*="review-image-tile-section"]').length ? 1 : 0);

  // Video
  const videoBlock = $item.find('.video-block');
  review.has_video = videoBlock.length > 0;
  review.video_count = Math.max(videoBlock.length, $item.find('[class*="cr-video"]').length);

  // Length classification
  const bodyLen = review.review_body.length;
  review.length_class = bodyLen < 50 ? 'short' : bodyLen < 200 ? 'medium' : 'detailed';

  // Sentiment
  review.sentiment_score = computeSentiment(review.review_body);

  return review;
}

// ---------------------------------------------------------------------------
// Progress / Resume
// ---------------------------------------------------------------------------
function loadProgress(config) {
  try {
    if (fs.existsSync(config.progress_file)) {
      return JSON.parse(fs.readFileSync(config.progress_file, 'utf8'));
    }
  } catch {}
  return { completed_asins: [], summaries: {}, phase: 'init' };
}

function saveProgress(progress, config) {
  fs.writeFileSync(config.progress_file, JSON.stringify(progress, null, 2));
}

// ---------------------------------------------------------------------------
// XLSX Export
// ---------------------------------------------------------------------------
function exportXlsx(summaries, allReviews, config) {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Summary ---
  const sumHeaders = [
    'ASIN', 'Product Title', 'Overall Rating',
    'Total Ratings Count', 'Customer Review Count',
    '5★ %', '4★ %', '3★ %', '2★ %', '1★ %',
    '5★ Count', '4★ Count', '3★ Count', '2★ Count', '1★ Count',
    'Reviews Downloaded', 'Unique After Dedup', 'Scraped At',
  ];
  const sumRows = [sumHeaders];

  for (const [asin, s] of Object.entries(summaries)) {
    const asinReviews = allReviews.filter(r => r.asin === asin);
    const bd = s.star_breakdown || {};
    sumRows.push([
      asin,
      s.product_title || '',
      s.overall_rating,
      s.total_ratings_count || 0,
      s.customer_review_count || 0,
      (bd[5] || {}).pct || 0, (bd[4] || {}).pct || 0, (bd[3] || {}).pct || 0,
      (bd[2] || {}).pct || 0, (bd[1] || {}).pct || 0,
      (bd[5] || {}).count || 0, (bd[4] || {}).count || 0, (bd[3] || {}).count || 0,
      (bd[2] || {}).count || 0, (bd[1] || {}).count || 0,
      s.total_downloaded || 0,
      asinReviews.length,
      new Date().toISOString().slice(0, 16).replace('T', ' '),
    ]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(sumRows);
  // Set column widths
  wsSummary['!cols'] = sumHeaders.map((h, i) => ({ wch: i === 1 ? 40 : Math.max(h.length + 2, 12) }));
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --- Sheet 2: Reviews ---
  const revHeaders = [
    'ASIN', 'Review ID', 'Reviewer Name', 'Star Rating',
    'Review Title', 'Review Date', 'Variant',
    'Verified Purchase', 'Review Body',
    'Helpful Count', 'Has Images', 'Image Count',
    'Has Video', 'Video Count',
    'Country', 'Length Class', 'Sentiment Score', 'Sort Mode',
  ];
  const revRows = [revHeaders];

  for (const r of allReviews) {
    revRows.push([
      r.asin, r.review_id, r.reviewer_name, r.star_rating,
      r.review_title, r.review_date, r.variant,
      r.verified_purchase ? 'Yes' : 'No', r.review_body,
      r.helpful_count, r.has_images ? 'Yes' : 'No', r.image_count,
      r.has_video ? 'Yes' : 'No', r.video_count,
      r.country, r.length_class, r.sentiment_score, r.sort_mode,
    ]);
  }

  const wsReviews = XLSX.utils.aoa_to_sheet(revRows);
  wsReviews['!cols'] = revHeaders.map((h, i) => {
    if (h === 'Review Body') return { wch: 60 };
    return { wch: Math.max(h.length + 2, 14) };
  });
  XLSX.utils.book_append_sheet(wb, wsReviews, 'Reviews');

  const outPath = config.output_file;
  XLSX.writeFile(wb, outPath);
  console.log(`\n  ✓ Saved ${Object.keys(summaries).length} ASINs + ${allReviews.length} reviews → ${outPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const testAsin = args.includes('--test-asin') ? args[args.indexOf('--test-asin') + 1] : null;
  const resume = args.includes('--resume');
  const force = args.includes('--force');

  const config = loadConfig();
  console.log('='.repeat(60));
  console.log('  Amazon Review Bulk Downloader (Node.js)');
  console.log('='.repeat(60));
  console.log(`  Min review count: ${config.min_review_count}`);
  console.log(`  Sort modes:       ${config.sort_modes.join(', ')}`);
  console.log(`  Delay:            ${config.delay_min_ms}–${config.delay_max_ms}ms`);
  console.log(`  Input:            ${config.input_file}`);
  console.log(`  Output:           ${config.output_file}`);
  console.log();

  // Load ASINs
  let asins;
  if (testAsin) {
    asins = [testAsin];
    console.log(`  TEST MODE: single ASIN ${testAsin}`);
  } else {
    if (!fs.existsSync(config.input_file)) {
      console.error(`  ✗ Input file not found: ${config.input_file}`);
      process.exit(1);
    }
    const wbIn = XLSX.readFile(config.input_file);
    const wsIn = wbIn.Sheets[wbIn.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(wsIn, { header: 1 });
    // Skip header row, get first column
    asins = data.slice(1).map(row => row && row[0] ? String(row[0]).trim() : '').filter(Boolean);
    console.log(`  Loaded ${asins.length} ASINs from ${config.input_file}`);
  }

  // ---------------------------------------------------------------------------
  // Persistent Playwright browser for CSRF token extraction
  // Opens ONCE at startup, extracts initial CSRF, then stays idle.
  // Only re-navigates when a 403 is detected (CSRF expired).
  // ---------------------------------------------------------------------------
  let cookieStr = loadCookies(config);
  let csrfToken = '';
  let playwrightBrowser = null;
  let playwrightContext = null;
  let playwrightPage = null;
  const CSRF_SEED_ASIN = 'B09F3NMRGF'; // Any valid ASIN to seed the initial CSRF

  async function initPlaywright() {
    if (playwrightBrowser) return;
    try {
      const { chromium } = require('playwright');
      console.log('  🌐 Launching headless Edge...');
      playwrightBrowser = await chromium.launch({ headless: true, channel: 'msedge' });
      playwrightContext = await playwrightBrowser.newContext({
        userAgent: randomUA(),
        viewport: { width: 1280, height: 800 },
        locale: 'en-IN',
      });
      const cookies = cookieStr.split(';').map(c => c.trim()).filter(Boolean).map(c => {
        const eqIdx = c.indexOf('=');
        return {
          name: c.substring(0, eqIdx).trim(),
          value: c.substring(eqIdx + 1).trim(),
          domain: '.amazon.in', path: '/', httpOnly: false, secure: true, sameSite: 'None',
        };
      });
      await playwrightContext.addCookies(cookies);
      playwrightPage = await playwrightContext.newPage();
      console.log('  ✓ Headless Edge ready');

      // Get initial CSRF token
      const ok = await refreshCsrf();
      if (!ok) {
        console.log('  ✗ Could not get initial CSRF token');
        // Try file-based fallback
        try { csrfToken = fs.readFileSync(config.csrf_file, 'utf8').trim(); } catch {}
      }
    } catch (e) {
      console.log(`  ✗ Playwright init failed: ${e.message}`);
      try { csrfToken = fs.readFileSync(config.csrf_file, 'utf8').trim(); } catch {}
    }
  }

  // Navigate to a review page and extract CSRF from #cr-state-object
  // CSRF tokens are ASIN-specific — pass the current ASIN on 403 retry
  async function refreshCsrf(asin) {
    if (!playwrightPage) return false;
    const targetAsin = asin || CSRF_SEED_ASIN;
    try {
      const url = `https://${config.domain}/product-reviews/${targetAsin}?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=1`;
      await playwrightPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await playwrightPage.waitForTimeout(3000);

      const isSignIn = await playwrightPage.evaluate(() =>
        document.querySelector('#ap_email') !== null || document.title.includes('Sign-In')
      );
      if (isSignIn) {
        console.log('    ✗ Browser session expired (sign-in)');
        return false;
      }

      const token = await playwrightPage.evaluate(() => {
        const el = document.querySelector('#cr-state-object');
        if (el) {
          try { return JSON.parse(el.getAttribute('data-state') || '{}').reviewsCsrfToken || ''; }
          catch { return ''; }
        }
        return '';
      });

      if (token) {
        csrfToken = token;
        // Refresh cookies from browser too
        const allCookies = await playwrightContext.cookies();
        const fresh = allCookies.filter(c => c.domain.includes('amazon')).map(c => `${c.name}=${c.value}`).join('; ');
        if (fresh.length > 500) cookieStr = fresh;
        console.log(`    ✓ CSRF refreshed (${token.length} chars)`);
        return true;
      }
      console.log('    ✗ No CSRF token in page');
      return false;
    } catch (e) {
      console.log(`    ✗ CSRF refresh error: ${e.message}`);
      return false;
    }
  }

  async function closePlaywright() {
    if (playwrightBrowser) {
      await playwrightBrowser.close().catch(() => {});
      playwrightBrowser = null;
    }
  }

  await initPlaywright();

  // Load progress
  let progress = resume ? loadProgress(config) : { completed_asins: [], summaries: {}, phase: 'init' };
  const summaries = progress.summaries || {};
  let allReviews = [];
  const reviewsFile = config.progress_file.replace('.json', '.reviews.json');

  if (resume && fs.existsSync(reviewsFile)) {
    try {
      allReviews = JSON.parse(fs.readFileSync(reviewsFile, 'utf8'));
      console.log(`  Resumed ${allReviews.length} existing reviews`);
    } catch {}
  }

  const completed = new Set(progress.completed_asins || []);
  const total = asins.length;
  const qualifying = [];

  // ---- Single-Phase: Fetch page 1 for summary + decide + paginate ----
  console.log(`\n  Scanning ${total} ASINs (page 1 → summary + first reviews)...`);
  console.log(`  (Already completed: ${completed.size})`);
  console.log();

  for (let idx = 0; idx < total; idx++) {
    const asin = asins[idx];
    const pct = ((idx + 1) / total * 100).toFixed(0);

    // Skip if already completed (resume mode)
    if (completed.has(asin)) {
      if (summaries[asin] && (summaries[asin].customer_review_count || 0) >= config.min_review_count) {
        qualifying.push(asin);
      }
      continue;
    }

    // If we already have summary from a previous partial run, use it
    if (summaries[asin] && !force) {
      const s = summaries[asin];
      const rc = s.customer_review_count || 0;
      if (rc >= config.min_review_count || force) {
        qualifying.push(asin);
      }
      continue;
    }

    process.stdout.write(`  [${idx + 1}/${total}] (${pct}%) ${asin}... `);

    // Fetch page 1 of product-reviews (NO star filter) — gives us summary
    const page1 = await fetchReviewsPageGET(asin, 'recent', cookieStr, config);
    await randomDelay(config);

    if (!page1 || !page1.summary) {
      console.log('SKIP (fetch failed)');
      summaries[asin] = { asin, error: 'fetch_failed', customer_review_count: 0, total_ratings_count: 0 };
      continue;
    }

    const summary = page1.summary;
    const rc = summary.customer_review_count || 0;
    const ratingCount = summary.total_ratings_count || 0;
    const title = (summary.product_title || '').slice(0, 40);
    const rating = summary.overall_rating || '?';

    if (rc === 0) {
      console.log(`→ 0 reviews (${ratingCount} ratings), ★${rating} — ${title}... NO REVIEWS`);
      summaries[asin] = summary;
      continue;
    }

    console.log(`✓ ${rc} reviews (${ratingCount} ratings), ★${rating} — ${title}`);
    qualifying.push(asin);

    // Star-by-star scraping — ALL via AJAX POST
    // Strategy: use 'recent' first. If all 10 pages exhausted for a star,
    // that star has >100 reviews → re-fetch with 'helpful' to get more unique reviews
    const asinReviewsRaw = [];
    const seenIdsRealtime = new Set();
    let totalDownloaded = 0;
    const refererUrl = `https://${config.domain}/product-reviews/${asin}/ref=cm_cr_unknown?ie=UTF8&sortBy=recent&pageNumber=1`;

    for (const starFilter of STAR_FILTERS) {
      const starNum = STAR_FILTERS.indexOf(starFilter) + 1;

      // Phase 1: 'recent' sort
      process.stdout.write(`    ${starNum}★ recent`);
      let recentExhausted = false;

      for (let page = 1; page <= MAX_PAGES_PER_STAR; page++) {
        let result = await fetchReviewsAjax(asin, 'recent', page, cookieStr, config, starFilter, csrfToken, refererUrl);

        // Auto-refresh CSRF on 403
        if (result && result.is403) {
          const refreshed = await refreshCsrf(asin);
          if (refreshed) {
            result = await fetchReviewsAjax(asin, 'recent', page, cookieStr, config, starFilter, csrfToken, refererUrl);
          } else {
            break; // Can't refresh — skip this star
          }
        }

        await randomDelay(config);
        const reviews = result ? result.reviews : null;

        if (!reviews || reviews.length === 0) break;

        let newCount = 0;
        for (const r of reviews) {
          if (r.review_id && !seenIdsRealtime.has(r.review_id)) {
            seenIdsRealtime.add(r.review_id);
            asinReviewsRaw.push(r);
            newCount++;
          }
        }
        totalDownloaded += newCount;

        if (newCount === 0) {
          process.stdout.write('×');
          break;
        }
        process.stdout.write(`[${newCount}]`);

        // If we reached page 10 with new reviews, this star has >100 reviews
        if (page === MAX_PAGES_PER_STAR) {
          recentExhausted = true;
        }
      }
      console.log(` → ${totalDownloaded} total`);

      // Phase 2: If 10 pages exhausted with 'recent', try 'helpful' for more unique
      if (recentExhausted) {
        process.stdout.write(`    ${starNum}★ helpful`);

        for (let page = 1; page <= MAX_PAGES_PER_STAR; page++) {
          let result = await fetchReviewsAjax(asin, 'helpful', page, cookieStr, config, starFilter, csrfToken, refererUrl);
          if (result && result.is403) {
            const refreshed = await refreshCsrf();
            if (refreshed) {
              result = await fetchReviewsAjax(asin, 'helpful', page, cookieStr, config, starFilter, csrfToken, refererUrl);
            } else { break; }
          }
          await randomDelay(config);
          const reviews = result ? result.reviews : null;

          if (!reviews || reviews.length === 0) break;

          let newCount = 0;
          for (const r of reviews) {
            if (r.review_id && !seenIdsRealtime.has(r.review_id)) {
              seenIdsRealtime.add(r.review_id);
              asinReviewsRaw.push(r);
              newCount++;
            }
          }
          totalDownloaded += newCount;

          if (newCount === 0) {
            process.stdout.write('×');
            break;
          }
          process.stdout.write(`[${newCount}]`);
        }
        console.log(` → ${totalDownloaded} total`);
      }
    }

    // Deduplicate
    const existingIds = new Set(allReviews.filter(r => r.asin === asin).map(r => r.review_id));
    const seenIds = new Set();
    const deduped = [];

    for (const r of asinReviewsRaw) {
      const rid = r.review_id;
      if (rid && !seenIds.has(rid) && !existingIds.has(rid)) {
        seenIds.add(rid);
        deduped.push(r);
      }
    }

    allReviews.push(...deduped);
    summary.total_downloaded = totalDownloaded;

    console.log(`    → ${totalDownloaded} raw → ${deduped.length} unique (deduped)`);

    // Mark completed
    completed.add(asin);
    progress.completed_asins = Array.from(completed);

    summaries[asin] = summary;

    // Save progress every 5 ASINs
    if ((idx + 1) % 5 === 0) {
      progress.summaries = summaries;
      saveProgress(progress, config);
      // Save reviews incrementally
      fs.writeFileSync(reviewsFile, JSON.stringify(allReviews));
    }
  }

  // Save final progress
  progress.summaries = summaries;
  progress.phase = 'done';
  saveProgress(progress, config);
  fs.writeFileSync(reviewsFile, JSON.stringify(allReviews));

  // ---- Export XLSX ----
  await closePlaywright();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Exporting ${Object.keys(summaries).length} ASINs, ${allReviews.length} reviews...`);
  exportXlsx(summaries, allReviews, config);

  // Final stats
  console.log(`\n  ${'='.repeat(60)}`);
  console.log(`  FINAL STATS`);
  console.log(`  ${'='.repeat(60)}`);
  console.log(`  Total ASINs scanned:     ${asins.length}`);
  console.log(`  Qualifying (>=${config.min_review_count} reviews): ${qualifying.length}`);
  console.log(`  Total reviews collected:  ${allReviews.length}`);
  const avgPer = qualifying.length > 0 ? (allReviews.length / qualifying.length).toFixed(0) : 0;
  console.log(`  Avg reviews per ASIN:     ${avgPer}`);
  console.log(`  Output:                   ${config.output_file}`);
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
