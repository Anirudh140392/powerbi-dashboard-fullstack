/* eslint-disable */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const DEFAULT_COMPANY_ID = 'e9b28a2b-3c4d-4e5f-b6a7-8c9d0e1f2a3b';

const rules = [
    { category: 'Gas Stove', include: ['gas stove', 'gas table', 'gas hob', 'burner gas', 'gtsd', 'manual gas', 'hobtop', 'hob cooktop', 'cooktop'], exclude: ['induction'], priority: 1 },
    { category: 'Induction Cooktop', include: ['induction cooktop', 'induction cook top', 'induction stove', 'induction plate'], exclude: ['induction bottom', 'induction base', 'induction compatible', 'pressure cooker', 'tawa', 'kadai', 'kadhai', 'fry pan', 'frying pan'], priority: 2 },
    { category: 'Dosa Tawa', include: ['dosa tawa', 'dosa maker', 'dosa pan'], exclude: [], priority: 3 },
    { category: 'Cookware Set', include: ['cookware set', 'cookware combo', 'kitchen set', 'non-stick set', 'nonstick set', 'pc set', 'pc cookware'], exclude: [], priority: 4 },
    { category: 'Tawa', include: ['tawa', 'roti tawa', 'concave tawa', 'flat tawa', 'pathiri tawa', 'chapati tawa'], exclude: ['cookware set', 'cookware combo', 'pc set'], priority: 5 },
    { category: 'Fry Pan', include: ['fry pan', 'frying pan', 'frypan'], exclude: ['cookware set', 'cookware combo', 'pc set'], priority: 6 },
    { category: 'Kadai', include: ['kadai', 'kadhai', 'karahi'], exclude: ['cookware set', 'cookware combo', 'pc set'], priority: 7 },
    { category: 'Mixer Grinder', include: ['mixer grinder', 'mixer-grinder'], exclude: [], priority: 8 },
    { category: 'Pressure Cooker', include: ['pressure cooker', 'pressure pan', 'prestige popular', 'prestige deluxe', 'prestige nakshatra', 'prestige svachh'], exclude: ['induction cooktop', 'tawa', 'gas stove', 'fry pan', 'kadai', 'mixer grinder', 'kettle', 'toaster', 'otg', 'iron box', 'cookware set', 'rice cooker'], priority: 9 },
    { category: 'Air Fryer', include: ['air fryer', 'airfryer'], exclude: [], priority: 10 },
    { category: 'Rice Cooker', include: ['rice cooker', 'electric rice'], exclude: [], priority: 11 },
    { category: 'Kettle', include: ['kettle', 'electric kettle', 'multi cooker kettle'], exclude: [], priority: 12 },
    { category: 'Wet Grinder', include: ['wet grinder', 'table top grinder'], exclude: [], priority: 13 },
    { category: 'Toaster & OTG', include: ['toaster', 'otg', 'oven toaster', 'sandwich maker'], exclude: [], priority: 14 },
    { category: 'Iron', include: ['iron', 'steam iron', 'dry iron'], exclude: ['cast iron'], priority: 15 },
    { category: 'Other Cookware', include: ['pan', 'pot', 'saucepan', 'handi', 'casserole', 'appachetty', 'steamer', 'non-stick cookware', 'stainless steel cookware', 'cookware'], exclude: ['pressure cooker', 'pressure pan', 'cookware set', 'cookware combo'], priority: 16 }
];

async function seed() {
    try {
        await pool.query('BEGIN');
        await pool.query('DELETE FROM ratings.category_rules WHERE company_id = $1', [DEFAULT_COMPANY_ID]);
        
        for (const rule of rules) {
            await pool.query(
                `INSERT INTO ratings.category_rules (company_id, category, include_keywords, exclude_keywords, priority)
                 VALUES ($1, $2, $3, $4, $5)`,
                [DEFAULT_COMPANY_ID, rule.category, rule.include, rule.exclude, rule.priority]
            );
        }
        await pool.query('COMMIT');
        console.log('Seeded successfully.');
    } catch(err) {
        await pool.query('ROLLBACK');
        console.error(err);
    } finally {
        await pool.end();
    }
}
seed();
