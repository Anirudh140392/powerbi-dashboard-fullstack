import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoPmKeywordRca = sequelize.define('tb_zepto_pm_keyword_rca', {
    keyword_name: {
        type: DataTypes.STRING
    },
    keyword_match_type: {
        type: DataTypes.STRING
    },
    brand_id: {
        type: DataTypes.INTEGER
    },
    brand_name: {
        type: DataTypes.STRING
    },
    campaign_id: {
        type: DataTypes.STRING
    },
    campaign_name: {
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
    revenue: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    date: {
        type: DataTypes.DATEONLY
    },
    zone: {
        type: DataTypes.STRING
    },
    Platform: {
        type: DataTypes.STRING
    },
    keyword_category: {
        type: DataTypes.STRING
    },
    roas: {
        type: DataTypes.DECIMAL(10, 4)
    },
    acos: {
        type: DataTypes.DECIMAL(10, 4)
    }
}, {
    tableName: 'tb_zepto_pm_keyword_rca',
    timestamps: false
});

export default TbZeptoPmKeywordRca;
