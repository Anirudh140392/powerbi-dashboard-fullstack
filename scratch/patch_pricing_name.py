with open('ds_tester/backend/modules/pricing.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('class PricingModule:\n    name = "pricing"', 'class PricingModule:\n    name = "pricing"\n    display_name = "Pricing Analysis"')
text = text.replace('class PricingModule:\r\n    name = "pricing"', 'class PricingModule:\r\n    name = "pricing"\r\n    display_name = "Pricing Analysis"')

with open('ds_tester/backend/modules/pricing.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated PricingModule display_name.')

