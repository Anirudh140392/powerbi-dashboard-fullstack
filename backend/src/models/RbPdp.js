import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbPdp = sequelize.define('rb_pdp', {
  brand_category_id: {
    type: DataTypes.INTEGER,
  },
  brand_category_name: {
    type: DataTypes.STRING,
  },
  brand_id: {
    type: DataTypes.INTEGER,
  },
  brand_name: {
    type: DataTypes.STRING,
  },
  cluster: {
    type: DataTypes.INTEGER,
  },
  compliance_avg_score: {
    type: DataTypes.INTEGER,
  },
  compliance_bullets_perc: {
    type: DataTypes.INTEGER,
  },
  compliance_bullets_score: {
    type: DataTypes.INTEGER,
  },
  compliance_description_perc: {
    type: DataTypes.INTEGER,
  },
  compliance_description_score: {
    type: DataTypes.INTEGER,
  },
  compliance_image_description_perc: {
    type: DataTypes.INTEGER,
  },
  compliance_image_description_score: {
    type: DataTypes.INTEGER,
  },
  compliance_image_score: {
    type: DataTypes.INTEGER,
  },
  compliance_title_perc: {
    type: DataTypes.INTEGER,
  },
  compliance_title_score: {
    type: DataTypes.INTEGER,
  },
  crawl_id: {
    type: DataTypes.INTEGER,
  },
  created_by: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  ean_code: {
    type: DataTypes.STRING,
  },
  gram: {
    type: DataTypes.STRING,
  },
  group_id: {
    type: DataTypes.STRING,
  },
  inventory: {
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
    type: DataTypes.DATE,
  },
  month: {
    type: DataTypes.INTEGER,
  },
  msl: {
    type: DataTypes.INTEGER,
  },
  osa: {
    type: DataTypes.INTEGER,
  },
  osa_last_available_date: {
    type: DataTypes.DATE,
  },
  osa_remark: {
    type: DataTypes.STRING,
  },
  pantry_code: {
    type: DataTypes.STRING,
  },
  pdp_bulletin_count: {
    type: DataTypes.INTEGER,
  },
  pdp_bulletin_score: {
    type: DataTypes.INTEGER,
  },
  pdp_crawl_date: {
    type: DataTypes.DATE,
  },
  pdp_data_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  pdp_desc_char_count: {
    type: DataTypes.INTEGER,
  },
  pdp_desc_score: {
    type: DataTypes.INTEGER,
  },
  pdp_desc_value: {
    type: DataTypes.STRING,
  },
  pdp_ec_image_count: {
    type: DataTypes.INTEGER,
  },
  pdp_ec_image_score: {
    type: DataTypes.INTEGER,
  },
  pdp_ec_video_count: {
    type: DataTypes.INTEGER,
  },
  pdp_ec_video_score: {
    type: DataTypes.INTEGER,
  },
  pdp_grade: {
    type: DataTypes.STRING,
  },
  pdp_image_count: {
    type: DataTypes.INTEGER,
  },
  pdp_image_score: {
    type: DataTypes.INTEGER,
  },
  pdp_image_url: {
    type: DataTypes.STRING,
  },
  pdp_page_url: {
    type: DataTypes.STRING,
  },
  pdp_qa_count: {
    type: DataTypes.INTEGER,
  },
  pdp_rating_count: {
    type: DataTypes.INTEGER,
  },
  pdp_rating_score: {
    type: DataTypes.INTEGER,
  },
  pdp_rating_value: {
    type: DataTypes.DECIMAL,
  },
  pdp_review_count: {
    type: DataTypes.INTEGER,
  },
  pdp_review_score: {
    type: DataTypes.INTEGER,
  },
  pdp_title_char_count: {
    type: DataTypes.INTEGER,
  },
  pdp_title_score: {
    type: DataTypes.INTEGER,
  },
  pdp_title_value: {
    type: DataTypes.STRING,
  },
  pdp_total_score: {
    type: DataTypes.INTEGER,
  },
  pf_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  price_remark: {
    type: DataTypes.STRING,
  },
  price_rp: {
    type: DataTypes.DECIMAL,
  },
  price_sp: {
    type: DataTypes.DECIMAL,
  },
  price_variation: {
    type: DataTypes.DECIMAL,
  },
  products_count_by_group: {
    type: DataTypes.INTEGER,
  },
  quarter: {
    type: DataTypes.INTEGER,
  },
  rank_seller: {
    type: DataTypes.STRING,
  },
  rb_code: {
    type: DataTypes.STRING,
  },
  reseller_id: {
    type: DataTypes.INTEGER,
  },
  reseller_name: {
    type: DataTypes.STRING,
  },
  reseller_name_crawl: {
    type: DataTypes.STRING,
  },
  reseller_type: {
    type: DataTypes.INTEGER,
  },
  sales: {
    type: DataTypes.DECIMAL,
  },
  seller_category: {
    type: DataTypes.STRING,
  },
  seller_rank: {
    type: DataTypes.STRING,
  },
  sku_id: {
    type: DataTypes.INTEGER,
  },
  sku_name: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.INTEGER,
  },
  sub_brand: {
    type: DataTypes.STRING,
  },
  url_code: {
    type: DataTypes.STRING,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
  week: {
    type: DataTypes.INTEGER,
  },
  year: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'rb_pdp',
  timestamps: false,
});

export default RbPdp;
