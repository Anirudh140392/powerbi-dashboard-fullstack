"""
Reprocess Excel data into processed_reviews.json with correct field mapping.

Column mapping from dist/reviews_with_sentiment_and_characteristics.xlsx:
- review_time -> date (review date)
- star_rating -> rating (user's rating on Amazon)
- sentiment -> sentiment (characteristic sentiment: POSITIVE/NEGATIVE/NEUTRAL)
- characteristics -> characteristics (AI-extracted, may be blank)
- full_review -> text (original review sentence)
- pdp_title_value -> product (product name)
"""

import pandas as pd
import json
import ast
from datetime import datetime
import random

def parse_characteristics(val):
    """Parse characteristics from string representation of list."""
    if pd.isna(val) or val == '' or val == '[]':
        return []
    
    try:
        # Try parsing as Python literal (e.g., "['item1', 'item2']")
        if isinstance(val, str) and val.startswith('['):
            parsed = ast.literal_eval(val)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if item]
        
        # If it's already a list
        if isinstance(val, list):
            return [str(item).strip() for item in val if item]
        
        # Try comma-separated
        if isinstance(val, str) and ',' in val:
            return [item.strip() for item in val.split(',') if item.strip()]
        
        # Single value
        if isinstance(val, str) and val.strip():
            return [val.strip()]
            
    except (ValueError, SyntaxError) as e:
        print(f"Warning: Could not parse characteristics: {str(val)[:50]}... Error: {e}")
    
    return []

def map_sentiment(val):
    """Map sentiment string to standardized format."""
    if pd.isna(val):
        return 'Neutral'
    
    val_str = str(val).upper().strip()
    
    if 'POSITIVE' in val_str or 'POS' in val_str:
        return 'Positive'
    elif 'NEGATIVE' in val_str or 'NEG' in val_str:
        return 'Negative'
    else:
        return 'Neutral'

def parse_date(val):
    """Parse date from various formats."""
    if pd.isna(val):
        return None
    
    # If already a datetime object
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    
    if isinstance(val, pd.Timestamp):
        return val.strftime('%Y-%m-%d')
    
    # Try parsing string formats
    val_str = str(val).strip()
    
    for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y']:
        try:
            return datetime.strptime(val_str.split()[0], fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    
    # Return as-is if we can extract a date-like string
    if len(val_str) >= 10:
        return val_str[:10]
    
    return None

def main():
    print("Loading Excel file...")
    df = pd.read_excel('dist/reviews_with_sentiment_and_characteristics.xlsx')
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {df.columns.tolist()}")
    
    reviews = []
    stats = {
        'with_text': 0,
        'with_date': 0,
        'with_rating': 0,
        'with_characteristics': 0,
        'sentiments': {'Positive': 0, 'Negative': 0, 'Neutral': 0}
    }
    
    random.seed(42)  # For reproducibility of polarity values
    
    for idx, row in df.iterrows():
        # Get review text from full_review
        text = ''
        if 'full_review' in df.columns and pd.notna(row.get('full_review')):
            text = str(row['full_review']).strip()
        
        if text:
            stats['with_text'] += 1
        
        # Get date from review_time
        date = None
        if 'review_time' in df.columns:
            date = parse_date(row.get('review_time'))
        
        if date:
            stats['with_date'] += 1
        else:
            # Fallback to random date if no date available
            date = f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}"
        
        # Get rating from star_rating
        rating = 3.0  # Default
        if 'star_rating' in df.columns and pd.notna(row.get('star_rating')):
            try:
                rating = float(row['star_rating'])
                stats['with_rating'] += 1
            except (ValueError, TypeError):
                pass
        
        # Get sentiment
        sentiment = 'Neutral'
        if 'sentiment' in df.columns:
            sentiment = map_sentiment(row.get('sentiment'))
        stats['sentiments'][sentiment] += 1
        
        # Get characteristics
        characteristics = []
        if 'characteristics' in df.columns:
            characteristics = parse_characteristics(row.get('characteristics'))
            if characteristics:
                stats['with_characteristics'] += 1
        
        # Get product name
        product = ''
        if 'pdp_title_value' in df.columns and pd.notna(row.get('pdp_title_value')):
            product = str(row['pdp_title_value']).strip()
        
        # Calculate polarity based on sentiment
        polarity = 0.0
        if sentiment == 'Positive':
            polarity = random.uniform(0.3, 0.9)
        elif sentiment == 'Negative':
            polarity = random.uniform(-0.9, -0.3)
        else:
            polarity = random.uniform(-0.2, 0.2)
        
        review = {
            'id': int(idx),
            'date': date,
            'rating': rating,
            'text': text,
            'sentiment': sentiment,
            'polarity': round(polarity, 2),
            'characteristics': characteristics,
            'product': product
        }
        
        reviews.append(review)
        
        if idx % 10000 == 0:
            print(f"Processed {idx} rows...")
    
    # Save to JSON
    output_path = 'src/data/processed_reviews.json'
    print(f"\nSaving to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(reviews, f, indent=2, ensure_ascii=False)
    
    # Print statistics
    print(f"\n{'='*50}")
    print(f"PROCESSING COMPLETE")
    print(f"{'='*50}")
    print(f"Total reviews: {len(reviews)}")
    print(f"Reviews with text: {stats['with_text']} ({100*stats['with_text']/len(reviews):.1f}%)")
    print(f"Reviews with date: {stats['with_date']} ({100*stats['with_date']/len(reviews):.1f}%)")
    print(f"Reviews with rating: {stats['with_rating']} ({100*stats['with_rating']/len(reviews):.1f}%)")
    print(f"Reviews with characteristics: {stats['with_characteristics']} ({100*stats['with_characteristics']/len(reviews):.1f}%)")
    
    print(f"\nSentiment Distribution:")
    for s, count in stats['sentiments'].items():
        print(f"  {s}: {count} ({100*count/len(reviews):.1f}%)")
    
    # Show samples
    print(f"\n{'='*50}")
    print(f"SAMPLE REVIEWS")
    print(f"{'='*50}")
    for i in [0, 100, 1000, 5000]:
        if i < len(reviews):
            r = reviews[i]
            print(f"\n--- Review {i} ---")
            print(f"  Date: {r['date']}")
            print(f"  Rating: {r['rating']}")
            print(f"  Sentiment: {r['sentiment']} (polarity: {r['polarity']})")
            print(f"  Product: {r['product'][:60]}..." if len(r['product']) > 60 else f"  Product: {r['product']}")
            print(f"  Characteristics: {r['characteristics']}")
            print(f"  Text: {r['text'][:150]}..." if len(r['text']) > 150 else f"  Text: {r['text']}")

if __name__ == '__main__':
    main()
