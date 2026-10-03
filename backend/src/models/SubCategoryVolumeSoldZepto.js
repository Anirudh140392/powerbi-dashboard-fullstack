import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const SubCategoryVolumeSoldZepto = sequelize.define('sub_category_volume_sold_zepto', {
  Category: {
    type: DataTypes.STRING,
  },
  sub_category_volume_sold: {
    type: DataTypes.DECIMAL,
  },
  WEEK: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'sub_category_volume_sold_zepto',
  timestamps: false,
});

export default SubCategoryVolumeSoldZepto;
