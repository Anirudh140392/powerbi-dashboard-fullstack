"""
Amazon Competitor Review Scraper
Fetches reviews for competitor products matching Prestige SKUs

This script:
1. Reads Prestige products from processed reviews
2. Searches Amazon for equivalent competitor products
3. Scrapes reviews for top 4-5 competitor SKUs per product category
4. Saves competitor reviews in JSON format for the dashboard
"""

import json
import time
import re
import requests
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup
import random

# Configuration
OUTPUT_PATH = Path('src/data/competitor_reviews.json')
COMPETITOR_MAPPINGS_PATH = Path('src/data/competitor_sku_mappings.json')
PRESTIGE_REVIEWS_PATH = Path('src/data/processed_reviews.json')

# Competitor brands to search for
COMPETITOR_BRANDS = ['Butterfly', 'Preethi', 'Bajaj', 'Philips', 'Pigeon', 'Morphy Richards', 'Havells']

# Product categories and their keywords for searching
PRODUCT_CATEGORIES = {
    'Rice Cooker': ['rice cooker', 'electric cooker'],
    'Mixer Grinder': ['mixer grinder', 'mixer'],
    'Pressure Cooker': ['pressure cooker', 'cooker'],
    'Induction Cooktop': ['induction cooktop', 'induction'],
    'Electric Kettle': ['electric kettle', 'kettle'],
    'Non-Stick Pan': ['non-stick pan', 'non stick', 'fry pan', 'tawa'],
    'Flask': ['flask', 'vacuum flask', 'thermos'],
    'Gas Stove': ['gas stove', 'gas hob', 'burner']
}

# User agent rotation for scraping
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
]

@dataclass
class CompetitorReview:
    """Structure for competitor review data"""
    id: str
    brand: str
    product_name: str
    asin: str
    rating: float
    text: str
    date: str
    sentiment: str = 'Neutral'
    characteristics: List[str] = None
    category: str = ''
    
    def __post_init__(self):
        if self.characteristics is None:
            self.characteristics = []

@dataclass
class CompetitorProduct:
    """Structure for competitor product mapping"""
    asin: str
    brand: str
    product_name: str
    category: str
    price: str = ''
    rating: float = 0.0
    review_count: int = 0
    prestige_equivalent: str = ''


