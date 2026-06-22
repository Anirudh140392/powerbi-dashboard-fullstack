# Ratings automation — Temporal worker

Daily pipeline: **MySQL sync → ML jobs → rating-drop alert check**, orchestrated
by a Temporal workflow and run on a self-hosted Temporal cluster under the
`rating` namespace.

## Layout

| File | Purpose |
| --- | --- |
| `src/shared.ts` | namespace / task-queue constants, types, ML job lists |
| `src/client.ts` | Temporal client factory |
| `src/activities.ts` | sync / ML / alert activities (Node runtime — spawns repo scripts) |
| `src/workflows.ts` | `dailyPipelineWorkflow` orchestration (sandbox — no I/O) |
| `src/worker.ts` | worker process — registers workflow + activities |
| `src/schedule.ts` | one-shot: create/update the daily Temporal Schedule |
| `Dockerfile` | worker image (Node + Python; build from repo root) |
| `requirements.txt` | Python deps for the spawned ML scripts |

## Prerequisites

1. **Create the `rating` namespace** on the Temporal cluster (one-time, manual).
   On the Temporal VM:
   ```sh
   # Temporal CLI:
   temporal operator namespace create --namespace rating
   # or, older tctl:
   tctl --ns rating namespace register
   ```
2. The worker host must reach **both** the Prestige MySQL DB (`3306`) and the
   adsauto Postgres (`5432`). Run the worker on the adsauto VM (or wherever both
   are reachable).
3. Fill `temporal/.env` from `.env.example` — includes the adsauto Postgres
   creds, the Prestige MySQL creds (for the sync scripts), `GEMINI_API_KEY`, and
   the SMTP creds for alert emails.

## Build & run

```sh
# from the repo root:
docker build -f temporal/Dockerfile -t rating-temporal-worker .
docker run -d --env-file temporal/.env --name rating-worker rating-temporal-worker
```

Or locally without Docker:
```sh
cd temporal
npm install
npm run build
npm run worker          # starts the worker
```

## Create the daily schedule

After the worker is running and the `rating` namespace exists:
```sh
cd temporal
npm run schedule        # reads AUTOMATION_COMPANY_IDS, creates rating-daily-<companyId>
```
Idempotent — re-running updates the schedule. Overlap policy is `SKIP`.

## Manual trigger

The Express API exposes `POST /api/automation/trigger`, which starts
`dailyPipelineWorkflow` on the `rating-pipeline` task queue for the caller's
company. Watch it in the Temporal UI.

## Notes / open items

- `requirements.txt` versions are best-effort — verify on the first Docker build
  and pin exact versions.
- One schedule per company id; multi-company is just more ids in
  `AUTOMATION_COMPANY_IDS`.
