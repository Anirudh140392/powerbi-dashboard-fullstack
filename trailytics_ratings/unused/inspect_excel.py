import pandas as pd

try:
    df = pd.read_excel('public/reviews.xlsx', nrows=3)
    print("Columns:", df.columns.tolist())
    print("First row:", df.iloc[0].to_dict())
except Exception as e:
    print(f"Error: {e}")
