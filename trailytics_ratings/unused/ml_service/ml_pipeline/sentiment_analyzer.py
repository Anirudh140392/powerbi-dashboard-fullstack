"""
Sentiment Analyzer Module
Uses TextBlob and VADER for local sentiment analysis.
Falls back to OpenAI only for complex/ambiguous reviews.
"""

from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import Literal, Tuple

# Initialize VADER
vader = SentimentIntensityAnalyzer()


def analyze_sentiment_local(text: str) -> Tuple[Literal['POSITIVE', 'NEGATIVE', 'NEUTRAL'], float, bool]:
    """
    Analyze sentiment using local models (TextBlob + VADER).
    
    Returns:
        - sentiment: 'POSITIVE', 'NEGATIVE', or 'NEUTRAL'
        - confidence: 0-1 confidence score
        - needs_openai: True if review is complex and needs OpenAI
    """
    if not text or len(text.strip()) < 5:
        return 'NEUTRAL', 0.5, False
    
    # VADER analysis (good for social media/reviews)
    vader_scores = vader.polarity_scores(text)
    vader_compound = vader_scores['compound']
    
    # TextBlob analysis
    blob = TextBlob(text)
    textblob_polarity = blob.sentiment.polarity  # -1 to 1
    textblob_subjectivity = blob.sentiment.subjectivity  # 0 to 1
    
    # Combine scores (weighted average)
    combined_score = (vader_compound + textblob_polarity) / 2
    
    # Determine if complex (conflicting signals or high subjectivity)
    score_diff = abs(vader_compound - textblob_polarity)
    is_complex = score_diff > 0.5 or (textblob_subjectivity > 0.6 and abs(combined_score) < 0.3)
    
    # Determine sentiment
    if combined_score >= 0.05:
        sentiment = 'POSITIVE'
        confidence = min(1.0, 0.5 + combined_score)
    elif combined_score <= -0.05:
        sentiment = 'NEGATIVE'
        confidence = min(1.0, 0.5 + abs(combined_score))
    else:
        sentiment = 'NEUTRAL'
        confidence = 0.5 + (0.5 - abs(combined_score))
    
    return sentiment, confidence, is_complex


def get_polarity_score(text: str) -> float:
    """
    Get numeric polarity score from 1-5 (like star rating).
    """
    if not text:
        return 3.0
    
    vader_scores = vader.polarity_scores(text)
    compound = vader_scores['compound']
    
    # Map -1 to 1 compound to 1-5 score
    polarity = (compound + 1) * 2 + 1
    return round(max(1.0, min(5.0, polarity)), 2)


if __name__ == "__main__":
    # Test examples
    test_reviews = [
        "Excellent product! Works perfectly, love it.",
        "Terrible quality. Broke after 2 days, waste of money.",
        "It's okay, nothing special. Does the job.",
        "Better than my old Butterfly mixer, but the noise is annoying.",
        "Good product but delivery was damaged. Had to return.",
    ]
    
    for review in test_reviews:
        sentiment, confidence, needs_openai = analyze_sentiment_local(review)
        polarity = get_polarity_score(review)
        print(f"\nReview: {review[:50]}...")
        print(f"  Sentiment: {sentiment} (confidence: {confidence:.2f})")
        print(f"  Polarity: {polarity}")
        print(f"  Needs OpenAI: {needs_openai}")
