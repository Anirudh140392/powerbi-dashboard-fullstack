import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbKw = sequelize.define('rb_kw', {
  brand_crawl: {
    type: DataTypes.STRING,
  },
  brand_id: {
    type: DataTypes.INTEGER,
  },
  brand_name: {
    type: DataTypes.STRING,
  },
  brand_name_th: {
    type: DataTypes.STRING,
  },
  content_score: {
    type: DataTypes.INTEGER,
  },
  crawl_id: {
    type: DataTypes.BIGINT,
  },
  created_by: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  grammage: {
    type: DataTypes.STRING,
  },
  is_competitor_product: {
    type: DataTypes.INTEGER,
  },
  keyword: {
    type: DataTypes.STRING,
  },
  keyword_category: {
    type: DataTypes.STRING,
  },
  keyword_id: {
    type: DataTypes.INTEGER,
  },
  keyword_is_rb_product: {
    type: DataTypes.INTEGER,
  },
  keyword_is_rb_product_all: {
    type: DataTypes.INTEGER,
  },
  keyword_page_url: {
    type: DataTypes.STRING,
  },
  keyword_search_product: {
    type: DataTypes.STRING,
  },
  keyword_search_product_id: {
    type: DataTypes.STRING,
  },
  keyword_search_rank: {
    type: DataTypes.INTEGER,
  },
  keyword_type: {
    type: DataTypes.STRING,
  },
  kw_crawl_date: {
    type: DataTypes.DATE,
  },
  kw_data_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  LANGUAGE: {
    type: DataTypes.STRING,
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
    type: DataTypes.STRING,
    allowNull: false,
  },
  MONTH: {
    type: DataTypes.INTEGER,
  },
  osa_remark: {
    type: DataTypes.STRING,
  },
  page: {
    type: DataTypes.INTEGER,
  },
  pdp_discount_value: {
    type: DataTypes.DECIMAL,
  },
  pdp_rating_value: {
    type: DataTypes.DECIMAL,
  },
  pf_id: {
    type: DataTypes.INTEGER,
  },
  pincode: {
    type: DataTypes.INTEGER,
  },
  pincode_area: {
    type: DataTypes.STRING,
  },
  platform_name: {
    type: DataTypes.STRING,
  },
  price_sp: {
    type: DataTypes.DECIMAL,
  },
  QUARTER: {
    type: DataTypes.INTEGER,
  },
  spons_flag: {
    type: DataTypes.INTEGER,
  },
  status: {
    type: DataTypes.INTEGER,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
  WEEK: {
    type: DataTypes.INTEGER,
  },
  weightage: {
    type: DataTypes.INTEGER,
  },
  YEAR: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'rb_kw',
  timestamps: false,
});

export default RbKw;
