import pandas as pd
from textblob import TextBlob
import json
import os

INPUT_FILE = 'public/reviews.xlsx'
OUTPUT_JSON = 'src/data/processed_reviews.json'
OUTPUT_EXCEL = 'public/reviews_updated.xlsx'

def get_sentiment_label(polarity):
    if polarity > 0.1:
        return 'Positive'
    elif polarity < -0.1:
        return 'Negative'
    else:
        return 'Neutral'

def extract_characteristics(text):
    if not isinstance(text, str):
        return []
    
    blob = TextBlob(text)
    # Extract noun phrases as "characteristics"
    # Filter out single letters and very common short words that arguably aren't useful traits
    characteristics = [np.lower() for np in blob.noun_phrases if len(np) > 2]
    return list(set(characteristics)) # Remove duplicates per review

def process_reviews():
    print(f"Reading {INPUT_FILE}...")
    try:
        df = pd.read_excel(INPUT_FILE)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return

    # Limit to first 5000 rows for performance as per plan
    # df = df.head(5000) # User requested full dataset
    print(f"Processing {len(df)} rows...")

    results = []

    for index, row in df.iterrows():
        # Combine title and content for analysis if available
        text = str(row.get('pdp_title_value', '')) + " " + str(row.get('review_content', ''))
        
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        sentiment = get_sentiment_label(polarity)
        characteristics = extract_characteristics(text)

        # Structure for JSON
        review_data = {
            'id': index,
            'date': str(row.get('review_time', '')),
            'rating': row.get('pdp_rating_value', 0),
            'text': row.get('review_content', ''),
            'sentiment': sentiment,
            'polarity': polarity,
            'characteristics': characteristics
        }
        results.append(review_data)

    # Save JSON
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"Saved JSON to {OUTPUT_JSON}")

    # (Optional) Save back to Excel if needed, but JSON is better for the web app
    # df['ai_sentiment'] = [r['sentiment'] for r in results]
    # df['ai_characteristics'] = [", ".join(r['characteristics']) for r in results]
    # df.to_excel(OUTPUT_EXCEL, index=False)
    # print(f"Saved Excel to {OUTPUT_EXCEL}")

if __name__ == '__main__':
    # Download noun phrase corpora if needed (TextBlob usually handles this but good to be safe)
    try:
        import nltk
        nltk.download('brown')
        nltk.download('punkt')
    except:
        pass
        
    process_reviews()
