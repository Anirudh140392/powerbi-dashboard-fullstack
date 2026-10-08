from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
import os
import sys

# Import local ML (isolated copy inside Docker)
from ml_pipeline.category_classifier import classify_review
from ml_pipeline.sentiment_analyzer import analyze_sentiment_local

app = FastAPI(
    title="Ratings ML Engine",
    description="Microservice for assigning sentiment and taxonomy categories to product reviews.",
    version="1.0.0"
)

# Extremely simple API key based auth
API_KEY = os.getenv("ML_API_SECRET", "super-secret-development-key")
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header:
        # Support "Bearer <token>" or just the token directly
        token = api_key_header.replace("Bearer ", "").strip()
        if token == API_KEY:
            return token
    raise HTTPException(status_code=403, detail="Could not validate credentials")


class ReviewRequest(BaseModel):
    text: str = Field(..., description="The raw review text")
    rating: float = Field(3.0, description="The star rating (1-5)")
    product_name: str = Field("", description="Optional product name context")

class ClassificationResponse(BaseModel):
    sentiment: str
    category: str
    subcategory: str
    confidence: float
    reasoning: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/classify", response_model=ClassificationResponse)
def classify_text(req: ReviewRequest, api_key: str = Depends(get_api_key)):
    try:
        # Standard local ML processing
        sentiment, sentiment_conf, _ = analyze_sentiment_local(req.text)
        
        category, subcategory, confidence, reasoning = classify_review(
            text=req.text, 
            product_name=req.product_name, 
            rating=req.rating, 
            provider="rules"
        )

        return ClassificationResponse(
            sentiment=sentiment,
            category=category,
            subcategory=subcategory,
            confidence=confidence,
            reasoning=reasoning
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
