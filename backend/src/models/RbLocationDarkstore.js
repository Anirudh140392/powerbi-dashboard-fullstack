import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbLocationDarkstore = sequelize.define('rb_location_darkstore', {
  created_on: {
    type: DataTypes.DATE,
  },
  kw_flag: {
    type: DataTypes.INTEGER,
  },
  location: {
    type: DataTypes.STRING,
  },
  location_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  location_lat: {
    type: DataTypes.DECIMAL,
  },
  location_lng: {
    type: DataTypes.DECIMAL,
  },
  location_sales: {
    type: DataTypes.STRING,
  },
  location_state: {
    type: DataTypes.STRING,
  },
  location_store_id: {
    type: DataTypes.STRING,
  },
  merchant_name: {
    type: DataTypes.STRING,
  },
  modified_on: {
    type: DataTypes.DATE,
  },
  pdp_flag: {
    type: DataTypes.INTEGER,
  },
  pf_id: {
    type: DataTypes.INTEGER,
  },
  pincode: {
    type: DataTypes.INTEGER,
  },
  pincode_area: {
    type: DataTypes.STRING,
  },
  platform: {
    type: DataTypes.STRING,
  },
  region: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.INTEGER,
  },
  store_first_seen: {
    type: DataTypes.DATE,
  },
  tier: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'rb_location_darkstore',
  timestamps: false,
});

export default RbLocationDarkstore;
