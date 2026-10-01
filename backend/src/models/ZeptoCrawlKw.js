import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const ZeptoCrawlKw = sequelize.define('zepto_crawl_kw', {
  brand_crawl: {
    type: DataTypes.STRING,
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brand_name: {
    type: DataTypes.STRING,
  },
  crawl_id: {
    type: DataTypes.BIGINT,
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  grammage: {
    type: DataTypes.STRING,
  },
  keyword: {
    type: DataTypes.STRING,
  },
  keyword_id: {
    type: DataTypes.INTEGER,
  },
  kw_crawl_data_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  location_id: {
    type: DataTypes.INTEGER,
  },
  location_name: {
    type: DataTypes.STRING,
  },
  modified_by: {
    type: DataTypes.STRING,
  },
  modified_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  page: {
    type: DataTypes.INTEGER,
  },
  pdp_discount_value: {
    type: DataTypes.STRING,
  },
  pdp_image_url: {
    type: DataTypes.STRING,
  },
  pdp_page_url: {
    type: DataTypes.STRING,
  },
  pdp_rating_count: {
    type: DataTypes.STRING,
  },
  pdp_rating_value: {
    type: DataTypes.STRING,
  },
  pdp_sponsored: {
    type: DataTypes.STRING,
  },
  pdp_title_value: {
    type: DataTypes.STRING,
  },
  pf_id: {
    type: DataTypes.INTEGER,
  },
  pincode: {
    type: DataTypes.STRING,
  },
  position: {
    type: DataTypes.INTEGER,
  },
  price_rp: {
    type: DataTypes.INTEGER,
  },
  price_sp: {
    type: DataTypes.STRING,
  },
  sponsored_brand: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'zepto_crawl_kw',
  timestamps: false,
});

export default ZeptoCrawlKw;
