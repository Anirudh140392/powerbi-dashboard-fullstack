import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbPdpMismatched = sequelize.define('rb_pdp_mismatched', {
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
    allowNull: false,
  },
  inventory: {
    type: DataTypes.INTEGER,
  },
  Location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Location_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  MRP: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  MSL: {
    type: DataTypes.INTEGER,
  },
  neno_osa: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Platform: {
    type: DataTypes.STRING,
  },
  Platform_id: {
    type: DataTypes.INTEGER,
  },
  Product: {
    type: DataTypes.STRING,
  },
  Qty_Sold: {
    type: DataTypes.DECIMAL,
  },
  Rating: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Sales: {
    type: DataTypes.DECIMAL,
  },
  Selling_Price: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Sub_Category: {
    type: DataTypes.STRING,
  },
  URL: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Web_Pid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Weight: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'rb_pdp_mismatched',
  timestamps: false,
});

export default RbPdpMismatched;
