import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoGcplSkuBreakdownWeek = sequelize.define('tb_zepto_gcpl_sku_breakdown_week', {
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
  WEEK: {
    type: DataTypes.BIGINT,
  },
}, {
  tableName: 'tb_zepto_gcpl_sku_breakdown_week',
  timestamps: false,
});

export default TbZeptoGcplSkuBreakdownWeek;
