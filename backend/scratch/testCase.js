const toPascalCase = (str) => {
    if (str === null || str === undefined) return '';
    const s = String(str);
    // If it's a number with a % sign, return as is
    if (/^[0-9.-]+%?$/.test(s.trim())) {
        return s;
    }
    return s.split(/\s+/).map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
};

console.log(toPascalCase('blinkit'));
console.log(toPascalCase('Product name'));
console.log(toPascalCase('CW OSA %'));
console.log(toPascalCase('50.00%'));
console.log(toPascalCase('-10.5%'));
