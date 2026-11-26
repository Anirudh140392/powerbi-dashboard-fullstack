import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoBrandCrawl = sequelize.define('tb_zepto_brand_crawl', {
  brand: {
    type: DataTypes.STRING,
  },
  campaign_id: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  discount_amount: {
    type: DataTypes.DECIMAL,
  },
  discount_price: {
    type: DataTypes.DECIMAL,
  },
  grammage: {
    type: DataTypes.STRING,
  },
  id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  image_urls: {
    type: DataTypes.TEXT,
  },
  latitude: {
    type: DataTypes.DECIMAL,
  },
  location_id: {
    type: DataTypes.STRING,
  },
  location_name: {
    type: DataTypes.STRING,
  },
  location_sales: {
    type: DataTypes.STRING,
  },
  longitude: {
    type: DataTypes.DECIMAL,
  },
  Merchant_Name: {
    type: DataTypes.STRING,
  },
  name: {
    type: DataTypes.TEXT,
  },
  osa: {
    type: DataTypes.INTEGER,
  },
  osa_remark: {
    type: DataTypes.TEXT,
  },
  pdp_discount_value: {
    type: DataTypes.STRING,
  },
  pincode: {
    type: DataTypes.STRING,
  },
  price_rp: {
    type: DataTypes.DECIMAL,
  },
  price_sp: {
    type: DataTypes.DECIMAL,
  },
  primary_category: {
    type: DataTypes.STRING,
  },
  rating: {
    type: DataTypes.DECIMAL,
  },
  region: {
    type: DataTypes.STRING,
  },
  reviews: {
    type: DataTypes.INTEGER,
  },
  store_id: {
    type: DataTypes.STRING,
  },
  super_saver_price: {
    type: DataTypes.DECIMAL,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_zepto_brand_crawl',
  timestamps: false,
});

export default TbZeptoBrandCrawl;
