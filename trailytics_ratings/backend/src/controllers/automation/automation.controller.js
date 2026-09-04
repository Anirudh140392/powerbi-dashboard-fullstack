import pool from '../../config/db.js';

export const getAlertRules = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM ratings.alert_rules WHERE company_id = $1 ORDER BY created_at DESC`,
            [req.companyId]
        );
        res.json({ rules: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Fire-and-forget Temporal workflow to evaluate one rule the moment it's
 * created or activated. Doesn't block the API response — if Temporal is
 * unreachable we just log a warning so rule creation still succeeds.
 */
async function startInstantRuleWorkflow({ companyId, ruleId, reason }) {
    try {
        const client = await getTemporalClient();
        const { taskQueue } = getTemporalConfig();
        const workflowId = `instant-rule-${ruleId}-${Date.now()}`;
        await client.workflow.start('runRuleInstantWorkflow', {
            args: [{ companyId, ruleId }],
            taskQueue,
            workflowId,
        });
        console.log(`[alert-rule] ${reason} → fired ${workflowId}`);
    } catch (e) {
        // Temporal unreachable / namespace missing / worker down — non-fatal.
        // The rule still saved; the next daily-pipeline run will pick it up.
        console.warn(`[alert-rule] instant trigger skipped (${reason}): ${e.message}`);
    }
}

export const createAlertRule = async (req, res) => {
    try {
        const { value, error } = normalizeRuleInput(req.body);
        if (error) return res.status(400).json({ error });
        const { rows } = await pool.query(
            `INSERT INTO ratings.alert_rules
               (company_id, name, scope_type, scope_value, platform, absolute_floor,
                drop_delta, comparison_window, min_rating_count, recipients, enabled, created_by,
                brand_filter, category_filter, classification, sentiment_category,
                min_review_count, trigger_mode, actions, cron_expression, or_group,
                is_competitor_scope, platforms, brands, categories, web_pids)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21::jsonb,
                     $22,$23::text[],$24::text[],$25::text[],$26::text[])
             RETURNING *`,
            [
                req.companyId, value.name, value.scope_type, value.scope_value, value.platform,
                value.absolute_floor, value.drop_delta, value.comparison_window,
                value.min_rating_count, value.recipients, value.enabled,
                req.authUser ? req.authUser.id : null,
                value.brand_filter, value.category_filter, value.classification, value.sentiment_category,
                value.min_review_count, value.trigger_mode, JSON.stringify(value.actions),
                value.cron_expression, value.or_group ? JSON.stringify(value.or_group) : null,
                value.is_competitor_scope, value.platforms, value.brands, value.categories, value.web_pids,
            ]
        );
        const rule = rows[0];
        // Newly-created rule with enabled=true → evaluate immediately so the
        // admin gets the first email within seconds (not on next pipeline run).
        if (rule.enabled) {
            startInstantRuleWorkflow({ companyId: req.companyId, ruleId: rule.id, reason: `rule "${rule.name}" created` })
                .catch(() => {/* already logged */});
        }
        res.status(201).json({ rule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const updateAlertRule = async (req, res) => {
    try {
        const { value, error } = normalizeRuleInput(req.body);
        if (error) return res.status(400).json({ error });

        // Read previous enabled state so we can detect ON-flip transitions.
        const prevRes = await pool.query(
            `SELECT enabled FROM ratings.alert_rules WHERE id=$1 AND company_id=$2`,
            [req.params.id, req.companyId]
        );
        const wasEnabled = prevRes.rows[0]?.enabled === true;

        const { rows } = await pool.query(
            `UPDATE ratings.alert_rules
             SET name=$1, scope_type=$2, scope_value=$3, platform=$4, absolute_floor=$5,
                 drop_delta=$6, comparison_window=$7, min_rating_count=$8, recipients=$9,
                 enabled=$10,
                 brand_filter=$11, category_filter=$12, classification=$13, sentiment_category=$14,
                 min_review_count=$15, trigger_mode=$16, actions=$17::jsonb,
                 cron_expression=$18, or_group=$19::jsonb,
                 is_competitor_scope=$20, platforms=$21::text[], brands=$22::text[],
                 categories=$23::text[], web_pids=$24::text[],
                 updated_at=now()
             WHERE id=$25 AND company_id=$26
             RETURNING *`,
            [
                value.name, value.scope_type, value.scope_value, value.platform,
                value.absolute_floor, value.drop_delta, value.comparison_window,
                value.min_rating_count, value.recipients, value.enabled,
                value.brand_filter, value.category_filter, value.classification, value.sentiment_category,
                value.min_review_count, value.trigger_mode, JSON.stringify(value.actions),
                value.cron_expression, value.or_group ? JSON.stringify(value.or_group) : null,
                value.is_competitor_scope, value.platforms, value.brands, value.categories, value.web_pids,
                req.params.id, req.companyId,
            ]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Alert rule not found' });
        const rule = rows[0];

        // Fire instant evaluation when:
        //   - rule transitioned from disabled → enabled (activation), or
        //   - rule was edited while already enabled (definition changed,
        //     re-eval against the new threshold/scope so admin gets feedback)
        if (rule.enabled) {
            const reason = wasEnabled
                ? `rule "${rule.name}" updated`
                : `rule "${rule.name}" activated`;
            startInstantRuleWorkflow({ companyId: req.companyId, ruleId: rule.id, reason })
                .catch(() => {/* already logged */});
        }
        res.json({ rule });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteAlertRule = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `DELETE FROM ratings.alert_rules WHERE id=$1 AND company_id=$2`,
            [req.params.id, req.companyId]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Alert rule not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Preview a rule — returns the events it would fire now, no insert/email.

export const testAlertRule = async (req, res) => {
    try {
        const result = await testRule(pool, req.params.id, req.companyId);
        // `send=true` (body or query) → after the dry-run preview, actually
        // email the digest to the rule's recipients. Uses the same renderer
        // as the daily flow so what you see in your inbox = what real alerts
        // will look like. Does NOT insert alert_events rows (no dedup pollution).
        const wantSend = req.body?.send === true || req.query?.send === 'true' || req.query?.send === '1';
        if (wantSend && result.events.length > 0) {
            try {
                const { renderDigestHtml } = require('./automation/alertEngine.cjs');
                const { sendAlertEmail, isMailerConfigured } = require('./automation/mailer.cjs');
                if (!isMailerConfigured()) {
                    return res.json({ ...result, sent: false, sendError: 'SMTP not configured on this deploy.' });
                }
                // Load the rule's recipients (testRule strips them; re-read here).
                const { rows: ruleRows } = await pool.query(
                    `SELECT recipients FROM ratings.alert_rules WHERE id = $1 AND company_id = $2`,
                    [req.params.id, req.companyId]
                );
                const recipients = ruleRows[0]?.recipients || [];
                const html = await renderDigestHtml(
                    { ...result.rule, absolute_floor: null, drop_delta: null }, // formatting only
                    result.events
                );
                await sendAlertEmail({
                    to: recipients.length ? recipients : [],
                    subject: `[Ratings TEST] ${result.events.length} match(es) — ${result.rule.name}`,
                    html,
                    priority: 'normal',
                    threadKey: `test-rule-${req.params.id}`,
                });
                return res.json({ ...result, sent: true, sentTo: recipients.length ? recipients : '(default recipients)' });
            } catch (mailErr) {
                console.error('[alert-rule test] send failed:', mailErr);
                return res.json({ ...result, sent: false, sendError: mailErr.message });
            }
        }
        res.json(result);
    } catch (err) {
        if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
};

export const getAlertEvents = async (req, res) => {
    try {
        const params = [req.companyId];
        let where = 'company_id = $1';
        if (req.query.rule_id) {
            params.push(req.query.rule_id);
            where += ` AND rule_id = $${params.length}`;
        }
        const { rows } = await pool.query(
            `SELECT * FROM ratings.alert_events WHERE ${where}
             ORDER BY triggered_at DESC LIMIT 100`,
            params
        );
        res.json({ events: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Pipeline status / history / manual trigger ---

export const getAutomationStatus = async (req, res) => {
    try {
        const { rows: runRows } = await pool.query(
            `SELECT * FROM ratings.automation_runs
             WHERE company_id = $1 ORDER BY started_at DESC LIMIT 1`,
            [req.companyId]
        );
        const { rows: jobRows } = await pool.query(
            `SELECT id, job_name, status, started_at, completed_at
             FROM ratings.ml_jobs_log WHERE company_id = $1
             ORDER BY started_at DESC LIMIT 10`,
            [req.companyId]
        );

        // Temporal schedule health — degrade gracefully if the cluster is unreachable.
        let schedule = { status: 'unreachable' };
        try {
            const client = await getTemporalClient();
            const handle = client.schedule.getHandle(scheduleIdFor(req.companyId));
            const desc = await handle.describe();
            schedule = {
                status: desc.state.paused ? 'paused' : 'active',
                nextActionTimes: (desc.info.nextActionTimes || []).slice(0, 3),
                recentActions: (desc.info.recentActions || []).slice(-3),
            };
        } catch (e) {
            schedule = { status: 'unreachable', detail: e.message };
        }

        res.json({
            lastRun: runRows[0] || null,
            recentJobs: jobRows,
            schedule,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getAutomationRuns = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
        const offset = parseInt(req.query.offset, 10) || 0;
        const { rows } = await pool.query(
            `SELECT * FROM ratings.automation_runs WHERE company_id = $1
             ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
            [req.companyId, limit, offset]
        );
        res.json({ runs: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const triggerAutomation = async (req, res) => {
    try {
        const { rows: running } = await pool.query(
            `SELECT id FROM ratings.automation_runs
             WHERE company_id = $1 AND status = 'RUNNING' LIMIT 1`,
            [req.companyId]
        );
        if (running.length > 0) {
            return res.status(409).json({ error: 'A pipeline run is already in progress for this company.' });
        }

        let client;
        try {
            client = await getTemporalClient();
        } catch (e) {
            return res.status(503).json({ error: `Temporal unreachable: ${e.message}` });
        }

        const { taskQueue } = getTemporalConfig();
        const workflowId = `manual-${req.companyId}-${Date.now()}`;
        const handle = await client.workflow.start('dailyPipelineWorkflow', {
            taskQueue,
            workflowId,
            args: [{ companyId: req.companyId, triggerType: 'manual' }],
        });
        res.json({ success: true, workflowId: handle.workflowId, runId: handle.firstExecutionRunId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// Per-job triggers — let admins fire individual ML jobs from /settings without
// going through the hidden /ml-control page. Backed by spawnJob.cjs (same path
// the Temporal activities use), so behaviour is identical to the scheduled run.
// ============================================================================
// (spawnJob + KNOWN_JOBS imported above near /api/ml/jobs/spawn)

export const getKnownJobs = async (req, res) => {
    res.json({ jobs: KNOWN_JOBS });
};

export const getRecentJobs = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
        const { rows } = await pool.query(
            `SELECT id, job_name, status, started_at, completed_at,
                    EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))::int AS duration_seconds,
                    LENGTH(COALESCE(logs,'')) AS log_size
               FROM ratings.ml_jobs_log
              WHERE company_id = $1
              ORDER BY started_at DESC
              LIMIT $2`,
            [req.companyId, limit]
        );
        res.json({ jobs: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getJobStatus = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, job_name, status, started_at, completed_at,
                    EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))::int AS duration_seconds,
                    RIGHT(COALESCE(logs,''), 8000) AS log_tail
               FROM ratings.ml_jobs_log
              WHERE company_id = $1 AND id = $2`,
            [req.companyId, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Job not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const triggerJob = async (req, res) => {
    try {
        const { jobName, ids, viaTemporal = true } = req.body || {};
        if (!KNOWN_JOBS.includes(jobName)) {
            return res.status(400).json({ error: `Unknown jobName. Allowed: ${KNOWN_JOBS.join(', ')}` });
        }
        // Block if the same job is already running for this company.
        const { rows: running } = await pool.query(
            `SELECT id FROM ratings.ml_jobs_log
              WHERE company_id = $1 AND job_name = $2 AND status = 'RUNNING' LIMIT 1`,
            [req.companyId, jobName]
        );
        if (running.length > 0) {
            return res.status(409).json({
                error: `${jobName} is already running.`,
                jobId: running[0].id,
            });
        }

        // Prefer Temporal so the job runs on the worker (proper heartbeats,
        // retries, and the long-running BERT job doesn't tax the API service).
        // Falls back to a local spawn if Temporal is unreachable.
        if (viaTemporal) {
            try {
                const client = await getTemporalClient();
                const { taskQueue } = getTemporalConfig();
                const workflowId = `manual-job-${jobName.replace(/\s+/g, '-')}-${req.companyId}-${Date.now()}`;
                const handle = await client.workflow.start('singleJobWorkflow', {
                    taskQueue,
                    workflowId,
                    args: [{ companyId: req.companyId, jobName }],
                });
                return res.json({
                    success: true,
                    via: 'temporal',
                    workflowId: handle.workflowId,
                    runId: handle.firstExecutionRunId,
                    jobName,
                });
            } catch (e) {
                console.warn(`[jobs/trigger] Temporal unavailable, falling back to local spawn: ${e.message}`);
            }
        }

        // Fallback: spawn locally on the API service (existing behaviour).
        const { jobId } = await spawnJob({ pool, companyId: req.companyId, jobName, ids });
        res.json({ success: true, via: 'local', jobId, jobName });
    } catch (err) {
        console.error('jobs/trigger error:', err);
        res.status(500).json({ error: err.message });
    }
};


export const getMailerSettings = async (req, res) => {
    try {
        const settings = await getMailerSettings(pool, req.companyId);
        res.json({ settings, defaults: MAILER_DEFAULTS });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// 1) Full-text review search — investigation tool for QA / product teams.
//    Searches across review_text + review_title + product_name with ILIKE.
//    Filters: platform, brand_scope, date range, rating bucket, sentiment.
// ============================================================================

export const updateMailerSettings = async (req, res) => {
    try {
        const updated = await putMailerSettings(pool, req.companyId, req.body || {});
        res.json({ settings: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Send a test alert email — verifies SMTP works and shows the rich HTML
// digest to the user without waiting for a real rating drop.

export const testMail = async (req, res) => {
    try {
        const { sendAlertEmail, isMailerConfigured } = require('./automation/mailer.cjs');
        if (!isMailerConfigured()) {
            return res.status(503).json({ error: 'SMTP not configured (set SMTP_HOST/USER/PASS env vars)' });
        }

        // Multi-SKU preview when caller asks for >1; default = 5 so admins
        // see the consolidated digest layout (top stats + compact rows).
        const requestedCount = Math.max(1, Math.min(parseInt(req.body?.count, 10) || 5, 10));

        const { rows } = await pool.query(`
            SELECT mp.product_external_id AS web_pid,
                   mp.product_name,
                   mp.platform,
                   ps.rating         AS current_rating,
                   ps.rating_count   AS rating_count,
                   COALESCE(ps.category, mp.category)           AS category,
                   COALESCE(ps.pareto_status, mp.pareto_status) AS pareto_status
              FROM masters.products mp
              JOIN ratings.product_snapshots ps
                ON ps.web_pid = mp.product_external_id
               AND ps.company_id = mp.company_id
               AND LOWER(ps.platform) = LOWER(mp.platform)
             WHERE mp.company_id = $1
               AND mp.is_competitor = false
               AND ps.rating IS NOT NULL
               AND ps.rating BETWEEN 1 AND 4
             ORDER BY ps.rating ASC, ps.snapshot_date DESC
             LIMIT $2
        `, [req.companyId, requestedCount]);

        const samples = rows.length ? rows : [{
            web_pid: 'B0SAMPLE',
            product_name: 'Sample Pressure Cooker',
            platform: 'Amazon',
            current_rating: 3.2,
            rating_count: 1240,
            category: 'Pressure Cooker',
            pareto_status: 'Pareto',
        }];

        const issueRotation = ['Build_Quality', 'Stopped_Working', 'Heating_Performance',
                               'Manufacturing_Defects', 'Whistle_Issues', 'Coating_Issues'];

        // Build one event per sample SKU. For each, pull its real negative
        // verbatim reviews so the digest is grounded in actual data.
        const events = await Promise.all(samples.map(async (s, idx) => {
            const previousRating = Math.min(5, Number(s.current_rating) + 0.6 + (idx * 0.05));
            const trend = [];
            for (let i = 13; i >= 0; i--) {
                const ratio = i / 13;
                trend.push(Number((previousRating - (previousRating - s.current_rating) * (1 - ratio)).toFixed(2)));
            }
            // 8-week trend: start a bit higher than previous_rating, smoothly drop to now
            const weeklyTrend = [];
            const weekStart = Math.min(5, previousRating + 0.3);
            for (let w = 7; w >= 0; w--) {
                const ratio = w / 7;
                const noise = ((idx * 7 + w) % 5) * 0.02 - 0.04;
                weeklyTrend.push(Number((weekStart - (weekStart - s.current_rating) * (1 - ratio) + noise).toFixed(2)));
            }
            const { rows: negRows } = await pool.query(`
                SELECT review_text FROM ratings.reviews
                 WHERE company_id = $1 AND web_pid = $2
                   AND rating IS NOT NULL AND rating <= 2
                   AND review_text IS NOT NULL AND LENGTH(review_text) > 20
                 ORDER BY review_date DESC NULLS LAST LIMIT 3
            `, [req.companyId, s.web_pid]);

            return {
                web_pid: s.web_pid,
                product_name: s.product_name,
                platform: s.platform,
                previous_rating: previousRating,
                current_rating: Number(s.current_rating),
                delta: previousRating - Number(s.current_rating),
                reason: 'both',
                specific_issue: issueRotation[idx % issueRotation.length],
                trend,
                weekly_trend: weeklyTrend,
                sample_negatives: negRows.map(r => r.review_text),
                rule_absolute_floor: 4.0,
                rule_drop_delta: 0.5,
                // Fields that drive the grouped digest + Ratings column.
                category: s.category || null,
                pareto_status: s.pareto_status || null,
                rating_count: s.rating_count != null ? Number(s.rating_count) : null,
            };
        }));

        const fakeRule = {
            name: events.length > 1 ? `Multi-SKU test alert (${events.length} products)` : 'Test alert (preview)',
            scope_type: events.length > 1 ? 'category' : 'product',
            scope_value: events.length > 1 ? 'all' : events[0].web_pid,
            absolute_floor: 4.0,
            drop_delta: 0.5,
        };

        const html = await renderDigestHtml(fakeRule, events);
        const recipient = (req.body && req.body.to) || (req.authUser && req.authUser.email) || null;

        const subj = events.length > 1
            ? `[Ratings TEST] ${events.length} products tripped · sample digest`
            : `[Ratings TEST] Sample alert · ${events[0].product_name}`;

        const forceCritical = req.body?.forceCritical === true;
        if (forceCritical && events.length) {
            events[0].current_rating = 1.5;
            events[0].delta = (events[0].previous_rating || 4) - 1.5;
        }
        const worst = events.reduce((m, e) => {
            const r = e.current_rating;
            return r != null && r < (m ?? 99) ? r : m;
        }, null);
        const priority = (forceCritical || (worst != null && worst < 2)) ? 'high' : 'normal';

        // Mailer settings drive everything from here — calendar opt-in,
        // schedule preset, priority threshold, etc.
        const mailerSettings = await getMailerSettings(pool, req.companyId);
        const calCfg = mailerSettings.calendarInvite;
        const shouldAttachCalendar = calCfg.enabled
            && (!calCfg.onlyForCritical || priority === 'high');

        let icsAttachment = null;
        if (shouldAttachCalendar) {
            const { buildCriticalAlertIcs } = require('./automation/icsBuilder.cjs');
            icsAttachment = buildCriticalAlertIcs({
                ruleId: 'test-' + req.companyId,
                ruleName: fakeRule.name,
                events,
                dashboardUrl: events[0]?.web_pid
                    ? `https://prestige-review.up.railway.app/?tab=master&web_pid=${encodeURIComponent(events[0].web_pid)}`
                    : 'https://prestige-review.up.railway.app',
                organizerEmail: process.env.SMTP_USER,
                attendeeEmail: recipient || undefined,
                scheduledAt: resolveScheduledAt(calCfg.schedulePreset, calCfg.scheduleTimeHHMM),
                durationMinutes: calCfg.durationMinutes,
                reminderMinutes: calCfg.reminderMinutes,
            });
        }
        await sendAlertEmail({
            to: recipient ? [recipient] : [],
            subject: subj.slice(0, 120),
            html,
            priority,
            threadKey: `test-${req.companyId}`,
            attachments: icsAttachment ? [icsAttachment] : undefined,
        });

        res.json({
            success: true,
            sentTo: recipient || '(default recipients)',
            skuCount: events.length,
            priority,
            calendarInviteAttached: !!icsAttachment,
        });
    } catch (err) {
        console.error('test-mail error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Stage-scoped triggers — give /settings precise control over which stage of
// the pipeline runs. All routed through Temporal (workflows defined in
// temporal/src/workflows.ts).

export const triggerStage = async (req, res) => {
    try {
        const { stage } = req.body || {};
        const STAGE_TO_WORKFLOW = {
            sync:   'syncOnlyWorkflow',
            alerts: 'alertCheckOnlyWorkflow',
            full:   'dailyPipelineWorkflow',
        };
        const workflowName = STAGE_TO_WORKFLOW[stage];
        if (!workflowName) {
            return res.status(400).json({ error: `Unknown stage. Allowed: ${Object.keys(STAGE_TO_WORKFLOW).join(', ')}` });
        }
        let client;
        try {
            client = await getTemporalClient();
        } catch (e) {
            return res.status(503).json({ error: `Temporal unreachable: ${e.message}` });
        }
        const { taskQueue } = getTemporalConfig();
        const workflowId = `manual-${stage}-${req.companyId}-${Date.now()}`;
        const args = stage === 'full'
            ? [{ companyId: req.companyId, triggerType: 'manual' }]
            : [{ companyId: req.companyId }];
        const handle = await client.workflow.start(workflowName, {
            taskQueue,
            workflowId,
            args,
        });
        res.json({ success: true, stage, workflowId: handle.workflowId, runId: handle.firstExecutionRunId });
    } catch (err) {
        console.error('trigger-stage error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const cancelJob = async (req, res) => {
    // We can't actually SIGTERM a child process from a stateless HTTP handler
    // (the spawn lives in a different request's closure), so cancellation is
    // recorded as "marked failed" — the next health-poll will surface this and
    // any future Temporal redeploy reaps the actual process. This matches the
    // pattern we already use for stale jobs.
    try {
        const { rows } = await pool.query(
            `UPDATE ratings.ml_jobs_log
                SET status = 'FAILED',
                    completed_at = NOW(),
                    logs = COALESCE(logs,'') || E'\n[System] Cancelled by user.\n'
              WHERE id = $1 AND company_id = $2 AND status = 'RUNNING'
              RETURNING id`,
            [req.params.id, req.companyId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Job not running or not found' });
        res.json({ success: true, jobId: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ============================================================================
// MASTER CONFIG INTELLIGENCE
// ============================================================================



export const sendWeeklyDigest = async (req, res) => {
    try {
        const recipient = (req.body && req.body.to) || (req.authUser && req.authUser.email) || null;
        const dashboardBase = process.env.PUBLIC_DASHBOARD_URL || 'https://prestige-review.up.railway.app';

        // Top declining SKUs: compare last 7d avg rating vs prior 7d
        const { rows: decliners } = await pool.query(`
            WITH last_7 AS (
              SELECT web_pid, product_name, brand, platform,
                     AVG(rating)::numeric AS r, COUNT(*) AS n
                FROM ratings.reviews
               WHERE company_id = $1 AND is_competitor = false
                 AND review_date >= NOW() - INTERVAL '7 days'
                 AND rating IS NOT NULL
               GROUP BY 1,2,3,4 HAVING COUNT(*) >= 3
            ),
            prior_7 AS (
              SELECT web_pid, AVG(rating)::numeric AS r
                FROM ratings.reviews
               WHERE company_id = $1 AND is_competitor = false
                 AND review_date >= NOW() - INTERVAL '14 days' AND review_date < NOW() - INTERVAL '7 days'
                 AND rating IS NOT NULL
               GROUP BY 1
            )
            SELECT l.web_pid, l.product_name, l.brand, l.platform,
                   ROUND(p.r,2) AS prev_rating, ROUND(l.r,2) AS now_rating,
                   ROUND((p.r - l.r),2) AS delta, l.n AS recent_reviews
              FROM last_7 l JOIN prior_7 p ON p.web_pid = l.web_pid
             WHERE p.r - l.r >= 0.3
             ORDER BY (p.r - l.r) DESC LIMIT 5
        `, [req.companyId]);

        // Top improving SKUs
        const { rows: improvers } = await pool.query(`
            WITH last_7 AS (
              SELECT web_pid, product_name, brand, platform,
                     AVG(rating)::numeric AS r, COUNT(*) AS n
                FROM ratings.reviews
               WHERE company_id = $1 AND is_competitor = false
                 AND review_date >= NOW() - INTERVAL '7 days' AND rating IS NOT NULL
               GROUP BY 1,2,3,4 HAVING COUNT(*) >= 3
            ),
            prior_7 AS (
              SELECT web_pid, AVG(rating)::numeric AS r
                FROM ratings.reviews
               WHERE company_id = $1 AND is_competitor = false
                 AND review_date >= NOW() - INTERVAL '14 days' AND review_date < NOW() - INTERVAL '7 days'
                 AND rating IS NOT NULL
               GROUP BY 1
            )
            SELECT l.web_pid, l.product_name, l.brand, l.platform,
                   ROUND(p.r,2) AS prev_rating, ROUND(l.r,2) AS now_rating,
                   ROUND((l.r - p.r),2) AS delta, l.n AS recent_reviews
              FROM last_7 l JOIN prior_7 p ON p.web_pid = l.web_pid
             WHERE l.r - p.r >= 0.3
             ORDER BY (l.r - p.r) DESC LIMIT 5
        `, [req.companyId]);

        // Top issue categories by negative-review volume
        const { rows: hotIssues } = await pool.query(`
            SELECT COALESCE(specific_issue, sentiment_category, 'Unknown') AS issue,
                   COUNT(*) AS reviews,
                   ROUND(AVG(rating)::numeric, 2) AS avg_rating
              FROM ratings.reviews
             WHERE company_id = $1
               AND is_competitor = false
               AND review_date >= NOW() - INTERVAL '7 days'
               AND sentiment = 'Negative'
               AND (specific_issue IS NOT NULL OR sentiment_category IS NOT NULL)
             GROUP BY 1 ORDER BY reviews DESC LIMIT 5
        `, [req.companyId]);

        // Overall stats
        const { rows: overall } = await pool.query(`
            SELECT COUNT(*) AS reviews,
                   ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                   ROUND(100.0 * COUNT(*) FILTER (WHERE sentiment='Positive') / NULLIF(COUNT(*),0), 0) AS pct_positive
              FROM ratings.reviews
             WHERE company_id = $1 AND is_competitor = false
               AND review_date >= NOW() - INTERVAL '7 days'
        `, [req.companyId]);

        // Map the digest into the same event shape so we can reuse the MJML
        // renderer. The "rule" header is synthetic.
        const events = decliners.map((d, i) => ({
            web_pid: d.web_pid,
            product_name: d.product_name,
            platform: d.platform,
            previous_rating: Number(d.prev_rating),
            current_rating: Number(d.now_rating),
            delta: Number(d.delta),
            reason: 'drop_delta',
            specific_issue: hotIssues[i]?.issue,
            sample_negatives: [],
            rule_drop_delta: 0.3,
        }));

        const fakeRule = {
            name: 'Weekly Rating Pulse',
            scope_type: 'company',
            scope_value: 'all',
            drop_delta: 0.3,
            absolute_floor: null,
        };
        const html = events.length > 0
            ? await renderDigestHtml(fakeRule, events)
            : `<p style="font-family:Arial">No notable declines this week. Average rating: ${overall[0].avg_rating}★ across ${overall[0].reviews} reviews.</p>`;

        await sendAlertEmail({
            to: recipient ? [recipient] : [],
            subject: `[Ratings] Weekly pulse · ${overall[0].reviews} reviews · ${overall[0].pct_positive}% positive`,
            html,
            priority: 'normal',
            threadKey: `weekly-digest-${req.companyId}`,
        });

        res.json({
            success: true,
            sentTo: recipient || '(default recipients)',
            stats: {
                reviewsLast7d: parseInt(overall[0].reviews, 10),
                avgRating: Number(overall[0].avg_rating),
                pctPositive: parseInt(overall[0].pct_positive, 10),
            },
            decliners,
            improvers,
            hotIssues,
        });
    } catch (err) {
        console.error('weekly-digest error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Training-set size / readiness — admins watch this to know when fine-tuning is viable.

export const getTrainingSetStats = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE approved_rating IS NOT NULL) AS with_rating,
                COUNT(*) FILTER (WHERE approved_sentiment IS NOT NULL) AS with_sentiment,
                COUNT(*) FILTER (WHERE approved_category IS NOT NULL) AS with_category,
                MIN(captured_at) AS first_at,
                MAX(captured_at) AS last_at
              FROM ratings.ml_training_set
             WHERE company_id = $1`,
            [req.companyId]
        );
        const stats = rows[0];
        // Conventional fine-tune viability cutoff: 3000 labelled rows per task.
        const fineTuneViable = parseInt(stats.with_rating, 10) >= 3000;
        res.json({ ...stats, fineTuneViable, fineTuneThreshold: 3000 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Export training set as JSONL for fine-tuning offline. Admins can pull a
// snapshot whenever they want to run a fine-tune off-cluster.

export const exportTrainingSet = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT review_text, approved_rating, approved_sentiment,
                   approved_category, approved_subcategory,
                   user_rating, ml_confidence
              FROM ratings.ml_training_set
             WHERE company_id = $1
             ORDER BY captured_at DESC`,
            [req.companyId]
        );
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Content-Disposition', `attachment; filename="training-set-${Date.now()}.jsonl"`);
        for (const r of rows) {
            res.write(JSON.stringify({
                text: r.review_text,
                rating: r.approved_rating ? Number(r.approved_rating) : null,
                sentiment: r.approved_sentiment || null,
                category: r.approved_category || null,
                subcategory: r.approved_subcategory || null,
                user_rating: r.user_rating ? Number(r.user_rating) : null,
                ml_confidence: r.ml_confidence ? Number(r.ml_confidence) : null,
            }) + '\n');
        }
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};