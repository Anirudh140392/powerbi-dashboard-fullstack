import os
import re
from typing import Dict, Any, Optional, List, Tuple
import clickhouse_connect
from dotenv import load_dotenv

# Load backend environment configuration
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST") or os.getenv("CLICKHOUSE_URL", "http://13.200.55.131:8123")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "kenil_user")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "Kenil@Kavar0604")
DEFAULT_DB = os.getenv("CLICKHOUSE_DB", "boat")


def get_clickhouse_client(database: Optional[str] = None):
    """
    Creates a read-only clickhouse-connect client using existing credentials from backend/.env.
    """
    # Parse host and port from URL
    clean_host = CLICKHOUSE_HOST.replace("http://", "").replace("https://", "").strip()
    port = 8123
    if ":" in clean_host:
        host_part, port_part = clean_host.split(":")
        clean_host = host_part
        try:
            port = int(port_part.split("/")[0])
        except ValueError:
            port = 8123

    db_name = database or DEFAULT_DB
    client = clickhouse_connect.get_client(
        host=clean_host,
        port=port,
        username=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        database=db_name,
        connect_timeout=30,
        send_receive_timeout=120,
    )
    return client


def period_to_date_range(period: Any) -> Tuple[str, str]:
    """
    Extracts start and end dates from the period dictionary.
    Comment on format found:
      The DS platform uses YYYY-MM-DD strings for DATE conditions on rb_pdp_olap.
    """
    if isinstance(period, dict):
        start = period.get("startDate") or period.get("start")
        end = period.get("endDate") or period.get("end")
        if start and end:
            return str(start)[:10], str(end)[:10]

    raise ValueError(f"Period does not contain valid start and end dates: {period}")


def execute_select_query(
    query: str,
    parameters: Optional[Dict[str, Any]] = None,
    database: Optional[str] = None,
) -> List[Tuple]:
    """
    Executes a strict read-only query against the OLAP ClickHouse layer.
    Rejects any non-SELECT statements.
    """
    trimmed = query.strip()
    # Ensure read-only: only SELECT or WITH ... SELECT allowed
    first_word = re.split(r"\s+", trimmed.upper())[0] if trimmed else ""
    if first_word not in ("SELECT", "WITH"):
        raise ValueError(f"Security error: Query must be read-only (SELECT). Attempted: {first_word}")

    client = get_clickhouse_client(database=database)
    try:
        result = client.query(query, parameters=parameters)
        return result.result_rows
    finally:
        client.close()


def resolve_table_column(database: Optional[str], table: str, target_name: str) -> str:
    """
    Dynamically discovers the exact column casing in ClickHouse for a table.
    """
    client = get_clickhouse_client(database=database)
    try:
        cols = [r[0] for r in client.query(f"DESCRIBE TABLE {table}").result_rows]
        match = next((c for c in cols if c.lower() == target_name.lower()), target_name)
        return match
    finally:
        client.close()