class AmazonScraper:
    """Scraper for Amazon India product search and reviews"""
    
    BASE_URL = "https://www.amazon.in"
    
    def __init__(self):
        self.session = requests.Session()
        self._update_headers()
    
    def _update_headers(self):
        """Update session headers with random user agent"""
        self.session.headers.update({
            'User-Agent': random.choice(USER_AGENTS),
            'Accept-Language': 'en-IN,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        })
    
    def _safe_request(self, url: str, max_retries: int = 3) -> Optional[BeautifulSoup]:
        """Make a safe request with retries"""
        for attempt in range(max_retries):
            try:
                self._update_headers()
                time.sleep(random.uniform(2, 5))  # Rate limiting
                
                response = self.session.get(url, timeout=15)
                if response.status_code == 200:
                    return BeautifulSoup(response.content, 'html.parser')
                elif response.status_code == 503:
                    print(f"  Rate limited, waiting... (attempt {attempt + 1})")
                    time.sleep(random.uniform(10, 20))
                else:
                    print(f"  Status {response.status_code} for {url[:80]}...")
                    
            except Exception as e:
                print(f"  Error: {e}")
                time.sleep(5)
        
        return None
    
    def search_products(self, query: str, brand: str, max_results: int = 5) -> List[CompetitorProduct]:
        """Search Amazon for products matching query and brand"""
        search_query = f"{brand} {query}"
        encoded_query = requests.utils.quote(search_query)
        search_url = f"{self.BASE_URL}/s?k={encoded_query}"
        
        print(f"  Searching: {search_query}")
        
        soup = self._safe_request(search_url)
        if not soup:
            return []
        
        products = []
        results = soup.select('[data-component-type="s-search-result"]')
        
        for result in results[:max_results]:
            try:
                # Extract ASIN
                asin = result.get('data-asin', '')
                if not asin:
                    continue
                
                # Extract product name
                title_elem = result.select_one('h2 a span')
                product_name = title_elem.text.strip() if title_elem else ''
                
                # Verify brand matches
                if brand.lower() not in product_name.lower():
                    continue
                
                # Extract rating
                rating_elem = result.select_one('.a-icon-star-small .a-icon-alt')
                rating = 0.0
                if rating_elem:
                    rating_match = re.search(r'(\d+\.?\d*)', rating_elem.text)
                    if rating_match:
                        rating = float(rating_match.group(1))
                
                # Extract review count
                review_elem = result.select_one('.a-size-base.s-underline-text')
                review_count = 0
                if review_elem:
                    count_match = re.search(r'([\d,]+)', review_elem.text.replace(',', ''))
                    if count_match:
                        review_count = int(count_match.group(1).replace(',', ''))
                
                # Extract price
                price_elem = result.select_one('.a-price-whole')
                price = f"₹{price_elem.text.strip()}" if price_elem else ''
                
                products.append(CompetitorProduct(
                    asin=asin,
                    brand=brand,
                    product_name=product_name,
                    category='',
                    price=price,
                    rating=rating,
                    review_count=review_count
                ))
                
            except Exception as e:
                print(f"    Error parsing product: {e}")
                continue
        
        return products
    
    def get_product_reviews(self, asin: str, max_pages: int = 3) -> List[Dict]:
        """Fetch reviews for a product by ASIN"""
        all_reviews = []
        
        for page in range(1, max_pages + 1):
            review_url = f"{self.BASE_URL}/product-reviews/{asin}?pageNumber={page}"
            
            soup = self._safe_request(review_url)
            if not soup:
                break
            
            review_divs = soup.select('[data-hook="review"]')
            if not review_divs:
                break
            
            for review_div in review_divs:
                try:
                    # Extract rating
                    rating_elem = review_div.select_one('[data-hook="review-star-rating"] .a-icon-alt')
                    rating = 0.0
                    if rating_elem:
                        rating_match = re.search(r'(\d+\.?\d*)', rating_elem.text)
                        if rating_match:
                            rating = float(rating_match.group(1))
                    
                    # Extract review text
                    text_elem = review_div.select_one('[data-hook="review-body"] span')
                    text = text_elem.text.strip() if text_elem else ''
                    
                    # Extract date
                    date_elem = review_div.select_one('[data-hook="review-date"]')
                    date_text = date_elem.text.strip() if date_elem else ''
                    # Parse "Reviewed in India on 15 January 2024"
                    date_match = re.search(r'on (\d+ \w+ \d{4})', date_text)
                    date = date_match.group(1) if date_match else ''
                    
                    # Extract review ID
                    review_id = review_div.get('id', f'review_{len(all_reviews)}')
                    
                    if text:
                        all_reviews.append({
                            'id': review_id,
                            'rating': rating,
                            'text': text,
                            'date': date
                        })
                        
                except Exception as e:
                    print(f"    Error parsing review: {e}")
                    continue
            
            print(f"    Page {page}: {len(review_divs)} reviews")
        
        return all_reviews


def categorize_prestige_product(product_name: str) -> str:
    """Determine product category from Prestige product name"""
    product_lower = product_name.lower()
    
    for category, keywords in PRODUCT_CATEGORIES.items():
        for keyword in keywords:
            if keyword in product_lower:
                return category
    
    return 'Other'


def get_unique_categories_from_prestige() -> Dict[str, List[str]]:
    """Extract unique product categories from Prestige reviews"""
    with open(PRESTIGE_REVIEWS_PATH, 'r', encoding='utf-8') as f:
        reviews = json.load(f)
    
    category_products: Dict[str, List[str]] = {}
    
    for review in reviews:
        product = review.get('product', '')
        if not product:
            continue
        
        category = categorize_prestige_product(product)
        if category not in category_products:
            category_products[category] = []
        
        if product not in category_products[category]:
            category_products[category].append(product)
    
    return category_products


def analyze_sentiment(text: str) -> str:
    """Simple rule-based sentiment analysis"""
    positive_words = ['good', 'great', 'excellent', 'amazing', 'best', 'love', 'perfect', 'quality', 'recommend', 'happy', 'satisfied', 'worth', 'nice', 'superb', 'fantastic']
    negative_words = ['bad', 'worst', 'poor', 'terrible', 'waste', 'disappointed', 'broken', 'defective', 'not working', 'don\'t buy', 'avoid', 'useless', 'problem', 'issue', 'damaged', 'fake']
    
    text_lower = text.lower()
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    if pos_count > neg_count:
        return 'POSITIVE'
    elif neg_count > pos_count:
        return 'NEGATIVE'
    return 'NEUTRAL'


def main():
    """Main function to scrape competitor reviews"""
    print("=" * 60)
    print("Amazon Competitor Review Scraper")
    print("=" * 60)
    
    # Get Prestige categories
    categories = get_unique_categories_from_prestige()
    print(f"\nFound {len(categories)} product categories:")
    for cat, products in categories.items():
        print(f"  {cat}: {len(products)} Prestige products")
    
    # Initialize scraper
    scraper = AmazonScraper()
    
    all_competitor_reviews = []
    all_competitor_mappings = []
    
    # For each major category, search competitor products
    for category in ['Rice Cooker', 'Mixer Grinder', 'Pressure Cooker', 'Electric Kettle', 'Non-Stick Pan']:
        if category not in categories:
            continue
        
        print(f"\n{'='*40}")
        print(f"Category: {category}")
        print(f"{'='*40}")
        
        # Get sample Prestige product for reference
        prestige_products = categories[category][:3]  # Top 3 Prestige products
        
        # Search each competitor brand
        for brand in COMPETITOR_BRANDS[:4]:  # Limit to 4 brands per category
            print(f"\n  Brand: {brand}")
            
            # Search for competitor products in this category
            keywords = PRODUCT_CATEGORIES.get(category, [category.lower()])
            products = scraper.search_products(keywords[0], brand, max_results=2)
            
            for product in products:
                print(f"    Found: {product.product_name[:60]}...")
                product.category = category
                product.prestige_equivalent = prestige_products[0] if prestige_products else ''
                
                # Fetch reviews for this product
                print(f"    Fetching reviews for ASIN: {product.asin}")
                raw_reviews = scraper.get_product_reviews(product.asin, max_pages=2)
                
                # Convert to competitor review format
                for raw in raw_reviews:
                    comp_review = CompetitorReview(
                        id=raw['id'],
                        brand=brand,
                        product_name=product.product_name,
                        asin=product.asin,
                        rating=raw['rating'],
                        text=raw['text'],
                        date=raw['date'],
                        sentiment=analyze_sentiment(raw['text']),
                        category=category
                    )
                    all_competitor_reviews.append(asdict(comp_review))
                
                all_competitor_mappings.append(asdict(product))
                print(f"    Collected {len(raw_reviews)} reviews")
            
            # Rate limiting between brands
            time.sleep(random.uniform(3, 6))
    
    # Save results
    print(f"\n{'='*60}")
    print("Saving results...")
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_competitor_reviews, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved {len(all_competitor_reviews)} competitor reviews to {OUTPUT_PATH}")
    
    with open(COMPETITOR_MAPPINGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_competitor_mappings, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved {len(all_competitor_mappings)} product mappings to {COMPETITOR_MAPPINGS_PATH}")
    
    print("\nDone!")


if __name__ == '__main__':
    main()
