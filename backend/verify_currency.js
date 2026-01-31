const formatCurrency = (value) => {
    const val = parseFloat(value);
    if (isNaN(val)) return "0";

    if (val >= 1000000000) return `₹${(val / 1000000000).toFixed(2)} B`;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 1000000) return `₹${(val / 1000000).toFixed(2)} M`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lac`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(2)} K`;
    return `₹${val.toFixed(2)}`;
};

const testCases = [
    { input: 1500000000, expected: "₹1.50 B" },
    { input: 15000000, expected: "₹1.50 Cr" },
    { input: 1500000, expected: "₹1.50 M" },
    { input: 150000, expected: "₹1.50 Lac" },
    { input: 1500, expected: "₹1.50 K" },
    { input: 500, expected: "₹500.00" },
    { input: 0, expected: "₹0.00" },
    { input: "invalid", expected: "0" }
];

testCases.forEach(({ input, expected }) => {
    const result = formatCurrency(input);
    console.log(`Input: ${input} -> Output: ${result} [${result === expected ? 'PASS' : 'FAIL'}]`);
});
