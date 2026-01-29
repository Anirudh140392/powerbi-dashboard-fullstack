import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbBlinkitSalesData = sequelize.define('tb_blinkit_sales_data', {
  category: {
    type: DataTypes.STRING,
  },
  city_id: {
    type: DataTypes.STRING,
  },
  city_name: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  DATE: {
    type: DataTypes.STRING,
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
  item_id: {
    type: DataTypes.STRING,
  },
  item_name: {
    type: DataTypes.STRING,
  },
  location_update: {
    type: DataTypes.STRING,
  },
  manufacturer_id: {
    type: DataTypes.STRING,
  },
  manufacturer_name: {
    type: DataTypes.STRING,
  },
  mrp: {
    type: DataTypes.DECIMAL,
  },
  qty_sold: {
    type: DataTypes.STRING,
  },
  STATUS: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_blinkit_sales_data',
  timestamps: false,
});

export default TbBlinkitSalesData;
