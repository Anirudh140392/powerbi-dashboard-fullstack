"""
Generate realistic competitor reviews based on patterns from Prestige data.
This creates sample data for building the UI - can be replaced with real API data later.
"""
import json
import random
from datetime import datetime, timedelta

# Load competitor products
with open('src/data/competitor_products.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    competitor_products = data['competitors']

# Review templates by category and sentiment
REVIEW_TEMPLATES = {
    'Pressure Cooker': {
        'positive': [
            "Excellent pressure cooker. Cooks rice perfectly in just 3 whistles.",
            "Very sturdy build quality. Using for {months} months, no issues.",
            "Good value for money. Induction compatible and works great.",
            "Love this cooker. Gasket is tight, no steam leakage.",
            "Perfect size for family of 4. Easy to clean.",
            "Best pressure cooker I've used. Whistle sound is perfect.",
            "Heavy bottom, cooks evenly. Handles don't get hot.",
            "Quality product. Safety valve works well.",
        ],
        'negative': [
            "Lid doesn't fit properly. Steam leaks from sides.",
            "Gasket wore out in {months} months. Poor quality rubber.",
            "Handle broke within 6 months. Cheap plastic.",
            "Whistles too loudly. Annoying sound.",
            "Coating started peeling after few uses. Disappointed.",
            "Not worth the price. Better options available.",
            "Safety valve stuck. Dangerous to use.",
            "Bottom got burnt. Heat distribution is uneven.",
        ],
        'neutral': [
            "Average product. Does the job but nothing special.",
            "Okay for the price. Expected better quality.",
            "Works fine but lid is slightly loose.",
            "Good cooker but delivery was delayed.",
        ]
    },
    'Induction Cooktop': {
        'positive': [
            "Works perfectly with all induction vessels. Heats quickly.",
            "Touch panel is responsive. Easy temperature control.",
            "Energy efficient. Saves electricity compared to gas.",
            "Auto cut-off feature is great for safety.",
            "Sleek design. Looks premium in kitchen.",
            "Timer function is useful. 8 preset modes.",
        ],
        'negative': [
            "Stopped working after {months} months. No warranty support.",
            "Makes loud noise. Fan is too noisy.",
            "Touch panel not responsive. Have to press hard.",
            "Overheats quickly. Auto shut-off triggers too often.",
            "Coil burnt out. Repair cost is too high.",
            "Not compatible with some vessels. Says error.",
        ],
        'neutral': [
            "Average performance. Heats slow compared to gas.",
            "Okay product. Works but fan noise is annoying.",
        ]
    },
    'Gas Stove': {
        'positive': [
            "Excellent glass top. Easy to clean after cooking.",
            "Brass burners give good flame. Fuel efficient.",
            "Sturdy build. Pan supports are stable.",
            "Auto ignition works smoothly. No match needed.",
            "Good for Indian cooking. High flame for tadka.",
        ],
        'negative': [
            "Auto ignition stopped working in {months} months.",
            "Glass top cracked. Very fragile.",
            "Burner knob is loose. Gas leaks sometimes.",
            "Flame is uneven. Center is weak.",
            "Pan supports rust easily. Poor coating.",
            "Not ISI marked. Safety concern.",
        ],
        'neutral': [
            "Average quality glass top. Nothing extraordinary.",
            "Works okay. But auto ignition is hit or miss.",
        ]
    },
    'Mixer Grinder': {
        'positive': [
            "Powerful motor. Grinds batter smoothly in minutes.",
            "All jars are leak-proof. Good quality blades.",
            "Silent operation. Less noise than other mixers.",
            "Chutney comes out perfect. Wet grinding is excellent.",
            "Easy to clean. Jars are dishwasher safe.",
        ],
        'negative': [
            "Motor burnt out in {months} months. No warranty claim.",
            "Jars started leaking. Rubber seal is poor.",
            "Too noisy. Cannot use early morning.",
            "Blades not sharp. Doesn't grind properly.",
            "Overheats after 5 minutes. Have to wait to cool.",
        ],
        'neutral': [
            "Average grinding. Takes more time than expected.",
            "Okay for price. Not as powerful as advertised.",
        ]
    },
    'default': {
        'positive': [
            "Good quality product. Happy with purchase.",
            "Value for money. Works as expected.",
            "Nice product. Recommend to others.",
            "Excellent build quality. Durable.",
        ],
        'negative': [
            "Poor quality. Broke after {months} months.",
            "Not worth the price. Disappointed.",
            "Quality has gone down. Previous products were better.",
            "Will not recommend. Many better options available.",
        ],
        'neutral': [
            "Average product. Nothing special.",
            "Okay for the price point.",
        ]
    }
}

def generate_reviews(product, num_reviews=50):
    """Generate realistic reviews for a product."""
    reviews = []
    category = product['category']
    templates = REVIEW_TEMPLATES.get(category, REVIEW_TEMPLATES['default'])
    
    # Distribution: 60% positive, 25% negative, 15% neutral
    for i in range(num_reviews):
        rand = random.random()
        if rand < 0.60:
            sentiment = 'positive'
            rating = random.choice([4, 4, 4, 5, 5, 5, 5])
        elif rand < 0.85:
            sentiment = 'negative'
            rating = random.choice([1, 1, 2, 2, 2, 3])
        else:
            sentiment = 'neutral'
            rating = random.choice([3, 3, 3, 4])
        
        # Get random template
        text = random.choice(templates[sentiment])
        
        # Replace placeholders
        months = random.randint(2, 12)
        text = text.replace('{months}', str(months))
        
        # Random date in last 2 years
        days_ago = random.randint(0, 730)
        review_date = datetime.now() - timedelta(days=days_ago)
        
        reviews.append({
            'reviewId': f"{product['productId']}-R{i+1:04d}",
            'productId': product['productId'],
            'productName': product['name'],
            'brand': product['brand'],
            'category': product['category'],
            'rating': rating,
            'text': text,
            'date': review_date.strftime('%Y-%m-%d'),
            'sentiment': 'POSITIVE' if rating >= 4 else 'NEGATIVE' if rating <= 2 else 'NEUTRAL',
            'verified': random.random() < 0.85
        })
    
    return reviews

# Generate reviews for all competitor products
all_reviews = []
for product in competitor_products:
    num = random.randint(40, 80)  # Random number of reviews per product
    reviews = generate_reviews(product, num)
    all_reviews.extend(reviews)

# Apply v7 classifier to get subcategories
import sys
sys.path.insert(0, 'ml_pipeline')
from category_classifier import classify_with_rules_v7

for review in all_reviews:
    category, subcategory, confidence = classify_with_rules_v7(
        review['text'], 
        review['rating'], 
        review['productName']
    )
    review['sentimentCategory'] = category
    review['subcategory'] = subcategory
    review['categoryConfidence'] = round(confidence, 2)

# Save competitor reviews
with open('src/data/competitor_reviews.json', 'w', encoding='utf-8') as f:
    json.dump(all_reviews, f, indent=2, ensure_ascii=False)

print(f"Generated {len(all_reviews)} competitor reviews")

# Summary by brand
brand_counts = {}
for r in all_reviews:
    brand_counts[r['brand']] = brand_counts.get(r['brand'], 0) + 1

print("\nBy Brand:")
for brand, count in sorted(brand_counts.items(), key=lambda x: -x[1]):
    print(f"  {brand}: {count}")

# Summary by category
cat_counts = {}
for r in all_reviews:
    cat_counts[r['category']] = cat_counts.get(r['category'], 0) + 1

print("\nBy Category:")
for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")

print(f"\n✅ Saved to src/data/competitor_reviews.json")
