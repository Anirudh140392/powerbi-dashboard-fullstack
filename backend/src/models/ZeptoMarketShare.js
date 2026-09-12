import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const ZeptoMarketShare = sequelize.define('zepto_market_share', {
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
  sub_category_brand_market_share: {
    type: DataTypes.DECIMAL,
  },
  sub_category_market_share: {
    type: DataTypes.DECIMAL,
  },
  sub_category_quantity: {
    type: DataTypes.DECIMAL,
  },
  sub_category_sales: {
    type: DataTypes.DECIMAL,
  },
  sub_category_volume_sold: {
    type: DataTypes.DECIMAL,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
  WEEK: {
    type: DataTypes.BIGINT,
  },
}, {
  tableName: 'zepto_market_share',
  timestamps: false,
});

export default ZeptoMarketShare;
