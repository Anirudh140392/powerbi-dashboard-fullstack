import availabilityService from './src/services/availabilityService.js';
import dayjs from 'dayjs';

const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

const buildPlatformChannelCond = (platform, channel, prefix = '') => {
    if (platform && platform !== 'All') {
        const pArr = Array.isArray(platform) ? platform : [platform];
        return `lower(replace(${prefix}Platform, ' ', '_')) IN (${pArr.map(p => `'${escapeStr(p.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`;
    }

    if (channel === 'Ecommerce' || channel === 'E-commerce') {
        return `lower(${prefix}Platform) = 'blinkit'`;
    }

    if (channel === 'Modern Trades') {
        return `lower(${prefix}Platform) != 'blinkit'`;
    }

    return null;
};

const buildAvailabilityWhereClause = (filters, tableAlias = '') => {
    const {
        platform, brand, location, startDate, endDate, dates, months,
        cities, categories, formats, zones, metroFlags, pincodes
    } = filters;
    const conditions = [];

    const prefix = tableAlias ? `${tableAlias}.` : '';

    const platformCond = buildPlatformChannelCond(platform, filters.channel, prefix);
    if (platformCond) {
        conditions.push(platformCond);
    }

    if (brand && brand !== 'All') {
        const bArr = Array.isArray(brand) ? brand : [brand];
        conditions.push(`lower(replace(${prefix}Brand, ' ', '_')) IN (${bArr.map(b => `'${escapeStr(b.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    const lArr = [];
    if (location && location !== 'All') {
        if (Array.isArray(location)) {
            const filtered = location.filter(v => v !== 'All' && v !== 'all');
            lArr.push(...filtered);
        } else {
            lArr.push(location);
        }
    }
    if (lArr.length > 0) {
        const uniqueLArr = [...new Set(lArr)];
        conditions.push(`lower(replace(${prefix}Location, ' ', '_')) IN (${uniqueLArr.map(l => `'${escapeStr(l.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`);
    }

    if (startDate && endDate) {
        const startStr = dayjs(startDate).format('YYYY-MM-DD');
        const endStr = dayjs(endDate).format('YYYY-MM-DD');
        conditions.push(`${prefix}DATE BETWEEN '${startStr}' AND '${endStr}'`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

const query = {
    platform: 'All',
    brand: 'All',
    location: 'All',
    startDate: '2026-03-01',
    endDate: '2026-03-04'
};
console.log("WhereClause:", buildAvailabilityWhereClause(query, 't1'));
