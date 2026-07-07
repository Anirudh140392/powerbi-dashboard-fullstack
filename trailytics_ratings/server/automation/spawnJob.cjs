/**
 * Shared ML-job spawner.
 *
 * Extracted from the inline logic in server/api.cjs so the same spawn +
 * ratings.ml_jobs_log bookkeeping is used by both the HTTP endpoint
 * (POST /api/ml/jobs/spawn) and the Temporal worker activity (runMlJob).
 *
 * spawnJob() inserts a RUNNING ml_jobs_log row, spawns the child process,
 * streams stdout/stderr into the log column (batched), enforces a 30-minute
 * timeout, and resolves `done` when the process exits. It never throws on a
 * job *failure* — a failed job resolves `done` with status 'FAILED' so the
 * caller (workflow) can record PARTIAL and continue.
 */
const { spawn, execSync } = require('child_process');

const JOB_TIMEOUT_MS = 30 * 60 * 1000;
// Per-job overrides for the global 30-minute cap. BERT Inference walks
// hundreds of thousands of reviews at ~0.1s each — needs hours, not minutes.
const PER_JOB_TIMEOUT_MS = {
    'BERT Inference': 6 * 60 * 60 * 1000,         // 6 hours
    'DeBERTa Taxonomy': 4 * 60 * 60 * 1000,       // 4 hours
    'Sentiment Backfill': 2 * 60 * 60 * 1000,     // 2 hours
    'Competitor Matrix Match': 2 * 60 * 60 * 1000,
    'Master Spec Enrichment': 2 * 60 * 60 * 1000,
};

let cachedPythonBin = null;
function resolvePythonBin() {
    if (cachedPythonBin) return cachedPythonBin;
    const configured = process.env.PYTHON_BIN && process.env.PYTHON_BIN.trim();
    if (configured) {
        cachedPythonBin = configured;
        return cachedPythonBin;
    }
    for (const cmd of ['python', 'python3', '/usr/local/bin/python']) {
        try {
            execSync(`${cmd} --version`, { stdio: 'pipe' });
            cachedPythonBin = cmd;
            return cmd;
        } catch (_) { /* try next */ }
    }
    throw new Error('No Python runtime found. Set PYTHON_BIN or install python/python3 in the environment.');
}

/**
 * Maps a jobName to its { command, args }. Returns null for unknown jobs.
 * Kept as a function (not a static map) because the python binary is resolved lazily.
 */
function resolveJobCommand(jobName, ids) {
    switch (jobName) {
        case 'Gemini Audit':
            return { command: 'npx', args: ['tsx', 'scripts/ml_data_audit.ts'] };
        case 'BERT Inference':
            return { command: resolvePythonBin(), args: ['scripts/bert_rating_inference.py'] };
        case 'DeBERTa Taxonomy': {
            const args = ['scripts/local_taxonomy_classifier.py'];
            if (ids && ids.length > 0) args.push(ids.join(','));
            return { command: resolvePythonBin(), args };
        }
        case 'SetFit Issues':
            // In-house SetFit issue/feedback classifier (37 aspects) — replaces the
            // DeBERTa taxonomy for new reviews. Incremental (only unclassified rows),
            // polarity-correction baked in. Self-installs setfit on first run.
            return { command: resolvePythonBin(), args: ['scripts/setfit_issue_inference.py'] };
        case 'Competitor Matrix Match':
            return { command: resolvePythonBin(), args: ['scripts/competitor_matching.py'] };
        case 'Master Spec Enrichment':
            return { command: 'node', args: ['scripts/bulk_spec_enricher.cjs'] };
        case 'Sentiment Backfill':
            return { command: resolvePythonBin(), args: ['scripts/db_ml_backfill.py'] };
        default:
            return null;
    }
}

const KNOWN_JOBS = [
    'Gemini Audit',
    'BERT Inference',
    'DeBERTa Taxonomy',
    'Competitor Matrix Match',
    'Master Spec Enrichment',
    'Sentiment Backfill',
];

/**
 * Spawn an ML job.
 *
 * @param {object} opts
 * @param {import('pg').Pool} opts.pool   Postgres pool (caller-owned).
 * @param {string} opts.companyId         Tenant scope, passed as COMPANY_ID env to the child.
 * @param {string} opts.jobName           One of KNOWN_JOBS.
 * @param {string[]} [opts.ids]           Optional row ids for jobs that accept them.
 * @param {string} [opts.cwd]             Working dir (defaults to AUTOMATION_REPO_ROOT or process.cwd()).
 * @param {(line:string)=>void} [opts.onLog]  Optional live log sink (used for Temporal heartbeats).
 * @returns {Promise<{jobId:string, done:Promise<{jobId:string,status:string,exitCode:number|null}>}>}
 */
