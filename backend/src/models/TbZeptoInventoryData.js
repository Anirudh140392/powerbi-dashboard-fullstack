import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoInventoryData = sequelize.define('tb_zepto_inventory_data', {
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
  ean_code: {
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
  sku_sub_category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  STATUS: {
    type: DataTypes.STRING,
  },
  unit: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'tb_zepto_inventory_data',
  timestamps: false,
});

export default TbZeptoInventoryData;
