
import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RbLocation = sequelize.define('rb_location', {
    location_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    pf_id: {
        type: DataTypes.INTEGER,
    },
    location_name: {
        type: DataTypes.STRING,
    },
    tier: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.INTEGER,
    },
}, {
    tableName: 'rb_location',
    timestamps: false,
});

export default RbLocation;
