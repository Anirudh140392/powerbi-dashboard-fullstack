const buildPlatformChannelCond = (platform, channel, columnName = 'Platform', forceLower = false, channelColumn = null) => {
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
    const formatStr = (s) => forceLower && s ? s.toLowerCase() : s;

    let conditions = [];

    if (platform && platform !== 'All') {
        const platforms = Array.isArray(platform) ? platform : (typeof platform === 'string' && platform.includes(',') ? platform.split(',') : [platform]);
        if (platforms.length === 1) {
            conditions.push(`${columnName} = '${escapeStr(formatStr(platforms[0]))}'`);
        } else if (platforms.length > 1) {
            const list = platforms.map(p => `'${escapeStr(formatStr(p.trim()))}'`).join(', ');
            conditions.push(`${columnName} IN (${list})`);
        }
    }

    if (channel && channel !== 'All') {
        const channels = Array.isArray(channel) ? channel : (typeof channel === 'string' && channel.includes(',') ? channel.split(',') : [channel]);
        if (channelColumn) {
            // Using the actual database channel column
            const list = channels.map(c => `'${escapeStr(c.trim())}'`).join(', ');
            conditions.push(`lower(${channelColumn}) IN (${list.toLowerCase()})`);
        } else {
            // Fallback for tables without a channel column (by filtering on platforms)
            const isEcom = channels.some(c => ['ecommerce', 'e-commerce', 'ecom'].includes(c.toLowerCase()));
            const isQuickComm = channels.some(c => c.toLowerCase().includes('quick'));
            const isModernTrade = channels.some(c => ['modern trades', 'moderntrade'].includes(c.toLowerCase()));

            const ecomPlatforms = ['Amazon', 'Flipkart'];
            const quickPlatforms = ['Blinkit', 'Zepto', 'Instamart', 'Swiggy Instamart', 'Swiggy'];

            if (isQuickComm) {
                conditions.push(`${columnName} IN (${quickPlatforms.map(p => `'${formatStr(p)}'`).join(', ')})`);
            } else if (isEcom && !isModernTrade) {
                conditions.push(`${columnName} IN (${ecomPlatforms.map(p => `'${formatStr(p)}'`).join(', ')})`);
            } else if (isModernTrade && !isEcom) {
                const allEcomQuick = [...ecomPlatforms, ...quickPlatforms];
                conditions.push(`${columnName} NOT IN (${allEcomQuick.map(p => `'${formatStr(p)}'`).join(', ')})`);
            }
        }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : null;
};

console.log("Ecommerce with null channelColumn:");
console.log(buildPlatformChannelCond(null, 'Ecommerce', 'Platform', false, null));
console.log("Ecommerce with empty array platform:");
console.log(buildPlatformChannelCond([], 'Ecommerce', 'Platform', false, null));
console.log("Ecommerce with '' platform:");
console.log(buildPlatformChannelCond('', 'Ecommerce', 'Platform', false, null));
