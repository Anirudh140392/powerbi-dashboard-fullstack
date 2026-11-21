throw new Error(
  'fix_product_names.cjs is disabled. Product name normalization must be handled by the canonical MySQL-to-Postgres sync flow, not by ad-hoc direct updates to masters.products.'
);
