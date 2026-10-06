import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const KeyMetrics = sequelize.define('key_metrics', {
    key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        primaryKey: true,
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'key_metrics',
    timestamps: false,
});

export default KeyMetrics;
