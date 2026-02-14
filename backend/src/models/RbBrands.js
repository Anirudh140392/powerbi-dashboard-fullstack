import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbBrands = sequelize.define('rb_brands', {
  brand_category_id: {
    type: DataTypes.INTEGER,
  },
  brand_description: {
    type: DataTypes.STRING,
  },
  brand_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brand_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  brand_short_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_by: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  display_order: {
    type: DataTypes.INTEGER,
  },
  modified_by: {
    type: DataTypes.STRING,
  },
  modified_on: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'rb_brands',
  timestamps: false,
});

export default RbBrands;