async function spawnJob({ pool, companyId, jobName, ids, cwd, onLog }) {
    const resolved = resolveJobCommand(jobName, ids);
    if (!resolved) {
        const err = new Error(`Unknown jobName: ${jobName}`);
        err.code = 'UNKNOWN_JOB';
        throw err;
    }
    const { command, args } = resolved;
    const workDir = cwd || process.env.AUTOMATION_REPO_ROOT || process.cwd();

    const { rows } = await pool.query(
        `INSERT INTO ratings.ml_jobs_log (company_id, job_name, status)
         VALUES ($1, $2, 'RUNNING') RETURNING id`,
        [companyId, jobName]
    );
    const jobId = rows[0].id;

    const child = spawn(command, args, {
        cwd: workDir,
        env: { ...process.env, COMPANY_ID: companyId },
    });

    // Batch log writes to reduce DB I/O (flush every 5s), cap stored logs at 100KB.
    let logBuffer = '';
    let flushTimer = null;
    const flushLogs = async () => {
        if (!logBuffer) return;
        const chunk = logBuffer;
        logBuffer = '';
        try {
            await pool.query(
                `UPDATE ratings.ml_jobs_log SET logs = LEFT(COALESCE(logs,'') || $1, 100000) WHERE id = $2`,
                [chunk, jobId]
            );
        } catch (_) { /* logging is best-effort */ }
    };
    const appendLog = (text) => {
        logBuffer += text;
        if (onLog) {
            try { onLog(text); } catch (_) { /* ignore sink errors */ }
        }
        if (!flushTimer) {
            flushTimer = setTimeout(async () => {
                flushTimer = null;
                await flushLogs();
            }, 5000);
        }
    };

    child.stdout.on('data', (d) => appendLog(d.toString()));
    child.stderr.on('data', (d) => appendLog(d.toString()));

    const timeoutMs = PER_JOB_TIMEOUT_MS[jobName] || JOB_TIMEOUT_MS;
    const done = new Promise((resolve) => {
        const timeoutHandle = setTimeout(async () => {
            try { child.kill('SIGTERM'); } catch (_) { /* already gone */ }
            if (flushTimer) clearTimeout(flushTimer);
            appendLog(`\n[System] Auto-terminated: exceeded ${timeoutMs / 60000} minute timeout.\n`);
            await flushLogs();
            try {
                await pool.query(
                    `UPDATE ratings.ml_jobs_log
                     SET status = 'FAILED', completed_at = NOW()
                     WHERE id = $1 AND status = 'RUNNING'`,
                    [jobId]
                );
            } catch (_) { /* best-effort */ }
            resolve({ jobId, status: 'FAILED', exitCode: null });
        }, timeoutMs);

        child.on('error', async (err) => {
            clearTimeout(timeoutHandle);
            if (flushTimer) clearTimeout(flushTimer);
            appendLog(`\n[FATAL] Engine failed to start: ${err.message}. Ensure node/npx/python is available.\n`);
            await flushLogs();
            try {
                await pool.query(
                    `UPDATE ratings.ml_jobs_log SET status = 'FAILED', completed_at = NOW() WHERE id = $1`,
                    [jobId]
                );
            } catch (_) { /* best-effort */ }
            resolve({ jobId, status: 'FAILED', exitCode: null });
        });

        child.on('close', async (code) => {
            clearTimeout(timeoutHandle);
            if (flushTimer) clearTimeout(flushTimer);
            appendLog(`\n[System] Process exited with code ${code}\n`);
            await flushLogs();
            const status = code === 0 ? 'COMPLETED' : 'FAILED';
            try {
                await pool.query(
                    `UPDATE ratings.ml_jobs_log SET status = $1, completed_at = NOW() WHERE id = $2`,
                    [status, jobId]
                );
            } catch (_) { /* best-effort */ }
            resolve({ jobId, status, exitCode: code });
        });
    });

    return { jobId, done };
}

/**
 * Reconcile orphaned RUNNING jobs at process startup.
 *
 * If the worker container is killed mid-job (Railway redeploy, OOM,
 * Temporal worker restart), the Python child dies with it and our close/
 * error/timeout handlers never fire — so ml_jobs_log rows stay RUNNING
 * forever. The auto-approve watcher then never advances coverage and
 * /settings shows a job that's been "running" for days.
 *
 * Call this once at every server/worker boot. Anything still RUNNING
 * with a started_at older than the per-job timeout is definitely orphaned
 * (the in-process timeout would have fired by now if the process were
 * still alive). Mark them FAILED with a clear breadcrumb.
 *
 * @param {object} opts
 * @param {import('pg').Pool} opts.pool
 * @param {string} [opts.reason]  Free text logged into the recovery note.
 */
async function reconcileOrphanedJobs({ pool, reason = 'process restarted' }) {
    // Find anything older than its per-job timeout (or 30m default + 5m grace).
    const result = await pool.query(`
        UPDATE ratings.ml_jobs_log
        SET status = 'FAILED',
            completed_at = NOW(),
            logs = COALESCE(logs, '') || E'\n\n[recovery] ' || NOW()::text || ' marked FAILED: ' || $1::text
        WHERE status = 'RUNNING'
          AND started_at < NOW() - INTERVAL '15 minutes'
        RETURNING id, job_name, EXTRACT(EPOCH FROM (NOW() - started_at))/60 AS age_minutes
    `, [`${reason} — handlers never fired so this row was orphaned`]);
    if (result.rows.length > 0) {
        console.log(`[ml-jobs] Reconciled ${result.rows.length} orphaned job(s) on startup:`);
        for (const r of result.rows) {
            console.log(`  ${r.id.toString().slice(0, 8)}  ${r.job_name}  age=${Number(r.age_minutes).toFixed(0)}m`);
        }
    } else {
        console.log('[ml-jobs] No orphaned jobs found on startup.');
    }
    return result.rows;
}

module.exports = { spawnJob, resolveJobCommand, resolvePythonBin, KNOWN_JOBS, reconcileOrphanedJobs };
