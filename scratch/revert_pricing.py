with open('ds_tester/backend/modules/pricing.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('"abs_tol": 0.5,\n            "rel_tol": 0.02,', '"abs_tol": 0.05,\n            "rel_tol": 0.005,')
text = text.replace('"abs_tol": 0.5,\r\n            "rel_tol": 0.02,', '"abs_tol": 0.05,\r\n            "rel_tol": 0.005,')
text = text.replace('"abs_tol": 1.0,\n            "rel_tol": 0.01,', '"abs_tol": 0.1,\n            "rel_tol": 0.002,')
text = text.replace('"abs_tol": 1.0,\r\n            "rel_tol": 0.01,', '"abs_tol": 0.1,\r\n            "rel_tol": 0.002,')

with open('ds_tester/backend/modules/pricing.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Reverted pricing.py successfully.')

