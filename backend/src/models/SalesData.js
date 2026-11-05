import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const SalesData = sequelize.define('sales_data', {
  DATE: {
    type: DataTypes.DATE,
  },
  inventory: {
    type: DataTypes.INTEGER,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pf_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  qty_sold: {
    type: DataTypes.DECIMAL,
  },
  sales: {
    type: DataTypes.DECIMAL,
  },
  sku_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'sales_data',
  timestamps: false,
});

export default SalesData;
