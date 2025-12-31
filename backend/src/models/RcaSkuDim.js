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
    Category: {
        type: DataTypes.STRING,
        field: 'Category'
    },
    sku: {
        type: DataTypes.STRING,
    },
    comp_flag: {
        type: DataTypes.TINYINT,
    },
    status: {
        type: DataTypes.BIGINT,
    },
    // Add other columns if known, but these are the essentials for the dropdowns
}, {
    tableName: 'rca_sku_dim',
    timestamps: false,
});

export default RcaSkuDim;
