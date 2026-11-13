import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const SubCategoryBrandMarketShareZepto = sequelize.define('sub_category_brand_market_share_zepto', {
  brand: {
    type: DataTypes.STRING,
  },
  brand_market_share: {
    type: DataTypes.DECIMAL,
  },
  Category: {
    type: DataTypes.STRING,
  },
  WEEK: {
    type: DataTypes.BIGINT,
  },
}, {
  tableName: 'sub_category_brand_market_share_zepto',
  timestamps: false,
});

export default SubCategoryBrandMarketShareZepto;
