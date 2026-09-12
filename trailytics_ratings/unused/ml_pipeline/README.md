# ML Pipeline for Review Intelligence

## Setup
```bash
pip install textblob vaderSentiment openai pandas tqdm
```

## Usage
```bash
python ml_pipeline/process_reviews.py --input src/data/processed_reviews.json --output src/data/reviews_ml_enriched.json
```

## Components
- `sentiment_analyzer.py` - TextBlob + VADER for basic sentiment
- `category_classifier.py` - OpenAI for category + subcategory
- `competitor_detector.py` - Detect brand mentions
- `process_reviews.py` - Main orchestration script
