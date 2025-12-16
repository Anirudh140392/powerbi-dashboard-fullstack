import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RcaSkuDim = sequelize.define('rca_sku_dim', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    platform: {
        type: DataTypes.STRING,
    },
    brand_name: {
        type: DataTypes.STRING,
    },
    location: {
        type: DataTypes.STRING,
    },
    brand_category: {
        type: DataTypes.STRING,
    },
    // Add other columns if known, but these are the essentials for the dropdowns
}, {
    tableName: 'rca_sku_dim',
    timestamps: false,
});

export default RcaSkuDim;
