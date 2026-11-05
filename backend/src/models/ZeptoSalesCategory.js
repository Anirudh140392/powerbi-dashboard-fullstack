import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const ZeptoSalesCategory = sequelize.define('zepto_sales_category', {
  brand: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  gmv: {
    type: DataTypes.DECIMAL,
  },
  ingested_date: {
    type: DataTypes.DATE,
  },
  location_update: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL,
  },
  sales_date: {
    type: DataTypes.DATE,
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
  WEEK: {
    type: DataTypes.BIGINT,
  },
}, {
  tableName: 'zepto_sales_category',
  timestamps: false,
});

export default ZeptoSalesCategory;
