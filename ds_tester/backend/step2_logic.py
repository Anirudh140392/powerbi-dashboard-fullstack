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
DEFAULT_DB = os.getenv("CLICKHOUSE_DB", "drl")


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
    Extracts start and end dates from the period dictionary or string.
    Comment on format found:
      The DS platform uses YYYY-MM-DD strings for DATE conditions on rb_pdp_olap.
    """
    if isinstance(period, dict):
        start = period.get("startDate") or period.get("start")
        end = period.get("endDate") or period.get("end")
        if start and end:
            return str(start)[:10], str(end)[:10]

    if isinstance(period, str):
        for sep in (" to ", " - ", " – ", " — "):
            if sep in period:
                parts = period.split(sep)
                if len(parts) == 2:
                    return parts[0].strip()[:10], parts[1].strip()[:10]

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
        settings = {"max_threads": 2, "max_memory_usage": 2000000000}
        result = client.query(query, parameters=parameters, settings=settings)
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



def check_platform_data_presence(client: Optional[str], platform: str, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Verifies data freshness and ingestion health for a platform in the ClickHouse database.
    If 0 records exist in the tested date range despite the platform being part of the client ecosystem,
    it detects the ingestion stall so it is flagged as an anomaly.
    Works universally across all clients (drl, boat, pidilite, etc.).
    """
    db_name = client or "drl"
    clean_p = platform.strip().lower()
    if not clean_p or clean_p == "all":
        return {"is_stalled": False, "period_rows": 1, "total_rows": 1, "max_date": None, "platform": platform}

    p_clean_sql = clean_p.replace("_", " ").replace("-", " ")
    try:
        # Check in primary OLAP table rb_pdp_olap
        query = f"""
        SELECT 
            countIf(DATE BETWEEN '{start_date}' AND '{end_date}') AS period_rows,
            count() AS total_rows,
            max(DATE) AS max_date
        FROM {db_name}.rb_pdp_olap
        WHERE lower(replaceAll(replaceAll(Platform, '_', ' '), '-', ' ')) = '{p_clean_sql}'
        """
        rows = execute_select_query(query, database=db_name)
        if rows and len(rows) > 0:
            p_rows = int(rows[0][0] or 0)
            t_rows = int(rows[0][1] or 0)
            m_date = str(rows[0][2] or "")[:10] if rows[0][2] else None

            # Case 1: Ingestion stalled - Historical data exists, but zero rows in active period
            if p_rows == 0 and t_rows > 0:
                return {
                    "is_stalled": True,
                    "period_rows": 0,
                    "total_rows": t_rows,
                    "max_date": m_date,
                    "platform": platform,
                    "reason": f"Data Ingestion Stalled: 0 records found for {platform.title()} in selected period ({start_date} to {end_date}). Last recorded sync was {m_date} ({t_rows:,} historical records). Pipeline stopped ingesting."
                }
            # Case 2: Platform registered in ecosystem (e.g. in rca_sku_dim) but 0 records ever ingested
            elif p_rows == 0 and t_rows == 0:
                dim_check = execute_select_query(
                    f"SELECT count() FROM {db_name}.rca_sku_dim WHERE lower(replaceAll(replaceAll(platform, '_', ' '), '-', ' ')) = '{p_clean_sql}'",
                    database=db_name
                )
                dim_count = int(dim_check[0][0] or 0) if dim_check else 0
                if dim_count > 0:
                    return {
                        "is_stalled": True,
                        "period_rows": 0,
                        "total_rows": 0,
                        "max_date": None,
                        "platform": platform,
                        "reason": f"Missing Platform Data: {platform.title()} is registered in client portfolio ({dim_count} SKUs configured), but 0 records exist in database. Data pipeline never synced."
                    }
            return {
                "is_stalled": False,
                "period_rows": p_rows,
                "total_rows": t_rows,
                "max_date": m_date,
                "platform": platform
            }
    except Exception as e:
        pass

    return {"is_stalled": False, "period_rows": 1, "total_rows": 1, "max_date": None, "platform": platform}
