"""
Phase 2: Competitor Product Discovery
Scrape Amazon.in to discover competitor products for each category.
"""
import json
import re
import time
import random
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from datetime import datetime

# Competitor brands to scrape
COMPETITORS = ['Hawkins', 'Pigeon', 'Butterfly', 'Philips', 'Preethi', 'Bajaj']

# Categories to search (from Phase 1 analysis)
CATEGORIES = [
    'Pressure Cooker',
    'Gas Stove',
    'Mixer Grinder',
    'Induction Cooktop',
    'Electric Kettle',
    'Rice Cooker',
    'Tawa',
    'Kadai',
    'Fry Pan',
    'Air Fryer',
]

# User-Agent rotation
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

def get_headers():
    """Get random headers for request."""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

def search_amazon(brand, category, max_products=5):
    """Search Amazon.in for products and return top results."""
    query = f"{brand} {category}"
    url = f"https://www.amazon.in/s?k={quote_plus(query)}"
    
    print(f"  Searching: {query}")
    
    try:
        response = requests.get(url, headers=get_headers(), timeout=15)
        if response.status_code != 200:
            print(f"    ⚠️ Status {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        products = []
        
        # Find product cards
        for item in soup.select('[data-component-type="s-search-result"]')[:max_products]:
            try:
                # Extract ASIN
                asin = item.get('data-asin', '')
                if not asin:
                    continue
                
                # Extract product name
                title_elem = item.select_one('h2 a span')
                name = title_elem.get_text(strip=True) if title_elem else ''
                
                # Extract rating
                rating_elem = item.select_one('.a-icon-star-small .a-icon-alt')
                rating_text = rating_elem.get_text() if rating_elem else ''
                rating = float(re.search(r'([\d.]+)', rating_text).group(1)) if rating_text else 0
                
                # Extract review count
                review_elem = item.select_one('.a-size-base.s-underline-text')
                review_text = review_elem.get_text(strip=True) if review_elem else '0'
                review_count = int(re.sub(r'[^\d]', '', review_text)) if review_text else 0
                
                # Extract price
                price_elem = item.select_one('.a-price-whole')
                price = price_elem.get_text(strip=True).replace(',', '') if price_elem else '0'
                
                if name and asin:
                    products.append({
                        'productId': f"{brand.upper()[:3]}-{asin}",
                        'name': name[:150],
                        'brand': brand,
                        'category': category,
                        'amazonASIN': asin,
                        'amazonUrl': f"https://www.amazon.in/dp/{asin}",
                        'rating': rating,
                        'reviewCount': review_count,
                        'price': price,
                        'discoveredAt': datetime.now().isoformat()
                    })
            except Exception as e:
                continue
        
        return products
        
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return []

def main():
    all_products = []
    
    print("=" * 70)
    print("COMPETITOR PRODUCT DISCOVERY")
    print("=" * 70)
    
    for brand in COMPETITORS:
        print(f"\n🔍 Discovering {brand} products...")
        brand_products = []
        
        for category in CATEGORIES:
            products = search_amazon(brand, category, max_products=5)
            brand_products.extend(products)
            
            # Rate limiting - wait 2-4 seconds between requests
            time.sleep(random.uniform(2, 4))
        
        print(f"  ✅ Found {len(brand_products)} products for {brand}")
        all_products.extend(brand_products)
    
    # Remove duplicates by ASIN
    seen_asins = set()
    unique_products = []
    for p in all_products:
        if p['amazonASIN'] not in seen_asins:
            seen_asins.add(p['amazonASIN'])
            unique_products.append(p)
    
    # Save to file
    with open('src/data/competitor_products.json', 'w', encoding='utf-8') as f:
        json.dump(unique_products, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 70)
    print(f"DISCOVERY COMPLETE")
    print("=" * 70)
    print(f"Total unique products discovered: {len(unique_products)}")
    
    # Summary by brand
    brand_counts = {}
    for p in unique_products:
        brand_counts[p['brand']] = brand_counts.get(p['brand'], 0) + 1
    
    print("\nBy Brand:")
    for brand, count in sorted(brand_counts.items(), key=lambda x: -x[1]):
        print(f"  {brand}: {count}")
    
    print(f"\n✅ Saved to src/data/competitor_products.json")

if __name__ == "__main__":
    main()
