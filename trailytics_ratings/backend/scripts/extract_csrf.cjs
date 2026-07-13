/**
 * Local Playwright CSRF Token Extractor for Windows
 * Loads cookies into a headless Edge, navigates to Amazon review page,
 * waits for JS to generate the CSRF token, and saves it.
 */
const fs = require('fs');

async function main() {
  const { chromium } = require('playwright');

  const COOKIE_FILE = 'C:\\Users\\monst\\Downloads\\amazon_cookies.txt';
  const CSRF_OUTPUT = 'C:\\Users\\monst\\Downloads\\amazon_csrf.txt';
  const DOMAIN = 'www.amazon.in';
  const TEST_ASIN = 'B09F3NMRGF';

  console.log('=== Playwright CSRF Token Extractor (Local) ===');

  const cookieStr = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
  console.log(`Loaded cookies (${cookieStr.length} chars)`);

  const cookies = cookieStr.split(';').map(c => c.trim()).filter(Boolean).map(c => {
    const eqIdx = c.indexOf('=');
    return {
      name: c.substring(0, eqIdx).trim(),
      value: c.substring(eqIdx + 1).trim(),
      domain: '.amazon.in',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'None',
    };
  });

  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',  // Use installed Edge on Windows
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0',
    viewport: { width: 1280, height: 800 },
    locale: 'en-IN',
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  // Intercept AJAX to capture CSRF from request headers
  let capturedCsrf = '';
  page.on('request', req => {
    if (req.url().includes('portal/customer-reviews/ajax/reviews/get')) {
      const h = req.headers();
      if (h['anti-csrftoken-a2z']) {
        capturedCsrf = h['anti-csrftoken-a2z'];
        console.log(`Captured CSRF from AJAX: ${capturedCsrf.slice(0, 30)}...`);
      }
    }
  });

  const reviewUrl = `https://${DOMAIN}/product-reviews/${TEST_ASIN}?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=1&filterByStar=five_star`;
  console.log(`Navigating to: ${reviewUrl}`);

  try {
    await page.goto(reviewUrl, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log(`Nav warning: ${e.message}`);
  }

  // Check sign-in
  const isSignIn = await page.evaluate(() =>
    document.querySelector('#ap_email') !== null || document.title.includes('Sign-In')
  );
  if (isSignIn) {
    console.log('ERROR: Redirected to sign-in.');
    await browser.close();
    process.exit(1);
  }

  const reviewCount = await page.evaluate(() =>
    document.querySelectorAll('[data-hook="review"]').length
  );
  console.log(`Reviews on page: ${reviewCount}`);

  // Extract CSRF from cr-state-object
  const csrfFromState = await page.evaluate(() => {
    const el = document.querySelector('#cr-state-object');
    if (el) {
      try {
        return JSON.parse(el.getAttribute('data-state') || '{}').reviewsCsrfToken || '';
      } catch { return ''; }
    }
    return '';
  });

  if (csrfFromState) {
    capturedCsrf = csrfFromState;
    console.log(`Got CSRF from cr-state-object: ${csrfFromState.slice(0, 30)}...`);
  }

  // If no CSRF yet, click Next page to trigger AJAX
  if (!capturedCsrf && reviewCount >= 10) {
    console.log('Clicking Next page...');
    try {
      await page.click('li.a-last a');
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log(`Click error: ${e.message}`);
    }
  }

  // Save fresh cookies
  const allCookies = await context.cookies();
  const freshCookieStr = allCookies.filter(c => c.domain.includes('amazon')).map(c => `${c.name}=${c.value}`).join('; ');
  fs.writeFileSync(COOKIE_FILE, freshCookieStr, 'utf8');
  console.log(`Saved fresh cookies (${freshCookieStr.length} chars)`);

  if (capturedCsrf) {
    fs.writeFileSync(CSRF_OUTPUT, capturedCsrf, 'utf8');
    console.log(`Saved CSRF token (${capturedCsrf.length} chars)`);
  } else {
    console.log('WARNING: Could not capture CSRF token');
  }

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
