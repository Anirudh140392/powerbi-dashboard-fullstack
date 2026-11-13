import os
import requests
import jwt
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load backend environment settings
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000")
JWT_SECRET = os.getenv("JWT_SECRET", "trailytics_jwt_secret_2026")
CLICKHOUSE_DB = os.getenv("CLICKHOUSE_DB", "boat")


def get_auth_token(db_name: Optional[str] = None) -> str:
    """
    Generates a valid JWT token for platform API requests using the project's JWT_SECRET.
    Reuses existing credentials and database settings without hardcoding secrets.
    """
    payload = {
        "userId": 10001,
        "email": "admin@trailytics.com",
        "userName": "Admin User",
        "dbName": db_name or CLICKHOUSE_DB,
        "role": "admin",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def normalize_period_to_dates(period: Any) -> Dict[str, str]:
    """
    Converts dashboard time-period object/string to API query parameters:
      Expected dashboard period format:
        - dict with {'startDate': 'YYYY-MM-DD', 'endDate': 'YYYY-MM-DD'}
        - or dict with {'start': 'YYYY-MM-DD', 'end': 'YYYY-MM-DD'}
      Short comment on format found:
        The DS platform's DateRangeComparePicker and FilterContext store dates as
        ISO 'YYYY-MM-DD' strings (e.g. 2026-10-01 to 2026-10-15).
    """
    if isinstance(period, dict):
        start_date = period.get("startDate") or period.get("start")
        end_date = period.get("endDate") or period.get("end")
        if start_date and end_date:
            return {"startDate": str(start_date)[:10], "endDate": str(end_date)[:10]}

    raise ValueError(f"Invalid period format: {period}. Expected dict with startDate and endDate.")


def call_platform_api(
    endpoint: str,
    params: Optional[Dict[str, Any]] = None,
    period: Optional[Any] = None,
    db_name: Optional[str] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    """
    Calls the platform's existing backend API endpoint with proper auth headers and query params.
    """
    url = f"{API_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"
    query_params: Dict[str, Any] = {}

    if period:
        date_params = normalize_period_to_dates(period)
        query_params.update(date_params)

    if params:
        query_params.update(params)

    token = get_auth_token(db_name=db_name)
    target_db = db_name or CLICKHOUSE_DB
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "x-db-name": target_db,
    }

    response = requests.get(url, params=query_params, headers=headers, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    return data
