import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbKeyword = sequelize.define('rb_keyword', {
  brand_id: {
    type: DataTypes.INTEGER,
  },
  brand_name: {
    type: DataTypes.STRING,
  },
  created_by: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  keyword: {
    type: DataTypes.STRING,
  },
  keyword_category: {
    type: DataTypes.STRING,
  },
  keyword_type: {
    type: DataTypes.STRING,
  },
  kw_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  language: {
    type: DataTypes.STRING,
  },
  modified_by: {
    type: DataTypes.STRING,
  },
  modified_on: {
    type: DataTypes.DATE,
  },
  pf_id: {
    type: DataTypes.INTEGER,
  },
  status: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'rb_keyword',
  timestamps: false,
});

export default RbKeyword;
