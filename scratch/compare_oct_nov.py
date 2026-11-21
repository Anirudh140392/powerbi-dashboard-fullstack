import requests
import jwt

JWT_SECRET = 'trailytics_jwt_secret_2026'

def get_token(db_name):
    payload = {
        'userId': 'test_user',
        'email': 'test@trailytics.com',
        'userName': 'Test User',
        'role': 'admin',
        'dbName': db_name,
        'dbStatus': True,
        'qcUser': 1,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

for db in ['boat', 'pidilite', 'mars']:
    token = get_token(db)
    headers = {'Authorization': f'Bearer {token}', 'x-db-name': db}
    
    # 1. October (Friday/Saturday)
    p_oct = {'startDate': '2026-10-01', 'endDate': '2026-10-31'}
    res_oct = requests.get('http://localhost:5000/api/pricing-analysis/kpis', params=p_oct, headers=headers).json()
    wd_oct = res_oct.get('data', {}).get('weightedDiscount', {}).get('value')
    
    # 2. November (Today)
    p_nov = {'startDate': '2026-11-01', 'endDate': '2026-11-02'}
    res_nov = requests.get('http://localhost:5000/api/pricing-analysis/kpis', params=p_nov, headers=headers).json()
    wd_nov = res_nov.get('data', {}).get('weightedDiscount', {}).get('value')

    print(f"\n[{db.upper()}]")
    print(f"  October (till Oct 31): Weighted Discount = {wd_oct}%")
    print(f"  November (Nov 1 - Nov 2): Weighted Discount = {wd_nov}%")

