import 'dotenv/config';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import sequelize from './src/config/db.js';
import { Op } from 'sequelize';

const debugAvailability = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB");

        // 1. Check for any brand containing "Godrej"
        const godrejBrands = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Brand')), 'Brand']],
            where: {
                Brand: {
                    [Op.like]: '%Godrej%'
                }
            },
            raw: true
        });
        console.log("Brands matching %Godrej% in RbPdpOlap:", godrejBrands.map(b => b.Brand));

        // 2. Check for any location containing "Agra"
        const agraLocations = await RbPdpOlap.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('Location')), 'Location']],
            where: {
                Location: {
                    [Op.like]: '%Agra%'
                }
            },
            raw: true
        });
        console.log("Locations matching %Agra% in RbPdpOlap:", agraLocations.map(l => l.Location));

        // 3. Check if there is ANY data for Godrej (exact) anywhere
        const godrejExact = await RbPdpOlap.count({
            where: { Brand: 'Godrej' }
        });
        console.log("Count of exact 'Godrej' in RbPdpOlap:", godrejExact);

        // 4. Check if there is ANY data for Agra (exact) anywhere
        const agraExact = await RbPdpOlap.count({
            where: { Location: 'Agra' }
        });
        console.log("Count of exact 'Agra' in RbPdpOlap:", agraExact);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
};

debugAvailability();
