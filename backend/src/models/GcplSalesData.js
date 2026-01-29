import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const GcplSalesData = sequelize.define('gcpl_sales_data', {
  "Brand Name": {
    type: DataTypes.STRING,
  },
  BU: {
    type: DataTypes.STRING,
  },
  city: {
    type: DataTypes.STRING,
  },
  "City Type": {
    type: DataTypes.STRING,
  },
  Date: {
    type: DataTypes.STRING,
  },
  "DT Code": {
    type: DataTypes.STRING,
  },
  FY: {
    type: DataTypes.STRING,
  },
  "GCPL Description": {
    type: DataTypes.STRING,
  },
  item_id: {
    type: DataTypes.INTEGER,
  },
  Month: {
    type: DataTypes.STRING,
  },
  "NSV in Lacs": {
    type: DataTypes.DECIMAL,
  },
  product_id: {
    type: DataTypes.INTEGER,
  },
  product_name: {
    type: DataTypes.STRING,
  },
  Region: {
    type: DataTypes.STRING,
  },
  "Sub Brand": {
    type: DataTypes.STRING,
  },
  "Sum of mrp_gmv": {
    type: DataTypes.DECIMAL,
  },
  "Sum of NSV": {
    type: DataTypes.DECIMAL,
  },
  "Sum of qty_sold": {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: 'gcpl_sales_data',
  timestamps: false,
});

export default GcplSalesData;
