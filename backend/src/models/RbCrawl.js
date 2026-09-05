import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbCrawl = sequelize.define('rb_crawl', {
  crawl_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  crawl_type: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  end_time: {
    type: DataTypes.DATE,
  },
  is_processed: {
    type: DataTypes.INTEGER,
  },
  no_of_sku_parsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  pf_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  start_time: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'rb_crawl',
  timestamps: false,
});

export default RbCrawl;
