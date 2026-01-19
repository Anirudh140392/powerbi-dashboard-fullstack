import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbPdpOlap = sequelize.define('rb_pdp_olap', {
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
    type: DataTypes.STRING,
    allowNull: false,
  },
  Discount: {
    type: DataTypes.STRING,
  },
  inventory: {
    type: DataTypes.INTEGER,
  },
  Location: {
    type: DataTypes.STRING,
  },
  Location_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  MRP: {
    type: DataTypes.STRING,
  },
  MSL: {
    type: DataTypes.STRING,
  },
  neno_osa: {
    type: DataTypes.STRING,
  },
  Platform: {
    type: DataTypes.STRING,
  },
  Platform_id: {
    type: DataTypes.BIGINT,
  },
  Product: {
    type: DataTypes.STRING,
  },
  Qty_Sold: {
    type: DataTypes.DECIMAL,
  },
  Rating: {
    type: DataTypes.STRING,
  },
  Sales: {
    type: DataTypes.DECIMAL,
  },
  Selling_Price: {
    type: DataTypes.STRING,
  },
  Sub_Category: {
    type: DataTypes.STRING,
  },
  URL: {
    type: DataTypes.STRING,
  },
  Web_Pid: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  Weight: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'rb_pdp_olap',
  timestamps: false,
});

export default RbPdpOlap;
