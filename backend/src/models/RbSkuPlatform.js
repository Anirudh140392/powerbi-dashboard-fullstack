import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbSkuPlatform = sequelize.define('rb_sku_platform', {
  rb_sku_platform_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  pf_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  reseller_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sku_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  web_pid: {
    type: DataTypes.STRING(255),
  },
  group_id: {
    type: DataTypes.STRING(255),
  },
  brand_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  brand_category_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  msl: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  cluster: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  ean_code: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  rb_code: {
    type: DataTypes.STRING(255),
  },
  pantry_code: {
    type: DataTypes.STRING(255),
  },
  created_by: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  modified_by: {
    type: DataTypes.STRING(21),
  },
  modified_on: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  page_url: {
    type: DataTypes.STRING(500),
  },
  sku_name: {
    type: DataTypes.STRING(500),
  },
  is_competitor: {
    type: DataTypes.INTEGER,
  },
  sku_title: {
    type: DataTypes.STRING(255),
  },
  comp_mapp: {
    type: DataTypes.INTEGER,
  },
  brand_name: {
    type: DataTypes.STRING(255),
  },
  brand_category: {
    type: DataTypes.STRING(30),
  },
  sub_brand: {
    type: DataTypes.STRING(30),
  },
  emsl_flag: {
    type: DataTypes.STRING(30),
  },
  quantity: {
    type: DataTypes.STRING(255),
  },
  Unit: {
    type: DataTypes.STRING(255),
    field: 'Unit', // Preserve exact column name case
  },
  case_pack: {
    type: DataTypes.STRING(255),
  },
  item_code: {
    type: DataTypes.STRING(255),
  },
  sub_category: {
    type: DataTypes.STRING(255),
  },
  platform_name: {
    type: DataTypes.STRING(255),
  },
}, {
  tableName: 'rb_sku_platform',
  timestamps: false,
});

export default RbSkuPlatform;
