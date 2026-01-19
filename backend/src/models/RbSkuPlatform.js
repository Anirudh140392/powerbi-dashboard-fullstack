import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbSkuPlatform = sequelize.define('rb_sku_platform', {
  brand_category: {
    type: DataTypes.STRING,
  },
  brand_category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brand_name: {
    type: DataTypes.STRING,
  },
  case_pack: {
    type: DataTypes.STRING,
  },
  cluster: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  comp_mapp: {
    type: DataTypes.INTEGER,
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  ean_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  emsl_flag: {
    type: DataTypes.STRING,
  },
  gram: {
    type: DataTypes.STRING,
  },
  group_id: {
    type: DataTypes.STRING,
  },
  is_competitor: {
    type: DataTypes.INTEGER,
  },
  item_code: {
    type: DataTypes.STRING,
  },
  modified_by: {
    type: DataTypes.STRING,
  },
  modified_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  msl: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  page_url: {
    type: DataTypes.STRING,
  },
  pantry_code: {
    type: DataTypes.STRING,
  },
  pf_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  platform_name: {
    type: DataTypes.STRING,
  },
  rb_code: {
    type: DataTypes.STRING,
  },
  rb_sku_platform_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  reseller_id: {
    type: DataTypes.INTEGER,
  },
  sku_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sku_name: {
    type: DataTypes.STRING,
  },
  sku_title: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sub_brand: {
    type: DataTypes.STRING,
  },
  sub_category: {
    type: DataTypes.STRING,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'rb_sku_platform',
  timestamps: false,
});

export default RbSkuPlatform;
