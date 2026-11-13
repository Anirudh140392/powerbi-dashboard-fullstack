import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoGcplSkuBreakdown = sequelize.define('tb_zepto_gcpl_sku_breakdown', {
  brand: {
    type: DataTypes.STRING,
  },
  category: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  ingested_on: {
    type: DataTypes.DATE,
  },
  item_name: {
    type: DataTypes.STRING,
  },
  Location: {
    type: DataTypes.STRING,
  },
  market_share: {
    type: DataTypes.DECIMAL,
  },
  mrp: {
    type: DataTypes.DECIMAL,
  },
  quantity_sold: {
    type: DataTypes.INTEGER,
  },
  sales: {
    type: DataTypes.DECIMAL,
  },
  Status: {
    type: DataTypes.STRING,
  },
  sub_category: {
    type: DataTypes.STRING,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_zepto_gcpl_sku_breakdown',
  timestamps: false,
});

export default TbZeptoGcplSkuBreakdown;
