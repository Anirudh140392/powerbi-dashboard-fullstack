import sequelize from './src/config/db.js';

const inspectTable = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const [results, metadata] = await sequelize.query("DESCRIBE rb_pdp_olap");
        console.log('Table Structure:', results);

    } catch (error) {
        console.error('Unable to connect or describe table:', error);
    } finally {
        await sequelize.close();
    }
};

inspectTable();
