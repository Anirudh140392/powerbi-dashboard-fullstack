const brand = 'All';
const sku = null;
const keyword = 'derma co';
const dimColumn = sku ? 'keyword_search_product' : (brand ? 'brand' : 'keyword');
const dimValue = sku || brand || keyword;
console.log(dimColumn, dimValue);
