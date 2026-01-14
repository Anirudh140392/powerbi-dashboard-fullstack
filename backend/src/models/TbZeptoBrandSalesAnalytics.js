import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoBrandSalesAnalytics = sequelize.define('tb_zepto_brand_sales_analytics', {
  brand_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  gmv: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  ingested_date: {
    type: DataTypes.DATE,
  },
  location_update: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  manufacturer_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  manufacturer_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sales_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  sku_category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sku_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sku_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  STATUS: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_zepto_brand_sales_analytics',
  timestamps: false,
});

export default TbZeptoBrandSalesAnalytics;
