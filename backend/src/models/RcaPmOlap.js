import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

/**
 * RcaPmOlap Model
 * Maps to the mars.rca_pm_olap table for Performance Marketing metrics.
 * Primary source for Conversion, ROAS, Spend, and Ad Sales.
 */
const RcaPmOlap = sequelize.define('rca_pm_olap', {
    DATE: {
        type: DataTypes.DATE,
        allowNull: false
    },
    Platform: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ad_spend: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    ad_sales: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    ad_click: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    impressions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    ad_quantity_sold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'rca_pm_olap',
    schema: 'mars',
    timestamps: false,
    indexes: [
        {
            fields: ['DATE']
        },
        {
            fields: ['Platform']
        },
        {
            fields: ['category']
        }
    ]
});

/**
 * Conversion Formula: (ad_quantity_sold / ad_click) * 100
 * Note: Calculated at the query level in services for aggregation efficiency.
 */
export const calculateConversion = (orders, clicks) => {
    if (!clicks || clicks === 0) return 0;
    return (orders / clicks) * 100;
};

export default RcaPmOlap;
