#!/usr/bin/env python3
"""
================================================================================
Automated API Logs Daily Retention Cleanup Service
Trailytics API Monitoring System
================================================================================
Deletes expired records older than the active 2-day retention window from
ClickHouse `admin_master.api_logs` (i.e. toDate(Date) < today() - 1).
Maintains exactly the rolling 2-day window (today and yesterday).

Runs daily at 01:00 AM IST.
Author: Trailytics Engineering
================================================================================
"""

import os
import sys
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import pytz
import requests
from dotenv import load_dotenv

# ------------------------------------------------------------------------------
# Logging Setup
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOGS_DIR / "cleanup.log"

logger = logging.getLogger("api_logs_cleanup")
logger.setLevel(logging.INFO)

file_handler = RotatingFileHandler(
    LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
)
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(file_formatter)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S"
)
console_handler.setFormatter(console_formatter)

if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

# ------------------------------------------------------------------------------
# Environment Loading
# ------------------------------------------------------------------------------
potential_envs = [
    BASE_DIR / ".env",
    BASE_DIR.parent / "backend" / ".env",
    BASE_DIR.parent / ".env",
]
for env_path in potential_envs:
    if env_path.exists():
        load_dotenv(env_path)
        break

TZ_NAME = os.getenv("TIMEZONE", "Asia/Kolkata")
try:
    LOCAL_TZ = pytz.timezone(TZ_NAME)
except Exception:
    LOCAL_TZ = pytz.timezone("Asia/Kolkata")

CLICKHOUSE_URL = os.getenv("CLICKHOUSE_URL", "http://13.200.55.131:8123").strip()
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "kenil_user").strip()
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "Kenil@Kavar0604").strip()
CLICKHOUSE_DB = (
    os.getenv("ADMIN_DB")
    or os.getenv("CLICKHOUSE_ADMIN_DB")
    or os.getenv("CLICKHOUSE_DB")
    or "admin_master"
).strip()
API_LOGS_TABLE = os.getenv("API_LOGS_TABLE", "api_logs").strip()


def execute_clickhouse(query: str, timeout: int = 30) -> dict:
    endpoint = f"{CLICKHOUSE_URL.rstrip('/')}/"
    headers = {
        "X-ClickHouse-User": CLICKHOUSE_USER,
        "X-ClickHouse-Key": CLICKHOUSE_PASSWORD,
    }
    params = {"query": query}
    resp = requests.post(endpoint, params=params, headers=headers, timeout=timeout)
    resp.raise_for_status()
    try:
        return resp.json()
    except Exception:
        return {"raw": resp.text}


def run_cleanup(keep_days: int = 2, dry_run: bool = False) -> bool:
    """
    Deletes records older than retention threshold from admin_master.api_logs.
    Default keep_days = 2:
      Deletes records where toDate(Date) < today() - 1 (retains today and yesterday).
    If keep_days = 1:
      Deletes records where toDate(Date) < today() (retains only today).
    """
    run_timestamp = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S %Z")
    logger.info("=" * 70)
    logger.info(f"Starting 1:00 AM API Logs Cleanup at {run_timestamp}")
    logger.info("=" * 70)

    # 1. Inspect current dates and counts
    try:
        check_query = f"""
        SELECT toDate(Date) as d, count(*) as count 
        FROM {CLICKHOUSE_DB}.{API_LOGS_TABLE} 
        GROUP BY d 
        ORDER BY d DESC 
        FORMAT JSON
        """
        data = execute_clickhouse(check_query)
        rows = data.get("data", [])
        logger.info(f"Current dates in `{CLICKHOUSE_DB}.{API_LOGS_TABLE}`:")
        for r in rows:
            logger.info(f"  - Date: {r.get('d')} | Records: {r.get('count')}")
    except Exception as exc:
        logger.error(f"Failed to query pre-cleanup status: {exc}")
        return False

    # 2. Formulate deletion condition
    days_back = max(1, keep_days - 1)
    delete_condition = f"toDate(Date) < today() - {days_back}"

    # Check rows that match deletion criteria
    count_query = f"""
    SELECT count(*) as delete_count 
    FROM {CLICKHOUSE_DB}.{API_LOGS_TABLE} 
    WHERE {delete_condition} 
    FORMAT JSON
    """
    res = execute_clickhouse(count_query)
    to_delete = res.get("data", [{}])[0].get("delete_count", 0)
    logger.info(f"Records eligible for deletion ({delete_condition}): {to_delete}")

    if to_delete == 0:
        logger.info("Table is already clean. No records older than retention threshold.")
        return True

    if dry_run:
        logger.info(f"[DRY-RUN] Would delete {to_delete} records from `{CLICKHOUSE_DB}.{API_LOGS_TABLE}`.")
        return True

    # 3. Execute ALTER TABLE DELETE mutation
    mutation_query = f"ALTER TABLE {CLICKHOUSE_DB}.{API_LOGS_TABLE} DELETE WHERE {delete_condition}"
    logger.info(f"Submitting ClickHouse mutation: {mutation_query}")
    try:
        execute_clickhouse(mutation_query)
        logger.info(f"SUCCESS: ClickHouse cleanup mutation submitted. {to_delete} records purged.")
        return True
    except Exception as exc:
        logger.error(f"Failed to execute cleanup mutation: {exc}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Clean up expired API logs from ClickHouse")
    parser.add_argument(
        "--keep-days",
        type=int,
        default=2,
        help="Number of days of data to retain (default: 2, keeps today and yesterday)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Check eligible records without deleting",
    )
    args = parser.parse_args()

    success = run_cleanup(keep_days=args.keep_days, dry_run=args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
