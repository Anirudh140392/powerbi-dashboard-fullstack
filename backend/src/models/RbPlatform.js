import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbPlatform = sequelize.define('rb_platform', {
  created_by: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  kw_crawl_data_date: {
    type: DataTypes.DATE,
  },
  kw_crawl_data_id: {
    type: DataTypes.INTEGER,
  },
  kw_table_name: {
    type: DataTypes.STRING,
  },
  location_id: {
    type: DataTypes.INTEGER,
  },
  pdp_crawl_data_date: {
    type: DataTypes.DATE,
  },
  pdp_crawl_data_id: {
    type: DataTypes.INTEGER,
  },
  pdp_table_name: {
    type: DataTypes.STRING,
  },
  pf_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  pf_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  platform_alias: {
    type: DataTypes.STRING,
  },
  platform_description: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'rb_platform',
  timestamps: false,
});

export default RbPlatform;
