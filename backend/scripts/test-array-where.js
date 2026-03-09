import dayjs from 'dayjs';

const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

const buildPlatformChannelCond = (platform, channel, prefix = '') => {
    if (platform && platform !== 'All') {
        const pArr = Array.isArray(platform) ? platform : [platform];
        return `lower(replace(${prefix}Platform, ' ', '_')) IN (${pArr.map(p => `'${escapeStr(p.toLowerCase().replace(/\s+/g, '_'))}'`).join(',')})`;
    }
    return null;
};

const buildAvailabilityWhereClause = (filters, tableAlias = '') => {
    const { platform, startDate, endDate } = filters;
    const conditions = [];
    const prefix = tableAlias ? `${tableAlias}.` : '';

    const platformCond = buildPlatformChannelCond(platform, filters.channel, prefix);
    if (platformCond) conditions.push(platformCond);

    if (startDate && endDate) {
        conditions.push(`${prefix}DATE BETWEEN '${dayjs(startDate).format('YYYY-MM-DD')}' AND '${dayjs(endDate).format('YYYY-MM-DD')}'`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
};

const query = {
    platform: ['Blinkit', 'Zepto'],
    startDate: '2026-03-01',
    endDate: '2026-03-04'
};
console.log("WhereClause (Array):", buildAvailabilityWhereClause(query, 't1'));
