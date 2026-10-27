#!/usr/bin/env python3
"""
================================================================================
Automated Daily API Alert Email Reporter
Trailytics API Monitoring System
================================================================================
Queries ClickHouse `api_logs` for failed APIs and APIs returning empty responses,
populates `api_alert_email.html`, and delivers the report via Office 365 SMTP
to all active recipients dynamically retrieved from the `api_alert` table.

Author: Trailytics Engineering
================================================================================
"""

import os
import sys
import re
import time
import html
import smtplib
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate
from pathlib import Path
from urllib.parse import quote

import pytz
import requests
from dotenv import load_dotenv

# ------------------------------------------------------------------------------
# Directory Setup & Logging Initialization
# ------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOGS_DIR / "api_report.log"

# Multi-destination logger (Rotating file + stdout)
logger = logging.getLogger("api_alert_reporter")
logger.setLevel(logging.INFO)

# File handler with rotation (5 MB per file, keep 5 backups)
file_handler = RotatingFileHandler(
    LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
)
file_handler.setLevel(logging.INFO)
file_formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler.setFormatter(file_formatter)

# Console handler
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
# Environment & Configuration Loader
# ------------------------------------------------------------------------------
# Order of precedence for .env:
# 1. api_alert_reporter/.env
# 2. backend/.env
# 3. root .env
potential_envs = [
    BASE_DIR / ".env",
    BASE_DIR.parent / "backend" / ".env",
    BASE_DIR.parent / ".env",
]
loaded_env = None
for env_path in potential_envs:
    if env_path.exists():
        load_dotenv(env_path)
        loaded_env = env_path
        break

if loaded_env:
    logger.info(f"Loaded environment variables from: {loaded_env.name}")
else:
    logger.warning("No .env file found in expected paths. Falling back to system environment.")

# Timezone
TZ_NAME = os.getenv("TIMEZONE", "Asia/Kolkata")
try:
    LOCAL_TZ = pytz.timezone(TZ_NAME)
except Exception:
    LOCAL_TZ = pytz.timezone("Asia/Kolkata")
    logger.warning(f"Invalid timezone '{TZ_NAME}', defaulted to Asia/Kolkata")

# Sender credentials (Office 365)
# Check SENDER_EMAIL, fallback to Alert_email, SMTP_USER
SENDER_EMAIL = (
    os.getenv("SENDER_EMAIL")
    or os.getenv("Alert_email")
    or os.getenv("SMTP_USER")
    or "business@trailytics.com"
).strip()

SENDER_PASSWORD = (
    os.getenv("SENDER_PASSWORD")
    or os.getenv("Alert_email_password")
    or os.getenv("SMTP_PASS")
    or ""
).strip()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.office365.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_DISPLAY_NAME = os.getenv("SENDER_DISPLAY_NAME", "Trailytics API Monitor").strip()

# Database credentials (ClickHouse)
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
API_ALERT_TABLE = os.getenv("API_ALERT_TABLE", "api_alert").strip()

# Report Behavior
DATE_SCOPE = os.getenv("DATE_SCOPE", "latest").strip().lower()
SEND_IF_NO_ISSUES = os.getenv("SEND_IF_NO_ISSUES", "false").strip().lower() in ("true", "1", "yes")
RECIPIENT_BATCH_SIZE = int(os.getenv("RECIPIENT_BATCH_SIZE", "50"))
SCHEDULE_TIME = os.getenv("SCHEDULE_TIME", "09:00").strip()

# Simple RFC 5322-compliant email validation regex
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


