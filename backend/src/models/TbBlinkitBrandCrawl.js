import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const TbBlinkitBrandCrawl = sequelize.define('tb_blinkit_brand_crawl', {
  brand_id: {
    type: DataTypes.INTEGER,
  },
  brand_name: {
    type: DataTypes.STRING,
  },
  created_on: {
    type: DataTypes.DATE,
  },
  discount: {
    type: DataTypes.DECIMAL,
  },
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  images: {
    type: DataTypes.TEXT,
  },
  inventory: {
    type: DataTypes.INTEGER,
  },
  latitude: {
    type: DataTypes.DECIMAL,
  },
  leaf_category: {
    type: DataTypes.STRING,
  },
  location_id: {
    type: DataTypes.STRING,
  },
  location_name: {
    type: DataTypes.STRING,
  },
  location_sales: {
    type: DataTypes.STRING,
  },
  longitude: {
    type: DataTypes.DECIMAL,
  },
  merchant_name: {
    type: DataTypes.STRING,
  },
  merchant_type: {
    type: DataTypes.STRING,
  },
  mrp: {
    type: DataTypes.DECIMAL,
  },
  offer: {
    type: DataTypes.TEXT,
  },
  osa: {
    type: DataTypes.INTEGER,
  },
  osa_remark: {
    type: DataTypes.STRING,
  },
  pf_id: {
    type: DataTypes.INTEGER,
  },
  pincode: {
    type: DataTypes.STRING,
  },
  Platform_name: {
    type: DataTypes.STRING,
  },
  price: {
    type: DataTypes.DECIMAL,
  },
  product_id: {
    type: DataTypes.INTEGER,
  },
  product_position: {
    type: DataTypes.INTEGER,
  },
  region: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.STRING,
  },
  subcategory_id: {
    type: DataTypes.INTEGER,
  },
  title: {
    type: DataTypes.STRING,
  },
  unit: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'tb_blinkit_brand_crawl',
  timestamps: false,
});

export default TbBlinkitBrandCrawl;
