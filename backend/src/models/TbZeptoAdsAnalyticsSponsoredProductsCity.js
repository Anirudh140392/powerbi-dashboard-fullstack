import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbZeptoAdsAnalyticsSponsoredProductsCity = sequelize.define('tb_zepto_ads_analytics_sponsored_products_city', {
  Atc: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  BrandID: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  BrandName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  CityName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Clicks: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  Cpc: {
    type: DataTypes.DECIMAL,
    allowNull: false,
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
  Impressions: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ingested_date: {
    type: DataTypes.DATE,
  },
  location_update: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Orders: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  Other_skus: {
    type: DataTypes.STRING,
  },
  Revenue: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  Roas: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  Same_skus: {
    type: DataTypes.STRING,
  },
  Spend: {
    type: DataTypes.DECIMAL,
    allowNull: false,
  },
  STATUS: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_zepto_ads_analytics_sponsored_products_city',
  timestamps: false,
});

export default TbZeptoAdsAnalyticsSponsoredProductsCity;
