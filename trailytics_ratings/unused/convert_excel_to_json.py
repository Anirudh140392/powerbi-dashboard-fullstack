"""
Convert ML-processed Excel to JSON for Rating Dashboard
"""
import pandas as pd
import json
from pathlib import Path

# Input file
EXCEL_PATH = Path('dist/all_reviews_with_category_latest2.xlsx')
OUTPUT_PATH = Path('src/data/processed_reviews.json')

def convert_excel_to_json():
    print(f"Reading Excel file: {EXCEL_PATH}")
    
    if not EXCEL_PATH.exists():
        print(f"ERROR: File not found at {EXCEL_PATH.absolute()}")
        return
    
    # Read Excel
    df = pd.read_excel(EXCEL_PATH)
    print(f"Shape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")
    
    # Show sample data
    print("\nSample row:")
    print(df.iloc[0].to_dict())
    
    print("\nNull counts:")
    print(df.isnull().sum())
    
    # Standardize column names and convert to JSON format
    reviews = []
    for idx, row in df.iterrows():
        review = {
            'id': idx,
            'date': str(row.get('review_time', ''))[:10] if pd.notna(row.get('review_time', '')) else '',
            'rating': float(row.get('star_rating', 0)) if pd.notna(row.get('star_rating', 0)) else 0,
            'text': str(row.get('full_review', '')) if pd.notna(row.get('full_review', '')) else '',
            'sentiment': str(row.get('sentiment', 'Neutral')) if pd.notna(row.get('sentiment', '')) else 'Neutral',
            'polarity': float(row.get('sentiment_star_rating', 0)) if pd.notna(row.get('sentiment_star_rating', 0)) else 0,
            'characteristics': [],
            'product': str(row.get('pdp_title_value', '')) if pd.notna(row.get('pdp_title_value', '')) else '',
            'sentimentCategory': str(row.get('category', '')) if pd.notna(row.get('category', '')) else ''
        }
        
        # Handle characteristics column
        chars = row.get('characteristics', '')
        if pd.notna(chars):
            if isinstance(chars, str) and chars.strip():
                # Parse if comma-separated or JSON
                try:
                    review['characteristics'] = json.loads(chars) if chars.startswith('[') else [c.strip() for c in chars.split(',') if c.strip()]
                except:
                    review['characteristics'] = [c.strip() for c in chars.split(',') if c.strip()]
            elif isinstance(chars, list):
                review['characteristics'] = chars
        
        reviews.append(review)

    
    # Save to JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(reviews, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Converted {len(reviews)} reviews to {OUTPUT_PATH}")
    print(f"File size: {OUTPUT_PATH.stat().st_size / 1024 / 1024:.2f} MB")

if __name__ == '__main__':
    convert_excel_to_json()
