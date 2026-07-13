const fs = require('fs');
const cheerio = require('cheerio');

const cookieStr = fs.readFileSync('C:\\Users\\monst\\Downloads\\amazon_cookies.txt', 'utf8').trim();
const asin = 'B09F3NMRGF';
const domain = 'www.amazon.in';

// Full browser-like headers (same as the working scraper)
function getHeaders(cookie, referer) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
    'Cookie': cookie,
    'Sec-Ch-Ua': '"Chromium";v="146", "Microsoft Edge";v="146", "Not:A-Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    ...(referer ? { 'Referer': referer } : {}),
  };
}

async function fetchPage(url, referer) {
  const resp = await fetch(url, { headers: getHeaders(cookieStr, referer), redirect: 'follow' });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const ids = [];
  $('[data-hook="review"]').each((_, el) => ids.push($(el).attr('id')));
  const hasReviews = ids.length > 0;
  const countMatch = html.match(/(\d[\d,]*)\s+(?:matching\s+)?customer\s+review/i);
  return { ids, count: countMatch ? countMatch[1] : '?', status: resp.status, hasReviews, pageLen: html.length };
}

async function main() {
  console.log('=== Step 1: Check page 1 with full headers (NO star filter) ===');
  const p1 = await fetchPage(`https://${domain}/product-reviews/${asin}?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=1`);
  console.log(`Page 1: ${p1.ids.length} reviews, count="${p1.count}", hasReviews=${p1.hasReviews}, pageLen=${p1.pageLen}`);
  
  if (!p1.hasReviews) {
    console.log('\n!!! Cookies may be expired — no reviews on page 1 !!!');
    return;
  }
  
  console.log(`IDs: ${p1.ids.slice(0, 3).join(', ')}...`);
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Test star filter page 1 with different URL formats
  console.log('\n=== Step 2: Star filter (one_star) page 1 ===');
  const sf1 = await fetchPage(`https://${domain}/product-reviews/${asin}?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=1&filterByStar=one_star`);
  console.log(`Star filter P1: ${sf1.ids.length} reviews, count="${sf1.count}"`);
  if (sf1.ids.length) console.log(`IDs: ${sf1.ids.join(', ')}`);
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Test page 2 with ref= path for pagination
  console.log('\n=== Step 3: Star filter (one_star) page 2 with ref= ===');
  const referer = `https://${domain}/product-reviews/${asin}/ref=cm_cr_arp_d_viewopt_sr?ie=UTF8&sortBy=recent&pageNumber=1&filterByStar=one_star`;
  
  // Format: /ref=cm_cr_getr_d_paging_btm_next_2 in path
  const sf2 = await fetchPage(
    `https://${domain}/product-reviews/${asin}/ref=cm_cr_getr_d_paging_btm_next_2?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=2&filterByStar=one_star`,
    referer
  );
  console.log(`Star filter P2 (with ref path): ${sf2.ids.length} reviews, count="${sf2.count}"`);
  if (sf2.ids.length) {
    console.log(`IDs: ${sf2.ids.join(', ')}`);
    const newIds = sf2.ids.filter(id => !sf1.ids.includes(id));
    console.log(`NEW: ${newIds.length}/${sf2.ids.length} (${newIds.join(', ')})`);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Also test without star filter, page 2 (this should work)
  console.log('\n=== Step 4: NO star filter, page 2 (should work) ===');
  const np2 = await fetchPage(
    `https://${domain}/product-reviews/${asin}/ref=cm_cr_getr_d_paging_btm_next_2?ie=UTF8&reviewerType=all_reviews&sortBy=recent&pageNumber=2`
  );
  console.log(`No filter P2: ${np2.ids.length} reviews`);
  if (np2.ids.length) {
    const newIds = np2.ids.filter(id => !p1.ids.includes(id));
    console.log(`NEW vs P1: ${newIds.length}/${np2.ids.length}`);
  }
}

main().catch(console.error);
