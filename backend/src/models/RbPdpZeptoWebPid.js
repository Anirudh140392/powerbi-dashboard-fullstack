import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbPdpZeptoWebPid = sequelize.define('rb_pdp_zepto_web_pid', {
  created_on: {
    type: DataTypes.DATE,
  },
  gmv: {
    type: DataTypes.DECIMAL,
  },
  inventory: {
    type: DataTypes.INTEGER,
  },
  location_update: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  Qty_Sold: {
    type: DataTypes.DECIMAL,
  },
  sku_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  web_pid: {
    type: DataTypes.STRING,
  },
}, {
  tableName: 'rb_pdp_zepto_web_pid',
  timestamps: false,
});

export default RbPdpZeptoWebPid;
