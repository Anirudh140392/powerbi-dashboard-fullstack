import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoAdsKeywordData = sequelize.define('tb_zepto_ads_keyword_data', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    date: {
        type: DataTypes.DATEONLY, // Assuming date is stored, or 'created_on'
        field: 'date' // Map if column name differs
    },
    keyword: {
        type: DataTypes.STRING
    },
    campaign_name: {
        type: DataTypes.STRING
    },
    ad_group: {
        type: DataTypes.STRING
    },
    impressions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    spend: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    revenue: { // Ad Sales
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        field: 'revenue' // Verify if column is named 'sales', 'ad_sales' or 'revenue'
    },
    orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    platform: {
        type: DataTypes.STRING
    },
    brand: {
        type: DataTypes.STRING
    },
    location: {
        type: DataTypes.STRING
    },
    zone: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'tb_zepto_ads_keyword_data',
    timestamps: false
});

export default TbZeptoAdsKeywordData;
