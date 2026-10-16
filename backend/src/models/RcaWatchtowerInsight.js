import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const RcaWatchtowerInsight = sequelize.define('rca_watchtower_insight', {
    date: {
        type: DataTypes.DATEONLY,
    },
    platform: {
        type: DataTypes.STRING,
    },
    pf_id: {
        type: DataTypes.INTEGER,
    },
    pincode: {
        type: DataTypes.INTEGER,
    },
    web_pid: {
        type: DataTypes.STRING,
    },
    Darkstore_name: {
        type: DataTypes.STRING,
    },
    sales_rank: {
        type: DataTypes.INTEGER,
    },
    avg_osa_7d: {
        type: DataTypes.STRING,
    },
    total_dark_store: {
        type: DataTypes.INTEGER,
    },
    active_dark_store: {
        type: DataTypes.INTEGER,
    },
    type: {
        type: DataTypes.STRING,
    }
}, {
    tableName: 'rca_watchtower_insight',
    timestamps: false,
});

export default RcaWatchtowerInsight;