# ------------------------------------------------------------------------------
# Database Access Functions (ClickHouse via HTTP JSON)
# ------------------------------------------------------------------------------
def execute_clickhouse_query(query: str, timeout: int = 30) -> dict:
    """
    Executes a SQL query against ClickHouse HTTP interface and returns parsed JSON.
    Never logs database passwords or sensitive query strings containing secrets.
    """
    endpoint = f"{CLICKHOUSE_URL.rstrip('/')}/"
    headers = {
        "X-ClickHouse-User": CLICKHOUSE_USER,
        "X-ClickHouse-Key": CLICKHOUSE_PASSWORD,
    }
    params = {"query": query}
    
    try:
        resp = requests.post(endpoint, params=params, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as err:
        logger.error(f"ClickHouse HTTP query error: {resp.status_code} - {resp.text[:300]}")
        raise
    except Exception as err:
        logger.error(f"ClickHouse connection failed: {err}")
        raise


def fetch_recipients() -> list[str]:
    """
    Fetches recipient emails dynamically from the `api_alert` table on EVERY run.
    Trims whitespace, lowercases, validates with regex, removes duplicates,
    and logs any invalid or skipped values.
    """
    logger.info(f"Querying recipients from `{CLICKHOUSE_DB}.{API_ALERT_TABLE}`...")
    query = f"SELECT * FROM {CLICKHOUSE_DB}.{API_ALERT_TABLE} FORMAT JSON"
    data = execute_clickhouse_query(query)
    
    rows = data.get("data", [])
    raw_count = len(rows)
    logger.info(f"Retrieved {raw_count} raw recipient row(s) from database.")
    
    valid_recipients = []
    seen = set()
    skipped_count = 0
    
    for row in rows:
        # Check active status if flag column exists
        is_active = True
        for key in ("is_active", "active", "status"):
            if key in row:
                val = str(row[key]).strip().lower()
                if val in ("0", "false", "inactive", "disabled"):
                    is_active = False
                break
        
        if not is_active:
            skipped_count += 1
            logger.info(f"Skipping inactive recipient row: {row}")
            continue

        # Detect email field (email, email_id, mail, recipient)
        email_val = None
        for key in ("email", "email_id", "recipient", "mail"):
            if key in row and row[key]:
                email_val = str(row[key])
                break
        
        if not email_val:
            skipped_count += 1
            logger.warning(f"Skipping row with missing email field: {row}")
            continue
            
        cleaned = email_val.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            skipped_count += 1
            logger.warning(f"Skipping invalid email format: '{email_val}'")
            continue
            
        if cleaned not in seen:
            seen.add(cleaned)
            valid_recipients.append(cleaned)
    
    logger.info(f"Validated {len(valid_recipients)} unique recipient(s) (skipped {skipped_count}).")
    return valid_recipients


def fetch_api_issues(scope: str = "latest") -> tuple[list[dict], str]:
    """
    Queries `api_logs` for rows where:
      (response_status = 'Failed' OR status_code >= 400 OR status_code = 0) OR (empty_response = 1)
    
    Applies the configured date scope:
      - 'latest': Latest date present in api_logs
      - 'today': Today's calendar date in Asia/Kolkata
      - 'yesterday': Yesterday's calendar date in Asia/Kolkata
      - 'both': Both days within the 2-day retention window
    
    Returns (records, report_date_display_string).
    """
    now_ist = datetime.now(LOCAL_TZ)
    today_str = now_ist.strftime("%Y-%m-%d")
    
    # Resolve target date filter
    if scope == "latest":
        date_probe_query = f"SELECT max(toDate(Date)) as latest_d FROM {CLICKHOUSE_DB}.{API_LOGS_TABLE} FORMAT JSON"
        probe_res = execute_clickhouse_query(date_probe_query)
        latest_date = probe_res.get("data", [{}])[0].get("latest_d")
        if latest_date:
            date_filter = f"toDate(Date) = '{latest_date}'"
            display_date = latest_date
        else:
            date_filter = f"toDate(Date) = '{today_str}'"
            display_date = today_str
    elif scope == "today":
        date_filter = f"toDate(Date) = '{today_str}'"
        display_date = today_str
    elif scope == "yesterday":
        yesterday_str = (now_ist.date() - pytz.datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        date_filter = f"toDate(Date) = '{yesterday_str}'"
        display_date = yesterday_str
    elif scope == "both":
        date_filter = "1=1"
        display_date = f"{today_str} (Last 2 Days)"
    else:
        logger.warning(f"Unrecognized date scope '{scope}', defaulting to latest.")
        date_filter = f"toDate(Date) = '{today_str}'"
        display_date = today_str

    query = f"""
    SELECT 
        Date,
        Page,
        client_db,
        segment,
        api,
        status_code,
        response_status,
        empty_response,
        error_message
    FROM {CLICKHOUSE_DB}.{API_LOGS_TABLE}
    WHERE ({date_filter})
      AND (
        (response_status = 'Failed' OR status_code >= 400 OR status_code = 0)
        OR (empty_response = 1)
      )
    ORDER BY Date DESC, Page ASC, client_db ASC
    FORMAT JSON
    """
    logger.info(f"Querying API issues (Scope: {scope}, Filter: {date_filter})...")
    data = execute_clickhouse_query(query)
    issues = data.get("data", [])
    logger.info(f"Found {len(issues)} API issue(s) matching criteria.")
    return issues, display_date


# ------------------------------------------------------------------------------
# HTML Email Report Builder
# ------------------------------------------------------------------------------
def build_report_html(issues: list[dict], report_date_raw: str) -> str:
    """
    Renders `api_alert_email.html` template:
      1. Formats {{REPORT_DATE}} (e.g. 26 Oct 2026), {{TOTAL_COUNT}}, {{YEAR}}.
      2. Replaces the ROW TEMPLATE block with alternating styled <tr> elements:
         - Odd rows: #ffffff, Even rows: #f9fafb
         - Status Code badge: amber (#fef3c7 / #92400e) for 200, red (#fee2e2 / #991b1b) for failed codes
         - Response badge: Empty (amber), Timeout (orange), Failed (red)
      3. HTML-escapes all DB strings to prevent injection.
    """
    template_path = BASE_DIR / "api_alert_email.html"
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found at: {template_path}")
        
    template_content = template_path.read_text(encoding="utf-8")
    
    # Parse report date for header
    try:
        dt_obj = datetime.strptime(report_date_raw[:10], "%Y-%m-%d")
        report_date_formatted = dt_obj.strftime("%d %b %Y")
        report_year = dt_obj.strftime("%Y")
    except Exception:
        now_ist = datetime.now(LOCAL_TZ)
        report_date_formatted = now_ist.strftime("%d %b %Y")
        report_year = now_ist.strftime("%Y")

    # Generate row HTML
    generated_rows = []
    for idx, row in enumerate(issues, start=1):
        bg_color = "#ffffff" if idx % 2 != 0 else "#f9fafb"
        
        # Clean fields
        raw_date = str(row.get("Date") or "")[:10]  # YYYY-MM-DD
        page = html.escape(str(row.get("Page") or "N/A"))
        client_db = html.escape(str(row.get("client_db") or "N/A"))
        segment = html.escape(str(row.get("segment") or "N/A"))
        api_endpoint = html.escape(str(row.get("api") or "N/A"))
        
        status_code = row.get("status_code")
        is_empty = int(row.get("empty_response") or 0) == 1
        resp_status = str(row.get("response_status") or "").strip().lower()
        err_msg = str(row.get("error_message") or "").strip().lower()
        
        status_num = int(status_code) if (status_code is not None and str(status_code).isdigit()) else 0

        # Determine Response Reason (Empty / Timeout / Failed)
        if "timeout" in err_msg or "timed out" in err_msg or status_num in (408, 504):
            response_badge_html = (
                '<span style="display:inline-block; padding:3px 10px; border-radius:12px; '
                'background-color:#ffedd5; color:#c2410c; font-weight:600; font-size:12px;">'
                'Timeout</span>'
            )
        elif status_num >= 400 or (status_num == 0 and resp_status == "failed") or resp_status == "failed":
            response_badge_html = (
                '<span style="display:inline-block; padding:3px 10px; border-radius:12px; '
                'background-color:#fee2e2; color:#991b1b; font-weight:600; font-size:12px;">'
                'Failed</span>'
            )
        elif is_empty:
            response_badge_html = (
                '<span style="display:inline-block; padding:3px 10px; border-radius:12px; '
                'background-color:#fef3c7; color:#92400e; font-weight:600; font-size:12px;">'
                'Empty</span>'
            )
        else:
            response_badge_html = (
                '<span style="display:inline-block; padding:3px 10px; border-radius:12px; '
                'background-color:#fee2e2; color:#991b1b; font-weight:600; font-size:12px;">'
                'Failed</span>'
            )

        # Status Code badge
        if status_num == 200:
            status_badge_html = (
                '<span style="display:inline-block; padding:3px 10px; border-radius:12px; '
                'background-color:#fef3c7; color:#92400e; font-weight:600; font-size:12px;">'
                '200</span>'
            )
        else:
            code_text = str(status_code) if (status_code is not None and status_num != 0) else "0"
            status_badge_html = (
                '<span style="display:inline-block; padding:3px 10px; border-radius:12px; '
                'background-color:#fee2e2; color:#991b1b; font-weight:600; font-size:12px;">'
                f'{html.escape(code_text)}</span>'
            )

        row_tr = f"""                  <tr style="background-color:{bg_color};">
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">{idx}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827; white-space:nowrap;">{html.escape(raw_date)}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">{page}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">{client_db}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#111827;">{segment}</td>
                    <td style="padding:10px 12px; border:1px solid #e5e7eb; color:#b91c1c; word-break:break-all;">{api_endpoint}</td>
                    <td align="center" style="padding:10px 12px; border:1px solid #e5e7eb;">{status_badge_html}</td>
                    <td align="center" style="padding:10px 12px; border:1px solid #e5e7eb;">{response_badge_html}</td>
                  </tr>"""
        generated_rows.append(row_tr)

    all_rows_str = "\n".join(generated_rows)
    
    # Replace the ROW TEMPLATE block between comment delimiters
    row_block_pattern = re.compile(
        r"<!-- ===== ROW TEMPLATE:.*?<!-- ===== END ROW TEMPLATE ===== -->",
        re.DOTALL
    )
    if row_block_pattern.search(template_content):
        rendered_html = row_block_pattern.sub(all_rows_str, template_content)
    else:
        # Fallback if comments were removed: insert rows inside tbody
        rendered_html = template_content.replace(
            "<tbody>", f"<tbody>\n{all_rows_str}"
        )

    # Replace placeholders
    rendered_html = rendered_html.replace("{{REPORT_DATE}}", report_date_formatted)
    rendered_html = rendered_html.replace("{{TOTAL_COUNT}}", str(len(issues)))
    rendered_html = rendered_html.replace("{{YEAR}}", report_year)
    rendered_html = rendered_html.replace("Your Company Name", "Trailytics")

    return rendered_html, report_date_formatted


# ------------------------------------------------------------------------------
# Email Dispatcher via Office 365 SMTP
# ------------------------------------------------------------------------------
def send_report_email(
    recipients: list[str],
    html_content: str,
    report_date_str: str,
    issue_count: int,
    batch_size: int = 50,
    max_retries: int = 3,
) -> bool:
    """
    Sends the HTML report via Office 365 SMTP using TLS (port 587).
    - Sets From header to SENDER_EMAIL
    - Places all recipients in BCC to maintain privacy
    - Splits into batches if recipient count exceeds batch_size
    - Retries up to max_retries with delay on transient network errors
    - If authentication fails, stops cleanly and logs diagnostic help without exposing password
    """
    if not SENDER_PASSWORD:
        logger.error(
            "SENDER_PASSWORD is empty! Please configure SENDER_PASSWORD in .env before sending."
        )
        return False

    subject = f"API Alert Report - {report_date_str} - {issue_count} issues found"
    
    # Split recipients into batches
    batches = [
        recipients[i : i + batch_size]
        for i in range(0, len(recipients), batch_size)
    ]
    total_batches = len(batches)
    logger.info(
        f"Preparing to send report to {len(recipients)} recipient(s) across {total_batches} batch(es)."
    )

    for b_idx, batch in enumerate(batches, start=1):
        # Create message container
        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr((SENDER_DISPLAY_NAME, SENDER_EMAIL))
        msg["To"] = SENDER_EMAIL  # Outward To header points to sender, recipients receive via BCC
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)
        
        # Plain text fallback
        plain_text = (
            f"API Alert Report - {report_date_str}\n"
            f"Total issues found: {issue_count}\n\n"
            "Please view this email in an HTML-capable email client to view the complete table of failed APIs."
        )
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        # Send with retry loop
        sent_success = False
        for attempt in range(1, max_retries + 1):
            server = None
            try:
                logger.info(
                    f"Connecting to SMTP server {SMTP_HOST}:{SMTP_PORT} (Batch {b_idx}/{total_batches}, Attempt {attempt}/{max_retries})..."
                )
                server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
                server.ehlo()
                server.starttls()
                server.ehlo()
                
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
                
                # Envelope recipients include sender + batch BCC list
                envelope_recipients = list(set([SENDER_EMAIL] + batch))
                server.sendmail(SENDER_EMAIL, envelope_recipients, msg.as_string())
                
                logger.info(
                    f"Successfully sent batch {b_idx}/{total_batches} ({len(batch)} recipients)."
                )
                sent_success = True
                break
                
            except smtplib.SMTPAuthenticationError as auth_err:
                logger.error(
                    f"Office 365 SMTP Authentication Failed (Error Code {auth_err.smtp_code}): {auth_err.smtp_error.decode(errors='ignore')}\n"
                    "  [IMPORTANT TROUBLESHOOTING]:\n"
                    "  1. Verify SENDER_EMAIL and SENDER_PASSWORD in .env.\n"
                    "  2. In Microsoft 365 Admin Center: Ensure 'Authenticated SMTP' (SMTP AUTH) is enabled for this mailbox.\n"
                    "  3. If Multi-Factor Authentication (MFA) is enabled on this account, you MUST generate an App Password\n"
                    "     at https://account.activedirectory.windowsazure.com/AppPasswords.aspx and use it as SENDER_PASSWORD."
                )
                return False  # Do not retry on permanent auth error
                
            except Exception as exc:
                logger.warning(
                    f"SMTP send attempt {attempt}/{max_retries} failed for batch {b_idx}: {exc}"
                )
                if attempt < max_retries:
                    delay = attempt * 5
                    logger.info(f"Retrying batch {b_idx} in {delay} seconds...")
                    time.sleep(delay)
                else:
                    logger.error(f"Failed to send batch {b_idx} after {max_retries} attempts.")
                    return False
            finally:
                if server:
                    try:
                        server.quit()
                    except Exception:
                        pass

        if not sent_success:
            return False

    return True


# ------------------------------------------------------------------------------
# Main Execution Orchestrator
# ------------------------------------------------------------------------------
def run_report_job(dry_run: bool = False, test_email: str = None, date_scope: str = None) -> bool:
    """
    Executes a single reporting cycle:
      1. Queries recipient list from ClickHouse `api_alert`.
      2. Queries issues from ClickHouse `api_logs`.
      3. Renders HTML email.
      4. Saves `preview.html` if --dry-run or outputs to console.
      5. Sends email via Office 365 SMTP if not dry run.
    """
    run_timestamp = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d %H:%M:%S %Z")
    logger.info("=" * 70)
    logger.info(f"Starting API Alert Report cycle at {run_timestamp}")
    logger.info("=" * 70)

    effective_scope = date_scope or DATE_SCOPE

    # 1. Fetch Recipients
    if test_email:
        recipients = [test_email.strip().lower()]
        logger.info(f"Test mode active: using override recipient: {recipients}")
    else:
        recipients = fetch_recipients()

    if not recipients:
        logger.warning(
            f"No active recipients found in `{CLICKHOUSE_DB}.{API_ALERT_TABLE}`. Aborting email delivery."
        )
        return False

    # 2. Fetch API Issues
    try:
        issues, report_date_raw = fetch_api_issues(scope=effective_scope)
    except Exception as exc:
        logger.error(f"Database query failed: {exc}")
        return False

    issue_count = len(issues)
    logger.info(f"Total API issues detected: {issue_count}")

    # Check zero-issue scenario
    if issue_count == 0 and not SEND_IF_NO_ISSUES:
        logger.info(
            "Zero API issues detected and SEND_IF_NO_ISSUES=false. Skipping email notification."
        )
        return True

    # 3. Build HTML Template
    try:
        rendered_html, report_date_formatted = build_report_html(issues, report_date_raw)
    except Exception as exc:
        logger.error(f"HTML rendering failed: {exc}")
        return False

    # 4. Dry-Run Handling
    if dry_run:
        preview_file = BASE_DIR / "preview.html"
        preview_file.write_text(rendered_html, encoding="utf-8")
        logger.info("*" * 70)
        logger.info(f"[DRY-RUN COMPLETE] Saved generated report to: {preview_file.resolve()}")
        logger.info(f"Report Date: {report_date_formatted}")
        logger.info(f"Total Rows: {issue_count}")
        logger.info(f"Target Recipients ({len(recipients)}): {', '.join(recipients[:5])}{'...' if len(recipients) > 5 else ''}")
        logger.info("No email was sent (dry-run mode).")
        logger.info("*" * 70)
        return True

    # 5. Send Email
    success = send_report_email(
        recipients=recipients,
        html_content=rendered_html,
        report_date_str=report_date_formatted,
        issue_count=issue_count,
        batch_size=RECIPIENT_BATCH_SIZE,
    )

    if success:
        logger.info(
            f"SUCCESS: Report delivered to {len(recipients)} recipient(s) for date {report_date_formatted}."
        )
    else:
        logger.error("FAILURE: Report delivery could not be completed.")

    return success


# ------------------------------------------------------------------------------
# APScheduler Daemon Mode
# ------------------------------------------------------------------------------
def start_scheduler():
    """
    Runs the report on a continuous daily schedule at SCHEDULE_TIME (default 09:00 AM IST)
    using APScheduler BackgroundScheduler.
    """
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger

    sched = BlockingScheduler(timezone=LOCAL_TZ)

    # Parse HH:MM from SCHEDULE_TIME
    try:
        hour_str, min_str = SCHEDULE_TIME.split(":")
        hour, minute = int(hour_str), int(min_str)
    except Exception:
        hour, minute = 9, 0
        logger.warning(f"Invalid SCHEDULE_TIME '{SCHEDULE_TIME}'. Defaulting to 09:00.")

    trigger = CronTrigger(hour=hour, minute=minute, timezone=LOCAL_TZ)
    sched.add_job(
        run_report_job,
        trigger=trigger,
        name="Daily_API_Alert_Report",
        misfire_grace_time=3600,
    )

    logger.info("=" * 70)
    logger.info(f"API Alert Scheduler started successfully.")
    logger.info(f"Daily execution configured for {hour:02d}:{minute:02d} {TZ_NAME}.")
    logger.info("Press Ctrl+C to terminate.")
    logger.info("=" * 70)

    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler terminated by user.")


# ------------------------------------------------------------------------------
# Entrypoint CLI
# ------------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Automated Daily Email Reporter for API Monitoring"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build HTML, save to preview.html, print issue count & recipients, send nothing.",
    )
    parser.add_argument(
        "--now",
        action="store_true",
        help="Execute report query and send email immediately once.",
    )
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Run continuous scheduler at 09:00 AM IST daily (APScheduler daemon).",
    )
    parser.add_argument(
        "--test-email",
        type=str,
        default=None,
        help="Send to a single test email address instead of the database recipient table.",
    )
    parser.add_argument(
        "--date-scope",
        type=str,
        choices=["latest", "today", "yesterday", "both"],
        default=None,
        help="Override date scope filter (default: from .env or 'latest').",
    )

    args = parser.parse_args()

    # If --schedule flag is provided, start scheduler loop
    if args.schedule:
        start_scheduler()
    else:
        # Default behavior (or --dry-run / --now): execute once
        dry_run = args.dry_run or (not args.now and not args.test_email and not args.schedule)
        if dry_run and not args.dry_run:
            logger.info("No run flag specified (--now, --schedule, --test-email). Defaulting to --dry-run.")
            dry_run = True

        run_report_job(
            dry_run=dry_run,
            test_email=args.test_email,
            date_scope=args.date_scope,
        )


if __name__ == "__main__":
    main()
