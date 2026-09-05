import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoAdsAnalyticsSponsoredProducts = sequelize.define('tb_zepto_ads_analytics_sponsored_products', {
  atc: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brand_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  brand_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  campaign_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  campaign_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  clicks: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  cpc: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  ctr: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  impressions: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ingested_date: {
    type: DataTypes.DATE,
  },
  orders: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  other_skus: {
    type: DataTypes.STRING,
  },
  product_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  revenue: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  roas: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  same_skus: {
    type: DataTypes.STRING,
  },
  spend: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  STATUS: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_zepto_ads_analytics_sponsored_products',
  timestamps: false,
});

export default TbZeptoAdsAnalyticsSponsoredProducts;
