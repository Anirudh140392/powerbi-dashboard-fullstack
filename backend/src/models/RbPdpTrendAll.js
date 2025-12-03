import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbPdpTrendAll = sequelize.define('rb_pdp_trend_all', {
  Brand: {
    type: DataTypes.STRING,
  },
  Brand_id: {
    type: DataTypes.INTEGER,
  },
  Category: {
    type: DataTypes.STRING,
  },
  Comp_flag: {
    type: DataTypes.INTEGER,
  },
  DATE: {
    type: DataTypes.DATE,
  },
  deno_osa: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  Discount: {
    type: DataTypes.DECIMAL,
  },
  Location: {
    type: DataTypes.STRING,
  },
  Location_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  MRP: {
    type: DataTypes.DECIMAL,
  },
  MSL: {
    type: DataTypes.INTEGER,
  },
  neno_osa: {
    type: DataTypes.DECIMAL,
  },
  Platform: {
    type: DataTypes.STRING,
  },
  Platform_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  Product: {
    type: DataTypes.STRING,
  },
  Rating: {
    type: DataTypes.DECIMAL,
  },
  Selling_Price: {
    type: DataTypes.DECIMAL,
  },
  Sub_Category: {
    type: DataTypes.STRING,
  },
  URL: {
    type: DataTypes.STRING,
  },
  Web_Pid: {
    type: DataTypes.STRING,
  },
  Weight: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'rb_pdp_trend_all',
  timestamps: false,
});

export default RbPdpTrendAll;
