import { Sequelize, Op } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false
    }
);

// Define Model
const RbPdpOlap = sequelize.define('RbPdpOlap', {
    DATE: { type: Sequelize.DATE, primaryKey: true },
    Platform: { type: Sequelize.STRING, primaryKey: true },
    Brand: { type: Sequelize.STRING },
    Location: { type: Sequelize.STRING },
    Sales: { type: Sequelize.FLOAT }
}, {
    tableName: 'rb_pdp_olap',
    timestamps: false
});

async function verifyData() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        const filters = {
            Platform: 'Zepto',
            Brand: 'Aer',
            Location: 'Agra'
        };

        const start = dayjs('2025-12-01');
        const end = dayjs('2025-12-08');

        // Iterate through each day
        let current = start;
        while (current.isBefore(end) || current.isSame(end, 'day')) {
            const dayStart = current.startOf('day').toDate();
            const dayEnd = current.endOf('day').toDate();

            const whereClause = {
                DATE: { [Op.between]: [dayStart, dayEnd] },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), filters.Platform.toLowerCase()),
                Brand: { [Op.like]: `%${filters.Brand}%` },
                Location: sequelize.where(sequelize.fn('LOWER', sequelize.col('Location')), filters.Location.toLowerCase())
            };

            const result = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales']],
                where: whereClause,
                raw: true
            });

            const total = parseFloat(result?.total_sales || 0);
            console.log(`${current.format('YYYY-MM-DD')}: ₹${(total / 1000).toFixed(2)} K (Raw: ${total})`);

            current = current.add(1, 'day');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

verifyData();
