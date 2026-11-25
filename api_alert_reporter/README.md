# Automated Daily API Alert Email Reporter

This service monitors API health from the `admin_master.api_logs` table in ClickHouse, extracts all APIs that failed (non-200 / failed status) or returned an empty response (`empty_response = 1`), renders the `api_alert_email.html` template, and sends the report daily at 9:00 AM IST through Office 365 SMTP to all active recipients dynamically fetched from `admin_master.api_alert`.

---

## 📁 Project Structure

```text
api_alert_reporter/
├── api_alert_email.html       # Exact email HTML template (Outlook inline styles)
├── send_api_alert_report.py   # Main Python reporting and email dispatcher script
├── requirements.txt           # Python dependencies
├── .env.example               # Configuration template (fill with your credentials)
├── .gitignore                 # Protects secrets (.env), logs, and preview outputs
├── run_report.bat             # Batch launcher for Windows Task Scheduler
├── setup_scheduled_task.ps1   # 1-click PowerShell scheduler setup script
├── preview.html               # Generated when running --dry-run (gitignored)
└── logs/
    └── api_report.log         # Execution log (timestamp, row counts, send status)
```

---

## ⚙️ Prerequisites & Setup

### 1. Install Dependencies

Run the following in your terminal:

```bash
cd api_alert_reporter
pip install -r requirements.txt
```

### 2. Configure Credentials (`.env`)

Copy `.env.example` to `.env` (or configure in `backend/.env`):

```bash
cp .env.example .env
```

Fill in your credentials in `.env`:

```env
# Office 365 Sender Mailbox
SENDER_EMAIL=business@trailytics.com
SENDER_PASSWORD=your_office365_password_or_app_password
SMTP_HOST=smtp.office365.com
SMTP_PORT=587

# ClickHouse Database
CLICKHOUSE_URL=http://13.200.55.131:8123
CLICKHOUSE_USER=kenil_user
CLICKHOUSE_PASSWORD=Kenil@Kavar0604
ADMIN_DB=admin_master

# Report Scope & Filtering
DATE_SCOPE=latest
SEND_IF_NO_ISSUES=false
RECIPIENT_BATCH_SIZE=50
SCHEDULE_TIME=09:00
TIMEZONE=Asia/Kolkata
```

> [!IMPORTANT]
> **Microsoft 365 SMTP Requirements:**
>
> 1. **SMTP AUTH Enabled**: In Microsoft 365 Admin Center -> Users -> Active users -> `business@trailytics.com` -> Mail tab -> Manage email apps -> Check **Authenticated SMTP**.
> 2. **Multi-Factor Authentication (MFA)**: If MFA is turned on for this mailbox, regular passwords will not work. You must create an **App Password** from the Microsoft Account security page (`https://account.activedirectory.windowsazure.com/AppPasswords.aspx`) and paste it into `SENDER_PASSWORD`.

---

## 🚀 Usage & CLI Options

### 1. Dry Run (Test Data & Generate HTML Preview)

Executes database queries, renders the email HTML, and saves it to `preview.html` without sending an email:

```bash
python send_api_alert_report.py --dry-run
```

Open `preview.html` in your browser to verify table layout, badge colors, and counts.

### 2. Test Send to a Specific Email Address

Sends the real email report directly to a test address without messaging the entire recipient list:

```bash
python send_api_alert_report.py --test-email your_email@trailytics.com
```

### 3. Immediate Run (Full Production Run)

Queries `api_alert` for all live recipients and sends the email report immediately:

```bash
python send_api_alert_report.py --now
```

### 4. Background Daemon Scheduler (APScheduler Option)

Runs the scheduler directly in the Python process at 9:00 AM IST daily:

```bash
python send_api_alert_report.py --schedule
```

---

## ⏰ Scheduling Daily at 9:00 AM IST on Windows

Windows Task Scheduler is the recommended option on Windows because it executes reliably in the background without needing a terminal window to remain open.

### Option A: One-Click PowerShell Command (Recommended)

Open PowerShell (as Administrator) in `api_alert_reporter/` and run:

```powershell
.\setup_scheduled_task.ps1
```

Or run this single command directly from any terminal:

```cmd
schtasks /create /tn "Trailytics_API_Alert_Daily_Report" /tr "e:\Trailytics_log\powerbi-dashboard-fullstack\api_alert_reporter\run_report.bat" /sc daily /st 09:00 /f
```

### Option B: Windows Task Scheduler GUI

1. Press `Win + R`, type `taskschd.msc`, and press Enter.
2. Click **Create Basic Task...** in the right sidebar.
3. **Name**: `Trailytics API Alert Daily Report` -> Next.
4. **Trigger**: Select **Daily** -> Next.
5. **Time**: Set start time to `09:00:00` (Recur every: 1 days) -> Next.
6. **Action**: Select **Start a program** -> Next.
7. **Program/script**: Browse and select `run_report.bat` (e.g. `e:\Trailytics_log\powerbi-dashboard-fullstack\api_alert_reporter\run_report.bat`).
8. **Start in (optional)**: Enter `e:\Trailytics_log\powerbi-dashboard-fullstack\api_alert_reporter`.
9. Click **Finish**.

---

## 🧪 3-Phase Test Plan

1. **Phase 1: Dry-Run Verification**
   - Run `python send_api_alert_report.py --dry-run`.
   - Verify console output shows detected issues (e.g. 57 issues) and target recipients.
   - Inspect `preview.html` in a web browser to verify table design, headers, alternating row colors, and badge styling:
     - **Status Code Column**: Amber badge (`#fef3c7 / #92400e`) for 200, Red badge (`#fee2e2 / #991b1b`) for Failed/Timeout codes (0 / 4xx / 5xx).
     - **Response Column**:
       - `Empty` badge: Amber (`#fef3c7 / #92400e`) when API returned status 200 but payload had zero data.
       - `Timeout` badge: Orange (`#ffedd5 / #c2410c`) when request timed out (e.g. 30000ms timeout).
       - `Failed` badge: Red (`#fee2e2 / #991b1b`) for non-200 HTTP failure codes (e.g. 404, 500).

2. **Phase 2: Single Recipient Test Send**
   - Fill in your `SENDER_PASSWORD` in `.env`.
   - Run `python send_api_alert_report.py --test-email your_email@trailytics.com`.
   - Verify delivery in your Outlook inbox: check subject line, inline styling, and sender address.

3. **Phase 3: Production Table & Schedule Enablement**
   - Ensure the `admin_master.api_alert` table contains the intended production recipient addresses.
   - Run `.\setup_scheduled_task.ps1` to activate the 9:00 AM daily task.
   - Check `logs/api_report.log` for execution history and status tracking.
