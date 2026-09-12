/**
 * Export a class-balanced GOLD dataset for the in-house rating model.
 *
 * Label = the reviewer's own 1-5 star (real ground truth, ~2.98M available).
 * We balance by sampling up to N_PER_CLASS per star so the model isn't biased
 * toward 5-star (which is 57% of the corpus). Random, reproducible-ish via
 * ORDER BY md5(id::text). Writes JSONL: {text, label} with label 0..4 (star-1).
 *
 * Read-only. Output: scripts/ml_train/data/{train,eval}.jsonl
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const COMPANY = '297e37ea-a5ac-47df-bebd-ac44e52b7979';
const N_PER_CLASS = parseInt(process.env.N_PER_CLASS || '5000', 10); // total train ~25k
const EVAL_PER_CLASS = parseInt(process.env.EVAL_PER_CLASS || '800', 10);
const OUT = path.join(__dirname, 'data');

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST, database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: { rejectUnauthorized: false },
  });
  fs.mkdirSync(OUT, { recursive: true });
  const trainW = fs.createWriteStream(path.join(OUT, 'train.jsonl'));
  const evalW = fs.createWriteStream(path.join(OUT, 'eval.jsonl'));
  const counts = { train: [0, 0, 0, 0, 0], eval: [0, 0, 0, 0, 0] };

  for (let star = 1; star <= 5; star++) {
    const { rows } = await pool.query(`
      SELECT regexp_replace(review_text, '\\s+', ' ', 'g') AS text
      FROM ratings.reviews
      WHERE company_id = $1 AND rating = $2
        AND review_text IS NOT NULL AND length(review_text) BETWEEN 15 AND 1200
      ORDER BY md5(id::text)
      LIMIT $3
    `, [COMPANY, star, N_PER_CLASS + EVAL_PER_CLASS]);
    rows.forEach((r, i) => {
      const rec = JSON.stringify({ text: r.text.trim(), label: star - 1 }) + '\n';
      if (i < EVAL_PER_CLASS) { evalW.write(rec); counts.eval[star - 1]++; }
      else { trainW.write(rec); counts.train[star - 1]++; }
    });
    process.stdout.write(`  star ${star}: ${rows.length} rows\n`);
  }
  trainW.end(); evalW.end();
  await new Promise(r => trainW.on('finish', r));
  await new Promise(r => evalW.on('finish', r));
  console.log('train per class:', counts.train, '=', counts.train.reduce((a, b) => a + b, 0));
  console.log('eval  per class:', counts.eval, '=', counts.eval.reduce((a, b) => a + b, 0));
  console.log('written to', OUT);
  await pool.end();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
