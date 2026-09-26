import pool from '../../config/db.js';

import spawnJobModule from '../../automation/spawnJob.cjs';
const { spawnJob, KNOWN_JOBS } = spawnJobModule;
export const spawnMlJob = async (req, res) => {
    try {
        const { jobName, ids } = req.body;
        if (!KNOWN_JOBS.includes(jobName)) {
            return res.status(400).json({ error: 'Unknown jobName' });
        }
        // Fire-and-forget: spawnJob inserts the RUNNING row and detaches the
        // child from the request lifecycle. `done` is intentionally not awaited.
        const { jobId } = await spawnJob({ pool, companyId: req.companyId, jobName, ids });
        res.json({ success: true, message: `Job ${jobName} spawned.`, jobId });
    } catch (err) {
        console.error('Job Spawn Error:', err);
        res.status(500).json({ error: err.message });
    }
};

export const getMlJobs = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, job_name, status, logs, started_at, completed_at
            FROM ratings.ml_jobs_log
            WHERE company_id = $1
            ORDER BY started_at DESC LIMIT 50
        `, [req.companyId]);
        res.json({ jobs: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const masterEnrich = async (req, res) => {
    try {
        const { product_description, product_name } = req.body;
        if (!product_description && !product_name) {
            return res.json({ error: 'not enough data to detect' });
        }
        
        const combined = `${product_name || ''} ${product_description || ''}`;
        
        // Dynamically source the Material domain from the authoritative ML Config dictionary
        const matRes = await pool.query(`SELECT dict_value as material FROM ratings.ml_dictionary WHERE dict_type = 'material'`);
        const MATERIALS = matRes.rows.map(r => r.material).filter(m => m.trim().length > 0);
        
        let ml_material = null;
        if (MATERIALS.length > 0) {
            // Sort by length descending to match larger phrases first ('Stainless Steel' before 'Steel')
            const sortedMaterials = MATERIALS.sort((a,b) => b.length - a.length);
            const matMatch = combined.match(new RegExp(`\\b(${sortedMaterials.join('|')})\\b`, 'i'));
            if (matMatch) {
                ml_material = matMatch[1].replace(/\w\S*/g, w => (w.replace(/^\w/, c => c.toUpperCase())));
            }
        }
        
        const watMatch = combined.match(/\b(\d+(?:[.,]\d+)?\s*(?:W|Watts|kw|kilowatt))\b/i);
        const ml_wattage = watMatch ? watMatch[1].toUpperCase() : null;

        // If either is completely missing, explicitly fail safely rather than hallucinating
        if (!ml_material || !ml_wattage) {
            return res.json({ 
                success: false, 
                error: 'not enough data to detect',
                details: { found_material: ml_material, found_wattage: ml_wattage }
            });
        }

        res.json({
            success: true,
            material: ml_material,
            wattage: ml_wattage
        });

    } catch (err) {
        console.error('Master Enrich Error:', err);
        res.status(500).json({ error: err.message });
    }
};

