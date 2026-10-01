FROM python:3.10-slim

WORKDIR /app

# Upgrade pip
RUN pip install --upgrade pip

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# TextBlob requires downloading a small NLTK corpora for tokenization
RUN python -m textblob.download_corpora

# Copy the specific ml_service and ml_pipeline files from the Context
# Note: since this is built by pulling from root OR from ml_service logic
# If Railway runs this from ml_service, we'll need to package ml_pipeline
COPY . /app

# Run uvicorn on port 8080 (or PORT env var mapped by Railway)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
