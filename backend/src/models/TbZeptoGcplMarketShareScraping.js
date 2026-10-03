import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoGcplMarketShareScraping = sequelize.define('tb_zepto_gcpl_market_share_scraping', {
  brand: {
    type: DataTypes.STRING,
  },
  category: {
    type: DataTypes.STRING,
  },
  city: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  mrp: {
    type: DataTypes.DECIMAL,
  },
  product_id: {
    type: DataTypes.STRING,
  },
  product_name: {
    type: DataTypes.STRING,
  },
  quantity: {
    type: DataTypes.INTEGER,
  },
  store_id: {
    type: DataTypes.STRING,
  },
  unit: {
    type: DataTypes.STRING,
  },
  uom: {
    type: DataTypes.STRING,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_zepto_gcpl_market_share_scraping',
  timestamps: false,
});

export default TbZeptoGcplMarketShareScraping;
