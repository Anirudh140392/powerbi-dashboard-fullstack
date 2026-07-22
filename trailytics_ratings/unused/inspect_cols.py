import pandas as pd

df = pd.read_excel('dist/reviews_with_sentiment_and_characteristics.xlsx', nrows=10)
print("COLUMNS:")
for i, c in enumerate(df.columns):
    print(f"  {i}: {c}")

print("\n\nSample row 5:")
r = df.iloc[5]
for col in df.columns:
    val = str(r[col])[:150] if pd.notna(r[col]) else "N/A"
    print(f"  {col}: {val}")
