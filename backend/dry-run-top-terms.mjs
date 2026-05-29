const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';

function buildCHCondition(value, column, options = {}) {
    const isAll = (val) => {
        if (!val) return true;
        if (Array.isArray(val)) {
            return val.some(v => {
                const lower = String(v).toLowerCase();
                return lower === 'all' || lower === 'all india';
            });
        }
        const lower = String(val).toLowerCase();
        return lower === 'all' || lower === 'all india';
    };

    if (isAll(value)) return "1=1";

    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(v => !isAll(v))
        : Array.isArray(value) ? value.filter(v => !isAll(v)) : [value];

    if (list.length === 0) return "1=1";

    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
}

function test(keywordTypes) {
    console.log('Input:', keywordTypes);
    let mappedType = keywordTypes;
    if (Array.isArray(mappedType)) {
        mappedType = mappedType.map(t => t === 'Competitor' ? 'Competition' : t);
    } else if (mappedType === 'Competitor') {
        mappedType = 'Competition';
    }
    const cond = buildCHCondition(mappedType, 'keyword_type');
    console.log('Generated Condition:', cond);
}

test('Branded');
test(['Branded', 'Generic']);
test(['Branded', 'Competitor']);
