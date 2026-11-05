import RbPdpOlap from './RbPdpOlap.js';
import RbLocationDarkstore from './RbLocationDarkstore.js';

// Define associations
RbPdpOlap.belongsTo(RbLocationDarkstore, {
    foreignKey: 'Location',
    targetKey: 'location',
    as: 'loc' // Match the alias used in the controller
});

RbLocationDarkstore.hasMany(RbPdpOlap, {
    foreignKey: 'Location',
    sourceKey: 'location'
});

export { RbPdpOlap, RbLocationDarkstore };
