
const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false,
    }
);

// Define Model
const TbZeptoAdsKeywordData = sequelize.define('tb_zepto_ads_keyword_data', {
    date: { type: DataTypes.DATEONLY },
    keyword: { type: DataTypes.STRING },
    campaign_name: { type: DataTypes.STRING },
    ad_group: { type: DataTypes.STRING },
    impressions: { type: DataTypes.INTEGER },
    spend: { type: DataTypes.FLOAT },
    revenue: { type: DataTypes.FLOAT },
    clicks: { type: DataTypes.INTEGER },
    platform: { type: DataTypes.STRING },
    brand: { type: DataTypes.STRING },
    location: { type: DataTypes.STRING }, // location column
    zone: { type: DataTypes.STRING } // zone column
}, {
    tableName: 'tb_zepto_ads_keyword_data',
    timestamps: false,
});

async function checkZones() {
    try {
        const zones = await TbZeptoAdsKeywordData.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('zone')), 'zone']],
            where: {
                zone: { [Op.ne]: null }
            },
            raw: true
        });
        console.log("Distinct Zones in DB:", zones.map(z => z.zone));
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
}

checkZones();
